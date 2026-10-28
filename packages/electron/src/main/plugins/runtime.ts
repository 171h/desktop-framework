/** 运行时拉取与 df-runtime 协议。 */
import type { Context } from 'cordis'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { shortCommit } from '@df/bootstrap'
import { RuntimeResolver } from '@df/bootstrap/node'
import { errorMessage } from '@df/core'
import { DisposableStore, toDisposable } from '@df/vscode'
import { app, net, protocol } from 'electron'
import { serveFile } from '../static'

export const name = 'electron:runtime'
export const inject = ['electronHost']

export async function apply(ctx: Context): Promise<void> {
  const host = ctx.electronHost
  await host.whenReady()
  const disposables = new DisposableStore()
  ctx.effect(() => () => disposables.dispose(), 'electron:runtime')

  const configPath = host.options.runtime?.configPath
    ?? (app.isPackaged
      ? join(process.resourcesPath, 'desktop-framework.config.json')
      : join(app.getAppPath(), 'desktop-framework.config.json'))

  if (!existsSync(configPath)) {
    ctx.logger.info(`[electron] 未找到运行时配置 ${configPath}，使用工作区内置框架`)
    host.setRuntime(undefined)
  }
  else {
    const resolver = new RuntimeResolver({
      cacheDir: host.options.runtime?.cacheDirectory ?? join(app.getPath('userData'), 'framework'),
      offline: host.options.runtime?.offline,
      logger: (level, message) => ctx.logger[level](message),
      fetch: ((input, init) => net.fetch(input as string, init)) as typeof fetch,
    })
    try {
      const runtime = await resolver.resolveFile(configPath)
      host.setRuntime(runtime)
      if (runtime.mode === 'workspace') {
        ctx.logger.info(`[electron] 运行时使用工作区版本${runtime.fallbackReason
          ? `（${runtime.fallbackReason}）`
          : ''}`)
      }
    }
    catch (error) {
      ctx.logger.error(`[electron] 运行时解析失败：${errorMessage(error)}`)
      host.setRuntime(undefined)
    }
  }

  protocol.handle('df-runtime', async (request) => {
    const runtime = host.runtime
    if (!runtime?.directory) {
      return new Response('Runtime not available', { status: 404 })
    }
    const url = new URL(request.url)
    if (url.hostname !== shortCommit(runtime.commit)) {
      return new Response('Forbidden', { status: 403 })
    }
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    return serveFile({
      root: runtime.directory,
      pathname: `/${pathname}`,
      index: 'index.html',
      cacheControl: 'public, max-age=31536000, immutable',
    })
  })
  disposables.add(toDisposable(() => protocol.unhandle('df-runtime')))
}
