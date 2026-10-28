import type { Context } from 'cordis'
import type { Pinia } from 'pinia'
/**
 * @df/vue · Vue / Pinia 桥接
 *
 * Pinia 实例作为 Cordis 服务存在，插件可以在挂载 Vue 之前创建 store；Vue
 * 应用挂载时把 Cordis 上下文 provide 给组件树，业务组件通过 `useCordis()`
 * 读取服务，而不是跨包共享全局单例。
 */
import type { App, InjectionKey } from 'vue'
import { createPinia } from 'pinia'
import { inject } from 'vue'

declare module 'cordis' {
  interface Context {
    pinia: Pinia
  }
}

/** Pinia 插件 id。 */
export const name = 'framework:pinia'

/** Pinia 插件。 */
export function apply(ctx: Context): void {
  ctx.provide('pinia', createPinia())
}

export default { name, apply }

/** Cordis 上下文注入键。 */
export const frameworkContextKey: InjectionKey<Context> = Symbol('desktop-framework:context')

/** 把 Cordis 上下文与 Pinia 安装到 Vue 应用。 */
export function provideFrameworkContext(app: App, ctx: Context): void {
  app.provide(frameworkContextKey, ctx)
  app.use(ctx.pinia)
}

/** 读取 Cordis 上下文。 */
export function useCordis(): Context {
  const ctx = inject(frameworkContextKey)
  if (!ctx) {
    throw new Error('useCordis() 必须在 createFrameworkApp 挂载的组件树内使用')
  }
  return ctx
}

/** 读取指定 Cordis 服务。 */
export function useService<K extends keyof Context>(name: K): Context[K] {
  return useCordis()[name]
}

/** 创建并缓存一个 Pinia store，用于插件在挂载前初始化状态。 */
export function createStore<T>(ctx: Context, factory: (pinia: Pinia) => T): T {
  return factory(ctx.pinia)
}
