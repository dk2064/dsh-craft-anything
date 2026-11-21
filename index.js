/**
 * Host half of the Craft Anything bridge.
 *
 * Two things live here:
 *
 * 1. **The bridge map** — `craft-anything-mcp` (see `cordis.patch.yml`) inserts
 *    `@deepseek-ai/dsh-mcp-client` against `craft-anything-cli mcp --deep`, so
 *    every Craft Anything tool is reachable as `mcp__craft-anything__<tool>`.
 *    This half publishes a short catalog-backed map of the 17 toolsets so the
 *    model knows the whole surface exists and how to open it.
 *
 * 2. **Reverse mode** — `craft_reverse` starts a per-session "study the
 *    original, rebuild it, check against it" run. Starting it bootstraps the
 *    Craft Anything side itself (open target, triage, brief, enable the
 *    toolsets the triage recommends) through the MCP tools, then keeps a stage
 *    machine that watches the tool stream (`tools/post-execute`) and tells the
 *    model the exact next calls for the current stage.
 *
 * @module dsh-craft-anything
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createMcpBridge, resultText } from './bridge.js'
import { buildSkillMd } from './skill.js'

/** Loader diagnostics name. */
export const name = 'dsh-craft-anything'

/** Tool registry plus the prompt registry. */
export const inject = ['tools', 'systemPrompt']

/** Where the release binary lives; the row's `executable` config overrides it. */
/**
 * Fallback when the row configures no `executable`: a bare binary name, which
 * the OS resolves through PATH.
 */
const DEFAULT_EXECUTABLE = process.platform === 'win32' ? 'craft-anything-cli.exe' : 'craft-anything-cli'

/**
 * Expand %NAME%, ${NAME} or $NAME inside a configured executable path, so one
 * patch can point at a different install on another machine.
 * @param {unknown} configured
 * @returns {string}
 */
function resolveExecutable(configured) {
  const raw = typeof configured === 'string' ? configured.trim() : ''
  const source = raw === '' ? DEFAULT_EXECUTABLE : raw
  return source
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (match, name) => process.env[name] ?? match)
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name) => process.env[name] ?? match)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name) => process.env[name] ?? match)
}

/**
 * Tools registered as first-class tools. Everything else Craft Anything offers
 * (about 25 more in Deep mode, and the whole 300+ catalog after
 * `enable_toolset`) is reachable through `craft_tool` by name, which keeps the
 * per-step tool surface — and with it every request's prompt — small.
 */
const HOT_TOOLS = new Set([
  'core_target_open',
  'core_target_triage',
  'core_session_show',
  'core_investigation_show',
  'core_evidence_browse',
  'core_brief_write',
  'core_plan_update',
  'core_finding_record',
  'core_handoff_write',
  'core_report_write',
  'rebuild_start',
  'rebuild_check',
  'list_toolsets',
  'enable_toolset',
])

/** @type {ReturnType<typeof createMcpBridge> | undefined} */
let activeBridge

/** @type {{ version?: string, server?: { name?: string, version?: string }, toolsets?: Array<{ id: string, title: string, declared: number, enabledByDefault: boolean }>, tools?: unknown[] } | undefined} */
let catalog
try {
  catalog = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))
} catch {
  catalog = undefined
}

const MCP = 'mcp__craft-anything__'
const TOOL_IDS = new Set(['craft_reverse'])

/**
 * The toolset roster on two lines instead of seventeen.
 *
 * Model-facing prompt text is paid for on every step of every turn, and the
 * seventeen-line version cost ~1.3 KB to say what a dense roster says in ~500 B.
 * The titles ("Programs (native code)", "Electron and JavaScript") are folded
 * into one sentence that keeps the routing decision, and `list_toolsets` still
 * carries the full description for anyone who needs it.
 * @returns {string}
 */
function toolsetLines() {
  const toolsets = catalog?.toolsets ?? []
  if (toolsets.length === 0) return '- (catalog missing: run tools/generate-catalog.mjs)'
  const roster = toolsets
    .map((set) => (set.enabledByDefault ? `${set.id} ${set.declared} (listed)` : `${set.id} ${set.declared}`))
    .join(' · ')
  return [
    `Toolsets (tool count): ${roster}.`,
    'Pick by target: native = programs in machine code, javascript = Electron/.asar, browser = live websites and windows, formats = files, firmware, dumps, managed = .NET, android/adb = APK and phones, application = comparing two builds, projects = rebuild_* and build output, setup = engines and settings, runtime = running processes, frida = live instrumentation.',
  ].join('\n')
}

/**
 * The bridge section: what Craft Anything is and how to open more of it.
 * Built once at module load — prompt assembly runs on every step of every
 * agent, so it must not rebuild this string each time.
 * @returns {string}
 */
function buildBridgeText() {
  const version = catalog?.server?.version ?? catalog?.version ?? 'unknown'
  const total = (catalog?.toolsets ?? []).reduce((sum, set) => sum + set.declared, 0)
  return [
    '### Craft Anything',
    '',
    `Craft Anything ${version} is bridged over MCP as server \`craft-anything\`; its tools are named \`mcp__craft-anything__<tool>\`.`,
    `It studies how an app, website, game or file works and can have a coding agent rebuild it. ${total} tools exist across ${(catalog?.toolsets ?? []).length} toolsets, but only the Essentials set is listed at first:`,
    '',
    toolsetLines(),
    '',
    'To use another toolset, call `mcp__craft-anything__list_toolsets`, then `mcp__craft-anything__enable_toolset` with the toolset id; the new tools appear in this session, so look them up before calling one.',
    'Only the tools used most turns are registered directly. Call everything else by name through `craft_tool` — `{"name":"native_function_study","arguments":{…}}` — and `name:"*"` lists the server\'s tools (`"adb*"`, `"*show"`, `"*window*"` search them).',
    'Typical start: `core_target_open` with an absolute path or URL, `core_investigation_show`, then focused tools.',
    'To study something and rebuild it end to end, start reverse mode: `craft_reverse` with action `start`.',
    'Do not reach for this when you already have the source and the question is only about that source — read it directly; trust the live tool list and its schemas over any document.',
    'Check the connection before repairing it: if these tools are already listed, do not run setup or doctor first. Never point `setup --yes` at an entry that already lists every tool — setup writes the bare `mcp` command and drops `--deep` / `--all-tools`.',
    'This bridge starts the server with `--deep`. If a call answers `details.reason: clean_room`, the question needs Deep mode (`craft_engine` action `deep-on`, `settings_set deep_mode true`, or `--deep`); do not work around it.',
    '`craft_engine` reports settings and engines (`doctor`), toggles Deep mode, and points Ghidra at a local install. Tools that run code, write files, change settings or spend money ask for approval first.',
    'Errors: `not_found` → open the target first; `feature_missing` / `engine_missing` → read the remedy it names; `over_limit` → page through `core_evidence_browse`; `stale_revision` → `core_investigation_show` then merge; `content_required` → ask; `consent_required` → get the user’s OK.',
    '`craft_skill_export` writes SKILL.md for hosts that only read a skill file (`host` for a known agent dir, `dir` for anywhere); this Harness already has the tools.',
  ].join('\n')
}

