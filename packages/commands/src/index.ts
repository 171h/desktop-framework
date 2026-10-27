/**
 * @desktop-framework/commands · 命令注册表
 *
 * Ribbon、应用菜单、快速访问工具栏、快捷键与命令面板都只引用命令 id。
 * 命令状态使用惰性函数，界面在每次构建时读取最新值。
 */
import type { CommandDefinition, IDisposable } from '@desktop-framework/core'
import type { Context } from 'cordis'
import { errorMessage } from '@desktop-framework/core'
import { Service } from 'cordis'
import { markRaw, reactive } from 'vue'

declare module 'cordis' {
  interface Context {
    commands: CommandService
  }
}

/** 命令注册选项。 */
export interface RegisterCommandOptions {
  /** 允许覆盖同 id 命令（用于宿主定制框架默认行为）。 */
  override?: boolean
}

/** 命令注册结果。 */
interface Registration {
  definition: CommandDefinition
  previous?: CommandDefinition
}

/** 命令服务。 */
export class CommandService extends Service {
  static inject: string[] = []

  private readonly registry = reactive(new Map<string, CommandDefinition>())

  constructor(ctx: Context) {
    super(ctx, 'commands')
  }

  /** 当前全部命令；返回稳定排序的数组副本。 */
  get list(): readonly CommandDefinition[] {
    return [
      ...this.registry.values(),
    ].sort((a, b) => a.id.localeCompare(b.id))
  }

  /** 注册命令。 */
  register(definition: CommandDefinition, options: RegisterCommandOptions = {}): IDisposable {
    if (!definition.id) {
      throw new Error('命令必须提供 id')
    }
    const previous = this.registry.get(definition.id)
    if (previous && !options.override) {
      throw new Error(`命令 ${definition.id} 已注册；如需覆盖请传入 { override: true }`)
    }
    const stored = markRaw(definition)
    const registration: Registration = { definition: stored, previous }
    this.registry.set(definition.id, stored)
    this.ctx.emit('command/registered', stored)
    let disposed = false
    return {
      dispose: () => {
        if (disposed) {
          return
        }
        disposed = true
        if (this.registry.get(definition.id) !== stored) {
          return
        }
        if (registration.previous) {
          this.registry.set(definition.id, registration.previous)
        }
        else {
          this.registry.delete(definition.id)
        }
        this.ctx.emit('command/unregistered', stored.id)
      },
    }
  }

  /** 批量注册。 */
  registerMany(definitions: CommandDefinition[], options: RegisterCommandOptions = {}): IDisposable {
    const disposables = definitions.map(definition => this.register(definition, options))
    return {
      dispose: () => disposables.forEach(disposable => disposable.dispose()),
    }
  }

  /** 取命令定义。 */
  get(id: string): CommandDefinition | undefined {
    return this.registry.get(id)
  }

  /** 是否存在。 */
  has(id: string): boolean {
    return this.registry.has(id)
  }

  /** 动态启用状态。 */
  isEnabled(id: string): boolean {
    const command = this.registry.get(id)
    if (!command) {
      return false
    }
    try {
      return command.enabled?.() ?? true
    }
    catch {
      return false
    }
  }

  /** 动态勾选状态。 */
  isChecked(id: string): boolean {
    const command = this.registry.get(id)
    try {
      return command?.checked?.() ?? false
    }
    catch {
      return false
    }
  }

  /** 是否隐藏。 */
  isHidden(id: string): boolean {
    const command = this.registry.get(id)
    if (!command?.hidden) {
      return false
    }
    try {
      return command.hidden()
    }
    catch {
      return true
    }
  }

  /**
   * 执行命令。
   *
   * @throws 命令不存在、被禁用或执行函数抛错时抛出。
   */
  async execute(id: string, ...args: unknown[]): Promise<unknown> {
    const command = this.registry.get(id)
    if (!command) {
      const error = new Error(`命令 ${id} 不存在`)
      this.ctx.emit('command/failed', id, error)
      throw error
    }
    try {
      if (!this.isEnabled(id)) {
        throw new Error(`命令 ${id} 当前不可用`)
      }
      const result = await command.run(this.ctx, ...args)
      this.ctx.emit('command/executed', id, result)
      return result
    }
    catch (error) {
      this.ctx.emit('command/failed', id, error)
      this.ctx.logger.warn(`[commands] ${id}: ${errorMessage(error)}`)
      throw error
    }
  }

  /** 读取界面可展示的命令，过滤隐藏项。 */
  visible(prefix?: string): readonly CommandDefinition[] {
    return this.list.filter(command =>
      !this.isHidden(command.id) && (!prefix || command.id.startsWith(prefix)),
    )
  }
}

/** 插件主体。 */
export const name = 'framework:commands'
export const inject: string[] = []
export function apply(ctx: Context): void {
  ctx.plugin(CommandService)
}

export default { name, inject, apply }
