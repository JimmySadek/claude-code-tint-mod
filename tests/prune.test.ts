import { expect, mock, test } from 'claude-code/testing'

const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`
const HOUR = 60 * 60 * 1000
const NOW = 100 * HOUR

test('ended windows older than a day are deleted; recent and open ones stay', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME })

  const files = new Map<string, string>([
    [`${DIR}/windows/ended-old.json`, JSON.stringify({ repo: 'matchday', n: 1, seen: NOW - 30 * HOUR, ended: true })],
    [`${DIR}/windows/ended-recent.json`, JSON.stringify({ repo: 'matchday', n: 2, seen: NOW - 2 * HOUR, ended: true })],
    // Never marked ended (still open, or crashed): left alone however old.
    [`${DIR}/windows/open-old.json`, JSON.stringify({ repo: 'claude-mods', n: 1, seen: 1 })],
  ])
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/claude-mods' }))
  on('session.repo', () => ({
    value: { root: '/work/claude-mods', remote: null, internal: false, name: null },
  }))
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
      .filter(p => p.startsWith(`${e.path}/`) && !p.slice(e.path.length + 1).includes('/'))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })) as never,
  }))
  const runs: string[][] = []
  on('process.run', ($, e) => {
    const argv = [...e.argv]
    runs.push(argv)
    if (argv[0] === 'rm') for (const path of argv.slice(2)) files.delete(path)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.UserPromptSubmit', () => ({}))

  await $.session.start({ cwd: '/work/claude-mods', surface: 'desktop', isInteractive: false })
  await clock.settle()

  expect(runs).toEqual([['rm', '-f', `${DIR}/windows/ended-old.json`]])
  expect(files.has(`${DIR}/windows/ended-old.json`)).toBe(false)
  expect(files.has(`${DIR}/windows/ended-recent.json`)).toBe(true)
  expect(files.has(`${DIR}/windows/open-old.json`)).toBe(true)
  // This window still registers itself.
  expect(JSON.parse(files.get(`${DIR}/windows/me.json`)!).repo).toBe('claude-mods')
})