/** Frozen once; every step reuses it. */
const BRIDGE_TEXT = buildBridgeText()

/**
 * Discipline for a session that is actually studying something.
 *
 * This is the part of the upstream skill that matters once a study is under way
 * — memory hygiene, absence-as-evidence, paging, evidence grades — and it is
 * worth nothing to a session that never touches a target while still costing
 * tokens on every step of that session. So it is attached only after the first
 * craft-anything call in the session, and reverse-mode runs skip it because
 * their own section carries the Chinese version.
 */
const DISCIPLINE_TEXT = [
  '### Working discipline',
  '',
  '- Memory: `brief_write` → `plan_update` → `hypothesis_record` (say what would refute it) → `hypothesis_update` (evidence ids) → `finding_record` → `unknown_add` (gaps) → `handoff_write` at the turn end.',
  '- Absence is not proof: "no match" covers only the range searched — state that boundary and the coverage the tool reported, and record load-bearing gaps.',
  '- Big results: summary + evidence id first, then page with `core_evidence_browse`; do not repeat the same call.',
  '- Grades: observed / derived / inferred. Static code is not runtime behaviour.',
].join('\n')

/** Sessions that have called the server at least once. @type {Set<string>} */
const engaged = new Set()

/** Past this many sessions the oldest entries are dropped. */
const MAX_ENGAGED = 128

/**
 * @param {unknown} scope
 * @returns {boolean}
 */
function isEngaged(scope) {
  const key = sessionKeyOf(scope)
  return key === undefined ? false : engaged.has(key)
}

/**
 * @param {unknown} scope
 */
function markEngaged(scope) {
  const key = sessionKeyOf(scope)
  if (key === undefined || engaged.has(key)) return
  engaged.add(key)
  if (engaged.size > MAX_ENGAGED) {
    const oldest = engaged.values().next().value
    if (oldest !== undefined) engaged.delete(oldest)
  }
}

// ── reverse mode state ──────────────────────────────────────────────────────

/**
 * @typedef {object} ReverseState
 * @property {string} target - path or URL being studied.
 * @property {string} project - folder the rebuild is written to.
 * @property {string} goal - what is being rebuilt.
 * @property {string} stage - boot | recon | spec | rebuild | diff | accept | done.
 * @property {boolean} open - target opened in Craft Anything.
 * @property {boolean} triaged
 * @property {boolean} briefed
 * @property {string[]} toolsets - toolsets this run enabled.
 * @property {number} checks - rebuild_check runs.
 * @property {number} notes
 * @property {string[]} log - short progress lines.
 * @property {number} startedAt
 * @property {string} lastTool - last craft-anything tool seen.
 */

/** @type {Map<string, ReverseState>} */
const runs = new Map()

/** Live reverse runs kept in memory; the oldest is dropped past this. */
const MAX_RUNS = 32

/** @param {string} text */
const stamp = (text) => `${new Date().toISOString().slice(11, 19)} ${text}`

/**
 * Session id behind a tool call or a prompt assembly.
 * @param {unknown} value
 * @returns {string | undefined}
 */
function sessionKeyOf(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return String(/** @type {{ id: unknown }} */ (value).id)
  return undefined
}

/**
 * The run for a scope. Exact match only: with several sessions open, falling
 * back to "the only run" would leak one session's reverse state into another
 * session's prompt.
 * @param {unknown} scope
 * @returns {ReverseState | undefined}
 */
function runFor(scope) {
  const key = sessionKeyOf(scope)
  if (key === undefined) return undefined
  return runs.get(key)
}

const STAGES = ['boot', 'recon', 'spec', 'rebuild', 'diff', 'accept', 'done']

/** @type {Record<string, string>} */
const STAGE_TITLES = {
  boot: '起步：打开目标、分诊、写简报',
  recon: '侦察：把原件拆开看清',
  spec: '规格：把观察写成可施工的说明',
  rebuild: '复刻：让编码代理产出新项目',
  diff: '对比：用官方检查收敛差异',
  accept: '验收：全部检查通过并出报告',
  done: '完成',
}

/**
 * One call line for a tool: a first-class tool is written directly, anything
 * else goes through the `craft_tool` forwarder — the two must never be mixed
 * up, or the model calls a name that is not registered.
 * @param {string} name - raw MCP tool name.
 * @param {Record<string, unknown>} args
 * @param {string} [note]
 * @returns {string}
 */
function callLine(name, args, note) {
  const body = JSON.stringify(args)
  const line = HOT_TOOLS.has(name)
    ? `\`${MCP}${name}\` ${body}`
    : `\`craft_tool\` {"name":"${name}","arguments":${body}}`
  return note === undefined ? line : `${line}（${note}）`
}

/**
 * The next calls for a stage, as ready-to-copy tool lines.
 * @param {ReverseState} state
 * @returns {string[]}
 */
