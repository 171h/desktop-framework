/**
 * 工作台 Pinia store。
 *
 * 布局与工作区预设是 UI 的唯一事实来源；停靠尺寸、可见性与活动视图都直接
 * 序列化，因此用户拖拽后无需额外同步逻辑。
 */
import type { DockSide, DockState, FloatingDockState, SidebarId, ViewLocation, WorkbenchLayout, WorkspacePreset } from '@df/core'
import { clamp } from '@df/core'
import { defineStore } from 'pinia'
import { cloneDocking, restoreDocking } from './docking'

/** 持久化结构。 */
export interface PersistedWorkbench {
  layout: WorkbenchLayout
  workspaces: WorkspacePreset[]
  activeWorkspaceId: string
}

/** Store 状态。 */
export interface WorkbenchState extends PersistedWorkbench {
  hydrated: boolean
}

/** 默认布局。 */
export const DEFAULT_LAYOUT: WorkbenchLayout = {
  left: {
    visible: true,
    size: 292,
    activeView: 'explorer',
    side: 'left',
    floating: null,
  },
  right: {
    visible: true,
    size: 324,
    activeView: 'properties',
    side: 'right',
    floating: null,
  },
  bottom: { visible: false, size: 210, activeView: 'output' },
  ribbonCollapsed: false,
  statusbarVisible: true,
}

/** 内置工作区。 */
export const BUILTIN_WORKSPACES: WorkspacePreset[] = [
  {
    id: 'modeling',
    name: '建模',
    description: '资源浏览器 + 属性面板 + 完整 Ribbon，适合日常编辑。',
    builtin: true,
    layout: {
      left: { visible: true, size: 292, activeView: 'explorer' },
      right: { visible: true, size: 324, activeView: 'properties' },
      bottom: { visible: false, size: 210, activeView: 'output' },
      ribbonCollapsed: false,
      statusbarVisible: true,
    },
  },
  {
    id: 'review',
    name: '审阅',
    description: '底部输出面板展开，适合检查日志与批注。',
    builtin: true,
    layout: {
      left: { visible: true, size: 300, activeView: 'explorer' },
      right: { visible: true, size: 300, activeView: 'properties' },
      bottom: { visible: true, size: 260, activeView: 'output' },
      ribbonCollapsed: true,
      statusbarVisible: true,
    },
  },
  {
    id: 'focus',
    name: '专注',
    description: '隐藏所有侧栏并折叠 Ribbon，将空间留给主工作区。',
    builtin: true,
    layout: {
      left: { visible: false, size: 292, activeView: 'explorer' },
      right: { visible: false, size: 324, activeView: 'properties' },
      bottom: { visible: false, size: 210, activeView: 'output' },
      ribbonCollapsed: true,
      statusbarVisible: true,
    },
  },
  {
    id: 'compact',
    name: '紧凑',
    description: '仅保留资源浏览器，适合小屏幕或辅助显示器。',
    builtin: true,
    layout: {
      left: { visible: true, size: 248, activeView: 'explorer' },
      right: { visible: false, size: 324, activeView: 'properties' },
      bottom: { visible: false, size: 210, activeView: 'output' },
      ribbonCollapsed: true,
      statusbarVisible: true,
    },
  },
]

const DOCK_LIMITS: Record<Exclude<ViewLocation, 'main'>, [number, number]> = {
  left: [180, 560],
  right: [220, 560],
  bottom: [120, 520],
}

const FLOATING_LIMITS = {
  width: [240, 1000] as [number, number],
  height: [180, 1200] as [number, number],
  x: [0, 10000] as [number, number],
  y: [0, 10000] as [number, number],
}

/** 生成侧栏的默认浮动几何；实际使用时会由界面按工作台边界再次限制。 */
export function defaultFloatingDock(location: SidebarId, size = location === 'left'
  ? 292
  : 324): FloatingDockState {
  return {
    x: location === 'left'
      ? 96
      : 640,
    y: 96,
    width: clamp(size, ...FLOATING_LIMITS.width),
    height: 480,
  }
}

function cloneFloating(floating?: FloatingDockState | null): FloatingDockState | null {
  return floating
    ? { ...floating }
    : null
}

