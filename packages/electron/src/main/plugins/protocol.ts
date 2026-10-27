/** df-app 协议：生产环境下安全加载渲染进程。 */
import type { Context } from 'cordis'
import { dirname } from 'node:path'
import { DisposableStore, toDisposable } from '@desktop-framework/vscode'
import { protocol } from 'electron'
import { serveFile } from '../static'

export const name = 'electron:protocol'
export const inject = ['electronHost']

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:protocol')
  const root = dirname(host.options.renderer.file)

  protocol.handle('df-app', async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'bundle') {
      return new Response('Not Found', { status: 404 })
    }
    return serveFile({
      root,
      pathname: url.pathname,
      index: 'index.html',
    })
  })
  disposables.add(toDisposable(() => protocol.unhandle('df-app')))
}
