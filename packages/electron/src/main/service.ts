import type { ResolvedRuntime } from '@df/bootstrap/node'
/**
 * 主进程共享状态服务。
 *
 * 所有 Electron 插件通过 Cordis 依赖注入读取同一个 Host 服务，避免模块级
 * 可变单例；窗口、运行时与就绪状态都集中在这里，卸载时按依赖逆序释放。
 */
import type { FrameworkRuntimeInfo, WindowContext, WindowMessage, WindowState } from '@df/core'
import type { Context } from 'cordis'
import type { BrowserWindow } from 'electron'
import type { ElectronHostOptions } from '../shared'
import { shortCommit } from '@df/bootstrap'
import { createDeferred } from '@df/core'
import { StartupTimer } from '@df/vscode'
import { Service } from 'cordis'
import { BrowserWindow as ElectronBrowserWindow } from 'electron'

declare module 'cordis' {
  interface Context {
    electronHost: ElectronHostService
  }
}

export class ElectronHostService extends Service {
  readonly options: ElectronHostOptions
  readonly startup = new StartupTimer('main')
  readonly ready = createDeferred<void>()
  readonly runtimeResolved = createDeferred<void>()
  mainWindow?: BrowserWindow
  runtime?: ResolvedRuntime
  runtimeInfo?: FrameworkRuntimeInfo
  /** 由窗口插件注入：创建编辑器或面板独立窗口。 */
  createDetachedWindow?: (request: unknown) => Promise<boolean>
  private readonly windows = new Map<number, BrowserWindow>()
  private readonly contexts = new Map<number, WindowContext>()

  constructor(ctx: Context, options: ElectronHostOptions) {
    super(ctx, 'electronHost')
    this.options = options
    this.startup.mark('host-service')
  }

  /** 等待 Electron app ready。 */
  whenReady(): Promise<void> {
    return this.ready.promise
  }

  /** 等待运行时解析完成（成功或回退）。 */
  whenRuntimeResolved(): Promise<void> {
    return this.runtimeResolved.promise
  }

  markReady(): void {
    this.ready.resolve()
    this.startup.mark('app-ready')
  }

  /** 应用运行时解析结果。 */
  setRuntime(runtime: ResolvedRuntime | undefined): void {
    this.runtime = runtime
    if (!runtime) {
      this.runtimeInfo = undefined
    }
    else if (runtime.mode === 'remote' && runtime.directory && runtime.entryFile) {
      const host = shortCommit(runtime.commit)
      const entry = relativeEntry(runtime.entryFile, runtime.directory)
      const style = runtime.styleFile
        ? relativeEntry(runtime.styleFile, runtime.directory)
        : undefined
      this.runtimeInfo = {
        mode: 'remote',
        repository: runtime.repository,
        commit: runtime.commit,
        directory: runtime.directory,
        entryUrl: `df-runtime://${host}/${entry}`,
        styleUrl: style
          ? `df-runtime://${host}/${style}`
          : undefined,
        cached: runtime.cached,
        integrity: runtime.integrity,
      }
    }
    else {
      this.runtimeInfo = {
        mode: 'workspace',
        repository: runtime.repository,
        commit: runtime.commit,
        directory: runtime.directory ?? '',
        entryUrl: '',
        cached: true,
      }
    }
    this.runtimeResolved.resolve()
    this.startup.mark('runtime-resolved')
  }

  /** 发送窗口状态。 */
  broadcastWindowState(state: WindowState): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed() || this.mainWindow.webContents.isDestroyed()) {
      return
    }
    if (!this.mainWindow.webContents.getURL()) {
      return
    }
    this.mainWindow.webContents.send('df:window-state', state)
  }

  /** 发送原生菜单命令。 */
  sendCommand(command: string, args?: unknown[]): void {
    const focused = ElectronBrowserWindow.getFocusedWindow()
    const target = focused && this.windows.has(focused.webContents.id)
      ? focused
      : this.mainWindow
    target?.webContents.send('df:command', command, args)
  }

  /** 登记框架创建的窗口。 */
  registerWindow(window: BrowserWindow, context?: WindowContext): void {
    this.windows.set(window.webContents.id, window)
    if (context) {
      this.contexts.set(window.webContents.id, context)
    }
    window.once('closed', () => {
      this.windows.delete(window.webContents.id)
      this.contexts.delete(window.webContents.id)
    })
  }

  /** 窗口是否是本框架创建并受信任的。 */
  isTrustedWindow(window: Electron.WebContents): boolean {
    return this.windows.has(window.id)
  }

  /** 读取窗口的启动上下文。 */
  contextFor(window: Electron.WebContents): WindowContext | null {
    return this.contexts.get(window.id) ?? null
  }

  /** 向除了发送方之外的所有框架窗口广播消息。 */
  broadcastWindowMessage(source: Electron.WebContents, topic: string, payload: unknown): void {
    if (!topic || typeof topic !== 'string') {
      return
    }
    const message: WindowMessage = {
      source: source.id,
      topic,
      payload,
    }
    for (const [id, window] of this.windows) {
      if (id === source.id || window.isDestroyed() || window.webContents.isDestroyed()) {
        continue
      }
      window.webContents.send('df:window-message', message)
    }
  }

  /** 关闭并移除所有辅助窗口。 */
  closeDetachedWindows(): void {
    for (const window of this.windows.values()) {
      if (window !== this.mainWindow && !window.isDestroyed()) {
        window.destroy()
      }
    }
  }
}

function relativeEntry(file: string, root: string): string {
  const normalized = file.replaceAll('\\', '/')
  const prefix = root.replaceAll('\\', '/').replace(/\/?$/, '/')
  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized.split('/').pop() ?? 'index.js'
}
