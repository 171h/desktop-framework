# VS Code 的实现借鉴

## 直接复用：vscode-instantiation

生命周期、实例化服务与性能标记直接来自 npm 包 `vscode-instantiation`，不复制 VS Code 源码：

- `DisposableStore`、`toDisposable`、`combinedDisposable`
- `InstantiationService`、`ServiceCollection`、`createDecorator`
- `mark` / `getMarks` performance marks

```ts
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'
```

`@desktop-framework/vscode` 是唯一适配层。以后该 npm 包补齐能力时，只需替换这个包的导出，不影响业务插件。

## packages/vscode 的定位

有些 VS Code 模式尚未进入 `vscode-instantiation`，例如启动阶段计时封装。它们暂放在 `packages/vscode/src/performance/startup.ts`，并标注了迁移目标。后续可以把该文件整体移入 npm 包，再把这里改成 re-export。

原则：

1. **优先 npm 包**，不复制已有实现。
2. **只复制必要的小模块**，并保留来源说明。
3. **所有复制代码集中到 `packages/vscode`**，不散落在业务包。
4. 对外只暴露稳定 API，不让业务依赖 VS Code 内部路径。

## 编辑器标签页

主工作区的文档标签栏复用 nusys-ui 的 `vscode-tabs` / `vscode-tab-header`，保留 VS Code 的拖拽排序、溢出滚动与键盘焦点行为。`@desktop-framework/editor` 在其上补充：

- 文档生命周期与 `KeepAlive` 内容缓存；
- 关闭按钮、中键关闭、右键菜单；
- 关闭其他 / 关闭右侧 / 全部关闭；
- 固定标签、脏状态圆点与预览斜体；
- `Ctrl+W`、`Ctrl+Tab`、`Ctrl+Shift+Tab` 等文档命令。

## Electron 工程实践

| VS Code 做法 | 本框架实现 |
| --- | --- |
| 主进程服务分层 | Cordis 主进程插件：host/runtime/protocol/window/ipc/menu/session |
| 自定义协议加载渲染进程 | `df-app://bundle`，CSP、MIME、路径校验 |
| preload 最小暴露 | `window.desktopFramework`，来源校验 |
| 原生窗口控制 | `titleBarStyle:'hidden'` + `titleBarOverlay`，不绘制最小化/最大化/关闭按钮 |
| 窗口状态恢复 | `window-state.json` + 显示器可见性校验 |
| 隐藏菜单栏保留快捷键 | 原生菜单 + `setMenuBarVisibility(false)` |
| 首屏优化 | `show:false`、`ready-to-show`、`v8CacheOptions:'code'` |
| 单实例 | `requestSingleInstanceLock` |
| 崩溃诊断 | crashReporter、render-process-gone、unresponsive |
| 资源释放 | `DisposableStore` + Cordis effect |

## 性能追踪

启动阶段标记：

```ts
const startup = new StartupTimer('main')
startup.mark('host-service')
...
startup.report()
```

渲染进程同样记录 `boot`、`context-ready`、`shell-mounted`、`plugins-ready`。后续可以把两段合并为一条启动瀑布图。

## 与 VS Code 的差异

- VS Code 是编辑器优先，本框架是**工作台优先**：Ribbon、画布与工作区是一等公民。
- Cordis 是主插件容器；VS Code 的 `InstantiationService` 只在需要复用 VS Code 服务类时使用。
- 远程运行时按 **commit** 拉取，而不是扩展市场按扩展版本安装。
- 框架不复制 VS Code 的 workbench 源码，只借鉴窗口、协议、生命周期与性能策略。

## 未来迁移清单

- 将 `StartupTimer` 移入 `vscode-instantiation`。
- 评估复用 VS Code 的 `CancellationToken` 与 `Event` 实现。
- 为插件宿主增加类似 Extension Host 的隔离进程（可选）。
- 使用 VS Code 的 telemetry/日志抽象统一诊断输出。
