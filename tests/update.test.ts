import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const
const START = { cwd: '/work/lab-notes', surface: 'terminal', isInteractive: false } as const

function world(on: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1], files: Map<string, string>, latest: string, surface: 'terminal' | 'desktop' = 'terminal') {
  const out = { fetches: 0, commands: [] as string[], runs: [] as string[][], failClaude: false, copied: undefined as string | undefined, toasts: [] as string[], clock: undefined as unknown as ReturnType<typeof mock.clock> }
  out.clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME })
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/lab-notes' }))
  on('session.repo', () => ({ value: { root: '/work/lab-notes', remote: null, internal: false, name: null } }))
  on('session.surfaces', () => ({ value: [surface] as never }))
  on('fs.read', ($, e) => {
    if (e.path.endsWith('/desktop/tint.js')) return { value: 'const REPOS = /*REPOS*/{}/*REPOS*/ // tint' }
    if (e.path.endsWith('/.claude-plugin/plugin.json')) return { value: JSON.stringify({ version: '1.4.0' }) }
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [] }))
  on('http.fetch', () => {
    out.fetches++
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ tag_name: `v${latest}` }) } } as never
  })
  on('model.complete', () => ({ deny: 'offline' }))
  on('process.run', ($, e) => {
    out.runs.push([...e.argv])
    const stdout = e.argv[0] === 'ps' ? 'Fri Oct  9 03:36:30 2026     /Applications/Claude.app/Contents/MacOS/Claude\n' : ''
    return { value: { exitCode: out.failClaude && e.argv[0] === 'claude' ? 1 : 0, stdout, stderr: '' } } as never
  })
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    out.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', ($, e) => {
    out.copied = e.text
    return { value: { isCopied: true } } as never
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.run', ($, e) => {
    out.commands.push(e.command)
    return { value: undefined } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return out
}

test('update: a newer release shows; copy, how-to and Later work; GitHub asked every 6 hours', async ($, on) => {
  const files = new Map<string, string>()
  const out = world(on, files, '1.5.0')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'update-now' })).toBeDefined()
  await ui.press({ key: 'update-how' })
  expect(out.copied).toBe('/plugin')
  expect(await ui.find({ type: 'Text', text: /Enable auto-update/ })).toBeDefined()
  await ui.press({ key: 'update-later' })
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  await ui.unmount()
  // Later holds for 1.5.0; another start the same day asks GitHub no more.
  await $.session.start(START)
  const again = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await again.find({ key: 'update-now' })).toBeUndefined()
  await again.unmount()
  expect(out.fetches).toBe(1)
  // 6 hours later a new start asks again, so a release shows the same day
  // (the last check moved back 6 hours: the window's own timers stay out of it).
  const state = `${HOME}/.claude/window-tint/update.json`
  const last = JSON.parse(files.get(state)!)
  files.set(state, JSON.stringify({ ...last, checkedAt: last.checkedAt - 6 * 60 * 60 * 1000 + 1 }))
  await $.session.start(START)
  expect(out.fetches).toBe(1)
  files.set(state, JSON.stringify({ ...last, checkedAt: last.checkedAt - 6 * 60 * 60 * 1000 }))
  await $.session.start(START)
  expect(out.fetches).toBe(2)
})

test('update: nothing when this is the newest version', async ($, on) => {
  world(on, new Map(), '1.4.0')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  await ui.unmount()
})

test('update: nothing when auto-update is on for tint\'s marketplace', async ($, on) => {
  const files = new Map<string, string>([[`${HOME}/.claude/settings.json`, JSON.stringify({ extraKnownMarketplaces: { 'claude-code-tint-mod': { autoUpdate: true } } })]])
  world(on, files, '1.5.0')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  await ui.unmount()
  // Read only: the mod never changes the person's settings.
  expect(files.get(`${HOME}/.claude/settings.json`)).toBe(JSON.stringify({ extraKnownMarketplaces: { 'claude-code-tint-mod': { autoUpdate: true } } }))
})

test('update: /mod_tint update runs the plugin update, and says what to type when it cannot', async ($, on) => {
  const out = world(on, new Map(), '1.5.0')
  await $.session.start(START)
  const AT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
  const done = await $.command.run({ command: 'mod_tint', args: 'update', ...AT })
  expect(out.runs).toContainEqual(['claude', 'plugin', 'update', 'tint@claude-code-tint-mod'])
  expect(done.text).toContain('/reload-plugins')
  out.failClaude = true
  const failed = await $.command.run({ command: 'mod_tint', args: 'update', ...AT })
  expect(failed.text).toContain('/plugin update tint@claude-code-tint-mod')
  expect(out.fetches).toBe(1)
})

test('update: on the desktop, the update line rides along with the 2-step reminder', async ($, on) => {
  const APP = `${HOME}/Library/Application Support/Claude`
  const files = new Map<string, string>([[`${APP}/Preferences`, JSON.stringify({ electron: { devtools: { preferences: {
    'script-snippets': JSON.stringify([{ name: 'tint', content: 'const REPOS = /*REPOS*/{}/*REPOS*/ // tint' }]),
  } } } })]])
  world(on, files, '1.5.0', 'desktop')
  await $.session.start({ ...START, surface: 'desktop' })
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-share' })).toBeDefined()
  expect(await ui.find({ key: 'update-now' })).toBeDefined()
  // The desktop app has no auto-update switch, so its band offers Update now alone.
  expect(await ui.find({ key: 'update-how' })).toBeUndefined()
  await ui.unmount()
})

test('update: alone on the desktop it counts down 60 s, then hides until the next session', async ($, on) => {
  const APP = `${HOME}/Library/Application Support/Claude`
  const files = new Map<string, string>([
    [`${APP}/Preferences`, JSON.stringify({ electron: { devtools: { preferences: {
      'script-snippets': JSON.stringify([{ name: 'tint', content: 'const REPOS = /*REPOS*/{}/*REPOS*/ // tint' }]),
    } } } })],
    [`${DIR}/desktop.json`, JSON.stringify({ doneFor: 'Fri Oct  9 03:36:30 2026' })],
  ])
  const out = world(on, files, '1.5.0', 'desktop')
  await $.session.start({ ...START, surface: 'desktop' })
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-share' })).toBeUndefined()
  expect(await ui.find({ key: 'update-now' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⏳ 60s/ })).toBeDefined()
  await out.clock.advance(61_000)
  expect(await ui.find({ key: 'update-now' })).toBeUndefined()
  await ui.unmount()
})

test('update: the auto-update steps never open by themselves at a new start', async ($, on) => {
  world(on, new Map(), '1.5.0')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  await ui.press({ key: 'update-how' })
  expect(await ui.find({ type: 'Text', text: /Enable auto-update/ })).toBeDefined()
  await ui.unmount()
  await $.session.start(START)
  const again = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await again.find({ type: 'Text', text: /Marketplaces/ })).toBeUndefined()
  await again.unmount()
})

test('update: on the desktop, a failed Update now points to the app\'s own Update button', async ($, on) => {
  const out = world(on, new Map(), '1.5.0', 'desktop')
  out.failClaude = true
  await $.session.start({ ...START, surface: 'desktop' })
  const AT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
  const failed = await $.command.run({ command: 'mod_tint', args: 'update', ...AT })
  expect(failed.text).toContain('choose Tint, then click Update')
})