function nextSteps(state) {
  const target = state.target || '<target>'
  const project = state.project || '<project folder>'
  switch (state.stage) {
    case 'boot':
      return [
        callLine('core_target_open', { path: target }),
        callLine('core_target_triage', {}),
        callLine('core_brief_write', { question: `复刻 ${state.goal || target}`, purpose: 'recreate', targets: [target], done_when: '与原件逐项比对通过' }),
      ]
    case 'recon':
      return [
        callLine('core_overview_show', {}, '格式/架构/段/导入表/加固'),
        callLine('core_feature_find', { query: '<界面上看到的文案>' }, '从字到函数'),
        callLine('list_toolsets', {}, '看还有哪些工具集'),
        callLine('enable_toolset', { toolset: '<native|browser|formats|android…>' }, '打开侦察要用的'),
        callLine('core_hypothesis_record', { claim: '<它怎么做的>' }, '写成可证伪命题'),
      ]
    case 'spec':
      return [
        callLine('core_plan_update', { steps: [{ title: '<复刻步骤>', why: '<为什么>' }] }),
        callLine('core_finding_record', { statement: '<结论>', evidence_ids: ['<ev_…>'] }),
        callLine('core_unknown_add', { question: '<还没搞清的>', probes: ['<用什么探针>'] }),
        callLine('enable_toolset', { toolset: 'projects' }, 'rebuild_* 属于 projects 工具集'),
        callLine('project_approvals_set', { kind: '<commands|web|files>', mode: '<ask|allow>' }),
        callLine('rebuild_start', { kind: '<web|app|game>', project }, '进入复刻'),
      ]
    case 'rebuild':
      return [
        callLine('rebuild_status', {}, '看编码代理进度'),
        callLine('rebuild_activity_show', {}, '看它刚做了什么'),
        callLine('rebuild_note', { note: '<本轮回合要它改什么>' }),
        callLine('rebuild_check', {}, '只有官方检查算数'),
        '不要凭感觉宣布“像了”；差异交给 rebuild_check 给出百分比',
      ]
    case 'diff':
      return [
        callLine('rebuild_check', {}, `已完成 ${state.checks} 次检查，继续收敛`),
        callLine('core_evidence_browse', {}, '打开上次检查的清单，逐项定位差异'),
        callLine('rebuild_note', { note: '<把差异翻译成一条具体改动>' }),
        '每一类差异修完再复检；连续两次无提升就换方向或问人',
      ]
    case 'accept':
      return [
        callLine('rebuild_check', {}, '全部检查通过才进入验收'),
        callLine('project_build_finish', {}, '收尾构建'),
        callLine('core_report_write', { format: 'markdown', path: `${project}\\reverse-report.md` }),
        callLine('core_handoff_write', { text: '做了什么、还差什么、坑在哪' }),
      ]
    default:
      return ['本轮复刻已完成。要换目标就 `craft_reverse` action `start` 起新的一轮。']
  }
}

/**
 * Prompt section body for one run.
 * @param {ReverseState} state
 * @returns {string}
 */
function reverseText(state) {
  return [
    '### 逆向模式：复刻中',
    '',
    `目标 \`${state.target}\`${state.project ? ` → 复刻到 \`${state.project}\`` : ''}${state.goal ? `，要复刻的是：${state.goal}` : ''}`,
    `阶段 ${STAGES.indexOf(state.stage) + 1}/${STAGES.length} · ${STAGE_TITLES[state.stage] ?? state.stage} · 已检查 ${state.checks} 次 · 已开工具集 ${state.toolsets.length > 0 ? state.toolsets.join(', ') : 'core'}`,
    '',
    '下一步（按序调用，别跳）：',
    ...nextSteps(state).map((line) => `- ${line}`),
    '',
    '规矩：',
    '- 只把 craft-anything 工具给出的证据当事实；没进 evidence 的结论一律标为推断。',
    '- 先预测再验证：跑工具前用 `core_hypothesis_record` 写下「什么结果会证实/推翻它」，跑完用 `core_hypothesis_update` 判 supported / refuted；结果反常就改假设，别解释掉。',
    '- 没搜到不是不存在：「没找到字符串」「没有调用者」只覆盖搜过的范围，要写边界，未决的记 `core_unknown_add`。',
    '- 结果太大先读摘要再分页（`core_evidence_browse` 的 offset/limit），不要重复同一个大调用。',
    '- 每完成一步就更新调查记忆（brief / plan / finding / unknown），结尾写 handoff。',
    '- 复刻是否“像”，只由 `rebuild_check` 判定；自查通过不算数。',
    '- 卡住时用 `craft_tool` {"name":"core_person_ask","arguments":{"questions":[…],"context":"…"}} 问人，不要自己猜着往下画。',
    '- 阶段推进由 `craft_reverse` action `next` 或 `status` 汇报；不要手写阶段名。',
  ].join('\n')
}

// ── MCP bootstrap ──────────────────────────────────────────────────────────

/**
 * Call one craft-anything tool through the bridge, straight to the server.
 * Going through `ctx.tools.execute` would re-enter the registry for a tool the
 * model never sees; the bridge owns the connection and answers directly.
 * @param {import('@deepseek-ai/dsh-tools').ToolRunContext} exec
 * @param {string} name - MCP tool name without the prefix.
 * @param {Record<string, unknown>} args
 * @returns {Promise<{ ok: boolean, text: string }>}
 */
async function callMcp(exec, name, args) {
  const bridge = activeBridge
  if (bridge === undefined) return { ok: false, text: 'Craft Anything 服务未连接（craft-anything-cli 未启动）' }
  try {
    const result = await bridge.call(name, args ?? {}, exec.signal)
    return { ok: true, text: resultText(result) }
  } catch (error) {
    return { ok: false, text: `${name} 调用失败：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Recommended toolsets from a triage payload.
 * @param {string} text
 * @returns {string[]}
 */
function recommendedToolsets(text) {
  const match = /"recommended_toolsets"\s*:\s*\[([^\]]*)\]/.exec(text)
  if (!match) return []
  return [...match[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1])
}

// ── tool definition ────────────────────────────────────────────────────────

const STATE_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['start', 'status', 'next', 'note', 'stage', 'stop'], description: 'start 起一轮；next/status 看下一步；note 记一句；stage 手动落阶段；stop 结束。' },
    target: { type: 'string', description: 'start 必填：要研究的原件的绝对路径或网址。' },
    project: { type: 'string', description: '复刻项目目录（可留空，开工时再定）。' },
    goal: { type: 'string', description: '要复刻的是什么，一句话。' },
    note: { type: 'string', description: 'note 的内容：本轮的改动方向或差异结论。' },
    stage: { type: 'string', enum: STAGES, description: 'stage 动作要落的阶段。' },
    toolsets: {
      type: 'string',
      enum: ['auto', 'all'],
      description: 'start 时开哪些工具集：auto 按分诊推荐自动开（默认），all 全开。',
    },
  },
  required: ['action'],
  additionalProperties: false,
}

