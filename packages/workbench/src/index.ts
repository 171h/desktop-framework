/**
 * @df/workbench · 工作台服务
 *
 * 负责：
 * - 注册/注销停靠视图；
 * - 维护布局与工作区（Pinia store）；
 * - 将布局、活动视图与自定义工作区持久化；
 * - 把常用布局操作注册成命令，供 Ribbon、菜单、快捷键与命令面板复用。
 */
import type {
  CommandDefinition,
  DockEdge,
  DockGroupNode,
  DockingLayout,
  DockNode,
  DockPlacement,
  DockSide,
  DockState,
  FloatingDockState,
  IDisposable,
  SidebarId,
  ViewDefinition,
  ViewLocation,
  WorkspacePreset,
} from '@df/core'
import type { Context } from 'cordis'
import type { PersistedWorkbench } from './store'
import { clamp, errorMessage } from '@df/core'
import { Service } from 'cordis'
import { markRaw, ref, watch } from 'vue'
import { allNodes, cloneDocking, containsNode, dockPanel, ensurePanel, findGroup, floatPanel, groupForView, movePanel, sanitizeGeometry, sideForGroup } from './docking'
import { BUILTIN_WORKSPACES, defaultFloatingDock, useWorkbenchStore } from './store'

export * from './docking'
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
  private panelShortcut = 0

  constructor(ctx: Context) {
    super(ctx, 'workbench')
    this.store = useWorkbenchStore(ctx.pinia)
    const persisted = ctx.storage.get<Partial<PersistedWorkbench> | null>('workbench', null)
    this.store.hydrate(persisted)
    let persistTimer: ReturnType<typeof setTimeout> | undefined
    const save = (): void => {
      try {
        ctx.storage.set('workbench', this.store.snapshot())
      }
      catch (error) {
        ctx.logger.warn(`[workbench] 持久化失败：${errorMessage(error)}`)
      }
    }
    this.persist = () => {
      clearTimeout(persistTimer)
      persistTimer = setTimeout(save, 150)
    }
    if (typeof window !== 'undefined') {
      ctx.effect(() => {
        const flush = (): void => {
          clearTimeout(persistTimer)
          save()
        }
        window.addEventListener('beforeunload', flush)
        window.addEventListener('pagehide', flush)
        return () => {
          window.removeEventListener('beforeunload', flush)
          window.removeEventListener('pagehide', flush)
        }
      }, 'workbench:flush-on-exit')
    }
    this.stopWatch = watch(
      () => [this.store.layout, this.store.workspaces, this.store.activeWorkspaceId],
      () => this.persist(),
      { deep: true },
    )
    ctx.effect(() => () => {
      this.stopWatch()
      clearTimeout(persistTimer)
      save()
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

  get docking(): DockingLayout {
    return this.store.layout.docking!
  }

  panelGroup(id: string): DockGroupNode | undefined {
    return findGroup(this.docking, id)
  }

  panelViews(group: DockGroupNode): readonly ViewDefinition[] {
    return group.views.flatMap((id) => {
      const view = this.viewMap.value.get(id)
      return view && !this.docking.hidden.includes(id)
        ? [view]
        : []
    })
  }

  visibleDockNode(node: DockNode | null): DockNode | null {
    if (!node)
      return null
    if (node.type === 'group') {
      return this.panelViews(node).length
        ? node
        : null
    }
    const first = this.visibleDockNode(node.children[0])
    const second = this.visibleDockNode(node.children[1])
    if (!first)
      return second
    if (!second)
      return first
    return {
      ...node,
      children: [first, second],
    }
  }

  get hiddenPanels(): readonly ViewDefinition[] {
    return this.docking.hidden.flatMap(id => this.viewMap.value.get(id)
      ? [
          this.viewMap.value.get(id)!,
        ]
      : [])
  }

  panelSide(viewId: string): DockEdge {
    const group = groupForView(this.docking, viewId)
    return group
      ? sideForGroup(this.docking, group.id)
      : 'left'
  }

  hidePanel(viewId: string): void {
    if (groupForView(this.docking, viewId) && !this.docking.hidden.includes(viewId))
      this.docking.hidden.push(viewId)
  }

  showPanel(viewId: string): void {
    this.docking.hidden = this.docking.hidden.filter(id => id !== viewId)
    const group = groupForView(this.docking, viewId)
    if (group)
      group.activeView = viewId
    const view = this.viewMap.value.get(viewId)
    if (view && view.location !== 'main')
      this.store.layout[view.location].visible = true
  }

  activatePanel(groupId: string, viewId: string): void {
    if (this.panelGroup(groupId)?.views.includes(viewId))
      this.showPanel(viewId)
  }

  cyclePanel(groupId: string, direction: number): void {
    const group = this.panelGroup(groupId)
    if (!group)
      return
    const views = this.panelViews(group)
    if (!views.length)
      return
    const index = views.findIndex(view => view.id === group.activeView)
    this.activatePanel(groupId, views[(Math.max(0, index) + direction + views.length) % views.length].id)
  }

  floatPanel(groupId: string, geometry: FloatingDockState, viewId?: string): string | undefined {
    return floatPanel(this.docking, groupId, geometry, viewId)
  }

  dockPanel(groupId: string, side: DockEdge): void {
    dockPanel(this.docking, groupId, side)
  }

  /** 将整个停靠区（含分割与标签关系）分离为一个浮动容器。 */
  floatRegion(side: DockEdge): void {
    const node = this.docking.roots[side]
    if (!node || !this.visibleDockNode(node))
      return
    const geometry = defaultFloatingDock(side === 'right'
      ? 'right'
      : 'left', side === 'bottom'
      ? 400
      : this.layout[side].size)
    this.docking.roots[side] = null
    this.docking.floating.push({
      id: node.id,
      node,
      geometry,
      lastSide: side,
    })
    if (side !== 'bottom')
      this.store.floatDock(side, geometry)
  }

  movePanel(groupId: string, targetId: string, placement: DockPlacement, viewId?: string): boolean {
    const side = sideForGroup(this.docking, targetId)
    const docked = this.docking.roots[side] && containsNode(this.docking.roots[side]!, targetId)
    const moved = movePanel(this.docking, groupId, targetId, placement, viewId)
    if (moved && docked && side !== 'bottom' && (placement === 'left' || placement === 'right')) {
      this.store.updateDock(side, {
        size: Math.max(this.layout[side].size, 480),
      })
    }
    return moved
  }

  setPanelRatio(id: string, ratio: number): void {
    const node = allNodes(this.docking).find(node => node.id === id)
    if (node?.type === 'split' && Number.isFinite(ratio))
      node.ratio = clamp(ratio, 0.15, 0.85)
  }

  setFloatingGeometry(id: string, geometry: FloatingDockState): void {
    const panel = this.docking.floating.find(panel => panel.id === id)
    if (panel)
      panel.geometry = sanitizeGeometry(geometry)
  }

  restorePanelLayout(layout: DockingLayout): void {
    this.store.layout.docking = cloneDocking(layout)
  }

  private reconcilePanels(): void {
    for (const view of this.views) {
      if (view.location !== 'main') {
        const legacy = this.layout[view.location]
        ensurePanel(this.docking, view.id, view.location, legacy.visible, legacy.activeView)
      }
    }
  }

  private legacyGroup(location: DockEdge): string | undefined {
    const active = this.layout[location].activeView
    return (active
      ? groupForView(this.docking, active)
      : undefined)?.id ?? this.panelGroup(`legacy-${location}`)?.id
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

  /** 指定侧边当前停靠的侧栏。 */
  dockedSidebar(side: DockSide): SidebarId | undefined {
    for (const location of ['left', 'right'] as const) {
      const id = this.legacyGroup(location)
      const root = this.docking.roots[side]
      if (id && root && containsNode(root, id) && this.layout[location].visible) {
        return location
      }
    }
    return undefined
  }

  /** 侧栏当前是否浮动。 */
  isFloating(location: SidebarId): boolean {
    const id = this.legacyGroup(location)
    return this.docking.floating.some(panel => id && containsNode(panel.node, id))
  }

  /** 将侧栏切换为浮动；未提供几何时使用默认位置。 */
  floatDock(location: SidebarId, geometry?: FloatingDockState): void {
    const dock = this.store.layout[location]
    this.store.floatDock(location, geometry ?? defaultFloatingDock(dock.side ?? location, dock.size))
    const id = this.legacyGroup(location)
    if (id)
      this.floatPanel(id, this.layout[location].floating!)
  }

  /** 将侧栏停靠到指定一侧；目标侧被占用时将原侧栏转为浮动。 */
  dockSidebar(location: SidebarId, side: DockSide): void {
    this.store.dockSidebar(location, side)
    const id = this.legacyGroup(location)
    if (id)
      this.dockPanel(id, side)
  }

  /** 更新浮动侧栏位置。 */
  moveFloatingDock(location: SidebarId, x: number, y: number): void {
    this.store.moveFloatingDock(location, x, y)
    const id = this.legacyGroup(location)
    const panel = this.docking.floating.find(panel => id && containsNode(panel.node, id))
    if (panel)
      this.setFloatingGeometry(panel.id, { ...panel.geometry, x, y })
  }

  /** 更新浮动侧栏尺寸。 */
  resizeFloatingDock(location: SidebarId, width: number, height: number): void {
    this.store.resizeFloatingDock(location, width, height)
    const id = this.legacyGroup(location)
    const panel = this.docking.floating.find(panel => id && containsNode(panel.node, id))
    if (panel)
      this.setFloatingGeometry(panel.id, { ...panel.geometry, width, height })
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
    if (view.location !== 'main') {
      this.reconcilePanels()
    }
    const shortcut = view.location !== 'main'
      ? ++this.panelShortcut
      : 0
    const toggle = view.location !== 'main'
      ? this.ctx.commands.register({
          id: `view.toggle.${view.id}`,
          title: `显示 / 隐藏面板：${view.title}`,
          category: '面板',
          icon: view.icon,
          keybinding: view.keybinding ?? (shortcut <= 9
            ? `Mod+Alt+${shortcut}`
            : undefined),
          checked: () => !this.docking.hidden.includes(view.id),
          menu: {
            path: ['视图', '面板'],
          },
          run: () => this.docking.hidden.includes(view.id)
            ? this.showPanel(view.id)
            : this.hidePanel(view.id),
        })
      : undefined
    return {
      dispose: () => {
        toggle?.dispose()
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
      this.showPanel(id)
    }
  }

  /** 切换停靠区。 */
  toggleDock(location: Exclude<ViewLocation, 'main'>): void {
    const visible = !this.isRegionVisible(location)
    this.store.updateDock(location, { visible })
    for (const id of this.regionPanels(location)) {
      if (visible)
        this.showPanel(id)
      else this.hidePanel(id)
    }
  }

  isRegionVisible(location: DockEdge): boolean {
    const panels = this.regionPanels(location).filter(id => this.viewMap.value.has(id))
    return panels.length
      ? panels.some(id => !this.docking.hidden.includes(id))
      : this.layout[location].visible
  }

  private regionPanels(location: DockEdge): string[] {
    const ids: string[] = []
    const collect = (node: DockNode | null): void => {
      if (!node)
        return
      if (node.type === 'group')
        ids.push(...node.views)
      else node.children.forEach(collect)
    }
    collect(this.docking.roots[location])
    this.docking.floating.filter(panel => panel.lastSide === location).forEach(panel => collect(panel.node))
    return ids
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
      this.reconcilePanels()
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
    this.reconcilePanels()
  }

  /** 布局变化通知，供 React/Vue 之外的消费者使用。 */
  notifyLayoutChanged(): void {
    this.ctx.emit('workbench/layout-changed', this.store.layout)
  }

  private registerLayoutCommands(): void {
    const commands: CommandDefinition[] = [
      {
        id: 'view.restoreHiddenPanel',
        title: '恢复最近隐藏的面板',
        category: '面板',
        icon: 'eye',
        keybinding: 'Mod+Alt+P',
        enabled: () => this.hiddenPanels.length > 0,
        menu: {
          path: ['视图', '面板'],
          order: -1,
        },
        run: () => {
          const panel = this.hiddenPanels.at(-1)
          if (panel)
            this.showPanel(panel.id)
        },
      },
      {
        id: 'view.toggleLeft',
        title: '切换左侧栏',
        category: '视图',
        icon: 'layout-sidebar-left',
        keybinding: 'Mod+B',
        checked: () => this.isRegionVisible('left'),
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
        checked: () => this.isRegionVisible('right'),
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
        checked: () => this.isRegionVisible('bottom'),
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
        id: 'view.floatLeft',
        title: '浮动左侧栏',
        description: '将左侧栏从停靠位置分离为浮动面板。',
        category: '视图',
        icon: 'multiple-windows',
        enabled: () => Boolean(this.visibleDockNode(this.docking.roots.left)),
        menu: {
          path: ['视图'],
          order: 4,
        },
        run: () => this.floatRegion('left'),
      },
      {
        id: 'view.floatRight',
        title: '浮动右侧栏',
        description: '将右侧栏从停靠位置分离为浮动面板。',
        category: '视图',
        icon: 'multiple-windows',
        enabled: () => Boolean(this.visibleDockNode(this.docking.roots.right)),
        menu: {
          path: ['视图'],
          order: 5,
        },
        run: () => this.floatRegion('right'),
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
