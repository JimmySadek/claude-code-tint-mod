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
  const help = await $.command.run({ command: 'mod_tint', args: '', ...AT_PROMPT })
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

function desktopWorld(on: Parameters<Parameters<typeof test>[1]>[1], files: Map<string, string>, openFails = false) {
  const out = { copied: undefined as string | undefined, toasts: [] as string[], runs: [] as string[][] }
  mock.clock(on, { now: 1_000_000 })
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
    return { value: { exitCode: openFails && e.argv[0] === 'open' ? 1 : 0, stdout: '', stderr: '' } } as never
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

test('desktop: an older saved snippet is announced once; repo colors alone never count', async ($, on) => {
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#259F3E' } })],
    // Same script, other repo colors: not an update.
    [`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{"old":["#000000","⬛"]}/*REPOS*/ // tint')],
  ])
  const out = desktopWorld(on, files)
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  expect(out.toasts.filter(t => t.includes('desktop tint'))).toEqual([])

  // An older script: one notice, not again for the same version.
  files.set(`${APP}/Preferences`, prefsWith('const REPOS = /*REPOS*/{}/*REPOS*/ // tint v0'))
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: false })
  expect(out.toasts.filter(t => t.includes('desktop tint'))).toEqual(['window-tint: the desktop tint has an update. /mod_tint desktop go installs it.'])
})
