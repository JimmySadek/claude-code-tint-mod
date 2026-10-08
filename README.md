# claude-code-tint-mod

A Claude Code mod (CC mod: a plugin that changes how Claude Code looks and behaves) that helps you tell split windows apart. Every repository gets one identity (an emoji that says what the repo is, and a color taken from that emoji), and every window of a repository gets a number.

| Where | What you see |
|---|---|
| Window titles | `🧪1️⃣ <main topic>`, kept on the main topic by Claude (desktop) |
| Terminal | a patterned strip in the repo's color above the prompt |
| Your own messages | a border in the window's color, if you turn it on (`/mod_tint frame on`) |
| **The whole desktop app** | with `/mod_tint css`, see below |

## Install

```
/plugin marketplace add JimmySadek/claude-code-tint-mod
/plugin install tint@claude-code-tint-mod
/reload-plugins
```

To update later:

```
/plugin marketplace update claude-code-tint-mod
/plugin update tint@claude-code-tint-mod
```

## Color the whole desktop app

A mod can draw inside the conversation, but not the app around it. For that, `/mod_tint css` copies a small script you paste into the desktop app's own DevTools console.

1. In Claude Code, type `/mod_tint css`. The script is copied, with your repositories' colors filled in.
2. In the Claude desktop app, press **⌥⌘I** (Option, Command, I) to open DevTools, and choose **Console**.
3. Paste and press Enter. The first time, the console may ask you to type `allow pasting`.

What it does:

- **The window you are typing in:** a ring in its color just outside its edge, a soft tint on the conversation, and a colored text input.
- **Other open windows:** a lighter tint and a thin ring in their own color.
- **Sidebar:** stays neutral. Repo names are colored, with the repo's emoji in front. Threads show only their number (`3️⃣ Video mods`), in the sidebar and in each window's top bar. The thread of the focused window gets its color instead of the app's grey, and hovering a thread tints it in its repo's color.
- The loading dots and Claude's ✳ mark take each window's color.
- Windows of the same repository get different shades by their number. Light and dark mode both work.

To turn it off, run the script again. Reloading the app also removes it. To make re-running easy, save it once as a DevTools snippet (Sources, Snippets) and run it with one click after each app start.

**What it touches:** only how the open page looks. It sends nothing, stores nothing, changes no file and does not touch your sessions or their real titles. Shortened titles and colors are put back when you run it again.

**If an app update breaks it:** type `/mod_tint css scan`, run that script the same way, and compare its report with the selectors listed at the top of `desktop/tint.js`. The scan only reads.

## Commands

```
/mod_tint                   help
/mod_tint name Backend      name this window
/mod_tint color #7C3AED     color for every window of this repo
/mod_tint icon 🧪           emoji for every window of this repo
/mod_tint repick            ask Claude for a new emoji
/mod_tint frame on | off    border around your own messages (off at first)
/mod_tint titles off | on   stop or restart Claude keeping the title on the main topic
/mod_tint css               copy the desktop app tint
/mod_tint css scan          copy the look-only layout scan
/mod_tint off | on          hide or show the tint in this window
/mod_tint reset             forget this repo's choices
```

Choices are saved in `~/.claude/window-tint/repos.json`, shared by every window.

## What it uses

- **One small AI call per repository, once:** the first window of a new repository asks Claude Haiku for an emoji that fits the repo (from its name and README). The answer is saved and reused; it is never asked again for that repo. Scripted runs (`claude -p`) never ask.
- **No AI for colors:** the color is measured from the emoji on your Mac by a small Swift program.
- **Window titles:** on your 2nd prompt and then every 5th, a short hidden note asks the session's own Claude to rename the window if its main topic changed. Turn it off per window with `/mod_tint titles off`.
- **Files:** only `~/.claude/window-tint/` (choices, window numbers, measured colors and the compiled emoji helper).

## Requirements

- Claude Code 2.1.287 or later (mods).
- The emoji color is measured by a small Swift helper on macOS, compiled on first use. Elsewhere, Claude's own color choice is used.
- The desktop app script was built against Claude desktop 2.26454 (October 2026). It needs the app's DevTools; on macOS the app reads `"allowDevTools": true` from `~/Library/Application Support/Claude/developer_settings.json`.

## Check it

From a clone of this repository:

```
claude plugin validate .
claude plugin test .
```

## License

MIT. See [LICENSE](LICENSE).
