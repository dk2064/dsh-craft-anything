# 审核记录 · Audit log

这一页不是模板，是发布前实际跑过、实际修过的清单。任何一次发版都应该更新它：改了什么、怎么验的、还剩什么风险。

- 审核对象：`dsh-craft-anything` 0.5.0（本仓库）
- 审核日期：2026-11-21
- 环境：Windows 11 / Node 24.11 / DSH（Web GUI 本地）/ Craft Anything CLI 0.6.1

## 1. 本轮修掉的缺陷

| # | 缺陷 | 为什么危险 | 修法与验证 |
|---|---|---|---|
| 1 | `craft_skill_export` 用 `process.cwd()` 判断"是否在工作区内"，而 Host 进程的 cwd 与会话工作区可能不在同一个盘符 | 跨盘时 `path.relative()` 返回绝对路径，`startsWith('..')` 判为"在内部"，于是**未经批准覆盖了另一个宿主的 `SKILL.md`**（实际发生过：覆盖了上游 `~/.claude/skills/craft-anything/SKILL.md`，已用上游原文恢复） | 新增 `isInsideWorkspace()`：`rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)`；显式 `dir` 视为已同意，派生 `host=` 路径必须走审批。断言：`explicit dir needs no approval: true` |
| 2 | 阶段观察器只认 `mcp__` 前缀，`craft_tool` 转发的调用不推进阶段 | 逆向模式卡在 2/7，模型以为没进展 | 读 `exec.arguments.name` 得到真正跑的工具；实测 2/7 → 5/7 推进，失败调用不推进 |
| 3 | `runFor()` 在解析不到 scope 时回退到"唯一那个 run" | 多会话并存时状态串台，A 会话的进度显示在 B 会话的提示里 | 改精确寻址 + `runs` 上限 32，淘汰最旧 |
| 4 | 工具结果无上限 | 一份证据记录或报告能撑爆上下文 | `clipText` 200,000 字符，并指向 `core_evidence_browse` 分页 |
| 5 | `craft_tool {"name":"*"}` 无上限 | 323 个工具 × 90 字描述一次灌进上下文 | 120 行上限；新增通配检索（`adb*` / `*local` / `*window*`），零 schema 成本 |
| 6 | `craft_engine status` 里 `depth` 是**死变量**（算了没输出） | 用户看不到"本桥是否带 `--deep`"，遇到 `clean_room` 无从判断 | 补进返回数组；断言 `engine status states bridge args: true` |
| 7 | 常驻提示段 3,678 B 每步都在 | 没碰到 craft-anything 的会话也一直付费 | 纪律段改成会话级按需（`engaged` Set，上限 128）：2,888 B，用过之后 +571 B，逆向模式不重复加 |
| 8 | 测试脚本硬编码 `%USERPROFILE%\...` 这种硬编码 | 换机器就断，也把用户名带进了仓库 | 改 `process.env.CRAFT_ANYTHING_CLI ?? join(homedir(), '.dsh', ...)`；`cordis.patch.yml` 改 `%USERPROFILE%` 模板，并实测模板能展开 |

## 2. 安全边界（实现层面）

- **审批闸门**：18 个会执行命令 / 写文件 / 改设置 / 装引擎 / 花钱 / 自批的工具，转发前调用 `ctx.approval.request()`，只认 `allowed-once`。
- **fail closed**：没有审批服务就抛错，而不是默认放行。断言：`deep-on without approval` → rejected，未执行。
- **转发限制**：拒绝 `craft_tool` / `craft_reverse` / `mcp__*`，名字必须匹配 `^[A-Za-z0-9_.-]{1,64}$`，防止把聚合口变成调宿主工具的后门。
- **协议加固**：单行 32 MB 上限、启动退避 0/0.5/1.5/4/8 s、`stdin.write` 异常捕获、退出时清 buffer 与 pending。
- **不隐藏**：`craft_engine` / `craft_skill_export` 会改设置或写本机其它宿主目录，两者都要批准或明确 `dir`。

