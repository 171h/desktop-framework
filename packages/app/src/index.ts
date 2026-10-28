/**
 * @df/app · 框架装配入口
 *
 * 宿主只需要声明挂载节点、标题与额外插件。默认预设包含完整工作台；传入
 * `include` / `exclude` 可以裁剪能力，`plugins` 用于追加业务插件。
 */
import type { PluginEntry } from '@df/core'
import type { PresetOptions } from './preset'
import type { ShellConfig } from './shell'
import { createFrameworkContext, detectEnvironment, pluginEntry } from '@df/kernel'
import { StartupTimer } from '@df/vscode'
import { createDefaultPreset, defaultPreset } from './preset'
import { createShellPlugin } from './shell'
import '@df/ui/theme.css'

export { default as AppShell } from './AppShell.vue'
export { AccountService } from './account'
export type { AccountUser, LoginInput } from './account'
export * from './commands'
export { default as DetachedEditorShell } from './DetachedEditorShell.vue'
export { default as DetachedPanelShell } from './DetachedPanelShell.vue'
export * from './preset'
export * from './shell'
export { defaultPreset }

export interface CreateFrameworkAppOptions extends PresetOptions {
  /** 挂载节点选择器或元素。 */
  el: string | HTMLElement
  /** 窗口标题。 */
  title?: string
  /** 完全替换默认预设。 */
  preset?: PluginEntry[]
  /** 追加业务插件，位于预设之后、外壳之前。 */
  plugins?: PluginEntry[]
  /** 自定义 Vue 外壳及其服务依赖。 */
  shell?: Pick<ShellConfig, 'component' | 'inject'>
  /** 自定义外壳的根组件属性。 */
  shellProps?: Record<string, unknown>
}

export interface FrameworkApp {
  ctx: Awaited<ReturnType<typeof createFrameworkContext>>
  shell: import('./shell').ShellService
  startup: StartupTimer
  dispose: () => Promise<void>
}

/** 创建并启动框架应用。 */
export async function createFrameworkApp(options: CreateFrameworkAppOptions): Promise<FrameworkApp> {
  const startup = new StartupTimer('renderer')
  startup.mark('boot')
  const ctx = await createFrameworkContext({
    environment: detectEnvironment(),
    version: '0.1.0',
    strict: false,
  })
  startup.mark('context-ready')

  const basePreset = options.preset
    ?? createDefaultPreset({ include: options.include, exclude: options.exclude, extra: options.extra })
  const entries: PluginEntry[] = [
    ...basePreset,
    ...(options.plugins ?? []),
    pluginEntry(
      createShellPlugin({
        ...options.shell,
        el: options.el,
        title: options.title ?? 'Desktop Framework',
        props: options.shellProps,
        startup,
      }),
      undefined,
      {
        id: 'framework:shell',
        name: '应用外壳',
        version: '0.1.0',
        description: 'Vue 工作台外壳与 Cordis 上下文桥接',
      },
    ),
  ]

  try {
    await ctx.kernel.load(entries)
    startup.mark('plugins-ready')

    if (!ctx.shell?.mounted) {
      throw new Error('应用外壳插件加载失败；请检查内核插件诊断信息')
    }
  }
  catch (error) {
    await ctx.kernel.dispose()
    throw error
  }

  return {
    ctx,
    shell: ctx.shell,
    startup,
    dispose: async () => {
      startup.mark('dispose')
      await ctx.kernel.dispose()
    },
  }
}
