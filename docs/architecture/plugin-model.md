# 插件模型

## 一切皆插件

框架没有“核心功能例外”。Ribbon、状态栏、画布、Electron 窗口、协议、IPC、菜单都是插件。内核只做四件事：

1. 创建 Cordis Context；
2. 加载插件条目；
3. 记录加载耗时与错误；
4. 卸载时按依赖逆序释放资源。

## 插件形态

Cordis 支持函数、类与对象插件。框架推荐对象形式，便于声明 `name` 与 `inject`：

```ts
import type { Context } from 'cordis'
import { definePlugin } from '@df/kernel'

export const name = 'acme:review'
export const inject = ['commands', 'workbench', 'selection']

export function apply(ctx: Context): void {
  // 注册服务、命令、视图、监听器
}

export default definePlugin({ name, inject, apply })
```

## 声明依赖

```ts
export const inject = ['commands', 'notifications']
```

Cordis 会等待依赖服务出现后再执行插件；插件可以动态注册/注销。循环依赖会被诊断。

也可以使用对象形式注入配置：

```ts
export const inject = {
  commands: {},
  workbench: {},
}
```

## 资源释放

任何注册行为都应返回 disposer 或使用 `ctx.effect`：

```ts
ctx.effect(() => {
  const registration = ctx.commands.register(command)
  return () => registration.dispose()
}, 'acme:command')
```

`ctx.effect` 的返回值会在插件卸载、内核关闭或热更新时调用。窗口、IPC、DOM 监听器同理。

VS Code 的 `DisposableStore` 也可直接使用：

```ts
import { DisposableStore, toDisposable } from '@df/vscode'

const store = new DisposableStore()
store.add(toDisposable(() => window.removeEventListener('resize', onResize)))
ctx.effect(() => () => store.dispose())
```

## 加载与卸载

```ts
await ctx.kernel.load([
  pluginEntry(myPlugin, config, { id: 'acme:my-plugin', name: '我的插件' }),
])

await ctx.kernel.unload('acme:my-plugin')
await ctx.kernel.reload('acme:my-plugin')
```

加载结果是 `KernelPluginInfo`：

```ts
{
  id, name, source, status, durationMs, error, commit
}
```

失败插件默认不会阻塞其他插件；`strict: true` 时立即抛出。

## 贡献点

| 能力 | API |
| --- | --- |
| 命令 | `ctx.commands.register()` |
| 快捷键 | 命令 `keybinding` 自动注册 |
| Ribbon | 命令 `ribbon` 元数据 |
| 应用菜单 | 命令 `menu` 元数据 |
| 快速访问 | 命令 `toolbar` 元数据 |
| 停靠视图 | `ctx.workbench.registerView()` |
| 状态栏 | `ctx.statusbar.register()` |
| 通知 | `ctx.notifications.notify()` |
| 主题 | `ctx.ui.setTheme()` |
| 界面槽位 | `ctx.ui.registerSlot()` |
| 画布 | `ctx.surface.addNode()` |
| 选择 | `ctx.selection.select()` |

## 运行时插件配置

生产环境的插件清单应来自配置文件或远端 manifest，而不是把业务插件写死在框架中：

```ts
const plugins = await loadPluginManifest('/plugins/manifest.json')
await ctx.kernel.load(plugins)
```

后续可以把插件 ESM 托管到企业服务器，使用与运行时相同的完整性校验策略。

## 失败隔离

- 单个插件失败只记录 `failed`，界面仍可启动。
- `command/failed` 自动进入通知中心。
- 主进程插件失败会显示在 Electron 主进程日志；关键插件（窗口）失败会阻止启动并弹出错误。

## 调试

- 输出面板订阅内核、命令、工作区与主题事件。
- 资源浏览器展示插件状态与加载耗时。
- 属性面板展示插件版本、来源、错误与 commit。
