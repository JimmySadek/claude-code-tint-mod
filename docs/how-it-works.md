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
- **Number:** windows of the same repository agree on numbers through small files in `~/.claude/window-tint/windows/`. A window writes its claim at once and checks again; when two claim the same number at the same moment, the earlier claim keeps it (then the lower session id), and the 30-second heartbeat checks once more. Records not seen for a day are deleted. The number shows in the terminal strip and the desktop ring's shade, never in the title: a title lasts, a number is only the window's slot while it is open.
- **Saving:** `repos.json` is written whole (a temporary file, then renamed over it). A `repos.json` that is there but cannot be read is never written over: the change is refused and says so, since a save would keep one repository and lose the rest.

## Titles

A title is the repository's emoji, a space, then **Project · topic** (`🧪 Shop · Login bug`): the project in a word or two, then the main thread in 2 to 4 words, with no status words, dates or window number.

- **A mark of its own is kept.** The session that starts another one names it at birth: 💬 for a side chat, 🔧 for a helper, a project's emoji for a work room. Tint cannot tell which session started which, so it keeps any title that already starts with an emoji, and only fills titles that have none. 💬 and 🔧 are never a repository's emoji.
- **Tint's own marks are replaced:** a color square (shown until an emoji is picked) and any emoji the repository had before (`pastIcons` in `repos.json`, kept through `/mod_tint reset`). A flag or a skin tone counts as a mark.
- **The form before 1.9.0** (`🧪1️⃣ Topic`, `🧪12 Topic`) is rewritten without its number. Two plain digits count only after tint's own emoji, so `🔥20 recap` stays as it is.
- **In the terminal** the mod sets the title itself. **The desktop app** ignores that, so a short hidden note asks Claude to rename through the app's own tool: at your 2nd prompt, then every 5th, and once on any prompt (a parent session's message included) when the title has no mark yet. Claude renames only when the title lacks the shape or the main topic changed. `/mod_tint titles off` stops it; with the tint hidden no mark is added, and one the title has stays.

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
| Which repository a thread is under | the sidebar: a repo heading is `[data-row-key^="label:project-"]`, in the same `group/section` box as its threads |

Where a repository's color comes from:

1. **Live colors:** while `repos.json` has a color or emoji the saved snippet does not, the mod draws a 1-pixel picture (an `Svg`) in whatever band shows above each desktop window's prompt: the reminder, an update, or, when nothing else is on, a short **New colors** offer. Its label is `tint-colors {"repos": {name: [color, emoji]}, "window": [repo, number], "at": ms, "band": "colors"}`: every repository's chosen look from `repos.json`, the window's own repository, and when that window's copy of the mod last read a change in the colors (where labels disagree, the newest wins). The window number in it is not used: the windows' own agreement (1.9.1) gives every window its shade, labelled or not. `"band"` is there only on the New colors offer when it is alone in the band. The app draws each mod's tree inside an open shadow root on a `[data-plugin-drawn]` box, and the script looks there on each repaint, so a color chosen later shows at once with no reinstall. `"band": "colors"` means the band holds nothing else, so the script hides it: the colors already show. It marks the window and a style rule hides the band's box, so a box the app replaces stays hidden. When the script is not running, the band stays and offers to save the colors into the snippet. Until tint 1.9.1 the picture sat in the footer (`SessionMode`), but Claude desktop 2.42304 keeps only text and buttons there.
2. **Saved colors** filled in when the snippet was saved (from `repos.json`), when the repository is there.
3. Otherwise **the emoji its thread's title starts with** (`🗂️ …`), drawn on a canvas and measured the same way the mod measures it. A grey emoji gets a steady color made from the emoji itself. A color square, 💬 or 🔧 gives no color. Colors are never learned from other threads in the sidebar: a title's emoji may be a role or another project's.

So a new repository needs no new copy of the script.

## Installing the desktop tint

The app keeps DevTools snippets in its settings file, `~/Library/Application Support/Claude/Preferences`, under `electron → devtools → preferences → script-snippets`. It rewrites that file while it runs, so a change made then would be lost.

`/mod_tint desktop` only says what will happen. `/mod_tint desktop go` writes the script (with saved colors) to `~/.claude/window-tint/desktop-snippet.js` and a small `install-desktop.command` file next to it, and opens that file in Terminal, where it runs `helpers/desktop-snippet.py` in plain sight (`/mod_tint desktop line` copies the same line instead):

1. It quits the app (the app's own Quit) and waits for it to close.
2. It copies the settings file to `~/.claude/window-tint/Preferences.backup`.
3. It saves the snippet `tint` (replacing an older one) and sets DevTools to open on Sources → Snippets. Nothing else changes. It checks the new file reads back as valid JSON before swapping it in.
4. If Developer Mode is off, it turns it on in `developer_settings.json` (`allowDevTools: true`), the same file and value the app's Help → Troubleshooting → Enable Developer Mode… writes.
5. It opens the app again and exits. Nothing keeps running.

At the start of a desktop session, on each heartbeat and right after a color or emoji changes, the mod compares the saved snippet with its own script and says when an update is ready. Repo colors are compared on their own: colors the snippet lacks bring the **New colors** offer and the live picture described above. **Later** puts the offer off for that set of colors until the app starts again; the picture still rides in any other band. With nothing left to save there is no picture, and the script goes back to the saved colors. It reads the app's settings file again only when its modification time changes, and asks `ps` for the app's start time once per session start and then every 10 minutes.

How it draws:

- **Tints** set the app's own color variables inside each window, so the app keeps drawing everything itself.
- **The ring** is a layer on the slot around the window, a few pixels outside the window's edge. The script never changes a box's size (an older width limit to even the gaps could keep a window stuck narrow), so the right gap can be a little smaller. Each repaint removes rings left on boxes that are no longer a window's slot.
- **Loading dots** are drawn in a fixed orange that ignores color settings, so a CSS filter turns that orange into the window's color.
- **Titles** are left as they are, in the sidebar and in each window's top bar, so a title's emoji (💬, 🔧, a project's) stays in view.
- **Redraws** happen when a window, session, sidebar row or live label comes, goes or changes (the app replaces the boxes mods draw in many times a second and redraws inside them; those only lead to a look at the labels' text, at most every 0.25 s, and to a repaint only when that text changed), when anything outside the windows changes, when you click into another window, and when a window changes size. The conversation inside a window (Claude's streamed text, tool output, what you type) changes many times a second and never causes a redraw. Each redraw measures every window first, then paints.

Running the script again removes everything it added and paints from scratch, even after a failed first paint. Reloading the app removes it.

## Privacy

The desktop script reads only the open page, sends nothing, stores nothing and changes no file. The mod reads and writes only `~/.claude/window-tint/`, plus one small Claude Haiku call per new repository.
