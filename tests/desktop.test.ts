import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`
const AT_PROMPT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const TEMPLATE = 'const REPOS = /*REPOS*/{}/*REPOS*/ // tint'
const SCAN = '// scan, copied as it is'

test('desktop: /mod_tint css copies the tint with every repo\'s colors', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME })
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({
      'claude-mods': { icon: '🧩', color: '#7C3AED' },
      'old-repo': { color: 'teal' },
      'no-color': { icon: '📦' },
    })],
  ])
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/claude-mods-wt' }))
  on('session.repo', () => ({
    value: { root: '/work/claude-mods-wt', remote: 'git@github.com:Me/claude-mods.git', internal: false, name: null },
  }))
  on('session.surfaces', () => ({ value: ['desktop'] as never }))
  on('fs.read', ($, e) => {
    if (e.path.endsWith('/desktop/tint.js')) return { value: TEMPLATE }
    if (e.path.endsWith('/desktop/scan.js')) return { value: SCAN }
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [] }))
  on('model.complete', () => ({ deny: 'offline' }))
  on('process.run', () => ({ deny: 'not macOS' }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  let copied: string | undefined
  on('ui.copy', ($, e) => {
    copied = e.text
    return { value: { isCopied: true } } as never
  })

  await $.session.start({ cwd: '/work/claude-mods-wt', surface: 'desktop', isInteractive: false })
  await clock.settle()

  // The worktree folder is remembered as another name of the repo.
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].folders).toEqual(['claude-mods-wt'])

  // css: the template with each repo under every name the app may show; color names become hex.
  await $.command.run({ command: 'mod_tint', args: 'css', ...AT_PROMPT })
  const repos = JSON.parse(copied!.match(/const REPOS = \/\*REPOS\*\/(\{.*\})\/\*REPOS\*\/ \/\/ tint/)![1]!)
  expect(repos['claude-mods']).toEqual(['#7C3AED', '🧩'])
  expect(repos['claude-mods-wt']).toEqual(['#7C3AED', '🧩'])
  expect(repos['old-repo'][0]).toBe('#14B8A6')
  expect(repos['no-color']).toBeUndefined()

  // The help is Markdown tables (a command's answer is drawn as Markdown).
  const help = await $.command.run({ command: 'mod_tint', args: 'help', ...AT_PROMPT })
  expect(help.text).toContain('| Command | What it does |')
  expect(help.text).toContain('| `/mod_tint css` |')

  // css scan: the scan as it is.
  await $.command.run({ command: 'mod_tint', args: 'css scan', ...AT_PROMPT })
  expect(copied).toBe(SCAN)
})

const APP = `${HOME}/Library/Application Support/Claude`
const prefsWith = (snippet?: string) => JSON.stringify({
  electron: { devtools: { preferences: {
    'panel-selected-tab': '"console"',
    ...(snippet === undefined ? {} : { 'script-snippets': JSON.stringify([{ name: 'tint', content: snippet }]) }),
  } } },
})

// host: the desktop app's own id for the session (CLAUDE_CODE_HOST_SESSION_ID); template: the
// script this copy ships, when a test needs its /*ROOMS*/ marks.
function desktopWorld(on: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1], files: Map<string, string>, openFails = false,
  { host, template = TEMPLATE }: { host?: string; template?: string } = {}) {
  const out = {
    copied: undefined as string | undefined, toasts: [] as string[], runs: [] as string[][], ps: '', clock: undefined as unknown as ReturnType<typeof mock.clock>,
    // Reads per path, and modification times for fs.stat (none: stat is refused, as where it cannot be told).
    reads: new Map<string, number>(), writes: new Map<string, number>(), mtimes: new Map<string, number>(),
  }
  const clock = mock.clock(on, { now: 1_000_000 })
  Object.assign(out, { clock })
  mock.env(on, host === undefined ? { HOME } : { HOME, CLAUDE_CODE_HOST_SESSION_ID: host })
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/lab-notes' }))
  on('session.repo', () => ({ value: { root: '/work/lab-notes', remote: null, internal: false, name: null } }))
  on('session.surfaces', () => ({ value: ['desktop'] as never }))
  on('fs.read', ($, e) => {
    out.reads.set(e.path, (out.reads.get(e.path) ?? 0) + 1)
    if (e.path.endsWith('/desktop/tint.js')) return { value: template }
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.stat', ($, e) => {
    const mtimeMs = out.mtimes.get(e.path)
    return mtimeMs === undefined ? { deny: 'ENOENT' } : { value: { kind: 'file', size: 1, mtimeMs, isLink: false } as never }
  })
  on('fs.write', ($, e) => {
    out.writes.set(e.path, (out.writes.get(e.path) ?? 0) + 1)
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [] }))
  on('model.complete', () => ({ deny: 'offline' }))
  on('process.run', ($, e) => {
    out.runs.push([...e.argv])
    if (e.argv[0] === 'mv') { files.set(e.argv[3]!, files.get(e.argv[2]!)!); files.delete(e.argv[2]!) }
    return { value: { exitCode: openFails && e.argv[0] === 'open' ? 1 : 0, stdout: e.argv[0] === 'ps' ? out.ps : '', stderr: '' } } as never
  })
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    out.toasts.push(e.text)
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.copy', ($, e) => {
    out.copied = e.text
    return { value: { isCopied: true } } as never
  })
  return out
}

test('desktop: /mod_tint desktop explains first; go runs the install in Terminal; line copies it', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${APP}/Preferences`, prefsWith()],
  ])
  const out = desktopWorld(on, files)
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })

  // Alone: nothing happens yet; it says what go will do, Developer Mode included when it is off.
  const plan = await $.command.run({ command: 'mod_tint', args: 'desktop', ...AT_PROMPT })
  expect(plan.text).toContain('/mod_tint desktop go')
  expect(plan.text).toContain('Developer Mode')
  expect(out.runs.some(argv => argv[0] === 'open')).toBe(false)
  expect(files.has(`${DIR}/desktop-snippet.js`)).toBe(false)
  files.set(`${APP}/developer_settings.json`, JSON.stringify({ allowDevTools: true }))
  expect((await $.command.run({ command: 'mod_tint', args: 'desktop', ...AT_PROMPT })).text).not.toContain('Developer Mode')

  // go: the script with repo colors, and a .command file Terminal opens and runs.
  const go = await $.command.run({ command: 'mod_tint', args: 'desktop go', ...AT_PROMPT })
  expect(files.get(`${DIR}/desktop-snippet.js`)).toContain('/*REPOS*/{"lab-notes":["#259F3E","🧪"]}/*REPOS*/')
  const runner = files.get(`${DIR}/install-desktop.command`)!
  expect(runner).toStartWith('#!/bin/sh\n')
  expect(runner).toContain('/usr/bin/python3 \'')
  expect(runner).toContain('/helpers/desktop-snippet.py\'')
  expect(runner).toContain(`--prefs '${APP}/Preferences'`)
  expect(runner).toContain(`--dev-mode '${APP}/developer_settings.json'`)
  expect(runner).toContain('--restart; then\n')
  // On success the window closes itself; on a problem it stays and says it is safe to close.
  expect(runner).toContain('close (every window whose name contains "install-desktop.command")')
  expect(runner).toContain('❌ NOT installed (see above). You can close this window now.')
  expect(out.runs).toContainEqual(['chmod', '755', `${DIR}/install-desktop.command`])
  expect(out.runs).toContainEqual(['open', '-a', 'Terminal', `${DIR}/install-desktop.command`])
  expect(go.text).toContain('Terminal is opening')
  // The app asks before it quits while a session works (this one always is): say what to click,
  // and never sound done before Terminal says so.
  expect(go.text).toContain('Quit anyway')
  expect(go.text).toContain('Nothing is installed yet')
  expect(go.text).not.toContain('✅ **Terminal')
  expect(out.copied).toBeUndefined()

  // Installed and current (repo colors aside): the plain-words card to turn the colors on.
  files.set(`${APP}/Preferences`, prefsWith(files.get(`${DIR}/desktop-snippet.js`)!.replace('#259F3E', '#000000')))
  const card = await $.command.run({ command: 'mod_tint', args: 'desktop', ...AT_PROMPT })
  expect(card.text).toContain('Turn on the colors')
  expect(card.text).toContain('right-click **tint**')
  // Installed but older: the plan, as an update.
  files.set(`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{}/*REPOS*/ // tint v0'))
  expect((await $.command.run({ command: 'mod_tint', args: 'desktop', ...AT_PROMPT })).text).toContain('An update for the desktop colors is ready')

  // line: the same line, copied to run by hand.
  const line = await $.command.run({ command: 'mod_tint', args: 'desktop line', ...AT_PROMPT })
  expect(out.copied).toStartWith('/usr/bin/python3 \'')
  expect(out.copied).toEndWith('--restart')
  expect(runner).toContain(out.copied!)
  expect(line.text).toContain('One Terminal line copied')
})

test('desktop: when Terminal cannot be opened, go falls back to copying the line', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith()]])
  const out = desktopWorld(on, files, true)
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  const go = await $.command.run({ command: 'mod_tint', args: 'desktop go', ...AT_PROMPT })
  expect(go.text).toContain('One Terminal line copied')
  expect(out.copied).toContain('--dev-mode')
})

test('desktop: no desktop app here, so /mod_tint desktop says so and changes nothing', async ($, on) => {
  const files = new Map<string, string>()
  const out = desktopWorld(on, files)
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  const answer = await $.command.run({ command: 'mod_tint', args: 'desktop', ...AT_PROMPT })
  expect(answer.text).toContain('not found')
  expect(out.copied).toBeUndefined()
  expect(files.has(`${DIR}/desktop-snippet.js`)).toBe(false)
})

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const
const START = { cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false } as const
const APP_ROW = (when: string) => `${when}     /Applications/Claude.app/Contents/MacOS/Claude\n`

test('desktop band: offers the install once; No thanks keeps it away in every window', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith()]])
  const out = desktopWorld(on, files)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-install' })).toBeDefined()
  await ui.press({ key: 'desktop-no' })
  expect(JSON.parse(files.get(`${DIR}/desktop.json`)!).isInstallDeclined).toBe(true)
  expect(await ui.find({ key: 'desktop-install' })).toBeUndefined()
  await ui.unmount()
  // Another window: still away. /mod_tint desktop stays there for later.
  await $.session.start(START)
  const other = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await other.find({ key: 'desktop-install' })).toBeUndefined()
  await other.unmount()
  expect(out.toasts).toContain('tint: OK. /mod_tint desktop sets it up any time.')
})

test('desktop band: Color the app runs the same install as /mod_tint desktop go', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith()]])
  const out = desktopWorld(on, files)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  await ui.press({ key: 'desktop-install' })
  expect(out.runs.some(argv => argv[0] === 'open' && argv.includes('Terminal'))).toBe(true)
  expect(files.get(`${DIR}/install-desktop.command`)).toContain('--restart')
  expect(out.toasts).toContain('tint: Terminal is opening. When Claude asks "Claude is still working…", click Quit anyway.')
  await ui.unmount()
})

test('desktop band: an older snippet offers the update; repo colors are not the script\'s update; Later waits for the next version', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{"old":["#000000","⬛"]}/*REPOS*/ // tint')],
  ])
  desktopWorld(on, files)
  await $.session.start(START)
  const same = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await same.find({ key: 'desktop-update' })).toBeUndefined()
  expect(await same.find({ key: 'desktop-colors' })).toBeDefined()
  await same.unmount()

  files.set(`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{}/*REPOS*/ // tint v0'))
  await $.session.start(START)
  const older = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await older.find({ key: 'desktop-update' })).toBeDefined()
  await older.press({ key: 'desktop-later' })
  await older.unmount()
  await $.session.start(START)
  const after = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await after.find({ key: 'desktop-update' })).toBeUndefined()
  await after.unmount()
})

