/**
 * Timing bench for the Craft Anything bridge: MCP round trips, prompt text
 * construction, and the Web panel's catalog/render cost. Run before and after
 * changing anything so the numbers are comparable.
 *
 * Usage: node tools/bench.mjs [exePath]
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync, writeFileSync } from 'node:fs'

const exe = process.argv[2] ?? process.env.CRAFT_ANYTHING_CLI ?? join(homedir(), '.dsh', 'tools', 'craft-anything', 'craft-anything-cli.exe')
const now = () => Number(process.hrtime.bigint() / 1000n) / 1000

function connect(args) {
  const t0 = now()
  const child = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  let buf = ''
  const pending = new Map()
  let nextId = 1
  child.stderr.on('data', () => {})
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      setTimeout(() => pending.has(id) && reject(new Error('timeout ' + method)), 120000)
    })
  child.stdout.on('data', (d) => {
    buf += d.toString()
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
      }
    }
  })
  return { child, call, t0 }
}

const runs = []
for (let i = 0; i < 3; i += 1) {
  const { child, call, t0 } = connect(['mcp', '--deep'])
  const tSpawn = now()
  await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bench', version: '1' } })
  const tInit = now()
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  const list = await call('tools/list', {})
  writeFileSync(new URL('./bench-tools.json', import.meta.url), JSON.stringify(list.tools))
  const tList = now()
  const triage = await call('tools/call', { name: 'core_target_triage', arguments: { path: exe } })
  const tTriage = now()
  child.kill()
  runs.push({
    spawnToFirstByte: +(tSpawn - t0).toFixed(0),
    initialize: +(tInit - tSpawn).toFixed(0),
    toolsList: +(tList - tInit).toFixed(0),
    triage: +(tTriage - tList).toFixed(0),
    tools: list.tools.length,
    toolsJsonBytes: JSON.stringify(list.tools).length,
    triageBytes: JSON.stringify(triage).length,
  })
}
console.log('MCP (ms):', JSON.stringify(runs, null, 1))

// Request cost: the whole tool list is re-sent on every step. Compare the
// current surface with the 12-tool core a trimmed bridge would keep visible.
const firstList = runs[0]
const toolsJsonBytes = firstList.toolsJsonBytes
const HOT = [
  'core_target_open', 'core_target_triage', 'core_session_show', 'core_investigation_show',
  'core_evidence_browse', 'core_brief_write', 'core_plan_update', 'core_finding_record',
  'core_handoff_write', 'core_report_write', 'rebuild_start', 'rebuild_check',
]
const allTools = JSON.parse(readFileSync(new URL('./bench-tools.json', import.meta.url), 'utf8'))
const hotBytes = JSON.stringify(allTools.filter((t) => HOT.includes(t.name))).length
const hotCount = allTools.filter((t) => HOT.includes(t.name)).length
console.log('per-step tool schema: all', toolsJsonBytes, 'bytes (~' + Math.round(toolsJsonBytes / 3.5) + ' tok)',
  '| hot', hotCount, 'tools', hotBytes, 'bytes (~' + Math.round(hotBytes / 3.5) + ' tok)',
  '| saving', (100 - (hotBytes / toolsJsonBytes) * 100).toFixed(0) + '%')


// Web panel data
const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const tParse0 = now()
const start = clientSource.indexOf('const CATALOG = ') + 'const CATALOG = '.length
const end = clientSource.indexOf('\n', start)
const catalog = JSON.parse(clientSource.slice(start, end).replace(/;?$/, ''))
const tParse1 = now()
console.log('client.js bytes:', clientSource.length)
console.log('catalog tools:', catalog.tools.length, 'bytes:', JSON.stringify(catalog).length, 'parse ms:', +(tParse1 - tParse0).toFixed(2))
console.log('catalog keys per tool:', Object.keys(catalog.tools[0]).join(','))

// Compact form: drop repeated field names and unused fields.
const compact = {
  v: catalog.server?.version ?? '',
  g: catalog.generatedAt,
  s: catalog.toolsets.map((t) => [t.id, t.title, t.declared, t.enabledByDefault ? 1 : 0, t.listed]),
  t: catalog.tools.map((t) => [t.name, t.title, t.description, t.toolset, t.readOnly ? 1 : 0]),
}
const compactText = JSON.stringify(compact)
console.log('compact bytes:', compactText.length, 'saving:', (100 - (compactText.length / JSON.stringify(catalog).length) * 100).toFixed(1) + '%')

// Render cost with a fake React (structure only, no DOM).
let payload
globalThis.window = { __ModuleLoader__: { load(entry) { payload = entry } } }
new Function('window', clientSource)(globalThis.window)
const fakeReact = {
  createElement(type, props, ...children) { return { type, props: props || {}, children } },
  useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
  useEffect() {},
}
const mod = payload.factory((id) => (id === 'react' ? fakeReact : (() => { throw new Error('require ' + id) })()))
const registered = []
const ctx = {
  get: () => undefined,
  slots: { inject: (k, cb) => (cb(), () => {}), register: (o, c) => (registered.push({ o, c }), () => {}) },
}
const applyStart = now()
mod.apply(ctx)
const applyMs = now() - applyStart
const panel = registered.find((r) => r.o.key === 'craft-anything').c
const walkStart = now()
let rows = 0
const walk = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (Array.isArray(node)) { node.forEach(walk); return }
  if (typeof node !== 'object') return
  if (node.type === 'div' && node.props.className === 'ca-tool') { rows += 1; return }
  if (typeof node.type === 'function') { walk(node.type(node.props)); return }
  if (node.children) node.children.forEach(walk)
  if (node.props && node.props.children) walk(node.props.children)
}
walk(panel())
const collapsedMs = now() - walkStart
console.log('client apply ms:', +applyMs.toFixed(2), '| panel build (core expanded) ms:', +collapsedMs.toFixed(2), 'rows:', rows)
