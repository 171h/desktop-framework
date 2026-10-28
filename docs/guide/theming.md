# 主题与 nusys-ui

## UI 组件唯一来源

框架的所有控件来自 git submodule `submodules/nusys-ui` 发布的 npm 包 `nusys-ui`：

- `vscode-button`
- `vscode-toolbar-button`
- `vscode-toolbar-container`
- `vscode-ribbon`
- `vscode-split-layout`
- `vscode-tree` / `vscode-tree-item`
- `vscode-table`
- `vscode-textfield`
- `vscode-context-menu`
- `vscode-icon`
- `vscode-collapsible`
- `vscode-progress-ring` 等

框架不引入第二套基础控件库。业务应用也应遵循这一约束。

`submodules/nusys-ui` 用于源码审阅与上游修改；运行依赖固定为与之对应的 npm 版本（当前 `4.2.1`）。这样既保留 submodule 的唯一来源约束，又避免要求每个宿主在安装时编译 Lit 组件库。

## Codicon

nusys-ui 的 Shadow DOM 需要宿主页面提供固定 id 的 Codicon 样式表。`@df/ui` 通过 Vite `?url` 导入 CSS 并自动插入：

```ts
ensureCodiconStylesheet()
```

`df-app://` 协议保证字体在 Electron 生产环境可用。

## 主题令牌

主题定义在 `packages/ui/src/theme.css`：

- `graphite`：AutoDesk 风格深色工作台
- `porcelain`：浅色工作台
- `system`：跟随系统

框架同时映射 `--vscode-*` 变量，nusys-ui 组件无需修改即可匹配主题：

```css
[data-theme='graphite'] {
  --df-accent: #e2a244;
  --vscode-focusBorder: var(--df-accent);
  --vscode-menu-background: var(--df-elevated);
}
```

## 切换

```ts
ctx.ui.setTheme('porcelain')
ctx.ui.cycleTheme()
```

标题栏、应用菜单与命令面板共享 `ui.theme.cycle` 命令。

## 扩展 nusys-ui

当 nusys-ui 缺少能力时，优先顺序：

1. 用现有组件组合（推荐）：例如应用菜单由 `vscode-button`、`vscode-toolbar-button` 与 CSS 组合。
2. 在 `@df/ui` 增加框架级组件，保持对 nusys-ui 的依赖。
3. 修改 submodule 中的 nusys-ui 组件，向上游提交 PR；框架侧固定对应版本。

不要复制 nusys-ui 源码到业务包，也不要引入 Element Plus、Ant Design 等第二套组件。

## 自定义主题

产品可以在框架主题之后覆盖 CSS 变量：

```css
:root[data-theme='graphite'] {
  --df-accent: #00a3a3;
  --vscode-button-background: #008080;
}
```

如需完整新主题，在 `ThemeId` 中扩展并注册，或在应用入口设置：

```ts
document.documentElement.dataset.theme = 'my-theme'
```

## 字体

- UI：`Segoe UI Variable / Segoe UI / system-ui / PingFang SC / Microsoft YaHei`
- 代码与状态数据：`Cascadia Code / SFMono-Regular / Consolas`

两者都通过 `--vscode-font-family` 与 `--vscode-editor-font-family` 下发到 Shadow DOM。
