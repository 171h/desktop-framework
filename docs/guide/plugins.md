# 编写插件

## 最小插件

```ts
import type { Context } from 'cordis'

export const name = 'acme:hello'
export const inject = ['commands']

export function apply(ctx: Context): void {
  ctx.commands.register({
    id: 'acme.hello',
    title: 'Hello',
    icon: 'wave',
    ribbon: { tab: 'home', tabTitle: '主页', group: '示例' },
    run: () => console.log('hello'),
  })
}

export default { name, inject, apply }
```

## 注册停靠视图

```ts
import { markRaw } from 'vue'
import MyPanel from './MyPanel.vue'

ctx.workbench.registerView({
  id: 'acme.my-panel',
  title: '我的面板',
  icon: 'window',
  location: 'left', // left | right | bottom | main
  default: true,
  component: markRaw(MyPanel),
})
```

组件内通过 `useCordis()` 读取服务：

```vue
<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'

const ctx = useCordis()
</script>
```

## 向画布添加内容

```ts
ctx.surface.addNode({
  title: '分析结果',
  subtitle: '由 acme 插件生成',
  category: '分析',
  tone: 'teal',
  meta: { module: 'acme/plugin' },
})
```

## 自定义界面槽位

```ts
ctx.ui.registerSlot({
  id: 'acme.banner',
  slot: 'main.overlay',
  component: markRaw(Banner),
  order: 10,
})
```

宿主用 `<DfSlot name="main.overlay" />` 渲染。

## 状态栏

```ts
ctx.effect(() => ctx.statusbar.register({
  id: 'acme.count',
  alignment: 'right',
  icon: 'database',
  text: '0 项',
  getText: () => `${ctx.selection.current.value ? 1 : 0} 项`,
  command: 'acme.refresh',
}).dispose)
```

## 通知与对话框

```ts
ctx.notifications.success('保存成功')
const name = await ctx.ui.showPrompt({
  title: '重命名',
  value: '未命名',
  confirmLabel: '确定',
})
```

## 插件清单

建议每个插件提供 `manifest`：

```ts
await ctx.kernel.load([
  pluginEntry(myPlugin, undefined, {
    id: 'acme:review',
    name: '审阅工具',
    version: '0.3.0',
    description: '批注、视图与导出',
    commit: process.env.GIT_COMMIT,
  }),
])
```

## 动态启用

```ts
enabled: () => ctx.selection.hasKind('surface.node')
```

界面每次刷新都会读取，不需要手动同步。

## 测试

```ts
const ctx = await createFrameworkContext({ environment: 'test' })
await ctx.plugin(piniaPlugin)
await ctx.plugin(settingsPlugin, {
  namespace: 'test',
  storage: fakeStorage()
})
await ctx.plugin(commandsPlugin)
await ctx.plugin(myPlugin)
```

只加载被测插件依赖，不要启动完整 Electron。

## 常见错误

| 现象 | 原因 |
| --- | --- |
| 插件一直 pending | `inject` 声明了未加载的服务 |
| 卸载后监听器仍在 | 忘记 `ctx.effect` 或 disposer |
| 视图空白 | 组件没有 `markRaw`，被 Vue 深度代理或未注册 |
| Ribbon 不显示命令 | 命令 `ribbon` 元数据缺失或被 `hidden` |
| 快捷键无效 | 输入框内无修饰键；绑定冲突后注册覆盖 |
