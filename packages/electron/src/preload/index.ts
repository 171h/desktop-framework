/**
 * preload：只暴露类型化的最小桌面桥。
 *
 * 渲染进程没有 Node、没有 `ipcRenderer`，只能调用这里列出的方法。
 */
import type { DesktopBridge, DetachedWindowRequest, FileDialogFilter, FrameworkRuntimeInfo, OpenedFile, SaveFileRequest, ScreenPoint, TitleBarOverlayOptions, WindowContext, WindowControlAction, WindowMessage, WindowState } from '@df/core'
import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../shared'

/** 暴露 `window.desktopFramework`。 */
export function exposeDesktopBridge(): void {
  const versionArg = process.argv.find(argument => argument.startsWith('--df-app-version='))
  const appVersion = versionArg?.slice('--df-app-version='.length) ?? '0.1.0'

  const bridge: DesktopBridge = {
    async developerAction(action): Promise<void> {
      await ipcRenderer.invoke(CHANNELS.developerAction, action)
    },
    async getDeveloperDiagnostics() {
      return ipcRenderer.invoke(CHANNELS.developerDiagnostics)
    },
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      app: appVersion,
    },
    async openFiles(options?: { title?: string, filters?: FileDialogFilter[], multiple?: boolean }): Promise<OpenedFile[]> {
      const files = await ipcRenderer.invoke(CHANNELS.openFiles, options) as Array<Omit<OpenedFile, 'data'> & { data: Uint8Array }>
      return files.map(file => ({
        ...file,
        data: file.data instanceof Uint8Array
          ? file.data
          : new Uint8Array(file.data),
      }))
    },
    async saveFile(request: SaveFileRequest): Promise<string | null> {
      return ipcRenderer.invoke(CHANNELS.saveFile, {
        ...request,
        data: request.data instanceof Uint8Array
          ? request.data
          : new Uint8Array(request.data),
      }) as Promise<string | null>
    },
    async windowControl(action: WindowControlAction): Promise<WindowState> {
      return ipcRenderer.invoke(CHANNELS.windowControl, action) as Promise<WindowState>
    },
    async getWindowState(): Promise<WindowState> {
      return ipcRenderer.invoke(CHANNELS.windowState) as Promise<WindowState>
    },
    async setTitleBarOverlay(options: TitleBarOverlayOptions): Promise<void> {
      await ipcRenderer.invoke(CHANNELS.titleBarOverlay, options)
    },
    onWindowState(listener: (state: WindowState) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, state: WindowState): void => listener(state)
      ipcRenderer.on(CHANNELS.windowState, handler)
      return () => ipcRenderer.removeListener(CHANNELS.windowState, handler)
    },
    onCommand(listener: (command: string, args?: unknown[]) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, command: string, args?: unknown[]): void => listener(command, args)
      ipcRenderer.on(CHANNELS.command, handler)
      return () => ipcRenderer.removeListener(CHANNELS.command, handler)
    },
    async openExternal(url: string): Promise<void> {
      await ipcRenderer.invoke(CHANNELS.openExternal, url)
    },
    async getRuntime(): Promise<FrameworkRuntimeInfo | null> {
      return ipcRenderer.invoke(CHANNELS.runtime) as Promise<FrameworkRuntimeInfo | null>
    },
    async openDetachedWindow(request: DetachedWindowRequest): Promise<boolean> {
      return ipcRenderer.invoke(CHANNELS.openDetachedWindow, request) as Promise<boolean>
    },
    async getWindowContext(): Promise<WindowContext | null> {
      return ipcRenderer.invoke(CHANNELS.windowContext) as Promise<WindowContext | null>
    },
    sendWindowMessage(topic: string, payload: unknown): void {
      ipcRenderer.send(CHANNELS.windowMessage, { topic, payload })
    },
    onWindowMessage(listener: (message: WindowMessage) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, message: WindowMessage): void => listener(message)
      ipcRenderer.on(CHANNELS.windowMessage, handler)
      return () => ipcRenderer.removeListener(CHANNELS.windowMessage, handler)
    },
    startPanelDragWatch(): void {
      ipcRenderer.send(CHANNELS.panelDragWatch, 'start')
    },
    stopPanelDragWatch(): void {
      ipcRenderer.send(CHANNELS.panelDragWatch, 'stop')
    },
    onPanelDragOutside(listener: (point: ScreenPoint) => void): () => void {
      const handler = (_event: Electron.IpcRendererEvent, point: ScreenPoint): void => listener(point)
      ipcRenderer.on(CHANNELS.panelDragOutside, handler)
      return () => ipcRenderer.removeListener(CHANNELS.panelDragOutside, handler)
    },
  }

  contextBridge.exposeInMainWorld('desktopFramework', bridge)
}

exposeDesktopBridge()