const carried = async (ui: { find: (q: { type: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) => {
  const tag = await ui.find({ type: 'Svg' })
  return tag === undefined ? undefined : JSON.parse(String(tag.props.alt).slice('tint-colors '.length))
}

test('desktop band: colors chosen after the snippet was saved ride in the band; Later waits for the next color', async ($, on) => {
  const saved = 'const REPOS = /*REPOS*/{"lab-notes":["#259F3E","🧪"]}/*REPOS*/ // tint'
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${APP}/Preferences`, prefsWith(saved)],
  ])
  const out = desktopWorld(on, files)
  await $.session.start(START)
  // The snippet has every color: no band, no picture.
  const none = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await none.find({ type: 'Svg' })).toBeUndefined()
  expect(await none.find({ key: 'desktop-colors' })).toBeUndefined()
  await none.unmount()

  // A color chosen now: the band offers to keep it and carries it for the running script at once.
  await $.command.run({ command: 'mod_tint', args: 'color #7C3AED', ...AT_PROMPT })
  await out.clock.settle()
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-colors' })).toBeDefined()
  const label = await carried(ui)
  expect(label.repos['lab-notes']).toEqual(['#7C3AED', '🧪'])
  expect(label.window).toEqual(['lab-notes', 1])
  // When this copy read the change, so the newest of several windows' labels wins.
  const pickedAt = label.at
  expect(pickedAt).toBeGreaterThan(0)
  // Only the colors offer in the band: the script may hide it, since its colors already show.
  expect(label.band).toBe('colors')
  // A colors band stays still (no clock redrawing it while hidden).
  const glowBefore = await ui.find({ key: 'glow-0' })
  await out.clock.advance(2_000)
  expect((await ui.find({ key: 'glow-0' }))?.props.backgroundColor).toBe(glowBefore?.props.backgroundColor)
  // Later: the offer goes for this app start (no band, so no picture either).
  await ui.press({ key: 'desktop-colors-later' })
  expect(await ui.find({ key: 'desktop-colors' })).toBeUndefined()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
  await $.session.start(START)
  const later = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await later.find({ key: 'desktop-colors' })).toBeUndefined()
  await later.unmount()
  // Later never stops the colors: after the next app start the reminder carries them, so the
  // script shows them once it runs, and after Done the offer is back.
  out.ps = APP_ROW('Fri Oct  9 09:00:00 2026')
  await $.session.start(START)
  const restarted = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await restarted.find({ key: 'desktop-done' })).toBeDefined()
  expect((await carried(restarted)).repos['lab-notes'][0]).toBe('#7C3AED')
  await restarted.press({ key: 'desktop-done' })
  await out.clock.settle()
  expect(await restarted.find({ key: 'desktop-colors' })).toBeDefined()
  await restarted.unmount()

  // Hidden tint: no band, no picture.
  await $.command.run({ command: 'mod_tint', args: 'off', ...AT_PROMPT })
  const hidden = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await hidden.find({ type: 'Svg' })).toBeUndefined()
  await hidden.unmount()
  await $.command.run({ command: 'mod_tint', args: 'on', ...AT_PROMPT })

  // Another color: back again. Update saves the snippet with it.
  await $.command.run({ command: 'mod_tint', args: 'color teal', ...AT_PROMPT })
  await out.clock.settle()
  const again = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect((await carried(again)).repos['lab-notes'][0]).toBe('#14B8A6')
  expect((await carried(again)).at).toBeGreaterThan(pickedAt)
  await again.press({ key: 'desktop-colors' })
  expect(out.runs.some(argv => argv[0] === 'open' && argv.includes('Terminal'))).toBe(true)
  expect(files.get(`${DIR}/desktop-snippet.js`)).toContain('"lab-notes":["#14B8A6","🧪"]')
  await again.unmount()

  // Saved: nothing more to carry.
  files.set(`${APP}/Preferences`, prefsWith(files.get(`${DIR}/desktop-snippet.js`)!))
  await $.session.start(START)
  const done = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await done.find({ type: 'Svg' })).toBeUndefined()
  await done.unmount()
})

const ROOMS_TEMPLATE = 'const REPOS = /*REPOS*/{}/*REPOS*/ const ROOMS = /*ROOMS*/{}/*ROOMS*/ // tint'
const savedWith = (rooms: Record<string, string>) =>
  `const REPOS = /*REPOS*/{"lab-notes":["#259F3E","🧪"]}/*REPOS*/ const ROOMS = /*ROOMS*/${JSON.stringify(rooms)}/*ROOMS*/ // tint`

test('desktop band: a session\'s folder, by the app\'s id for it, rides in the band and is saved with the script; Later waits for the next room', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' }, 'no-color': { icon: '🦊' } })],
    // A room of a repo with no color yet is noted but never drawn or saved.
    [`${DIR}/rooms.json`, JSON.stringify({ local_old: 'lab-notes', local_grey: 'no-color' })],
    [`${APP}/Preferences`, prefsWith(savedWith({ local_old: 'lab-notes' }))],
  ])
  const out = desktopWorld(on, files, false, { host: 'local_room1', template: ROOMS_TEMPLATE })
  out.ps = APP_ROW('Fri Oct  9 09:00:00 2026')
  await $.session.start(START)
  // Noted once, newest last, the others kept.
  expect(JSON.parse(files.get(`${DIR}/rooms.json`)!)).toEqual({ local_old: 'lab-notes', local_grey: 'no-color', local_room1: 'lab-notes' })
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  // Not the script's update. Until Done the script may not run, so rooms alone bring no offer of
  // their own (only it can tell a work room from another folder), but the reminder carries them.
  expect(await ui.find({ key: 'desktop-update' })).toBeUndefined()
  expect(await ui.find({ key: 'desktop-done' })).toBeDefined()
  // Only the room the saved script lacks; "fresh": none put off yet.
  expect((await carried(ui)).rooms).toEqual({ local_room1: 'lab-notes' })
  expect((await carried(ui)).fresh).toEqual({ local_room1: 'lab-notes' })
  await ui.press({ key: 'desktop-done' })
  await out.clock.settle()
  // The script runs: the offer, which it hides unless a work room from another folder waits.
  expect(await ui.find({ key: 'desktop-colors' })).toBeDefined()
  expect((await carried(ui)).band).toBe('colors')

  // Later: away until another room starts, and the room put off keeps no band up after that.
  await ui.press({ key: 'desktop-colors-later' })
  expect(await ui.find({ key: 'desktop-colors' })).toBeUndefined()
  files.set(`${DIR}/rooms.json`, JSON.stringify({ ...JSON.parse(files.get(`${DIR}/rooms.json`)!), local_room2: 'lab-notes' }))
  await out.clock.advance(30_000)
  await out.clock.settle()
  expect(await ui.find({ key: 'desktop-colors' })).toBeDefined()
  expect((await carried(ui)).rooms).toEqual({ local_room1: 'lab-notes', local_room2: 'lab-notes' })
  expect((await carried(ui)).fresh).toEqual({ local_room2: 'lab-notes' })

  // Update saves every room whose repo has a color into the script.
  await ui.press({ key: 'desktop-colors' })
  expect(files.get(`${DIR}/desktop-snippet.js`)).toContain('/*ROOMS*/{"local_old":"lab-notes","local_room1":"lab-notes","local_room2":"lab-notes"}/*ROOMS*/')
  await ui.unmount()

  // Saved: nothing more to carry, and no band.
  files.set(`${APP}/Preferences`, prefsWith(files.get(`${DIR}/desktop-snippet.js`)!))
  await $.session.start(START)
  const done = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await done.find({ type: 'Svg' })).toBeUndefined()
  expect(await done.find({ key: 'desktop-colors' })).toBeUndefined()
  await done.unmount()
})

test('desktop band: a rooms.json that cannot be read is left as it is', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${DIR}/rooms.json`, '{ not json'],
    [`${APP}/Preferences`, prefsWith(savedWith({}))],
  ])
  desktopWorld(on, files, false, { host: 'local_room1', template: ROOMS_TEMPLATE })
  await $.session.start(START)
  expect(files.get(`${DIR}/rooms.json`)).toBe('{ not json')
})

test('desktop band: without the app\'s id for the session, no room is noted and nothing is offered', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${APP}/Preferences`, prefsWith(savedWith({}))],
  ])
  desktopWorld(on, files, false, { template: ROOMS_TEMPLATE })
  await $.session.start(START)
  expect(files.has(`${DIR}/rooms.json`)).toBe(false)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-colors' })).toBeUndefined()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('desktop band: after an app start the reminder carries due colors too, but is never hidden', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#7C3AED' } })],
    [`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{"lab-notes":["#259F3E","🧪"]}/*REPOS*/ // tint')],
  ])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-done' })).toBeDefined()
  const label = await carried(ui)
  expect(label.repos['lab-notes'][0]).toBe('#7C3AED')
  expect(label.band).toBeUndefined()
  // Done: the colors offer takes its place, and that one may be hidden.
  await ui.press({ key: 'desktop-done' })
  await out.clock.settle()
  expect(await ui.find({ key: 'desktop-colors' })).toBeDefined()
  expect((await carried(ui)).band).toBe('colors')
  await ui.unmount()
})

test('desktop band: after each app start, how to turn the colors on; Done until the app starts again', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith(TEMPLATE)]])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-title' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '⌥⌘I' })).toBeDefined()
  expect(await ui.find({ key: 'glow-0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2️⃣\s+In that window, right-click/ })).toBeDefined()
  await ui.press({ key: 'desktop-share' })
  expect(out.copied).toContain('https://github.com/JimmySadek/claude-code-tint-mod')
  expect(out.toasts).toContain('tint: copied. Paste it to a friend 💌')
  await ui.press({ key: 'desktop-done' })
  expect(JSON.parse(files.get(`${DIR}/desktop.json`)!).doneFor).toBe('Fri Oct  9 03:36:30 2026')
  expect(await ui.find({ key: 'desktop-done' })).toBeUndefined()
  // Done holds for this app start, however long it runs.
  await out.clock.advance(60 * 60_000)
  expect(await ui.find({ key: 'desktop-done' })).toBeUndefined()
  await ui.unmount()

  await $.session.start(START)
  const again = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await again.find({ key: 'desktop-done' })).toBeUndefined()
  await again.unmount()

  out.ps = APP_ROW('Fri Oct  9 09:00:00 2026')
  await $.session.start(START)
  const restarted = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await restarted.find({ key: 'desktop-done' })).toBeDefined()
  await restarted.unmount()

  // The terminal never shows the desktop band.
  const term = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await term.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  await term.unmount()
})

// /reload-plugins swaps in tint's new copy, but on 2026-10-12 (desktop app, git-installed update) the
// band never came back in the open session: the new copy's band and timers depended on session.start
// alone. Here no session.start reaches this copy; the next prompt or attach must start them.
test('desktop band: a copy that never got session.start (a reload) starts on the next prompt', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{}/*REPOS*/ // tint v0')]])
  const out = desktopWorld(on, files)
  on('classic.UserPromptSubmit', () => ({}))
  await $.classic.UserPromptSubmit({ prompt: 'I reloaded but still nothing' } as never)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-update' })).toBeDefined()
  // Its timers run too: the heartbeat keeps this window counted.
  await out.clock.advance(31_000)
  expect(JSON.parse(files.get(`${DIR}/windows/me.json`)!).repo).toBe('lab-notes')
  await ui.unmount()
})

test('desktop band: a copy that never got session.start starts when the desktop attaches', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith()]])
  desktopWorld(on, files)
  on('session.attach', ($, e) => ({ clientId: e.clientId }))
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-install' })).toBeDefined()
  await ui.unmount()
})

test('desktop band: the reminder stands still, hides after 60 seconds, and comes back after 10 minutes until Done', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith(TEMPLATE)]])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  await $.session.start(START)
  // Time before the band is first drawn (a survey up, say) does not count.
  await out.clock.advance(20_000)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /⏳ Closes by itself in a minute/ })).toBeDefined()
  // Nothing in the band moves: the desktop draws a mod's box again on every redraw.
  const strip = (await ui.find({ key: 'glow-0' }))?.props.backgroundColor
  // The clock tick after the first draw starts the minute (at most a second later).
  await out.clock.advance(10_500)
  expect(await ui.find({ type: 'Text', text: /⏳ Closes by itself in a minute/ })).toBeDefined()
  expect((await ui.find({ key: 'glow-0' }))?.props.backgroundColor).toBe(strip)
  await out.clock.advance(50_500)
  expect(await ui.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  // Counting down is not Done: nobody may have been there to see it.
  const state = JSON.parse(files.get(`${DIR}/desktop.json`)!)
  expect(state.doneFor).toBeUndefined()
  expect(state.snoozedFor).toBe('Fri Oct  9 03:36:30 2026')
  // A new window inside the 10 minutes stays quiet too.
  await $.session.start(START)
  const other = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await other.find({ key: 'desktop-done' })).toBeUndefined()
  await other.unmount()
  // After 10 minutes (picked up by the 30-second heartbeat) it is back, with a fresh countdown.
  await out.clock.advance(10 * 60_000)
  expect(await ui.find({ key: 'desktop-done' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⏳ Closes by itself in a minute/ })).toBeDefined()
  await ui.press({ key: 'desktop-done' })
  expect(JSON.parse(files.get(`${DIR}/desktop.json`)!).doneFor).toBe('Fri Oct  9 03:36:30 2026')
  await out.clock.advance(30 * 60_000)
  expect(await ui.find({ key: 'desktop-done' })).toBeUndefined()
  await ui.unmount()
})

const MESSAGE = {
  component: 'UserMessage', props: { text: 'hello', origin: { kind: 'composer' }, isExpanded: true } as never,
} as const

test('frame off (the default): tint has no hook on messages, so the app draws each one itself; frame on sets the option', async ($, on) => {
  const files = new Map<string, string>([[`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })]])
  const out = desktopWorld(on, files)
  const sets: { key: string; value: unknown }[] = []
  on('config.set', ($, e) => {
    sets.push({ key: e.key, value: e.value })
    return { value: e.value } as never
  })
  await $.session.start(START)
  // Nothing to bring in step: no repo has its frame on, and the option is off.
  expect(sets).toEqual([])
  for (const surface of ['terminal', 'desktop'] as const) {
    const message = await $.ui.mount({ plugin: 'tint', surface, ...MESSAGE })
    expect(await message.find({ key: 'tint-frame' })).toBeUndefined()
    await message.unmount()
  }
  // frame on: saved for the repo, and the option that brings the hook (the plugin reloads).
  // The option is set once the answer has gone out (it reloads the plugin).
  const answer = await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  expect(answer.text).toContain('Border around your messages is on')
  expect(sets).toEqual([])
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['lab-notes'].frame).toBe(true)
  await out.clock.settle()
  expect(sets).toEqual([{ key: 'tint.frame', value: true }])
})

