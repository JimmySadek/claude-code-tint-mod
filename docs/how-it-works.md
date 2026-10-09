# How it works

## Two parts

| Part | Where it runs | What it does |
|---|---|---|
| **The mod** (`hooks/register.tsx`) | inside Claude Code, in every session | repository identity, window numbers, titles, terminal strip, `/mod_tint` commands |
| **The desktop tint** (`desktop/tint.js`) | inside the Claude desktop app's page, after you paste it | everything you see around the conversation: rings, tints, sidebar, loading dots |

Why two parts: a mod can draw inside the conversation, but it is sealed off from the app's page around it (no access to the page, by design). The desktop app also has no setting for user styles, refuses to start with debugging switches, and its code is sealed (Electron's asar integrity check). So the whole-app part is a small script that you save once as a DevTools snippet and run after each app start. `/mod_tint css` copies it, with your saved colors filled in.

## Identity

- **Emoji:** the first window of a new repository asks Claude Haiku once for an emoji that fits the repository. It is saved in `~/.claude/window-tint/repos.json` and never asked again. `/mod_tint icon 🧪` changes it. `/mod_tint repick` hands the choice to Claude in the window: it looks at what the repository is for, offers 3 emoji with AskUserQuestion, and applies the one you pick through tint's own tool (`mcp__tint__set`). The look before each change is kept, so `/mod_tint undo` goes back.
- **Color:** measured from the emoji as macOS draws it, by `helpers/emoji-color.swift` (compiled on first use into `~/.claude/window-tint/`). If the emoji is dull or grey, Claude's suggested color is kept. `/mod_tint color #hex` sets one by hand.
- **Number:** windows of the same repository agree on numbers through small files in `~/.claude/window-tint/windows/`.

## The desktop tint

What it looks for in the app's page (measured on Claude desktop 2.26454, October 2026):

| Part | How it is found |
|---|---|
| A window | `.epitaxy-chat-panel` |
| The session it shows | `[data-session-id]` inside the window |
| Its sidebar row | `[data-row-key="code:<session id>"]`; the highlight is the row's `.group` box |
| The message box | `[data-cds="ChatComposer"]`, its text input `.bg-surface-3` |
| Loading dots / Claude's mark | `[data-cds="WorkingMark"]` / `svg[data-cds="Spark"]` |
| Colors | the app's `--cds-surface-*` and `--cds-clay` variables |
| A repository's name and emoji | the sidebar: a repo heading is `[data-row-key^="label:project-"]`, in the same `group/section` box as its threads; the emoji is the one its most recent thread's title starts with |

Where a repository's color comes from:

1. **Live colors:** the mod draws a 1-pixel picture above each desktop message box (an `Svg` in the `AbovePrompt` slot) whose label is `tint-colors {name: [color, emoji]}`, every repository's chosen look from `repos.json`. The script reads every such label on each repaint, so a color chosen later shows at once, with no reinstall.
2. **Saved colors** filled in when the snippet was saved (from `repos.json`), when the repository is there.
3. Otherwise **learned from the page**: the emoji its threads start with (`🗂️1️⃣ …`), drawn on a canvas and measured the same way the mod measures it. A grey emoji gets a steady color made from the emoji itself. Only repo headings count, never date headings like "Older".

So a new repository needs no new copy of the script.

## Installing the desktop tint

The app keeps DevTools snippets in its settings file, `~/Library/Application Support/Claude/Preferences`, under `electron → devtools → preferences → script-snippets`. It rewrites that file while it runs, so a change made then would be lost.

`/mod_tint desktop` only says what will happen. `/mod_tint desktop go` writes the script (with saved colors) to `~/.claude/window-tint/desktop-snippet.js` and a small `install-desktop.command` file next to it, and opens that file in Terminal, where it runs `helpers/desktop-snippet.py` in plain sight (`/mod_tint desktop line` copies the same line instead):

1. It quits the app (the app's own Quit) and waits for it to close.
2. It copies the settings file to `~/.claude/window-tint/Preferences.backup`.
3. It saves the snippet `tint` (replacing an older one) and sets DevTools to open on Sources → Snippets. Nothing else changes. It checks the new file reads back as valid JSON before swapping it in.
4. If Developer Mode is off, it turns it on in `developer_settings.json` (`allowDevTools: true`), the same file and value the app's Help → Troubleshooting → Enable Developer Mode… writes.
5. It opens the app again and exits. Nothing keeps running.

At the start of a desktop session the mod compares the saved snippet with its own script (repo colors left out, since the script learns them) and says once when an update is ready.

How it draws:

- **Tints** set the app's own color variables inside each window, so the app keeps drawing everything itself.
- **The ring** is a layer on the slot around the window, a few pixels outside the window's edge. The window is narrowed slightly so the gap is even on all sides.
- **Loading dots** are drawn in a fixed orange that ignores color settings, so a CSS filter turns that orange into the window's color.
- **Titles** are shortened on screen only (`🧪3️⃣ Title` shows as `3️⃣ Title`); the real session titles never change.
- **Redraws** happen when the page changes, when you click into another window, and when a window changes size.

Running the script again removes everything it added and puts the shortened titles back. Reloading the app does the same.

## Privacy

The desktop script reads only the open page, sends nothing, stores nothing and changes no file. The mod reads and writes only `~/.claude/window-tint/`, plus one small Claude Haiku call per new repository.
