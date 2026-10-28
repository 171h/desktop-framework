import type { DeveloperDiagnostics, FrameworkRuntimeInfo, IDisposable, KernelPluginInfo } from '@df/core'
import type { Context } from 'cordis'
import { getMarks } from '@df/vscode'
import { Service } from 'cordis'
import { markRaw, ref } from 'vue'
import DiagnosticsView from './DiagnosticsView.vue'

declare module 'cordis' {
  interface Context {
    devtools: DeveloperToolsService
  }
}

export interface DiagnosticsSnapshot {
  capturedAt: string
  environment: string
  platform: string
  versions: Readonly<Record<string, string | undefined>>
  runtime: Pick<FrameworkRuntimeInfo, 'mode' | 'repository' | 'commit' | 'cached'> | null
  plugins: readonly KernelPluginInfo[]
  rendererStartup: { name: string, at: number }[]
  desktop: DeveloperDiagnostics | null
}

export class DeveloperToolsService extends Service {
  static inject = [
    'commands',
    'kernel',
    'platform',
    'editor',
    'workbench',
  ]

  readonly snapshot = ref<DiagnosticsSnapshot>()
  private document?: IDisposable

  constructor(ctx: Context) {
    super(ctx, 'devtools')
    const native = () => ctx.platform.supportsDeveloperTools
    const canReload = () => !ctx.editor.documents.some(document => document.dirty)
    ctx.effect(() => {
      // disabled 命令不会拦截浏览器默认快捷键；单独阻止未保存时的原生刷新。
      const guardReload = (event: KeyboardEvent): void => {
        if (!canReload() && event.key.toLowerCase() === 'r' && !event.altKey
          && (ctx.platform.platform === 'darwin'
            ? event.metaKey
            : event.ctrlKey)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }
      window.addEventListener('keydown', guardReload, true)
      return () => window.removeEventListener('keydown', guardReload, true)
    }, 'devtools:reload-guard')
    const placement = (group: string, order: number) => ({
      tab: 'developer',
      tabTitle: '开发者',
      tabOrder: 90,
      group,
      groupOrder: group === '调试'
        ? 0
        : 10,
      order,
      size: 'full' as const,
    })
    const menu = {
      path: ['开发者'],
    }
    const registration = ctx.commands.registerMany([
      {
        id: 'developer.toggleDevTools',
        title: '切换开发者工具',
        category: '开发者',
        icon: 'debug-console',
        description: '打开或关闭 Chromium 开发者工具（控制台、元素、网络、性能）',
        keybinding: ctx.platform.platform === 'darwin'
          ? 'Mod+Alt+I'
          : 'Mod+Shift+I',
        enabled: native,
        ribbon: placement('调试', 0),
        menu,
        run: () => ctx.platform.developerAction('toggleDevTools'),
      },
      {
        id: 'developer.reloadWindow',
        title: '重载窗口',
        category: '开发者',
        icon: 'refresh',
        description: '重新加载当前窗口；有未保存文档时不可用',
        keybinding: 'Mod+R',
        enabled: () => canReload() && (!ctx.platform.isElectron || native()),
        ribbon: placement('调试', 1),
        menu,
        run: () => ctx.platform.developerAction('reload'),
      },
      {
        id: 'developer.reloadIgnoringCache',
        title: '忽略缓存重载',
        category: '开发者',
        icon: 'debug-restart',
        description: '忽略浏览器资源缓存并重载，不删除框架版本缓存；有未保存文档时不可用',
        keybinding: 'Mod+Shift+R',
        enabled: () => native() && canReload(),
        ribbon: placement('调试', 2),
        menu,
        run: () => ctx.platform.developerAction('reloadIgnoringCache'),
      },
      {
        id: 'developer.showDiagnostics',
        title: '运行诊断',
        category: '开发者',
        icon: 'pulse',
        description: '查看运行环境、插件状态、进程资源与启动阶段',
        ribbon: placement('诊断', 0),
        menu,
        run: () => {
          this.document = ctx.editor.open({
            id: 'developer.diagnostics',
            title: '开发者：运行诊断',
            icon: 'pulse',
            component: markRaw(DiagnosticsView),
          })
        },
      },
      {
        id: 'developer.showOutput',
        title: '运行输出',
        category: '开发者',
        icon: 'output',
        enabled: () => ctx.workbench.views.some(view => view.id === 'output'),
        ribbon: placement('诊断', 1),
        menu,
        run: () => ctx.workbench.openView('output'),
      },
      {
        id: 'developer.exportDiagnostics',
        title: '导出诊断',
        category: '开发者',
        icon: 'export',
        ribbon: placement('诊断', 2),
        menu,
        run: async () => {
          const snapshot = await this.refresh()
          await ctx.platform.saveFile({
            title: '导出开发者诊断',
            defaultPath: 'desktop-framework-diagnostics.json',
            filters: [
              {
                name: 'JSON',
                extensions: ['json'],
              },
            ],
            data: new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
          })
        },
      },
    ])
    ctx.effect(() => () => {
      registration.dispose()
      this.document?.dispose()
    }, 'devtools:contributions')
  }

  async refresh(): Promise<DiagnosticsSnapshot> {
    const [runtime, desktop] = await Promise.all([
      this.ctx.platform.getRuntime(),
      this.ctx.platform.getDeveloperDiagnostics(),
    ])
    const marks = getMarks().filter(mark => mark.name.startsWith('df/startup/renderer/'))
    const origin = marks[0]?.startTime ?? 0
    const snapshot: DiagnosticsSnapshot = {
      capturedAt: new Date().toISOString(),
      environment: this.ctx.kernel.environment,
      platform: this.ctx.platform.platform,
      versions: { ...this.ctx.platform.versions },
      runtime: runtime
        ? {
            mode: runtime.mode,
            repository: runtime.repository,
            commit: runtime.commit,
            cached: runtime.cached,
          }
        : null,
      plugins: this.ctx.kernel.plugins,
      rendererStartup: marks.map(mark => ({
        name: mark.name.replace('df/startup/renderer/', ''),
        at: mark.startTime - origin,
      })),
      desktop,
    }
    this.snapshot.value = snapshot
    return snapshot
  }
}

export const name = 'framework:devtools'
export const inject = DeveloperToolsService.inject
export async function apply(ctx: Context): Promise<void> {
  await ctx.plugin(DeveloperToolsService)
}
export default { name, inject, apply }
