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

function desktopWorld(on: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1], files: Map<string, string>, openFails = false) {
  const out = { copied: undefined as string | undefined, toasts: [] as string[], runs: [] as string[][], ps: '', clock: undefined as unknown as ReturnType<typeof mock.clock> }
  const clock = mock.clock(on, { now: 1_000_000 })
  Object.assign(out, { clock })
  mock.env(on, { HOME })
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/lab-notes' }))
  on('session.repo', () => ({ value: { root: '/work/lab-notes', remote: null, internal: false, name: null } }))
  on('session.surfaces', () => ({ value: ['desktop'] as never }))
  on('fs.read', ($, e) => {
    if (e.path.endsWith('/desktop/tint.js')) return { value: TEMPLATE }
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', () => ({ value: [] }))
  on('model.complete', () => ({ deny: 'offline' }))
  on('process.run', ($, e) => {
    out.runs.push([...e.argv])
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
  expect(runner).toContain('--restart\n')
  expect(out.runs).toContainEqual(['chmod', '755', `${DIR}/install-desktop.command`])
  expect(out.runs).toContainEqual(['open', '-a', 'Terminal', `${DIR}/install-desktop.command`])
  expect(go.text).toContain('Terminal is opening')
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
  expect(out.toasts).toContain('tint: Terminal is opening. Claude quits and comes back in a few seconds.')
  await ui.unmount()
})

test('desktop band: an older snippet offers the update; repo colors alone never count; Later waits for the next version', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    [`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{"old":["#000000","⬛"]}/*REPOS*/ // tint')],
  ])
  desktopWorld(on, files)
  await $.session.start(START)
  const same = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await same.find({ key: 'desktop-update' })).toBeUndefined()
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

test('desktop band: once per app start, how to turn the colors on; Done until the app starts again', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith(TEMPLATE)]])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ key: 'desktop-title' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '⌥⌘I' })).toBeDefined()
  expect(await ui.find({ key: 'glow-0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2️⃣\s+In that window, right-click/ })).toBeDefined()
  expect(await ui.find({ key: 'desktop-done' })).toBeUndefined()
  await ui.press({ key: 'desktop-share' })
  expect(out.copied).toContain('https://github.com/JimmySadek/claude-code-tint-mod')
  expect(out.toasts).toContain('tint: copied. Paste it to a friend 💌')
  await out.clock.advance(60_500)
  expect(JSON.parse(files.get(`${DIR}/desktop.json`)!).doneFor).toBe('Fri Oct  9 03:36:30 2026')
  await ui.unmount()

  await $.session.start(START)
  const again = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await again.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  await again.unmount()

  out.ps = APP_ROW('Fri Oct  9 09:00:00 2026')
  await $.session.start(START)
  const restarted = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await restarted.find({ type: 'Text', text: /⏳/ })).toBeDefined()
  await restarted.unmount()

  // The terminal never shows the desktop band.
  const term = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await term.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  await term.unmount()
})

test('desktop band: the reminder counts down 60 seconds, then hides like Done', async ($, on) => {
  const files = new Map<string, string>([[`${APP}/Preferences`, prefsWith(TEMPLATE)]])
  const out = desktopWorld(on, files)
  out.ps = APP_ROW('Fri Oct  9 03:36:30 2026')
  await $.session.start(START)
  // Time before the band is first drawn (a survey up, say) does not count.
  await out.clock.advance(20_000)
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /⏳ 60s/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Auto-closes in' })).toBeDefined()
  // The clock tick after the first draw starts it (at most half a second later).
  await out.clock.advance(10_500)
  expect(await ui.find({ type: 'Text', text: /⏳ 50s/ })).toBeDefined()
  await out.clock.advance(50_500)
  expect(await ui.find({ type: 'Text', text: /⏳/ })).toBeUndefined()
  expect(JSON.parse(files.get(`${DIR}/desktop.json`)!).doneFor).toBe('Fri Oct  9 03:36:30 2026')
  await ui.unmount()
})

