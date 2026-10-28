/**
 * @df/core · 公共契约
 *
 * 本包只包含类型、常量与不依赖 DOM 的小工具，任何插件都可以安全依赖。
 */
import type { Context, Plugin } from 'cordis'

export * from './types'
export * from './utils'

declare module 'cordis' {
  interface Events {
    /** 框架全部内置插件加载完成。 */
    'framework/ready': () => void
    /** 内核开始释放资源。 */
    'framework/disposing': () => void
    /** 插件加载成功。 */
    'kernel/plugin-loaded': (info: KernelPluginInfo) => void
    /** 插件加载失败。 */
    'kernel/plugin-failed': (info: KernelPluginInfo) => void
    /** 插件已卸载。 */
    'kernel/plugin-unloaded': (id: string) => void
    /** 命令注册。 */
    'command/registered': (command: CommandDefinition) => void
    /** 命令注销。 */
    'command/unregistered': (id: string) => void
    /** 命令执行成功。 */
    'command/executed': (id: string, result: unknown) => void
    /** 命令执行失败。 */
    'command/failed': (id: string, error: unknown) => void
    /** 工作区布局变化。 */
    'workbench/layout-changed': (layout: WorkbenchLayout) => void
    /** 工作区预设切换。 */
    'workbench/workspace-applied': (workspace: WorkspacePreset) => void
    /** 视图注册。 */
    'view/registered': (view: ViewDefinition) => void
    /** 主题变化。 */
    'ui/theme-changed': (theme: ThemeId) => void
    /** 通知新增。 */
    'notification/added': (id: number) => void
    /** 打开编辑器标签页。 */
    'editor/opened': (id: string) => void
    /** 关闭编辑器标签页。 */
    'editor/closed': (id: string) => void
    /** 活动标签页变化。 */
    'editor/active-changed': (id: string | undefined) => void
    /** 标签页顺序、固定或脏状态变化。 */
    'editor/changed': () => void
    /** Electron 窗口最大化状态变化。 */
    'electron/window-state': (state: WindowState) => void
  }

  interface Context {
    /** 内核服务由 `@df/kernel` 提供。 */
    kernel: import('./types').KernelServiceContract
  }
}

/** 可释放资源。 */
export interface IDisposable {
  dispose: () => void
}

/** 插件工厂接收的上下文。 */
export type FrameworkPlugin = Plugin

/** 插件模块的默认导出可以是任意 Cordis 插件。 */
export interface FrameworkPluginModule {
  /** 插件清单。 */
  manifest: FrameworkPluginManifest
  /** 插件主体。 */
  default: FrameworkPlugin
}

/** 插件清单。 */
export interface FrameworkPluginManifest {
  /** 全局唯一 id，建议使用 `vendor:name`。 */
  id: string
  /** 显示名。 */
  name: string
  /** 版本。 */
  version?: string
  /** 描述。 */
  description?: string
  /** 作者。 */
  author?: string
  /** 仓库地址。 */
  repository?: string
  /** 构建插件时对应的 commit。 */
  commit?: string
  /** 依赖的其他插件 id。 */
  requires?: string[]
  /** 是否为可选插件。 */
  optional?: boolean
}

/** 插件来源。 */
export type PluginSource = 'builtin' | 'workspace' | 'remote' | 'test'

/** 插件加载状态。 */
export type KernelPluginStatus = 'loaded' | 'failed' | 'unloaded' | 'pending'

/** 内核诊断信息。 */
export interface KernelPluginInfo {
  /** 插件 id。 */
  id: string
  /** 显示名。 */
  name: string
  /** 来源。 */
  source: PluginSource
  /** 状态。 */
  status: KernelPluginStatus
  /** 版本。 */
  version?: string
  /** 加载耗时（毫秒）。 */
  durationMs?: number
  /** 失败原因。 */
  error?: string
  /** commit。 */
  commit?: string
}

/** 插件条目。 */
export interface PluginEntry {
  /** 插件清单；缺省时从插件 name 推导。 */
  manifest?: Partial<FrameworkPluginManifest>
  /** Cordis 插件。 */
  plugin: FrameworkPlugin
  /** 配置。 */
  config?: unknown
  /** 来源。 */
  source?: PluginSource
}

