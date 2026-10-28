/**
 * @df/kernel · Cordis 内核
 *
 * 内核保持“薄”：只创建根上下文、加载/卸载插件并记录诊断。业务能力全部由
 * 插件提供，内核不依赖 Vue、DOM、Electron 或 WASM。
 */
import type {
  FrameworkEnvironment,
  FrameworkPluginManifest,
  KernelPluginInfo,
  KernelServiceContract,
  PluginEntry,
  PluginSource,
} from '@df/core'
import type { Context, Fiber, Plugin } from 'cordis'
import { errorMessage } from '@df/core'
import { Context as CordisContext, Service } from 'cordis'

// Cordis 的 FiberState 是 ambient const enum，verbatimModuleSyntax 无法导入。
const FIBER_ACTIVE = 2
const FIBER_FAILED = 3

/** 框架版本，与根 package.json 同步维护。 */
export const version = '0.1.0'

/** 内核配置。 */
export interface KernelOptions {
  /** 上报版本。 */
  version?: string
  /** 运行环境。 */
  environment?: FrameworkEnvironment
  /** 严格模式：任一插件失败即抛出。 */
  strict?: boolean
}

/** 内部记录。 */
interface KernelRecord {
  info: KernelPluginInfo
  entry: PluginEntry
  fiber?: Fiber
  started: number
}

/** 内核服务。 */
export class KernelService extends Service implements KernelServiceContract {
  static inject: string[] = []

  readonly version: string
  readonly environment: FrameworkEnvironment
  readonly startedAt = performance.now()
  private readonly options: KernelOptions
  private readonly records = new Map<string, KernelRecord>()
  private disposed = false

  constructor(ctx: Context, options: KernelOptions = {}) {
    super(ctx, 'kernel')
    this.options = options
    this.version = options.version ?? version
    this.environment = options.environment ?? detectEnvironment()
    ctx.on('internal/status', (fiber) => {
      for (const record of this.records.values()) {
        if (record.fiber === fiber) {
          this.syncStatus(record)
        }
      }
    })
  }

  get plugins(): readonly KernelPluginInfo[] {
    return [
      ...this.records.values(),
    ].map(record => ({ ...record.info }))
  }

  async load(entries: PluginEntry[]): Promise<readonly KernelPluginInfo[]> {
    if (this.disposed) {
      throw new Error('内核已释放，无法继续加载插件')
    }
    // 先检查并注册整批插件，再等待激活；消费者可以出现在提供者之前。
    const ids = new Set(this.records.keys())
    for (const entry of entries) {
      const { id } = resolveManifest(entry)
      if (ids.has(id)) {
        throw new Error(`插件 ${id} 已加载；请先卸载或使用 reload`)
      }
      ids.add(id)
    }
    const records = entries.map(entry => this.register(entry))
    await Promise.all(records.map(async (record) => {
      try {
        await record.fiber?.await()
        this.syncStatus(record)
      }
      catch (error) {
        this.fail(record, error)
      }
    }))
    const result = records.map(record => ({ ...record.info }))
    const failed = result.find(info => info.status === 'failed')
    if (failed && this.options.strict) {
      throw new Error(`插件 ${failed.id} 加载失败：${failed.error}`)
    }
    this.ctx.emit('framework/ready')
    return result
  }

  async loadOne(entry: PluginEntry): Promise<KernelPluginInfo> {
    return (await this.load([entry]))[0]
  }

