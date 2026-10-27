/** 主窗口插件：窗口创建、状态持久化、安全导航与首屏性能。 */
import type { Context } from 'cordis'
import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import { debounce, errorMessage } from '@desktop-framework/core'
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'
import { app, BrowserWindow, shell } from 'electron'
import { loadWindowState, saveWindowState } from '../window-state'

export const name = 'electron:window'
export const inject = ['electronHost']

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  await host.whenRuntimeResolved()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:window')
  const statePath = join(app.getPath('userData'), 'window-state.json')
  const state = await loadWindowState(statePath)

  const createWindow = async (): Promise<void> => {
    if (host.mainWindow && !host.mainWindow.isDestroyed()) {
      host.mainWindow.focus()
      return
    }
    const windowOptions = host.options.window ?? {}
    const webPreferences: Electron.WebPreferences = {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: false,
      v8CacheOptions: 'code',
      ...windowOptions.webPreferences,
      additionalArguments: [
        `--df-app-version=${app.getVersion()}`,
        ...(windowOptions.webPreferences?.additionalArguments ?? []),
      ],
    }
    const isMac = process.platform === 'darwin'
    const window = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      minWidth: 980,
      minHeight: 640,
      show: false,
      paintWhenInitiallyHidden: true,
      backgroundColor: host.options.renderer.backgroundColor ?? '#141619',
      autoHideMenuBar: true,
      title: host.options.window?.title ?? host.options.renderer.title ?? host.options.productName ?? 'Desktop Framework',
      ...(isMac
        ? {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 14, y: 12 },
          }
        : {
            frame: false,
          }),
      ...windowOptions,
      webPreferences,
    } as BrowserWindowConstructorOptions)

    host.mainWindow = window
    window.setMenuBarVisibility(false)
    window.webContents.setVisualZoomLevelLimits(1, 1)

    const sendState = (): void => {
      if (window.isDestroyed()) {
        return
      }
      host.broadcastWindowState({
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen(),
        focused: window.isFocused(),
      })
    }
    const persist = debounce(() => {
      if (window.isDestroyed()) {
        return
      }
      void saveWindowState(statePath, window).catch(error => ctx.logger.warn(`[electron] 保存窗口状态失败：${errorMessage(error)}`))
    }, 250)

    disposables.add(toDisposable(() => {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }))
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
      void saveWindowState(statePath, window)
    })
    window.on('closed', () => {
      if (host.mainWindow === window) {
        host.mainWindow = undefined
      }
    })

    window.once('ready-to-show', () => {
      if (state.maximized) {
        window.maximize()
      }
      window.show()
      host.startup.mark('window-shown')
      ctx.logger.info(`[electron] 窗口显示 ${Math.round(host.startup.report().totalMs)}ms`)
    })

    window.webContents.on('did-finish-load', () => {
      sendState()
      host.startup.mark('renderer-loaded')
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
  }

  try {
    await createWindow()
  }
  catch (error) {
    ctx.logger.error(`[electron] 主窗口创建失败：${errorMessage(error)}`)
  }

  const onActivate = (): void => {
    if (!host.mainWindow) {
      void createWindow().catch(error => ctx.logger.error(`[electron] 重新创建窗口失败：${errorMessage(error)}`))
    }
    else {
      host.mainWindow.focus()
    }
  }
  app.on('activate', onActivate)
  disposables.add(toDisposable(() => app.off('activate', onActivate)))
}

function isAllowedNavigation(url: string, devUrl?: string): boolean {
  if (url.startsWith('df-app://bundle/') || url.startsWith('df-runtime://')) {
    return true
  }
  if (devUrl) {
    try {
      const dev = new URL(devUrl)
      const target = new URL(url)
      return dev.origin === target.origin
    }
    catch {
      return false
    }
  }
  return false
}