/** 内核契约。 */
export interface KernelServiceContract {
  readonly version: string
  readonly environment: FrameworkEnvironment
  readonly plugins: readonly KernelPluginInfo[]
  load: (entries: PluginEntry[]) => Promise<readonly KernelPluginInfo[]>
  loadOne: (entry: PluginEntry) => Promise<KernelPluginInfo>
  unload: (id: string) => Promise<void>
  reload: (id: string) => Promise<KernelPluginInfo | undefined>
  info: (id: string) => KernelPluginInfo | undefined
  dispose: () => Promise<void>
}

/** 运行环境。 */
export type FrameworkEnvironment = 'browser' | 'electron-renderer' | 'electron-main' | 'node' | 'test'

/** 主题 id。 */
export type ThemeId = 'graphite' | 'porcelain' | 'system'

/** 主题描述。 */
export interface ThemeDefinition {
  id: ThemeId
  label: string
  description?: string
  /**
   * 用于 `data-theme` 的值；`system` 由宿主根据 `prefers-color-scheme` 解析。
   */
  resolved: 'dark' | 'light'
}

/** 命令执行函数。 */
export type CommandHandler = (ctx: Context, ...args: unknown[]) => unknown

/** Ribbon 放置声明。 */
export interface RibbonPlacement {
  /** 页签 id。 */
  tab: string
  /** 页签标题，首次创建时使用。 */
  tabTitle?: string
  /** 页签排序。 */
  tabOrder?: number
  /** 功能组标题。 */
  group: string
  /** 功能组排序。 */
  groupOrder?: number
  /** 条目排序。 */
  order?: number
  /** 按钮尺寸。 */
  size?: 'full' | 'half' | 'third'
  /** 紧凑样式。 */
  style?: 'icon' | 'iconAndLabel'
  /** 按钮类型。 */
  type?: 'button' | 'dropdown' | 'splitButton'
}

/** 应用菜单放置声明。 */
export interface MenuPlacement {
  /** 路径，例如 `['File']` 或 `['Workspace', 'Layout']`。 */
  path: string[]
  /** 排序。 */
  order?: number
}

/** 快速访问工具栏放置。 */
export interface ToolbarPlacement {
  /** 排序。 */
  order?: number
  /** 分组名。 */
  group?: string
}

/** 命令定义。 */
export interface CommandDefinition {
  /** 全局唯一 id。 */
  id: string
  /** 标题。 */
  title: string
  /** 分类/页签标题。 */
  category?: string
  /** 描述。 */
  description?: string
  /** Codicon 名称。 */
  icon?: string
  /** 快捷键，例如 `Mod+Shift+P`。 */
  keybinding?: string
  /** 动态启用状态；每次界面刷新时求值。 */
  enabled?: () => boolean
  /** 动态勾选状态；用于切换按钮。 */
  checked?: () => boolean
  /** 是否隐藏；隐藏命令仍可通过 API 执行。 */
  hidden?: () => boolean
  /** Ribbon 放置。 */
  ribbon?: RibbonPlacement | RibbonPlacement[]
  /** 应用菜单放置。 */
  menu?: MenuPlacement | MenuPlacement[]
  /** 快速访问工具栏放置。 */
  toolbar?: boolean | ToolbarPlacement
  /** 执行函数。 */
  run: CommandHandler
}

/** Ribbon 标签栏位置。 */
export type RibbonTabPlacement = 'titlebar' | 'separate'

/** Ribbon 页签定义。 */
export interface RibbonTabDefinition {
  id: string
  title: string
  order?: number
  description?: string
}

/** 视图位置。 */
export type ViewLocation = 'left' | 'right' | 'bottom' | 'main'

