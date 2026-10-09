<p align="center">
  <img src="assets/images/banner.png" alt="claude-code-tint-mod: tell your Claude Code windows apart" width="100%">
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.7.3-46AD5B" alt="Version 1.7.3"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
  <a href="https://code.claude.com/docs/en/plugins/mods/overview"><img src="https://img.shields.io/badge/Claude%20Code-2.1.287%2B-D97757" alt="Claude Code 2.1.287 or later"></a>
</p>

# tint for Claude Code

**Never type into the wrong Claude Code window again.** tint gives every repository its own emoji and color, and every window a number, so windows side by side are easy to tell apart.

| Where | What you get |
|---|---|
| 🪟 **Window titles** | `🧪1️⃣ Fix login bug`: the repo's emoji, the window's number, the main topic |
| 💻 **Terminal** | a strip in the repo's color above the prompt |
| 🖥️ **Desktop app** | the whole app in color: a ring around the window you're in, a soft tint, colored repo names in the sidebar |

---

## 🚀 Get started

### 1. Install

<details open>
<summary><b>🖥️ In the Claude desktop app</b></summary>

1. Type `/plugin` and press **Enter**. **Settings → Plugins** opens.
2. Click **+ Add**, then **Add marketplace**.
3. Paste `JimmySadek/claude-code-tint-mod` and click **Sync**.
4. Click **Add** next to **Tint**, then start a new session.
</details>

<details>
<summary><b>💻 In Claude Code in the Terminal</b></summary>

Type these one at a time:

```
/plugin marketplace add JimmySadek/claude-code-tint-mod
```
```
/plugin install tint@claude-code-tint-mod
```
```
/reload-plugins
```
</details>

✅ From your first prompt, each repository gets its emoji and color.

### 2. Color the whole desktop app

A band above the message box asks **"Color the whole app with your tint mod?"** Click **Color the app**. Claude closes and opens again by itself, which takes a few seconds.

<p align="center">
  <img src="assets/images/desktop-install.png" alt="The tint band above the message box: Color the whole app with your tint mod? Click Color the app; Claude closes and opens again by itself. Buttons: Color the app, No thanks." width="100%">
</p>

After each app start, the band shows **2 steps** to turn the colors on: press **⌥⌘I**, then right-click **tint** → **Run**. About 5 seconds.

<p align="center">
  <img src="assets/images/desktop-reminder.png" alt="The tint band above the message box: 2 steps to activate your tint mod. 1, press Option Command I; a small tools window opens. 2, in that window, right-click tint, then click Run. A color strip counts down until the band closes by itself." width="100%">
</p>

---

## 💬 Change anything: just say it

Type `/mod_tint` and what you want, in your own words. Claude works out what you mean and asks you with a few choices to click.

```
/mod_tint new emoji
/mod_tint make it lighter
/mod_tint call this window Backend
/mod_tint go back
```

`/mod_tint` alone asks what you'd like to change. `/mod_tint help` lists the exact commands, if you ever want them.

Updates: when a new version is out, the band says **✨ New version** with an **Update now** button.

---

## 🩺 If something looks wrong

| You see | Do this |
|---|---|
| `/mod_tint` does nothing | Start a **new** session. |
| ⌥⌘I does nothing | Turn on Developer Mode: **Help → Troubleshooting → Enable Developer Mode…** |
| A second app window has no colors | Each app window runs the script on its own: in that window press **⌥⌘I**, then right-click **tint** → **Run**. |
| The tint looks doubled or stuck | Reload the app, then run the snippet once. |
| The app looks wrong after the install | Quit Claude and copy `~/.claude/window-tint/Preferences.backup` back over `~/Library/Application Support/Claude/Preferences`. |
| The tint stopped working after an app update | Type `/mod_tint css scan`, run it the same way, and [open an issue](../../issues/new/choose) with the report. |

<details>
<summary>🖥️ How the desktop colors work</summary>

A mod can draw inside the conversation, but not the app around it. So tint saves a small script in the desktop app's **DevTools** as a snippet named `tint`. **Color the app** opens Terminal, which quits Claude, backs up its settings to `~/.claude/window-tint/Preferences.backup`, saves the snippet, turns on Developer Mode and opens Claude again. The Terminal window closes by itself when it is done.

The script only changes how the open page looks. It sends nothing and changes no file. Colors you choose later show right away, with no reinstall. To turn it off, reload the app.

It can't start by itself: the app refuses outside scripts and debugging switches, which protects your signed-in account. A saved snippet is the safe way in.

**By hand instead:** turn on Developer Mode, type `/mod_tint css` (copies the script), then **⌥⌘I** → **Sources** → **Snippets** → **+ New snippet**, name it `tint`, paste, save with **⌘S**, right-click → **Run**.

**Developer Mode off again:** quit Claude, then run in Terminal:

```bash
printf '{"allowDevTools": false}\n' > ~/Library/Application\ Support/Claude/developer_settings.json
```
</details>

<details>
<summary>🔒 What it uses</summary>

- **Emoji:** the first window of a new repo asks Claude Haiku once for an emoji that fits it. Later changes happen in your window, only when you ask.
- **Colors:** measured from the emoji on your Mac by a small Swift program. No AI.
- **Window titles:** every few prompts, a short hidden note asks Claude to rename the window if its main topic changed.
- **Web:** at most one small request every 6 hours, asking GitHub for tint's newest version number. Nothing about you is sent.
- **Files:** only `~/.claude/window-tint/`.
</details>

<details>
<summary>🗑️ Uninstall</summary>

```bash
claude plugin uninstall tint@claude-code-tint-mod
```

Then delete `~/.claude/window-tint/` if you want nothing left.
</details>

---

**Requirements:** Claude Code 2.1.287 or later. macOS for the emoji colors and the desktop colors. Built against Claude desktop 2.26454 (October 2026).

**Contributors:** `claude plugin validate .` and `claude plugin test .`. Inside: [docs/how-it-works.md](docs/how-it-works.md). Releases: [docs/releasing.md](docs/releasing.md).

MIT. See [LICENSE](LICENSE).
