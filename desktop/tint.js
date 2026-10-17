// window-tint for the Claude desktop app: colors the windows you work in.
//
// How to use: type /mod_tint css in Claude Code (it copies this script), open the desktop app's
// DevTools with ⌥⌘I, choose Console, paste, press Enter. Better: save it once as a DevTools
// snippet (Sources → Snippets) and after each app start run it there: right-click it, Run.
// Running it again is safe: it repaints from scratch, so the colors stay on. Reloading the app removes it.
//
// What it does (display only; it sends nothing and changes no file; it keeps only its open
// windows' numbers in the app's local storage, see NUMBERS):
//   - the window you are in (your last click or keyboard there, see FOCUS): a ring just outside its edge with a soft glow, a tint of
//     its color on the conversation, and a colored text input;
//   - other open windows: a lighter tint and a thin ring in their own color;
//   - the bottom area of each window (git bar, toolbar) keeps the app's own colors;
//   - sidebar: stays neutral; repo names are colored, with the repo's emoji in front;
//     thread titles stay as they are (their emoji says what each session is);
//     the thread of the focused window gets its color instead of the app's grey, other open
//     threads a thin bar, and hovering a thread tints it in its repo's color;
//   - the loading dots and Claude's mark in each window take that window's color;
//   - windows of one repo get shades by their number: 1 is the repo's own color, 2 to 10 each a
//     step away in lightness, hue and chroma (see SHADES), the 11th wraps to the first;
//   - light and dark mode.
//
// A window's color: the live label tint draws above the prompt while colors chosen after the
// snippet was saved are waiting (see LIVE), else REPOS (filled from ~/.claude/window-tint/repos.json
// when the snippet was saved), else the emoji its thread's title starts with, measured by drawing
// it on a canvas. So a new repo needs no new copy of this script, and a saved DevTools snippet
// keeps working.
//
// Built against Claude desktop 2.26454 (October 2026), measured with desktop/scan.js; the live
// labels follow Claude desktop 2.42304 (mods drawn in open shadow roots on [data-plugin-drawn]):
//   window = .epitaxy-chat-panel, its session = [data-session-id] inside it;
//   sidebar row = [data-row-key="code:<session id>"], its highlight = the row's .group box
//     (a thread nested under another: its label's nearest rounded box);
//   message box = [data-cds="ChatComposer"], its text input = .bg-surface-3;
//   loading dots = [data-cds="WorkingMark"] (drawn in a fixed orange: recolored by a CSS filter),
//   Claude's mark = svg[data-cds="Spark"] (fill);
//   colors = the app's --cds-surface-* variables.
// If an app update breaks it, run desktop/scan.js and compare.
(() => {
  // Already on (an earlier run in this page): start over, so a second Run never leaves it off.
  if (window.__windowTint) window.__windowTint.off()

  const REPOS = /*REPOS*/{}/*REPOS*/   // name as the app shows it (repo or folder) -> [color, emoji]
  // Live labels: while colors chosen after this script was saved wait to be saved into it, tint
  // draws a 1-pixel picture in the band above each window's prompt, labelled
  // 'tint-colors {"repos": {name: [color, emoji]}, "window": [repo, number], "at": ms, "band": "colors"}':
  // every repo's chosen look, so such a color shows on the next repaint, and the window's own repo
  // (its number is the mod's, so the windows' own agreement in NUMBERS is used instead: a window
  // without a label could take the same one). "at" is when that window's copy of the mod last read
  // a change in the colors, so where labels disagree (another window not caught up yet) the newest
  // wins. "band": "colors" says the band only offers to save those colors: they already show here,
  // so the band is hidden (see BANDS). (tint 1.7.0 labels held the repos map alone; up to 1.9.1 the
  // picture sat in the footer, where Claude desktop 2.42304 keeps only text and buttons.)
  // The page draws each mod's tree inside an open shadow root on a [data-plugin-drawn] box, so the
  // labels are looked for there too. Nothing is remembered: with no label (nothing left to save, or
  // a question card in the band for a while) REPOS stands in.
  const LIVE = 'tint-colors '
  const LIVE_SEL = `[alt^="${LIVE}"], [aria-label^="${LIVE}"]`
  const HOSTS = '[data-plugin-drawn]'
  const labelOf = el => {
    try { return JSON.parse((el.getAttribute('alt') || el.getAttribute('aria-label')).slice(LIVE.length)) } catch { return null }
  }
  const carriers = root => [
    ...root.querySelectorAll(LIVE_SEL),
    ...[...root.querySelectorAll(HOSTS)].flatMap(host => (host.shadowRoot ? [...host.shadowRoot.querySelectorAll(LIVE_SEL)] : [])),
  ]
  const ownOf = panel => {
    const label = labelOf(carriers(panel)[0] ?? document.createElement('i'))
    return Array.isArray(label?.window) ? label.window : null
  }
  // BANDS: a band holding only the colors offer, read by this script, is hidden: the app's box
  // around the drawing site (its card). The window gets a mark and a style rule hides its band's
  // box, so a box the app replaces (it does, many times a second) is hidden too, with no repaint.
  // A band outside any window gets its box hidden directly.
  const bandOwner = el => {
    const site = el.getRootNode()?.host?.closest('[data-engine-site="AbovePrompt"]')
    return site?.closest('.epitaxy-chat-panel') ?? site?.parentElement ?? null
  }
  // What the labels on the page say now: their text (to compare), every repo's look (where labels
  // disagree, the newest "at" wins) and the bands to hide. A repaint uses the last confirmed state
  // (see lookAtLabels), never a reading taken while the app is between two boxes.
  // A band box the app has just put in and not filled yet (no shadow root, or an empty one; a
  // filled one always holds the app's <style>) makes a reading "between": it is not counted. A box
  // still empty after BETWEEN_MS is simply empty (a band never drawn), so it never blocks readings.
  const BETWEEN_MS = 1000
  const emptySince = new WeakMap()
  const isBetween = () => {
    const now = Date.now()
    return [...document.querySelectorAll(`[data-engine-site="AbovePrompt"] ${HOSTS}`)].some(host => {
      if (host.shadowRoot && host.shadowRoot.childElementCount > 0) { emptySince.delete(host); return false }
      if (!emptySince.has(host)) emptySince.set(host, now)
      return now - emptySince.get(host) < BETWEEN_MS
    })
  }
  const readLabels = () => {
    const found = carriers(document).map(el => ({ el, label: labelOf(el) })).filter(each => each.label)
    const text = found.map(({ el }) => el.getAttribute('alt') || el.getAttribute('aria-label')).sort().join('\n')
    const labels = found.map(each => each.label).sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))   // oldest first
    const quiet = new Set(found.filter(each => each.label.band === 'colors').map(each => bandOwner(each.el)).filter(Boolean))
    return { text, repos: Object.assign({}, ...labels.map(label => label.repos ?? label)), quiet, isBetween: isBetween() }
  }
  const EMOJI = '\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*'
  const LEAD = new RegExp(`^${EMOJI}`, 'u')                                               // a leading emoji
  // A title's mark: "🧪 BAM · Topic", or the form before tint 1.9.0 with a number, "🧪3️⃣ Topic"
  // (that number was frozen when the window started, so it is never read as the window's).
  const TITLE = new RegExp(`^(${EMOJI})(?:([0-9])\\uFE0F?\\u20E3|([1-9][0-9]))?\\s`, 'u')
  const FOCUSED = 1, OTHER = 0.55               // how much tint a window gets
  const GAP = 8                                 // px between a window's edge and its ring

  // Colors.
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  const blend = (a, b, t) => { const B = rgb(b); return hex(rgb(a).map((v, i) => v + (B[i] - v) * t)) }   // t: 0 = a, 1 = b
  const isDark = () => document.documentElement.getAttribute('data-mode') === 'dark'
  // Window shades: window 1 is the repo's own color; windows 2 to 10 move it in OKLCH (perceived
  // lightness, chroma, hue) by one step each, so they look different from each other in light
  // and dark mode, also for very light or dark colors; the 11th wraps to the first. A step:
  // [lightness move as a share of the room left (-1 darker .. 1 lighter), hue turn in degrees,
  // chroma factor]. Lightness stays between SHADE_FLOOR and SHADE_CEIL, so no shade disappears on
  // a white or a dark background; a color lighter or darker than SHADE_ANCHOR steps from its
  // nearest end, so its shades stay apart too.
  // The steps go farthest first: each next window takes the shade whose smallest difference to
  // the windows before it is largest, worst case over 16 saved repo colors, so 2, 3 or 4 open
  // windows of a repo get the most different shades. Same table in hooks/register.tsx.
  const SHADES = [[1, -35, 0.73], [-1, -35, 0.85], [0.46, 35, 0.55], [0.16, -32, 1.35], [0.19, 35, 1.34], [-1, 21, 1.35], [0.8, 9, 1.3], [-0.18, -35, 1.35], [-0.21, 35, 1.3]]
  const SHADE_SPAN = 0.394, SHADE_FLOOR = 0.38, SHADE_CEIL = 0.88, SHADE_ANCHOR = [0.45, 0.81]
  const toLinear = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const toByte = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
  const oklch = hex => {
    const [r, g, b] = [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16)))
    const [l, m, s] = [
      0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
      0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
      0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
    ].map(Math.cbrt)
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360]
  }
  const fromOklch = (L, C, H) => {   // chroma lowered until the color fits sRGB
    for (let i = 0; i <= 60; i++, C *= 0.95) {
      const A = i === 60 ? 0 : C * Math.cos(H * Math.PI / 180), B = i === 60 ? 0 : C * Math.sin(H * Math.PI / 180)
      const [l, m, s] = [L + 0.3963377774 * A + 0.2158037573 * B, L - 0.1055613458 * A - 0.0638541728 * B, L - 0.0894841775 * A - 1.2914855480 * B].map(v => v ** 3)
      const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]
      if (i === 60 || lin.every(v => v >= -1e-4 && v <= 1 + 1e-4)) {
        return '#' + lin.map(v => Math.round(toByte(Math.min(1, Math.max(0, v)))).toString(16).padStart(2, '0')).join('').toUpperCase()
      }
    }
  }
  const windowShade = (hex, n) => {
    const step = SHADES[(((n - 1) % 10) + 10) % 10 - 1]
    if (!step) return hex   // window 1: the repo's own color, as given
    const [dl, dh, dc] = step
    const [L0, C, H] = oklch(hex)
    // Very light or dark colors step from the nearest lightness with room on both sides.
    const L = Math.min(Math.max(L0, SHADE_ANCHOR[0]), SHADE_ANCHOR[1])
    const L2 = L + dl * Math.min(SHADE_SPAN, dl > 0 ? SHADE_CEIL - L : L - SHADE_FLOOR)
    return fromOklch(Math.min(Math.max(L2, SHADE_FLOOR), SHADE_CEIL), (dh ? Math.max(C, 0.06) : C) * dc, (H + dh + 360) % 360)
  }
  // A window's ring, outline and sidebar bar take its shade; so does its background tint.
  const accent = ({ color, n }) => windowShade(color, n)
  const wash = ({ color, n }, amount, weight) =>
    blend(isDark() ? '#1F1E1D' : '#FFFFFF', windowShade(color, n), Math.min(0.6, amount * weight * (isDark() ? 1.6 : 1)))
  const readable = color => (isDark() ? blend(color, '#FFFFFF', 0.3) : color)
  const hsl = hex => {   // [hue 0-360, saturation 0-1, lightness 0-1]
    const [r, g, b] = rgb(hex).map(v => v / 255)
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
    if (!d) return [0, 0, l]
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l]
  }
  const CLAY = hsl('#D97757')   // Claude's orange, the color the loading dots are drawn in
  const dotFilter = target => {
    const [h, s, l] = hsl(target)
    const turn = Math.round((h - CLAY[0] + 360) % 360)
    const sat = Math.min(3, Math.max(0, s / CLAY[1])).toFixed(2)
    const bright = Math.min(1.8, Math.max(0.4, l / CLAY[2])).toFixed(2)
    return `hue-rotate(${turn}deg) saturate(${sat}) brightness(${bright})`
  }
  // An emoji's main color, measured the way the mod does (helpers/emoji-color.swift): draw it,
  // keep the visible, colored, not-too-dark pixels, group them into 12 hues, average the biggest.
  const emojiCache = new Map()
  const emojiColor = emoji => {
    if (!emoji) return null
    if (emojiCache.has(emoji)) return emojiCache.get(emoji)
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d', { willReadFrequently: true })
    let px = null
    try {
      g.font = '52px "Apple Color Emoji", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(emoji, 32, 35)
      px = g.getImageData(0, 0, 64, 64).data
    } catch { px = null }
    const count = new Array(12).fill(0), sums = count.map(() => [0, 0, 0])
    for (let i = 0; px && i < px.length; i += 4) {
      const [R, G, B, A] = [px[i], px[i + 1], px[i + 2], px[i + 3]]
      const max = Math.max(R, G, B), min = Math.min(R, G, B)
      if (A < 128 || max < 51 || (max - min) / max < 0.25) continue   // see-through, too dark, grey
      const k = Math.min(11, Math.floor(hsl(hex([R, G, B]))[0] / 30))
      count[k]++; sums[k][0] += R; sums[k][1] += G; sums[k][2] += B
    }
    const best = count.indexOf(Math.max(...count))
    const out = count[best] < 20 ? null : hex(sums[best].map(v => v / count[best]))
    emojiCache.set(emoji, out)
    return out
  }
  // A grey or black-and-white emoji (⚽, 🗂️) has no color of its own: one is made from the
  // emoji itself, so it is the same color every time.
  const madeColor = emoji => {
    let h = 0
    for (const ch of emoji) h = (h * 31 + ch.codePointAt(0)) >>> 0
    const hue = h % 360, s = 0.62, l = 0.48
    const f = n => { const k = (n + hue / 30) % 12; return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) }
    return hex([f(0), f(8), f(4)])
  }
  const colorOf = emoji => (emoji ? emojiColor(emoji) ?? madeColor(emoji) : null)

  // Finding things.
  const bare = text => text.replace(new RegExp(`^(?:${EMOJI}|\\s)+`, 'u'), '').trim()
  const leaves = root => [...root.querySelectorAll('span, div, p, a, button, h1, h2, h3')].filter(el => el.childElementCount === 0)
  const skip = el => !!el?.closest('.cm-editor, .prose, pre, code')   // never touch what Claude or you wrote
  const visible = el => el.getClientRects().length > 0
  const rowOf = sid => document.querySelector(`[data-row-key="code:${CSS.escape(sid)}"]`)
  // A thread's visible box: the app's rounded pill (.group). A thread nested under another has
  // none, so the label's nearest rounded box stands in, and only then the whole row.
  const pillOf = row => {
    const group = row.querySelector('.group')
    if (group) return group
    for (let el = row.querySelector('[data-row-label]')?.parentElement; el && el !== row; el = el.parentElement) {
      if (parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0) return el
    }
    return row
  }

  const titleOf = sid => rowOf(sid)?.querySelector('[data-row-label]')?.textContent.trim() ?? ''

  // Which repo each sidebar thread is under. Each repo heading is a row keyed
  // "label:project-<folder path>", in the same section box (class group/section) as that repo's
  // threads; a thread belongs to the last heading above it. A heading counts only when its name
  // is the end of its folder path, ignoring case, spaces, "-" and "_" (the app shows
  // BAM-Knowledge for a BAM_Knowledge folder), so never "No folder".
  // Colors are never learned from the sidebar: a title's emoji may be a role (💬 a side chat,
  // 🔧 a helper) or another project's, not the repo's. The live labels say each repo's look.
  const SQUARES = new Set(['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🩷'])
  const ROLES = new Set(['💬', '🔧'])
  // A thread title's own color. A color square is not a choice and a role mark is no repo's,
  // so they give none: "🟪 title" in a folder without a repo stays uncolored instead of purple.
  const titleColor = emoji => (emoji && !SQUARES.has(emoji) && !ROLES.has(emoji) ? colorOf(emoji) : null)
  const plain = text => bare(text.replace(/[\p{Co}\p{Cf}]/gu, ''))   // icon glyphs and invisible marks out
  const headingOf = row => {
    const section = row.closest('[class*="group/section"]')
    let name = null
    for (const el of section?.querySelectorAll('[data-row-key^="label:project-"]') ?? []) {
      if (!(el.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
      const text = plain(el.textContent || ''), path = el.getAttribute('data-row-key').slice(14).replace(/[\\/]+$/, '')
      const loose = value => value.toLowerCase().replace(/[\s_-]+/g, '')
      name = text && loose(path.split(/[\\/]/).pop() ?? '') === loose(text) ? text : null
    }
    return name
  }
  const headings = () => {
    const bySid = new Map()
    for (const row of document.querySelectorAll('[data-row-key^="code:"]')) {
      const name = headingOf(row)
      if (name) bySid.set(row.getAttribute('data-row-key').slice(5), name)
    }
    return bySid
  }
  let known = REPOS, repoOfSid = new Map()

  // NUMBERS: windows of one repo take numbers (1, 2, 3...), so each gets its own shade. The
  // windows agree among themselves, the way the mod does: every app window
  // shares this local storage, where each keeps its own windows' numbers. A window keeps its
  // number while open and takes the lowest free one when it opens. A number not refreshed for
  // NUMBER_MS is free again (its window closed, or its app window no longer runs this script).
  const NUMBERS = 'window-tint:numbers'
  const NUMBER_MS = 30_000
  const numbersFor = groups => {   // session id -> its repo (or color) => session id -> number
    const now = Date.now()
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(NUMBERS)) ?? {} } catch { saved = {} }
    const all = Object.fromEntries(Object.entries(saved).filter(([, each]) => now - each.seen < NUMBER_MS))
    const out = new Map()
    for (const [sid, group] of groups) {
      const taken = new Set(Object.entries(all).filter(([other, each]) => other !== sid && each.group === group).map(([, each]) => each.n))
      let n = all[sid]?.group === group ? all[sid].n : 1
      while (taken.has(n)) n++
      all[sid] = { group, n, seen: now }
      out.set(sid, n)
    }
    try { localStorage.setItem(NUMBERS, JSON.stringify(all)) } catch {}
    return out
  }
  // Painting happens only on changes, so a clock keeps this page's numbers fresh, and repaints
  // when one moved (two app windows took the same number at once: the one that sees it moves).
  let shown = new Map(), numbered = new Map()
  const NUMBER_TICK = 10_000

  // Windows: each visible .epitaxy-chat-panel and the session it shows.
  const repoBySid = new Map()   // session id -> { repo, at }: the repo name found in its window, or null
  const MISS_MS = 10_000
  let retry = null
  const findWindows = () => {
    const found = []
    for (const panel of document.querySelectorAll('.epitaxy-chat-panel')) {
      if (!visible(panel) || panel.getBoundingClientRect().width < 100) continue
      const sid = panel.querySelector('[data-session-id]')?.getAttribute('data-session-id')
      if (!sid) continue
      const m = TITLE.exec(titleOf(sid))
      const own = ownOf(panel)   // the window's own label: no sidebar needed, and no scan
      let repo = own && known[own[0]] ? own[0] : null
      if (!repo) {
        // A saved repo name shown in the window (its header chip), looked for once per session.
        // A miss is kept for MISS_MS, so a window of an unknown repo is not scanned on every
        // repaint, and a chip that shows up late is still found.
        const found = repoBySid.get(sid)
        if (!found || (found.repo === null && Date.now() - found.at > MISS_MS)) {
          const repo = leaves(panel).filter(el => !skip(el)).map(el => bare(el.textContent || '')).find(t => REPOS[t]) ?? null
          repoBySid.set(sid, { repo, at: Date.now() })
          // A chip that shows up late causes no repaint of its own, so the next look is booked.
          if (repo === null) retry ??= setTimeout(() => { retry = null; soon() }, MISS_MS + 50)
        }
        const fromSidebar = repoOfSid.get(sid)
        repo = repoBySid.get(sid).repo ?? (fromSidebar && known[fromSidebar] ? fromSidebar : null)
      }
      const color = (repo && known[repo][0]) || titleColor(m?.[1])
      if (color) found.push({ panel, color, sid, repo, group: repo ?? color })
    }
    // Always the windows' own agreement, never a label's number (see LIVE).
    shown = new Map(found.map(each => [each.sid, each.group]))
    numbered = numbersFor(shown)
    return new Map(found.map(({ panel, color, sid, repo }) => [panel, { color, n: numbered.get(sid) ?? 1, sid, repo }]))
  }
  const numberTick = () => {
    // A mod's drawing whose shadow root came after the last look: watched from now on.
    lookAtLabels()
    if (shown.size === 0) return
    const before = numbered
    numbered = numbersFor(shown)
    if ([...numbered].some(([sid, n]) => before.get(sid) !== n)) soon()
  }
  // The slot: the first box around a window that is larger than it (the app's tile frame).
  // The app leaves about 9px around a window on the left and top but only 1px on the right,
  // so the ring's right gap can be smaller. The script never changes a box's size: an earlier
  // width limit to even the gaps could go stale after a resize and keep a window narrow.
  const slotOf = panel => {
    const p = panel.getBoundingClientRect()
    const chain = [panel]
    for (let up = panel.parentElement; up && up !== document.body; up = up.parentElement) {
      if (getComputedStyle(up).display === 'contents') continue
      const r = up.getBoundingClientRect()
      if (r.width === 0) continue
      if (up.querySelectorAll('.epitaxy-chat-panel').length > 1) break
      const room = { t: p.top - r.top, l: p.left - r.left, r: r.right - p.right, b: r.bottom - p.bottom }
      if (Math.max(room.t, room.l, room.r, room.b) >= 3) return { host: up, room, chain, slot: r }
      chain.push(up)
    }
    return { host: panel, room: null, chain: [], slot: null }
  }
  // The bottom area: the full-width box around the message box (git bar, input, toolbar).
  const dockOf = panel => {
    const width = panel.getBoundingClientRect().width
    for (let el = panel.querySelector('.epitaxy-prompt'); el && el !== panel; el = el.parentElement) {
      if (el.getBoundingClientRect().width >= width - 2) return el
    }
    return null
  }
  // The app's own surface colors, read from the page root (never changed by this script).
  const base = () => {
    const root = getComputedStyle(document.documentElement)
    return ['--cds-surface-0', '--cds-surface-1', '--cds-surface-2', '--cds-surface-3'].map(v => root.getPropertyValue(v).trim())
  }
  const inputOf = panel => {
    const composer = panel.querySelector('[data-cds="ChatComposer"]')
    return composer?.querySelector('.bg-surface-3') ?? composer
  }

  // Everything this script sets is recorded, so turning it off puts the page back.
  const style = Object.assign(document.createElement('style'), { id: 'window-tint' })
  document.head.append(style)
  style.textContent = `
    [data-wt-tint], [data-wt-tint] * {
      --cds-surface-0: var(--wt-w0) !important;
      --cds-page-bg:   var(--wt-w0) !important;
      --cds-surface-1: var(--wt-w1) !important;
      --cds-surface-2: var(--wt-w2) !important;
      --cds-surface-3: var(--wt-w3) !important;
      --epitaxy-transcript-surface: var(--wt-w1) !important;
      --cds-clay: var(--wt-accent) !important;              /* Claude's orange: loading dots, its mark */
    }
    [data-wt-tint] [data-cds="WorkingMark"] { filter: var(--wt-dots) !important; }   /* drawn in a fixed orange: turned by a filter */
    [data-wt-tint] [data-cds="WorkingMark"], [data-wt-tint] [data-cds="WorkingMark"] * { --cds-clay: #D97757 !important; }   /* the filter starts from orange */
    [data-wt-tint] svg[data-cds="Spark"] { fill: var(--wt-accent) !important; }
    [data-wt-icon]::before { content: attr(data-wt-icon) "\\00a0"; }
    [data-wt-ring]::after {
      content: ""; position: absolute; pointer-events: none; z-index: 2147483000;
      top: var(--wt-t); left: var(--wt-l); right: var(--wt-r); bottom: var(--wt-b);
      border-radius: var(--wt-radius); border: var(--wt-ring-w) solid var(--wt-ring); box-shadow: 0 0 14px var(--wt-glow);
    }
    [data-wt-row] .group:hover { background-color: var(--wt-hover) !important; }
    [data-wt-row]:not(:has(.group)):hover { background-color: var(--wt-hover) !important; }   /* a nested thread: the row is its box */
    [data-wt-open] .group, [data-wt-open] [data-wt-pill], [data-wt-open][data-wt-pill] { background-color: transparent !important; }
    [data-wt-open] .group:hover, [data-wt-open] [data-wt-pill]:hover, [data-wt-open][data-wt-pill]:hover { background-color: var(--wt-hover) !important; }
    [data-wt-band] :has(> [data-engine-site="AbovePrompt"]) { display: none !important; }`
  const MARKS = ['data-wt-tint', 'data-wt-icon', 'data-wt-row', 'data-wt-open', 'data-wt-ring', 'data-wt-band', 'data-wt-pill']
  const RING_PROPS = ['position', '--wt-t', '--wt-l', '--wt-r', '--wt-b', '--wt-radius', '--wt-ring-w', '--wt-ring', '--wt-glow']
  const touched = new Map()   // element -> CSS properties set inline
  const set = (el, prop, value) => {
    el.style.setProperty(prop, value, 'important')
    if (!touched.has(el)) touched.set(el, new Set())
    touched.get(el).add(prop)
  }
  const unset = (el, prop) => { el.style.removeProperty(prop); touched.get(el)?.delete(prop) }
  const clear = el => {
    for (const prop of touched.get(el) ?? []) el.style.removeProperty(prop)
    for (const mark of MARKS) el.removeAttribute(mark)
    touched.delete(el)
  }
  const tint = (el, info, weight) => {
    set(el, '--wt-w0', wash(info, 0.18, weight))
    set(el, '--wt-w1', wash(info, 0.14, weight))
    set(el, '--wt-w2', wash(info, 0.10, weight))
    set(el, '--wt-w3', wash(info, 0.24, weight))
  }
  let focus = null, rows = 0, paints = 0, lastWindows = []
  let pills = new Set()   // the thread boxes given a fill or bar by the last paint
  // FOCUS: the window you are in is your last choice. A click or the keyboard inside a window
  // chooses it; a click on a sidebar thread (one click or two) chooses the window that shows
  // that thread, once the app shows it. The keyboard focus alone missed both: a click on a
  // thread or on a window's conversation leaves it where it was, so an old window kept the
  // filled highlight. The session is kept too, so a window the app draws again still counts.
  // Focus coming back to the same box (the app window becomes active again) is no new choice,
  // and neither is a right click or the thread's own buttons (its ... menu).
  let chosen = null, lastFocus = null   // chosen: { panel, sid } or { sid }
  const choose = event => {
    const el = event.target instanceof Element ? event.target : null
    if (event.type === 'focusin') {
      if (el === lastFocus) return
      lastFocus = el
    } else if (event.button !== 0) return
    const panel = el?.closest('.epitaxy-chat-panel')
    const row = !panel && event.type === 'pointerdown' ? el?.closest('[data-row-key^="code:"]') : null
    const control = row && el.closest('button, [aria-haspopup]')
    const before = chosen
    if (panel) chosen = { panel, sid: panel.querySelector('[data-session-id]')?.getAttribute('data-session-id') }
    else if (row && !(control && row.contains(control) && !control.contains(row.querySelector('[data-row-label]')))) {
      chosen = { sid: row.getAttribute('data-row-key').slice(5) }
    }
    if (chosen?.panel !== before?.panel || chosen?.sid !== before?.sid) soon()
  }

  const paint = () => {
    paints++
    // A fresh reading when it says what was confirmed (its boxes are the ones on the page now),
    // else the confirmed one: the app may be between two boxes this very moment.
    const reading = readLabels()
    const said = !reading.isBetween && reading.text === confirmed.text ? (confirmed = reading) : confirmed
    known = { ...REPOS, ...said.repos }
    repoOfSid = headings()
    const windows = findWindows()
    const open = [...windows.keys()]
    // Your choice (see FOCUS), else the window chosen before while it is open, else the one
    // holding the keyboard (at the start, or once the chosen window closed), else the first.
    // Chosen but without a tint (no session or no color yet): no window is the focused one.
    const picked = chosen?.panel && windows.has(chosen.panel) ? chosen.panel
      : chosen?.sid ? open.find(p => windows.get(p).sid === chosen.sid) : undefined
    const isUntinted = !picked && !!chosen?.panel?.isConnected && visible(chosen.panel) && !windows.has(chosen.panel)
    const active = () => document.activeElement ? open.find(p => p.contains(document.activeElement)) : undefined
    focus = isUntinted ? null : picked ?? (windows.has(focus) ? focus : active() ?? open[0] ?? null)
    lastWindows = [...windows].map(([panel, { sid, repo, color, n }]) => ({ sid, repo, color, n, shade: windowShade(color, n), isFocused: panel === focus }))
    const seen = new Set()
    // This paint's ring hosts. After a resize or a window opening or closing, a window's slot
    // can be a different box: the old one must lose its ring even when it is still in use for
    // something else (else rings double up).
    const rings = new Set()
    // Layout first, then the writes: a read between writes makes the page lay itself out again.
    const layout = new Map()
    for (const panel of windows.keys()) {
      const slot = slotOf(panel)
      layout.set(panel, { ...slot, isStatic: getComputedStyle(slot.host).position === 'static', dock: dockOf(panel), input: inputOf(panel) })
    }
    const [s0, s1, s2, s3] = base()

    for (const [panel, info] of windows) {
      const { host, room, isStatic, dock, input } = layout.get(panel)
      sizes?.observe(panel)
      const isFocused = panel === focus
      const weight = isFocused ? FOCUSED : OTHER
      panel.setAttribute('data-wt-tint', '')
      tint(panel, info, weight)
      // Loading dots and Claude's mark: the repo's full color (no number shade), so they stand out.
      const dot = isDark() ? blend(info.color, '#FFFFFF', 0.15) : info.color
      set(panel, '--wt-accent', dot)
      // The loading dots ignore CSS colors (their orange is part of how they are drawn), so a
      // filter turns Claude's orange into this color: hue, then saturation and brightness.
      set(panel, '--wt-dots', dotFilter(dot))
      seen.add(panel)

      // The ring: a top layer (::after) on the slot, GAP px outside the window's edge.
      host.setAttribute('data-wt-ring', '')
      if (isStatic) set(host, 'position', 'relative')
      sizes?.observe(host)
      if (room) {
        for (const side of ['t', 'l', 'r', 'b']) set(host, `--wt-${side}`, `${Math.max(0, Math.round(room[side] - Math.min(GAP, room[side])))}px`)
        set(host, '--wt-radius', '16px')
      } else {
        for (const side of ['t', 'l', 'r', 'b']) set(host, `--wt-${side}`, '0px')
        set(host, '--wt-radius', '12px')
      }
      set(host, '--wt-ring-w', isFocused ? '2.5px' : '1px')
      set(host, '--wt-ring', isFocused ? accent(info) : wash(info, 0.45, 1))
      set(host, '--wt-glow', isFocused ? `${accent(info)}40` : 'transparent')
      rings.add(host)
      seen.add(host)

      // Bottom area: the app's colors; the text input inside it keeps the window's tint.
      if (dock) {
        set(dock, '--wt-w0', s0); set(dock, '--wt-w1', s1); set(dock, '--wt-w2', s2); set(dock, '--wt-w3', s3)
        set(dock, 'background-color', s1)
        seen.add(dock)
      }
      if (input) {
        tint(input, info, weight)
        set(input, 'outline', isFocused ? `1.5px solid ${accent(info)}` : 'none')
        set(input, 'box-shadow', isFocused ? `0 0 0 4px ${accent(info)}26` : 'none')
        seen.add(input)
      }
    }

    // Repo names everywhere: colored text, the repo's emoji in front when it has none.
    const labels = []
    for (const el of leaves(document.body)) {
      if (skip(el)) continue
      const repo = known[plain(el.textContent || '')]
      if (!repo) continue
      set(el, 'color', readable(repo[0]))
      set(el, 'font-weight', '700')
      const hasIcon = LEAD.test((el.textContent || '').trim()) || LEAD.test((el.parentElement?.textContent || '').trim())
      if (!hasIcon) el.setAttribute('data-wt-icon', repo[1])
      seen.add(el)
      labels.push(el)
    }

    // Sidebar threads: hover in the repo's color (its heading, else the title emoji).
    for (const row of document.querySelectorAll('[data-row-key^="code:"]')) {
      const label = row.querySelector('[data-row-label]')
      if (!label) continue
      const title = label.textContent.trim()
      let group = row.parentElement, heading = null
      for (let i = 0; group && i < 6; i++, group = group.parentElement) {
        const inside = labels.filter(l => group.contains(l) && !row.contains(l))
        if (inside.length === 1) { heading = inside[0]; break }
        if (inside.length > 1) break
      }
      const hoverColor = (heading && known[plain(heading.textContent || '')]?.[0]) ?? titleColor(TITLE.exec(title)?.[1])
      if (hoverColor) {
        row.setAttribute('data-wt-row', '')
        set(row, '--wt-hover', wash({ color: hoverColor, n: 1 }, 0.16, 1))
        seen.add(row)
      }
    }

    // Open threads: their color instead of the app's grey; the focused one clearly.
    rows = 0
    document.querySelectorAll('[data-wt-open]').forEach(row => row.removeAttribute('data-wt-open'))
    // Last paint's fills and bars come off first. A nested thread has no pill of its own, so its
    // box is the row, which the hover color above keeps in use: the clean-up at the end never
    // cleared it, and a thread left in a window kept its fill.
    for (const pill of pills) {
      unset(pill, 'background-color')
      unset(pill, 'box-shadow')
      pill.removeAttribute('data-wt-pill')
    }
    pills = new Set()
    // The focused window last: when two windows show one thread, its row stays filled.
    for (const [panel, info] of [...windows].sort(([a], [b]) => (a === focus) - (b === focus))) {
      const row = rowOf(info.sid)
      if (!row) continue
      rows++
      const pill = pillOf(row)
      pill.setAttribute('data-wt-pill', '')
      pills.add(pill)
      const isFocused = panel === focus
      if (isFocused) {
        set(pill, 'background-color', wash(info, 0.3, 1))
        row.removeAttribute('data-wt-open')
      } else {
        row.setAttribute('data-wt-open', '')
        seen.add(row)
      }
      set(pill, 'box-shadow', `inset ${isFocused ? 4 : 2}px 0 0 ${accent(info)}`)
      seen.add(pill)
    }

    // A band that only offers to save colors already shown here: hidden (see BANDS).
    const quiet = said.quiet
    for (const el of document.querySelectorAll('[data-wt-band]')) if (!quiet.has(el)) el.removeAttribute('data-wt-band')
    for (const owner of quiet) {
      if (owner.matches('.epitaxy-chat-panel')) owner.setAttribute('data-wt-band', '')
      else set(owner, 'display', 'none')
      seen.add(owner)
    }
    watchRoots()

    // Rings left from an earlier layout go, even on boxes still in use.
    for (const el of document.querySelectorAll('[data-wt-ring]')) {
      if (rings.has(el)) continue
      el.removeAttribute('data-wt-ring')
      for (const prop of RING_PROPS) if (touched.get(el)?.has(prop)) unset(el, prop)   // only what this script set
    }
    for (const el of [...touched.keys()]) if (!seen.has(el)) clear(el)
    painted = confirmed.text   // only after a whole paint: a failed one is tried again on the next look
  }

  // Redraw at most every 0.4 s while the app changes, and when focus or size changes. A failed
  // repaint is reported and the next change tries again, so one bad paint never leaves it stuck.
  let timer = null
  const safePaint = () => { try { paint() } catch (error) { console.warn('window-tint: repaint failed', error) } }
  const soon = () => { if (!timer && !isOff) timer = setTimeout(() => { timer = null; safePaint() }, 400) }
  // Only changes a repaint can use: windows, sessions, sidebar rows and live labels coming or
  // going, and anything outside the windows (the sidebar). Inside a window the conversation
  // (Claude's streamed text, tool output, what you type) changes many times a second and is
  // never painted, so it is ignored.
  const KEY = `.epitaxy-chat-panel, [data-session-id], .epitaxy-prompt, [data-cds="ChatComposer"], [data-row-key], ${LIVE_SEL}`
  const QUIET = '.cm-editor, [contenteditable="true"], .xterm'
  const counts = node => node.nodeType === 1 && (node.matches(KEY) || !!node.querySelector(KEY))
  const isLive = value => (value ?? '').startsWith(LIVE)
  // The mods' drawings: Claude desktop 2.42304 replaces their boxes ([data-plugin-drawn]) about
  // 48 times a second and redraws inside their shadow roots (the band's glow), so neither ever
  // repaints by itself. They only ask for a look at the live labels (at most every LABEL_MS). A
  // new reading is confirmed when the same text is seen on CHANGE_LOOKS looks in a row, or on
  // LOSS_LOOKS when labels only went away (a box the app fills a moment after adding it is not a
  // label gone); only a confirmed change repaints.
  const LABEL_MS = 250, LABEL_JITTER_MS = 40, CHANGE_LOOKS = 2, LOSS_LOOKS = 4
  let confirmed = readLabels(), painted = null, labelTimer = null, pending = null, looks = 0, isOff = false
  const lookAtLabels = () => {
    clearTimeout(labelTimer)
    labelTimer = null
    if (isOff) return
    watchRoots()
    const now = readLabels()
    if (now.isBetween) return labelsSoon()   // the app is between two boxes: look again
    if (now.text === confirmed.text) {
      pending = null
      if (painted !== confirmed.text) soon()   // the last paint failed: again
      return
    }
    looks = pending === now.text ? looks + 1 : 1
    pending = now.text
    const had = new Set(confirmed.text.split('\n'))
    const isLoss = now.text === '' || now.text.split('\n').every(line => had.has(line))
    if (looks < (isLoss ? LOSS_LOOKS : CHANGE_LOOKS)) return labelsSoon()
    confirmed = now
    pending = null
    soon()
  }
  // A little jitter, so looks never fall in step with boxes the app replaces at a steady rate.
  const labelsSoon = () => { if (!labelTimer && !isOff) labelTimer = setTimeout(lookAtLabels, LABEL_MS + Math.random() * LABEL_JITTER_MS) }
  const drawn = node => node.nodeType === 1 && (node.matches(HOSTS) || !!node.querySelector(HOSTS))
  const LABELS = 'labels'   // matters(): look at the labels, no repaint yet
  const matters = record => {
    const root = record.target.getRootNode?.()
    if (root instanceof ShadowRoot) return LABELS
    if (record.type === 'childList') {
      const nodes = [...record.addedNodes, ...record.removedNodes].filter(node => node.nodeType === 1)
      if (nodes.length > 0 && nodes.every(node => drawn(node) && !counts(node))) return LABELS
    }
    if (record.type === 'attributes') {
      if (record.attributeName === 'alt' || record.attributeName === 'aria-label') {
        return isLive(record.target.getAttribute(record.attributeName)) || isLive(record.oldValue)
      }
      return true   // data-session-id, data-row-key
    }
    const el = record.target.nodeType === 1 ? record.target : record.target.parentElement
    if (!el || el.closest(QUIET)) return false
    if (!el.closest('.epitaxy-chat-panel')) return true
    return record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(counts)
  }
  const observer = new MutationObserver(records => {
    let isDrawing = false
    for (const record of records) {
      const verdict = matters(record)
      if (verdict === true) { labelsSoon(); return soon() }   // a label in the page itself may have changed too
      if (verdict === LABELS) isDrawing = true
    }
    if (isDrawing) labelsSoon()
  })
  // The mods' shadow roots are not part of the page's tree, so each is watched on its own once
  // it is there (looked for on each repaint, each look at the labels and the number clock).
  const WATCH = { childList: true, subtree: true, attributes: true, attributeFilter: ['alt', 'aria-label'] }
  const watched = new WeakSet()
  const watchRoots = () => {
    let added = false
    if (isOff) return added
    for (const host of document.querySelectorAll(HOSTS)) {
      const root = host.shadowRoot
      if (!root || watched.has(root)) continue
      watched.add(root)
      observer.observe(root, WATCH)
      added = true
    }
    return added
  }
  // Size changes without any page change (a side panel closed, a splitter dragged) redraw too.
  const sizes = 'ResizeObserver' in window ? new ResizeObserver(soon) : null
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeOldValue: true, attributeFilter: ['alt', 'aria-label', 'data-session-id', 'data-row-key'],
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
  // Capture phase: the app cannot stop a click from reaching these.
  document.addEventListener('focusin', choose, true)
  document.addEventListener('pointerdown', choose, true)
  window.addEventListener('resize', soon)
  const numberClock = setInterval(numberTick, NUMBER_TICK)

  // Set before the first paint, so even a failed one can be turned off by the next Run.
  window.__windowTint = {
    off() {
      isOff = true
      observer.disconnect()
      sizes?.disconnect()
      document.removeEventListener('focusin', choose, true)
      document.removeEventListener('pointerdown', choose, true)
      window.removeEventListener('resize', soon)
      clearTimeout(timer)
      clearTimeout(labelTimer)
      clearTimeout(retry)
      clearInterval(numberClock)
      style.remove()
      for (const el of [...touched.keys()]) clear(el)
      delete window.__windowTint
    },
    get paints() { return paints },   // repaints since this run, for checking it stays quiet
    shade: windowShade,               // a window's shade (hex, number), for checks
    get windows() { return lastWindows },   // each window at the last paint: repo, number, shade, focus
  }
  safePaint()
  const tinted = [...touched.keys()].filter(el => el.hasAttribute('data-wt-tint')).length
  return `window-tint on · ${tinted} window(s) · ${rows} open thread(s)`
})()
