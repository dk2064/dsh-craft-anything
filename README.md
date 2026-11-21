# dsh-craft-anything

[Craft Anything](https://github.com/storytold/craft-anything)（ArtCraft）是纯 Rust 的“研究任意软件、网站、游戏或文件，再让编码代理复刻你自己的版本”引擎。它自带 CLI + MCP 服务，把 323 个工具以 `tools/list` 暴露出去。

这个插件包把那台引擎接进 DeepSeek Harness，并把“每轮请求要背多少工具 schema”当成一等约束。

> 非官方桥接：与本项目上游作者无隶属关系，边界与归属见文末 [声明](#声明)。

## 快速开始

```powershell
# 0. 装引擎（一次性，二选一）：
pwsh -File install.ps1              # Windows：自动找最新 release 并下载到 ~/.dsh/tools/craft-anything
./install.sh                        # macOS / Linux；FORCE=1 强制重下
#    或手动从 https://github.com/storytold/craft-anything/releases 取 portable 包
craft-anything-cli --version        # 期望 craft-anything-cli 0.6.x

# 2. 让 Harness 加载本插件：cordis.patch.yml 里 executable 指向上面那个 exe

# 3. 重启 Harness —— 侧栏出现 Craft Anything，工具表多出 17 个工具

# 4. 想让别的宿主也有这套规程，让模型跑一次：
#    craft_skill_export { "host": "all" }
```

装完最省事的自检是 `craft_engine action=status`：它回当前设置、外部引擎，以及 17 个工具集各自可见多少工具。

## 六件事

1. **精简 MCP 桥**（`bridge.js`）：自己用 stdio JSON-RPC 连 `craft-anything-cli mcp --deep`，只把 13 个高频工具注册成一等工具，其余全部走 `craft_tool` 按名调用。默认关掉 `@deepseek-ai/dsh-mcp-client`，因为它无条件注册 39 个工具、每轮 40KB。
2. **渐进式工具集**：`list_toolsets` → `enable_toolset` 打开 native / formats / browser / android 等；打开后新工具立即能用 `craft_tool` 调，但**不会**进入工具表。
3. **逆向复刻模式**：`craft_reverse` 开一轮“拆原件 → 写规格 → 复刻 → 官方检查收敛 → 验收”，另附一个可选预设（[preset/](preset)）：装好后在模式选择器里直接选「逆向复刻模式」，打一句目标就自动按七阶段跑。
4. **引擎与模式控制**：`craft_engine` 一个工具管住 `status`（设置 + 外部引擎现状）、`doctor`（安装自检）、`deep-on` / `deep-off`（Deep 模式）、`ghidra`（指到本机 Ghidra）。上游把这些散在 `setup` 工具集里，模型不查 `list_toolsets` 就摸不到。
5. **宿主无关 SKILL.md 导出**：`craft_skill_export` 把整套操作规程（连接自检、渐进工具集、工作记忆、证据分级、错误码表、宿主对照、边界）写成一份 SKILL.md；带 `host=claude|codex|opencode|qoder|cursor|all` 就直接落到那些宿主的 skills 目录里（`craft-anything-dsh`，不覆盖上游那份）。
6. **侧栏功能面板**：完整 17 工具集 / 325 工具目录，每个工具一句中文释义（英文原文作悬停提示），可搜索（中英文都匹配，120ms 防抖）、按工具集折叠、每组最多渲染 40 行。

## 和上游本体比

上游 Craft Anything 是完整的 Rust 桌面程序加 CLI，本插件只搬它的工具面进 Harness。两边各有各的强项：

| 维度 | 上游本体（桌面 App / CLI / MCP） | 本插件（DSH 侧） |
|---|---|---|
| 形态 | 装一个 200MB 起的 Rust 程序，自带界面 | 一个几十 KB 的 Node 桥 + 侧栏面板 |
| 模型 | 自己接编码代理（Claude Code、Codex 等），由外部调度 MCP | 直接用当前会话的模型，切到「逆向复刻模式」就开工 |
| 工具暴露 | `tools/list` 一次给全量（默认 30–39 个，开满 323） | 15 个一等工具，其余按名转发，首轮不背全量 |
| 每步上下文 | 39 个工具 schema ≈ 11,500 tokens | 4,300 tokens，省 63% |
| 流程 | Study → Build → Check → Refine，靠模型自觉 | `craft_reverse` 七阶段状态机，看工具调用自动推进 |
| 安全默认值 | 默认净室（Clean room），Deep 手动开 | 直接 `--deep`（不然半个工具集是空的），用 18 项审批补回约束 |
| 可视化 | 桌面应用里的截图、像素比对、报告视图 | 侧栏目录：325 条中文释义、可搜索、可折叠；**看不到也不操作分析结果** |
| 上手 | 下载 portable 包解压即用 | 装一次 CLI，插件侧只配一个 `executable` 路径 |
| 更新 | 应用自己管 | 面板「检查更新」读 GitHub 最新 Release 与引擎版本对比（本轮新增） |

我们的长处是**把引擎塞进已有的代理工作流**：不用另开一个 app、不用第二套模型配置、上下文开销压到三分之一、复刻过程有阶段和收尾动作而不是自由发挥。

我们的短板同样明确：

- **没有桌面 UI**。上游在应用里能看到目标截图、字体配色抽样、像素差异热图，这里只有一段 JSON 结果和证据 id，要看得进 `core_evidence_browse` 翻。
- **面板是只读目录**。它解释「有什么工具」，不能点一下就跑；真要执行还得让模型调工具。
- **默认 Deep**。上游用净室表达克制，我们用审批表达；对「只想看看网页长什么样」的用户，审批噪音比净室模式多。
- **二进制要自己装**。patch 里的 `executable` 支持绝对路径、`%VAR%` / `$VAR` 模板，或留空让 PATH 去找 `craft-anything-cli`；换机器只需改一处。
- **只支持 stdio**。上游 MCP 还能挂在别的客户端上，这里绑死本机进程。
- 上游仍是 early alpha（维护者自述），它的接口变更会直接打到桥接层；`catalog.json` 需要重新生成。

## 学自上游 skill 的纪律（v2）

读了上游 `crates/setup/src/skill.md`（v2）和第三方 `anywhere` 包装之后，把其中能被机制接住的部分落进了插件，而不是抄成一段文字：

| 纪律 | 落在哪 |
|---|---|
| 有源码、问题又只关于源码 → 直接读源码，别绕这一圈 | 常驻提示段 |
| 信任实时工具表胜过任何文档（包括这份 README 和导出的 SKILL.md） | 提示段 + SKILL.md 开头 |
| 工作记忆七环：`brief` → `plan` → `hypothesis_record` → `hypothesis_update` → `finding` → `unknown` → `handoff` | 提示段（一行链）+ reverse 阶段清单 + 预设 persona |
| 先预测再验证：先写下「什么结果会证实或推翻」，结果不符就改假设 | 提示段 + reverse 规矩 + persona |
| 没搜到不是不存在：写明搜索边界，未决记 `core_unknown_add` | 同上三处 |
| 大结果先读摘要再分页（`core_evidence_browse` 的 offset/limit、`evidence://<id>`） | 提示段 + reverse 规矩 |
| 按格式而不是扩展名选首步（7 类目标对照表） | `skill.js` 第 3 节 |
| `doctor` 会把带 `--all-tools` 的条目说成「形状不同的命令」并建议重跑 `setup` —— 别照做；`setup --dry-run` 只是打印计划，安全 | `skill.js` 第 0 节 |
| 收工清单：计划每步 done/blocked、结论对得上 finding、未知进 unknown 或 handoff | `skill.js` 第 7 节 |
| 秘密 / cookie / 个人数据不进记忆；静态分析不能断言运行时行为 | `skill.js` 第 4、5 节 |

没吸收的部分也写清楚：上游那份文件是给「只能读文件的宿主」准备的，端口自检、渐进工具集在插件里已经是机制（`ensureToolset`、`craft_engine`、按名转发），不需要再靠文字提醒一遍。
## 和 skill 方案比

外面还有另一条接法：不写插件，只写一份 `SKILL.md` 塞进宿主的 skills 目录，再用上游 `setup` 注册 MCP。代表是上游自带的 `crates/setup/src/skill.md`（v2）和第三方包装 [saintedKyle/craft-anything-skill](https://github.com/saintedKyle/craft-anything-skill) 的 `anywhere/`（install.ps1 / install.sh + `craft-anything-anywhere`）。这条路很轻，也很聪明；值得逐项对上。

| 维度 | skill 方案（SKILL.md + setup） | 本插件 |
|---|---|---|
| 宿主范围 | 一份文件铺到 Claude Code / Codex / OpenCode / Qoder / Cursor（连没装的宿主也预拷） | DSH 原生；`craft_skill_export host=all` 一条命令把同一份规程写进那五个目录（目录名 `craft-anything-dsh`，不覆盖上游装的那份） |
| 安装 | 跑 installer：下 CLI、`setup --all-detected --yes`、开 deep、指 Ghidra、拷 skill、打 doctor | 装一次 CLI + patch 里一行；面板显示引擎版本与「检查更新」，Deep / Ghidra 走 `craft_engine` |
| 上下文成本 | MCP 注册后工具全量进工具表（39 → 323） | 13 直连 + `craft_tool` 按名转发，每步 schema 省 63% |
| 过程控制 | 全靠文字纪律，模型自守 | `craft_reverse` 七阶段状态机，按工具调用自动推进 |
| 危险动作 | 文字写「需要用户 OK」，能不能拦取决于宿主 | 18 项走 `ctx.approval.request()`，无审批服务直接 fail closed |
| Deep / 净室 | 说明怎么切，要自己敲 `settings_set` | `craft_engine deep-on / deep-off`，带审批 |
| Ghidra | 文字给三步 settings_set + doctor | `craft_engine ghidra` + `doctor`，一句话到位 |
| 错误码 | 有表，但模型只在读 skill 那一次看到 | 写进常驻提示段，每一轮都在；`craft_tool` 结果也带原文 |
| 发现工具 | `list_toolsets` 的 JSON 输出 | 侧栏 325 条中文释义，可搜索可折叠 |
| 语言 | 全英文 | 面板、释义、导出件、提示段、声明全中文 |
| 可审性 | **一份十几 KB 的纯文本，谁都能读能改能 diff** | 要读代码；没装插件的人用不上 |

诚实说三处它是赢的：

- **可审计**：SKILL.md 是纯文本，一眼看完；桥接层是代码，信任成本更高。
- **可移植**：一份文件铺五个宿主、装了就生效，这条它做得彻底。我们现在能用 `host=all` 把规程一次写到那五个目录，但**只管文件**——那五个宿主各自的 MCP 注册仍要上游 `setup --client <id>` 去跑。
- **零上下文**：skill 只在你读它的时候进上下文；我们的提示段每步都在（2,888 字节，约 825 tokens）。这一条我们做了一版折中：调查纪律（记忆七环、没搜到不算不存在、大结果先分页、证据分级）**改成按需注入**——会话没调用过 craft-anything 时只付 2,888 字节，调用过一次后才加 571 字节。skill 方案仍是零，但从"每步 3,678"降到"要么 2,888、要么 3,459"。

我们赢的地方在**执行侧**：工具面小三分之一、过程有状态机、危险动作有审批闸门、Deep/引擎不用自己摸、目录有中文解释。skill 是一张说明书，插件是一台接好线的机器——说明书当然更轻，但它不会帮你把 18 个改机器的动作拦下来。



| 指标 | 改前（dsh-mcp-client） | 改后（精简桥） |
|---|---|---|
| 每步工具 schema | 40,311 字节 ≈ 11,500 tokens | **15,121 字节 ≈ 4,320 tokens**（省 63%） |
| 注册的工具数 | 39 | 13 + `craft_tool` + `craft_engine` + `craft_skill_export` + `craft_reverse` |
| 每步 schema deep-clone | 39 份 | 18 份 |
| 提示段构造 | 每步重拼 17 行 | 模块加载时算一次；纪律段按会话状态决定要不要加 |
| `tools/post-execute` 监听 | 每次工具调用进入 | 无逆向任务时一次比较即返回 |
| 逆向开局往返 | open → triage → brief → enable（4 次） | open → triage∥brief → enable（3 次） |
| 面板搜索 | 每键重筛 325 行 | 120ms 防抖 + 每组 40 行上限 |

其余实测（`node tools/bench.mjs`）：MCP 冷启动 20–28ms，`tools/list` 2–4ms，`core_target_triage` 约 200–260ms（真分析，无法优化），面板容器构建 0.8ms。

## 安全

`craft_tool` 等于把 300+ 个工具的调用面收进一个工具，所以这里必须自己把关，而不是假设 Harness 的审批会自动覆盖：

| 防线 | 行为 |
|---|---|
| 危险工具审批 | 18 个会执行命令、写文件、改设置、装引擎、花钱或自批的工具，转发前调 `ctx.approval.request()`；只有 `allowed-once` 才执行，其余抛错并在会话里留下结果 |
| 无审批服务时 | 直接拒绝（fail closed），不会静默放行 |
| 递归与越界 | `craft_reverse` / `craft_tool` / `mcp__*` 一律拒绝转发，`craft_tool` 无法变成调 Harness 自身工具的通道 |
| 名字校验 | `^[A-Za-z0-9_.-]{1,64}$`，路径式名字直接拒绝 |
| 结果截断 | 单条结果超过 200,000 字符截断，并指向 `core_evidence_browse` 分页 |
| 目录上限 | `craft_tool {name:"*"}` 最多 120 行；带通配的名字走检索，不触发调用也不走审批 |
| 协议鲁棒性 | 单行超过 32MB 视为协议故障并丢弃；启动失败按 0/0.5/1.5/4/8s 退避；EPIPE、进程退出都会清空在飞请求 |
| 状态隔离 | 逆向运行按 Session 精确寻址，不跨会话回退；内存里最多 32 轮 |

残余风险（明确写下，不当它不存在）：

- `executable` 是 patch 里的绝对路径，配错或被人改掉就是执行任意程序——这是配置信任，不是代码缺陷。
- `rebuild_check` 直连不审批（它是复刻循环的核心，每轮都要跑）；它会构建项目，需要更严就把 `rebuild_check` 从 `HOT_TOOLS` 移到 `DANGEROUS_TOOLS`。
- `--deep` 让工具能读目标文件与页面源码；读什么范围由模型与用户决定，插件不做路径白名单。
- 子进程 stderr 会进 Host 日志（每条截断 400 字符）。


## 工具表（13 个直连）

`core_target_open` `core_target_triage` `core_session_show` `core_investigation_show` `core_evidence_browse` `core_brief_write` `core_plan_update` `core_finding_record` `core_handoff_write` `core_report_write` `rebuild_start` `rebuild_check` `list_toolsets` `enable_toolset` + `craft_tool` + `craft_engine` + `craft_skill_export` + `craft_reverse`

`craft_engine` 取值：`status`（设置 + 外部引擎）/ `doctor`（安装自检）/ `deep-on` / `deep-off` / `ghidra`（带 `path`）。会改设置的三项要人工批准。

`craft_skill_export` 取值：`host`（`dsh` / `claude` / `codex` / `opencode` / `qoder` / `cursor` / `all`，写进对应宿主的 skills 目录，目录名 `craft-anything-dsh`）或 `dir`（任意目录，默认 `<cwd>/skills/craft-anything`），写出一份宿主无关的 [SKILL.md](skill.js)。`dir` 是你自己写下的路径，直接写、不再要批准；`host` 会写进别的应用的 home 目录，那一步要批准。

其余一切（如 `native_function_study`、`web_site_open`、`rebuild_start`）：

```
craft_tool { "name": "native_function_study", "arguments": { "function": "main" } }
craft_tool { "name": "*" }        # 列出当前服务端提供的全部工具
craft_tool { "name": "frida*" }   # 前缀检索；"*local" 后缀、"*window*" 包含，找不到时直接说「没有名字匹配」
```

## 回滚到完整工具表

1. [cordis.patch.yml](cordis.patch.yml) 里把 `craft-anything-mcp` 的 `disabled: true` 改成 `false`；
2. 删掉 `craft-anything` 那一行（否则会起第二个 CLI 进程）；
3. 重启 DSH。

回滚后 39 个工具全部回来，代价是每轮多 8k tokens。

## 重新生成目录（升级 CLI 后）

```powershell
node tools/generate-catalog.mjs "$env:USERPROFILE\.dsh\tools\craft-anything\craft-anything-cli.exe" catalog.json
node tools/build-client.mjs
```

`generate-catalog.mjs` 启动一次真实 MCP 会话，逐个 `enable_toolset` 并 diff `tools/list`，所以工具的工具集归属是实测的，不是按名字前缀猜的。

升级后若 CLI 多了新工具，`build-client.mjs` 会打印 `zh missing: <名字…>`：把这些名字按同样格式补进 [catalog-zh.json](catalog-zh.json) 再跑一次即可；没补的工具回落到英文描述，不会显示空白。

## 自查脚本

| 脚本 | 作用 |
|---|---|
| `node tools/plugin-smoke.mjs` | 用 mock context 跑真实 `apply()`，打印注册的工具、**每步 schema 字节数**与常驻提示段大小，实调热工具 / 转发 / `craft_engine status`，并断言 `craft_skill_export` 写出的文件内容 |
| `node tools/bridge-test.mjs` | 只测 `bridge.js`：握手、工具列表、调用、未知工具报错、释放 |
| `node tools/bench.mjs` | 服务端往返耗时 + 面板数据体积 + 首屏渲染 |
| `node tools/render-smoke.mjs` | 无浏览器渲染面板，抓组件崩溃 |

## 已知取舍

- **`craft_engine status` 会顺带打开 setup 工具集**（读设置和引擎要用它）：只在该服务进程内有效，不改配置文件，也不进工具表，重启后回到 39 个工具。
- **常驻提示段 2,888 字节（约 825 tokens）/ 步，调查中再加 571 字节**：纪律、错误码、工具集清单每步都在，模型一直能看到；skill 方案反过来——只在被读的那一次进上下文，其余步数为零。为了把这个账压低，纪律段做了会话级按需：`tools/post-execute` 记下哪个会话真的调用过本服务器，只有那些会话才注入纪律段，逆向模式会话则由自己的中文段覆盖、不重复付。
- **失去 MCP resources**（`investigation://brief` 等）：精简桥不实现 resources 协议；同样的内容用 `core_investigation_show` / `core_evidence_browse` 取。
- **聚合调用不产生独立 tool/call 记录**：`craft_tool` 的转发只留一条记录，参数与结果都在里面；需要逐条审计时走 `core_journal_read`。
- 只要 `--deep`：不然 native / formats / android 等工具集即使 enable 也是空。`clean_room` 报错就是服务被净室启动的信号。
- 工具调用超时 10 分钟，因为 `rebuild_start`、`rebuild_check` 会跑很久。

## 声明

### 性质与归属

- 本仓库是社区维护的**非官方**桥接（unofficial bridge），不是 Craft Anything 的发行物，也没有得到上游作者背书或赞助。
- 上游 [storytold/craft-anything](https://github.com/storytold/craft-anything) 以 **Apache-2.0** 发布；引擎、323 个工具、提示词，以及 `catalog.json` 里的英文描述，版权归上游作者与贡献者。
- 本仓库自己写的是桥接层（[bridge.js](bridge.js)、[index.js](index.js)、面板）、中文释义和预设。转发上游描述时按 Apache-2.0 保留归属与许可副本。
- 「Craft Anything」「ArtCraft」是上游的名字，这里只作指称，不表示隶属。
- [skill.js](skill.js) 里的规程**是按自己的话重写的中文版**：结构（连接自检 / 渐进工具集 / 工作记忆 / 证据分级 / 错误码 / 宿主对照 / 边界）借自上游 `crates/setup/src/skill.md`（v2）的纪律，工具名、流程措辞、宿主表按本插件重写，不是那份文件、也不是任何第三方 `anywhere/SKILL.md` 的副本。
- [icon.svg](icon.svg) 自绘，不包含上游 `docs/brand/` 的商标资源。上游品牌许可要求 fork 移除 ArtCraft 名号与 logo，这里同样不带。

### 与第三方 skill / fork 的关系

- 社区里另有一类接法：一份 `SKILL.md` + installer，把上游 CLI 与 skill 铺到 Claude Code、Codex、OpenCode、Qoder、Cursor。代表示例：[saintedKyle/craft-anything-skill](https://github.com/saintedKyle/craft-anything-skill) 的 `anywhere/`（`install.ps1` / `install.sh` + `craft-anything-anywhere`）。
- 本仓库与它**没有隶属、没有代码往来**，是各自独立实现；README 里那一节只做能力对比，不评价对方实现质量。
- 两种接法可以共存：同一台机器上装本插件给 DSH 用，同时把导出的 SKILL.md 放进别的宿主，两边连的是同一个 `craft-anything-cli`。
- 如果你 fork 本项目或基于它二次分发，请同样保留「非官方」表述，并继续遵守上游的品牌与许可要求。

### 使用边界

- 目标限于你自己的软件、你明确获得授权的软件，或本来就允许研究的开源/公开目标。
- 不绕过 DRM、登录校验、反作弊；不复刻他人商标、logo、照片、文案到你的产物里。这几条是上游 README 自己划的红线，桥接不解除它。
- 上游默认净室（只看截图、DOM、布局、配色），本插件默认 `--deep`。读文件与源码的能力是有意打开的，代价是范围由你与模型守：插件不做路径白名单，也不判断目标归属。
- 复刻产物是否合规由你判断。只观测表面，不等于重建就不侵权。

### 费用与数据

- 模型调用、算力、外部引擎（Ghidra 等）的费用自己承担；插件不代付、不代申请额度。
- 插件本身不上传数据。唯一主动出网是面板的「检查更新」：读 GitHub 公开 Release 信息，只读。
- `--deep` 会把目标文件与页面内容读进会话上下文，等于交给当前模型服务商处理。敏感目标先自己评估。

### 维护与问题归属

- 上游仍是 early alpha（2026-11-21：39.6k star、441 个 open issue），接口会漂。升级后按上文重新生成目录即可跟上。
- 不承诺兼容旧版 CLI，也不做静默降级：CLI 路径错、版本不匹配，桥会直接报错而不是假装能用。
- 桥接层、面板、中文释义的问题报本仓库；引擎行为、工具输出、分析结论报上游。
- `craft_skill_export` 导出的 SKILL.md 放到别的宿主后出的问题，先看那份文件里的「宿主对照」和「错误码」两节，再按该宿主或上游的渠道报。

## 发布与许可

- 本仓库以 **Apache-2.0** 发布（[LICENSE](LICENSE)）；第三方归属与商标说明见 [NOTICE](NOTICE)。
- 使用边界见 [DISCLAIMER.md](DISCLAIMER.md)，攻击面与护栏见 [SECURITY.md](SECURITY.md)，发布前实测清单见 [AUDIT.md](AUDIT.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。
- 仓库不含引擎二进制、不含上游 `docs/brand/` 资源、不含任何用户名绝对路径；`cordis.patch.yml` 用 `%USERPROFILE%` 模板，`tools/*.mjs` 用 `CRAFT_ANYTHING_CLI` 或 `homedir()`。
- 分发或 fork 时请保留「非官方」表述，并继续遵守上游的品牌与许可要求。

## 文档索引

| 文件 | 内容 |
|---|---|
| [AUDIT.md](AUDIT.md) | 本轮修掉的缺陷、安全边界、合规扫描、测试矩阵、剩余风险 |
| [SECURITY.md](SECURITY.md) | 暴露面、已实现/未实现的护栏、报告渠道 |
| [DISCLAIMER.md](DISCLAIMER.md) | 非官方与商标、可用范围、审批、费用、数据、AS IS |
| [CHANGELOG.md](CHANGELOG.md) | 0.1 → 0.5 的变更与对应验证 |
| [NOTICE](NOTICE) | 第三方组件与品牌归属 |
| [LICENSE](LICENSE) | Apache-2.0 全文 |