/**
 * @param {any} ctx
 * @param {import('@deepseek-ai/dsh-tools').ToolRunContext} exec
 * @param {{ action: string, target?: string, project?: string, goal?: string, note?: string, stage?: string }} args
 * @param {{ toolsets?: 'auto' | 'all' | string[] }} [options]
 */
async function runReverseAction(ctx, exec, args, options = {}) {
  const key = sessionKeyOf(exec.agent) ?? 'unscoped'
  const existing = runs.get(key)
  const action = args.action

  if (action === 'start') {
    if (!args.target) return { ok: false, text: 'start 需要 target：原件的绝对路径或网址。' }
    /** @type {ReverseState} */
    const state = {
      target: args.target,
      project: args.project ?? '',
      goal: args.goal ?? '',
      stage: 'boot',
      open: false,
      triaged: false,
      briefed: false,
      toolsets: ['core'],
      checks: 0,
      notes: 0,
      log: [stamp('逆向模式开启')],
      startedAt: Date.now(),
      lastTool: '',
    }
    runs.set(key, state)
    // Long-lived processes create many sessions; keep only the newest runs.
    if (runs.size > MAX_RUNS) {
      for (const oldest of runs.keys()) {
        if (oldest !== key) {
          runs.delete(oldest)
          break
        }
      }
    }

    const lines = [`逆向模式已开启：${state.target}`]
    // Bootstrap the Craft Anything side so the run starts from real state.
    const open = await callMcp(exec, 'core_target_open', { path: state.target })
    state.open = open.ok
    lines.push(`- core_target_open: ${open.ok ? '已打开' : '未自动完成（可手动调用）'} ${open.ok ? '' : open.text.slice(0, 200)}`)

    let recommended = []
    if (open.ok) {
      // Triage (the expensive one, ~200 ms) and the brief are independent once
      // the target is open, so they share one round trip instead of queueing.
      const [triage, brief] = await Promise.all([
        callMcp(exec, 'core_target_triage', {}),
        callMcp(exec, 'core_brief_write', {
          question: `复刻 ${state.goal || state.target}：它是怎么做的，怎么建一个自己的`,
          purpose: 'recreate',
          targets: [state.target],
          done_when: '与原件逐项比对通过，rebuild_check 全绿，报告落盘',
        }),
      ])
      state.triaged = triage.ok
      state.briefed = brief.ok
      recommended = recommendedToolsets(triage.text)
      const plain = /"plain_english"\s*:\s*"([^"]{10,240})"/.exec(triage.text)?.[1]
      lines.push(`- core_target_triage: ${triage.ok ? '已完成' : '未完成'}${plain ? ` — ${plain}` : ''}`)
      if (recommended.length > 0) lines.push(`- 推荐工具集: ${recommended.join(', ')}`)
      lines.push(`- core_brief_write: ${brief.ok ? '已记录简报' : '未记录'}`)
    }

    // Toolset policy: `all` opens everything the server offers, an array opens
    // exactly those, and the default opens the two the triage recommended.
    const policy = args.toolsets ?? options.toolsets ?? 'auto'
    const wanted = policy === 'all'
      ? ['all']
      : Array.isArray(policy)
        ? policy.filter((id) => id !== 'core').slice(0, 6)
        : recommended.filter((id) => id !== 'core').slice(0, 2)
    for (const id of wanted) {
      const enabled = await callMcp(exec, 'enable_toolset', { toolset: id })
      if (enabled.ok) state.toolsets.push(id === 'all' ? '全部工具集' : id)
      lines.push(`- enable_toolset(${id}): ${enabled.ok ? '已开，下一轮可见其工具' : '未开'}`)
    }

    if (state.triaged) state.stage = 'recon'
    return { ok: true, text: [...lines, '', `阶段 2/7 · ${STAGE_TITLES[state.stage]}`, '', '下一步：', ...nextSteps(state).map((line) => `- ${line}`)].join('\n') }
  }

  const state = existing
  if (!state) return { ok: false, text: '本会话还没有逆向模式：先 `craft_reverse` action `start` 带 target。' }

  if (action === 'stop') {
    runs.delete(key)
    return { ok: true, text: `逆向模式已关闭（${state.target}）。已写入 craft-anything 的简报/证据仍在项目里。` }
  }
  if (action === 'note') {
    if (!args.note) return { ok: false, text: 'note 需要内容。' }
    state.notes += 1
    state.log.push(stamp(args.note.slice(0, 300)))
    return { ok: true, text: `已记录第 ${state.notes} 条：${args.note.slice(0, 200)}` }
  }
  if (action === 'stage') {
    if (!args.stage || !STAGES.includes(args.stage)) return { ok: false, text: `stage 取值：${STAGES.join(' / ')}` }
    state.stage = args.stage
    return { ok: true, text: `阶段已落到 ${args.stage} · ${STAGE_TITLES[args.stage]}` }
  }

  // status / next
  const progress = [
    `阶段 ${STAGES.indexOf(state.stage) + 1}/${STAGES.length} · ${STAGE_TITLES[state.stage]}`,
    `目标 ${state.target}${state.project ? ` → ${state.project}` : ''}`,
    `已开工具集 ${state.toolsets.join(', ')} · rebuild_check ${state.checks} 次 · 记录 ${state.notes} 条${state.lastTool ? ` · 最近工具 ${state.lastTool}` : ''}`,
  ]
  if (state.log.length > 0) progress.push(`进度：${state.log.slice(-4).join(' | ')}`)
  return {
    ok: true,
    text: [...progress, '', '下一步：', ...nextSteps(state).map((line) => `- ${line}`)].join('\n'),
  }
}

// ── tool surface ───────────────────────────────────────────────────────────

/**
 * One first-class tool that forwards to a whitelisted MCP tool.
 * @param {ReturnType<typeof createMcpBridge>} bridge
 * @param {{ name: string, description?: string, inputSchema?: any }} tool
 */
function hotToolDefinition(bridge, tool) {
  return {
    name: `${MCP}${tool.name}`,
    description: String(tool.description ?? tool.name),
    parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    timeoutMs: 600000,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
    },
    async execute(args, exec) {
      return clipText(resultText(await bridge.call(tool.name, args ?? {}, exec.signal)))
    },
  }
}

/**
 * Tools that run code, change this machine, spend money or self-approve. The
 * forwarder asks the Harness approval service before running one of these, so
 * the slim bridge cannot become a way around the approval chain that the old
 * blanket MCP bridge had.
 */
