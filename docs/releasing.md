# Releasing and updates

How a new version reaches people, and how to keep the desktop tint working when the Claude desktop app changes.

## Versions

The version lives in two files and must be the same in both:

- `.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `plugins[0].version`

| Change | Bump | Examples |
|---|---|---|
| Something people rely on stops working the old way | **major** (2.0.0) | a command renamed or removed, `~/.claude/window-tint/` data moved |
| New feature, nothing breaks | **minor** (1.1.0) | a new `/mod_tint` option, a new part of the app tinted |
| Fix only | **patch** (1.0.1) | a bug fix, new selectors after a desktop app update |

## Release checklist

1. Work on a branch, never directly on `main`.
2. Add the changes under a new `## [x.y.z] - YYYY-MM-DD` heading in `CHANGELOG.md` (Added, Changed, Removed, Fixed).
3. Bump the version in both files above.
4. Run the checks from a clone of the repository:

   ```
   claude plugin validate .
   claude plugin test .
   node --check desktop/tint.js
   node --check desktop/scan.js
   ```

5. If `desktop/tint.js` changed, try it in the desktop app: light and dark mode, one window, two windows side by side, and opening or closing a side panel. Run it twice to check that it turns off cleanly.
6. Merge to `main`, then tag and publish:

   ```
   git tag v1.0.1
   git push origin main --tags
   gh release create v1.0.1 --title "v1.0.1" --notes-file <(sed -n '/## \[1.0.1\]/,/## \[/p' CHANGELOG.md | sed '$d')
   ```

## How people get the update

```
/plugin marketplace update claude-code-tint-mod
/plugin update tint@claude-code-tint-mod
```

Then restart Claude Code. If `desktop/tint.js` changed, they run `/mod_tint css` again and paste it into the desktop app (and re-save their DevTools snippet, if they keep one).

## When a desktop app update breaks the tint

The tint relies on a few parts of the app's page (listed at the top of `desktop/tint.js`). An app update can rename them.

1. Run `/mod_tint css scan` and paste the scan into the app's DevTools console. It changes nothing; it copies a report.
2. Compare the report with the selectors at the top of `desktop/tint.js`.
3. Fix the selectors, check as above, and release a **patch** version. Note the app version you tested in the changelog.
