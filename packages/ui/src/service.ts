/**
 * UI 服务：主题、槽位与对话框。
 */
import type { IDisposable, ThemeId } from '@df/core'
import type { Context } from 'cordis'
import type { PromptOptions, PromptState, UiSlotContribution } from './types'
import { Service } from 'cordis'
import { markRaw, reactive, ref } from 'vue'
import { ensureCodiconStylesheet } from './nusys'

declare module 'cordis' {
  interface Context {
    ui: UiService
  }
}

const THEME_KEY = 'ui.theme'

export class UiService extends Service {
  static inject = ['storage', 'commands']

  private readonly themeRef = ref<ThemeId>('graphite')
  private readonly slots = reactive(new Map<string, UiSlotContribution[]>())
  private readonly palette = ref(false)
  private readonly promptState = ref<PromptState | null>(null)
  private mediaQuery?: MediaQueryList
  private mediaListener?: () => void

  constructor(ctx: Context) {
    super(ctx, 'ui')
    ensureCodiconStylesheet()
    const persisted = ctx.storage.get<ThemeId>(THEME_KEY, 'graphite')
    this.themeRef.value = persisted
    this.applyTheme()
    ctx.effect(() => () => {
      this.mediaQuery?.removeEventListener('change', this.mediaListener ?? (() => {}))
    }, 'ui:theme-listener')
    ctx.effect(() => {
      const command = this.ctx.commands.register({
        id: 'ui.theme.cycle',
        title: '切换界面主题',
        category: '视图',
        icon: 'color-mode',
        ribbon: [
          {
            tab: 'home',
            tabTitle: '主页',
            tabOrder: 0,
            group: '外观',
            groupOrder: 30,
            order: 0,
            size: 'half',
          },
          {
            tab: 'view',
            tabTitle: '视图',
            tabOrder: 20,
            group: '主题',
            order: 0,
            size: 'half',
          },
        ],
        menu: {
          path: ['视图'],
          order: 20,
        },
        run: () => this.cycleTheme(),
      })
      return () => command.dispose()
    }, 'ui:theme-command')
    ctx.effect(() => {
      const command = this.ctx.commands.register({
        id: 'ui.commandPalette',
        title: '打开命令面板',
        category: '视图',
        icon: 'search',
        keybinding: 'Mod+Shift+P',
        hidden: () => true,
        run: () => this.togglePalette(true),
      })
      return () => command.dispose()
    }, 'ui:palette-command')
  }

  /** 当前主题。 */
  get theme(): ThemeId {
    return this.themeRef.value
  }

  /** 已解析为 light / dark 的主题。 */
  get resolvedTheme(): 'light' | 'dark' {
    if (this.themeRef.value === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return this.themeRef.value === 'graphite'
      ? 'dark'
      : 'light'
  }

  /** 命令面板是否打开。 */
  get commandPaletteOpen(): boolean {
    return this.palette.value
  }

  /** 当前对话框。 */
  get prompt(): PromptState | null {
    return this.promptState.value
  }

  /** 设置主题。 */
  setTheme(theme: ThemeId): void {
    this.themeRef.value = theme
    this.ctx.storage.set(THEME_KEY, theme)
    this.applyTheme()
    this.ctx.emit('ui/theme-changed', theme)
  }

  /** 在 graphite → porcelain → system 之间循环。 */
  cycleTheme(): void {
    const order: ThemeId[] = ['graphite', 'porcelain', 'system']
    const next = order[(order.indexOf(this.themeRef.value) + 1) % order.length]
    this.setTheme(next)
  }

  /** 注册槽位贡献。 */
  registerSlot(contribution: UiSlotContribution): IDisposable {
    const list = this.slots.get(contribution.slot) ?? []
    if (list.some(item => item.id === contribution.id)) {
      throw new Error(`槽位 ${contribution.slot} 中的 ${contribution.id} 已注册`)
    }
    const next = [
      ...list,
      {
        ...contribution,
        component: markRaw(contribution.component),
      },
    ]
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
    this.slots.set(contribution.slot, next)
    this.slots.set(contribution.slot, [...next])
    return {
      dispose: () => {
        this.slots.set(
          contribution.slot,
          (this.slots.get(contribution.slot) ?? []).filter(item => item.id !== contribution.id),
        )
        this.slots.set(contribution.slot, [
          ...(this.slots.get(contribution.slot) ?? []),
        ])
      },
    }
  }

  /** 读取槽位贡献。 */
  slot(name: string): readonly UiSlotContribution[] {
    return this.slots.get(name) ?? []
  }

  /** 打开/关闭命令面板。 */
  togglePalette(open = !this.palette.value): void {
    this.palette.value = open
  }

  /** 弹出文本输入框。 */
  showPrompt(options: PromptOptions): Promise<string | null> {
    this.promptState.value?.resolve(null)
    return new Promise((resolve) => {
      this.promptState.value = { ...options, resolve }
    })
  }

  /** 关闭对话框。 */
  resolvePrompt(value: string | null): void {
    const state = this.promptState.value
    this.promptState.value = null
    state?.resolve(value)
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') {
      return
    }
    const resolved = this.resolvedTheme
    document.documentElement.dataset.theme = this.themeRef.value === 'system'
      ? resolved
      : this.themeRef.value
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
    if (this.themeRef.value === 'system' && typeof window !== 'undefined') {
      this.mediaQuery ??= window.matchMedia('(prefers-color-scheme: dark)')
      this.mediaListener ??= () => this.applyTheme()
      this.mediaQuery.addEventListener('change', this.mediaListener)
    }
  }
}

export const name = 'framework:ui'
export const inject = ['storage', 'commands']

export function apply(ctx: Context): void {
  ctx.plugin(UiService)
}

export default { name, inject, apply }
