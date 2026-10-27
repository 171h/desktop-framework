/**
 * @desktop-framework/bootstrap/node · 运行时解析与缓存
 *
 * 流程：
 * 1. 读取 `desktop-framework.config.json`；
 * 2. 计算 `<cacheDir>/<commit>-<repoHash>` 缓存目录；
 * 3. 命中 manifest 且 commit 匹配时直接复用；
 * 4. 未命中时下载 tar.gz，校验 SHA-256，限制路径后解压；
 * 5. 校验 manifest 中的 commit，返回入口与样式文件。
 *
 * `mode: 'auto'` 在网络失败时返回 workspace 回退，并把原因放在
 * `fallbackReason`；`mode: 'remote'` 则直接抛出错误。
 */
import type { FrameworkConfigFile, FrameworkRuntimeConfig, ResolvedRuntime, RuntimeManifest } from './index'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import * as tar from 'tar'
import {
  DEFAULT_ENTRY,
  DEFAULT_STYLE,
  normalizeRepository,
  parseFrameworkConfig,
  resolveArtifactUrl,
} from './index'

export type { FrameworkConfigFile, FrameworkRuntimeConfig, ResolvedRuntime, RuntimeManifest } from './index'

export interface RuntimeResolverOptions {
  /** 缓存根目录，例如 Electron 的 userData/framework。 */
  cacheDir: string
  /** 自定义 fetch（Electron 可传 net.fetch）。 */
  fetch?: typeof fetch
  /** 离线模式，直接回退 workspace。 */
  offline?: boolean
  /** 日志。 */
  logger?: (level: 'info' | 'warn' | 'error', message: string) => void
  /** 下载进度。 */
  onProgress?: (received: number, total: number) => void
}

export class RuntimeResolver {
  private readonly fetchImpl: typeof fetch
  private readonly logger: (level: 'info' | 'warn' | 'error', message: string) => void

  constructor(private readonly options: RuntimeResolverOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.logger = options.logger ?? (() => {})
  }

  /** 从配置文件解析。 */
  async resolveFile(configPath: string): Promise<ResolvedRuntime> {
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as unknown
    return this.resolve(parseFrameworkConfig(parsed))
  }

  /** 解析运行时。 */
  async resolve(file: FrameworkConfigFile): Promise<ResolvedRuntime> {
    const config = file.framework
    const base: ResolvedRuntime = {
      mode: 'workspace',
      repository: normalizeRepository(config.repository),
      commit: config.commit,
      cached: true,
    }
    if (config.mode === 'workspace') {
      return base
    }
    if (this.options.offline) {
      return this.fallback(config, '离线模式已启用')
    }
    try {
      return await this.resolveRemote(config)
    }
    catch (error) {
      if (config.mode === 'auto') {
        const message = error instanceof Error
          ? error.message
          : String(error)
        this.logger('warn', `[bootstrap] 远程运行时不可用，回退内置版本：${message}`)
        return this.fallback(config, message)
      }
      throw error
    }
  }

  /** 清空某个版本的缓存。 */
  async clear(config: FrameworkRuntimeConfig): Promise<void> {
    await rm(this.cacheDirectory(config), { recursive: true, force: true })
  }

  private fallback(config: FrameworkRuntimeConfig, reason: string): ResolvedRuntime {
    return {
      mode: 'workspace',
      repository: normalizeRepository(config.repository),
      commit: config.commit,
      cached: false,
      fallbackReason: reason,
    }
  }

  private async resolveRemote(config: FrameworkRuntimeConfig): Promise<ResolvedRuntime> {
    const directory = this.cacheDirectory(config)
    const manifest = await this.readCachedManifest(directory, config)
    if (manifest) {
      this.logger('info', `[bootstrap] 命中运行时缓存 ${directory}`)
      return this.toResolved(config, directory, manifest, true)
    }

    const url = resolveArtifactUrl(config)
    this.logger('info', `[bootstrap] 拉取运行时：${url}`)
    const archive = await this.download(config, url)
    const integrity = await verifyIntegrity(archive, config.artifact?.integrity)
    const staging = `${directory}.staging-${Date.now()}`
    const work = `${directory}.extract-${Date.now()}`
    await mkdir(join(work, 'content'), { recursive: true })
    await mkdir(dirname(directory), { recursive: true })
    const archivePath = join(work, 'runtime.tar.gz')
    await writeFile(archivePath, archive)

    try {
      await tar.x({
        file: archivePath,
        cwd: join(work, 'content'),
        strict: true,
        filter: (path, entry) => {
          if ('type' in entry && entry.type !== 'File' && entry.type !== 'Directory') {
            return false
          }
          const normalized = normalize(path)
          return !normalized.startsWith('..') && !normalized.startsWith(sep) && !normalized.includes(`${sep}..${sep}`)
        },
      })
      const content = join(work, 'content')
      const runtimeManifest = await this.readManifest(content, config)
      if (!runtimeManifest) {
        throw new Error('运行时归档缺少 manifest.json')
      }
      await rm(staging, { recursive: true, force: true })
      await rename(content, staging)
      await rm(directory, { recursive: true, force: true })
      await rename(staging, directory)
      this.logger('info', `[bootstrap] 运行时已缓存到 ${directory}`)
      return this.toResolved(config, directory, runtimeManifest, false, integrity)
    }
    finally {
      await rm(work, { recursive: true, force: true }).catch(() => {})
    }
  }

