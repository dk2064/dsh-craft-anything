/**
 * Standalone check of bridge.js: handshake, tool listing, two calls, disposal.
 * Runs without DSH so a protocol mistake surfaces here, not in a broken session.
 */
import { createMcpBridge, resultText } from '../bridge.js'
import { join } from 'node:path'
import { homedir } from 'node:os'

const exe = process.argv[2] ?? process.env.CRAFT_ANYTHING_CLI ?? join(homedir(), '.dsh', 'tools', 'craft-anything', 'craft-anything-cli.exe')
const started = Date.now()
const bridge = createMcpBridge({ exe, log: (message) => console.log('[child]', message.slice(0, 160)) })

const initialized = await bridge.start()
console.log('handshake ms:', Date.now() - started, '| server:', initialized.serverInfo?.name, initialized.serverInfo?.version)
console.log('tools:', bridge.list().length)

const triageStart = Date.now()
const triage = await bridge.call('core_target_triage', { path: exe })
console.log('triage ms:', Date.now() - triageStart, '| bytes:', resultText(triage).length)
console.log('triage head:', resultText(triage).slice(0, 100))

const sets = await bridge.call('list_toolsets', {})
console.log('list_toolsets ok:', resultText(sets).includes('native'))

let failed = false
try {
  await bridge.call('no_such_tool', {})
} catch (error) {
  failed = true
  console.log('unknown tool rejected:', String(error.message).slice(0, 80))
}

await bridge.dispose()
console.log('disposed | unknown-tool error path:', failed)
process.exit(0)
