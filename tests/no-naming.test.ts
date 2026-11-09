import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

// Tint only tints. It never adds a note to a prompt, never sets a title and never shows a
// window number: naming sessions belongs to whoever starts them (one-repo's hub).

const HOME = '/home/me'
const AT_PROMPT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
// Titles tint used to act on: a plain one, one with the repo's emoji, a hub's keycap number,
// a role mark, the form before 1.9.0 with a window number, and none yet.
const TITLES = ['Lab · Login bug', '🧪 Lab · Login bug', '2️⃣ CM · pricing calculator', '💬 Lab · Why', '🧪1️⃣ Old work', '']

type Options = { onTool?: (schema: Record<string, unknown>) => void }

function setup(on: Parameters<TestBody>[1], surfaces: string[], options: Options = {}) {
  const clock = mock.clock(on, { now: 1_000_000 })
  // The desktop app names its session id to the session; a terminal has none.
  mock.env(on, surfaces.includes('desktop') ? { HOME, CLAUDE_CODE_HOST_SESSION_ID: 'host-me' } : { HOME })
  const files = new Map<string, string>([
    [`${HOME}/.claude/window-tint/repos.json`, JSON.stringify({ 'lab-notes': { icon: '🧪', color: '#7C3AED', pastIcons: ['🔬'] } })],
  ])
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/lab-notes' }))
  on('session.repo', () => ({ value: { root: '/work/lab-notes', remote: null, internal: false, name: null } }))
  on('session.surfaces', () => ({ value: surfaces as never }))
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
  on('process.run', () => ({ deny: 'not here' }))
  on('ui.status', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.run', () => ({ value: { text: '' } }) as never)
  on('tool.register', ($, e) => {
    options.onTool?.((e.inputSchema as { properties: Record<string, unknown> }).properties)
    return { value: { tool: `mcp__tint__${e.name}` } }
  })
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  return { clock, files, submitted }
}

for (const surface of ['desktop', 'terminal']) {
  test(`${surface}: no title note and no title, at any prompt, from anyone, for any title`, async ($, on) => {
    setup(on, [surface])
    await $.session.start({ cwd: '/work/lab-notes', surface: surface as never, isInteractive: true })
    for (const title of TITLES) {
      const start = await $.classic.SessionStart({ session_title: title } as never)
      expect(start.sessionTitle).toBeUndefined()
      expect(start.additionalContext ?? []).toEqual([])
    }
    // 12 rounds covers the old 2nd-then-every-5th rhythm (2, 7, 12) and the old one-off clean-up.
    for (let round = 1; round <= 12; round++) {
      for (const title of TITLES) {
        for (const source of [undefined, 'user', 'sdk', 'system']) {
          const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title, source } as never)
          expect(result.sessionTitle).toBeUndefined()
          expect(result.additionalContext ?? []).toEqual([])
        }
      }
    }
  })
}

test('the terminal strip shows the repo, never a window number; the slot still picks the shade', async ($, on) => {
  const { files } = setup(on, ['terminal'])
  // Another open window of lab-notes holds slot 1, so this window takes slot 2.
  files.set(`${HOME}/.claude/window-tint/windows/aaa.json`, JSON.stringify({ repo: 'lab-notes', n: 1, seen: 1_000_000, since: 1 }))
  await $.session.start({ cwd: '/work/lab-notes', surface: 'terminal', isInteractive: false })
  expect(JSON.parse(files.get(`${HOME}/.claude/window-tint/windows/me.json`)!).n).toBe(2)
  const strip = await $.ui.mount({
    plugin: 'tint', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} } as never,
  })
  const label = await strip.find({ type: 'Text', text: /LAB-NOTES/ })
  expect(label).toBeDefined()
  expect(await strip.find({ type: 'Text', text: /LAB-NOTES\s+\d/ })).toBeUndefined()
  // Window 2's shade, not the repo's own color (window 1).
  expect(String(label?.props.backgroundColor).toLowerCase()).not.toBe('#7c3aed')
  await strip.unmount()
})

test('/mod_tint name and /mod_tint titles are no longer commands: Claude is told tint does not name', async ($, on) => {
  const { clock, files, submitted } = setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const before = files.get(`${HOME}/.claude/window-tint/repos.json`)
  for (const args of ['name Backend', 'titles off']) {
    const answer = await $.command.run({ command: 'mod_tint', args, ...AT_PROMPT })
    await clock.settle()
    expect(answer.text).toBe('Claude will ask you what you want.')
  }
  expect(submitted.length).toBe(2)
  for (const prompt of submitted) {
    expect(prompt).toContain('Tint does not name or number windows or sessions')
    expect(prompt).not.toMatch(/set_session_title|window name|title upkeep|number \d/)
  }
  // Nothing was saved for the repo.
  expect(files.get(`${HOME}/.claude/window-tint/repos.json`)).toBe(before)
  // The help lists neither.
  const help = await $.command.run({ command: 'mod_tint', args: 'help', ...AT_PROMPT })
  expect(help.text).not.toMatch(/mod_tint name|mod_tint titles|a number/)
})

test('the set tool has no name or titles field', async ($, on) => {
  let schema: Record<string, unknown> = {}
  setup(on, ['desktop'], { onTool: properties => { schema = properties } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  expect(Object.keys(schema).sort()).toEqual(['color', 'frame', 'hidden', 'icon', 'pattern', 'undo'])
})
