# Changelog

All notable changes to this mod. Versions follow [semantic versioning](https://semver.org/) as described in [docs/releasing.md](docs/releasing.md).

## [1.7.3] - 2026-10-09

### Fixed
- **No more double or overflowing rings after resizing or opening and closing windows.** Each repaint draws a window's ring on its slot (the first box around it with room to spare). After a resize, the slot can be a different box, and the old one kept its ring and its width limit when it was still used for something else, so rings doubled up or ran past the window's edge. Each repaint now removes rings and width limits that are not part of the current layout. Needs the new desktop script once: the band offers **Update**.
- **`/mod_tint update` right after a release** no longer says tint is up to date: it refreshes the local copy of tint's marketplace first.

## [1.7.2] - 2026-10-09

### Fixed
- **No more empty gray box above the message box.** The desktop app wraps anything a mod draws above the prompt in a padded card, so the 1-pixel colors label (1.7.0) showed as an empty box. The label now sits in the footer beside the mode labels, where the app adds no card and a question card cannot hide it.

### Changed
- **README:** a second app window (its own red, yellow and green buttons) runs the desktop script on its own: press **⌥⌘I** in that window and run **tint** there too.

## [1.7.1] - 2026-10-09

### Fixed
- **A new window gets its colors even with the sidebar hidden.** The desktop script learned each window's repo and emoji only from its row in the sidebar, so a window opened while the sidebar was hidden stayed uncolored (only its title changed). The 1-pixel label above each message box now also names the window's own repo and number, and the script reads it first.

## [1.7.0] - 2026-10-09

### Added
- **Colors you choose show in the whole desktop app right away.** The desktop script only knew each repo's emoji (it reads it from the sidebar and measures its color), and the color list saved with it never changed, so a chosen color (for example *make it lighter*) never reached the ring, the tint or the sidebar. Now tint draws a 1-pixel picture above the message box whose label holds every repo's chosen color, and the script reads it on each repaint. No reinstall when you change a color later. This needs the new desktop script once: the band offers **Update** (Claude closes and opens again).

### Changed
- **A much shorter README.** Install, color the app, and "just say it": `/mod_tint` plus your own words. The command table is gone from the README (`/mod_tint help` still lists it); the desktop details, privacy and uninstall are folded away.

## [1.6.1] - 2026-10-09

### Changed
- **New versions show the same day.** tint asks GitHub for its newest version every 6 hours instead of once a day, so the update band no longer lags up to a day behind a release.
- **A friendlier hint after `/mod_tint`.** The typeahead showed a long list of codes (`name <text> | color <#hex> | …`). It now says *say it your way*, with three examples, since Claude works out what you mean anyway.

### Fixed
- **The install's Terminal window closes by itself.** After **Color the app**, Terminal kept a finished window open with `[Process completed]`, which looked like something was still running or wrong. On success it now says *All done* and closes a few seconds later; on a problem it stays open with the message and says it is safe to close.
- When Claude names or hides one window, its answer no longer says "Other windows of the repository follow"; that line is only for repo-wide changes (emoji, color, border, pattern, undo).

## [1.6.0] - 2026-10-09

### Changed
- **Say it your way; Claude asks.** `/mod_tint` alone, a lone emoji, a typo or plain words (`/mod_tint go back`, `/mod_tint make it green`) no longer guess. Claude works out what you most likely mean and asks with a few choices (AskUserQuestion), your likely answer first. Clear commands (`icon 🧪`, `color teal`, `name Backend`...) still apply at once. Before, `/mod_tint 🧪` named the window "🧪", which nobody meant.
- **Repick lets you choose.** It used to ask a small background model for one emoji from the repo's name, file names and the first lines of its README, then apply it unseen. A placeholder README gave it almost nothing (one repo got 🧭 because it has a `MAP.md`). Now Claude in your window looks at what the repo is really for and offers 3 different emoji, plus keeping the current one.
- `/mod_tint help` shows the command list (`/mod_tint` alone now asks you).

### Added
- **`/mod_tint undo`**: back to the emoji and color before the last change; again to swap back. The earlier look is saved in `repos.json` as `previous`.
- **A tool for Claude, `mcp__tint__set`**, so it applies what you chose (emoji, color, window name, hide, titles, border, pattern, undo) without touching tint's files.

## [1.5.1] - 2026-10-09

### Fixed
- **Desktop app: no more auto-update steps that can't work.** The desktop app has no Marketplaces tab and no auto-update switch (only an **Update** button on the plugin's page). Its band now offers **Update now** alone; the terminal keeps **Enable auto-update**.
- **Update now without a `claude` command** (the desktop app alone doesn't add one) now says to type `/plugin`, choose **Tint**, then click **Update**.

### Changed
- **README:** install steps for the desktop app (Settings → Plugins → **+ Add** → **Add marketplace**) and for the Terminal (3 commands, one copy box each), and a table for updates in each.

## [1.5.0] - 2026-10-09

### Added
- **Know when a new version is out.** A marketplace someone adds never auto-updates unless they turn it on, and its owner can't do it for them. So once a day tint asks GitHub for its newest version (one small request). When it is newer and auto-update is off, the band ends with **✨ New version x.y.z** and two buttons: **Update now** and **Enable auto-update**. In the desktop app it rides along with the 2-step reminder and closes with it; on its own it counts down 60 seconds too, and comes back next session until you update.
- **`/mod_tint update`**: the same as `claude plugin update tint@claude-code-tint-mod`; then type `/reload-plugins`.
- **Enable auto-update** copies `/plugin` and shows the 3 steps (paste, **Marketplaces**, **claude-code-tint-mod** → **Enable auto-update**), pausing the countdown until **Done**. tint never changes your settings itself.

### Changed
- **README rewritten:** a 3-step "Get started" with a picture of the band and what to expect after every app start, a "Stay up to date" section with pictures, one commands table, and the details folded away.

## [1.4.0] - 2026-10-09

### Added
- **One click to color the whole desktop app.** In the desktop app, a band above the message box asks "Color the whole app too?". **Color the app** runs the same install as `/mod_tint desktop go` (Developer Mode included); **No thanks** keeps the band away in every window, and `/mod_tint desktop` still works any time.
- **A reminder after each app start.** Restarting the app turns the colors off, so the band shows the 2 steps to turn them on (⌥⌘I, then right-click `tint` → Run). It closes by itself after 60 seconds, counted from when you first see it, in every window until the app starts again.
- **A band worth looking at.** A bold border and a strip of colors flow together with the words to press, in colors that read well in dark mode. On the reminder, the strip is the countdown.
- **Easy to find and share.** The band names the mod as a link to its page, and **💌 Share tint** copies a short message with the link.

### Changed
- **Desktop updates are a band, not a one-time notice.** When the saved snippet is an older script, the band offers **Update** or **Later** (Later waits for the next version).

## [1.3.2] - 2026-10-09

### Fixed
- **A window in "No folder" turned purple (or another plain color).** Its thread title still started with a color square from an older version (`🟪1️⃣ …`), and the desktop tint used that square as the window's color. Old color squares now give no color, the same way they were already skipped when learning a repo's emoji. Run `/mod_tint desktop go` to install the fixed script.

## [1.3.1] - 2026-10-09

### Fixed
- **A repository whose folder name differs from its shown name stayed grey** (a `BAM_Knowledge` folder shown as `BAM-Knowledge`): its sidebar name had no color or emoji, and its threads got no hover tint. Names are now compared ignoring case, spaces, `-` and `_`. Run `/mod_tint desktop go` to install the fixed script.

## [1.3.0] - 2026-10-09

### Changed
- **Install in one go, no pasting.** `/mod_tint desktop` now only says what will happen. `/mod_tint desktop go` opens Terminal and runs the install there (Claude quits and comes back). `/mod_tint desktop line` copies the Terminal line to run yourself, as before.
- **Developer Mode included.** If it is off, the install turns it on, the same way the app's menu item does. The Developer Mode menu step is gone from the install.
- **One command to remember.** Once the tint is installed and current, `/mod_tint desktop` shows how to turn the colors on after an app start, in plain words. (The app always opens DevTools as its own window, so it cannot be docked smaller.)

### Fixed
- With Developer Mode off, the old answer put the Developer Mode step last, so it was easy to skip the Terminal line (found in a first-time-user test).
- The README now says how to turn Developer Mode off: the app has no menu item for it.

## [1.2.0] - 2026-10-09

### Added
- **`/mod_tint desktop` installs the desktop tint for you.** It copies one Terminal line. Pasted in Terminal, it quits Claude, backs up the app's settings, saves the script as the DevTools snippet `tint`, sets DevTools to open on Snippets, and opens Claude again. Then: ⌥⌘I → right-click `tint` → Run. No copying the script, no creating a snippet. Nothing keeps running afterwards.
- **Update notice:** in the desktop app, Claude Code says once when the saved snippet is older than the mod's script. Repo colors alone never count, since the script learns them.

### Changed
- `/mod_tint css` stays, for installing by hand; its answer points to `/mod_tint desktop`.

## [1.1.1] - 2026-10-09

### Fixed
- **Run the snippet from Sources → Snippets** (right-click `tint` → Run). The ⌘P → `!tint` shortcut from 1.1.0 does not reach DevTools in the desktop app. Tested in the app: the snippet stays saved across app restarts.

## [1.1.0] - 2026-10-09

### Added
- **The desktop tint learns new repositories by itself.** It reads the repository names in the app's sidebar and the emoji their threads start with, and measures that emoji's color the same way the mod does. A new repository gets its color without copying the script again. Colors saved in `repos.json` still win when present.

### Changed
- **Save once, run in four keys.** `/mod_tint css` and the README now set the script up as a DevTools snippet named `tint`. After each app start: ⌥⌘I, ⌘P, `!tint`, Enter. The desktop app can't run it by itself: it refuses to start with debugging switches and its code is sealed.

## [1.0.2] - 2026-10-09

### Fixed
- **The first emoji is now picked in the desktop app.** The desktop app runs Claude Code sessions through the SDK, which reports no person at the prompt when a session starts, so the automatic pick never ran there and windows kept a plain color square. A repository without an identity now gets one on your first message in any session that is drawn somewhere (desktop app, terminal, editor). Scripted `claude -p` runs still never pick.

## [1.0.1] - 2026-10-09

### Changed
- **Clearer help:** `/mod_tint` now shows three short tables (this window, every window of this repository, desktop app) instead of a block of text.
- **Simpler install, clearer desktop guide:** installing is three lines typed in Claude Code. The optional desktop tint now explains the one-time Developer Mode switch (Help → Troubleshooting → Enable Developer Mode…), pasting the script, troubleshooting, updating and uninstalling.

## [1.0.0] - 2026-10-09

First public release.

### Added
- **One identity per repository:** an emoji that says what the repository is (picked once by Claude Haiku from its name and README) and a color measured from that emoji on your Mac. Every window of a repository gets a number: `🧪1️⃣`, `🧪2️⃣` …
- **Titles that stay on topic:** on the desktop app, a short hidden note asks Claude to rename the window when its main topic changes (`/mod_tint titles off` to stop it).
- **Terminal strip:** a patterned strip in the repository's color above the prompt.
- **Whole-app tint for the Claude desktop app:** `/mod_tint css` copies a script for the app's DevTools console. It rings the window you are typing in, tints each window in its repository's color (shaded by window number), colors repository names, shows threads by number only, replaces the grey sidebar highlight with the window's color, colors the loading dots and Claude's mark, and redraws when windows change size. Light and dark mode.
- **Layout scan:** `/mod_tint css scan` copies a look-only report, for when an app update breaks the tint.
- **Commands:** `/mod_tint name`, `color`, `icon`, `repick`, `pattern`, `frame`, `titles`, `css`, `off`, `on`, `reset`.

### Notes
- The border around your own messages is off by default (`/mod_tint frame on`).
- Choices live in `~/.claude/window-tint/`.
