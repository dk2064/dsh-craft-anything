import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const exe = process.argv[2]
const out = process.argv[3]
if (!exe || !out) throw new Error('usage: node generate-catalog.mjs <exe> <out.json>')

function connect(args) {
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
      setTimeout(() => pending.has(id) && reject(new Error('timeout ' + method)), 60000)
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
  return { child, call }
}

const { child, call } = connect(['mcp','--deep'])
const init = await call('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'dsh-craft-anything-catalog', version: '1.0.0' },
})
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

const listTools = async () => (await call('tools/list', {})).tools
const baseline = await listTools()
const byName = new Map(baseline.map((t) => [t.name, { ...t, toolset: 'core' }]))

const readResult = (r) => r?.structuredContent?.result ?? (r?.content?.[0]?.text ? JSON.parse(r.content[0].text).result : undefined)
const sets = readResult(await call('tools/call', { name: 'list_toolsets', arguments: {} }))
const toolsets = sets.toolsets

const enabled = []
for (const set of toolsets) {
  if (set.enabled) { enabled.push(set.id); continue }
  let failure
  try {
    const r = await call('tools/call', { name: 'enable_toolset', arguments: { toolset: set.id } })
    const res = readResult(r)
    if (res?.enabled) enabled.push(set.id)
    else failure = JSON.stringify(res ?? r).slice(0, 200)
  } catch (error) {
    failure = String(error).slice(0, 200)
  }
  const now = await listTools()
  for (const tool of now) if (!byName.has(tool.name)) byName.set(tool.name, { ...tool, toolset: set.id, failure })
}

const tools = [...byName.values()].map((tool) => ({
  name: tool.name,
  title: tool.title ?? tool.annotations?.title ?? tool.name,
  description: (tool.description ?? '').split(/\n/)[0].slice(0, 220),
  toolset: tool.toolset,
  readOnly: tool.annotations?.readOnlyHint === true,
}))

const catalog = {
  generatedAt: new Date().toISOString(),
  source: 'https://github.com/storytold/craft-anything',
  server: init.serverInfo,
  instructions: init.instructions ?? '',
  toolsets: toolsets.map((set) => ({
    id: set.id,
    title: set.title,
    declared: set.tools,
    listed: tools.filter((tool) => tool.toolset === set.id).length,
    enabledByDefault: set.enabled,
  })),
  tools: tools.sort((a, b) => (a.toolset + a.name).localeCompare(b.toolset + b.name)),
}
writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n', 'utf8')
console.log(JSON.stringify({
  version: init.serverInfo.version,
  listed: tools.length,
  declared: toolsets.reduce((sum, s) => sum + s.tools, 0),
  perToolset: catalog.toolsets.map((s) => `${s.id}:${s.listed}/${s.declared}`),
  enabled,
}, null, 2))
child.kill()
process.exit(0)