const DANGEROUS_TOOLS = new Set([
  'build_command_run',
  'build_file_write',
  'build_file_edit',
  'settings_set',
  'plugins_add',
  'plugins_remove',
  'engines_install',
  'setup_apply',
  'setup_uninstall',
  'project_delete',
  'project_rename',
  'project_duplicate',
  'adb_app_install',
  'adb_app_remove',
  'core_action_approve',
  'rebuild_start',
  'assets_image_generate',
  'assets_model_generate',
])

/** Plain tool names only: no namespaces, no paths, no empty strings. */
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/

/**
 * Ask the Harness approval service before a mutating Craft Anything call.
 * Without an approval service this fails closed — a missing approver must not
 * turn into a silent yes.
 * @param {{ get: (name: string) => any }} ctx
 * @param {import('@deepseek-ai/dsh-tools').ToolRunContext} exec
 * @param {string} toolName - the Craft Anything tool about to run.
 * @param {string} zh - one line for the approval card.
 * @param {string} en - the same in English.
 */
async function askApproval(ctx, exec, toolName, zh, en) {
  const approval = typeof ctx.get === 'function' ? ctx.get('approval') : undefined
  if (approval === undefined) {
    throw new Error(`${toolName} 会执行命令或改变这台机器，当前没有审批服务可用，未执行。请在具备审批的配置里运行，或改用直连工具。`)
  }
  const outcome = await approval.request({
    agent: exec.agent,
    toolName: `craft_tool:${toolName}`,
    callId: exec.callId,
    reason: `Craft Anything 工具 ${toolName} 会执行命令、写文件或改变这台机器`,
    displayReason: { en, zh },
    signal: exec.signal,
  }).catch(() => 'unavailable')
  if (outcome !== 'allowed-once') {
    throw new Error(`${toolName} 需要人工批准，本次结果是 ${outcome}，没有执行`)
  }
}

/** Cap on `craft_tool {name:"*"}` output: a 300-tool catalog must stay readable. */
const CATALOG_LINE_LIMIT = 120

/**
 * Cap on one tool result. Craft Anything can return a whole evidence record or
 * a full report in one text block; past this size the session prompt would blow
 * up, so the tail is cut and the tool that pages the same data is named.
 */
const RESULT_TEXT_LIMIT = 200_000

/**
 * Clip oversized tool text.
 * @param {string} text
 * @returns {string}
 */
function clipText(text) {
  if (text.length <= RESULT_TEXT_LIMIT) return text
  return `${text.slice(0, RESULT_TEXT_LIMIT)}\n…（结果 ${text.length} 字节，只保留前 ${RESULT_TEXT_LIMIT}；用 core_evidence_browse 分页读剩下的部分）`
}

/**
 * The single forwarder for every tool not registered first-class: after
 * `enable_toolset` the catalog grows past 300 tools and none of them may enter
 * the per-step tool list.
 * @param {{ get: (name: string) => any, logger?: any }} ctx
 * @param {ReturnType<typeof createMcpBridge>} bridge
 */
function craftToolDefinition(ctx, bridge) {
  return {
    name: 'craft_tool',
    description: '调用 Craft Anything 目录里没有直接注册的工具：{"name":"<工具名>","arguments":{...}}；name 传 "*" 列出当前全部工具名与一行说明，带通配则按名检索（"adb*" 前缀、"*local" 后缀、"*window*" 包含）。名不带 mcp__craft-anything__ 前缀。会执行命令或改机器的工具需要人工批准。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '工具名；"*" 列出目录，带 * 则检索' },
        arguments: { type: 'object', description: '该工具的参数对象', additionalProperties: true },
      },
      required: ['name'],
      additionalProperties: false,
    },
    timeoutMs: 600000,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
    },
    async execute(args, exec) {
      const parsed = /** @type {{ name?: unknown, arguments?: unknown }} */ (args ?? {})
      const name = String(parsed.name ?? '').trim()

      if (name === '' || name === '*' || name.includes('*')) {
        // `*` alone lists everything; a star inside the name searches instead of
        // calling, so 300+ tools stay reachable without scrolling the whole
        // catalog: `adb*` (prefix), `*local` (suffix), `*window*` (contains).
        const all = bridge.list()
        const prefix = name.startsWith('*') ? '' : name.split('*')[0]
        const suffix = name.endsWith('*') ? '' : name.split('*').pop()
        const list = name === '' || name === '*'
          ? all
          : all.filter((tool) => tool.name.startsWith(prefix) && tool.name.endsWith(suffix))
        if (list.length === 0) {
          return `没有名字匹配 ${name} 的工具（当前可用 ${all.length} 个）。用 craft_tool {"name":"*"} 看全表，或用 list_toolsets 打开更多工具集。`
        }
        const head = name === '' || name === '*'
          ? `当前可用 ${all.length} 个工具：`
          : `名字匹配 ${name} 的 ${list.length} 个工具（共 ${all.length} 个可用）：`
        const shown = list.slice(0, CATALOG_LINE_LIMIT)
        const lines = shown.map((tool) => `${tool.name} — ${String(tool.description ?? '').split('\n')[0].slice(0, 90)}`)
        const tail = list.length > shown.length ? [`…还有 ${list.length - shown.length} 个，用 enable_toolset 精确打开后按名调用`] : []
        return [head, ...lines, ...tail].join('\n')
      }

      if (!TOOL_NAME_PATTERN.test(name)) throw new Error(`工具名不合法：${name}`)
      if (name === 'craft_tool' || name === 'craft_reverse' || name.startsWith('mcp__')) {
        throw new Error('craft_tool 只转发 Craft Anything 服务端的工具，不能调用 Harness 自己的工具')
      }

      if (DANGEROUS_TOOLS.has(name)) {
        await askApproval(
          ctx,
          exec,
          name,
          `Craft Anything 要执行 ${name}，它会执行命令或改变这台机器。`,
          `Craft Anything is about to run "${name}", which can change this machine.`,
        )
      }

      return clipText(resultText(await bridge.call(name, /** @type {any} */ (parsed).arguments ?? {}, exec.signal)))
    },
  }
}

// ── engine, mode and skill export ──────────────────────────────────────────

const ENGINE_SCHEMA = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['status', 'doctor', 'deep-on', 'deep-off', 'ghidra'],
      description: 'status 看设置与引擎现状；doctor 跑安装自检；deep-on / deep-off 切 Deep 模式（改设置，需批准）；ghidra 指定 Ghidra 安装目录（需批准）。',
    },
    path: { type: 'string', description: 'ghidra 动作要设的本机 Ghidra 安装目录（绝对路径）。' },
  },
  required: ['action'],
  additionalProperties: false,
}

