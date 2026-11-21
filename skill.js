/**
 * The exportable skill file.
 *
 * Upstream ships `crates/setup/src/skill.md` (metadata.version "2") and installs
 * it into the skill directory of whatever agent host it detects; third-party
 * wrappers copy the same idea into Qoder / Claude Code / OpenCode / Codex /
 * Cursor. The Harness plugin does not need a file to work — the tools are
 * registered directly — but hosts that only read a skill need one, and the
 * discipline that file encodes is worth carrying.
 *
 * Version 2 absorbs what v1 was missing, learned by reading the upstream file
 * line by line: when NOT to use this at all, trust the live tool list over any
 * document, the hypothesis record → update loop, `core_unknown_add` for what is
 * still open, "absence is not proof", summary-first paging, format-aware first
 * steps, and the finish checklist.
 *
 * Version 3 is bilingual: `lang: 'zh'` (default) or `lang: 'en'`. The rules are
 * identical, so a host that reads English gets the same discipline instead of a
 * Chinese file it cannot follow.
 */

/** Languages this file can be written in. */
export const SKILL_LANGS = ['zh', 'en']

/**
 * @param {{ lang?: string }} [options]
 * @returns {string} the whole SKILL.md body
 */
export function buildSkillMd(options = {}) {
  const lang = String(options.lang ?? 'zh').toLowerCase() === 'en' ? 'en' : 'zh'
  const front = frontMatter(lang)
  return lang === 'en' ? `${front}\n${EN}` : `${front}\n${ZH}`
}

/**
 * @param {'zh' | 'en'} lang
 * @returns {string}
 */
function frontMatter(lang) {
  const description = lang === 'en'
    ? 'Study how any program, website, game or file works with Craft Anything (17 toolsets, 323 tools) and let a coding agent rebuild its own version. In DSH the dsh-craft-anything plugin already wires the tools in; this file also drops into the skills directory of Claude Code, Codex, OpenCode, Qoder or Cursor.'
    : '用 Craft Anything（17 个工具集 / 323 个工具）研究任意软件、网站、游戏或文件如何运作，并让编码代理复刻出自己的版本。DSH 里由 dsh-craft-anything 插件直接接好；本文件也可放进 Claude Code、Codex、OpenCode、Qoder、Cursor 等宿主的 skills 目录。'
  return `---
name: craft-anything-dsh
description: ${description}
metadata:
  version: "2"
  lang: ${lang}
  upstream: https://github.com/storytold/craft-anything
  upstream_skill: crates/setup/src/skill.md
  bridge: dsh-craft-anything
---
`
}

