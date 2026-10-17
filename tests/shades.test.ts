import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const
const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`

// What desktop/tint.js's windowShade gives for windows 1 to 11 (worked out by running it):
// the terminal strip must show the same shades, so the two tables stay in step.
const GOLDEN: Record<string, string[]> = {
  '#883C24': ['#883C24', '#FBB7C8', '#69293D', '#A18561', '#AA395B', '#91600B', '#643401', '#FD955F', '#8F204A', '#704905', '#883C24'],
  '#CB93CF': ['#CB93CF', '#D6D1FF', '#42396E', '#DFB0BD', '#B4A0FF', '#F98AB0', '#721553', '#FFB0F0', '#9585E7', '#D46C90', '#CB93CF'],
  '#7F642C': ['#7F642C', '#F9CDB6', '#60361F', '#979E7F', '#AC6437', '#768532', '#494406', '#D8BE6D', '#924B22', '#5B6813', '#7F642C'],
  '#93D678': ['#93D678', '#E5DB88', '#554D04', '#95DCC5', '#D5C903', '#1BE5BA', '#065B38', '#76F385', '#BDAD1A', '#1AC29D', '#93D678'],
  '#62B7D5': ['#62B7D5', '#A3E7E0', '#044D49', '#ABC0E0', '#23CAC5', '#83B4FD', '#04466F', '#92D9FF', '#18ACA4', '#6394DC', '#62B7D5'],
  // Darker than the anchor band: its shades step from lightness 0.45, so none of them collide.
  '#1E3A8A': ['#1E3A8A', '#88D8FF', '#054962', '#917FB1', '#03709A', '#7E47C2', '#431F9D', '#9CACFE', '#045A78', '#642CA2', '#1E3A8A'],
}

for (const [base, shades] of Object.entries(GOLDEN)) {
  test(`window shades for ${base}: 1 is the repo's own color, 2 to 10 differ, the 11th wraps`, async ($, on) => {
    mock.clock(on, { now: 1_000_000 })
    mock.env(on, { HOME })
    const files = new Map<string, string>()
    let sid = 'me'
    on('session.id', () => ({ value: sid }))
    on('session.cwd', () => ({ value: '/work/story' }))
    on('session.repo', () => ({ value: { root: '/work/story', remote: null, internal: false, name: null } }))
    on('fs.read', ($, e) => {
      const text = files.get(e.path)
      return text === undefined ? { deny: 'ENOENT' } : { value: text }
    })
    on('fs.write', ($, e) => {
      files.set(e.path, e.text)
      return { value: undefined }
    })
    on('fs.list', ($, e) => ({
      value: [...files.keys()]
        .filter(p => p.startsWith(`${e.path}/`))
        .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
    }))
    on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
    on('ui.status', () => ({ value: undefined }))
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('model.complete', () => ({ deny: 'offline' }))
    on('process.run', () => ({ deny: 'not here' }))

    for (let n = 1; n <= 11; n++) {
      // n - 1 other open windows of the repo, so this one takes number n.
      files.clear()
      files.set(`${DIR}/repos.json`, JSON.stringify({ story: { icon: '🏰', color: base } }))
      for (let k = 1; k < n; k++) files.set(`${DIR}/windows/w${k}.json`, JSON.stringify({ repo: 'story', n: k, seen: 999_000, since: 1 }))
      sid = `me-${n}`
      await $.session.start({ cwd: '/work/story', surface: 'terminal', isInteractive: false })
      expect(JSON.parse(files.get(`${DIR}/windows/${sid}.json`)!).n).toBe(n)
      const strip = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
      const box = await strip.find({ type: 'Box', props: { backgroundColor: shades[n - 1] } } as never)
      expect(box === undefined ? `window ${n}: no strip in ${shades[n - 1]}` : 'ok').toBe('ok')
      await strip.unmount()
    }
    // Ten different shades.
    expect(new Set(shades.slice(0, 10)).size).toBe(10)
  })
}

// Farthest first: the first windows of a repo get the most different shades. These five saved
// repo colors are the worst cases over all 16 (2026-10-17); before the reorder the smallest
// difference among the first 2, 3, 4 and 5 windows was 9.8, 8.8, 6.9 and 6.9 (OKLab ΔE×100).
const toLinear = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
function oklab(hex: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16)))
  const [l = 0, m = 0, s = 0] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}
const dE = (x: string, y: string) => { const p = oklab(x), q = oklab(y); return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }

test('the first 2, 3, 4 and 5 windows of a repo get the most different shades (farthest first)', () => {
  const saved = ['#883C24', '#CB93CF', '#7F642C', '#93D678', '#62B7D5']
  const worst = (k: number) => Math.min(...saved.map(color => {
    const list = GOLDEN[color]!
    let least = Infinity
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) least = Math.min(least, dE(list[i]!, list[j]!))
    return least
  }))
  expect(worst(2)).toBeGreaterThan(10.9)
  expect(worst(3)).toBeGreaterThan(9.7)
  expect(worst(4)).toBeGreaterThan(8.7)
  expect(worst(5)).toBeGreaterThan(7.0)
})
