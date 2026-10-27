/**
 * @desktop-framework/ribbon · 命令驱动的功能区
 *
 * 插件只需在命令上声明 `ribbon` 放置信息。服务根据命令注册表实时构建
 * `vscode-ribbon` 的 `tabs` 数据；按钮的启用、勾选和快捷键状态都是惰性
 * 求值，因此无需手工同步 UI 状态。
 */
import type { CommandDefinition, IDisposable, RibbonPlacement, RibbonTabDefinition } from '@desktop-framework/core'
import type { Context } from 'cordis'
import type { VscRibbonGroup, VscRibbonItem, VscRibbonTab } from 'nusys-ui'
import { errorMessage } from '@desktop-framework/core'
import { Service } from 'cordis'
import { ref } from 'vue'

declare module 'cordis' {
  interface Context {
    ribbon: RibbonService
  }
}

const ACTIVE_TAB_KEY = 'ribbon.activeTab'

interface BuildTab {
  id: string
  title: string
  order: number
  description?: string
  groups: Map<string, BuildGroup>
}

interface BuildGroup {
  title: string
  order: number
  items: { order: number, item: VscRibbonItem }[]
}

export class RibbonService extends Service {
  static inject = ['commands', 'keybindings', 'storage']

  private readonly tabDefinitions = ref(new Map<string, RibbonTabDefinition>())
  private readonly active = ref('home')

  constructor(ctx: Context) {
    super(ctx, 'ribbon')
    this.active.value = ctx.storage.get<string>(ACTIVE_TAB_KEY, 'home')
  }

  /**
   * 当前 Ribbon 页签。
   *
   * 每次读取都会重新求值：按钮的 enabled/checked 可能来自外部可变状态，
   * 使用 computed 会把非响应式状态缓存成过期结果。
   */
  get tabs(): VscRibbonTab[] {
    return this.buildTabs()
  }

  /** 活动页签。 */
  get activeTabId(): string {
    return this.active.value
  }

  /** 注册页签元数据（无命令时不会显示）。 */
  registerTab(tab: RibbonTabDefinition): IDisposable {
    this.tabDefinitions.value.set(tab.id, tab)
    this.tabDefinitions.value = new Map(this.tabDefinitions.value)
    return {
      dispose: () => {
        this.tabDefinitions.value.delete(tab.id)
        this.tabDefinitions.value = new Map(this.tabDefinitions.value)
      },
    }
  }

  /** 切换页签。 */
  setActiveTab(id: string): void {
    this.active.value = id
    this.ctx.storage.set(ACTIVE_TAB_KEY, id)
  }

  /** 确保活动页签仍然存在。 */
  ensureActiveTab(): void {
    if (!this.tabs.some(tab => tab.id === this.active.value)) {
      const first = this.tabs[0]
      if (first) {
        this.setActiveTab(first.id)
      }
    }
  }

  /** 执行 Ribbon 命令。 */
  async execute(command: string, args: readonly unknown[] = []): Promise<void> {
    try {
      await this.ctx.commands.execute(command, ...args)
    }
    catch (error) {
      this.ctx.logger.warn(`[ribbon] ${command}: ${errorMessage(error)}`)
    }
  }

  private buildTabs(): VscRibbonTab[] {
    const tabs = new Map<string, BuildTab>()
    for (const definition of this.tabDefinitions.value.values()) {
      tabs.set(definition.id, {
        id: definition.id,
        title: definition.title,
        order: definition.order ?? 100,
        description: definition.description,
        groups: new Map(),
      })
    }
    for (const command of this.ctx.commands.list) {
      const placements = normalizePlacements(command)
      for (const placement of placements) {
        if (this.ctx.commands.isHidden(command.id)) {
          continue
        }
        const tab = tabs.get(placement.tab) ?? {
          id: placement.tab,
          title: placement.tabTitle ?? placement.tab,
          order: placement.tabOrder ?? 100,
          groups: new Map(),
        }
        tabs.set(tab.id, tab)
        const group = tab.groups.get(placement.group) ?? {
          title: placement.group,
          order: placement.groupOrder ?? 100,
          items: [],
        }
        tab.groups.set(group.title, group)
        group.items.push({
          order: placement.order ?? 100,
          item: toRibbonItem(this.ctx, command, placement),
        })
      }
    }
    return [
      ...tabs.values(),
    ]
      .map(tab => ({
        id: tab.id,
        title: tab.title,
        order: tab.order,
        groups: [
          ...tab.groups.values(),
        ]
          .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
          .map<VscRibbonGroup>(group => ({
            id: `${tab.id}.${group.title}`,
            title: group.title,
            items: group.items
              .sort((a, b) => a.order - b.order)
              .map(entry => entry.item),
          })),
      }))
      .filter(tab => tab.groups.length > 0)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title))
  }
}

function normalizePlacements(command: CommandDefinition): RibbonPlacement[] {
  if (!command.ribbon) {
    return []
  }
  return Array.isArray(command.ribbon)
    ? command.ribbon
    : [command.ribbon]
}

function toRibbonItem(ctx: Context, command: CommandDefinition, placement: RibbonPlacement): VscRibbonItem {
  return {
    command: command.id,
    title: command.title,
    icon: command.icon,
    size: placement.size ?? 'full',
    style: placement.style,
    type: placement.type ?? 'button',
    disabled: !ctx.commands.isEnabled(command.id),
    pressed: ctx.commands.isChecked(command.id),
    tooltip: command.description,
    keybinding: command.keybinding
      ? ctx.keybindings.format(command.keybinding)
      : undefined,
  }
}

/** 插件 id。 */
export const name = 'framework:ribbon'
export const inject = ['commands', 'keybindings', 'storage']

export function apply(ctx: Context): void {
  ctx.plugin(RibbonService)
}

export default { name, inject, apply }
