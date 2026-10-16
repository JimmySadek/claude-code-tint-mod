// window-tint for the Claude desktop app: colors the windows you work in.
//
// How to use: type /mod_tint css in Claude Code (it copies this script), open the desktop app's
// DevTools with ⌥⌘I, choose Console, paste, press Enter. Better: save it once as a DevTools
// snippet (Sources → Snippets) and after each app start run it there: right-click it, Run.
// Running it again is safe: it repaints from scratch, so the colors stay on. Reloading the app removes it.
//
// What it does (display only; it sends nothing and changes no file; it keeps only its open
// windows' numbers in the app's local storage, see NUMBERS):
//   - the window you are typing in: a ring just outside its edge with a soft glow, a tint of
//     its color on the conversation, and a colored text input;
//   - other open windows: a lighter tint and a thin ring in their own color;
//   - the bottom area of each window (git bar, toolbar) keeps the app's own colors;
//   - sidebar: stays neutral; repo names are colored, with the repo's emoji in front;
//     thread titles stay as they are (their emoji says what each session is);
//     the thread of the focused window gets its color instead of the app's grey, other open
//     threads a thin bar, and hovering a thread tints it in its repo's color;
//   - the loading dots and Claude's mark in each window take that window's color;
//   - windows of one repo get shades by their number (1️⃣ base, 2️⃣ deeper, 3️⃣ paler, ...);
//   - light and dark mode.
//
// A window's color: the live label tint draws in each window's footer (see LIVE), else REPOS
// (filled from ~/.claude/window-tint/repos.json when the snippet was saved), else the emoji its
// thread's title starts with, measured by drawing it on a canvas. So a new repo needs no new copy
// of this script, and a saved DevTools snippet keeps working.
//
// Built against Claude desktop 2.26454 (October 2026), measured with desktop/scan.js:
//   window = .epitaxy-chat-panel, its session = [data-session-id] inside it;
//   sidebar row = [data-row-key="code:<session id>"], its highlight = the row's .group box;
//   message box = [data-cds="ChatComposer"], its text input = .bg-surface-3;
//   loading dots = [data-cds="WorkingMark"] (drawn in a fixed orange: recolored by a CSS filter),
//   Claude's mark = svg[data-cds="Spark"] (fill);
//   colors = the app's --cds-surface-* variables.
// If an app update breaks it, run desktop/scan.js and compare.
(() => {
  // Already on (an earlier run in this page): start over, so a second Run never leaves it off.
  if (window.__windowTint) window.__windowTint.off()

  const REPOS = /*REPOS*/{}/*REPOS*/   // name as the app shows it (repo or folder) -> [color, emoji]
  // Live labels: tint draws a 1-pixel picture in each window's footer, labelled
  // 'tint-colors {"repos": {name: [color, emoji]}, "window": [repo, number]}': every repo's
  // chosen look, so a color chosen after this script was saved shows on the next repaint, and
  // the window's own repo and number, so a window is known even with the sidebar hidden.
  // (tint 1.7.0 labels held the repos map alone.) Claude desktop 2.42304 draws no mod picture in
  // the footer, so there the labels are missing and REPOS and NUMBERS stand in.
  const LIVE = 'tint-colors '
  const LIVE_SEL = `[alt^="${LIVE}"], [aria-label^="${LIVE}"]`
  const labelOf = el => {
    try { return JSON.parse((el.getAttribute('alt') || el.getAttribute('aria-label')).slice(LIVE.length)) } catch { return null }
  }
  const live = () => {
    const out = {}
    for (const el of document.querySelectorAll(LIVE_SEL)) {
      const label = labelOf(el)
      Object.assign(out, label?.repos ?? label ?? {})
    }
    return out
  }
  const ownOf = panel => {
    const label = labelOf(panel.querySelector(LIVE_SEL) ?? document.createElement('i'))
    return Array.isArray(label?.window) ? label.window : null
  }
  const EMOJI = '\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*'
  const LEAD = new RegExp(`^${EMOJI}`, 'u')                                               // a leading emoji
  // A title's mark: "🧪 BAM · Topic", or the form before tint 1.9.0 with a number, "🧪3️⃣ Topic"
  // (that number was frozen when the window started, so it is never read as the window's).
  const TITLE = new RegExp(`^(${EMOJI})(?:([0-9])\\uFE0F?\\u20E3|([1-9][0-9]))?\\s`, 'u')
  const SHADES = [0, -0.42, 0.5, -0.62, 0.68]   // accent per window number, as window-tint's footer
  const DEPTH = [1, 1.8, 0.55, 2.4, 0.4]        // background depth per window number
  const FOCUSED = 1, OTHER = 0.55               // how much tint a window gets
  const GAP = 8                                 // px between a window's edge and its ring
  const at = (list, n) => list[(((n - 1) % list.length) + list.length) % list.length]

  // Colors.
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  const blend = (a, b, t) => { const B = rgb(b); return hex(rgb(a).map((v, i) => v + (B[i] - v) * t)) }   // t: 0 = a, 1 = b
  const isDark = () => document.documentElement.getAttribute('data-mode') === 'dark'
  const accent = ({ color, n }) => { const s = at(SHADES, n); return hex(rgb(color).map(v => (s < 0 ? v * (1 + s) : v + (255 - v) * s))) }
  const wash = ({ color, n }, amount, weight) =>
    blend(isDark() ? '#1F1E1D' : '#FFFFFF', color, Math.min(0.6, amount * at(DEPTH, n) * weight * (isDark() ? 1.6 : 1)))
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
  const pillOf = row => row.querySelector('.group') ?? row

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

  // NUMBERS: windows of one repo take numbers (1, 2, 3...), so each gets its own shade. Without
  // the mod's labels the windows agree among themselves, the way the mod does: every app window
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
      if (color) found.push({ panel, color, sid, group: repo ?? color, own: Number(own?.[1]) || null })
    }
    // The mod's number where its label is drawn, else the windows' own agreement.
    shown = new Map(found.filter(each => !each.own).map(each => [each.sid, each.group]))
    numbered = numbersFor(shown)
    return new Map(found.map(({ panel, color, sid, own }) => [panel, { color, n: own ?? numbered.get(sid) ?? 1, sid }]))
  }
  const numberTick = () => {
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
    [data-wt-open] .group { background-color: transparent !important; }
    [data-wt-open] .group:hover { background-color: var(--wt-hover) !important; }`
  const MARKS = ['data-wt-tint', 'data-wt-icon', 'data-wt-row', 'data-wt-open', 'data-wt-ring']
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
  let focus = null, rows = 0

  const paint = () => {
    known = { ...REPOS, ...live() }
    repoOfSid = headings()
    const windows = findWindows()
    const active = document.activeElement && [...windows.keys()].find(p => p.contains(document.activeElement))
    if (active) focus = active
    if (!windows.has(focus)) focus = [...windows.keys()][0] ?? null
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
    for (const [panel, info] of windows) {
      const row = rowOf(info.sid)
      if (!row) continue
      rows++
      const pill = pillOf(row)
      const isFocused = panel === focus
      if (isFocused) set(pill, 'background-color', wash(info, 0.3, 1))
      else {
        unset(pill, 'background-color')
        row.setAttribute('data-wt-open', '')
        seen.add(row)
      }
      set(pill, 'box-shadow', `inset ${isFocused ? 4 : 2}px 0 0 ${accent(info)}`)
      seen.add(pill)
    }

    // Rings left from an earlier layout go, even on boxes still in use.
    for (const el of document.querySelectorAll('[data-wt-ring]')) {
      if (rings.has(el)) continue
      el.removeAttribute('data-wt-ring')
      for (const prop of RING_PROPS) if (touched.get(el)?.has(prop)) unset(el, prop)   // only what this script set
    }
    for (const el of [...touched.keys()]) if (!seen.has(el)) clear(el)
  }

  // Redraw at most every 0.4 s while the app changes, and when focus or size changes. A failed
  // repaint is reported and the next change tries again, so one bad paint never leaves it stuck.
  let timer = null
  const safePaint = () => { try { paint() } catch (error) { console.warn('window-tint: repaint failed', error) } }
  const soon = () => { if (!timer) timer = setTimeout(() => { timer = null; safePaint() }, 400) }
  // Only changes a repaint can use: windows, sessions, sidebar rows and live labels coming or
  // going, and anything outside the windows (the sidebar). Inside a window the conversation
  // (Claude's streamed text, tool output, what you type) changes many times a second and is
  // never painted, so it is ignored.
  const KEY = `.epitaxy-chat-panel, [data-session-id], .epitaxy-prompt, [data-cds="ChatComposer"], [data-row-key], ${LIVE_SEL}`
  const QUIET = '.cm-editor, [contenteditable="true"], .xterm'
  const counts = node => node.nodeType === 1 && (node.matches(KEY) || !!node.querySelector(KEY))
  const isLive = value => (value ?? '').startsWith(LIVE)
  const matters = record => {
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
  const observer = new MutationObserver(records => { if (records.some(matters)) soon() })
  // Size changes without any page change (a side panel closed, a splitter dragged) redraw too.
  const sizes = 'ResizeObserver' in window ? new ResizeObserver(soon) : null
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeOldValue: true, attributeFilter: ['alt', 'aria-label', 'data-session-id', 'data-row-key'],
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })
  document.addEventListener('focusin', soon)
  document.addEventListener('mousedown', soon)
  window.addEventListener('resize', soon)
  const numberClock = setInterval(numberTick, NUMBER_TICK)

  // Set before the first paint, so even a failed one can be turned off by the next Run.
  window.__windowTint = {
    off() {
      observer.disconnect()
      sizes?.disconnect()
      document.removeEventListener('focusin', soon)
      document.removeEventListener('mousedown', soon)
      window.removeEventListener('resize', soon)
      clearTimeout(timer)
      clearTimeout(retry)
      clearInterval(numberClock)
      style.remove()
      for (const el of [...touched.keys()]) clear(el)
      delete window.__windowTint
    },
  }
  safePaint()
  const tinted = [...touched.keys()].filter(el => el.hasAttribute('data-wt-tint')).length
  return `window-tint on · ${tinted} window(s) · ${rows} open thread(s)`
})()
