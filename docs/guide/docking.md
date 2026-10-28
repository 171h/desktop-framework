# 面板停靠、分组与恢复

工作台支持按面板自由组合布局：同一侧可以容纳多个面板，面板之间可以左右并排、上下堆叠，或合并为标签组。左侧、右侧和底部共用同一套布局机制；浮动面板默认位于主窗口工作区内，拖出主窗口后会转换为独立桌面窗口。

## 拖动与吸附

- 拖动标题栏握柄或空白处，移动整个标签组；拖动某个标签，可单独拆出该面板。
- 拖到另一个面板的中心，预览显示「合并为标签组」，释放后合并。
- 拖到面板左 / 右边缘，释放后左右并排；拖到上 / 下边缘，释放后上下堆叠。分割可以继续嵌套。
- 拖到工作区左、右或底部边缘，释放后停靠。目标侧已有面板会保留，新组追加为分割区域。
- 浮动面板接近工作区边界或其他浮动面板边缘时会自动对齐。
- 将浮动面板拖出主窗口边缘，光标离开主窗口后会自动转换为独立面板窗口；独立窗口可以移动到屏幕任意位置。关闭独立窗口会释放其中的面板。
- 主窗口内的 DOM 无法绘制到窗口之外，因此跨出窗口时改由原生 `BrowserWindow` 承载面板；主进程通过屏幕光标位置检测窗口边界，不依赖窗口外仍会丢失的指针事件。
- 独立面板窗口之间通过主进程同步选择状态，属性面板和资源树可以继续响应主窗口或画布中的选择变化。
- 拖动时按住 `Ctrl` 暂停吸附及停靠；按 `Esc` 取消本次拖动，恢复拖动前的分组和位置。指针取消或窗口失焦也会回退本次拖动。
- 拖动分割线调整并排宽度或堆叠高度；浮动面板的四边、四角均可调整尺寸。

界面采用落点预览，并在释放时提交分组。这个交互参考了 [AutoCAD 的停靠、浮动与锚定面板](https://help.autodesk.com/cloudhelp/2020/ENG/AutoCAD-Core/files/GUID-893A3C0A-C735-49E4-878E-C8641DEAD618.htm)。

## 隐藏与重新显示

- 标题栏「隐藏当前面板」按钮只隐藏当前标签，组内其他面板仍保留。
- 「收起标签组」按钮隐藏组内全部可见面板。
- 隐藏后，工作区边缘会出现带名称的悬浮恢复按钮。点击后回到原来的分组或浮动位置。
- `Mod+Alt+P` 恢复最近隐藏的面板。前九个注册的面板默认使用 `Mod+Alt+1` 到 `Mod+Alt+9` 切换显示 / 隐藏，也可在「视图 → 面板」菜单和命令面板中按名称操作。
- `Mod+B`、`Mod+Alt+B`、`Mod+J` 切换左侧、右侧、底部区域；该区域的浮动容器也会一起隐藏或恢复。

`Mod` 在 Windows / Linux 为 Ctrl，在 macOS 为 Command。插件可通过 `ViewDefinition.keybinding` 为面板指定固定快捷键。

```ts
ctx.workbench.registerView({
  id: 'acme.properties',
  title: '业务属性',
  location: 'right',
  keybinding: 'Mod+Alt+8',
  component: PropertiesView,
})
```

## 保存与恢复

布局自动保存分割方向和比例、标签成员与活动标签、浮动位置和尺寸、隐藏状态，以及侧边停靠区的宽度 / 高度。保存自定义工作区时也会包含这些信息。

日常操作使用防抖写入，页面退出、重载及服务释放时会同步保存最后一次操作。重启后自动恢复；窗口变小时，主窗口内的浮动容器会限制到可见工作区，避免标题栏落在窗口外。已经转移到独立面板窗口的浮动面板不写回主窗口布局。

旧版仅有左右侧栏的布局会自动迁移。尚未注册或暂时卸载的插件面板不会渲染，但它的布局信息会保留；插件应保持面板 ID 稳定，以便重新加载后恢复原位。

## 插件 API

`registerView()` 的 `location` 代表初始位置。用户移动后，以 `ctx.workbench.docking` 为当前布局依据，面板定义无需改写。

```ts
import { groupForView } from '@df/workbench'

const source = groupForView(ctx.workbench.docking, 'acme.properties')
const target = groupForView(ctx.workbench.docking, 'explorer')

if (source && target) {
  // left / right：并排；top / bottom：堆叠；center：标签合并。
  ctx.workbench.movePanel(source.id, target.id, 'bottom', 'acme.properties')
}

ctx.workbench.hidePanel('acme.properties')
ctx.workbench.openView('acme.properties') // 恢复并激活，不改变布局位置。
```

主要接口：

| 接口 | 功能 |
| --- | --- |
| `movePanel(groupId, targetId, placement, viewId?)` | 移动整个组或某个标签，分割或合并到目标组 |
| `floatPanel(groupId, geometry, viewId?)` | 分离为浮动标签组，返回新组 ID |
| `dockPanel(groupId, side)` | 停靠到 left / right / bottom，保留目标侧其他面板 |
| `floatRegion(side)` | 将整个停靠区连同分割关系放入浮动容器 |
| `hidePanel(viewId)` / `showPanel(viewId)` | 隐藏 / 恢复面板 |
| `activatePanel(groupId, viewId)` | 切换组内活动标签 |
| `setPanelRatio(splitId, ratio)` | 修改分割比例 |
| `setFloatingGeometry(floatingId, geometry)` | 修改浮动容器的位置与大小 |
| `detachPanelPayload(floatingId)` | 生成拖出到独立窗口的节点描述 |
| `removeFloatingPanel(floatingId)` | 从主窗口移除已转移的浮动容器 |

浮动坐标相对于 `.df-workbench`，不包含标题栏、Ribbon 和状态栏。旧 `floatDock` / `dockSidebar` API 为兼容保留；需要操作用户重组后的面板时，请使用基于组 ID 的接口。独立面板窗口由桌面宿主的 `ctx.platform.openDetachedWindow()` 创建，浏览器宿主不会启用该能力。

## 布局数据

`WorkbenchLayout.docking` 是版本为 2 的可序列化布局：

- `roots.left / right / bottom` 为各停靠区根节点。
- `group` 节点存放面板 ID 列表和活动标签。
- `split` 节点存放两个子节点、方向与比例。
- `floating` 保存浮动容器的节点树、几何和原停靠侧。
- `hidden` 保存隐藏的面板 ID；隐藏不移除节点。

恢复时会校验节点深度和数量、去除重复成员，并限制比例与几何范围。插件不应直接修改布局树，优先使用工作台服务方法。