/**
 * Open a toolset before calling one of its tools. The server answers with
 * `tools/list_changed` and the bridge refreshes asynchronously, so a first call
 * right after the switch can still miss — wait a beat.
 * @param {import('@deepseek-ai/dsh-tools').ToolRunContext} exec
 * @param {string} id - toolset id.
 * @param {string[]} required - tool names that must be visible.
 * @returns {Promise<boolean>}
 */
async function ensureToolset(exec, id, required) {
  const have = new Set(activeBridge?.list().map((tool) => tool.name) ?? [])
  if (required.every((toolName) => have.has(toolName))) return true
  const enabled = await callMcp(exec, 'enable_toolset', { toolset: id })
  if (enabled.ok) await new Promise((resolve) => setTimeout(resolve, 300))
  return enabled.ok
}

/**
 * Engine and mode control. Upstream keeps this behind `settings_set` and
 * `setup_doctor`, which live in the `setup` toolset and are therefore invisible
 * until it is opened — a model that needs Ghidra or Deep mode should not have to
 * discover that chain on its own.
 * @param {{ get: (name: string) => any }} ctx
 * @returns {any}
 */
function craftEngineDefinition(ctx, config) {
  return {
    name: 'craft_engine',
    description: '引擎与模式自检：status 看当前设置和外部引擎（Ghidra/adb/JEB…）；doctor 跑安装自检（客户端注册、引擎、MCP 是否应答）；deep-on / deep-off 切 Deep 模式；ghidra 指定本机 Ghidra 目录。会改设置的动作需要人工批准。',
    parameters: ENGINE_SCHEMA,
    timeoutMs: 600000,
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
    },
    async execute(args, exec) {
      const parsed = /** @type {{ action?: unknown, path?: unknown }} */ (args ?? {})
      const action = String(parsed.action ?? '')

      if (action === 'doctor') {
        if (!(await ensureToolset(exec, 'setup', ['setup_doctor']))) throw new Error('打开 setup 工具集失败（服务未连接？）')
        const doctor = await callMcp(exec, 'setup_doctor', {})
        return doctor.ok ? `安装自检：\n${clipText(doctor.text).slice(0, 8000)}` : `自检没跑成：${doctor.text}`
      }

      if (action === 'status') {
        if (!(await ensureToolset(exec, 'setup', ['settings_show', 'engines_list']))) throw new Error('打开 setup 工具集失败（服务未连接？）')
        const [settings, engines] = await Promise.all([
          callMcp(exec, 'settings_show', {}),
          callMcp(exec, 'engines_list', {}),
        ])
        const visible = new Set(activeBridge?.list().map((tool) => tool.name) ?? [])
        /** @type {Map<string, { seen: number, total: number }>} */
        const counts = new Map()
        for (const tool of catalog?.tools ?? []) {
          const key = tool.toolset ?? 'other'
          const entry = counts.get(key) ?? { seen: 0, total: 0 }
          entry.total += 1
          if (visible.has(tool.name)) entry.seen += 1
          counts.set(key, entry)
        }
        const args = (config?.args ?? []).map(String)
        const depth = `本桥启动参数：${args.length > 0 ? args.join(' ') : '(默认)'}${args.includes('--deep') ? ' —— Deep 模式在进程级就开着（配置里的 deep_mode 是持久设置，两者不是同一层）' : ' —— 没带 --deep：需要读目标内部时用 craft_engine deep-on'}`
        const surface = [...counts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => `${value.seen === value.total ? '✓' : '·'} ${key} ${value.seen}/${value.total}`)
        const promptCost = `提示段开销：常驻 ${BRIDGE_TEXT.length} B（每步都带）；本会话调用过任意 craft-anything 工具后，调查纪律再按需加 ${DISCIPLINE_TEXT.length} B，逆向模式的会话不重复加。`
        return [
          depth,
          '',
          '当前设置：',
          settings.ok ? clipText(settings.text).slice(0, 4000) : settings.text,
          '',
          '外部引擎：',
          engines.ok ? clipText(engines.text).slice(0, 2000) : engines.text,
          '',
          `服务端已列出 ${visible.size} 个工具，按工具集分布（✓ 全开 / · 部分或未开）：`,
          ...surface,
          '',
          promptCost,
          '（读设置与引擎要用 setup 工具集，所以这次调用把它打开了：只在服务进程内生效，不改配置文件，也不会进工具表。）',
        ].join('\n')
      }

      if (action === 'deep-on' || action === 'deep-off') {
        if (!(await ensureToolset(exec, 'setup', ['settings_set']))) throw new Error('打开 setup 工具集失败（服务未连接？）')
        const value = action === 'deep-on'
        await askApproval(
          ctx,
          exec,
          'settings_set',
          `要把 Deep 模式切成${value ? '开' : '关'}：开了之后工具能读目标内部的文件与源码。`,
          `Deep mode is about to be turned ${value ? 'on' : 'off'}; on means tools may read files inside the target.`,
        )
        const set = await callMcp(exec, 'settings_set', { key: 'deep_mode', value })
        return set.ok ? `deep_mode = ${value}\n${clipText(set.text).slice(0, 800)}` : `没改成：${set.text}`
      }

      if (action === 'ghidra') {
        const path = String(parsed.path ?? '').trim()
        if (path === '') return 'ghidra 动作需要 path：本机 Ghidra 安装目录，例如 %LOCALAPPDATA%\\ghidra_12.1.4_PUBLIC（Windows）或 /opt/ghidra（Linux）。'
        if (!(await ensureToolset(exec, 'setup', ['settings_set']))) throw new Error('打开 setup 工具集失败（服务未连接？）')
        await askApproval(
          ctx,
          exec,
          'settings_set',
          `要把 Ghidra 安装目录设成 ${path}（Deep 模式的反编译会用它）。`,
          `The Ghidra install directory is about to be set to ${path}.`,
        )
        const set = await callMcp(exec, 'settings_set', { key: 'engines.ghidra.install_dir', value: path })
        return set.ok ? `engines.ghidra.install_dir = ${path}\n接着可以 craft_engine action doctor 看 engine:ghidra 是否 ok。` : `没改成：${set.text}`
      }

      throw new Error(`action 取值：status / doctor / deep-on / deep-off / ghidra（收到 ${action || '空'}）`)
    },
  }
}

