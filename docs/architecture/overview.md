# 架构总览

Desktop Framework 由三个运行时层次与两个工程层次组成。

```text
┌─────────────────────────────────────────────────────────────┐
│ 宿主层：apps/web · apps/desktop                             │
│ 只负责挂载、窗口参数、运行时配置与业务插件清单              │
├─────────────────────────────────────────────────────────────┤
│ 装配层：@desktop-framework/app · runtime                    │
│ 默认插件预设、AppShell、启动顺序、远程运行时入口             │
├─────────────────────────────────────────────────────────────┤
│ 能力层：commands · workbench · ribbon · ui · surface …       │
│ 每个能力都是 Cordis 插件，通过服务与事件协作                  │
├─────────────────────────────────────────────────────────────┤
│ 内核层：@desktop-framework/kernel                           │
│ 创建 Context、加载/卸载插件、诊断、失败隔离                  │
├─────────────────────────────────────────────────────────────┤
│ 宿主桥：platform · electron                                 │
│ 浏览器降级 / Electron 主进程与 preload                      │
└─────────────────────────────────────────────────────────────┘
```

## 启动链路

```text
apps/desktop/src/main
  └─ bootstrapElectron
      ├─ 配置 app / 单实例 / 协议白名单 / 崩溃上报
      ├─ createFrameworkContext
      ├─ electron:host → lifecycle → runtime → protocol
      │                 → window → ipc → menu → session
      ├─ 解析 desktop-framework.config.json
      ├─ 创建窗口并加载 df-app://bundle/index.html
      └─ preload 暴露 window.desktopFramework

renderer main.ts
  └─ platform.getRuntime()
      ├─ remote → 加载 df-runtime://<short>/index.js
      └─ workspace → createPlaygroundApp / createFrameworkApp
          └─ kernel.load(defaultPreset + 业务插件 + shell)
```

## 依赖方向

- `core` 只包含类型与纯工具，不依赖 DOM、Vue、Electron。
- 能力包依赖 `core` 与具体实现库（Vue、Pinia、nusys-ui），但不反向依赖 `app`。
- `app` 负责装配，业务应用只依赖 `app`、`kernel` 与自己的插件。
- `electron` 主进程与渲染进程共享 `shared` 通道定义，但不把 Electron 类型泄漏到渲染代码。
- `runtime` 只导出公共 API，是远程运行时的稳定边界。

## 服务清单

| 服务 | 包 | 职责 |
| --- | --- | --- |
| `ctx.kernel` | kernel | 插件加载、卸载、诊断 |
| `ctx.commands` | commands | 命令注册、状态、执行 |
| `ctx.keybindings` | keybindings | 快捷键解析与分发 |
| `ctx.storage` | settings | 命名空间化本地存储 |
| `ctx.ui` | ui | 主题、槽位、命令面板、对话框 |
| `ctx.workbench` | workbench | 布局、停靠视图、工作区 |
| `ctx.ribbon` | ribbon | 从命令生成 Ribbon |
| `ctx.menu` | menu | 应用菜单与快速访问 |
| `ctx.statusbar` | statusbar | 状态项与消息 |
| `ctx.notifications` | notifications | 通知队列 |
| `ctx.selection` | selection | 通用选中对象 |
| `ctx.surface` | surface | 无限画布与相机 |
| `ctx.platform` | platform | 浏览器 / Electron 能力 |
| `ctx.wasm` | wasm | WASM 加载与降级 |
| `ctx.electronHost` | electron | 主进程窗口与运行时状态 |
| `ctx.shell` | app | Vue 外壳挂载 |

## 事件总线

Cordis 事件用于跨插件通知，典型事件：

- `kernel/plugin-loaded` / `kernel/plugin-failed` / `kernel/plugin-unloaded`
- `command/registered` / `command/executed` / `command/failed`
- `workbench/layout-changed` / `workbench/workspace-applied`
- `selection/changed`
- `ui/theme-changed`
- `notification/added`
- `ui/theme-changed`

事件只承载轻量数据；大对象通过服务读取，避免事件成为隐式全局状态。
