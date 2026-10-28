# 架构审查与调整（2026-10-28）

## 结论

保留现有 Rust workspace + pnpm workspace、Cordis 内核、能力插件、Vue 外壳和 Electron 宿主的分层。这个方向适合复用桌面工作台，不需要重写。但当前是架构预览，不能把布局相似、编译通过等同于具备 VS Code 的扩展隔离、性能和跨平台交互成熟度。

审查依据为本仓库源码、已安装 Cordis 的实际实现、回归测试和 Windows 下的构建及启动检查。本次没有把依赖升级、布局重画或增拆更多 package 作为架构优化目标。

## 已修正的问题

| 问题 | 影响 | 调整 |
| --- | --- | --- |
| 将 Cordis 的等待依赖状态当成加载成功 | 诊断不准确，外壳可能过早挂载 | 整批注册后等待本批及子插件稳定，区分 pending / loaded / failed，跟踪服务卸载后的暂停与恢复 |
| 诊断列表直接暴露可变记录 | 使用方能无意修改内核状态 | 返回诊断快照 |
| 命令覆盖仅记录 previous | 乱序卸载会恢复已经注销的命令 | 维护有效注册栈，恢复时发出注册事件；批量注册失败时回滚 |
| 精简预设仍被默认外壳绑定 | 通用宿主与示例能力耦合 | 移除外壳对 surface / selection 的强依赖，提供 shell.component / shell.inject |
| 外壳启动失败不清理上下文 | 遗留监听器、服务与命令 | 失败后释放已安装插件；等待 ShellService 完成挂载 |
| 无 manifest 时根据配置伪造版本 | 无法证明下载的是指定 commit | 必须有清单，清单记录完整 commit，入口和样式必须是目录内实际文件 |
| 缓存忽略制品地址和 integrity | 修改校验策略仍命中旧缓存 | 缓存身份包含完整配置 commit、仓库、制品 URL、入口和 integrity |
| 离线先回退，不读取缓存 | 无网时用上另一版本 | 离线先查缓存；remote 未命中即报错，auto 才回退 |
| 主进程和渲染端吞掉远程加载错误 | 锁定版本失效，还可能混用两个运行时 | 主进程严格启动，远程模块或样式执行失败直接报错 |
| IPC 来源按字符串前缀校验 | 相似地址或其他 frame 可能进入特权桥 | 校验主窗口、主 frame 以及解析后的精确来源 |
| 权限策略晚于窗口创建 | 首屏运行在未完成策略的会话中 | 将启动分为宿主就绪、基础设施、窗口三个阶段 |
| 静态协议只校验逻辑路径 | 目录链接可越过资源根目录；错误编码可抛异常 | 同时检查实际路径，将错误编码返回为 400 |

Electron 来源检查依据：[Electron 官方安全指南](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages)。

## 建议长期保持的职责边界

```text
业务宿主（配置、业务插件、自定义外壳）
  → app（装配、挂载与失败清理）
  → commands / editor / workbench / ribbon / platform 等能力插件
  → kernel（Cordis 生命周期及诊断） + core（公共契约）

Electron 主进程 → bootstrap（获取运行时制品）
               → 协议 / IPC / 会话 / 窗口插件
渲染进程       → platform → preload 最小桥 → 主进程
Rust 纯算法    → df_wasm → 渲染进程中的 WASM 调用
```

插件的实际服务依赖使用 Cordis `inject`。清单里的 `requires` / `optional` 目前只是元数据，不是第二套依赖管理或权限系统。注册命令、视图和事件时，插件仍需用 `ctx.effect` 管理返回的释放函数；服务 API 不会自动接管所有调用者创建的资源。

框架内部包保持源码 workspace 的开发方式即可。独立 package 对应可替换服务、独立运行环境或明确的构建边界，不需要为每个函数拆包。纯 Rust 算法继续保留独立 crate；文件系统和 Electron 生命周期留在宿主层。

## 自定义精简宿主

```ts
import { createFrameworkApp } from '@df/app'
import { pluginEntry } from '@df/kernel'
import pinia from '@df/vue'
import CustomShell from './CustomShell.vue'

const app = await createFrameworkApp({
  el: '#app',
  preset: [pluginEntry(pinia)],
  shell: { component: CustomShell, inject: [] },
})

// 关闭宿主时调用 await app.dispose()。
```

默认外壳仍需要工作台、菜单、Ribbon 等服务。裁剪这些服务时，应同步提供自己的外壳与依赖列表；自定义外壳始终保留 Pinia 和内核服务。

## 当前能力的边界

- **插件信任**：Cordis 提供依赖注入和生命周期，并不隔离恶意插件。主进程插件拥有 Node 权限，渲染端插件共享页面和 preload 能力。第三方不可信扩展需要单独设计扩展宿主进程、能力授权和通信协议。
- **运行时分发**：配置拉取的是已经发布的渲染端制品，不会现场 clone 源码编译，也不能据此更新 Electron 主程序、preload 或操作系统安装包。生产配置应使用完整 commit 和独立配置的 integrity；仅自行计算哈希并不能认证发布者。
- **缓存信任**：下载时验证归档 integrity，缓存命中时验证清单、commit 及入口路径。当前没有逐文件重算摘要来检测本地缓存篡改，也没有跨进程下载锁；需要这种保证时应进一步扩展缓存协议。
- **WASM 性能**：当前模糊搜索仍在渲染主线程同步调用，候选列表还经过 JSON 编解码。WASM 并不自动消除主线程阻塞。大型数据负载应先建立基准，再引入 Worker、批处理或紧凑数据接口。
- **首屏体积**：默认预设静态引用能力包，nusys-ui 也通过总入口注册。运行时裁剪不等于构建时按需加载。后续优化应依据包分析和冷启动测量进行，不能仅凭使用 Rust 或 WebGL 宣称高性能。
- **UI 来源**：当前实际构建使用 npm 的 nusys-ui，submodule 作为参考源码保留；直接修改 submodule 不会自动进入应用构建。若要立即消费 UI 扩展，应在 UI 仓库发布版本后更新依赖，或另行建立明确的本地源码构建链。
- **VS Code 交互**：生命周期已引用 vscode-instantiation；文档标签页是 nusys-ui 与本项目服务的组合，没有完整移植 VS Code 编辑器分组、脏文档保存流程和全部拖放行为。原生窗口控制已采用 Electron titleBarOverlay / macOS 交通灯，自定义标题栏品牌图标仍是 HTML 图像。
- **跨平台验证**：CI 有三个操作系统的编译任务；这不能替代各平台的安装、DPI、拖动、输入法、菜单和窗口恢复测试。本轮实际桌面启动检查在 Windows 上进行。

这些是预览版本的明确边界，不应在文档中表述为已经达到 VS Code 同等级别的完整实现。

## 本轮验证

- ESLint、vue-tsc，以及 11 个测试文件中的 62 个 Vitest 用例。
- Rust 的 4 个算法测试、workspace Clippy、rustfmt，以及 wasm32-unknown-unknown 目标检查。
- Web、Electron、运行时归档和 VitePress 文档构建。
- Windows Electron 实际启动：内置框架成功挂载默认工作台并退出。
- Windows Electron 远程模式：本地 HTTP 制品服务提供实际归档，完成 SHA-256 校验、解压、df-runtime 协议加载和默认工作台挂载。

构建仍提示默认 Web 首屏脚本超过 500 KB；这作为后续按需构建和包体分析的基线保留，没有通过提高告警阈值隐藏。上述启动检查没有覆盖安装包签名、真实外网发布服务或 macOS / Linux 的交互验收。