  private async readCachedManifest(directory: string, config: FrameworkRuntimeConfig): Promise<RuntimeManifest | null> {
    if (config.cache === false) {
      return null
    }
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as RuntimeManifest
      if (!commitMatches(manifest.commit, config.commit)) {
        this.logger('warn', '[bootstrap] 缓存 commit 不匹配，重新拉取')
        return null
      }
      const entry = manifest.entry || config.entry || DEFAULT_ENTRY
      if (!existsSync(join(directory, entry))) {
        return null
      }
      return { ...manifest, entry }
    }
    catch {
      return null
    }
  }

  private async readManifest(directory: string, config: FrameworkRuntimeConfig): Promise<RuntimeManifest | null> {
    const manifestPath = join(directory, 'manifest.json')
    if (existsSync(manifestPath)) {
      let manifest: RuntimeManifest
      try {
        manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RuntimeManifest
      }
      catch (error) {
        throw new Error(`manifest.json 解析失败：${error instanceof Error
          ? error.message
          : String(error)}`)
      }
      if (!commitMatches(manifest.commit, config.commit)) {
        throw new Error(`运行时 commit ${manifest.commit} 与配置 ${config.commit} 不一致`)
      }
      return manifest
    }
    if (existsSync(join(directory, config.entry ?? DEFAULT_ENTRY))) {
      // 兼容手工构建：没有 manifest 时只校验入口存在。
      return {
        commit: config.commit,
        entry: config.entry ?? DEFAULT_ENTRY,
        style: existsSync(join(directory, DEFAULT_STYLE))
          ? DEFAULT_STYLE
          : undefined,
      }
    }
    return null
  }

  private toResolved(
    config: FrameworkRuntimeConfig,
    directory: string,
    manifest: RuntimeManifest,
    cached: boolean,
    integrity?: string,
  ): ResolvedRuntime {
    const entry = manifest.entry || config.entry || DEFAULT_ENTRY
    const style = manifest.style && existsSync(join(directory, manifest.style))
      ? manifest.style
      : undefined
    return {
      mode: 'remote',
      repository: normalizeRepository(config.repository),
      commit: manifest.commit || config.commit,
      directory,
      entryFile: join(directory, entry),
      styleFile: style
        ? join(directory, style)
        : undefined,
      cached,
      integrity,
    }
  }

  private async download(config: FrameworkRuntimeConfig, url: string): Promise<Buffer> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15000)
    try {
      const response = await this.fetchImpl(url, {
        headers: config.headers,
        signal: controller.signal,
        redirect: 'follow',
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }
      return await readResponse(response, this.options.onProgress)
    }
    finally {
      clearTimeout(timeout)
    }
  }

  private cacheDirectory(config: FrameworkRuntimeConfig): string {
    const repoHash = createHash('sha256')
      .update(normalizeRepository(config.repository))
      .digest('hex')
      .slice(0, 8)
    return join(this.options.cacheDir, `${config.commit.slice(0, 16)}-${repoHash}`)
  }
}

/** 校验 SRI；未提供时返回计算得到的 `sha256-<base64>`。 */
export async function verifyIntegrity(bytes: Uint8Array, expected?: string): Promise<string> {
  const digest = createHash('sha256').update(bytes).digest()
  const actual = `sha256-${digest.toString('base64')}`
  if (expected) {
    const normalized = expected.trim()
    const hex = normalized.startsWith('sha256:')
      ? normalized.slice('sha256:'.length)
      : undefined
    if (hex) {
      const actualHex = digest.toString('hex')
      if (actualHex !== hex.toLowerCase()) {
        throw new Error('运行时制品 SHA-256 校验失败')
      }
      return `sha256:${actualHex}`
    }
    if (normalized !== actual) {
      throw new Error('运行时制品 SRI 校验失败')
    }
  }
  return actual
}

async function readResponse(response: Response, onProgress?: (received: number, total: number) => void): Promise<Buffer> {
  const total = Number(response.headers.get('content-length') ?? 0)
  if (!response.body) {
    return Buffer.from(await response.arrayBuffer())
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    received += value.byteLength
    onProgress?.(received, total)
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
}

function commitMatches(actual: string, expected: string): boolean {
  if (!actual || !expected) {
    return false
  }
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual)
}

/** 供 Node 流式下载时使用（当前实现采用 Web Response，保留导出便于测试）。 */
export function toReadable(response: Response): Readable {
  return Readable.fromWeb(response.body as never)
}

/** 语法糖。 */
export async function resolveRuntime(
  configPath: string,
  options: RuntimeResolverOptions,
): Promise<ResolvedRuntime> {
  return new RuntimeResolver(options).resolveFile(configPath)
}

/** 确保目录存在并返回。 */
export async function ensureDirectory(path: string): Promise<string> {
  await mkdir(path, { recursive: true })
  return path
}

/** 读取文件大小。 */
export async function fileSize(path: string): Promise<number> {
  return (await stat(path)).size
}