const ZH = `# Craft Anything（DSH 桥接版）

当问题取决于「某个东西是怎么造出来的、怎么跑起来的」——可执行文件、库、.app、APK、
Electron 应用、WebAssembly、固件、崩溃转储、网络抓包——用这套工具，用证据回答。

**什么时候别用**：手里就有源码、问题又只关于源码，直接读源码更快更准。
这门工具处理的是「已经发布出去、只有二进制」的东西。**信任实时工具表**：本文件可能与
引擎版本有偏差，工具表里的名字和参数才是真的。

## 0. 先看连接，别先修连接

- 工具表里已经有 \`mcp__craft-anything__*\` 或 \`craft_tool\` → 直接干活，**不要**先跑 setup / doctor。
- **已经列出全部工具的条目，绝不要重复 \`setup --yes\`**：setup 写的是裸 \`mcp\` 命令，会把条目里的
  \`--deep\` / \`--all-tools\` 覆盖掉，服务随后退回小工具集。
- \`doctor\` 会把带额外参数的条目说成「形状不同的命令」并建议重跑 setup——**不要照做**，
  它只是在比对形状，不是坏了。\`setup --dry-run\` 只打印计划，安全。
- 只有小工具集是默认列出的。要别的：\`list_toolsets\` → \`enable_toolset\`。
- 净室 / 深挖：本桥默认 \`--deep\`。若被拒并给出 \`details.reason = clean_room\`，
  告诉人要开 Deep 模式（\`craft_engine\` action \`deep-on\`，或 \`settings_set deep_mode true\`，
  或服务端 \`--deep\`），**不要**想办法绕过去。

## 1. 工具面：省上下文的规矩

- 只有少数高频工具直连；其余一律 \`craft_tool {"name":"<工具名>","arguments":{…}}\` 按名调用。
  名字不带 \`mcp__craft-anything__\` 前缀。
- \`craft_tool {"name":"*"}\` 列出当前可用工具（最多 120 行）；名字带通配则是检索：\`"adb*"\` 前缀、\`"*local"\` 后缀、\`"*window*"\` 包含，找不到会直接说「没有名字匹配 …」而不是报错。
- \`enable_toolset\` 打开的工具**不会**进入工具表，这是故意的：工具面越大，每一步越贵。
  看不到不等于不能用，按名调即可。
- 18 个会执行命令、写文件、改设置、装引擎、花钱或自批的工具要先拿到人工批准；
  批不下来就停手并说明，别换一条路偷偷跑。

## 2. 工作记忆：每轮都更新

长调查比任何一个上下文窗口都长。简报、计划、假设、结论、未决项和交接记录一直在，每轮都用：

1. **开工或续作**：先 \`core_investigation_show\`。有 handoff 就从它续，别从头再来；
   \`core_session_show\` 看还有什么开着。
2. **新问题**：任何分析之前先 \`core_brief_write\`（问题、为什么问、目标、约束如「别运行它」、
   什么算答完），再 \`core_plan_update\` 给编号步骤（todo / doing / done / blocked，各带一句理由）。
3. **先预测再验证**：形成值得检验的判断就 \`core_hypothesis_record\`，写下**什么结果会证实或推翻它**；
   跑完工具，证据到了就 \`core_hypothesis_update\`（supported / refuted / abandoned）并挂证据 id。
   结果与预期不符时，改假设，不要把反常识的结果解释掉。
4. **每批调用之后**：更新计划状态（done / blocked 带理由）。
5. **定论**：\`core_finding_record\` 写结论 + 至少一个证据 id。报告只从 findings 长出来，
   不从聊天文字长。
6. **没搞清的**：\`core_unknown_add\` 记下「还缺什么、为什么重要」。
7. **每轮结束时**：\`core_handoff_write\`——现状、下一步、坑（死路、慢工具、误导性字符串）。
   忘了上一步在干什么，用 \`core_journal_read\` 回放之前的工具调用与回合。

## 3. 从观察到复刻

1. **锁定目标**：绝对路径或 URL。人说「我的 app」没说哪一个，就问是哪个，别拿示例文件猜。
2. **打开**：\`core_target_open\`；\`core_target_triage\` 给出格式、架构、建议工具集；按需 \`enable_toolset\`。
   按**格式**而不是按扩展名选路：
   | 目标 | 首步 |
   |---|---|
   | 原生程序（PE/ELF/Mach-O） | \`core_target_open\` → overview → 搜字符串 / 看函数 → native |
   | Electron / .asar | 打开 → javascript 工具集 |
   | APK / DEX | 打开 → android（要真机再加 adb） |
   | .NET 程序集 | 打开 → managed |
   | WASM / Go / PE 资源 / 固件 / 崩溃转储 | 打开 → formats |
   | 活网页或 Electron 窗口 | browser 工具集（只观察，别乱点） |
   | 同一应用的两个版本 | application（对比布局、资源、行为差异） |
3. **拆**：\`core_overview_show\` 看结构，\`core_feature_find\` 从界面文案追到函数，再进细看。
4. **大结果**：先要摘要（带 evidence id），再按 offset/limit 或 \`evidence://<id>\` 分页取片段。
   同一调用重复很多次通常说明该分页了。
5. **写规格**：把观察写成能施工的说明——布局、配色、字体、交互、数据流，每条挂证据 id。
6. **复刻**：\`rebuild_start\`（要 projects 工具集）；产物写到项目目录，用当前会话的编码能力干活。
   在请求里说清要什么技术栈。
7. **收敛**：只有 \`rebuild_check\`（官方检查，逐项比对原件）算证据。差异翻成具体改动 →
   \`rebuild_note\` → 复检。连续两次没提升就换方向或问人。
8. **验收**：全部检查通过 → \`project_build_finish\` → \`core_report_write\` → \`core_handoff_write\`。

DSH 里这套流程有状态机：\`craft_reverse\` action \`start\` / \`status\` / \`next\` / \`note\` / \`stage\` / \`stop\`，
它按工具调用自动推进阶段，并告诉下一步该调什么。

## 4. 证据分级（写结论时必须标）

- **observed**：直接从字节、抓包、界面上读到的。
- **derived**：从观察算出来的（控制流图、调用图）。
- **inferred**：判断（命名、意图、某个模型的解读）。

**反证不是证明**：「没找到字符串」「没有调用者」只覆盖你搜过的范围。写明搜索边界和工具自报的
覆盖度；真正要紧但还没搞清的记一条 \`core_unknown_add\`。静态分析看到的是代码，不等于运行时
就是这样——要断言运行行为，得有运行时的证据（抓包、日志、调试器、Frida）。

## 5. 边界

- 只研究你自己拥有或获授权研究的软件。
- 不绕 DRM、登录校验、反作弊。
- 复刻是从证据重建布局/样式/行为；商标、logo、照片、文案不要搬，除非你有权利。
- 秘密、cookie、个人数据不进 note / findings / handoff。
- 会跑目标代码或改设备的工具需要人明确同意（\`consent_required\`）。

## 6. 出错怎么读

| 错误码 | 怎么办 |
|---|---|
| \`not_found\` | 先 \`core_target_open\` 打开目标，或检查路径/名字 |
| \`feature_missing\` / \`engine_missing\` | 读它给出的补救：说清缺哪个工具集、引擎或设置 |
| \`over_limit\` | 结果太大，先读摘要再分页（\`core_evidence_browse\`） |
| \`stale_revision\` | 重新 \`core_investigation_show\` 合并后再试 |
| \`content_required\` | 补上缺的参数，不要猜 |
| \`clean_room\` | 需要 Deep 模式，开它，别绕 |
| \`consent_required\` | 先问人，批准后再跑 |

## 7. 收工清单

- 计划里每一步都标了 done 或 blocked；
- 每条结论都对应一条 finding（带证据 id）；
- 还未知的都写进了 unknown 或 handoff；
- handoff 写清了下一步与坑。

## 8. 宿主对照

| 宿主 | 怎么接 |
|---|---|
| **DSH（DeepSeek Harness）** | 装 \`dsh-craft-anything\` 插件：MCP 桥 + 精简工具面 + 侧栏目录 + \`craft_reverse\`。本文件由 \`craft_skill_export\` 导出，仅作参考或给别的宿主用 |
| Claude Code | \`~/.claude/skills/craft-anything-dsh/SKILL.md\` + \`~/.claude.json\` 里的 MCP 注册（上游 \`setup --client claude-code\`） |
| Codex | \`~/.codex/skills/craft-anything-dsh/SKILL.md\` + \`~/.codex/config.toml\` |
| OpenCode | \`~/.agents/skills/craft-anything-dsh/SKILL.md\` + \`~/.config/opencode/opencode.json\` |
| Qoder | \`~/.qoder/skills/craft-anything-dsh/SKILL.md\` + \`~/.qoder/settings.json\` |
| Cursor | \`~/.cursor/skills/craft-anything-dsh/SKILL.md\` + \`~/.cursor/mcp.json\` |

\`craft_skill_export\` 写的目录名固定是 \`craft-anything-dsh\`，和上游 \`setup\` 装的那份 \`craft-anything\` 分开：
两份可以同时存在，互不覆盖。没检测到的宿主也可以提前拷进去，装了就能用；
MCP 注册那一步等宿主存在时再跑。

## 9. 引擎

- **Ghidra**（Deep 模式用）：\`settings_set engines.ghidra.install_dir\` 指到本地 Ghidra，
  \`engines.ghidra.java_home\` 指到 JDK，然后 \`doctor\` 看 \`engine:ghidra => ok\`。
  内置引擎没有 Ghidra 也能跑，Ghidra 只是反编译更细。DSH 里用 \`craft_engine\` action \`ghidra\` + \`doctor\`。
- **IDA Pro**：不由 Craft Anything 驱动。要 IDA 就用配套的 REA MCP（\`provider_id: "ida"\`）当另一路证据，
  不要说成 Craft Anything 用了 IDA。
`

