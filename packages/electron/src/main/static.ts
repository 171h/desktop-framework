/**
 * 受控静态文件协议。
 *
 * 生产环境不直接用 `file://`：`df-app://` 提供标准源、正确 MIME、可 fetch 的
 * WASM，并会阻止路径穿越。`df-runtime://` 只暴露已校验缓存目录中的运行时
 * 制品，渲染进程不能借它读取任意文件。
 */
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const CSP = [
  'default-src \'self\' df-runtime:',
  'script-src \'self\' \'wasm-unsafe-eval\' df-runtime:',
  'style-src \'self\' \'unsafe-inline\' df-runtime:',
  'font-src \'self\' data: df-runtime:',
  'img-src \'self\' data: blob: df-runtime:',
  'connect-src \'self\' https: data: blob: df-runtime:',
  'worker-src \'self\' blob: df-runtime:',
  'object-src \'none\'',
  'base-uri \'self\'',
  'frame-ancestors \'none\'',
].join('; ')

export interface ServeOptions {
  root: string
  pathname: string
  index?: string
  cacheControl?: string
}

/** 返回静态文件响应。 */
export async function serveFile(options: ServeOptions): Promise<Response> {
  const root = resolve(options.root)
  const index = options.index ?? 'index.html'
  let pathname = decodeURIComponent(options.pathname || '/')
  if (pathname.endsWith('/')) {
    pathname += index
  }
  let filePath = resolve(root, `.${pathname}`)
  if (!isInside(root, filePath)) {
    return forbidden()
  }
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) {
      filePath = resolve(filePath, index)
    }
  }
  catch {
    // SPA 回退：没有扩展名时返回入口 HTML。
    if (!extname(pathname)) {
      filePath = resolve(root, index)
    }
    else {
      return new Response('Not Found', { status: 404 })
    }
  }
  if (!isInside(root, filePath)) {
    return forbidden()
  }
  try {
    const data = await readFile(filePath)
    const extension = extname(filePath).toLowerCase()
    const headers: Record<string, string> = {
      'content-type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'cache-control': options.cacheControl ?? cacheControlFor(extension),
      'x-content-type-options': 'nosniff',
    }
    if (extension === '.html') {
      headers['content-security-policy'] = CSP
      headers['cache-control'] = 'no-cache'
    }
    return new Response(data, { headers })
  }
  catch {
    return new Response('Not Found', { status: 404 })
  }
}

export function isInside(root: string, target: string): boolean {
  const normalizedRoot = resolve(root)
  const normalizedTarget = resolve(target)
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + sep)
}

function forbidden(): Response {
  return new Response('Forbidden', { status: 403 })
}

function cacheControlFor(extension: string): string {
  if ([
    '.js',
    '.css',
    '.wasm',
    '.woff',
    '.woff2',
    '.ttf',
    '.png',
    '.jpg',
    '.svg',
  ].includes(extension)) {
    return 'public, max-age=31536000, immutable'
  }
  return 'no-cache'
}