function cloneLayout(layout: WorkbenchLayout): WorkbenchLayout {
  return {
    docking: layout.docking
      ? cloneDocking(layout.docking)
      : restoreDocking(undefined, layout),
    left: {
      ...layout.left,
      side: layout.left.side ?? 'left',
      floating: cloneFloating(layout.left.floating),
    },
    right: {
      ...layout.right,
      side: layout.right.side ?? 'right',
      floating: cloneFloating(layout.right.floating),
    },
    bottom: {
      ...layout.bottom,
      side: undefined,
      floating: null,
    },
    ribbonCollapsed: layout.ribbonCollapsed,
    statusbarVisible: layout.statusbarVisible,
  }
}

function cloneWorkspaces(workspaces: WorkspacePreset[]): WorkspacePreset[] {
  return workspaces.map(workspace => ({
    ...workspace,
    layout: cloneLayout(workspace.layout),
  }))
}

/** 工作台 store。 */
export const useWorkbenchStore = defineStore('desktop-framework:workbench', {
  state: (): WorkbenchState => ({
    layout: cloneLayout(DEFAULT_LAYOUT),
    workspaces: cloneWorkspaces(BUILTIN_WORKSPACES),
    activeWorkspaceId: 'modeling',
    hydrated: false,
  }),
  getters: {
    activeWorkspace: state =>
      state.workspaces.find(workspace => workspace.id === state.activeWorkspaceId)
      ?? state.workspaces[0],
  },
  actions: {
    /** 从持久化数据恢复；不可信数据会被限制到合法范围。 */
    hydrate(data?: Partial<PersistedWorkbench> | null): void {
      if (!data || !data.layout) {
        this.hydrated = true
        return
      }
      this.layout = sanitizeLayout(data.layout)
      const custom = (Array.isArray(data.workspaces)
        ? data.workspaces
        : []).filter(workspace => workspace && !workspace.builtin && workspace.layout && typeof workspace.layout === 'object')
      this.workspaces = [
        ...cloneWorkspaces(BUILTIN_WORKSPACES),
        ...custom.map(workspace => ({
          ...workspace,
          layout: sanitizeLayout(workspace.layout),
          id: workspace.id || `custom-${Date.now()}`,
          builtin: false,
        })),
      ]
      this.activeWorkspaceId = this.workspaces.some(workspace => workspace.id === data.activeWorkspaceId)
        ? data.activeWorkspaceId!
        : 'modeling'
      this.hydrated = true
    },

    /** 应用工作区。 */
    applyWorkspace(id: string): WorkspacePreset | undefined {
      const workspace = this.workspaces.find(item => item.id === id)
      if (!workspace) {
        return undefined
      }
      this.layout = cloneLayout(workspace.layout)
      this.activeWorkspaceId = workspace.id
      return workspace
    },

    /** 更新某个停靠面板。 */
    updateDock(location: Exclude<ViewLocation, 'main'>, patch: Partial<DockState>): void {
      const current = this.layout[location]
      const [min, max] = DOCK_LIMITS[location]
      this.layout[location] = {
        ...current,
        ...patch,
        size: clamp(patch.size ?? current.size, min, max),
      }
    },

    /** 设置活动视图。 */
    setActiveView(location: Exclude<ViewLocation, 'main'>, viewId: string): void {
      this.updateDock(location, { activeView: viewId, visible: true })
    },

    /** 切换停靠面板。 */
    toggleDock(location: Exclude<ViewLocation, 'main'>): void {
      const dock = this.layout[location]
      this.layout[location] = { ...dock, visible: !dock.visible }
    },

    /** 将侧栏切换为浮动状态。 */
    floatDock(location: SidebarId, floating: FloatingDockState): void {
      const dock = this.layout[location]
      this.layout[location] = {
        ...dock,
        visible: true,
        floating: sanitizeFloating(floating),
      }
    },

    /** 将侧栏停靠到左侧或右侧，允许同侧组合。 */
    dockSidebar(location: SidebarId, side: DockSide): void {
      const dock = this.layout[location]
      const [min, max] = DOCK_LIMITS[location]
      this.layout[location] = {
        ...dock,
        visible: true,
        size: clamp(dock.floating?.width ?? dock.size, min, max),
        side,
        floating: null,
      }
    },

    /** 更新浮动侧栏位置。 */
    moveFloatingDock(location: SidebarId, x: number, y: number): void {
      const dock = this.layout[location]
      if (!dock.floating) {
        return
      }
      this.layout[location] = {
        ...dock,
        floating: {
          ...dock.floating,
          x: clamp(Number(x) || 0, ...FLOATING_LIMITS.x),
          y: clamp(Number(y) || 0, ...FLOATING_LIMITS.y),
        },
      }
    },

    /** 更新浮动侧栏尺寸。 */
    resizeFloatingDock(location: SidebarId, width: number, height: number): void {
      const dock = this.layout[location]
      if (!dock.floating) {
        return
      }
      this.layout[location] = {
        ...dock,
        floating: {
          ...dock.floating,
          width: clamp(Number(width) || FLOATING_LIMITS.width[0], ...FLOATING_LIMITS.width),
          height: clamp(Number(height) || FLOATING_LIMITS.height[0], ...FLOATING_LIMITS.height),
        },
      }
    },

    /** 设置 Ribbon 折叠状态。 */
    setRibbonCollapsed(collapsed: boolean): void {
      this.layout.ribbonCollapsed = collapsed
    },

    /** 保存当前布局为工作区。 */
    saveWorkspace(name: string): WorkspacePreset {
      const trimmed = name.trim() || '未命名工作区'
      const id = `custom-${Date.now().toString(36)}`
      const workspace: WorkspacePreset = {
        id,
        name: trimmed,
        description: '用户保存的布局',
        builtin: false,
        layout: cloneLayout(this.layout),
      }
      this.workspaces = [...this.workspaces, workspace]
      this.activeWorkspaceId = id
      return workspace
    },

    /** 删除自定义工作区。 */
    deleteWorkspace(id: string): boolean {
      const workspace = this.workspaces.find(item => item.id === id)
      if (!workspace || workspace.builtin) {
        return false
      }
      this.workspaces = this.workspaces.filter(item => item.id !== id)
      if (this.activeWorkspaceId === id) {
        this.applyWorkspace('modeling')
      }
      return true
    },

    /** 导出持久化快照。 */
    snapshot(): PersistedWorkbench {
      return {
        layout: cloneLayout(this.layout),
        workspaces: cloneWorkspaces(this.workspaces),
        activeWorkspaceId: this.activeWorkspaceId,
      }
    },
  },
})

