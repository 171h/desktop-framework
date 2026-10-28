/**
 * @df/output · 输出面板
 */
import type { Context } from 'cordis'
import { markRaw } from 'vue'
import OutputView from './OutputView.vue'

export const name = 'framework:output'
export const inject = ['workbench', 'commands']

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const registration = ctx.workbench.registerView({
      id: 'output',
      title: '输出',
      icon: 'output',
      location: 'bottom',
      default: true,
      component: markRaw(OutputView),
      pluginId: name,
    })
    return () => registration.dispose()
  }, 'output:view')
}

export default { name, inject, apply }
