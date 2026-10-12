#!/usr/bin/env python3
"""Saves the window-tint script as the DevTools snippet "tint" in the Claude desktop app.

You run it yourself, from the Terminal line that /mod_tint desktop copies. The app keeps
DevTools snippets in its Preferences file and rewrites that file while it runs, so this
quits the app first (as the app's own Quit would), saves, and opens the app again. When the
app asks "Claude is still working…" it waits up to 10 minutes for "Quit anyway", saying so.
It saves a copy of Preferences first, then changes only DevTools settings: the snippet
"tint", and DevTools opening on Sources -> Snippets. With --dev-mode it also turns on the
app's Developer Mode (what Help -> Troubleshooting -> Enable Developer Mode... writes), so
DevTools opens with Option-Command-I. Then it exits; nothing keeps running.

Usage: desktop-snippet.py --prefs <Preferences> --snippet <tint.js> --backup <file>
                          [--dev-mode <developer_settings.json>] [--restart]
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
# While any Claude session is working (always the one that typed /mod_tint desktop go), the app
# answers a quit with "Claude is still working... Quit anyway / Wait for Claude / Cancel" and
# waits for a click. So this waits as long as a person may take, saying so, in this window.
QUIT_WAIT_S = 600
SAY_EVERY_S = 15


def app_running():
    out = subprocess.run(['ps', '-axo', 'comm='], capture_output=True, text=True).stdout
    return any(line.strip().endswith(APP) for line in out.splitlines())


def quit_app():
    print('window-tint: 👉 If Claude asks "Claude is still working…", click "Quit anyway".')
    print('             (The working session is the one that started this. It comes back after.)')
    # Not waited on: the app may hold the answer until the question is clicked.
    asked = subprocess.Popen(['osascript', '-e', f'tell application id "{BUNDLE}" to quit'],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for waited in range(QUIT_WAIT_S):
            if not app_running():
                time.sleep(1)   # let it finish writing its files
                return True
            if waited > 0 and waited % SAY_EVERY_S == 0:
                print(f'window-tint: ⏳ waiting for Claude to quit ({waited} s). Click "Quit anyway" in Claude.'
                      ' Clicked Cancel? Quit Claude with ⌘Q. Nothing is installed yet.')
            time.sleep(1)
        return False
    finally:
        if asked.poll() is None:
            asked.kill()


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


def write_json(path, data, mode):
    temporary = path + '.tint-tmp'
    with open(temporary, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    os.chmod(temporary, mode)
    with open(temporary, encoding='utf-8') as f:
        json.load(f)   # never swap in a file the app could not read
    os.replace(temporary, path)


def dev_mode_on(path):
    """Turns on Developer Mode the way the app's own menu item does. Returns True when it changed."""
    data = {}
    if os.path.isfile(path):
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
    if data.get('allowDevTools') is True:
        return False
    data['allowDevTools'] = True
    write_json(path, data, os.stat(path).st_mode & 0o777 if os.path.isfile(path) else 0o600)
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--prefs', required=True)
    parser.add_argument('--snippet', required=True)
    parser.add_argument('--backup', required=True)
    parser.add_argument('--dev-mode', help='developer_settings.json: turn on Developer Mode too')
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
        try:
            has_quit = quit_app()
        except KeyboardInterrupt:
            print('\nwindow-tint: ❌ stopped. NOT installed; nothing was changed.')
            return 3
        if not has_quit:
            print(f'window-tint: ❌ NOT installed: Claude was still open after {QUIT_WAIT_S // 60} minutes.'
                  ' Nothing was changed. In Claude, type /mod_tint desktop go to try again.')
            return 3
    try:
        save(args.prefs, args.snippet, args.backup)
        print('window-tint: ✅ snippet "tint" saved (backup: ' + args.backup + ').')
        if args.dev_mode:
            try:
                if dev_mode_on(args.dev_mode):
                    print('window-tint: ✅ Developer Mode turned on.')
            except Exception as error:
                print(f'window-tint: Developer Mode not changed ({error}). Turn it on in the app: Help -> Troubleshooting -> Enable Developer Mode...')
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
