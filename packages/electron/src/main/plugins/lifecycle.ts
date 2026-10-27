/** Electron 主进程生命周期插件。 */
import type { Context } from 'cordis'
import { errorMessage } from '@desktop-framework/core'
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'
import { app } from 'electron'

export const name = 'electron:lifecycle'
export const inject = ['electronHost', 'kernel']

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await app.whenReady()
  host.markReady()

  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:lifecycle-events')

  let quitting = false
  const onBeforeQuit = (event: Electron.Event): void => {
    if (quitting) {
      return
    }
    event.preventDefault()
    quitting = true
    void ctx.kernel.dispose().finally(() => {
      app.quit()
    })
  }

  const register = (event: string, listener: (...args: never[]) => void): void => {
    app.on(event as never, listener as never)
    disposables.add(toDisposable(() => app.off(event as never, listener as never)))
  }

  register('before-quit', onBeforeQuit)
  register('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  register('render-process-gone', (_event: unknown, contents: unknown, details: unknown) => {
    ctx.logger.error(`[electron] 渲染进程退出：${JSON.stringify({ contents, details })}`)
  })
  register('child-process-gone', (_event: unknown, details: unknown) => {
    ctx.logger.error(`[electron] 子进程退出：${JSON.stringify(details)}`)
  })
  register('unresponsive', () => {
    ctx.logger.warn('[electron] 渲染进程无响应')
  })
  register('responsive', () => {
    ctx.logger.info('[electron] 渲染进程恢复响应')
  })
  register('second-instance', () => {
    const window = host.mainWindow
    if (window) {
      if (window.isMinimized()) {
        window.restore()
      }
      window.focus()
    }
  })
  register('activate', () => {
    if (!host.mainWindow && app.isReady()) {
      host.sendCommand('app.activate')
    }
  })
  register('open-file', (event: unknown, path: string) => {
    ;(event as Electron.Event).preventDefault()
    host.sendCommand('file.open', [path])
  })

  ctx.logger.info(`[electron] 主进程就绪 · ${errorMessage(app.getName())}`)
}
