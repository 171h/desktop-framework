/**
 * @desktop-framework/settings · 本地存储
 *
 * 浏览器与 Electron 渲染进程都通过 `localStorage` 持久化；在无 DOM 环境
 * （测试、Node）自动退回内存实现。键名统一带命名空间，避免多个宿主共享
 * 同一 origin 时互相覆盖。
 */
import type { Context } from 'cordis'
import { Service } from 'cordis'

declare module 'cordis' {
  interface Context {
    storage: StorageService
  }
}

/** 存储配置。 */
export interface StorageConfig {
  /** 键前缀。 */
  namespace?: string
  /** 可注入的 Storage 实现，便于测试。 */
  storage?: StorageLike
}

/** 最小 Storage 接口。 */
export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  key: (index: number) => string | null
  readonly length: number
}

/** 带命名空间的存储服务。 */
export class StorageService extends Service {
  static inject: string[] = []

  private readonly namespace: string
  private readonly backend?: StorageLike
  private readonly memory = new Map<string, string>()

  constructor(ctx: Context, config: StorageConfig = {}) {
    super(ctx, 'storage')
    this.namespace = config.namespace ?? 'desktop-framework'
    this.backend = config.storage ?? detectStorage()
  }

  /** 读取 JSON 值。 */
  get<T>(key: string, fallback: T): T {
    const raw = this.read(this.key(key))
    if (raw === null) {
      return fallback
    }
    try {
      return JSON.parse(raw) as T
    }
    catch {
      return fallback
    }
  }

  /** 写入 JSON 值。 */
  set<T>(key: string, value: T): void {
    this.write(this.key(key), JSON.stringify(value))
  }

  /** 删除键。 */
  remove(key: string): void {
    const storageKey = this.key(key)
    try {
      this.backend?.removeItem(storageKey)
    }
    catch {
      // 隐私模式或配额错误时至少同步内存态。
    }
    this.memory.delete(storageKey)
  }

  /** 列出本命名空间下的键（去掉前缀）。 */
  keys(): string[] {
    const prefix = `${this.namespace}:`
    const result = new Set<string>()
    if (this.backend) {
      for (let index = 0; index < this.backend.length; index++) {
        const key = this.backend.key(index)
        if (key?.startsWith(prefix)) {
          result.add(key.slice(prefix.length))
        }
      }
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        result.add(key.slice(prefix.length))
      }
    }
    return [...result].sort()
  }

  /** 清空本命名空间。 */
  clear(): void {
    for (const key of this.keys()) {
      this.remove(key)
    }
  }

  private key(key: string): string {
    return `${this.namespace}:${key}`
  }

  private read(key: string): string | null {
    try {
      return this.backend?.getItem(key) ?? this.memory.get(key) ?? null
    }
    catch {
      return this.memory.get(key) ?? null
    }
  }

  private write(key: string, value: string): void {
    this.memory.set(key, value)
    try {
      this.backend?.setItem(key, value)
    }
    catch {
      // 内存态已更新，UI 仍然可在当前会话内工作。
    }
  }
}

/** 插件 id。 */
export const name = 'framework:settings'

/** 插件主体。 */
export function apply(ctx: Context, config: StorageConfig = {}): void {
  ctx.plugin(StorageService, config)
}

export default { name, apply }

function detectStorage(): StorageLike | undefined {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  }
  catch {
    return undefined
  }
  return undefined
}
