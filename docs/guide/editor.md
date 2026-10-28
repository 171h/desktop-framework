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
| `pinned` | 固定标签页；始终位于非固定标签页左侧，滚动时保持可见 |
| `preview` | 预览标签页；同一时间只保留一个，标题使用斜体 |
| `closable` | `false` 时用户无法关闭；插件卸载仍会强制释放 |
| `detachKey` | 拖出到独立窗口时使用的恢复键 |
| `getDetachState` | 返回可结构化克隆的文档状态，供独立窗口恢复 |

`open()` 返回 `IDisposable`，适合在 `ctx.effect` 中注册文档。

## VS Code 风格交互

标签栏行为参考 VS Code 的 `EditorGroupModel` 与 `MultiEditorTabsControl`：

- 拖拽排序，固定标签始终位于左侧且滚动时保持可见；普通标签不能拖入固定区；
- 水平溢出滚动，方向键移动焦点，活动标签自动滚入可视范围；
- 预览标签使用斜体，同一时间只保留一个；打开新的预览文档会替换旧的预览标签；
- 双击预览标签可保留标签页；固定 / 取消固定通过右键菜单或 `togglePin`；
- 关闭按钮、中键关闭、右键菜单；
- 关闭其他、关闭右侧、关闭已保存、关闭全部；
- 脏状态圆点、固定图标、预览斜体；
- `Ctrl+W` 关闭当前标签页；
- `Ctrl+Tab` / `Ctrl+Shift+Tab` 按最近使用（MRU）顺序切换；
- `Ctrl+PageDown` / `Ctrl+PageUp` 按标签顺序切换；
- `Ctrl+Shift+T` 重新打开最近关闭的标签页；
- 切换标签页时通过 `KeepAlive` 保留文档组件状态。

打开文档时可通过 `preview: true` 打开预览标签，通过 `pinned: true` 打开固定标签。`open()` 返回 `IDisposable`，适合在 `ctx.effect` 中注册文档。

## 独立窗口

Electron 桌面宿主支持将文档标签拖出主窗口，或通过标签右键菜单的 **移动到新窗口** 创建独立编辑器窗口。独立窗口使用精简外壳，只保留当前文档和标签栏。

标签也可以在多个编辑器窗口之间拖动：把一个窗口的标签拖到另一个窗口的标签栏，目标窗口会接收文档，源窗口在最后一个标签移出后自动关闭。跨窗口拖放只执行移动，不会复制文档。

文档通过 `detachKey` 与恢复处理器跨窗口重建。未注册处理器的文档会显示一个独立窗口占位页；需要保留状态的插件应注册处理器，并通过 `getDetachState()` 返回可结构化克隆的数据：

```ts
ctx.effect(() => {
  const registration = ctx.editor.open({
    id: 'acme.document',
    title: '业务文档',
    component: markRaw(AcmeDocument),
    detachKey: 'acme.document',
    getDetachState: () => documentState.snapshot(),
  })
  return () => registration.dispose()
}, 'acme:editor')

ctx.effect(() => ctx.editor.registerDetachHandler('acme.document', (state) => {
  documentState.restore(state)
}).dispose, 'acme:detach')
```

浏览器宿主不支持独立窗口，拖出标签不会移除原标签。

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
