# 包清单

## 框架包

| 包 | 说明 |
| --- | --- |
| `@df/core` | 公共契约、插件清单、跨包事件、通用工具 |
| `@df/kernel` | Cordis 启动器、插件生命周期、诊断、加载/卸载 |
| `@df/vscode` | `vscode-instantiation` 适配层与启动性能追踪 |
| `@df/vue` | Pinia 服务、Cordis / Vue 上下文桥接 |
| `@df/settings` | 命名空间化本地存储，为布局、主题、偏好提供持久化 |
| `@df/commands` | 统一命令注册表、动态状态与执行 |
| `@df/keybindings` | 跨平台快捷键解析、注册、显示与分发 |
| `@df/ui` | 基于 nusys-ui 的主题、槽位、Ribbon/分栏包装器与对话框 |
| `@df/notifications` | 通知中心、自动关闭与错误提示组件 |
| `@df/statusbar` | 可扩展状态栏服务与组件 |
| `@df/workbench` | 工作台布局、停靠/浮动视图、工作区预设与持久化 |
| `@df/editor` | VS Code 风格文档标签页、文档生命周期与关闭/固定/脏状态 |
| `@df/ribbon` | 从命令元数据自动生成 AutoDesk 风格 Ribbon |
| `@df/menu` | 应用菜单与快速访问工具栏 |
| `@df/selection` | 跨插件共享的通用选择状态 |
| `@df/surface` | WebGL2 无限画布、按需渲染、平移缩放与节点交互 |
| `@df/explorer` | 工作区与插件资源浏览器 |
| `@df/properties` | 选择对象属性面板 |
| `@df/output` | 运行输出与诊断面板 |
| `@df/wasm` | 加载 Rust/WASM 热路径并提供降级实现 |
| `@df/platform` | 浏览器与 Electron 宿主能力适配 |
| `@df/bootstrap` | 运行时配置解析、按 commit 拉取、校验与缓存 |
| `@df/electron` | Electron 宿主库：窗口、协议、IPC、菜单、会话 |
| `@df/runtime` | 远程运行时 ESM 聚合入口 |
| `@df/app` | 默认插件预设、AppShell、Vue 启动入口 |

## 应用与示例

| 包 | 说明 |
| --- | --- |
| `@df/app-web` | Vite 浏览器示例 |
| `@df/app-desktop` | Electron 桌面示例与安装包配置 |
| `@df/playground` | 示例插件：实验室视图、Ribbon 页签、画布命令 |
| `@df/docs` | VitePress 文档站 |

## 依赖关系简图

```text
core
 ├─ kernel
 ├─ settings ← vue
 ├─ commands ← vue
 │   ├─ keybindings
 │   ├─ workbench ← pinia/settings
 │   │   ├─ editor ← ui
 │   │   ├─ ribbon ← ui
 │   │   ├─ menu
 │   │   ├─ explorer / properties / output
 │   │   └─ surface ← editor / selection
 │   └─ ui
 ├─ notifications
 ├─ statusbar
 ├─ wasm
 ├─ platform
 ├─ bootstrap
 └─ electron
       ↓
     app ← all
       ↓
 apps / playground
```

包之间尽量只依赖 `core` 与所需服务包；不要在业务包里直接 import 另一个包内部的 `src/*` 子路径。
