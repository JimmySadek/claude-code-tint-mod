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

  const send = async (source?: string, title = 'Lab · Login bug') => {
    const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title, source } as never)
    return (result.additionalContext ?? []).join('\n')
  }

  expect(await send()).toBe('')
  const second = await send('user')
  expect(second).toContain('mcp__ccd_session_mgmt__set_session_title')
  expect(second).toContain('"Lab · Login bug"')
  expect(second).toContain('"<Project> · <main topic>"')
  expect(second).toContain("Emoji: none for this folder's own project (lab-notes;")
  expect(second).toContain('never guess one')
  expect(second).toContain('no window number')
  expect(second).not.toMatch(/1️⃣|🟦/u)

  // Prompts 3 to 6 stay quiet; a wakeup or another session's message does not count.
  for (let i = 3; i <= 6; i++) expect(await send()).toBe('')
  expect(await send('system')).toBe('')
  expect(await send()).toContain('window-tint title check')

  // A window name fixes the title to that name.
  await $.command.run({ command: 'mod_tint', args: 'name Backend', ...AT_PROMPT })
  for (let i = 8; i <= 11; i++) await send()
  expect(await send()).toContain('exactly "Backend"')

  // /mod_tint titles off stops the checks; on brings them back.
  await $.command.run({ command: 'mod_tint', args: 'titles off', ...AT_PROMPT })
  for (let i = 13; i <= 17; i++) expect(await send()).toBe('')
  expect(await send('system', 'Fix login bug')).toBe('')
  await $.command.run({ command: 'mod_tint', args: 'titles on', ...AT_PROMPT })
  for (let i = 18; i <= 21; i++) await send()
  expect(await send()).toContain('window-tint title check')
})

test('a title that starts with a repo emoji is cleaned once, whoever sent the prompt (a work room)', async ($, on) => {
  setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  const send = async (title: string, source = 'sdk') =>
    ((await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title, source } as never)).additionalContext ?? []).join('\n')

  // The parent session's message is enough: a work room never reaches your own prompt count.
  const clean = await send('🟦 Templates 0.4')
  expect(clean).toContain('Drop the leading "🟦"')
  expect(clean).toContain('(now "Templates 0.4")')
  expect(clean).toContain('The title still starts with that emoji')
  // Asked once: a title Claude cannot rename (one you typed) is not asked about again.
  expect(await send('🟦 Templates 0.4')).toBe('')
  // The old keycap form: emoji and number go, the words stay.
  const old = await send('🦊3️⃣ Templates 0.4')
  expect(old).toContain('Drop the emoji and old window number')
  expect(old).toContain('(now "Templates 0.4")')
  // A title with no emoji has nothing to clean.
  expect(await send('Lab · Templates 0.4')).toBe('')
  // No title yet: nothing to clean.
  expect(((await $.classic.UserPromptSubmit({ prompt: 'hi', source: 'sdk' } as never)).additionalContext ?? [])).toEqual([])
})

test('a title that starts with a role mark or an emoji of its own keeps it', async ($, on) => {
  setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  const note = async (title: string) => {
    let text = ''
    for (let i = 0; i < 5 && !text; i++) {
      const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title } as never)
      text = (result.additionalContext ?? []).join('\n')
    }
    return text
  }
  for (const [title, mark] of [['💬 BAM · Why 0.4?', '💬'], ['🔧 one-repo · Wrap fix', '🔧'], ['📚 BAM · Templates', '📚']] as const) {
    // No fill note on any source: the mark is the starting session's choice.
    const quiet = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: title, source: 'sdk' } as never)
    expect(quiet.additionalContext ?? []).toEqual([])
    // The scheduled check keeps it and changes only the words.
    const kept = await note(title)
    expect(kept).toContain(`Keep its leading "${mark}" as it is`)
    expect(kept).toContain(`"${mark} <Project> · <main topic>"`)
    expect(kept).not.toContain('Drop the')
  }
})

test('with the tint hidden, the note is the same: no emoji is added, a role mark stays', async ($, on) => {
  setup(on, ['desktop'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'mod_tint', args: 'off', ...AT_PROMPT })
  const send = async (source?: string) =>
    ((await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: 'Mod ideas', source } as never)).additionalContext ?? []).join('\n')
  expect(await send('sdk')).toBe('')
  expect(await send()).toBe('')
  const due = await send()
  expect(due).toContain('Do not add an emoji or a number')
  expect(due).toContain('"<Project> · <main topic>"')
  expect(due).not.toMatch(/🟦/u)
  for (let i = 0; i < 4; i++) await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: '💬 BAM · Why 0.4?' } as never)
  const marked = ((await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: '💬 BAM · Why 0.4?' } as never)).additionalContext ?? []).join('\n')
  expect(marked).toContain('Keep its leading "💬" as it is')
  expect(marked).toContain('"💬 <Project> · <main topic>"')
})

test('terminal only: no rename tool, so no title checks', async ($, on) => {
  setup(on, ['terminal'])
  await $.session.start({ cwd: '/work/lab-notes', surface: 'terminal', isInteractive: true })
  for (let i = 1; i <= 7; i++) {
    const result = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: 'Fix login bug' } as never)
    expect(result.additionalContext ?? []).toEqual([])
  }
})
