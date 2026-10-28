# 文档标签页与 Ribbon 位置

主工作区默认使用 VS Code 风格文档标签页。任何插件都可以通过 `ctx.editor` 打开文档，不必直接操作标签栏组件。

## 打开文档

```ts
import { markRaw } from 'vue'
import MyEditor from './MyEditor.vue'

ctx.effect(() => {
  const registration = ctx.editor.open({
    id: 'my-editor',
    title: '我的文档',
    icon: 'file-code',
    component: markRaw(MyEditor),
    closable: true,
  })
  return () => registration.dispose()
}, 'my-plugin:editor')
```

`EditorDocument` 支持：

| 字段 | 说明 |
| --- | --- |
| `id` | 文档唯一 id；重复打开会激活已有标签页 |
| `title` / `icon` | 标签标题与 Codicon |
| `component` | 主工作区渲染的 Vue 组件 |
| `dirty` | 未保存标记；可通过 `setDirty` 更新 |
| `pinned` | 固定标签页；始终位于非固定标签页左侧 |
| `preview` | 预览标签页；标题使用斜体 |
| `closable` | `false` 时用户无法关闭；插件卸载仍会强制释放 |

`open()` 返回 `IDisposable`，适合在 `ctx.effect` 中注册文档。

## VS Code 风格交互

标签栏复用 nusys-ui 的 `vscode-tabs`，补充以下文档语义：

- 拖拽排序、水平溢出滚动、方向键焦点；
- 关闭按钮、中键关闭、右键菜单；
- 关闭其他、关闭右侧、关闭全部；
- 固定 / 取消固定、脏状态圆点、预览斜体；
- `Ctrl+W` 关闭当前标签页；
- `Ctrl+Tab` / `Ctrl+Shift+Tab` 切换标签页；
- 切换标签页时通过 `KeepAlive` 保留文档组件状态。

主工作区优先渲染当前活动文档；没有文档时回退到 `workbench.registerView({ location: 'main' })` 提供的主视图。标签栏本身不占用编辑内容区域。

## Ribbon 标签栏位置

功能区页签支持两种布局：

- `titlebar`：默认值，页签显示在标题栏中，Ribbon 内容仍位于标题栏下方；
- `separate`：页签使用 Ribbon 自带的独立一行。

设置持久化在 `ribbon.tabPlacement`。Ribbon 的「主页 → 功能区」组提供 **页签位置** 切换按钮；标题栏模式还会显示一个向下箭头按钮，便于快速移回独立一行。

```ts
ctx.ribbon.setTabPlacement('separate')
ctx.ribbon.toggleTabPlacement()
```

标题栏模式会在标题栏中保留可拖动空白区；页签、工具按钮和折叠按钮均标记为 `no-drag`，不会破坏原生窗口拖动。

## 相关服务

| 服务 | 说明 |
| --- | --- |
| `ctx.editor` | 文档生命周期、活动标签与关闭/固定/脏状态 |
| `ctx.ribbon` | 功能区页签、活动页签与 `tabPlacement` |

`vscode-ribbon` 尚未开放“隐藏内置页签栏”属性，框架的 `DfRibbon` 在 `hideTabs` 模式下向开放 Shadow DOM 注入一条最小样式；后续 nusys-ui 提供原生属性后可移除该兼容层。
