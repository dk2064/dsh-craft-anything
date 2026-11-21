# dsh-craft-reverse-preset

在 DSH 的模式选择器里加一个「逆向复刻模式」。选中它、输入一个目标，就直接开始复刻，不需要再喊工具。

## 它做了什么

- 注册一个 Agent preset：`id: craft-reverse`，显示名「逆向复刻模式」，描述「给一个应用、网站、游戏或文件，自动拆解原件、复刻出完整可运行的新项目，并用官方检查收敛差异」。
- persona 直接把行为钉死：消息即任务 → 解析目标 → 立刻 `craft_reverse` start → 按返回的阶段清单一条条做 → 全量复刻 → 只认 `rebuild_check` → 固定收尾顺序（`project_build_finish` → `core_report_write` → `core_handoff_write`）。
- 补齐工作工具：pwsh/bash、文件读写、搜索、jobs、todo、web、present 与 compaction。

## 为什么预设里不再挂 MCP 连接

`craft-anything` 的 MCP 连接和 `craft_reverse` 工具由 Host 层 bundle [本仓库根目录](../) 注册，Host 注册的工具在**每个**预设会话里都可见。预设再挂一份会让 CLI 起两个进程、`serverName` 冲突，所以这里只放 persona 和工具。

前提：`dsh-craft-anything` 必须已安装；本预设是可选的第二层。

## 用法

1. 装好本预设后重启 DSH（模式花名册来自 Host，重启后可见）。
2. 新建会话 → 点模式选择器 → 选「逆向复刻模式」。
3. 直接输入目标，例如：
   - `D:\work\demo\app.exe`
   - `https://example.com`
   - `复刻这个登录取证页，输出到 D:\work\login-clone`

它会自己 `craft_reverse` start（打开目标、分诊、写简报、按推荐开工具集），然后按阶段往下推；中途想看进度就 `craft_reverse` status，想加一句判断就 note。

## 注意事项

- `dsh-craft-anything` 的最新改动（`craft_reverse` 的 `toolsets` 参数）要重启 DSH 才会进内存；不重启也能用，默认就是按分诊推荐开工具集。
- 换 CLI 路径改 [cordis.patch.yml](../cordis.patch.yml)（Host 行）即可，预设不重复声明。

## 边界与声明

预设把复刻动作交给当前会话的模型，所以红线写进了 persona：碰到 DRM、登录校验、反作弊就停手并记 `note`，不搬商标、logo、照片与成段原文，目标限于自有或已获授权。完整声明（非官方桥接、上游 Apache-2.0 归属、费用自负、`--deep` 会把目标内容读进会话上下文）见 [dsh-craft-anything 的声明](../README.md#声明)。