/** 视图定义。 */
export interface ViewDefinition {
  /** 全局唯一 id。 */
  id: string
  /** 标题。 */
  title: string
  /** Codicon 名称。 */
  icon?: string
  /** 停靠位置。 */
  location: ViewLocation
  /** 排序。 */
  order?: number
  /** 是否默认打开。 */
  default?: boolean
  /** 是否可关闭。 */
  closable?: boolean
  /** 插件 id。 */
  pluginId?: string
  /** Vue 组件；由宿主 UI 渲染，非 Vue 消费者可以忽略。 */
  component?: object
  /** 显示 / 隐藏面板的快捷键；未指定时前九个面板使用 Mod+Alt+1…9。 */
  keybinding?: string
}

/** 侧边栏 id。 */
export type SidebarId = 'left' | 'right'

/** 侧边栏停靠侧。 */
export type DockSide = 'left' | 'right'

/** 浮动侧边栏的位置与尺寸，坐标相对于工作台内容区。 */
export interface FloatingDockState {
  x: number
  y: number
  width: number
  height: number
}

export type DockEdge = 'left' | 'right' | 'bottom'
export type DockPlacement = 'left' | 'right' | 'top' | 'bottom' | 'center'
export interface DockGroupNode {
  type: 'group'
  id: string
  views: string[]
  activeView?: string
}
export interface DockSplitNode {
  type: 'split'
  id: string
  orientation: 'horizontal' | 'vertical'
  ratio: number
  children: [DockNode, DockNode]
}
export type DockNode = DockGroupNode | DockSplitNode
export interface FloatingPanel {
  id: string
  node: DockNode
  geometry: FloatingDockState
  lastSide: DockEdge
}
export interface DockingLayout {
  version: 2
  roots: Record<DockEdge, DockNode | null>
  floating: FloatingPanel[]
  hidden: string[]
}

/** 停靠面板状态。 */
export interface DockState {
  visible: boolean
  /** 像素尺寸；左右为宽度，底部为高度。 */
  size: number
  /** 当前视图 id。 */
  activeView?: string
  /** 左右侧栏的停靠侧；两个侧栏可互换左右位置。 */
  side?: DockSide
  /** 浮动几何；为空表示已停靠。 */
  floating?: FloatingDockState | null
}

/** 工作台布局。 */
export interface WorkbenchLayout {
  /** 可组合面板布局；省略时自动从旧版左右 / 底部侧栏迁移。 */
  docking?: DockingLayout
  left: DockState
  right: DockState
  bottom: DockState
  ribbonCollapsed: boolean
  statusbarVisible: boolean
}

/** 工作区预设。 */
export interface WorkspacePreset {
  id: string
  name: string
  description?: string
  builtin?: boolean
  layout: WorkbenchLayout
}

/** 状态栏项。 */
export interface StatusBarItem {
  id: string
  /** 左侧或右侧。 */
  alignment: 'left' | 'right'
  /** 文本。 */
  text: string
  /** Codicon 名称。 */
  icon?: string
  /** 提示。 */
  tooltip?: string
  /** 点击执行的命令。 */
  command?: string
  /** 排序。 */
  order?: number
  /** 动态文本。 */
  getText?: () => string
}

/** 通知级别。 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/** 通知。 */
export interface FrameworkNotification {
  id: number
  message: string
  level: NotificationLevel
  /** 自动关闭毫秒数；0 表示不自动关闭。 */
  timeout?: number
}

/** Electron 窗口状态。 */
export interface WindowState {
  maximized: boolean
  fullscreen: boolean
  focused: boolean
}

/** 独立窗口类型。 */
export type DetachedWindowKind = 'editor' | 'panel'

/** 创建独立窗口的请求。 */
export interface DetachedWindowRequest {
  kind: DetachedWindowKind
  /** 窗口标题；实际标题仍由渲染进程决定。 */
  title?: string
  /** 可结构化克隆的窗口恢复数据。 */
  payload: unknown
  /** 屏幕坐标；缺省时由主进程选择位置。 */
  bounds?: {
    x?: number
    y?: number
    width?: number
    height?: number
  }
}

/** 独立窗口启动上下文。 */
export interface WindowContext {
  kind: DetachedWindowKind
  payload: unknown
}

/** 跨窗口消息；source 为主进程分配的发送方 webContents id。 */
export interface WindowMessage {
  source: number
  topic: string
  payload: unknown
}

