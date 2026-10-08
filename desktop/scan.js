// window-tint desktop scan: a look-only report of the Claude desktop app's layout, for when
// an app update breaks desktop/tint.js. It changes nothing on the page.
//
// How to use: type /mod_tint css scan in Claude Code (it copies this script), open the
// desktop app's DevTools with ⌥⌘I, choose Console, paste, press Enter. The report is copied
// to your clipboard. Compare it with the selectors at the top of desktop/tint.js.
(() => {
  const EMOJI = '\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*'
  const TITLE = new RegExp(`^(${EMOJI})?(?:([0-9])\\uFE0F?\\u20E3|([1-9][0-9]))\\s`, 'u')
  const COMPOSER = '[contenteditable="true"], textarea'
  const visible = el => el.getClientRects().length > 0
  const short = el => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 5).join('.') : ''
    const attrs = [...el.attributes].filter(a => /^(data-|role)/.test(a.name)).map(a => `[${a.name}]`).slice(0, 4).join('')
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${attrs}`.slice(0, 110)
  }
  const box = el => { const r = el.getBoundingClientRect(); return `${Math.round(r.left)}..${Math.round(r.right)} x ${Math.round(r.top)}..${Math.round(r.bottom)}` }
  const titleNodes = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (TITLE.test(n.data.trim()) && n.parentElement && visible(n.parentElement)) titleNodes.push(n)

  // 1. The page: color system and theme.
  const page = [...document.documentElement.attributes].filter(a => /^data-(mode|theme|color-version)/.test(a.name)).map(a => `${a.name}=${a.value}`)
  const surfaces = ['--cds-surface-0', '--cds-surface-1', '--cds-surface-2', '--cds-surface-3', '--cds-page-bg']
    .map(v => `${v}: ${getComputedStyle(document.documentElement).getPropertyValue(v).trim()}`)

  // 2. Each visible message box and every box above it, with any title inside.
  const messageBoxes = [...document.querySelectorAll(COMPOSER)].filter(visible).map(c => {
    const chain = []
    for (let el = c, i = 0; el && el !== document.documentElement && i < 24; el = el.parentElement, i++) {
      const cs = getComputedStyle(el)
      const t = titleNodes.find(n => el.contains(n))
      chain.push({
        el: short(el), at: box(el), display: cs.display, position: cs.position, width: cs.width, maxWidth: cs.maxWidth,
        messageBoxes: [...el.querySelectorAll(COMPOSER)].filter(visible).length,
        title: t ? t.data.trim().slice(0, 30) : null,
      })
    }
    return chain
  })

  // 3. Sidebar rows that look like thread titles, and the boxes above them.
  const rows = titleNodes.filter(n => n.parentElement.getBoundingClientRect().left < 300).slice(0, 8).map(n => {
    const chain = []
    for (let el = n.parentElement, i = 0; el && i < 8; el = el.parentElement, i++) chain.push(`${short(el)} @ ${box(el)}`)
    return { text: n.data.trim().slice(0, 40), chain }
  })

  // 4. What paints highlighted rows on the left.
  const highlights = [...document.querySelectorAll('body *')].filter(el => {
    if (!visible(el)) return false
    const r = el.getBoundingClientRect(), bg = getComputedStyle(el).backgroundColor
    return r.left < 300 && r.height > 20 && r.height < 50 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
  }).slice(0, 12).map(el => ({ el: short(el), at: box(el), bg: getComputedStyle(el).backgroundColor, text: (el.textContent || '').trim().slice(0, 30) }))

  const report = { app: navigator.userAgent.match(/Claude\/[\d.]+/)?.[0] ?? null, viewport: `${innerWidth}x${innerHeight}`, page, surfaces, messageBoxes, rows, highlights }
  copy(JSON.stringify(report, null, 1))
  return `scan copied (${messageBoxes.length} message box(es), ${titleNodes.length} title(s)): paste it where you need it`
})()
