import type { ResolvedRuntime } from '@desktop-framework/bootstrap/node'
/**
 * 主进程共享状态服务。
 *
 * 所有 Electron 插件通过 Cordis 依赖注入读取同一个 Host 服务，避免模块级
 * 可变单例；窗口、运行时与就绪状态都集中在这里，卸载时按依赖逆序释放。
 */
import type { FrameworkRuntimeInfo, WindowState } from '@desktop-framework/core'
import type { Context } from 'cordis'
import type { BrowserWindow } from 'electron'
import type { ElectronHostOptions } from '../shared'
import { shortCommit } from '@desktop-framework/bootstrap'
import { createDeferred } from '@desktop-framework/core'
import { StartupTimer } from '@desktop-framework/vscode'
import { Service } from 'cordis'

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
    this.mainWindow.webContents.send('df:window-state', state)
  }

  /** 发送原生菜单命令。 */
  sendCommand(command: string, args?: unknown[]): void {
    const target = this.mainWindow?.isFocused()
      ? this.mainWindow
      : undefined
    target?.webContents.send('df:command', command, args)
  }
}

function relativeEntry(file: string, root: string): string {
  const normalized = file.replaceAll('\\', '/')
  const prefix = root.replaceAll('\\', '/').replace(/\/?$/, '/')
  return normalized.startsWith(prefix)
    ? normalized.slice(prefix.length)
    : normalized.split('/').pop() ?? 'index.js'
}
