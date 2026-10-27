/**
 * @desktop-framework/workbench · 工作台服务
 *
 * 负责：
 * - 注册/注销停靠视图；
 * - 维护布局与工作区（Pinia store）；
 * - 将布局、活动视图与自定义工作区持久化；
 * - 把常用布局操作注册成命令，供 Ribbon、菜单、快捷键与命令面板复用。
 */
import type {
  CommandDefinition,
  DockState,
  IDisposable,
  ViewDefinition,
  ViewLocation,
  WorkspacePreset,
} from '@desktop-framework/core'
import type { Context } from 'cordis'
import type { PersistedWorkbench } from './store'
import { debounce, errorMessage } from '@desktop-framework/core'
import { Service } from 'cordis'
import { markRaw, ref, watch } from 'vue'
import { BUILTIN_WORKSPACES, useWorkbenchStore } from './store'

export * from './store'

declare module 'cordis' {
  interface Context {
    workbench: WorkbenchService
  }
}

const DOCK_LABELS = {
  left: '左侧栏',
  right: '右侧栏',
  bottom: '底部面板',
} as const

/** 工作台服务。 */
export class WorkbenchService extends Service {
  static inject = ['commands', 'storage', 'pinia']

  readonly store
  private readonly viewMap = ref(new Map<string, ViewDefinition>())
  private readonly activeMain = ref<string>()
  private readonly workspaceCommands = new Map<string, IDisposable>()
  private readonly stopWatch: () => void
  private readonly persist: () => void

  constructor(ctx: Context) {
    super(ctx, 'workbench')
    this.store = useWorkbenchStore(ctx.pinia)
    const persisted = ctx.storage.get<Partial<PersistedWorkbench> | null>('workbench', null)
    this.store.hydrate(persisted)
    this.persist = debounce(() => {
      try {
        ctx.storage.set('workbench', this.store.snapshot())
      }
      catch (error) {
        ctx.logger.warn(`[workbench] 持久化失败：${errorMessage(error)}`)
      }
    }, 150)
    this.stopWatch = watch(
      () => [this.store.layout, this.store.workspaces, this.store.activeWorkspaceId],
      () => this.persist(),
      { deep: true },
    )
    ctx.effect(() => () => {
      this.stopWatch()
      this.persist()
    }, 'workbench:persistence')
    this.registerLayoutCommands()
    for (const workspace of this.store.workspaces) {
      this.registerWorkspaceCommand(workspace)
    }
  }

  /** 当前布局。 */
  get layout() {
    return this.store.layout
  }

  /** 工作区列表。 */
  get workspaces(): readonly WorkspacePreset[] {
    return this.store.workspaces
  }

  /** 当前工作区。 */
  get activeWorkspace(): WorkspacePreset {
    return this.store.activeWorkspace
  }

  /** 全部视图。 */
  get views(): readonly ViewDefinition[] {
    return [
      ...this.viewMap.value.values(),
    ].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  }

  /** 主区域活动视图。 */
  get activeMainView(): string | undefined {
    return this.activeMain.value ?? this.viewsAt('main')[0]?.id
  }

  /** 指定停靠位置的全部视图。 */
  viewsAt(location: ViewLocation): readonly ViewDefinition[] {
    return this.views.filter(view => view.location === location)
  }

  /** 指定停靠位置的活动视图。 */
  activeView(location: ViewLocation): ViewDefinition | undefined {
    if (location === 'main') {
      const id = this.activeMainView
      return this.views.find(view => view.id === id)
    }
    const id = this.store.layout[location].activeView
    return this.viewsAt(location).find(view => view.id === id) ?? this.viewsAt(location)[0]
  }

  /** 注册视图。 */
  registerView(view: ViewDefinition): IDisposable {
    if (this.viewMap.value.has(view.id)) {
      throw new Error(`视图 ${view.id} 已注册`)
    }
    const stored: ViewDefinition = view.component
      ? {
          ...view,
          component: markRaw(view.component),
        }
      : view
    this.viewMap.value.set(view.id, stored)
    this.viewMap.value = new Map(this.viewMap.value)
    if (view.location === 'main') {
      if (!this.activeMain.value || view.default) {
        this.activeMain.value = view.id
      }
    }
    else {
      const dock = this.store.layout[view.location]
      if (!dock.activeView || view.default) {
        this.store.updateDock(view.location, { activeView: view.id })
      }
    }
    const command = this.ctx.commands.register({
      id: `view.open.${view.id}`,
      title: `打开视图：${view.title}`,
      category: '视图',
      icon: view.icon,
      hidden: () => true,
      run: () => this.openView(view.id),
    })
    this.ctx.emit('view/registered', view)
    return {
      dispose: () => {
        command.dispose()
        if (this.viewMap.value.get(view.id)?.id === view.id) {
          this.viewMap.value.delete(view.id)
          this.viewMap.value = new Map(this.viewMap.value)
        }
      },
    }
  }

  /** 打开视图并激活所在停靠区。 */
  openView(id: string): void {
    const view = this.viewMap.value.get(id)
    if (!view) {
      return
    }
    if (view.location === 'main') {
      this.activeMain.value = id
    }
    else {
      this.store.setActiveView(view.location, id)
    }
  }

