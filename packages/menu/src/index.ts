/**
 * @df/menu · 应用菜单
 *
 * 命令通过 `menu` 元数据声明归属路径（例如 `['视图']`），本服务聚合成
 * 应用菜单分组。快速访问工具栏使用同一命令源（`toolbar` 元数据），因此
 * 三处入口不会出现状态不一致。
 */
import type { CommandDefinition, IDisposable, MenuPlacement } from '@df/core'
import type { Context } from 'cordis'
import { Service } from 'cordis'
import { computed, ref } from 'vue'

declare module 'cordis' {
  interface Context {
    menu: MenuService
  }
}

/** 菜单项。 */
export interface AppMenuItem {
  id: string
  label: string
  path: string[]
  section: string
  order: number
  icon?: string
  command: string
  keybinding?: string
  disabled?: boolean
}

/** 菜单分组。 */
export interface AppMenuSection {
  id: string
  label: string
  order: number
  items: AppMenuItem[]
}

export class MenuService extends Service {
  static inject = ['commands', 'keybindings', 'workbench']

  private readonly openRef = ref(false)
  private readonly entries = computed<AppMenuItem[]>(() => this.buildEntries())

  constructor(ctx: Context) {
    super(ctx, 'menu')
  }

  get visible(): boolean {
    return this.openRef.value
  }

  get items(): readonly AppMenuItem[] {
    return this.entries.value
  }

  get sections(): readonly AppMenuSection[] {
    const sections = new Map<string, AppMenuSection>()
    for (const item of this.entries.value) {
      const section = sections.get(item.section) ?? {
        id: item.section,
        label: item.section,
        order: 100,
        items: [],
      }
      section.items.push(item)
      sections.set(item.section, section)
    }
    const sectionOrder: Record<string, number> = {
      文件: 0,
      编辑: 10,
      视图: 20,
      工作区: 30,
      实验室: 40,
      帮助: 90,
    }
    return [
      ...sections.values(),
    ]
      .map(section => ({
        ...section,
        items: section.items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => (sectionOrder[a.label] ?? 100) - (sectionOrder[b.label] ?? 100) || a.label.localeCompare(b.label))
  }

  get quickAccess(): readonly AppMenuItem[] {
    return this.entries.value
      .filter(item => this.ctx.commands.get(item.command)?.toolbar)
      .sort((a, b) => {
        const left = this.ctx.commands.get(a.command)?.toolbar
        const right = this.ctx.commands.get(b.command)?.toolbar
        return orderOf(left) - orderOf(right)
      })
  }

  /** 打开/关闭应用菜单。 */
  toggle(open = !this.openRef.value): void {
    this.openRef.value = open
  }

  /** 关闭。 */
  close(): void {
    this.openRef.value = false
  }

  /** 执行菜单项。 */
  async execute(item: AppMenuItem): Promise<void> {
    if (!this.ctx.commands.isEnabled(item.command)) {
      return
    }
    this.close()
    await this.ctx.commands.execute(item.command)
  }

  /** 额外注册菜单项（不经过命令）。 */
  register(item: Omit<AppMenuItem, 'id' | 'section'> & { id?: string }): IDisposable {
    const entry: AppMenuItem = {
      ...item,
      id: item.id ?? `menu.${item.command}`,
      section: item.path[0] ?? '其他',
    }
    this.extras.value = [...this.extras.value, entry]
    return {
      dispose: () => {
        this.extras.value = this.extras.value.filter(candidate => candidate.id !== entry.id)
      },
    }
  }

  private readonly extras = ref<AppMenuItem[]>([])

  private buildEntries(): AppMenuItem[] {
    const result: AppMenuItem[] = []
    for (const command of this.ctx.commands.list) {
      const placements = normalizeMenuPlacements(command)
      for (const placement of placements) {
        if (this.ctx.commands.isHidden(command.id)) {
          continue
        }
        result.push({
          id: `${command.id}:${placement.path.join('/')}`,
          label: command.title,
          path: placement.path,
          section: placement.path[0] ?? '其他',
          order: placement.order ?? 100,
          icon: command.icon,
          command: command.id,
          keybinding: command.keybinding
            ? this.ctx.keybindings.format(command.keybinding)
            : undefined,
          disabled: !this.ctx.commands.isEnabled(command.id),
        })
      }
    }
    result.push(...this.extras.value)
    return result
  }
}

function orderOf(placement: CommandDefinition['toolbar']): number {
  return typeof placement === 'object'
    ? placement.order ?? 100
    : 100
}

function normalizeMenuPlacements(command: CommandDefinition): MenuPlacement[] {
  if (!command.menu) {
    return []
  }
  return Array.isArray(command.menu)
    ? command.menu
    : [command.menu]
}

export const name = 'framework:menu'
export const inject = ['commands', 'keybindings', 'workbench']

export function apply(ctx: Context): void {
  ctx.plugin(MenuService)
}

export default { name, inject, apply }
