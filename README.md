# desktop-framework

面向复杂桌面软件的**插件化跨平台应用框架**。它把 AutoDesk 系列软件中长期验证过的界面组织方式——统一工作区、Ribbon 功能区、模块化工具栏、可保存的工作区布局、命令驱动的交互——抽象为可复用的 Vue 3 + Electron + Rust/WASM 基础设施。

> 当前处于 `0.1` 架构预览阶段。框架本身即示例：`playground/` 中的应用完全通过公开插件 API 组装。

## 设计目标

- **一致**：标题栏、应用菜单、快速访问工具栏、Ribbon、停靠面板、视口和状态栏共享同一套坐标系与主题变量。
- **插件化**：内核只负责生命周期与依赖注入；命令、Ribbon、面板、模型格式、渲染器、Electron 主进程能力全部是 Cordis 插件。
- **高性能**：Rust + WebAssembly 承担模糊搜索等热路径；渲染层采用脏标记按需绘制、DPR 上限与资源复用。
- **可定制**：工作区布局、面板宽度、活动视图和主题可持久化；Ribbon 由命令元数据自动生成。
- **可组合**：其他软件可以把本仓库作为 git submodule 引入，复用框架包并只编写自己的业务插件。
- **跨平台**：Electron 主进程、构建脚本与 GitHub Actions 覆盖 Windows、macOS、Linux。

## 目录结构

```text
desktop-framework/
├─ crates/                 # Rust：高性能算法与 WASM 绑定
├─ packages/               # TypeScript：内核、UI、工作台、视口、Electron、格式桥接
├─ playground/             # 基于框架构建的示例应用（Web + Electron）
├─ docs/                   # VitePress 中文文档
├─ submodules/nusys-ui/    # 唯一 UI 组件来源（git submodule）
├─ scripts/                # WASM 与子模块辅助脚本
└─ .github/workflows/      # CI、跨平台安装包、文档部署
```

## 快速开始

```bash
git clone --recurse-submodules https://github.com/171h/desktop-framework.git
cd desktop-framework
corepack enable
pnpm install
pnpm build:wasm
pnpm dev            # 浏览器中的示例工作台
pnpm dev:desktop    # Electron 桌面示例
```

需要 Node.js 22.18+、pnpm 12+、Rust 1.90+ 与 `wasm32-unknown-unknown` 目标。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动 Web 版示例应用 |
| `pnpm dev:desktop` | 构建 WASM 后启动 Electron 示例 |
| `pnpm build` | 构建 WASM、Web 与 Electron 产物 |
| `pnpm package:desktop` | 使用 electron-builder 生成当前平台安装包 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm rust:test` | Rust 工作区测试 |
| `pnpm typecheck` | `vue-tsc` 全仓库类型检查 |
| `pnpm docs:dev` | 启动 VitePress 文档站 |

## 核心概念

### 一切皆插件

所有能力都是 Cordis 插件，并可通过 `ctx.kernel.load()` / `unload()` 在运行时增删。插件通过 `inject` 声明依赖，Cordis 负责等待、排序与资源释放。框架的内置能力也使用同一机制：

```ts
import { definePlugin } from '@desktop-framework/kernel'

export default definePlugin({
  name: 'my-company:review-tools',
  inject: ['commands', 'ribbon', 'workbench'],
  apply(ctx) {
    ctx.commands.register({
      id: 'review.markup',
      title: '添加批注',
      icon: 'comment-add',
      ribbon: { tab: 'review', tabTitle: '审阅', group: '批注' },
      run: () => openMarkupTool(),
    })
  },
})
```

### 命令是唯一的交互入口

Ribbon、应用菜单、快速访问工具栏、快捷键和命令面板共享同一个命令注册表。界面不再各自维护按钮状态，而是从命令元数据生成，并通过 `enabled` / `checked` 惰性求值。

### Rust / WASM 热路径

`df_fuzzy` 提供命令面板与插件搜索使用的模糊匹配内核；`df_wasm` 负责把结果以紧凑 JSON 暴露给前端。命令数量很大时，搜索仍在 WASM 线性内存中完成，主线程只处理最终结果，避免在 Vue 响应式对象上进行大列表排序。

### 借鉴 VS Code 的实现

生命周期、实例化服务与性能标记直接使用 `vscode-instantiation`；框架不复制 VS Code 生命周期源码。仅在 `packages/vscode` 中维护尚未进入该 npm 包的适配代码，便于后续整体替换。

#### Electron 优化

- `contextIsolation` + `sandbox` + 关闭 `nodeIntegration`，preload 只暴露最小 IPC 面。
- 窗口 `show: false` + `ready-to-show`，避免白屏；`v8CacheOptions: 'code'` 与持久化窗口状态缩短二次启动。
- 生产环境使用受控的 `df-app://` 自定义协议加载渲染进程，支持 `fetch` WASM、正确的 MIME 与 asar 内资源。
- 主进程同样是 Cordis 插件：lifecycle、window、ipc、menu、protocol、session 各自可替换。
- 单实例、原生菜单命令桥、崩溃与渲染进程异常记录、资源统一释放。

## 使用框架开发自己的软件

使用方不再需要把框架源码作为 submodule 长期维护。在 `desktop-framework.config.json` 中声明框架仓库与精确 commit：

```json
{
  "framework": {
    "repository": "https://github.com/171h/desktop-framework",
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "runtime": {
      "asset": "desktop-framework-runtime-{shortCommit}.tar.gz",
      "entry": "index.js",
      "integrity": "sha256-..."
    }
  }
}
```

应用启动时，`@desktop-framework/bootstrap` 会：

1. 计算配置的版本缓存键，并在本地缓存中查找；
2. 未命中时从对应 commit 的 GitHub Release / 制品地址拉取运行时归档；
3. 校验 SHA-256、manifest 中的 commit 与入口文件；
4. 解压到受控缓存目录，通过 `df-runtime://` 协议加载；
5. 缓存命中时直接启动，不重复下载。

宿主自己的业务仍然以插件形式开发，通过配置或运行时插件清单加载。详见 [集成指南](./docs/guide/integration.md) 与 [运行时拉取](./docs/architecture/runtime-pull.md)。

## 文档

- [架构总览](./docs/architecture/overview.md)
- [AutoDesk 设计借鉴](./docs/design/autodesk.md)
- [插件系统](./docs/guide/plugins.md)
- [Electron 宿主](./docs/architecture/electron.md)
- [跨平台构建](./docs/guide/cross-platform.md)

## 许可

[MIT](./LICENSE)
