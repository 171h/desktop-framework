import type { StartupTimer } from '@desktop-framework/vscode'
import type { Context } from 'cordis'
/**
 * Vue 外壳服务。
 *
 * 外壳本身也是插件：它挂载 AppShell，并把 Cordis 上下文注入 Vue 组件树。
 * 卸载插件会按顺序卸掉 Vue 应用，避免 HMR 或运行时插件切换留下事件监听。
 */
import type { App as VueApp } from 'vue'
import { errorMessage } from '@desktop-framework/core'
import { provideFrameworkContext } from '@desktop-framework/vue'
import { Context as CordisContext, Service } from 'cordis'
import { createApp } from 'vue'
import AppShell from './AppShell.vue'

declare module 'cordis' {
  interface Context {
    shell: ShellService
  }
}

export interface ShellConfig {
  el: string | HTMLElement
  title: string
  startup?: StartupTimer
}

export class ShellService extends Service {
  readonly title: string
  private vueApp?: VueApp
  private readonly mountTarget: string | HTMLElement
  private readonly startup?: StartupTimer

  constructor(ctx: Context, config: ShellConfig) {
    super(ctx, 'shell')
    this.title = config.title
    this.mountTarget = config.el
    this.startup = config.startup
    ctx.effect(() => () => this.unmount(), 'shell:unmount')
    this.mount()
  }

  /** 挂载状态。 */
  get mounted(): boolean {
    return Boolean(this.vueApp)
  }

  /** 挂载 Vue 应用。 */
  mount(): void {
    if (this.vueApp) {
      return
    }
    const target = typeof this.mountTarget === 'string'
      ? document.querySelector<HTMLElement>(this.mountTarget)
      : this.mountTarget
    if (!target) {
      throw new Error(`找不到挂载节点 ${String(this.mountTarget)}`)
    }
    const app = createApp(AppShell)
    app.config.performance = true
    app.config.errorHandler = (error, _instance, info) => {
      console.error(`[shell] ${info}`, error)
      this.ctx.logger.error(`[shell] ${info}: ${errorMessage(error)}`)
      this.ctx.notifications?.error(`界面错误：${errorMessage(error)}`)
    }
    app.config.warnHandler = (message, _instance, trace) => {
      console.warn('[shell]', message, trace)
    }
    // 根上下文没有 fiber 注入限制，适合作为 Vue 的全局服务读取入口；
    // 业务组件仍然只能通过类型化服务名访问，不会拿到内部 fiber。
    const rootContext = (this.ctx as unknown as Record<PropertyKey, unknown>)[CordisContext.root] as Context | undefined
    provideFrameworkContext(app, rootContext ?? this.ctx)
    this.vueApp = app
    app.mount(target)
    document.title = this.title
    this.startup?.mark('shell-mounted')
    console.info('[shell] mounted')
  }

  /** 卸载 Vue 应用。 */
  unmount(): void {
    const app = this.vueApp
    if (!app) {
      return
    }
    this.vueApp = undefined
    try {
      app.unmount()
    }
    catch (error) {
      this.ctx.logger.warn(`[shell] 卸载失败：${errorMessage(error)}`)
    }
  }
}

export function createShellPlugin(config: ShellConfig) {
  return {
    name: 'framework:shell',
    inject: [
      'ui',
      'notifications',
      'storage',
      'commands',
      'pinia',
      'platform',
      'workbench',
      'ribbon',
      'menu',
      'statusbar',
      'keybindings',
      'selection',
      'surface',
      'wasm',
      'kernel',
    ],
    apply(ctx: Context) {
      ctx.plugin(ShellService, config)
    },
  }
}
