# 工作区

工作区是“布局 + 活动视图 + 面板可见性”的快照。

## 内置工作区

| id | 名称 | 适用 |
| --- | --- | --- |
| `modeling` | 建模 | 左右面板 + 完整 Ribbon |
| `review` | 审阅 | 左右面板 + 底部输出 |
| `focus` | 专注 | 隐藏侧栏并折叠 Ribbon |
| `compact` | 紧凑 | 小屏/辅助显示器 |

## 切换

```ts
ctx.workbench.applyWorkspace('review')
```

标题栏工作区下拉、应用菜单、命令面板都调用同一服务。

## 拖动调整

`DfSplitLayout` 包装 nusys-ui 的 `vscode-split-layout`：

- 左右面板拖动改变像素宽度；
- 底部面板拖动改变高度；
- 双击分隔条恢复初始比例；
- 窗口缩放时固定面板保持尺寸。

尺寸变化写入 Pinia store，并在 150ms 防抖后持久化。

## 保存自定义工作区

```ts
const workspace = ctx.workbench.saveWorkspace('审阅 - 双屏')
```

保存内容：

```ts
{
  left: { visible, size, activeView },
  right: { visible, size, activeView },
  bottom: { visible, size, activeView },
  ribbonCollapsed,
  statusbarVisible,
}
```

标题栏下拉中的“保存当前工作区…”会调用 `ctx.ui.showPrompt()` 获取名称。

## 持久化

- 键：`desktop-framework:workbench`
- 内容：布局、全部工作区、当前工作区 id
- 读取时会校验尺寸范围与活动视图 id；损坏数据回退默认值。

## 视图注册

```ts
ctx.workbench.registerView({
  id: 'acme.assets',
  title: '资产',
  icon: 'library',
  location: 'left',
  order: 10,
  default: false,
  closable: true,
  component: markRaw(AssetsView),
})
```

同一停靠区的视图显示为标签，点击切换写入 store。左右侧栏还可以分离为浮动面板、拖动、缩放和重新停靠，详见[浮动侧栏与停靠](/guide/docking)。

## 主视图

主工作区默认由 `editor` 插件承载文档标签页；画布、文档、图表等页面通过 `ctx.editor.open()` 作为文档打开，具体见[文档标签页](/guide/editor)。

`location: 'main'` 仍可用于没有文档时提供中央区域回退视图：

```ts
ctx.workbench.registerView({
  id: 'acme.document',
  title: '文档',
  location: 'main',
  component: markRaw(DocumentView),
})
```

多个 main 视图时，第一个成为默认，可用 `openView` 切换；只要存在编辑器文档，MainRegion 会优先渲染活动文档。

## 响应式读取

```ts
const layout = computed(() => ctx.workbench.layout)
```

服务 getter 返回 Pinia 的响应式对象，Vue 组件可直接绑定。
