# 命令系统

命令是框架唯一的交互入口。Ribbon、应用菜单、快速访问工具栏、快捷键与命令面板都只引用命令 id。

## 定义命令

```ts
ctx.commands.register({
  id: 'view.toggleLeft',
  title: '切换左侧栏',
  category: '视图',
  icon: 'layout-sidebar-left',
  keybinding: 'Mod+B',
  checked: () => ctx.workbench.layout.left.visible,
  ribbon: {
    tab: 'view',
    tabTitle: '视图',
    group: '布局',
    order: 0,
    size: 'half',
  },
  menu: {
    path: ['视图'],
    order: 0
  },
  toolbar: { order: 10 },
  run: () => ctx.workbench.toggleDock('left'),
})
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 全局唯一，建议 `域.动作` |
| `title` | 界面显示名 |
| `category` | 命令面板分类 |
| `icon` | Codicon 名称 |
| `keybinding` | 例如 `Mod+Shift+P`；`Mod` 按平台解析 |
| `enabled` | 惰性启用条件 |
| `checked` | 切换按钮的勾选状态 |
| `hidden` | 是否从界面隐藏（仍可 API 执行） |
| `ribbon` | 一个或多个 Ribbon 放置 |
| `menu` | 一个或多个应用菜单路径 |
| `toolbar` | 是否进入快速访问工具栏 |
| `run` | 执行函数，接收 Cordis Context 与参数 |

## 放置到 Ribbon

```ts
ribbon: {
  tab: 'home',
  tabTitle: '主页',
  tabOrder: 0,
  group: '画布',
  groupOrder: 0,
  order: 10,
  size: 'full', // full | half | third
  style: 'iconAndLabel', // icon | iconAndLabel
  type: 'button', // button | dropdown | splitButton
}
```

无需手工维护页签：Ribbon 服务读取命令注册表，按 `tab/group/order` 聚合。命令增加、删除、启用状态变化会自动反映。

## 快捷键

- 绑定由 `@df/keybindings` 统一解析。
- 命令注册时带 `keybinding`，快捷键服务会自动建立绑定，并在命令注销时清理。
- 输入框、文本域、`contenteditable` 内默认不触发无修饰键的快捷键。
- macOS 上显示为 `⌘`、`⌥`、`⌃`、`⇧`；其他平台显示 `Ctrl+Alt+...`。

## 应用菜单与快速访问

`menu.path` 的第一个元素是分组标题，`toolbar` 控制是否出现在标题栏快速访问区：

```ts
ctx.commands.register({
  id: 'acme.export',
  title: '导出…',
  icon: 'export',
  menu: {
    path: ['文件'],
    order: 10
  },
  toolbar: { order: 20 },
  run: () => ctx.ui.showPrompt({ title: '导出' }),
})
```

## 覆盖框架命令

需要定制默认行为时，可以覆盖注册：

```ts
ctx.commands.register({
  ...ctx.commands.get('view.toggleLeft')!,
  run: () => myToggle(),
}, { override: true })
```

返回的 disposer 会恢复被覆盖的命令，适合插件热替换。

## 执行与错误

```ts
await ctx.commands.execute('acme.export')
```

- 命令不存在、被禁用或抛错时会广播 `command/failed`。
- 通知插件自动把失败转为错误通知。
- 所有界面入口共享同一条执行路径，不需要在每个按钮里重复 try/catch。
