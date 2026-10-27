import type { Context } from 'cordis'
import { markRaw } from 'vue'
import PluginLabView from './PluginLabView.vue'

export const name = 'playground:lab'
export const inject = [
  'commands',
  'workbench',
  'notifications',
  'surface',
  'ui',
]

export function apply(ctx: Context): void {
  const registration = ctx.workbench.registerView({
    id: 'playground.lab',
    title: '插件实验室',
    icon: 'beaker',
    location: 'left',
    component: markRaw(PluginLabView),
    pluginId: name,
  })
  ctx.effect(() => () => registration.dispose(), 'playground:lab-view')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'playground.addNode',
      title: '添加实验室卡片',
      category: '实验室',
      icon: 'add',
      ribbon: {
        tab: 'lab',
        tabTitle: '插件实验室',
        tabOrder: 30,
        group: '画布扩展',
        order: 0,
        size: 'half',
      },
      menu: {
        path: ['实验室'],
        order: 0,
      },
      run: () => {
        const node = ctx.surface.addNode({
          title: '插件实验室',
          subtitle: '这张卡片由 playground 插件在运行时添加',
          category: '示例',
          tone: 'rose',
          meta: { module: 'playground/app', role: 'example' },
        })
        ctx.notifications.success(`已添加画布卡片「${node.title}」`)
      },
    })
    return () => command.dispose()
  }, 'playground:add-node')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'playground.notify',
      title: '发送示例通知',
      category: '实验室',
      icon: 'bell',
      ribbon: {
        tab: 'lab',
        tabTitle: '插件实验室',
        tabOrder: 30,
        group: '反馈',
        order: 0,
        size: 'half',
      },
      menu: {
        path: ['实验室'],
        order: 1,
      },
      run: () => {
        ctx.notifications.info('这是由插件触发的通知，命令失败时会自动转成错误通知。')
      },
    })
    return () => command.dispose()
  }, 'playground:notify')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'playground.saveWorkspace',
      title: '保存工作区…',
      category: '实验室',
      icon: 'save',
      ribbon: {
        tab: 'lab',
        tabTitle: '插件实验室',
        tabOrder: 30,
        group: '布局',
        order: 0,
        size: 'half',
      },
      menu: {
        path: ['实验室'],
        order: 2,
      },
      run: async () => {
        const name = await ctx.ui.showPrompt({
          title: '保存工作区',
          message: '保存当前面板宽度、可见性与活动视图。',
          placeholder: '工作区名称',
          value: '插件实验室布局',
          confirmLabel: '保存',
        })
        if (!name?.trim()) {
          return
        }
        const workspace = ctx.workbench.saveWorkspace(name)
        ctx.notifications.success(`工作区「${workspace.name}」已保存`)
      },
    })
    return () => command.dispose()
  }, 'playground:save-workspace')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'playground.openLab',
      title: '打开插件实验室',
      category: '实验室',
      icon: 'beaker',
      menu: {
        path: ['实验室'],
        order: 3,
      },
      run: () => ctx.workbench.openView('playground.lab'),
    })
    return () => command.dispose()
  }, 'playground:open-lab')
}

export default { name, inject, apply }
