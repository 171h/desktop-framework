/**
 * @desktop-framework/app · 框架装配入口
 *
 * 宿主只需要声明挂载节点、标题与额外插件。默认预设包含完整工作台；传入
 * `include` / `exclude` 可以裁剪能力，`plugins` 用于追加业务插件。
 */
import type { PluginEntry } from '@desktop-framework/core'
import type { PresetOptions } from './preset'
import { createFrameworkContext, detectEnvironment, pluginEntry } from '@desktop-framework/kernel'
import { StartupTimer } from '@desktop-framework/vscode'
import { createDefaultPreset, defaultPreset } from './preset'
import { createShellPlugin } from './shell'
import '@desktop-framework/ui/theme.css'

export { default as AppShell } from './AppShell.vue'
export * from './commands'
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
    ?? (options.include || options.exclude
      ? createDefaultPreset({ include: options.include, exclude: options.exclude })
      : defaultPreset)
  const entries: PluginEntry[] = [
    ...basePreset,
    ...(options.plugins ?? []),
    pluginEntry(
      createShellPlugin({
        el: options.el,
        title: options.title ?? 'Desktop Framework',
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

  await ctx.kernel.load(entries)
  startup.mark('plugins-ready')

  if (!ctx.shell) {
    throw new Error('应用外壳插件加载失败；请检查内核插件诊断信息')
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