/** 拖出到独立面板窗口时传递的停靠节点。 */
export interface DetachedPanelPayload {
  title: string
  node: DockNode
  width: number
  height: number
}

/** 文件选择过滤器。 */
export interface FileDialogFilter {
  name: string
  extensions: string[]
}

/** 通过宿主打开的文件。 */
export interface OpenedFile {
  name: string
  path: string
  size: number
  data: Uint8Array
}

/** 保存文件请求。 */
export interface SaveFileRequest {
  title?: string
  defaultPath?: string
  filters?: FileDialogFilter[]
  data: Uint8Array
}

/** 窗口控制动作。 */
export type WindowControlAction = 'minimize' | 'maximize' | 'unmaximize' | 'toggleMaximize' | 'close'

/** 受控开发者操作，不允许传入任意脚本或 IPC 通道。 */
export type DeveloperAction = 'toggleDevTools' | 'reload' | 'reloadIgnoringCache'

export interface DeveloperDiagnostics {
  startup: { name: string, at: number, delta: number }[]
  processes: { pid: number, type: string, cpuPercent: number, memoryMB: number }[]
}

/** 原生标题栏覆盖层样式。 */
export interface TitleBarOverlayOptions {
  /** 覆盖层背景色，支持十六进制、rgb(a)、hsl(a)。 */
  color: string
  /** 原生控制按钮符号颜色；Windows 支持。 */
  symbolColor: string
  /** 覆盖层高度（CSS px）。 */
  height?: number
}

/** 框架运行时信息。 */
export interface FrameworkRuntimeInfo {
  mode: RuntimeMode
  repository: string
  commit: string
  directory: string
  entryUrl: string
  styleUrl?: string
  cached: boolean
  integrity?: string
}

/**
 * preload 暴露给渲染进程的最小桌面桥。
 *
 * 浏览器环境没有该对象，`@df/platform` 会提供等价降级。
 */
export interface DesktopBridge {
  /** 可选以兼容旧宿主；新运行时应先检查能力再使用。 */
  developerAction?: (action: DeveloperAction) => Promise<void>
  getDeveloperDiagnostics?: () => Promise<DeveloperDiagnostics>
  readonly platform: string
  readonly versions: {
    electron?: string
    chrome?: string
    node?: string
    app: string
  }
  openFiles: (options?: { title?: string, filters?: FileDialogFilter[], multiple?: boolean }) => Promise<OpenedFile[]>
  saveFile: (request: SaveFileRequest) => Promise<string | null>
  windowControl: (action: WindowControlAction) => Promise<WindowState>
  getWindowState: () => Promise<WindowState>
  setTitleBarOverlay: (options: TitleBarOverlayOptions) => Promise<void>
  onWindowState: (listener: (state: WindowState) => void) => () => void
  onCommand: (listener: (command: string, args?: unknown[]) => void) => () => void
  openExternal: (url: string) => Promise<void>
  getRuntime: () => Promise<FrameworkRuntimeInfo | null>
  /** 创建编辑器或面板独立窗口；浏览器宿主返回 false。 */
  openDetachedWindow?: (request: DetachedWindowRequest) => Promise<boolean>
  /** 读取当前窗口的启动上下文；主窗口返回 null。 */
  getWindowContext?: () => Promise<WindowContext | null>
  /** 向其他框架窗口广播消息。 */
  sendWindowMessage?: (topic: string, payload: unknown) => void
  /** 订阅其他框架窗口的消息。 */
  onWindowMessage?: (listener: (message: WindowMessage) => void) => () => void
}

/** 框架运行时模式。 */
export type RuntimeMode = 'workspace' | 'remote'

/** 框架运行时解析结果。 */
export interface ResolvedFrameworkRuntime {
  mode: RuntimeMode
  repository: string
  commit: string
  /** 缓存目录或本地目录。 */
  directory: string
  /** 可被渲染进程加载的入口 URL。 */
  entryUrl: string
  /** 是否命中缓存。 */
  cached: boolean
  /** 校验结果。 */
  integrity?: string
}
