import type { DetachedWindowRequest, WindowContext } from '@df/core'
/** 窗口插件：主窗口、独立编辑器/面板窗口、状态持久化与安全导航。 */
import type { Context } from 'cordis'
import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { debounce, errorMessage } from '@df/core'
import { DisposableStore, toDisposable } from '@df/vscode'
import { app, BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { isAllowedNavigation } from '../navigation'
import { loadWindowState, saveWindowState } from '../window-state'

export const name = 'electron:window'
export const inject = ['electronHost']

interface CreateWindowOptions {
  title?: string
  bounds?: Partial<Rectangle>
  context?: WindowContext
  main?: boolean
}

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  await host.whenRuntimeResolved()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:window')
  const statePath = join(app.getPath('userData'), 'window-state.json')
  const state = await loadWindowState(statePath)

  const createWindow = async (options: CreateWindowOptions): Promise<BrowserWindow> => {
    const isMac = process.platform === 'darwin'
    const webPreferences: Electron.WebPreferences = {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: true,
      v8CacheOptions: 'code',
      ...host.options.window?.webPreferences,
      additionalArguments: [
        `--df-app-version=${app.getVersion()}`,
        ...(host.options.window?.webPreferences?.additionalArguments ?? []),
      ],
    }
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'build/icon.png')
    const main = options.main === true
    const bounds = main
      ? {
          width: state.width,
          height: state.height,
          x: state.x,
          y: state.y,
        }
      : sanitizeBounds(options.bounds, options.context?.kind === 'panel'
          ? 420
          : 900, options.context?.kind === 'panel'
          ? 360
          : 640)
    const window = new BrowserWindow({
      ...bounds,
      minWidth: main ? 980 : 420,
      minHeight: main ? 640 : 320,
      show: false,
      paintWhenInitiallyHidden: true,
      backgroundColor: host.options.renderer.backgroundColor ?? '#141619',
      autoHideMenuBar: true,
      title: options.title ?? host.options.window?.title ?? host.options.renderer.title ?? host.options.productName ?? 'Desktop Framework',
      icon: existsSync(iconPath)
        ? iconPath
        : undefined,
      // 保留系统原生窗口控制：Windows/Linux 用 titleBarOverlay，macOS 用
      // 原生交通灯；只隐藏默认标题栏并绘制自定义内容。
      ...(isMac
        ? {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 14, y: 12 },
          }
        : {
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: {
              color: nativeTheme.shouldUseDarkColors ? '#101215' : '#f4f6f8',
              symbolColor: nativeTheme.shouldUseDarkColors ? '#e7e9ec' : '#20242a',
              height: 38,
            },
          }),
      ...(main
        ? host.options.window
        : {}),
      webPreferences,
    } as BrowserWindowConstructorOptions)

    if (main) {
      host.mainWindow = window
      if (isMac && existsSync(iconPath)) {
        app.dock?.setIcon(iconPath)
      }
    }
    host.registerWindow(window, options.context)
    window.setMenuBarVisibility(false)
    window.webContents.setVisualZoomLevelLimits(1, 1)

    let rendererReady = false
    const sendState = (): void => {
      if (!main || !rendererReady || window.isDestroyed()) {
        return
      }
      host.broadcastWindowState({
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen(),
        focused: window.isFocused(),
      })
    }
    const persist = debounce(() => {
      if (!main || window.isDestroyed()) {
        return
      }
      void saveWindowState(statePath, window).catch(error => ctx.logger.warn(`[electron] 保存窗口状态失败：${errorMessage(error)}`))
    }, 250)

    if (main) {
      disposables.add(toDisposable(() => {
        if (!window.isDestroyed()) {
          window.destroy()
        }
      }))
    }
    window.on('resize', () => {
      sendState()
      persist()
    })
    window.on('move', persist)
    window.on('maximize', sendState)
    window.on('unmaximize', sendState)
    window.on('enter-full-screen', sendState)
    window.on('leave-full-screen', sendState)
    window.on('focus', sendState)
    window.on('blur', sendState)
    window.on('close', () => {
      if (main) {
        void saveWindowState(statePath, window)
      }
    })
    window.on('closed', () => {
      if (host.mainWindow === window) {
        host.mainWindow = undefined
      }
    })

    window.once('ready-to-show', () => {
      if (main && state.maximized) {
        window.maximize()
      }
      window.show()
      if (main) {
        host.startup.mark('window-shown')
        ctx.logger.info(`[electron] 窗口显示 ${Math.round(host.startup.report().totalMs)}ms`)
      }
    })

    window.webContents.on('did-finish-load', () => {
      rendererReady = true
      if (main) {
        host.startup.mark('renderer-loaded')
      }
    })
    window.webContents.on('did-fail-load', (_event, code, description, url) => {
      ctx.logger.error(`[electron] 页面加载失败 ${code} ${description} ${url}`)
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      ctx.logger.error(`[electron] 渲染进程异常：${details.reason}`)
      if (details.reason !== 'clean-exit') {
        window.webContents.reload()
      }
    })
    window.webContents.on('unresponsive', () => {
      ctx.logger.warn('[electron] 窗口无响应')
    })
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) {
        void shell.openExternal(url)
      }
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url) => {
      if (isAllowedNavigation(url, host.options.renderer.devUrl)) {
        return
      }
      event.preventDefault()
      if (/^https?:/.test(url)) {
        void shell.openExternal(url)
      }
    })
    window.webContents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })

    const devUrl = host.options.renderer.devUrl
    try {
      if (devUrl) {
        await window.loadURL(devUrl)
      }
      else {
        await window.loadURL('df-app://bundle/index.html')
      }
    }
    catch (error) {
      ctx.logger.error(`[electron] 渲染页面加载失败：${errorMessage(error)}`)
    }
    return window
  }

  const createMainWindow = async (): Promise<void> => {
    if (host.mainWindow && !host.mainWindow.isDestroyed()) {
      host.mainWindow.focus()
      return
    }
    await createWindow({ main: true })
  }

  host.createDetachedWindow = async (request: unknown): Promise<boolean> => {
    if (!isDetachedWindowRequest(request)) {
      return false
    }
    const payloadSize = safeJsonSize(request.payload)
    if (payloadSize > 2 * 1024 * 1024) {
      ctx.logger.warn('[electron] 拒绝创建独立窗口：恢复数据超过 2MB')
      return false
    }
    try {
      await createWindow({
        title: request.title,
        bounds: request.bounds,
        context: {
          kind: request.kind,
          payload: request.payload,
        },
      })
      return true
    }
    catch (error) {
      ctx.logger.error(`[electron] 创建独立窗口失败：${errorMessage(error)}`)
      return false
    }
  }

  try {
    await createMainWindow()
  }
  catch (error) {
    ctx.logger.error(`[electron] 主窗口创建失败：${errorMessage(error)}`)
  }

  const onActivate = (): void => {
    if (!host.mainWindow) {
      void createMainWindow().catch(error => ctx.logger.error(`[electron] 重新创建窗口失败：${errorMessage(error)}`))
    }
    else {
      host.mainWindow.focus()
    }
  }
  app.on('activate', onActivate)
  disposables.add(toDisposable(() => app.off('activate', onActivate)))
  disposables.add(toDisposable(() => host.closeDetachedWindows()))
}

