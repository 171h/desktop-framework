/**
 * 工作台 Pinia store。
 *
 * 布局与工作区预设是 UI 的唯一事实来源；停靠尺寸、可见性与活动视图都直接
 * 序列化，因此用户拖拽后无需额外同步逻辑。
 */
import type { DockState, ViewLocation, WorkbenchLayout, WorkspacePreset } from '@desktop-framework/core'
import { clamp } from '@desktop-framework/core'
import { defineStore } from 'pinia'

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
  left: { visible: true, size: 292, activeView: 'explorer' },
  right: { visible: true, size: 324, activeView: 'properties' },
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

function cloneLayout(layout: WorkbenchLayout): WorkbenchLayout {
  return {
    left: { ...layout.left },
    right: { ...layout.right },
    bottom: { ...layout.bottom },
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
      const custom = (data.workspaces ?? []).filter(workspace => !workspace.builtin && workspace.layout)
      this.workspaces = [
        ...cloneWorkspaces(BUILTIN_WORKSPACES),
        ...cloneWorkspaces(custom).map(workspace => ({
          ...workspace,
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
  return {
    left: sanitizeDock(layout.left, 'left', DEFAULT_LAYOUT.left),
    right: sanitizeDock(layout.right, 'right', DEFAULT_LAYOUT.right),
    bottom: sanitizeDock(layout.bottom, 'bottom', DEFAULT_LAYOUT.bottom),
    ribbonCollapsed: Boolean(layout.ribbonCollapsed),
    statusbarVisible: layout.statusbarVisible !== false,
  }
}

function sanitizeDock(value: DockState | undefined, location: Exclude<ViewLocation, 'main'>, fallback: DockState): DockState {
  const [min, max] = DOCK_LIMITS[location]
  return {
    visible: value?.visible ?? fallback.visible,
    size: clamp(Number(value?.size) || fallback.size, min, max),
    activeView: typeof value?.activeView === 'string'
      ? value.activeView
      : fallback.activeView,
  }
}
