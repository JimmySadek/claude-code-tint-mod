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
  const repos = JSON.parse(copied!.match(/const REPOS = (\{.*\}) \/\/ tint/)![1]!)
  expect(repos['claude-mods']).toEqual(['#7C3AED', '🧩'])
  expect(repos['claude-mods-wt']).toEqual(['#7C3AED', '🧩'])
  expect(repos['old-repo'][0]).toBe('#14B8A6')
  expect(repos['no-color']).toBeUndefined()

  // css scan: the scan as it is.
  await $.command.run({ command: 'mod_tint', args: 'css scan', ...AT_PROMPT })
  expect(copied).toBe(SCAN)
})
