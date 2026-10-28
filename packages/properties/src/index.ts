/**
 * @df/properties · 属性面板
 *
 * 面板本身不感知业务类型，只读取 selection 服务的 `kind` 与 `data`。
 */
import type { Context } from 'cordis'
import { markRaw } from 'vue'
import PropertiesView from './PropertiesView.vue'

export const name = 'framework:properties'
export const inject = [
  'workbench',
  'selection',
  'kernel',
  'platform',
]

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const registration = ctx.workbench.registerView({
      id: 'properties',
      title: '属性',
      icon: 'symbol-field',
      location: 'right',
      default: true,
      component: markRaw(PropertiesView),
      pluginId: name,
    })
    return () => registration.dispose()
  }, 'properties:view')
}

export default { name, inject, apply }