  /** 切换停靠区。 */
  toggleDock(location: Exclude<ViewLocation, 'main'>): void {
    this.store.toggleDock(location)
  }

  /** 切换 Ribbon 折叠。 */
  toggleRibbon(): void {
    this.store.setRibbonCollapsed(!this.store.layout.ribbonCollapsed)
  }

  /** 设置停靠尺寸。 */
  setDockSize(location: Exclude<ViewLocation, 'main'>, size: number): void {
    this.store.updateDock(location, { size })
  }

  /** 应用工作区。 */
  applyWorkspace(id: string): void {
    const workspace = this.store.applyWorkspace(id)
    if (workspace) {
      this.ctx.emit('workbench/workspace-applied', workspace)
    }
  }

  /** 保存当前布局为新工作区。 */
  saveWorkspace(name: string): WorkspacePreset {
    const workspace = this.store.saveWorkspace(name)
    this.registerWorkspaceCommand(workspace)
    return workspace
  }

  /** 删除自定义工作区。 */
  deleteWorkspace(id: string): boolean {
    const deleted = this.store.deleteWorkspace(id)
    if (deleted) {
      this.workspaceCommands.get(id)?.dispose()
      this.workspaceCommands.delete(id)
    }
    return deleted
  }

  /** 重置当前工作区布局。 */
  resetLayout(): void {
    this.store.applyWorkspace(this.store.activeWorkspaceId)
  }

  /** 布局变化通知，供 React/Vue 之外的消费者使用。 */
  notifyLayoutChanged(): void {
    this.ctx.emit('workbench/layout-changed', this.store.layout)
  }

  private registerLayoutCommands(): void {
    const commands: CommandDefinition[] = [
      {
        id: 'view.toggleLeft',
        title: '切换左侧栏',
        category: '视图',
        icon: 'layout-sidebar-left',
        keybinding: 'Mod+B',
        checked: () => this.store.layout.left.visible,
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '布局',
          order: 0,
          size: 'half',
        },
        menu: {
          path: ['视图'],
          order: 0,
        },
        run: () => this.toggleDock('left'),
      },
      {
        id: 'view.toggleRight',
        title: '切换右侧栏',
        category: '视图',
        icon: 'layout-sidebar-right',
        keybinding: 'Mod+Alt+B',
        checked: () => this.store.layout.right.visible,
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '布局',
          order: 1,
          size: 'half',
        },
        menu: {
          path: ['视图'],
          order: 1,
        },
        run: () => this.toggleDock('right'),
      },
      {
        id: 'view.toggleBottom',
        title: '切换底部面板',
        category: '视图',
        icon: 'layout-panel',
        keybinding: 'Mod+J',
        checked: () => this.store.layout.bottom.visible,
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '布局',
          order: 2,
          size: 'half',
        },
        menu: {
          path: ['视图'],
          order: 2,
        },
        run: () => this.toggleDock('bottom'),
      },
      {
        id: 'view.toggleRibbon',
        title: '折叠 / 展开功能区',
        category: '视图',
        icon: 'chevron-up',
        checked: () => !this.store.layout.ribbonCollapsed,
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '布局',
          order: 3,
          size: 'half',
        },
        menu: {
          path: ['视图'],
          order: 3,
        },
        run: () => this.toggleRibbon(),
      },
      {
        id: 'view.resetLayout',
        title: '重置当前工作区布局',
        category: '视图',
        icon: 'refresh',
        menu: {
          path: ['视图'],
          order: 9,
        },
        run: () => this.resetLayout(),
      },
    ]
    for (const command of commands) {
      this.ctx.effect(() => {
        const registration = this.ctx.commands.register(command)
        return () => registration.dispose()
      }, `workbench:${command.id}`)
    }
  }

  private registerWorkspaceCommand(workspace: WorkspacePreset): void {
    if (this.workspaceCommands.has(workspace.id)) {
      return
    }
    const command = this.ctx.commands.register({
      id: `workbench.workspace.${workspace.id}`,
      title: `切换工作区：${workspace.name}`,
      category: '工作区',
      icon: 'multiple-windows',
      checked: () => this.store.activeWorkspaceId === workspace.id,
      run: () => this.applyWorkspace(workspace.id),
    })
    this.workspaceCommands.set(workspace.id, command)
  }
}

/** 插件 id。 */
export const name = 'framework:workbench'
export const inject = ['commands', 'storage', 'pinia']

/** 插件主体。 */
export function apply(ctx: Context): void {
  ctx.plugin(WorkbenchService)
}

export { BUILTIN_WORKSPACES }
export default { name, inject, apply }

/** 停靠区标题，供宿主 UI 复用。 */
export function dockLabel(location: Exclude<ViewLocation, 'main'>): string {
  return DOCK_LABELS[location]
}

/** 读取停靠区状态。 */
export function dockState(layout: { left: DockState, right: DockState, bottom: DockState }, location: Exclude<ViewLocation, 'main'>): DockState {
  return layout[location]
}
