# 免责声明 · Disclaimer

本文件是 [README](README.md) 声明节的完整版。任何使用、分发或部署本仓库的人，都应先读完这一页。

## 1. 这不是 Craft Anything 的官方组件

- 本仓库是社区维护的**非官方**桥接（unofficial bridge），不隶属于、未获授权、未获背书、不获赞助于 Craft Anything 的作者或贡献者。
- 本仓库**不含**上游引擎的任何二进制。它启动的是你自己安装的那一份（来自上游 Release 或自行编译）。
- 上游的任何行为变化、数据丢失、费用或事故，与上游维护者无关，也与本仓库维护者无关；反过来也一样：上游不为本插件的缺陷负责。
- 问题归属：本插件的缺陷提本仓库的 issue；引擎/工具的缺陷提上游仓库。

## 2. 名称与商标

- "Craft Anything"、"ArtCraft" 等名称用于描述本桥接所连接的软件，属其各自所有者。
- 本仓库不包含上游 `docs/brand/` 里的任何品牌资产；`icon.svg` 为本项目自绘。
- 上游的品牌许可是这样要求的：任何 fork 都不得使用上游的名字与标识。本仓库遵守这一点——它是桥梁，不是再发行。

## 3. 你可以用它做什么

本插件本身只是一个连接器：它把上游的 323 个工具送进 DeepSeek Harness，并让模型按规程去研究、复刻。**用它做什么由你决定，也由你负责。**

使用时请自行确认：

1. 你对被研究的目标拥有所有权，或已获得明确授权；
2. 遵守目标软件／服务的许可协议与当地法律；
3. 遵守你所在组织的规定。

上游自己在 README 里划了同一条线，本插件不扩大它：不用于绕过 DRM 等有效技术保护措施，不用于绕过登录、付费墙或游戏反作弊，不复刻他人的商标、logo、照片与受版权保护的文本内容。

## 4. 审批、权限与机器安全

- 会执行命令、写文件、改设置或花钱的动作（18 项，见 [README](README.md#安全模型)）在转发前会向 Harness 申请人工批准，只有 `allowed-once` 才放行。
- **审批服务不可用时，这些动作一律不执行**（fail closed），而不是"默认允许"。
- 这不是完整的安全边界。`craft_tool` 是通用转发口；上游工具里还有大量只读但会读取本机文件的工具，它们的输出会进入模型上下文。不要在未被允许的目录上使用，也不要把密钥、cookie、个人数据所在路径当成研究目标。

## 5. 费用

- 上游的部分能力（`assets_image_generate`、`assets_model_generate` 等）会产生真实的第三方账单，默认预算由上游 `assets.budget_usd` 控制（初始值 5.0）。费用由使用者承担。
- 本插件不代理、不转售、不补贴任何模型或 API 调用。

## 6. 数据与隐私

- 本插件不在本机以外存储任何东西：调查档案、证据、导出目录都写在你的磁盘上（默认在工作区的 `skills/craft-anything` 与上游配置目录）。
- 面板的版本检查会访问 `api.github.com`（只读 releases 元数据），可在发起前取消。
- 模型看到的内容取决于你把什么交给它；请自行判断哪些目标不该交给托管模型。

## 7. 无担保

本仓库按 **Apache-2.0** 的 "AS IS" 条款提供，不附任何明示或默示担保。使用者自行承担以下风险：设备损坏、数据丢失、项目被误改、时间与费用损失、以及因目标软件许可或当地法律引发的任何争议。

---

# Disclaimer (English summary)

This repository is an **unofficial** bridge between Craft Anything and DeepSeek Harness. It is not affiliated with, endorsed by, or sponsored by the Craft Anything authors, and it redistributes no engine binary — you install that yourself.

Use it on software you own or are authorised to study. It does not exist to bypass DRM, logins, paywalls or anti-cheat, and it does not copy anyone's trademarks, logos, photos or copyrighted text.

Actions that run commands, write files, change settings or spend money ask for human approval and refuse when no approval service is available. That is a guard rail, not a sandbox.

Provided "AS IS" under Apache-2.0, without warranty of any kind. You are responsible for what you point it at, for the licences involved, and for any cost the upstream engine incurs on your behalf.
