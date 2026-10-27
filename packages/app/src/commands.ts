/**
 * 框架内置命令：保存工作区、帮助、退出等。
 *
 * 业务插件不应重复实现这些命令；直接调用或覆盖即可。
 */
import type { Context } from 'cordis'
import { errorMessage } from '@desktop-framework/core'

export const name = 'framework:app-commands'
export const inject = [
  'commands',
  'workbench',
  'ui',
  'notifications',
  'platform',
  'kernel',
]

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'workbench.saveWorkspace',
      title: '保存工作区…',
      category: '工作区',
      icon: 'save',
      ribbon: {
        tab: 'home',
        tabTitle: '主页',
        tabOrder: 0,
        group: '工作区',
        groupOrder: 20,
        order: 0,
        size: 'half',
      },
      menu: {
        path: ['文件'],
        order: 0,
      },
      toolbar: { order: 40 },
      run: async () => {
        const name = await ctx.ui.showPrompt({
          title: '保存工作区',
          message: '保存当前停靠面板、活动视图与 Ribbon 状态。',
          placeholder: '工作区名称',
          value: `我的工作区 ${ctx.workbench.workspaces.filter(workspace => !workspace.builtin).length + 1}`,
          confirmLabel: '保存',
        })
        if (!name?.trim()) {
          return
        }
        try {
          const workspace = ctx.workbench.saveWorkspace(name)
          ctx.notifications.success(`工作区「${workspace.name}」已保存`)
        }
        catch (error) {
          ctx.notifications.error(`保存工作区失败：${errorMessage(error)}`)
        }
      },
    })
    return () => command.dispose()
  }, 'app:save-workspace')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'app.openDocs',
      title: '打开框架文档',
      category: '帮助',
      icon: 'book',
      menu: {
        path: ['帮助'],
        order: 0,
      },
      run: () => ctx.platform.openExternal('https://github.com/171h/desktop-framework'),
    })
    return () => command.dispose()
  }, 'app:docs')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'app.about',
      title: '关于 Desktop Framework',
      category: '帮助',
      icon: 'info',
      menu: {
        path: ['帮助'],
        order: 10,
      },
      run: () => {
        const versions = ctx.platform.versions
        const plugins = ctx.kernel.plugins.filter(plugin => plugin.status === 'loaded').length
        ctx.notifications.info(
          `Desktop Framework ${ctx.kernel.version} · ${plugins} 个插件 · ${versions.electron
            ? `Electron ${versions.electron}`
            : 'Browser'}`,
        )
      },
    })
    return () => command.dispose()
  }, 'app:about')

  ctx.effect(() => {
    const command = ctx.commands.register({
      id: 'app.quit',
      title: '退出',
      category: '应用',
      icon: 'sign-out',
      keybinding: 'Mod+Q',
      enabled: () => ctx.platform.isElectron,
      menu: {
        path: ['文件'],
        order: 100,
      },
      run: async () => {
        await ctx.platform.windowControl('close')
      },
    })
    return () => command.dispose()
  }, 'app:quit')
}

export default { name, inject, apply }