function sanitizeLayout(layout: WorkbenchLayout): WorkbenchLayout {
  const left = sanitizeDock(layout.left, 'left', DEFAULT_LAYOUT.left)
  const right = sanitizeDock(layout.right, 'right', DEFAULT_LAYOUT.right)
  const bottom = sanitizeDock(layout.bottom, 'bottom', DEFAULT_LAYOUT.bottom)
  return {
    docking: restoreDocking(layout.docking, { ...layout, left, right, bottom }),
    left,
    right,
    bottom,
    ribbonCollapsed: Boolean(layout.ribbonCollapsed),
    statusbarVisible: layout.statusbarVisible !== false,
  }
}

function sanitizeDock(value: DockState | undefined, location: Exclude<ViewLocation, 'main'>, fallback: DockState): DockState {
  const [min, max] = DOCK_LIMITS[location]
  const isSidebar = location === 'left' || location === 'right'
  return {
    visible: value?.visible ?? fallback.visible,
    size: clamp(Number(value?.size) || fallback.size, min, max),
    activeView: typeof value?.activeView === 'string'
      ? value.activeView
      : fallback.activeView,
    side: isSidebar
      ? (value?.side === 'right'
          ? 'right'
          : value?.side === 'left'
            ? 'left'
            : location)
      : undefined,
    floating: isSidebar && value?.floating
      ? sanitizeFloating(value.floating)
      : null,
  }
}

function sanitizeFloating(value: FloatingDockState): FloatingDockState {
  return {
    x: clamp(Number(value.x) || 0, ...FLOATING_LIMITS.x),
    y: clamp(Number(value.y) || 0, ...FLOATING_LIMITS.y),
    width: clamp(Number(value.width) || FLOATING_LIMITS.width[0], ...FLOATING_LIMITS.width),
    height: clamp(Number(value.height) || FLOATING_LIMITS.height[0], ...FLOATING_LIMITS.height),
  }
}
