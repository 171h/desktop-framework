/**
 * @df/explorer · 资源浏览器
 *
 * 不直接持有数据：工作区来自 workbench store，插件来自 kernel 事件，
 * 命令来自 commands 注册表。视图关闭后只释放自己的槽位注册。
 */
import type { Context } from 'cordis'
import { markRaw } from 'vue'
import ExplorerView from './ExplorerView.vue'

export const name = 'framework:explorer'
export const inject = [
  'commands',
  'workbench',
  'selection',
  'kernel',
]

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const registration = ctx.workbench.registerView({
      id: 'explorer',
      title: '资源浏览器',
      icon: 'files',
      location: 'left',
      default: true,
      component: markRaw(ExplorerView),
      pluginId: name,
    })
    return () => registration.dispose()
  }, 'explorer:view')
}

export default { name, inject, apply }
