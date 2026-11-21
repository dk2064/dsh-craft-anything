/**
 * Security + behaviour audit of the plugin half, without DSH:
 *
 *  - the registered tool surface and its per-step schema size
 *  - `craft_tool` rejects recursive names, malformed names, and forwarded
 *    Harness tools
 *  - `craft_tool` asks the approval service before a state-changing tool and
 *    refuses unless the outcome is `allowed-once`
 *  - the stage observer advances on a *forwarded* tool call, not only on a
 *    first-class one
 *
 * Usage: node tools/plugin-smoke.mjs [exePath]
 *        APPROVE_DANGEROUS=1 node tools/plugin-smoke.mjs   # approval grants
 */
import { apply } from '../index.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'

const exe = process.argv[2] ?? process.env.CRAFT_ANYTHING_CLI ?? join(homedir(), '.dsh', 'tools', 'craft-anything', 'craft-anything-cli.exe')

const registered = []
const sections = []
const listeners = []
const approvals = []
let approvalOutcome = process.env.APPROVE_DANGEROUS === '1' ? 'allowed-once' : 'rejected'

const ctx = {
  logger: { info: () => {}, warn: (m) => console.log('[warn]', m), error: (m) => console.log('[error]', m) },
  systemPrompt: {
    getSectionOrder: () => 10,
    section: (definition) => { sections.push(definition); return () => {} },
  },
  effect: (callback) => {
    const dispose = callback()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  on: (name, handler) => { listeners.push({ name, handler }); return () => {} },
  tools: { register: (definition) => { registered.push(definition); return () => {} } },
  get: (name) => {
    if (name !== 'approval') return undefined
    return {
      async request(request) {
        approvals.push(request.toolName)
        return approvalOutcome
      },
    }
  },
}

const started = Date.now()
await apply(ctx, { executable: exe })
const applyMs = Date.now() - started

const schemas = registered.map((d) => ({ name: d.name, description: d.description, parameters: d.parameters }))
const bytes = JSON.stringify(schemas).length
const forwarder = registered.find((d) => d.name === 'craft_tool')
const reverse = registered.find((d) => d.name === 'craft_reverse')
const observer = listeners.find((l) => l.name === 'tools/post-execute')?.handler

const exec = { signal: new AbortController().signal, callId: 'audit-1', arguments: {}, agent: { id: 'audit' } }
const expectReject = async (label, run) => {
  try {
    const value = await run()
    throw new Error(`${label}: expected a rejection, got ${String(value).slice(0, 80)}`)
  } catch (error) {
    console.log(`ok   ${label}: ${String(error.message).slice(0, 90)}`)
  }
}

console.log('--- surface ---')
console.log('apply ms:', applyMs)
console.log('tools:', registered.length, '| per-step schema bytes:', bytes, '(~' + Math.round(bytes / 3.5) + ' tokens)')
console.log('names:', registered.map((d) => d.name).join(', '))

console.log('--- craft_tool guards ---')
await expectReject('recursive name', () => forwarder.execute({ name: 'craft_tool' }, exec))
await expectReject('harness name', () => forwarder.execute({ name: 'mcp__craft-anything__core_target_open' }, exec))
await expectReject('malformed name', () => forwarder.execute({ name: '../../etc/passwd' }, exec))
await expectReject('dangerous tool without approval', () => forwarder.execute({ name: 'build_file_write', arguments: {} }, exec))
console.log('approval asked for:', approvals.join(',') || '(none)')

const catalog = String(await forwarder.execute({ name: '*' }, exec))
const catalogLines = catalog.split('\n')
console.log('catalog lines:', catalogLines.length, '| within cap:', catalogLines.length <= 121)
const search = String(await forwarder.execute({ name: 'core_*' }, exec))
console.log('wildcard search:', search.split('\n')[0], '| all core:', search.split('\n').slice(1).every((l) => l.startsWith('core_')))
const searchSuffix = String(await forwarder.execute({ name: '*show' }, exec))
console.log('suffix search hits core_session_show:', searchSuffix.includes('core_session_show'))
const searchNone = String(await forwarder.execute({ name: 'zzz*' }, exec))
console.log('empty search explains itself:', searchNone.startsWith('没有名字匹配'))

console.log('--- forwarding ---')
const forwarded = await forwarder.execute({ name: 'core_session_show', arguments: {} }, exec)
console.log('forwarded call ok:', String(forwarded).includes('"analysis_mode"'))
const hot = registered.find((d) => d.name === 'mcp__craft-anything__core_target_triage')
const targetPath = join(homedir(), '.dsh', 'tools', 'craft-anything', 'craft-anything-cli.exe')
console.log('hot call bytes:', String(await hot.execute({ path: targetPath }, exec)).length)

console.log('--- engine / mode / skill export ---')
const engine = registered.find((d) => d.name === 'craft_engine')
const exporter = registered.find((d) => d.name === 'craft_skill_export')
const statusText = String(await engine.execute({ action: 'status' }, exec))
console.log('engine status bytes:', statusText.length, '| mentions deep_mode:', statusText.includes('deep_mode') || statusText.includes('mode'))
console.log('engine status lists toolset surface:', statusText.includes('服务端已列出'))
console.log('engine status states bridge args:', statusText.includes('本桥启动参数'))
console.log('engine status states prompt cost:', statusText.includes('提示段开销'))
await expectReject('deep-on without approval', () => engine.execute({ action: 'deep-on' }, exec))
await expectReject('skill export into a host dir without approval', () => exporter.execute({ host: 'claude' }, exec))
console.log('unknown host refused:', String(await exporter.execute({ host: 'nope' }, exec)).includes('没认出 host'))
const exportDir = join(tmpdir(), `craft-skill-${Date.now()}`)
// An explicit `dir` is a path the caller wrote down: it must not need approval
// even while approvals are being refused, or the tool is unusable in a session
// where approvals are off.
approvalOutcome = 'rejected'
const exportText = String(await exporter.execute({ dir: exportDir }, exec))
console.log('explicit dir needs no approval:', readFileSync(join(exportDir, 'SKILL.md'), 'utf8').length > 0)
const skillFile = join(exportDir, 'SKILL.md')
const skillText = readFileSync(skillFile, 'utf8')
console.log('skill export:', exportText.split('\n')[0])
console.log('skill file has name/DSH row/error table:', skillText.includes('name: craft-anything-dsh'), skillText.includes('dsh-craft-anything'), skillText.includes('clean_room'))
console.log('skill file declares lang zh:', skillText.includes('lang: zh'))
const enDir = join(tmpdir(), `craft-skill-en-${Date.now()}`)
const enText = String(await exporter.execute({ dir: enDir, lang: 'en' }, exec))
const enSkill = readFileSync(join(enDir, 'SKILL.md'), 'utf8')
console.log('english skill export:', enSkill.length, 'bytes | lang: en', enSkill.includes('lang: en'), '| checklist', enSkill.includes('Finish checklist'), '| echoes lang', enText.includes('（en）'))

console.log('--- reverse mode + stage observer ---')
const start = await reverse.execute({ action: 'start', target: exe, project: join(tmpdir(), 'audit-rebuild'), goal: 'audit' }, exec)
console.log('start stage line:', start.text.split('\n').find((line) => line.startsWith('阶段')))
console.log('next steps use craft_tool where needed:', start.text.includes('`craft_tool`'))
console.log('status before:', (await reverse.execute({ action: 'status' }, exec)).text.split('\n')[0])

const decision = await observer(
  { name: 'craft_tool', arguments: { name: 'rebuild_start' }, agent: { id: 'audit' } },
  { isError: false },
  async () => ({ kind: 'accept' }),
)
console.log('observer decision:', decision.kind)
console.log('status after forwarded rebuild_start:', (await reverse.execute({ action: 'status' }, exec)).text.split('\n')[0])

await expectReject('failed forwarded call does not advance', async () => {
  const before = (await reverse.execute({ action: 'status' }, exec)).text.split('\n')[0]
  await observer(
    { name: 'craft_tool', arguments: { name: 'project_build_finish' }, agent: { id: 'audit' } },
    { isError: true },
    async () => ({ kind: 'accept' }),
  )
  const after = (await reverse.execute({ action: 'status' }, exec)).text.split('\n')[0]
  if (before !== after) return 'advanced on an error result'
  throw new Error('stage unchanged on error result')
})

console.log('--- sections/listeners ---')
const discipline = sections.find((s) => s.name === 'craft-anything.discipline')
console.log('bridge prompt bytes:', sections[0].text().length)
console.log('discipline off before first use:', discipline.text({ scope: { id: 'fresh-session' } }) === '')
console.log('discipline suppressed while a reverse run is alive:', discipline.text({ scope: { id: 'audit' } }) === '')
console.log('sections:', sections.map((s) => s.name).join(','))
console.log('listeners:', listeners.map((l) => l.name).join(','))
await reverse.execute({ action: 'stop' }, exec)
const engagedText = discipline.text({ scope: { id: 'audit' } })
console.log('discipline on after a call:', engagedText.includes('Absence is not proof'), `(${engagedText.length} B)`)
console.log('done')
process.exit(0)