不在边界内的（写清楚比藏起来好）：没有 OS 沙箱、没有文件系统边界、没有网络隔离；批准后的命令以当前用户权限运行。详见 [SECURITY.md](SECURITY.md)。

## 3. 敏感信息与合规扫描

| 检查 | 结果 |
|---|---|
| 仓库内出现用户名 / 绝对路径 | 已清零（0 处：全库扫用户名、`%USERPROFILE%` 之外的盘符路径、token 前缀） |
| 凭据 / token / 私钥 | 无 |
| 引擎二进制是否入库 | 无（`.gitignore` 排除 `*.exe` / `zsh` 构建产物 / `craft-anything-cli*`） |
| 上游品牌资产（docs/brand） | 未包含；`icon.svg` 自绘 |
| 许可证 | 本仓库 Apache-2.0（[LICENSE](LICENSE)）；上游 Apache-2.0，归属见 [NOTICE](NOTICE) |
| 与上游关系表述 | README 顶部与 [DISCLAIMER](DISCLAIMER.md) 均写明"非官方、无背书" |
| GitHub 平台合规 | 不包含 `workflow` 文件（发布令牌无 `workflow` scope）、无大文件、无二进制、无爬取内容；描述与许可证字段完整 |
| 与第三方 skill 的关系 | 本仓库的 SKILL.md 是按自己措辞写的（中文/英文两版），不含上游 `skill.md` 原文，也不含 `saintedKyle/craft-anything-skill` 的内容；只在 NOTICE 里做事实性引用与链接 |

## 4. 测试矩阵

跑法见 [README](README.md#自检)。全部在本机真实执行，不是纸面断言。

| 套件 | 覆盖 | 结果 |
|---|---|---|
| `tools/plugin-smoke.mjs` | 工具面与每步 schema 字节数、`craft_tool` 五类拒绝、审批拒绝、转发调用、观察器推进、`craft_engine` 三个动作、`craft_skill_export` 三种目标、通配检索三例、`discipline` 三态 | 全绿：17 工具 / 15,121 B ≈ 4,320 tokens；`core_*` 命中 33/39；`bridge prompt bytes: 2888`；`discipline on after a call: true (571 B)` |
| `tools/render-smoke.mjs` | 面板在假 React 下渲染、中文释义、引擎版本 chip、更新按钮、声明行 | 39 行 + 全部断言 true |
| `tools/bridge-test.mjs` | JSON-RPC 握手、`tools/list`、两次真实调用、未知工具错误、dispose | 全绿（triage 178 ms） |
| `tools/bench.mjs` | 冷启动、目录解析、面板构建、schema 压缩比 | 见 README 指标表 |
| `cordis.patch.yml` / preset patch | YAML 结构（`yaml.parseDocument`，0 errors） | 两个文件均 `rows 1` |
| `%USERPROFILE%` 模板 | 配置里用模板而不是绝对路径时能否启动 | 通过：`CRAFT_ANYTHING_CLI='%USERPROFILE%\...' node tools/plugin-smoke.mjs` 全绿 |

## 5. 仍未解决 / 已知风险

1. **`craft_engine status` 会顺带打开 setup 工具集**：服务侧工具集是进程级的，所以这次调用之后服务会多列 20 个工具（不进工具表，不影响 schema）。已在 status 输出里说明。
2. **`enable_toolset` 常驻进程**：打开的工具集在服务进程内一直开着，直到 DSH 重启。
3. **审批关闭的环境**：本插件在审批关闭时会拒绝全部 18 个危险动作，这是设计，不是缺陷；但意味着那些会话里只能做只读研究。
4. **面板版本检查**：访问 `api.github.com` 取最新 release，属外发请求；断网时只显示"检查失败"，不影响使用。
5. **上游 early alpha**：上游 issue 数长期在高位（发布时 441 open），工具行为可能变化；`catalog.json` 是快照，用 `tools/generate-catalog.mjs` 可重新对齐。
