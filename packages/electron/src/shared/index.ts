/** Electron 主进程 / preload / 渲染进程共享的通道和配置类型。 */
import type { PluginEntry, WindowState } from '@desktop-framework/core'
import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from 'electron'

/** IPC 通道。 */
export const CHANNELS = {
  openFiles: 'df:open-files',
  saveFile: 'df:save-file',
  windowControl: 'df:window-control',
  windowState: 'df:window-state',
  titleBarOverlay: 'df:titlebar-overlay',
  versions: 'df:versions',
  openExternal: 'df:open-external',
  runtime: 'df:runtime',
  command: 'df:command',
} as const

export interface RendererOptions {
  /** 开发服务器地址。 */
  devUrl?: string
  /** 生产环境 HTML 绝对路径。 */
  file: string
  /** 窗口标题。 */
  title?: string
  /** 背景色，减少首屏白闪。 */
  backgroundColor?: string
}

export interface RuntimeHostOptions {
  /** `desktop-framework.config.json` 路径。 */
  configPath?: string
  /** 运行时缓存目录；默认 userData/framework。 */
  cacheDirectory?: string
  /** 离线模式。 */
  offline?: boolean
  /** 额外请求头。 */
  headers?: Record<string, string>
}

export interface ElectronHostOptions {
  /** 应用 id。 */
  appId?: string
  /** 产品名。 */
  productName?: string
  /** 版本。 */
  version?: string
  /** 渲染进程配置。 */
  renderer: RendererOptions
  /** 窗口参数覆盖。 */
  window?: Partial<BrowserWindowConstructorOptions> & {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
  }
  /** 运行时拉取配置。 */
  runtime?: RuntimeHostOptions
  /** 原生菜单；传 false 关闭。 */
  menu?: MenuItemConstructorOptions[] | false
  /** 主进程 Cordis 插件。 */
  plugins?: PluginEntry[]
  /** 主进程初始化钩子。 */
  setup?: (ctx: import('cordis').Context) => void | Promise<void>
  /** 单实例锁。 */
  singleInstance?: boolean
  /** 崩溃上报地址。 */
  crashReportUrl?: string
  /** 外部协议白名单。 */
  externalProtocols?: string[]
}

export interface ElectronHost {
  ctx: import('cordis').Context
  window?: import('electron').BrowserWindow
  runtime?: import('@desktop-framework/core').FrameworkRuntimeInfo
  dispose: () => Promise<void>
}

/** 窗口状态快照。 */
export type { WindowState }
