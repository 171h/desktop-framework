# 开发者工具

默认预设包含 `@df/devtools` 插件。点击 Ribbon 的「开发者」页签，可以使用「调试」与「诊断」两组工具；应用菜单和命令面板也提供相同命令。

## 调试与重载

| 入口 | 功能 | Windows / Linux | macOS |
| --- | --- | --- | --- |
| 切换开发者工具 | 打开或关闭 Chromium DevTools | Ctrl+Shift+I | ⌘⌥I |
| 重载窗口 | 重新加载当前窗口 | Ctrl+R | ⌘R |
| 忽略缓存重载 | 忽略浏览器资源缓存后重新加载 | Ctrl+Shift+R | ⌘⇧R |

Chromium DevTools 包含元素检查、Console、Network、Sources 和 Performance，可用于检查样式、脚本错误、网络请求及页面性能。窗口控制覆盖层启用时，Windows 上的 DevTools 可能以独立窗口打开；这是 [Electron 的窗口行为](https://www.electronjs.org/docs/latest/api/web-contents#contentsopendevtoolsoptions)。

窗口重载会重新创建渲染端插件，未持久化的临时状态会丢失。存在 `dirty: true` 的编辑器文档时，框架的重载命令和对应刷新快捷键会被阻止；请先保存或关闭未保存文档。

「忽略缓存重载」不会删除按 commit 下载的框架运行时缓存，不会切换框架版本，也不会清空工作区设置。

浏览器版不能从页面直接打开浏览器 DevTools，因此调试器和忽略缓存重载按钮不可用。请使用浏览器快捷键；运行诊断、普通重载和导出诊断仍可使用。连接旧版 Electron 宿主时，不支持的新操作同样会被禁用。

## 运行诊断

「运行诊断」会打开可关闭的文档标签页，显示：

- 运行环境、操作系统平台和应用 / Electron / Chromium / Node 版本。
- 框架运行时来源、commit 与缓存命中情况。
- 插件 ID、状态、加载等待时间及失败原因。
- Electron 各进程的 PID、类型、CPU 平均使用率和内存工作集。
- 主进程启动阶段，以及相对首个标记的渲染进程启动阶段。

数据按快照显示，点击刷新按钮更新。CPU 使用率是 Electron 两次采样之间的平均值，首次采样可能为 0；浏览器和旧版宿主不提供进程资源数据。

「运行输出」打开已有的底部输出视图；宿主没有安装输出插件时，该命令不可用。

「导出诊断」将当前快照保存为 JSON。桌面端使用系统保存对话框，浏览器版下载文件。导出不包含配置请求头、环境变量或本地运行时缓存目录，但会包含插件标识、版本和插件错误消息；分享前可以检查文件内容。

## 插件与宿主定制

命令 ID：

```text
developer.toggleDevTools
developer.reloadWindow
developer.reloadIgnoringCache
developer.showDiagnostics
developer.showOutput
developer.exportDiagnostics
```

通过 `ctx.commands.execute(id)` 调用命令，Ribbon 和应用菜单共享命令的启用状态。

开发者工具是独立插件，不是外壳的强制依赖。宿主可裁剪默认预设：

```ts
createDefaultPreset({ exclude: ['framework:devtools'] })
```

卸载插件会移除其命令、Ribbon 内容、诊断标签页和快捷键保护监听器。Electron 原生菜单属于宿主菜单配置；完全定制或裁剪原生入口时，通过 `bootstrapElectron({ menu: ... })` 提供自己的菜单。

Electron 通过 preload 的可选 `developerAction` 和 `getDeveloperDiagnostics` 接口提供能力。主进程校验发送窗口、主 frame 和来源，并只接受列举的开发者操作；不暴露通用脚本执行或任意 IPC 调用。
