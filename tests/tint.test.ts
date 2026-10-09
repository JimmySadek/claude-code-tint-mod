import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const
// The desktop footer beside the mode labels, where the colors label sits.
const FOOTER = { component: 'SessionMode', props: { modes: [] } } as const
const HOME = '/home/me'
// What the engine stamps on a command the person types at the prompt.
const AT_PROMPT = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const DIR = `${HOME}/.claude/window-tint`

test('second window of a repo gets #2, same color, and /mod_tint works', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { HOME })

  // A fake shared folder: another window of claude-mods is already open as #1.
  const files = new Map<string, string>([
    [`${DIR}/windows/other.json`, JSON.stringify({ repo: 'claude-mods', n: 1, seen: 990_000 })],
    [`${DIR}/windows/old.json`, JSON.stringify({ repo: 'claude-mods', n: 2, seen: 1 })],
  ])
  on('session.id', () => ({ value: 'me' }))
  on('session.cwd', () => ({ value: '/work/claude-mods-wt' }))
  on('session.repo', () => ({
    value: { root: '/work/claude-mods-wt', remote: 'git@github.com:Me/claude-mods.git', internal: false, name: null },
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
      .filter(p => p.startsWith(`${e.path}/`))
      .map(p => ({ name: p.slice(e.path.length + 1), kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  let footer: string | undefined
  on('ui.status', ($, e) => {
    footer = e.text
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.UserPromptSubmit', () => ({}))

  await $.session.start({ cwd: '/work/claude-mods-wt', surface: 'desktop', isInteractive: true })

  // The stale #2 (seen long ago) is free again, so this window is #2.
  expect(JSON.parse(files.get(`${DIR}/windows/me.json`)!).n).toBe(2)

  const term = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await term.find({ type: 'Text', text: /CLAUDE-MODS\s+2/ })).toBeDefined()
  await term.unmount()
  // Desktop: nothing above the prompt (the app would wrap it in an empty card). The 1-pixel
  // picture whose label hands the desktop script every repo's chosen look sits in the footer.
  const noBand = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...BAND })
  expect(await noBand.find({ type: 'Svg' })).toBeUndefined()
  await noBand.unmount()
  const footerTag = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...FOOTER })
  const tag = await footerTag.find({ type: 'Svg' })
  expect(tag?.props.width).toBe(1)
  expect(tag?.props.height).toBe(1)
  expect(String(tag?.props.alt)).toStartWith('tint-colors {')
  // The window's own repo and number, so the desktop script knows it with the sidebar hidden.
  expect(JSON.parse(String(tag?.props.alt).slice('tint-colors '.length)).window).toEqual(['claude-mods', 2])
  await footerTag.unmount()
  // No strip on messages any more.
  const message = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'hello', origin: { kind: 'composer' }, isFull: true } as never,
  })
  expect(await message.find({ type: 'Svg' })).toBeUndefined()
  await message.unmount()

  await $.command.run({ command: 'mod_tint', args: 'name Backend', ...AT_PROMPT })
  await $.command.run({ command: 'mod_tint', args: 'color teal', ...AT_PROMPT })
  await $.command.run({ command: 'mod_tint', args: 'pattern waves', ...AT_PROMPT })
  // The color just chosen is in the picture's label at once, under the repo's name and its
  // folder's, so the saved desktop script shows it without being saved again.
  const live = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...FOOTER })
  const label = JSON.parse(String((await live.find({ type: 'Svg' }))?.props.alt).slice('tint-colors '.length)).repos
  expect(label['claude-mods'][0]).toBe('#14B8A6')
  expect(label['claude-mods-wt'][0]).toBe('#14B8A6')
  await live.unmount()
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].pattern).toBe('waves')
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].color).toBe('teal')

  const ui = await $.ui.mount({ plugin: 'tint', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /CLAUDE-MODS\s+2\s+·\s+Backend/ })).toBeDefined()
  await ui.press({ key: 'next' })
  await ui.unmount()
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].color).toBe('cyan')

  // Heartbeat keeps this window counted.
  await clock.advance(31_000)
  expect(JSON.parse(files.get(`${DIR}/windows/me.json`)!).seen).toBe(1_030_000)

  // No status line under the prompt any more.
  expect(footer).toBeUndefined()

  // The split header's title gets the color square and number, no icon or divider.
  const named = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: '🟦🍉1️⃣ │ Old work' } as never)
  expect(named.sessionTitle).toBe('🟦2️⃣ Backend')
  await $.command.run({ command: 'mod_tint', args: 'name', ...AT_PROMPT })
  const plain = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: '🟦🍉1️⃣ │ Old work' } as never)
  expect(plain.sessionTitle).toBe('🟦2️⃣ Old work')
  // A title that already carries the new prefix does not get it twice.
  const again = await $.classic.UserPromptSubmit({ prompt: 'hi', session_title: '🟧1️⃣ Old work' } as never)
  expect(again.sessionTitle).toBe('🟦2️⃣ Old work')

  // No border around your messages at first; /mod_tint frame on adds one.
  const mine = { text: 'hello', origin: { kind: 'composer' }, isExpanded: true } as never
  const plainFirst = await $.ui.mount({ plugin: 'tint', surface: 'desktop', component: 'UserMessage', props: mine })
  expect(await plainFirst.find({ key: 'tint-frame' })).toBeUndefined()
  await plainFirst.unmount()
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].frame).toBe(true)
  // Your own message gets a border; a notice and Claude's reply do not.
  const framed = await $.ui.mount({ plugin: 'tint', surface: 'desktop', component: 'UserMessage', props: mine })
  expect(await framed.find({ key: 'tint-frame' })).toBeDefined()
  await framed.unmount()
  // No width on the frame: the desktop refuses any width around its own bubble.
  const short = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'ok', origin: { kind: 'composer' }, isExpanded: true } as never,
    viewport: { columns: 100, rows: 40 },
  })
  const frameProps = (await short.find({ key: 'tint-frame' }))?.props ?? {}
  expect(frameProps.width).toBeUndefined()
  expect(frameProps.minWidth).toBeUndefined()
  await short.unmount()
  const notice = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'note', origin: { kind: 'unclassified' }, isExpanded: true } as never,
  })
  expect(await notice.find({ key: 'tint-frame' })).toBeUndefined()
  await notice.unmount()

  // /mod_tint frame off is saved for the repo and removes the border.
  await $.command.run({ command: 'mod_tint', args: 'frame off', ...AT_PROMPT })
  expect(JSON.parse(files.get(`${DIR}/repos.json`)!)['claude-mods'].frame).toBe(false)
  const unframed = await $.ui.mount({ plugin: 'tint', surface: 'desktop', component: 'UserMessage', props: mine })
  expect(await unframed.find({ key: 'tint-frame' })).toBeUndefined()
  await unframed.unmount()
  await $.command.run({ command: 'mod_tint', args: 'frame on', ...AT_PROMPT })

  await $.command.run({ command: 'mod_tint', args: 'off', ...AT_PROMPT })
  const hidden = await $.ui.mount({
    plugin: 'tint', surface: 'desktop', component: 'UserMessage',
    props: { text: 'hello', origin: { kind: 'composer' }, isFull: true } as never,
  })
  expect(await hidden.find({ type: 'Svg' })).toBeUndefined()
  await hidden.unmount()
  // Hidden: no picture above the prompt either.
  const hiddenBand = await $.ui.mount({ plugin: 'tint', surface: 'desktop', ...FOOTER })
  expect(await hiddenBand.find({ type: 'Svg' })).toBeUndefined()
  await hiddenBand.unmount()
})
