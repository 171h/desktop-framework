/** 会话安全策略。 */
import type { Context } from 'cordis'
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'
import { app, session } from 'electron'

export const name = 'electron:session'
export const inject = ['electronHost']

export async function apply(ctx: Context): Promise<void> {
  await ctx.electronHost.whenReady()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:session')

  const defaultSession = session.defaultSession
  defaultSession.setSpellCheckerEnabled(false)
  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    ctx.logger.warn(`[electron] 拒绝权限请求：${permission}`)
    callback(false)
  })
  defaultSession.setPermissionCheckHandler(() => false)

  const onWebContents = (_event: unknown, contents: Electron.WebContents): void => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  }
  app.on('web-contents-created', onWebContents)
  disposables.add(toDisposable(() => app.off('web-contents-created', onWebContents)))
}
