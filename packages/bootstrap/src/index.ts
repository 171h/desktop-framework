/**
 * @df/bootstrap · 运行时配置
 *
 * 使用方在 `desktop-framework.config.json` 中声明框架仓库与精确 commit。
 * 运行时解析器根据配置查找缓存或拉取对应 commit 的制品，校验后加载。
 */
import type { RuntimeMode } from '@df/core'

/** 配置模式；`auto` 在远程不可用时回退本地/内置版本。 */
export type FrameworkRuntimeMode = 'workspace' | 'remote' | 'auto'

export interface FrameworkArtifactConfig {
  /** 制品地址；支持 `{commit}`、`{shortCommit}` 占位符。 */
  url?: string
  /** Subresource Integrity，例如 `sha256-...` 或 `sha256:<hex>`。 */
  integrity?: string
}

export interface FrameworkRuntimeConfig {
  /** git 仓库地址。 */
  repository: string
  /** 精确 commit。 */
  commit: string
  /** 解析模式。 */
  mode?: FrameworkRuntimeMode
  /** 运行时入口文件（归档内相对路径）。 */
  entry?: string
  /** 制品配置。 */
  artifact?: FrameworkArtifactConfig
  /** 是否启用本地缓存。 */
  cache?: boolean
  /** 下载与解析超时。 */
  timeoutMs?: number
  /** 额外的 HTTP 头。 */
  headers?: Record<string, string>
}

export interface FrameworkAppConfig {
  id?: string
  title?: string
}

export interface FrameworkConfigFile {
  $schema?: string
  framework: FrameworkRuntimeConfig
  app?: FrameworkAppConfig
}

/** 解析后的运行时结果。 */
export interface ResolvedRuntime {
  mode: RuntimeMode
  repository: string
  commit: string
  directory?: string
  entryFile?: string
  styleFile?: string
  cached: boolean
  integrity?: string
  fallbackReason?: string
}

/** 运行时归档 manifest。 */
export interface RuntimeManifest {
  commit: string
  version?: string
  entry: string
  style?: string
  files?: Record<string, string>
}

export const DEFAULT_ENTRY = 'index.js'
export const DEFAULT_STYLE = 'style.css'

/** 制品路径必须在所有宿主平台上都是归档内的相对路径。 */
export function validateRuntimePath(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\\:\0]/.test(value)
    || value.startsWith('/') || value.split('/').includes('..')) {
    throw new TypeError('运行时路径必须是归档内的相对路径')
  }
  return value
}

/** 规范化仓库地址。 */
export function normalizeRepository(repository: string): string {
  return repository
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
}

/** 短 commit（7 位）。 */
export function shortCommit(commit: string): string {
  return commit.slice(0, 7)
}

/** 生成默认 GitHub Release 制品地址。 */
export function defaultArtifactUrl(repository: string, commit: string): string {
  const repo = normalizeRepository(repository)
  const short = shortCommit(commit)
  return `${repo}/releases/download/framework-${short}/desktop-framework-runtime-${short}.tar.gz`
}

/** 解析制品 URL 占位符。 */
export function resolveArtifactUrl(config: FrameworkRuntimeConfig): string {
  const template = config.artifact?.url || defaultArtifactUrl(config.repository, config.commit)
  return template
    .replaceAll('{commit}', config.commit)
    .replaceAll('{shortCommit}', shortCommit(config.commit))
    .replaceAll('{repository}', normalizeRepository(config.repository))
}

/** 校验配置结构。 */
export function parseFrameworkConfig(value: unknown): FrameworkConfigFile {
  if (!value || typeof value !== 'object') {
    throw new TypeError('desktop-framework.config.json 必须是对象')
  }
  const file = value as Partial<FrameworkConfigFile>
  if (!file.framework || typeof file.framework !== 'object') {
    throw new TypeError('配置缺少 framework 字段')
  }
  const framework = file.framework
  if (typeof framework.repository !== 'string' || !/^https?:\/\//.test(framework.repository)) {
    throw new TypeError('framework.repository 必须是 http(s) 仓库地址')
  }
  if (typeof framework.commit !== 'string' || !/^[\da-f]{7,40}$/i.test(framework.commit)) {
    throw new TypeError('framework.commit 必须是完整 commit 或至少 7 位短哈希')
  }
  const mode = framework.mode ?? 'auto'
  if (!['workspace', 'remote', 'auto'].includes(mode)) {
    throw new TypeError(`未知的 framework.mode：${mode}`)
  }
  validateRuntimePath(framework.entry ?? DEFAULT_ENTRY)
  if (framework.timeoutMs !== undefined && (!Number.isFinite(framework.timeoutMs) || framework.timeoutMs <= 0)) {
    throw new TypeError('framework.timeoutMs 必须是正数')
  }
  return {
    ...file,
    framework: {
      ...framework,
      commit: framework.commit.toLowerCase(),
      mode,
      entry: framework.entry ?? DEFAULT_ENTRY,
      cache: framework.cache !== false,
      timeoutMs: framework.timeoutMs ?? 15000,
    },
  }
}

/** 是否是可拉取的远程模式。 */
export function isRemoteMode(config: FrameworkRuntimeConfig): boolean {
  return config.mode === 'remote' || config.mode === 'auto'
}