  private register(entry: PluginEntry): KernelRecord {
    const manifest = resolveManifest(entry)
    if (this.records.has(manifest.id)) {
      throw new Error(`插件 ${manifest.id} 已加载；请先卸载或使用 reload`)
    }
    const info: KernelPluginInfo = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      commit: manifest.commit,
      source: entry.source ?? 'builtin',
      status: 'pending',
    }
    const record: KernelRecord = {
      info,
      entry,
      started: performance.now(),
    }
    this.records.set(manifest.id, record)
    try {
      const fork = this.ctx.plugin(entry.plugin, entry.config)
      // 保存原始 fiber，而非 Cordis 返回的 PromiseLike 包装对象。
      record.fiber = fork.ctx.fiber
    }
    catch (error) {
      info.status = 'failed'
      info.durationMs = performance.now() - record.started
      info.error = errorMessage(error)
      this.ctx.emit('kernel/plugin-failed', { ...info })
      this.ctx.logger.error(`[kernel] 插件 ${manifest.id} 加载失败：${info.error}`)
    }
    return record
  }

  async unload(id: string): Promise<void> {
    const record = this.records.get(id)
    if (!record) {
      return
    }
    await record.fiber?.dispose()
    record.info.status = 'unloaded'
    record.fiber = undefined
    this.records.delete(id)
    this.ctx.emit('kernel/plugin-unloaded', id)
  }

  async reload(id: string): Promise<KernelPluginInfo | undefined> {
    const record = this.records.get(id)
    if (!record) {
      return undefined
    }
    const { entry, info } = record
    await this.unload(id)
    const next = await this.loadOne(entry)
    next.source = info.source
    return next
  }

  info(id: string): KernelPluginInfo | undefined {
    const record = this.records.get(id)
    return record
      ? { ...record.info }
      : undefined
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.ctx.emit('framework/disposing')
    // Cordis 会按依赖逆序释放插件；内核自身最后释放。
    await this.ctx.fiber.dispose()
  }

  private syncStatus(record: KernelRecord): void {
    if (!record.fiber || record.info.status === 'failed') {
      return
    }
    if (record.fiber.state === FIBER_FAILED) {
      void record.fiber.await().catch(error => this.fail(record, error))
      return
    }
    const status = record.fiber.state === FIBER_ACTIVE
      ? 'loaded'
      : 'pending'
    if (record.info.status === status) {
      return
    }
    record.info.status = status
    record.info.durationMs = performance.now() - record.started
    if (status === 'loaded') {
      this.ctx.emit('kernel/plugin-loaded', { ...record.info })
    }
  }

  private fail(record: KernelRecord, error: unknown): void {
    if (record.info.status === 'failed') {
      return
    }
    record.info.error = errorMessage(error)
    record.info.status = 'failed'
    record.info.durationMs = performance.now() - record.started
    this.ctx.emit('kernel/plugin-failed', { ...record.info })
  }
}

/** 创建根上下文并安装内核。 */
export async function createFrameworkContext(options: KernelOptions = {}): Promise<Context> {
  const ctx = new CordisContext()
  await ctx.plugin(KernelService, options)
  return ctx
}

/** 声明插件并保留类型推导。 */
export function definePlugin<T = unknown>(plugin: Plugin<T>): Plugin<T> {
  return plugin
}

/** 创建带配置的插件条目。 */
export function pluginEntry<T = unknown>(
  plugin: Plugin<T>,
  config?: T,
  manifest?: Partial<FrameworkPluginManifest>,
  source: PluginSource = 'builtin',
): PluginEntry {
  return {
    plugin: plugin as Plugin,
    config,
    manifest,
    source,
  }
}

/** 按清单加载插件。 */
export async function loadPlugins(ctx: Context, entries: PluginEntry[]): Promise<readonly KernelPluginInfo[]> {
  return ctx.kernel.load(entries)
}

/** 从模块构造插件清单。 */
export function definePluginModule(
  manifest: FrameworkPluginManifest,
  plugin: Plugin,
): { manifest: FrameworkPluginManifest, default: Plugin } {
  return { manifest, default: plugin }
}

/** 探测运行环境。 */
export function detectEnvironment(): FrameworkEnvironment {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'desktopFramework' in window
      ? 'electron-renderer'
      : 'browser'
  }
  if (typeof process !== 'undefined') {
    return process.versions.electron ? 'electron-main' : 'node'
  }
  return 'test'
}

function resolveManifest(entry: PluginEntry): FrameworkPluginManifest {
  const plugin = entry.plugin as { name?: string }
  const id = entry.manifest?.id ?? plugin.name ?? 'anonymous'
  return {
    id,
    name: entry.manifest?.name ?? plugin.name ?? id,
    version: entry.manifest?.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    repository: entry.manifest?.repository,
    commit: entry.manifest?.commit,
    requires: entry.manifest?.requires,
    optional: entry.manifest?.optional,
  }
}
