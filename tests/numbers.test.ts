import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`
const NOW = 1_000_000

// One window of claude-mods, session id "me". `onFirstClaim` runs when this window first
// writes its record: another window starting at the same moment writes its own then.
function world(on: Parameters<TestBody>[1], files: Map<string, string>, onFirstClaim?: () => void) {
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { HOME })
  let isClaimed = false
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/claude-mods' }))
  on('session.repo', () => ({ value: { root: '/work/claude-mods', remote: null, internal: false, name: null } }))
  on('fs.read', ($, e) => {
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    if (e.path === `${DIR}/windows/me.json` && !isClaimed) {
      isClaimed = true
      onFirstClaim?.()
    }
    return { value: undefined }
  })
  on('fs.list', ($, e) => ({
    value: [...files.keys()]
      .filter(p => p.startsWith(`${e.path}/`) && !p.slice(e.path.length + 1).includes('/'))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })) as never,
  }))
  on('process.run', () => ({ deny: 'not here' }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return clock
}

const record = (n: number, since?: number) => JSON.stringify({ repo: 'claude-mods', n, seen: NOW, ...(since === undefined ? {} : { since }) })
const mine = (files: Map<string, string>) => JSON.parse(files.get(`${DIR}/windows/me.json`)!)
const START = { cwd: '/work/claude-mods', surface: 'terminal', isInteractive: false } as const

test('two windows starting at the same moment: the lower session id keeps the number', async ($, on) => {
  const files = new Map<string, string>()
  // "aaa" found number 1 free too and wrote it at the same moment.
  world(on, files, () => files.set(`${DIR}/windows/aaa.json`, record(1, NOW)))
  await $.session.start(START)
  expect(mine(files)).toMatchObject({ n: 2, since: NOW })
})

test('two windows starting at the same moment: a higher session id moves on, not this one', async ($, on) => {
  const files = new Map<string, string>()
  world(on, files, () => files.set(`${DIR}/windows/zzz.json`, record(1, NOW)))
  await $.session.start(START)
  expect(mine(files).n).toBe(1)
})

test('a window from before 1.9.0 (no claim time) counts as the earlier claim', async ($, on) => {
  const files = new Map<string, string>()
  world(on, files, () => files.set(`${DIR}/windows/zzz.json`, record(1)))
  await $.session.start(START)
  expect(mine(files).n).toBe(2)
})

test('a newcomer with a lower session id but a later claim moves on', async ($, on) => {
  const files = new Map<string, string>()
  // "zzz" claimed 1 a moment before this window ("me" < "zzz" would win only a tie).
  world(on, files, () => files.set(`${DIR}/windows/zzz.json`, record(1, NOW - 1)))
  await $.session.start(START)
  expect(mine(files).n).toBe(2)
})

test('a resumed session claims afresh: its old claim time never takes an open window\'s number', async ($, on) => {
  const files = new Map<string, string>([
    // This session's own record from two days ago, claimed long before anyone else.
    [`${DIR}/windows/me.json`, JSON.stringify({ repo: 'claude-mods', n: 1, seen: NOW - 48 * 3_600_000, since: 1 })],
  ])
  const clock = world(on, files)
  await $.session.start(START)
  expect(mine(files)).toMatchObject({ n: 1, since: NOW })
  // An open window that held 1 (its record was briefly stale, a Mac waking) keeps it on the re-check.
  files.set(`${DIR}/windows/zzz.json`, record(1, NOW - 3_600_000))
  await clock.advance(31_000)
  expect(mine(files).n).toBe(2)
  // The two-day-old record was its own: not deleted as an orphan while it is being written.
  expect(files.has(`${DIR}/windows/me.json`)).toBe(true)
})

test('the heartbeat finds a number taken by an earlier claim and moves on; the label follows', async ($, on) => {
  const files = new Map<string, string>()
  const clock = world(on, files)
  await $.session.start(START)
  expect(mine(files).n).toBe(1)
  // A claim written just after this window's check, by a window that claimed earlier.
  files.set(`${DIR}/windows/zzz.json`, record(1, NOW - 1_000))
  await clock.advance(31_000)
  expect(mine(files)).toMatchObject({ n: 2, since: NOW + 30_000 })
  const strip = await $.ui.mount({
    plugin: 'tint', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} } as never,
  })
  expect(await strip.find({ type: 'Text', text: /CLAUDE-MODS\s+2/ })).toBeDefined()
  await strip.unmount()
  // Settled: the next heartbeat keeps 2.
  await clock.advance(30_000)
  expect(mine(files).n).toBe(2)
})
