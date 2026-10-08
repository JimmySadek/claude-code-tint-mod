# Changelog

All notable changes to this mod. Versions follow [semantic versioning](https://semver.org/) as described in [docs/releasing.md](docs/releasing.md).

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