test('frame option on while no repo has its frame on (turned off elsewhere): the option goes off at start', { options: { frame: true } }, async ($, on) => {
  const files = new Map<string, string>([[`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E', frame: false } })]])
  const out = desktopWorld(on, files)
  const sets: { key: string; value: unknown }[] = []
  on('config.set', ($, e) => {
    sets.push({ key: e.key, value: e.value })
    return { value: e.value } as never
  })
  await $.session.start(START)
  await out.clock.settle()
  expect(sets).toEqual([{ key: 'tint.frame', value: false }])
})

test('frame on in a repo and the option on: nothing to set, so no reload at start (no loop)', { options: { frame: true } }, async ($, on) => {
  const files = new Map<string, string>([[`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E', frame: true } })]])
  const out = desktopWorld(on, files)
  const sets: string[] = []
  on('config.set', ($, e) => {
    sets.push(e.key)
    return { value: e.value } as never
  })
  await $.session.start(START)
  await out.clock.settle()
  await out.clock.advance(5 * 30_000)
  expect(sets).toEqual([])
  // And the border is drawn: the option brought the hook, the repo asks for it.
  const message = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...MESSAGE })
  expect(await message.find({ key: 'tint-frame' })).toBeDefined()
  await message.unmount()
})

test('frame option row named another way for this install: found among tint\'s rows; refused: said', async ($, on) => {
  const files = new Map<string, string>([[`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })]])
  const out = desktopWorld(on, files)
  const sets: string[] = []
  let isRefused = false
  on('config.set', ($, e) => {
    sets.push(e.key)
    if (isRefused) return { deny: 'locked by policy' } as never
    if (e.key === 'tint.frame') throw new Error('no row tint.frame')
    return { value: e.value } as never
  })
  on('config.list', () => ({ value: [
    { key: 'theme', label: 'Theme', kind: 'choice', value: 'dark', provider: { plugin: 'engine' }, isLocked: false },
    { key: 'tint@claude-code-tint-mod.frame', label: 'Message frame', kind: 'boolean', value: false, provider: { plugin: 'tint' }, isLocked: false },
  ] }) as never)
  await $.session.start(START)
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  await out.clock.settle()
  expect(sets).toEqual(['tint.frame', 'tint@claude-code-tint-mod.frame'])
  expect(out.toasts.filter(text => text.includes('message frame'))).toEqual([])
  // A refusal is said, after a change you asked for.
  isRefused = true
  sets.length = 0
  await $.command.run({ command: 'mod_tint', args: 'frame off', ...AT_PROMPT })
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  await out.clock.settle()
  expect(out.toasts).toContain('tint: the message frame could not be turned on (locked by policy).')
})

test('heartbeat cost: the app settings are read again only when they change, ps every 10 minutes, one clock each', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith(TEMPLATE)]])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  out.mtimes.set(`${APP}/Preferences`, 1)
  await $.session.start(START)
  // A second start in the same copy replaces the clocks instead of running them twice.
  await $.session.start(START)
  const prefsReads = () => out.reads.get(`${APP}/Preferences`) ?? 0
  const psRuns = () => out.runs.filter(argv => argv[0] === 'ps').length
  const scriptReads = () => [...out.reads].filter(([path]) => path.endsWith('/desktop/tint.js')).reduce((sum, [, n]) => sum + n, 0)
  const [prefs, ps, script] = [prefsReads(), psRuns(), scriptReads()]
  await out.clock.advance(5 * 30_000 + 100)
  // Five heartbeats: the settings file unchanged, so never read; ps not asked again; the script read once per copy.
  expect(prefsReads()).toBe(prefs)
  expect(psRuns()).toBe(ps)
  expect(scriptReads()).toBe(script)
  // The app saved its settings: read once more.
  out.mtimes.set(`${APP}/Preferences`, 2)
  await out.clock.advance(30_000)
  expect(prefsReads()).toBe(prefs + 1)
  // After 10 minutes, ps is asked again (a session that outlived an app start would see it).
  await out.clock.advance(10 * 60_000)
  expect(psRuns()).toBe(ps + 1)
  // One heartbeat clock: the window record is written once per 30 seconds, not twice.
  const record = () => out.writes.get(`${DIR}/windows/me.json`) ?? 0
  const before = record()
  await out.clock.advance(30_000)
  expect(record() - before).toBe(1)
})

