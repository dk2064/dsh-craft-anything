/**
 * A minimal MCP stdio client for Craft Anything.
 *
 * Why not `@deepseek-ai/dsh-mcp-client`: that bridge registers every tool the
 * server lists, and the registry re-sends each tool's schema on every model
 * step. Craft Anything in Deep mode lists 39 tools ≈ 40 KB ≈ 11.5k tokens per
 * request. This bridge registers only the tools the agent reaches for on most
 * turns and exposes the rest through one `craft_tool` forwarder, which keeps
 * the per-step tool surface at roughly a third of that.
 *
 * Protocol: newline-delimited JSON-RPC 2.0 over the child's stdio, exactly what
 * `craft-anything-cli mcp` speaks.
 *
 * @module bridge
 */
import { spawn } from 'node:child_process'

/** A single response line larger than this is treated as a protocol fault. */
const LINE_LIMIT_BYTES = 32 * 1024 * 1024

/** Restart delays after consecutive failed spawns/handshakes (ms). */
const BACKOFF_MS = [0, 500, 1500, 4000, 8000]

/**
 * @typedef {{ name: string, description?: string, inputSchema?: any, annotations?: any }} McpTool
 */

/**
 * Start one supervised MCP connection.
 *
 * @param {object} options
 * @param {string} options.exe - absolute path to `craft-anything-cli`.
 * @param {string[]} [options.args] - argv after the executable.
 * @param {string} [options.cwd]
 * @param {number} [options.callTimeoutMs]
 * @param {(message: string) => void} [options.log]
 */
export function createMcpBridge(options) {
  const {
    exe,
    args = ['mcp', '--deep'],
    cwd,
    callTimeoutMs = 600000,
    log = () => {},
  } = options

  /** @type {import('node:child_process').ChildProcessWithoutNullStreams | undefined} */
  let child
  let buffer = ''
  let nextId = 1
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void, timer: NodeJS.Timeout }>} */
  const pending = new Map()
  /** @type {McpTool[]} */
  let tools = []
  let connected = false
  let disposed = false
  let starting
  /** Consecutive failed starts; drives the restart backoff. */
  let failures = 0
  /** Earliest moment the next spawn is allowed. */
  let retryAfter = 0

  /** Reject every in-flight call when the transport dies. */
  function failAll(error) {
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer)
      pending.delete(id)
      entry.reject(error)
    }
  }

  /** Handle one newline-delimited JSON-RPC message from the server. */
  function onMessage(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (message.id !== undefined && pending.has(message.id)) {
      const entry = pending.get(message.id)
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error !== undefined) entry.reject(new Error(message.error.message ?? JSON.stringify(message.error)))
      else entry.resolve(message.result)
      return
    }
    if (message.method === 'notifications/tools/list_changed') {
      // The server changed its surface (enable_toolset). Refresh quietly; the
      // registry only ever exposes the fixed hot set, so nothing re-registers.
      void refreshTools().catch((error) => log(`tools refresh failed: ${String(error)}`))
    }
  }

  /** Send one request and await its response. */
  function request(method, params, timeoutMs = 60000) {
    if (child === undefined) return Promise.reject(new Error('craft-anything MCP server is not running'))
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      timer.unref?.()
      pending.set(id, { resolve, reject, timer })
      try {
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      } catch (error) {
        pending.delete(id)
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /** Fire-and-forget notification. */
  function notify(method, params) {
    child?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  /** Re-read the server's tool list. */
  async function refreshTools() {
    const result = await request('tools/list', {})
    tools = Array.isArray(result?.tools) ? result.tools : []
    return tools
  }

  /**
   * Spawn the server, handshake, and fetch the first tool list. Idempotent, and
   * backed off: a CLI that cannot start must not be re-spawned on every call.
   */
  function start() {
    if (starting !== undefined) return starting
    const waitMs = retryAfter - Date.now()
    if (waitMs > 0) {
      return Promise.reject(new Error(`craft-anything-cli restartbackoff: retry in ${Math.ceil(waitMs / 1000)}s`))
    }
    starting = (async () => {
      if (disposed) throw new Error('bridge disposed')
      child = spawn(exe, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      child.stderr.on('data', (chunk) => log(`stderr: ${String(chunk).slice(0, 400).trimEnd()}`))
      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        buffer += chunk
        if (buffer.length > LINE_LIMIT_BYTES) {
          const size = buffer.length
          buffer = ''
          failAll(new Error(`craft-anything-cli response exceeded ${LINE_LIMIT_BYTES} bytes without a line break; dropped`))
          log(`dropped a ${size}-byte unterminated response`)
          return
        }
        let index
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim()
          buffer = buffer.slice(index + 1)
          if (line.length > 0) onMessage(line)
        }
      })
      child.on('exit', (code, signal) => {
        const wasConnected = connected
        connected = false
        child = undefined
        buffer = ''
        failAll(new Error(`craft-anything-cli exited (${code ?? signal ?? 'unknown'})`))
        if (wasConnected && !disposed) log('Craft Anything server exited; calls fail until the next attempt')
      })
      child.on('error', (error) => {
        connected = false
        failAll(error instanceof Error ? error : new Error(String(error)))
      })

      const init = await request('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'dsh-craft-anything', version: '0.5.2' },
      }, 30000)
      notify('notifications/initialized', {})
      connected = true
      failures = 0
      retryAfter = 0
      await refreshTools()
      return init
    })().catch((error) => {
      failures += 1
      retryAfter = Date.now() + BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)]
      throw error
    }).finally(() => {
      starting = undefined
    })
    return starting
  }

  /** Call one tool by its raw MCP name. Returns the raw CallToolResult. */
  async function call(rawName, args, signal) {
    if (!connected) await start()
    if (signal?.aborted) throw new Error('canceled')
    const result = await request('tools/call', { name: rawName, arguments: args ?? {} }, callTimeoutMs)
    if (result?.isError === true) {
      const text = Array.isArray(result.content)
        ? result.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
        : ''
      throw new Error(text || `${rawName} failed`)
    }
    return result
  }

  /** Current tool list (refreshed on `tools/list_changed`). */
  function list() {
    return tools
  }

  /** Stop the child and drop every pending call. */
  async function dispose() {
    disposed = true
    connected = false
    failAll(new Error('bridge disposed'))
    if (child !== undefined) {
      const target = child
      child = undefined
      target.kill()
    }
  }

  return { start, call, list, refreshTools, dispose, isConnected: () => connected }
}

/** Flatten an MCP CallToolResult into model-visible text. */
export function resultText(result) {
  if (result === undefined || result === null) return ''
  if (typeof result === 'string') return result
  const blocks = Array.isArray(result.content) ? result.content : []
  const parts = []
  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block?.type === 'image') parts.push('[image result; open it in Craft Anything to view]')
  }
  if (parts.length > 0) return parts.join('\n')
  if (result.structuredContent !== undefined) return JSON.stringify(result.structuredContent)
  return ''
}