/**
 * Skill directories of the hosts the third-party wrappers install into. The
 * last segment is the skill id, matching what `skill.js` emits as `name:`.
 */
const HOST_SKILL_DIRS = {
  claude: ['.claude', 'skills', 'craft-anything-dsh'],
  codex: ['.codex', 'skills', 'craft-anything-dsh'],
  opencode: ['.agents', 'skills', 'craft-anything-dsh'],
  qoder: ['.qoder', 'skills', 'craft-anything-dsh'],
  cursor: ['.cursor', 'skills', 'craft-anything-dsh'],
}

/**
 * The directory the caller is working in. The Host bundle runs in the Harness
 * process, so `process.cwd()` is the install directory, not the session — read
 * the execution context first and only fall back to the process when nothing
 * carries a path.
 * @param {any} exec
 * @returns {string}
 */
function sessionCwd(exec) {
  const candidates = [exec?.cwd, exec?.workspace, exec?.session?.cwd, exec?.session?.workspace, exec?.session?.workdir]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return process.cwd()
}

/**
 * Where a `craft_skill_export` call writes, and whether that needs a human.
 *
 * Only the `host` form asks: it resolves into another application's home
 * directory, which the caller never named. An explicit `dir` is a path the
 * caller wrote down itself — it is written where it says, and the reply lists
 * every file so the write is visible after the fact.
 * @param {string} host
 * @param {string} dirArg
 * @param {any} exec
 * @returns {{ targets: string[], needsApproval: boolean }}
 */
function resolveSkillTargets(host, dirArg, exec) {
  const custom = String(dirArg ?? '').trim()
  if (custom !== '') return { targets: [custom], needsApproval: false }
  if (host === '' || host === 'dsh') return { targets: [join(sessionCwd(exec), 'skills', 'craft-anything')], needsApproval: false }
  const home = homedir()
  const at = (key) => join(home, ...HOST_SKILL_DIRS[key])
  if (host === 'all') return { targets: Object.keys(HOST_SKILL_DIRS).map(at), needsApproval: true }
  if (HOST_SKILL_DIRS[host] !== undefined) return { targets: [at(host)], needsApproval: true }
  return { targets: [], needsApproval: false }
}

/**
 * Write the host-neutral skill file. The other wrappers in the wild ship their
 * whole value as a SKILL.md copied into each host's skill directory; this makes
 * the same artefact an output of the bridge instead of a second repository.
 * @param {{ get: (name: string) => any }} ctx
 * @returns {any}
 */
function skillExportDefinition(ctx) {
  return {
    name: 'craft_skill_export',
    description: '把 Craft Anything 的操作规程（连接自检、渐进工具集、工作记忆与假设循环、证据分级、分页、错误码表、宿主对照、边界）导出成宿主无关的 SKILL.md。dir 直接写到你给的目录，不需要批准；host=claude/codex/opencode/qoder/cursor/all 写进那些宿主的 skills 目录（在本机别处，需要批准）；都不给则写 <当前会话目录>/skills/craft-anything。DSH 里工具已经直连，自己不需要读这份文件。',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          enum: ['dsh', 'claude', 'codex', 'opencode', 'qoder', 'cursor', 'all'],
          description: '目标宿主的 skill 目录；all 等于把那五个桌面宿主一次写完。',
        },
        dir: { type: 'string', description: '自定义目录，优先于 host；留空则按 host 或工作区默认。' },
        lang: { type: 'string', enum: ['zh', 'en'], description: 'SKILL.md 的语言；默认 zh。规则相同，只是措辞。' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
    },
    async execute(args, exec) {
      const parsed = /** @type {{ host?: unknown, dir?: unknown, lang?: unknown }} */ (args ?? {})
      const host = String(parsed.host ?? '').trim().toLowerCase()
      const lang = String(parsed.lang ?? 'zh').trim().toLowerCase() === 'en' ? 'en' : 'zh'
      const { targets, needsApproval } = resolveSkillTargets(host, /** @type {string} */ (parsed.dir), exec)
      if (targets.length === 0) {
        return `没认出 host：${host || '空'}（可选 dsh / claude / codex / opencode / qoder / cursor / all，或用 dir 指定目录）`
      }

      if (needsApproval) {
        await askApproval(
          ctx,
          exec,
          'skill_export',
          `要把 SKILL.md 写进本机其它 AI 宿主的 skill 目录：${targets.join('、')}`,
          `The skill file is about to be written into another host's skill directory: ${targets.join(', ')}`,
        )
      }

      const text = buildSkillMd({ lang })
      const written = []
      for (const target of targets) {
        try {
          mkdirSync(target, { recursive: true })
          const file = join(target, 'SKILL.md')
          writeFileSync(file, text, 'utf8')
          written.push(file)
        } catch (error) {
          written.push(`${target} ← 写不进去：${error instanceof Error ? error.message : String(error)}`)
        }
      }

      return [
        `已导出 ${text.length} 字节（${lang}），${written.length} 处：`,
        ...written.map((line) => `- ${line}`),
        '宿主里刷新技能列表即可看到 craft-anything-dsh；MCP 注册那一步仍由上游 `craft-anything-cli setup --client <id>` 负责（本插件在 DSH 里已经接好了）。',
      ].join('\n')
    },
  }
}

// ── plugin ─────────────────────────────────────────────────────────────────

/**
 * Register the bridge prompt, reverse mode, and the stage observer.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {{ sectionName?: string, reverseMode?: boolean, executable?: string, args?: string[], callTimeoutMs?: number, toolsets?: 'auto' | 'all' | string[] }} [config] - row configuration.
 */