const EN = `# Craft Anything (DSH bridge edition)

Reach for this when the question turns on **how something was built or how it
runs** — an executable, a library, a .app bundle, an APK, an Electron app,
WebAssembly, firmware, a crash dump, captured traffic. Answer with evidence.

**When not to use it**: you already have the source and the question is only
about that source. Reading it is faster and more accurate. This toolset is for
what has shipped and is left as bytes. **Trust the live tool list** over this
file: the names and schemas the tools report are the truth, this document may
lag a release behind.

## 0. Check the connection before repairing it

- If the tool list already shows \`mcp__craft-anything__*\` or \`craft_tool\`,
  start working. Do **not** run setup or doctor first.
- **Never point \`setup --yes\` at an entry that already lists every tool.**
  Setup writes the bare \`mcp\` command and silently drops \`--deep\` /
  \`--all-tools\` from that entry, and the server falls back to the small toolset.
- \`doctor\` calls an entry with extra arguments "a command of a different shape"
  and suggests re-running setup. **Do not follow that** — it is comparing shapes,
  not reporting damage. \`setup --dry-run\` only prints a plan and is safe.
- Only a small toolset is listed by default. For more: \`list_toolsets\` →
  \`enable_toolset\`.
- Clean room vs deep: this bridge starts with \`--deep\`. If a call answers
  \`details.reason: clean_room\`, tell the human Deep mode is needed
  (\`craft_engine\` action \`deep-on\`, or \`settings_set deep_mode true\`, or a
  server started with \`--deep\`). **Do not** look for a way around it.

## 1. Keeping the tool surface cheap

- Only a handful of hot tools are registered directly. Call everything else by
  name: \`craft_tool {"name":"<tool>","arguments":{…}}\`, without the
  \`mcp__craft-anything__\` prefix.
- \`craft_tool {"name":"*"}\` lists the tools that are available right now (up to
  120 lines). A \`*\` inside the name searches instead of calling: \`"adb*"\`
  prefix, \`"*local"\` suffix, \`"*window*"\` contains. No match answers
  "no tool matches …" rather than failing.
- Tools opened by \`enable_toolset\` deliberately stay **out** of the tool list:
  a bigger surface costs every step of the conversation. Not listed is not
  unavailable — call it by name.
- Eighteen tools that run commands, write files, change settings, install
  engines, spend money or self-approve need a human approval first. If the
  approval does not come, stop and say so; do not quietly find another route.

## 2. Working memory, updated every turn

A long study outlives any context window. Brief, plan, hypotheses, findings,
unknowns and the handoff live on disk; use them every turn:

1. **Starting or resuming**: \`core_investigation_show\` first. If there is a
   handoff, continue from it instead of starting over. \`core_session_show\` says
   what else is open.
2. **A new question**: \`core_brief_write\` before any analysis (the question, why
   it is asked, the targets, constraints such as "do not run it", what a finished
   answer looks like), then \`core_plan_update\` with numbered steps (todo /
   doing / done / blocked, each with a one-line reason).
3. **Predict, then verify**: when a judgement is worth testing,
   \`core_hypothesis_record\` it together with **what result would confirm or
   refute it**. After the tools run, \`core_hypothesis_update\` (supported /
   refuted / abandoned) with the evidence ids. When reality disagrees, change the
   hypothesis — do not explain the surprise away.
4. **After each batch of calls**: update the plan status (done, or blocked with a
   reason).
5. **Settled answers**: \`core_finding_record\` with at least one evidence id.
   Reports grow out of findings, never out of chat text.
6. **Still unknown**: \`core_unknown_add\` — what is missing and why it matters.
7. **At the end of every turn**: \`core_handoff_write\` — where things stand, the
   next step, and the traps (dead ends, slow tools, misleading strings). If you
   lose the thread, \`core_journal_read\` replays the calls and turns so far.

## 3. From observation to a rebuild

1. **Pin the target**: an absolute path or a URL. If the human says "my app"
   without naming one, ask which — do not guess from an example file.
2. **Open it**: \`core_target_open\`; \`core_target_triage\` reports format,
   architecture and the toolsets it suggests; enable what you need. Choose by
   **format**, not by extension:

   | Target | First step |
   |---|---|
   | Native program (PE/ELF/Mach-O) | \`core_target_open\` → overview → search strings / read functions → native |
   | Electron / .asar | open → javascript toolset |
   | APK / DEX | open → android (add adb for a real device) |
   | .NET assembly | open → managed |
   | WASM / Go / PE resources / firmware / crash dumps | open → formats |
   | A live site or an Electron window | browser toolset (observe, do not click around) |
   | Two versions of one app | application (compare layout, resources, behaviour) |

3. **Take it apart**: \`core_overview_show\` for structure, \`core_feature_find\` to
   walk from UI text to the function behind it, then go deeper.
4. **Large results**: ask for the summary and its evidence id, then page with
   offset/limit or \`evidence://<id>\`. Repeating the same call usually means it is
   time to page.
5. **Write the spec**: turn observations into something buildable — layout,
   palette, fonts, interaction, data flow, every line carrying an evidence id.
6. **Rebuild**: \`rebuild_start\` (needs the projects toolset); the output goes
   into the project directory and the session's own coding ability does the work.
   Say which stack you want in the request.
7. **Converge**: only \`rebuild_check\` (the official check, comparing against the
   original item by item) counts as evidence. Translate each difference into a
   concrete change → \`rebuild_note\` → check again. Two rounds without
   improvement: change direction or ask the human.
8. **Accept**: all checks pass → \`project_build_finish\` → \`core_report_write\` →
   \`core_handoff_write\`.

In DSH this flow has a state machine: \`craft_reverse\` with action \`start\` /
\`status\` / \`next\` / \`note\` / \`stage\` / \`stop\`. It advances from the tool calls
you make and tells you what to call next.

## 4. Evidence grades (label them in every conclusion)

- **observed**: read straight off bytes, captured traffic or a UI.
- **derived**: computed from those (a control-flow graph, a call graph).
- **inferred**: a judgement (naming, intent, someone's interpretation).

**Absence is not proof**: "no matching string" and "no callers" cover only the
range you searched. State the search boundary and the coverage the tool reported,
and record load-bearing gaps with \`core_unknown_add\`. Static analysis shows code,
not runtime behaviour — claiming how something behaves at runtime needs runtime
evidence (captured traffic, logs, a debugger, Frida).

## 5. Boundaries

- Study only software you own or are authorised to study.
- Do not bypass DRM, login checks or anti-cheat.
- A rebuild reconstructs layout, styling and behaviour from evidence. Do not move
  trademarks, logos, photographs or copy across unless you have the rights.
- Secrets, cookies and personal data never go into notes, findings or handoffs.
- Tools that run the target's code or change a device need explicit human consent
  (\`consent_required\`).

## 6. Reading an error

| Code | What to do |
|---|---|
| \`not_found\` | \`core_target_open\` first, or check the path or name |
| \`feature_missing\` / \`engine_missing\` | read the remedy it names: which toolset, engine or setting is missing |
| \`over_limit\` | the result is too large: read the summary, then page with \`core_evidence_browse\` |
| \`stale_revision\` | \`core_investigation_show\` again, merge, then retry |
| \`content_required\` | supply the missing argument; do not guess |
| \`clean_room\` | this needs Deep mode — turn it on, do not work around it |
| \`consent_required\` | ask the human, then run it |

## 7. Finish checklist

- every plan step is marked done or blocked;
- every conclusion has a finding behind it (with evidence ids);
- what is still unknown is written into unknowns or the handoff;
- the handoff states the next step and the traps.

## 8. Host matrix

| Host | How to connect |
|---|---|
| **DSH (DeepSeek Harness)** | install the \`dsh-craft-anything\` plugin: MCP bridge + slim tool surface + sidebar catalog + \`craft_reverse\`. This file is what \`craft_skill_export\` writes; here it is reference material for other hosts |
| Claude Code | \`~/.claude/skills/craft-anything-dsh/SKILL.md\` + MCP registration in \`~/.claude.json\` (upstream \`setup --client claude-code\`) |
| Codex | \`~/.codex/skills/craft-anything-dsh/SKILL.md\` + \`~/.codex/config.toml\` |
| OpenCode | \`~/.agents/skills/craft-anything-dsh/SKILL.md\` + \`~/.config/opencode/opencode.json\` |
| Qoder | \`~/.qoder/skills/craft-anything-dsh/SKILL.md\` + \`~/.qoder/settings.json\` |
| Cursor | \`~/.cursor/skills/craft-anything-dsh/SKILL.md\` + \`~/.cursor/mcp.json\` |

\`craft_skill_export\` always writes to a directory named \`craft-anything-dsh\`, so
it coexists with the \`craft-anything\` file upstream setup installs — neither
overwrites the other. Hosts you have not installed yet can be pre-seeded; the MCP
registration step can wait until that host exists.

## 9. Engines

- **Ghidra** (used in Deep mode): point \`settings_set engines.ghidra.install_dir\`
  at a local Ghidra and \`engines.ghidra.java_home\` at a JDK, then check
  \`doctor\` for \`engine:ghidra => ok\`. The built-in engine works without Ghidra;
  Ghidra only decompiles in more detail. In DSH use \`craft_engine\` action
  \`ghidra\` plus \`doctor\`.
- **IDA Pro** is not driven by Craft Anything. For IDA, use the companion REA MCP
  (\`provider_id: "ida"\`) as a second line of evidence, and do not claim Craft
  Anything used IDA.
`
