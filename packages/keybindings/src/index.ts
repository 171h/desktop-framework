/**
 * @desktop-framework/keybindings · 快捷键服务
 *
 * 绑定以规范化字符串保存，例如 `Ctrl+Shift+P`。`Mod` 会根据平台解析为
 * `Meta`（macOS）或 `Ctrl`（Windows/Linux），因此命令定义可以跨平台复用。
 * 命令注册时若带 `keybinding`，本服务会自动建立绑定。
 */
import type { CommandDefinition, IDisposable } from '@desktop-framework/core'
import type { Context } from 'cordis'
import { Service } from 'cordis'

declare module 'cordis' {
  interface Context {
    keybindings: KeybindingService
  }
}

/** 注册选项。 */
export interface KeybindingOptions {
  /** 动态启用条件。 */
  when?: () => boolean
  /** 来源，用于诊断。 */
  source?: string
}

/** 内部绑定。 */
interface Binding {
  key: string
  command: string
  when?: () => boolean
  source: string
}

/** 快捷键服务。 */
export class KeybindingService extends Service {
  static inject = ['commands']

  private readonly bindings = new Map<string, Binding>()
  private readonly byCommand = new Map<string, Set<string>>()
  private attachDisposable?: () => void
  readonly platform: 'mac' | 'other'

  constructor(ctx: Context) {
    super(ctx, 'keybindings')
    this.platform = detectPlatform()
    ctx.effect(() => {
      const dispose = this.attach()
      return () => dispose()
    }, 'keybindings:listener')
    ctx.on('command/registered', command => this.registerCommandBinding(command))
    ctx.on('command/unregistered', id => this.unregisterCommand(id))
    for (const command of ctx.commands.list) {
      this.registerCommandBinding(command)
    }
  }

  /** 注册绑定。 */
  register(binding: string, command: string, options: KeybindingOptions = {}): IDisposable {
    const key = normalizeBinding(binding, this.platform === 'mac')
    const entry: Binding = {
      key,
      command,
      when: options.when,
      source: options.source ?? 'manual',
    }
    this.bindings.set(key, entry)
    let set = this.byCommand.get(command)
    if (!set) {
      set = new Set()
      this.byCommand.set(command, set)
    }
    set.add(key)
    return {
      dispose: () => {
        if (this.bindings.get(key) === entry) {
          this.bindings.delete(key)
        }
        this.byCommand.get(command)?.delete(key)
      },
    }
  }

  /** 注销命令的全部绑定。 */
  unregisterCommand(command: string): void {
    const keys = this.byCommand.get(command)
    if (!keys) {
      return
    }
    for (const key of keys) {
      if (this.bindings.get(key)?.command === command) {
        this.bindings.delete(key)
      }
    }
    this.byCommand.delete(command)
  }

  /** 当前绑定快照。 */
  get list(): readonly Readonly<Binding>[] {
    return [
      ...this.bindings.values(),
    ]
  }

  /** 格式化快捷键用于界面展示。 */
  format(binding: string): string {
    const key = normalizeBinding(binding, this.platform === 'mac')
    const mac = this.platform === 'mac'
    return key
      .split('+')
      .map((part) => {
        if (!mac) {
          return part
        }
        switch (part) {
          case 'Meta': return '⌘'
          case 'Ctrl': return '⌃'
          case 'Alt': return '⌥'
          case 'Shift': return '⇧'
          default: return part.length === 1
            ? part.toUpperCase()
            : part
        }
      })
      .join(mac ? '' : '+')
  }

  /** 从键盘事件解析规范化组合键。 */
  fromEvent(event: KeyboardEvent): string {
    const parts: string[] = []
    if (event.ctrlKey) {
      parts.push('Ctrl')
    }
    if (event.altKey) {
      parts.push('Alt')
    }
    if (event.shiftKey) {
      parts.push('Shift')
    }
    if (event.metaKey) {
      parts.push('Meta')
    }
    parts.push(normalizeKey(event.key))
    return parts.join('+')
  }

  /** 查找事件对应的绑定。 */
  resolve(event: KeyboardEvent): Binding | undefined {
    const key = this.fromEvent(event)
    const binding = this.bindings.get(key)
    if (!binding) {
      return undefined
    }
    if (binding.when && !binding.when()) {
      return undefined
    }
    return binding
  }

  /** 绑定键盘监听。 */
  attach(target: Window | HTMLElement = window): () => void {
    const listener = (event: Event): void => {
      if (!(event instanceof KeyboardEvent) || event.defaultPrevented) {
        return
      }
      if (isEditableTarget(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return
      }
      const binding = this.resolve(event)
      if (!binding) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      void this.ctx.commands.execute(binding.command).catch(() => {
        // 命令服务已广播失败事件，快捷键层不再重复提示。
      })
    }
    target.addEventListener('keydown', listener)
    this.attachDisposable = () => target.removeEventListener('keydown', listener)
    return () => {
      target.removeEventListener('keydown', listener)
      if (this.attachDisposable) {
        this.attachDisposable = undefined
      }
    }
  }

  private registerCommandBinding(command: CommandDefinition): void {
    this.unregisterCommand(command.id)
    if (command.keybinding) {
      this.register(command.keybinding, command.id, {
        when: command.enabled,
        source: 'command',
      })
    }
  }
}

/** 键名规范化。 */
export function normalizeKey(key: string): string {
  if (key === ' ') {
    return 'Space'
  }
  if (key.length === 1) {
    return key.toUpperCase()
  }
  const aliases: Record<string, string> = {
    Esc: 'Escape',
    Del: 'Delete',
    Left: 'ArrowLeft',
    Right: 'ArrowRight',
    Up: 'ArrowUp',
    Down: 'ArrowDown',
    Add: '=',
    Subtract: '-',
  }
  return aliases[key] ?? key
}

/** 绑定字符串规范化：固定修饰键顺序并把 `Mod` 解析到平台。 */
export function normalizeBinding(binding: string, mac: boolean): string {
  const parts = binding.split('+').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) {
    return ''
  }
  const key = normalizeKey(parts.pop() ?? '')
  const modifiers = new Set<string>()
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'mod') {
      modifiers.add(mac ? 'Meta' : 'Ctrl')
    }
    else if (lower === 'ctrl' || lower === 'control') {
      modifiers.add('Ctrl')
    }
    else if (lower === 'cmd' || lower === 'command' || lower === 'meta' || lower === 'super') {
      modifiers.add('Meta')
    }
    else if (lower === 'alt' || lower === 'option') {
      modifiers.add('Alt')
    }
    else if (lower === 'shift') {
      modifiers.add('Shift')
    }
  }
  const ordered = ['Ctrl', 'Alt', 'Shift', 'Meta'].filter(modifier => modifiers.has(modifier))
  return [...ordered, key].join('+')
}

/** 是否处于可编辑元素内。 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return ![
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'range',
    ].includes(type)
  }
  return false
}

/** 平台探测。 */
export function detectPlatform(): 'mac' | 'other' {
  if (typeof navigator === 'undefined') {
    return 'other'
  }
  return /Mac|iPhone|iPad/.test(navigator.platform)
    ? 'mac'
    : 'other'
}

/** 插件 id。 */
export const name = 'framework:keybindings'
export const inject = ['commands']

/** 插件主体。 */
export function apply(ctx: Context): void {
  ctx.plugin(KeybindingService)
}

export default { name, inject, apply }
