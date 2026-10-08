import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const HOME = '/home/me'
// What the engine stamps on a command the person types at the prompt.
const AT_PROMPT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

function setup(on: Parameters<TestBody>[1], surfaces: string[]): void {
  mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME })
  const files = new Map<string, string>()
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
  on('fs.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.run', () => ({ value: { text: '' } }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.UserPromptSubmit', () => ({}))
}

test('desktop: Claude is asked about the title at prompt 2, then every 5th of your prompts', async ($, on) => {
  setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })

  const send = async (source?: string) => {
    const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: 'Fix login bug', source } as never)
    return (result.additionalContext ?? []).join('\n')
  }

  expect(await send()).toBe('')
  const second = await send('user')
  expect(second).toContain('mcp__ccd_session_mgmt__set_session_title')
  expect(second).toContain('"Fix login bug"')
  expect(second).toMatch(/"\S+1️⃣ <main topic>"/u)

  // Prompts 3 to 6 stay quiet; a wakeup or another session's message does not count.
  for (let i = 3; i <= 6; i++) expect(await send()).toBe('')
  expect(await send('system')).toBe('')
  expect(await send()).toContain('window-tint title check')

  // A window name fixes the title to that name.
  await $.command.run({ command: 'mod_tint', args: 'name Backend', ...AT_PROMPT })
  for (let i = 8; i <= 11; i++) await send()
  expect(await send()).toMatch(/exactly "\S+1️⃣ Backend"/u)

  // /mod_tint titles off stops the checks; on brings them back.
  await $.command.run({ command: 'mod_tint', args: 'titles off', ...AT_PROMPT })
  for (let i = 13; i <= 17; i++) expect(await send()).toBe('')
  await $.command.run({ command: 'mod_tint', args: 'titles on', ...AT_PROMPT })
  for (let i = 18; i <= 21; i++) await send()
  expect(await send()).toContain('window-tint title check')
})

test('a rename keeps the tint prefix when there is one, and never invents one', async ($, on) => {
  setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  const check = async (title: string) => {
    let note = ''
    for (let i = 0; i < 5 && !note; i++) {
      const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title } as never)
      note = (result.additionalContext ?? []).join('\n')
    }
    return note
  }

  // Prefix present: kept, only the name after it changes; an old-style prefix is stripped.
  const kept = await check('🟦🍉1️⃣ │ Mod ideas')
  expect(kept).toMatch(/Keep the window-tint prefix "\S+1️⃣ " in front/u)
  expect(kept).toContain('(now "Mod ideas")')
  expect(kept).toMatch(/"\S+1️⃣ <main topic>"/u)

  // Tint hidden: no prefix, and none added.
  await $.command.run({ command: 'mod_tint', args: 'off', ...AT_PROMPT })
  const bare = await check('Mod ideas')
  expect(bare).toContain('do not add an emoji or number')
  expect(bare).toContain('"<main topic>"')
  expect(bare).not.toMatch(/1️⃣/u)
})

test('terminal only: no rename tool, so no title checks', async ($, on) => {
  setup(on, ['terminal'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'terminal', isInteractive: true })
  for (let i = 1; i <= 7; i++) {
    const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: 'Fix login bug' } as never)
    expect(result.additionalContext ?? []).toEqual([])
  }
})
