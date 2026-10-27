# Electron 宿主

`@desktop-framework/electron` 是一个库，而不是一个写死的应用。`apps/desktop` 只提供窗口参数、渲染入口和运行时配置。

## 主进程插件

| 插件 | 职责 |
| --- | --- |
| `electron:host` | 共享状态服务：窗口、运行时、就绪 Promise、启动计时 |
| `electron:lifecycle` | app ready、单实例、退出、子进程/渲染进程异常、资源释放 |
| `electron:runtime` | 解析配置、下载/缓存运行时、注册 `df-runtime://` |
| `electron:protocol` | 注册 `df-app://bundle`，提供 MIME、CSP、路径穿越防护 |
| `electron:window` | BrowserWindow、窗口状态、`ready-to-show`、安全导航 |
| `electron:ipc` | preload 调用的全部 IPC handler，来源校验 |
| `electron:menu` | 原生菜单、快捷键、命令桥 |
| `electron:session` | 拒绝权限、关闭拼写检查、阻止 webview |

## 生命周期

使用 `vscode-instantiation` 的生命周期原语，而不是重写一套：

```ts
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'

const store = new DisposableStore()
store.add(toDisposable(() => app.off('activate', onActivate)))
ctx.effect(() => () => store.dispose())
```

同时框架使用自己的 Cordis 生命周期：内核卸载时按依赖逆序释放服务。两者分工明确：

- Cordis 管插件与服务的生命周期；
- `DisposableStore` 管窗口、事件监听、会话等底层资源。

## 窗口启动优化

```ts
new BrowserWindow({
  show: false,
  paintWhenInitiallyHidden: true,
  backgroundColor: '#141619',
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    backgroundThrottling: false,
    v8CacheOptions: 'code',
    preload,
  },
})
```

- `show: false` + `ready-to-show`：避免白屏和未完成布局的闪烁。
- `paintWhenInitiallyHidden`：允许离屏首帧，减少显示延迟。
- `v8CacheOptions: 'code'`：缓存编译后的代码，缩短二次启动。
- `backgroundThrottling: false`：窗口失焦时保持渲染节奏，适合长时间运行的专业工具。
- 窗口位置/尺寸/最大化状态持久化，并进行显示器可见性校验。

## 自定义协议

生产环境 **不使用 `file://`**。主进程注册两个 standard + secure 协议：

- `df-app://bundle/...`：渲染产物、WASM、字体、图片。
- `df-runtime://<shortCommit>/...`：按 commit 缓存的远程运行时。

协议处理会：

- 解码路径后 `resolve`，拒绝 `..` 与绝对路径；
- 使用正确 MIME（尤其是 `application/wasm`）；
- 对 HTML 注入 CSP；
- 对带哈希的资源返回 immutable 缓存；
- SPA 路由回退到 `index.html`。

WASM 通过 `fetch` 加载，因此必须使用可 fetch 的 secure scheme；这也是无法直接使用 `file://` 的原因。

## Preload 安全边界

`preload` 只暴露 `window.desktopFramework`：

```ts
openFiles / saveFile / windowControl / getWindowState
onWindowState / onCommand / openExternal / getRuntime
```

- 渲染进程没有 Node、`ipcRenderer`、`require`。
- IPC 校验 `senderFrame.url`：只接受开发服务器或 `df-app://bundle/`。
- 文件对话框过滤器、保存数据、URL 协议都在主进程二次校验。
- 默认拒绝所有权限请求（摄像头、麦克风、地理位置等）。

## 导航与外链

- `setWindowOpenHandler` 拒绝新窗口，http(s) 链接交给系统浏览器。
- `will-navigate` 阻止导航到非信任源。
- `will-attach-webview` 一律阻止。
- `externalProtocols` 可配置 `https:`、`http:`、`mailto:` 白名单。

## 原生菜单

菜单保留系统快捷键（复制、粘贴、缩放、全屏、开发者工具），点击业务项时通过 `df:command` 发送命令 id，渲染进程复用命令注册表。

Windows/Linux 隐藏菜单栏但保留 accelerator；macOS 使用系统应用菜单。

## 多窗口与资源释放

- `activate` 事件在无窗口时重新创建窗口。
- 窗口关闭时保存状态并清空 `host.mainWindow`。
- `DisposableStore` 在插件卸载时销毁窗口与事件监听。
- `before-quit` 先释放 Cordis 内核，再退出应用，避免退出过程中仍有 IPC/窗口回调。

## 崩溃与诊断

- `render-process-gone`、`child-process-gone`、`unresponsive` 写入主进程日志。
- 可配置 `crashReportUrl` 启用 `crashReporter`。
- 启动阶段用 `StartupTimer` 记录 `app-ready`、`runtime-resolved`、`window-shown`、`renderer-loaded`。
- 生产环境建议把日志写入企业日志系统，而不是只留在控制台。
