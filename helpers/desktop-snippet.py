#!/usr/bin/env python3
"""Saves the window-tint script as the DevTools snippet "tint" in the Claude desktop app.

You run it yourself, from the Terminal line that /mod_tint desktop copies. The app keeps
DevTools snippets in its Preferences file and rewrites that file while it runs, so this
quits the app first (as the app's own Quit would), saves, and opens the app again.
It saves a copy of Preferences first, then changes only DevTools settings: the snippet
"tint", and DevTools opening on Sources -> Snippets. Then it exits; nothing keeps running.

Usage: desktop-snippet.py --prefs <Preferences> --snippet <tint.js> --backup <file> [--restart]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

NAME = 'tint'
APP = '/Claude.app/Contents/MacOS/Claude'   # the desktop app; Claude Code itself is .../claude.app/.../claude
BUNDLE = 'com.anthropic.claudefordesktop'
QUIT_WAIT_S = 60


def app_running():
    out = subprocess.run(['ps', '-axo', 'comm='], capture_output=True, text=True).stdout
    return any(line.strip().endswith(APP) for line in out.splitlines())


def quit_app():
    subprocess.run(['osascript', '-e', f'tell application id "{BUNDLE}" to quit'], capture_output=True)
    for _ in range(QUIT_WAIT_S):
        if not app_running():
            time.sleep(1)   # let it finish writing its files
            return True
        time.sleep(1)
    return False


def save(prefs, snippet, backup):
    with open(prefs, encoding='utf-8') as f:
        data = json.load(f)
    with open(snippet, encoding='utf-8') as f:
        content = f.read()
    shutil.copy2(prefs, backup)
    tools = data.setdefault('electron', {}).setdefault('devtools', {}).setdefault('preferences', {})
    snippets = json.loads(tools.get('script-snippets') or '[]')
    for item in snippets:
        if item.get('name') == NAME:
            item['content'] = content
            break
    else:
        snippets.append({'name': NAME, 'content': content})
    # DevTools stores each setting as JSON text.
    tools['script-snippets'] = json.dumps(snippets, ensure_ascii=False, separators=(',', ':'))
    tools['panel-selected-tab'] = json.dumps('sources')
    tools['navigator-view-selected-tab'] = json.dumps('navigator-snippets')
    temporary = prefs + '.tint-tmp'
    with open(temporary, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    os.chmod(temporary, os.stat(prefs).st_mode & 0o777)
    with open(temporary, encoding='utf-8') as f:
        json.load(f)   # never swap in a file the app could not read
    os.replace(temporary, prefs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prefs', required=True)
    parser.add_argument('--snippet', required=True)
    parser.add_argument('--backup', required=True)
    parser.add_argument('--restart', action='store_true', help='quit the app first and open it again after')
    args = parser.parse_args()
    if not os.path.isfile(args.prefs):
        print('window-tint: the Claude desktop app\'s settings were not found. Is it installed?')
        return 2
    if app_running():
        if not args.restart:
            print('window-tint: quit the Claude app first (⌘Q), then run this again.')
            return 3
        print('window-tint: quitting the Claude app…')
        if not quit_app():
            print('window-tint: the app did not quit. Quit it yourself (⌘Q), then run this again.')
            return 3
    try:
        save(args.prefs, args.snippet, args.backup)
        print('window-tint: ✅ snippet "tint" saved (backup: ' + args.backup + ').')
        return 0
    except Exception as error:
        if os.path.exists(args.prefs + '.tint-tmp'):
            os.remove(args.prefs + '.tint-tmp')
        print(f'window-tint: not saved ({error}). Your settings are unchanged.')
        return 1
    finally:
        if args.restart:
            subprocess.run(['open', '-b', BUNDLE])
            print('window-tint: opening the Claude app. Then: ⌥⌘I, right-click "tint", Run.')


if __name__ == '__main__':
    sys.exit(main())