function isDetachedWindowRequest(value: unknown): value is DetachedWindowRequest {
  if (!value || typeof value !== 'object') {
    return false
  }
  const request = value as Partial<DetachedWindowRequest>
  if (request.kind !== 'editor' && request.kind !== 'panel') {
    return false
  }
  if (request.title !== undefined && (typeof request.title !== 'string' || request.title.length > 200)) {
    return false
  }
  if (request.bounds && typeof request.bounds === 'object') {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      const item = request.bounds[key]
      if (item !== undefined && (typeof item !== 'number' || !Number.isFinite(item))) {
        return false
      }
    }
  }
  return true
}

function sanitizeBounds(bounds: Partial<Rectangle> | undefined, fallbackWidth: number, fallbackHeight: number): Rectangle {
  const width = clampDimension(bounds?.width, fallbackWidth, 320, 2400)
  const height = clampDimension(bounds?.height, fallbackHeight, 240, 1600)
  const workArea = screen.getDisplayMatching({
    x: Number.isFinite(bounds?.x)
      ? bounds!.x!
      : 0,
    y: Number.isFinite(bounds?.y)
      ? bounds!.y!
      : 0,
    width,
    height,
  }).workArea
  const x = Number.isFinite(bounds?.x)
    ? Math.round(Math.min(Math.max(bounds!.x!, workArea.x), workArea.x + workArea.width - width))
    : Math.round(workArea.x + (workArea.width - width) / 2)
  const y = Number.isFinite(bounds?.y)
    ? Math.round(Math.min(Math.max(bounds!.y!, workArea.y), workArea.y + workArea.height - height))
    : Math.round(workArea.y + (workArea.height - height) / 2)
  return { x, y, width, height }
}

function clampDimension(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback
}

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0
  }
  catch {
    return Number.POSITIVE_INFINITY
  }
}