export async function apply(ctx, config = {}) {
  const sectionName = config.sectionName ?? 'craft-anything'
  const order = typeof ctx.systemPrompt.getSectionOrder === 'function'
    ? ctx.systemPrompt.getSectionOrder('MCP_SERVERS')
    : undefined

  // One supervised connection for the whole process. Every step's tool list
  // and every `craft_tool` call are served from it.
  const bridge = createMcpBridge({
    exe: resolveExecutable(config.executable),
    args: Array.isArray(config.args) ? config.args : ['mcp', '--deep'],
    callTimeoutMs: config.callTimeoutMs ?? 600000,
    log: (message) => ctx.logger?.info?.(`craft-anything: ${message}`),
  })
  activeBridge = bridge
  ctx.effect(() => () => {
    if (activeBridge === bridge) activeBridge = undefined
    void bridge.dispose()
  }, 'craft-anything.bridge')
  try {
    await bridge.start()
  } catch (error) {
    ctx.logger?.error?.(`craft-anything: MCP server did not start: ${error instanceof Error ? error.message : String(error)}`)
  }

  ctx.effect(() => {
    const disposers = []
    const available = new Set(bridge.list().map((tool) => tool.name))
    for (const tool of bridge.list()) {
      if (!HOT_TOOLS.has(tool.name)) continue
      disposers.push(ctx.tools.register(hotToolDefinition(bridge, tool)))
    }
    disposers.push(ctx.tools.register(craftToolDefinition(ctx, bridge)))
    disposers.push(ctx.tools.register(craftEngineDefinition(ctx, config)))
    disposers.push(ctx.tools.register(skillExportDefinition(ctx)))
    const hidden = bridge.list().filter((tool) => !HOT_TOOLS.has(tool.name)).length
    const direct = disposers.length - 3
    ctx.logger?.info?.(`craft-anything: ${direct} tools registered directly + craft_tool / craft_engine / craft_skill_export, ${hidden} reachable by name`)
    if (available.size === 0) ctx.logger?.warn?.('craft-anything: the server listed no tools')
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'craft-anything.tools')

  ctx.effect(() => ctx.systemPrompt.section({
    name: sectionName,
    ...(order === undefined ? {} : { order }),
    interpolate: false,
    text: () => BRIDGE_TEXT,
  }), 'craft-anything.prompt')

  // Paid for only by sessions that have already called the server, and not by
  // reverse runs — their own section carries the same rules in Chinese.
  ctx.effect(() => ctx.systemPrompt.section({
    name: `${sectionName}.discipline`,
    interpolate: false,
    text: (context) => {
      const key = sessionKeyOf(context?.scope)
      if (key === undefined || !engaged.has(key)) return ''
      return runs.has(key) ? '' : DISCIPLINE_TEXT
    },
  }), 'craft-anything.discipline-prompt')

  if (config.reverseMode === false) return

  ctx.effect(() => ctx.systemPrompt.section({
    name: `${sectionName}.reverse`,
    ...(order === undefined ? {} : { order }),
    interpolate: false,
    text: (context) => {
      const state = runFor(context?.scope)
      return state === undefined ? '' : reverseText(state)
    },
  }), 'craft-anything.reverse-prompt')

  ctx.effect(() => ctx.tools.register({
    name: 'craft_reverse',
    description: '逆向复刻模式：开启后由 Craft Anything 打开原件、分诊、写简报，并按阶段推进“拆解原件 → 写规格 → 复刻 → 官方检查收敛 → 验收”。返回当前阶段的下一步调用清单。',
    parameters: STATE_SCHEMA,
    timeoutMs: 600000,
    output: {
      schema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: String(/** @type {{ text?: unknown }} */ (value)?.text ?? '') }],
    },
    presentCall: (args) => ({
      card: 'generic',
      title: `逆向模式 · ${String(/** @type {{ action?: unknown }} */ (args)?.action ?? 'status')}`,
      kind: 'other',
    }),
    async execute(args, exec) {
      const parsed = (args ?? {})
      const outcome = await runReverseAction(ctx, exec, parsed, { toolsets: config.toolsets })
      if (!outcome.ok && parsed.action === 'start') throw new Error(outcome.text)
      return { text: outcome.text }
    },
  }), 'craft-anything.reverse-tool')

  // Stage machine: watch the tool stream and advance the run when a Craft
  // Anything call fulfils the current stage's requirement.
  ctx.on('tools/post-execute', (exec, result, next) => {
    // Cost note: this runs on every tool call in the process, so the "did this
    // session touch the server" check happens before the reverse-run fast path —
    // a string prefix test and one Set lookup.
    const touched = typeof exec?.name === 'string'
      && (exec.name.startsWith(MCP) || exec.name === 'craft_tool' || exec.name === 'craft_engine' || exec.name === 'craft_reverse')
    if (touched) markEngaged(exec?.agent)
    // Fast path: with no reverse run alive this listener must cost one
    // comparison on every tool call in the process.
    if (runs.size === 0) return next()
    try {
      const tool = typeof exec?.name === 'string' ? exec.name : ''
      // A forwarded call arrives as `craft_tool`; the tool that actually ran is
      // in its arguments, so the stage machine must read both shapes.
      let bare = ''
      if (tool === 'craft_tool') {
        const forwarded = /** @type {{ name?: unknown }} */ (exec?.arguments ?? {}).name
        if (typeof forwarded === 'string') bare = forwarded
      } else if (tool.startsWith(MCP)) {
        bare = tool.slice(MCP.length)
      }
      if (bare === '' || TOOL_IDS.has(tool)) return next()
      const state = runFor(exec.agent)
      if (!state) return next()
      state.lastTool = bare
      const failed = Boolean(/** @type {any} */ (result)?.isError)
      if (failed) return next()
      const advance = (stage) => {
        if (STAGES.indexOf(stage) > STAGES.indexOf(state.stage)) {
          state.stage = stage
          state.log.push(stamp(`${bare} → ${stage}`))
        }
      }
      switch (bare) {
        case 'core_target_open':
          state.open = true
          break
        case 'core_target_triage':
          state.triaged = true
          if (state.stage === 'boot') advance('recon')
          break
        case 'core_brief_write':
          state.briefed = true
          break
        case 'enable_toolset':
          break
        case 'core_plan_update':
          advance('rebuild')
          break
        case 'rebuild_start':
          advance('diff')
          break
        case 'rebuild_check':
          state.checks += 1
          if (state.checks >= 1) advance('diff')
          break
        case 'project_build_finish':
          advance('accept')
          break
        case 'core_report_write':
        case 'core_handoff_write':
          if (state.checks > 0) advance('done')
          break
        default:
          if (state.stage === 'recon' && (bare.startsWith('native_') || bare.startsWith('js_') || bare.startsWith('web_') || bare.startsWith('app_'))) {
            state.log.push(stamp(`侦察 ${bare}`))
          }
      }
      if (state.log.length > 40) state.log.splice(0, state.log.length - 40)
      return next()
    } catch {
      return next()
    }
  }, { global: true })
}
