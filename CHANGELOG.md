# 变更记录 · Changelog

版本号跟随 `package.json`。每条都对应本机真实跑过的验证，不是计划。

## 0.5.0 — 2026-11-21

**发布准备：文档、许可、安装、双语 skill。**

- 新增 `LICENSE`（Apache-2.0）、`NOTICE`（第三方与品牌归属）、`DISCLAIMER.md`（使用边界，中英双语）、`SECURITY.md`（攻击面、已实现护栏、报告渠道）、`AUDIT.md`（本轮修掉的缺陷、合规扫描、测试矩阵、剩余风险）、`.gitignore`。
- `skill.js` 重写为双语：`buildSkillMd({ lang })`，`zh` 5,544 B / `en` 10,356 B，frontmatter 加 `lang`、`upstream_skill`、`bridge`；九节正文按宿主无关写。
- `craft_skill_export` 新增 `lang`（`zh` 默认 / `en`），返回值标明语言。
- 新增 `install.ps1` / `install.sh`：只下载上游 CLI 并校验 `--version`，**不做** MCP 注册（避免 `setup --yes` 覆盖插件的 `--deep` 启动参数）。
- 配置与测试脚本去个人化：`cordis.patch.yml` 用 `%USERPROFILE%` 模板（`resolveExecutable()` 会展开），`tools/*.mjs` 用 `CRAFT_ANYTHING_CLI` 或 `homedir()`，仓库内不含用户名绝对路径。
- README 增「发布与许可」「文档索引」两节。

## 0.4.1 — 2026-11-21

- `craft_tool` 支持通配检索：`"*"` 全表、`"adb*"` 前缀、`"*show"` 后缀、`"*window*"` 包含。检索零 schema 成本，不触发调用、不走审批。上限 120 行。
- `craft_engine status` 显示本桥启动参数（是否带 `--deep`）与提示段开销（常驻 / 按需两档）。
- 修复 `depth` 死变量（算了没输出）。

## 0.4.0 — 2026-11-21

- **按需纪律段**：四条调查纪律从常驻提示段移到会话级触发段——没用过 craft-anything 的会话不付费。常驻 3,678 → 2,888 B，用过之后 +571 B，逆向模式内不重复加。
- **修复导出能力在工作区判定上的真缺陷**：原用 `process.cwd()` 判「在不在工作区」，Host 进程 cwd 与会话工作区常不同盘，导致所有导出都要审批、审批关闭的会话里工具完全不可用。改为 `sessionCwd(exec)` 逐层取会话路径。
- `craft_skill_export` 增 `host`（`dsh` / `claude` / `codex` / `opencode` / `qoder` / `cursor` / `all`）：显式 `dir` 视为已同意，派生路径要审批。

## 0.3.1 — 2026-11-21

- `craft_skill_export` 支持一键铺到已知宿主 skill 目录；导出目录名改为 `craft-anything-dsh`，与上游 `craft-anything` 共存不覆盖。
- **修复跨盘覆盖事故**：`path.relative()` 在跨盘符时返回绝对路径，`startsWith('..')` 误判为「在工作区内」，冒烟测试因而未经批准覆盖了另一宿主的 `SKILL.md`（已用上游原文恢复）。新增 `isInsideWorkspace()` 三条件判定。
- `craft_engine status` 增工具集分布（`✓ core 39/39` / `· native 0/55`）。
- `executable` 可移植：默认值按平台推导，支持 `%VAR%` / `${VAR}` / `$VAR`，空值回退 PATH。

## 0.3.0 — 2026-11-21

- 新增 `craft_engine`（`status` / `doctor` / `deep-on` / `deep-off` / `ghidra`）与 `craft_skill_export`（宿主无关 `SKILL.md`）。
- 新增 `skill.js`：中文、宿主无关的 SKILL.md 生成器（v2 起吸收上游 skill 的调查纪律）。
- README 增「和 skill 方案比」对照表，并明确列出对方更强的三点。
- 常驻提示段增四条防坑纪律（先看连接别先修连接、别对已列全量工具的条目跑 `setup --yes`、`clean_room` 要 Deep、错误码速查）。

## 0.2.0 — 2026-11-21

- 面板：引擎版本 chip、上游更新检查（`api.github.com` latest release）、底部声明行。
- README 与 `package.json`：许可证更正为 Apache-2.0（上游实际许可），标注非官方桥接。
- 逆向模式预设 persona 增「边界条件」段。

## 0.1.x — 2026-11-21

- 首个可用版本：自建 MCP 桥（`bridge.js`）替代通用客户端，工具面从 40,311 B 压到 13,939 B（省 65.5%）；13 个直连工具 + `craft_tool` 聚合 + `craft_reverse` 逆向导引。
- 逆向模式：七阶段（boot → recon → spec → rebuild → diff → accept → done），按 `tools/post-execute` 自动推进，提示段按会话注入当前阶段。
- 面板：323 工具 / 17 工具集浏览，中文释义（`catalog-zh.json` 325 条），中英双匹配搜索。
- 安全：18 个会执行命令/写文件/改设置/花钱的工具转发前必须审批，fail closed。
