import type { FileDialogFilter, SaveFileRequest, WindowControlAction } from '@df/core'
/** IPC 插件：preload 暴露的最小能力面。 */
import type { Context } from 'cordis'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { errorMessage } from '@df/core'
import { DisposableStore, toDisposable } from '@df/vscode'
import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import { CHANNELS } from '../../shared'
import { executeDeveloperAction } from '../developer-tools'
import { isAllowedNavigation } from '../navigation'

export const name = 'electron:ipc'
export const inject = ['electronHost']

const MAX_FILE_BYTES = 512 * 1024 * 1024

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:ipc')

  const trusted = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean => {
    return host.isTrustedWindow(event.sender)
      && event.senderFrame === event.sender.mainFrame
      && isAllowedNavigation(event.senderFrame?.url ?? '', host.options.renderer.devUrl)
  }

  const handle = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => unknown): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trusted(event)) {
        throw new Error(`拒绝来自不可信来源的 IPC 请求：${event.senderFrame?.url ?? 'unknown'}`)
      }
      return listener(event, ...(args as never[]))
    })
    disposables.add(toDisposable(() => ipcMain.removeHandler(channel)))
  }

  handle(CHANNELS.openFiles, async (event, options?: { title?: string, filters?: FileDialogFilter[], multiple?: boolean }) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? host.mainWindow
    if (!parent) {
      return []
    }
    const result = await dialog.showOpenDialog(parent, {
      title: options?.title ?? '打开文件',
      properties: options?.multiple === false
        ? ['openFile']
        : ['openFile', 'multiSelections'],
      filters: sanitizeFilters(options?.filters),
    })
    if (result.canceled) {
      return []
    }
    const files = []
    for (const path of result.filePaths) {
      const info = await stat(path)
      if (info.size > MAX_FILE_BYTES) {
        throw new Error(`文件 ${basename(path)} 超过 512MB 上限`)
      }
      files.push({
        name: basename(path),
        path,
        size: info.size,
        data: new Uint8Array(await readFile(path)),
      })
    }
    return files
  })

  handle(CHANNELS.saveFile, async (event, request: SaveFileRequest) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? host.mainWindow
    if (!parent || !(request?.data instanceof Uint8Array)) {
      return null
    }
    const result = await dialog.showSaveDialog(parent, {
      title: request.title ?? '保存文件',
      defaultPath: request.defaultPath,
      filters: sanitizeFilters(request.filters),
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    await writeFile(result.filePath, request.data)
    return result.filePath
  })

  handle(CHANNELS.windowControl, async (event, action: WindowControlAction) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? host.mainWindow
    if (!window) {
      return { maximized: false, fullscreen: false, focused: false }
    }
    switch (action) {
      case 'minimize':
        window.minimize()
        break
      case 'maximize':
        window.maximize()
        break
      case 'unmaximize':
        window.unmaximize()
        break
      case 'toggleMaximize':
        window.isMaximized()
          ? window.unmaximize()
          : window.maximize()
        break
      case 'close':
        window.close()
        break
      default:
        break
    }
    return {
      maximized: window.isMaximized(),
      fullscreen: window.isFullScreen(),
      focused: window.isFocused(),
    }
  })

  handle(CHANNELS.windowState, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? host.mainWindow
    return window
      ? {
          maximized: window.isMaximized(),
          fullscreen: window.isFullScreen(),
          focused: window.isFocused(),
        }
      : { maximized: false, fullscreen: false, focused: false }
  })

  handle(CHANNELS.titleBarOverlay, async (event, options: { color?: string, symbolColor?: string, height?: number }) => {
    if (process.platform === 'darwin') {
      return
    }
    const window = BrowserWindow.fromWebContents(event.sender) ?? host.mainWindow
    if (!window) {
      return
    }
    window.setTitleBarOverlay({
      color: sanitizeColor(options?.color, '#101215'),
      symbolColor: sanitizeColor(options?.symbolColor, '#e7e9ec'),
      height: Math.min(80, Math.max(20, Math.round(Number(options?.height) || 38))),
    })
  })

  handle(CHANNELS.versions, async () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    app: app.getVersion(),
  }))

  handle(CHANNELS.openExternal, async (_event, url: string) => {
    if (typeof url !== 'string') {
      throw new TypeError('URL 必须是字符串')
    }
    const parsed = new URL(url)
    const allowed = host.options.externalProtocols ?? ['https:', 'http:', 'mailto:']
    if (!allowed.includes(parsed.protocol)) {
      throw new Error(`不允许打开协议 ${parsed.protocol}`)
    }
    await shell.openExternal(url)
  })

  handle(CHANNELS.runtime, async () => host.runtimeInfo ?? null)

  handle(CHANNELS.openDetachedWindow, async (_event, request: unknown) => {
    if (!host.createDetachedWindow) {
      return false
    }
    return host.createDetachedWindow(request)
  })

  handle(CHANNELS.windowContext, async event => host.contextFor(event.sender))

  const onWindowMessage = (event: Electron.IpcMainEvent, message?: { topic?: unknown, payload?: unknown }): void => {
    if (event.sender !== host.mainWindow?.webContents && !host.isTrustedWindow(event.sender)) {
      return
    }
    if (event.senderFrame !== event.sender.mainFrame) {
      return
    }
    if (!isAllowedNavigation(event.senderFrame?.url ?? '', host.options.renderer.devUrl)) {
      return
    }
    if (!message || typeof message.topic !== 'string' || !message.topic || message.topic.length > 120) {
      return
    }
    host.broadcastWindowMessage(event.sender, message.topic, message.payload)
  }
  ipcMain.on(CHANNELS.windowMessage, onWindowMessage)
  disposables.add(toDisposable(() => ipcMain.removeListener(CHANNELS.windowMessage, onWindowMessage)))

  let panelWatch: { sender: Electron.WebContents, timer: NodeJS.Timeout, outsideSince: number } | undefined
  const stopPanelWatch = (sender?: Electron.WebContents): void => {
    if (!panelWatch || (sender && panelWatch.sender !== sender)) {
      return
    }
    clearInterval(panelWatch.timer)
    panelWatch = undefined
  }
  const onPanelDragWatch = (event: Electron.IpcMainEvent, action?: unknown): void => {
    if (!trusted(event)) {
      return
    }
    if (action !== 'start') {
      stopPanelWatch(event.sender)
      return
    }
    stopPanelWatch()
    const source = event.sender
    const timer = setInterval(() => {
      if (!panelWatch || panelWatch.sender !== source || source.isDestroyed()) {
        stopPanelWatch(source)
        return
      }
      const window = BrowserWindow.fromWebContents(source)
      if (!window || window.isDestroyed()) {
        stopPanelWatch(source)
        return
      }
      const point = screen.getCursorScreenPoint()
      const bounds = window.getBounds()
      const outside = point.x < bounds.x
        || point.y < bounds.y
        || point.x >= bounds.x + bounds.width
        || point.y >= bounds.y + bounds.height
      if (!outside) {
        panelWatch.outsideSince = 0
        return
      }
      if (!panelWatch.outsideSince) {
        panelWatch.outsideSince = Date.now()
        return
      }
      if (Date.now() - panelWatch.outsideSince < 80) {
        return
      }
      source.send(CHANNELS.panelDragOutside, { x: point.x, y: point.y })
      stopPanelWatch(source)
    }, 50)
    panelWatch = { sender: source, timer, outsideSince: 0 }
  }
  ipcMain.on(CHANNELS.panelDragWatch, onPanelDragWatch)
  disposables.add(toDisposable(() => {
    stopPanelWatch()
    ipcMain.removeListener(CHANNELS.panelDragWatch, onPanelDragWatch)
  }))

  handle(CHANNELS.developerAction, (event, action: unknown) => executeDeveloperAction(
    event.sender,
    action,
    host.options.window?.webPreferences?.devTools !== false,
  ))
  handle(CHANNELS.developerDiagnostics, () => ({
    startup: host.startup.snapshot().map(phase => ({ ...phase })),
    processes: app.getAppMetrics().map(process => ({
      pid: process.pid,
      type: process.type,
      cpuPercent: process.cpu.percentCPUUsage,
      memoryMB: process.memory.workingSetSize / 1024,
    })),
  }))

  ctx.logger.info('[electron] IPC 已注册')
}

function sanitizeFilters(filters?: FileDialogFilter[]): Electron.FileFilter[] | undefined {
  if (!Array.isArray(filters)) {
    return undefined
  }
  return filters
    .filter(filter => filter && typeof filter.name === 'string' && Array.isArray(filter.extensions))
    .map(filter => ({
      name: filter.name.slice(0, 80),
      extensions: filter.extensions
        .filter(extension => typeof extension === 'string')
        .map(extension => extension.replace(/^\./, '').replace(/[^a-z0-9]/gi, ''))
        .filter(Boolean)
        .slice(0, 20),
    }))
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length > 40) {
    return fallback
  }
  return /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(value.trim())
    ? value.trim()
    : fallback
}

/** 统一日志包装，避免未使用错误变量。 */
export function logIpcError(ctx: Context, channel: string, error: unknown): void {
  ctx.logger.error(`[electron] IPC ${channel} 失败：${errorMessage(error)}`)
}
