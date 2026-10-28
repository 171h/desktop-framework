/**
 * @df/platform · 宿主能力适配
 *
 * Electron 渲染进程通过 preload 暴露的 `window.desktopFramework` 访问原生
 * 能力；浏览器使用 File System Access / input[type=file] 与下载链接降级。
 * 业务插件只依赖本服务，不直接接触 Electron API。
 */
import type {
  DesktopBridge,
  DeveloperAction,
  DeveloperDiagnostics,
  FileDialogFilter,
  FrameworkRuntimeInfo,
  IDisposable,
  OpenedFile,
  SaveFileRequest,
  TitleBarOverlayOptions,
  WindowControlAction,
  WindowState,
} from '@df/core'
import type { Context } from 'cordis'
import { errorMessage } from '@df/core'
import { Service } from 'cordis'

declare module 'cordis' {
  interface Context {
    platform: PlatformService
  }
}

declare global {
  interface Window {
    desktopFramework?: DesktopBridge
  }
}

/** 平台服务。 */
export class PlatformService extends Service {
  readonly bridge?: DesktopBridge
  readonly isElectron: boolean
  readonly platform: string
  private runtime?: FrameworkRuntimeInfo | null

  constructor(ctx: Context) {
    super(ctx, 'platform')
    this.bridge = typeof window !== 'undefined'
      ? window.desktopFramework
      : undefined
    this.isElectron = Boolean(this.bridge)
    this.platform = this.bridge?.platform ?? detectBrowserPlatform()
  }

  /** 打开一个或多个文件。 */
  async openFiles(options: {
    title?: string
    filters?: FileDialogFilter[]
    multiple?: boolean
  } = {}): Promise<OpenedFile[]> {
    if (this.bridge) {
      return this.bridge.openFiles(options)
    }
    return openBrowserFiles(options)
  }

  /** 保存字节数据；返回保存路径或文件名，取消返回 null。 */
  async saveFile(request: SaveFileRequest): Promise<string | null> {
    if (this.bridge) {
      return this.bridge.saveFile(request)
    }
    const blob = new Blob([
      toArrayBuffer(request.data),
    ])
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = request.defaultPath ?? 'download.bin'
    anchor.click()
    URL.revokeObjectURL(url)
    return anchor.download
  }

  /** 读取原始运行时信息（只调用一次）。 */
  async getRuntime(): Promise<FrameworkRuntimeInfo | null> {
    if (this.runtime !== undefined) {
      return this.runtime
    }
    if (this.bridge) {
      try {
        this.runtime = await this.bridge.getRuntime()
      }
      catch (error) {
        this.ctx.logger.warn(`[platform] 读取运行时信息失败：${errorMessage(error)}`)
        this.runtime = null
      }
    }
    else {
      this.runtime = null
    }
    return this.runtime
  }

  /** 窗口控制。 */
  async windowControl(action: WindowControlAction): Promise<WindowState | undefined> {
    return this.bridge?.windowControl(action)
  }

  /** 读取当前窗口状态。 */
  async getWindowState(): Promise<WindowState | undefined> {
    return this.bridge?.getWindowState()
  }

  /** 同步原生标题栏覆盖层颜色；浏览器环境为空操作。 */
  async setTitleBarOverlay(options: TitleBarOverlayOptions): Promise<void> {
    await this.bridge?.setTitleBarOverlay(options)
  }

  /** 订阅原生菜单命令。 */
  onCommand(listener: (command: string, args?: unknown[]) => void): IDisposable {
    const dispose = this.bridge?.onCommand(listener)
    return {
      dispose: () => dispose?.(),
    }
  }

  /** 订阅窗口状态。 */
  onWindowState(listener: (state: WindowState) => void): IDisposable {
    const dispose = this.bridge?.onWindowState(listener)
    return {
      dispose: () => dispose?.(),
    }
  }

  /** 在系统浏览器中打开链接。 */
  async openExternal(url: string): Promise<void> {
    if (this.bridge) {
      await this.bridge.openExternal(url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  /** 当前宿主是否暴露受控开发者操作。 */
  get supportsDeveloperTools(): boolean {
    return typeof this.bridge?.developerAction === 'function'
  }

  async developerAction(action: DeveloperAction): Promise<void> {
    if (this.bridge?.developerAction) {
      await this.bridge.developerAction(action)
    }
    else if (!this.bridge && action === 'reload') {
      window.location.reload()
    }
    else {
      throw new Error('当前宿主不支持此开发者操作，请使用浏览器自带的开发者工具或升级桌面宿主')
    }
  }

  async getDeveloperDiagnostics(): Promise<DeveloperDiagnostics | null> {
    return this.bridge?.getDeveloperDiagnostics?.() ?? null
  }

  /** 版本信息。 */
  get versions(): Readonly<Record<string, string | undefined>> {
    return this.bridge?.versions ?? {
      chrome: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1],
      app: 'browser',
    }
  }
}

export const name = 'framework:platform'
export const inject: string[] = []

export function apply(ctx: Context): void {
  ctx.plugin(PlatformService)
}

export default { name, inject, apply }

function detectBrowserPlatform(): string {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }
  if (/Mac/.test(navigator.platform)) {
    return 'darwin'
  }
  if (/Win/.test(navigator.platform)) {
    return 'win32'
  }
  return 'linux'
}

async function openBrowserFiles(options: {
  filters?: FileDialogFilter[]
  multiple?: boolean
}): Promise<OpenedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = options.multiple ?? true
    if (options.filters?.length) {
      input.accept = options.filters
        .flatMap(filter => filter.extensions.map(extension => `.${extension.replace(/^\./, '')}`))
        .join(',')
    }
    input.addEventListener('change', async () => {
      const files = [
        ...(input.files ?? []),
      ]
      resolve(await Promise.all(files.map(async (file) => {
        const buffer = await file.arrayBuffer()
        return {
          name: file.name,
          path: file.name,
          size: file.size,
          data: new Uint8Array(buffer),
        }
      })))
    }, { once: true })
    input.addEventListener('cancel', () => resolve([]), { once: true })
    input.click()
  })
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
