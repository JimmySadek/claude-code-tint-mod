import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const HOME = '/home/me'
const DIR = `${HOME}/.claude/window-tint`
const AT_PROMPT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type World = {
  files: Map<string, string>
  asked: string[]
  footer: () => string | undefined
  clock: ReturnType<typeof mock.clock>
  runs: string[][]
  // What tint handed Claude as a prompt of its own (/mod_tint repick, a lone emoji...).
  submitted: string[]
}

// One window of `repoName`; `reply` is what the background model call answers.
// `measures` stands for the macOS emoji helper: what it prints per emoji. Left
// out, no command can run (not macOS), so the color is Claude's own.
function setup(
  on: Parameters<TestBody>[1], repoName: string, reply: string | null, saved: object = {},
  measures?: Record<string, string>, surfaces: string[] = ['desktop'],
): World {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME })
  const root = `/work/${repoName}`
  const files = new Map<string, string>([
    [`${DIR}/repos.json`, JSON.stringify(saved)],
    [`${root}/README.md`, `# ${repoName}\nA lab for trying Claude Code ideas.`],
  ])
  const asked: string[] = []
  let footer: string | undefined
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: root }))
  on('session.repo', () => ({ value: { root, remote: null, internal: false, name: null } }))
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
  on('model.complete', ($, e) => {
    asked.push(e.prompt)
    return {
      value: reply === null
        ? { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded_error', usage: USAGE }
        : { isAnswered: true, text: reply, usage: USAGE },
    } as never
  })
  const runs: string[][] = []
  let compiled = false
  if (measures) {
    on('process.run', ($, e) => {
      const argv = [...e.argv]
      runs.push(argv)
      const ok = (stdout = '') => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
      if (argv[0] === 'swiftc') compiled = true
      if (argv[0] === 'mv') { files.set(argv[3]!, files.get(argv[2]!)!); files.delete(argv[2]!) }
      if (!argv[0]!.endsWith('emoji-color-v1')) return ok()
      if (!compiled) return { deny: 'ENOENT' }
      return ok(measures[argv[1]!] ?? '{"color":null}')
    })
  }
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('ui.status', ($, e) => {
    footer = e.text
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__tint__${e.name}` } }))
  const submitted: string[] = []
  on('prompt.submit', ($, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.UserPromptSubmit', () => ({}))
  return { files, asked, footer: () => footer, clock, runs, submitted }
}

const saved = (world: World) => JSON.parse(world.files.get(`${DIR}/repos.json`)!)
const title = async ($: Parameters<TestBody>[0], current: string) =>
  (await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: current } as never)).sessionTitle
// Whether the window's label shows this mark first ("🧪  LAB-NOTES  1" in the terminal band):
// titles carry no repository emoji, so the label is where a window's emoji shows.
const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const
const shows = async ($: Parameters<TestBody>[0], mark: string | RegExp) => {
  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  const found = await ui.find({ type: 'Text', text: typeof mark === 'string' ? new RegExp(`^${mark}  \\S`, 'u') : mark })
  await ui.unmount()
  return found !== undefined
}

test('first window of a repo: Claude picks an emoji and exact color once, and it is saved', { options: { frame: true } }, async ($, on) => {
  // The reply as Haiku really sends it: fenced, with the "about" field first.
  const world = setup(on, 'repo-fit', '```json\n{"about": "Organizes repos", "emoji": "📐", "color": "#2563eb"}\n```', {
    'lab-notes': { icon: '🧪', color: '#7C3AED' },
  })
  await $.session.start({ cwd: '/work/repo-fit', surface: 'desktop', isInteractive: true })
  await world.clock.settle()

  // Claude saw the repo and the identities other repos already use.
  expect(world.asked.length).toBe(1)
  expect(world.asked[0]).toContain('repo-fit')
  expect(world.asked[0]).toContain('A lab for trying Claude Code ideas.')
  expect(world.asked[0]).toContain('lab-notes: 🧪 #7C3AED')

  expect(saved(world)['repo-fit']).toEqual({ icon: '📐', color: '#2563EB' })
  // Meaning only: the emoji in the window's label, none in the title, no status line under the prompt.
  expect(world.footer()).toBeUndefined()
  expect(await shows($, '📐')).toBe(true)
  expect(await shows($, '🧪')).toBe(false)
  expect(await title($, 'Fit the layout')).toBe('Fit the layout')

  // The exact color draws the border around your own message (window 1), once turned on.
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  const message = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'hello', origin: { kind: 'composer' }, isExpanded: true } as never,
  })
  expect((await message.find({ key: 'tint-frame' }))?.props.borderColor).toBe('#2563EB')
  await message.unmount()

  // Picked once: the next session of the repo does not ask again.
  await $.session.start({ cwd: '/work/repo-fit', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(world.asked.length).toBe(1)
})

test('a manual color is kept; Claude only adds the missing emoji', async ($, on) => {
  const world = setup(on, 'lab-notes', '{"emoji":"🧪","color":"#7C3AED"}', { 'lab-notes': { color: 'orange' } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world)['lab-notes']).toEqual({ color: 'orange', icon: '🧪' })
  expect(await shows($, '🧪')).toBe(true)
})

test('when the pick fails, the hashed color shows and nothing is saved', async ($, on) => {
  const world = setup(on, 'matchday', null)
  await $.session.start({ cwd: '/work/matchday', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world)).toEqual({})
  // Never blank: the hashed color's square in the label; the title stays as it is.
  expect(await shows($, /^\S+  MATCHDAY/u)).toBe(true)
  expect(await title($, 'Brand work')).toBe('Brand work')
})

test('a scripted run (claude -p) never asks Claude for an identity', async ($, on) => {
  const world = setup(on, 'scratch', '{"emoji":"📝","color":"#3B82F6"}')
  await $.session.start({ cwd: '/work/scratch', surface: 'terminal', isInteractive: false })
  await world.clock.settle()
  expect(world.asked.length).toBe(0)
  expect(saved(world)).toEqual({})
})

test('desktop app (an SDK session): the first prompt picks the identity, once', async ($, on) => {
  const world = setup(on, 'notes-app', '{"emoji":"📝","color":"#2563EB"}')
  // The desktop app starts sessions through the SDK: no person at the prompt yet.
  await $.session.start({ cwd: '/work/notes-app', surface: null, isInteractive: false })
  await world.clock.settle()
  expect(world.asked.length).toBe(0)

  await title($, 'First message')
  await world.clock.settle()
  expect(world.asked.length).toBe(1)
  expect(saved(world)['notes-app']).toEqual({ icon: '📝', color: '#2563EB' })

  await title($, 'Second message')
  await world.clock.settle()
  expect(world.asked.length).toBe(1)
})

test('a scripted run that draws nowhere never picks, even on prompts', async ($, on) => {
  const world = setup(on, 'scratch', '{"emoji":"📝","color":"#3B82F6"}', {}, undefined, [])
  await $.session.start({ cwd: '/work/scratch', surface: null, isInteractive: false })
  await title($, 'A scripted prompt')
  await world.clock.settle()
  expect(world.asked.length).toBe(0)
  expect(saved(world)).toEqual({})
})

test('a reply that is not one emoji and one hex color is refused', async ($, on) => {
  const world = setup(on, 'matchday', '{"emoji":"red","color":"crimson"}')
  await $.session.start({ cwd: '/work/matchday', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world)).toEqual({})
})

test('overrides: /mod_tint color #hex and icon; each keeps the look before it, and undo goes back', async ($, on) => {
  const world = setup(on, 'matchday', '{"emoji":"⚽","color":"#E30613"}', { matchday: { icon: '🟩', color: 'green' } })
  await $.session.start({ cwd: '/work/matchday', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  // A full saved identity is never re-asked on its own.
  expect(world.asked.length).toBe(0)

  await $.command.run({ command: 'mod_tint', args: 'color #111827' } as never)
  await $.command.run({ command: 'mod_tint', args: 'icon 🏟️' } as never)
  expect(saved(world).matchday).toEqual({
    icon: '🏟️', color: '#111827', manualColor: true,
    previous: { icon: '🟩', color: '#111827', manualColor: true },
    pastIcons: ['🟩'],
  })
  expect(await shows($, '🏟️')).toBe(true)

  // Undo goes one step back; a second undo swaps again.
  const back = await $.command.run({ command: 'mod_tint', args: 'undo' } as never)
  expect(back.text).toContain('🟩 · #111827')
  expect(saved(world).matchday.icon).toBe('🟩')
  expect(await shows($, '🟩')).toBe(true)
  await $.command.run({ command: 'mod_tint', args: 'undo' } as never)
  expect(saved(world).matchday.icon).toBe('🏟️')
  // No picker call and no prompt for Claude: these are clear commands.
  expect(world.asked.length).toBe(0)
  expect(world.submitted).toEqual([])
})

test('repick: Claude is asked to offer a few fitting looks; nothing changes until one is chosen', async ($, on) => {
  const world = setup(on, 'Claude-Labs', null, {
    'Claude-Labs': { icon: '🧭', color: '#E82F32', previous: { icon: '🧪', color: '#259F3E' } },
    'animation-lab': { icon: '🎞️', color: '#E8772E' },
  })
  await $.session.start({ cwd: '/work/Claude-Labs', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  const answer = await $.command.run({ command: 'mod_tint', args: 'repick' } as never)
  await world.clock.settle()
  expect(answer.text).toBe('Claude will ask you what you want.')
  expect(world.asked.length).toBe(0)
  expect(saved(world)['Claude-Labs'].icon).toBe('🧭')

  const prompt = world.submitted.at(-1)!
  expect(prompt).toContain('"/mod_tint repick"')
  expect(prompt).toContain('offer 3 new looks')
  expect(prompt).toContain('🧭 · #E82F32 (red)')
  expect(prompt).toContain('Look before the last change: 🧪 · #259F3E (green)')
  expect(prompt).toContain('animation-lab: 🎞️ · #E8772E')
  expect(prompt).toContain('AskUserQuestion')
  expect(prompt).toContain('mcp__tint__set')
})

test('unclear words, a lone emoji or nothing at all go to Claude, never to a guess', async ($, on) => {
  const world = setup(on, 'lab-notes', null, { 'lab-notes': { icon: '🧭', color: '#E82F32' } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  for (const args of ['🧪', 'go back', 'color blurple', '']) {
    const answer = await $.command.run({ command: 'mod_tint', args } as never)
    await world.clock.settle()
    expect(answer.text).toBe('Claude will ask you what you want.')
  }
  expect(world.submitted.length).toBe(4)
  expect(world.submitted[0]).toContain('"/mod_tint 🧪"')
  expect(world.submitted[0]).toContain('A lone emoji most likely means a new emoji for the repository')
  expect(world.submitted[3]).toContain('"/mod_tint"')
  expect(world.submitted[3]).toContain('They did not say what to change')
  // Nothing was applied: not the emoji, and not a window named "🧪".
  expect(saved(world)['lab-notes']).toEqual({ icon: '🧭', color: '#E82F32' })
  expect(await shows($, '🧭')).toBe(true)
})

test('a scripted run that draws nowhere gets the help instead of a prompt for Claude', async ($, on) => {
  const world = setup(on, 'scratch', null, {}, undefined, [])
  await $.session.start({ cwd: '/work/scratch', surface: null, isInteractive: false })
  const answer = await $.command.run({ command: 'mod_tint', args: '🧪' } as never)
  expect(answer.text).toContain('| Command | What it does |')
  expect(world.submitted).toEqual([])
})

test('the set tool applies what the person chose: emoji with its measured color, window name, undo', async ($, on) => {
  const world = setup(on, 'Claude-Labs', null, { 'Claude-Labs': { icon: '🧭', color: '#E82F32' } }, { '🧪': GREEN })
  await $.session.start({ cwd: '/work/Claude-Labs', surface: 'desktop', isInteractive: true })
  await world.clock.settle()

  const set = (input: object) => $.tool.call({ tool: 'mcp__tint__set', ...input } as never)
  const picked = await set({ icon: '🧪' })
  expect(String(picked.result)).toContain('Claude-Labs is now 🧪 · #259F3E (green)')
  expect(saved(world)['Claude-Labs']).toEqual({ icon: '🧪', color: '#259F3E', previous: { icon: '🧭', color: '#E82F32' }, pastIcons: ['🧭'] })
  expect(await shows($, '🧪')).toBe(true)

  // A name is this window's alone, so the answer does not talk about other windows.
  const named = await set({ name: 'Mods' })
  expect(String(named.result)).toBe('This window is named "Mods".')
  expect(String(picked.result)).toContain('Other windows of the repository follow')
  expect(await title($, 'Work')).toBe('Mods')
  await set({ name: '' })
  expect(await title($, 'Work')).toBe('Work')

  await set({ undo: true })
  expect(saved(world)['Claude-Labs'].icon).toBe('🧭')

  // A color the person chose is theirs: it stays when the emoji changes later.
  await set({ color: 'teal' })
  await set({ icon: '🧪' })
  expect(saved(world)['Claude-Labs']).toMatchObject({ icon: '🧪', color: 'teal', manualColor: true })

  // Bad input is refused, and nothing changes.
  expect((await set({ color: 'blurple' })).deny).toContain('#RRGGBB')
  expect(saved(world)['Claude-Labs'].color).toBe('teal')
})

test('titles drop a repository\'s emoji and the old number; role marks and other emoji stay', async ($, on) => {
  const world = setup(on, 'lab-notes', null, { 'lab-notes': { icon: '🧪', color: '#7C3AED' } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()

  // The form before 1.9.0, whatever emoji and number it had, loses both.
  expect(await title($, '🟧1️⃣ Mod ideas')).toBe('Mod ideas')
  expect(await title($, '🧪1️⃣ Mod ideas')).toBe('Mod ideas')
  expect(await title($, '🦊3️⃣ Mod ideas')).toBe('Mod ideas')
  expect(await title($, '🧪12 Mod ideas')).toBe('Mod ideas')
  // The form from 1.9.0 to 1.11 loses the repo's emoji; a plain title stays plain.
  expect(await title($, '🧪 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  expect(await title($, 'Lab · Mod ideas')).toBe('Lab · Mod ideas')
  // A title that merely starts with an emoji and a number is no old prefix: two plain digits
  // count only after a repository's emoji (a keycap after any emoji).
  expect(await title($, '🔥2024 recap')).toBe('🔥2024 recap')
  expect(await title($, '🔥20 recap')).toBe('🔥20 recap')
  // An emoji no repository has is the title's own, a flag or a skin tone too.
  expect(await title($, '🇩🇪 Berlin · Launch')).toBe('🇩🇪 Berlin · Launch')
  expect(await title($, '👍🏽 Lab · Thanks')).toBe('👍🏽 Lab · Thanks')
  expect(await title($, '📚 BAM · Templates')).toBe('📚 BAM · Templates')
  // Role marks another session gave it at birth stay: side chat, helper. A repo emoji after one goes.
  expect(await title($, '💬 Lab · Why 0.4?')).toBe('💬 Lab · Why 0.4?')
  expect(await title($, '💬 🧪 Lab · Why 0.4?')).toBe('💬 Lab · Why 0.4?')
  expect(await title($, '🔧 one-repo · Wrap fix')).toBe('🔧 one-repo · Wrap fix')
  // A color square (before an emoji was picked) is tint's own placeholder: dropped.
  expect(await title($, '🟥 Lab · Mod ideas')).toBe('Lab · Mod ideas')

  // Every emoji the repo had is dropped too, after a new emoji, a color change and another one.
  await $.command.run({ command: 'mod_tint', args: 'icon 🔬' } as never)
  expect(await title($, '🧪 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  expect(await title($, '🔬 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  await $.command.run({ command: 'mod_tint', args: 'color teal' } as never)
  await $.command.run({ command: 'mod_tint', args: 'icon 🧫' } as never)
  expect(await title($, '🧪 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  expect(await title($, '🔬 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  // Another repository's emoji is a repository's too (a work room named with it at birth): dropped.
  const now = saved(world)
  world.files.set(`${DIR}/repos.json`, JSON.stringify({ ...now, 'BAM-Knowledge': { icon: '📚', color: '#22C55E' } }))
  await world.clock.advance(31_000)
  expect(await title($, '📚 BAM · Templates')).toBe('BAM · Templates')
  // With or without its presentation selector, an emoji is the same.
  world.files.set(`${DIR}/repos.json`, JSON.stringify({ ...now, tint: { icon: '🖌️', color: '#EC4899' } }))
  await world.clock.advance(31_000)
  expect(await title($, '🖌 Tint · Thread titles')).toBe('Tint · Thread titles')
  expect(await title($, '💬 BAM · Why 0.4?')).toBe('💬 BAM · Why 0.4?')
  world.files.set(`${DIR}/repos.json`, JSON.stringify(now))
  await world.clock.advance(30_000)
  // And after a reset, the past emoji are still known.
  await $.command.run({ command: 'mod_tint', args: 'reset' } as never)
  expect(saved(world)['lab-notes'].pastIcons).toEqual(['🧪', '🔬', '🧫'])
  expect(await title($, '🧫 Lab · Mod ideas')).toBe('Lab · Mod ideas')
  await $.command.run({ command: 'mod_tint', args: 'icon 🔬' } as never)

  // A window name keeps the title's role mark, and adds no emoji.
  await $.command.run({ command: 'mod_tint', args: 'name Backend' } as never)
  expect(await title($, '💬 Lab · Why 0.4?')).toBe('💬 Backend')
  expect(await title($, 'Mod ideas')).toBe('Backend')
  expect(await title($, '🔬 Lab · Mod ideas')).toBe('Backend')

  // Tint hidden: the title is left as it is.
  await $.command.run({ command: 'mod_tint', args: 'off' } as never)
  expect(await title($, '🟧1️⃣ Mod ideas')).toBeUndefined()
})

test('the rename note drops the repo emoji and the old number, and adds none', async ($, on) => {
  const world = setup(on, 'lab-notes', null, { 'lab-notes': { icon: '🧪', color: '#7C3AED' } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  const noteFor = async (current: string) =>
    ((await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: current } as never)).additionalContext ?? []).join('\n')
  const old = await noteFor('🟧1️⃣ Mod ideas')
  expect(old).toContain('Drop the emoji and old window number at its start')
  expect(old).toContain('(now "Mod ideas")')
  expect(old).toContain('"<Project> · <main topic>"')
  expect(old).not.toContain('🧪')
  const marked = await noteFor('🧪 Lab · Mod ideas')
  expect(marked).toContain('Drop the leading "🧪"')
  expect(marked).toContain('(now "Lab · Mod ideas")')
  // A past emoji, and a repo emoji after a role mark, are asked about too.
  await $.command.run({ command: 'mod_tint', args: 'icon 🔬' } as never)
  expect(await noteFor('🧪 Lab · Old emoji')).toContain('Drop the leading "🧪"')
  const side = await noteFor('💬 🔬 Lab · Why')
  expect(side).toContain('Keep its leading "💬" as it is')
  expect(side).toContain('Drop the "🔬" after "💬" and keep the words (now "Lab · Why")')
  expect(side).toContain('"💬 <Project> · <main topic>"')
  // With a window name the note never says to keep the old words.
  await $.command.run({ command: 'mod_tint', args: 'name Backend' } as never)
  const named = await noteFor('🔬 Lab · Login')
  expect(named).toContain('Drop the leading "🔬" at its start; add no other emoji.')
  expect(named).not.toContain('keep the words')
  expect(named).toContain('exactly "Backend"')
})

test('an unreadable repos.json is never written over; saves go to a temporary file, then rename', async ($, on) => {
  const world = setup(on, 'lab-notes', '{"emoji":"🧪","color":"#7C3AED"}', {}, {})
  // Half a file, as a crash in the middle of an older write could leave it.
  const broken = '{\n  "matchday": { "icon": "⚽", "color": "#22C55E" },\n  "lab-no'
  world.files.set(`${DIR}/repos.json`, broken)
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  // The background pick does not even ask Claude: it could not keep the answer.
  expect(world.asked.length).toBe(0)
  expect(world.files.get(`${DIR}/repos.json`)).toBe(broken)

  const typed = await $.command.run({ command: 'mod_tint', args: 'icon 🔬', ...AT_PROMPT })
  expect(typed.text).toContain('cannot be read')
  const tool = await $.tool.call({ tool: 'mcp__tint__set', color: 'teal' } as never)
  expect((tool as { deny?: string }).deny).toContain('cannot be read')
  expect(world.files.get(`${DIR}/repos.json`)).toBe(broken)

  // Fixed by hand: the next save works, whole, through a temporary file renamed over it.
  world.files.set(`${DIR}/repos.json`, JSON.stringify({ matchday: { icon: '⚽', color: '#22C55E' } }))
  await $.command.run({ command: 'mod_tint', args: 'icon 🔬', ...AT_PROMPT })
  expect(saved(world)).toMatchObject({ matchday: { icon: '⚽' }, 'lab-notes': { icon: '🔬' } })
  expect(world.runs).toContainEqual(['mv', '-f', `${DIR}/repos.json.me.tmp`, `${DIR}/repos.json`])
  expect([...world.files.keys()].some(path => path.endsWith('.tmp'))).toBe(false)
})

test('an icon must be one emoji, and never a mark for side chats or helpers', async ($, on) => {
  const world = setup(on, 'lab-notes', null, { 'lab-notes': { icon: '🧪', color: '#7C3AED' } })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  const before = world.files.get(`${DIR}/repos.json`)
  for (const wrong of ['CL', '🧪🧪', 'new emoji please']) {
    expect((await $.command.run({ command: 'mod_tint', args: `icon ${wrong}`, ...AT_PROMPT })).text).toContain('is not one emoji')
    expect(((await $.tool.call({ tool: 'mcp__tint__set', icon: wrong } as never)) as { deny?: string }).deny).toContain('is not one emoji')
  }
  expect((await $.command.run({ command: 'mod_tint', args: 'icon 💬', ...AT_PROMPT })).text).toContain('marks a side chat')
  expect(((await $.tool.call({ tool: 'mcp__tint__set', icon: '🔧' } as never)) as { deny?: string }).deny).toContain('marks a helper')
  expect(world.files.get(`${DIR}/repos.json`)).toBe(before)
  expect(await shows($, '🧪')).toBe(true)

  // An icon saved by hand that is not one emoji never reaches the label: the color square shows.
  world.files.set(`${DIR}/repos.json`, JSON.stringify({ 'lab-notes': { icon: 'CL', color: '#7C3AED' } }))
  await world.clock.advance(31_000)
  expect(await shows($, '🟪')).toBe(true)
})

test('Claude never picks 💬 or 🔧 for a repository', async ($, on) => {
  const world = setup(on, 'repo-tools', '{"emoji":"🔧","color":"#D97706"}')
  await $.session.start({ cwd: '/work/repo-tools', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(world.asked[0]).toContain('not 💬 or 🔧')
  expect(saved(world)['repo-tools']).toBeUndefined()
})

const GREEN = '{"color":"#259F3E","share":0.99,"saturation":0.77,"brightness":0.63}'
const DULL = '{"color":"#6C8B9C","share":0.99,"saturation":0.31,"brightness":0.61}'

test('measured: a vivid emoji gives the color, compiled once and kept per emoji', { options: { frame: true } }, async ($, on) => {
  const world = setup(on, 'lab-notes', '{"emoji":"🧪","color":"#D97706"}', {}, { '🧪': GREEN })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()

  // The test tube is green on macOS, so Claude's amber gives way to it.
  expect(saved(world)['lab-notes']).toEqual({ icon: '🧪', color: '#259F3E' })
  expect(JSON.parse(world.files.get(`${DIR}/emoji-colors.json`)!)).toEqual({ '🧪': '#259F3E' })
  // The helper was built from the mod's own source, then run with the emoji.
  const compile = world.runs.find(argv => argv[0] === 'swiftc')!
  expect(compile[2]).toMatch(/helpers\/emoji-color\.swift$/)
  expect(world.runs.filter(argv => argv[0]!.endsWith('emoji-color-v1')).at(-1)).toEqual([`${DIR}/emoji-color-v1`, '🧪'])

  // The exact measured color draws the border.
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  const message = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'hello', origin: { kind: 'composer' }, isExpanded: true } as never,
  })
  expect((await message.find({ key: 'tint-frame' }))?.props.borderColor).toBe('#259F3E')
  await message.unmount()
})

test('fallback: a dull emoji keeps Claude\'s color, and the dull result is remembered', async ($, on) => {
  const world = setup(on, 'lab-tools', '{"emoji":"🔬","color":"#0891B2"}', {}, { '🔬': DULL })
  await $.session.start({ cwd: '/work/lab-tools', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world)['lab-tools']).toEqual({ icon: '🔬', color: '#0891B2' })
  expect(JSON.parse(world.files.get(`${DIR}/emoji-colors.json`)!)).toEqual({ '🔬': null })
})

test('fallback: an emoji with no color (⚽) keeps Claude\'s color', async ($, on) => {
  const world = setup(on, 'matchday', '{"emoji":"⚽","color":"#E30613"}', {}, {})
  await $.session.start({ cwd: '/work/matchday', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world).matchday).toEqual({ icon: '⚽', color: '#E30613' })
})

test('fallback: no helper (not macOS) keeps Claude\'s color and caches nothing', async ($, on) => {
  const world = setup(on, 'lab-notes', '{"emoji":"🧪","color":"#D97706"}')
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()
  expect(saved(world)['lab-notes']).toEqual({ icon: '🧪', color: '#D97706' })
  expect(world.files.has(`${DIR}/emoji-colors.json`)).toBe(false)
})

test('manual color wins over the emoji; without one, a new emoji brings its color', async ($, on) => {
  const world = setup(on, 'lab-notes', '{"emoji":"🧪","color":"#D97706"}', { 'lab-notes': { icon: '📐', color: '#8298B0' } }, {
    '🧪': GREEN,
  })
  await $.session.start({ cwd: '/work/lab-notes', surface: 'desktop', isInteractive: true })
  await world.clock.settle()

  // /mod_tint color is yours: a new emoji afterwards leaves it alone.
  await $.command.run({ command: 'mod_tint', args: 'color #111827' } as never)
  await $.command.run({ command: 'mod_tint', args: 'icon 🧪' } as never)
  expect(saved(world)['lab-notes']).toMatchObject({ icon: '🧪', color: '#111827', manualColor: true })

  // Without a manual color, a new emoji brings its own color.
  await $.command.run({ command: 'mod_tint', args: 'reset' } as never)
  await $.command.run({ command: 'mod_tint', args: 'icon 🧪' } as never)
  expect(saved(world)['lab-notes'].color).toBe('#259F3E')

})
