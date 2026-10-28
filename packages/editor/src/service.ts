/**
 * @df/editor · 编辑器文档标签页
 *
 * 标签页的拖拽排序、溢出滚动与键盘焦点由 nusys-ui 的 `vscode-tabs`
 * 完成（其交互参考 VS Code）；本服务补充文档生命周期、关闭/固定/脏状态、
 * 右键菜单和快捷键命令。
 */
import type { CommandDefinition, IDisposable } from '@df/core'
import type { Context } from 'cordis'
import type { EditorDocument, OpenDocumentOptions } from './types'
import { Service } from 'cordis'
import { markRaw, ref } from 'vue'
import WelcomeView from './WelcomeView.vue'

export type { EditorDocument, OpenDocumentOptions } from './types'

declare module 'cordis' {
  interface Context {
    editor: EditorService
  }
}

export class EditorService extends Service {
  static inject = ['commands']

  private readonly items = ref<EditorDocument[]>([])
  private readonly active = ref<string>()

  constructor(ctx: Context) {
    super(ctx, 'editor')
    this.registerCommands()
    this.open({
      id: 'welcome',
      title: '欢迎',
      icon: 'home',
      component: markRaw(WelcomeView),
      closable: true,
    })
  }

  get documents(): readonly EditorDocument[] {
    return this.items.value
  }

  get activeId(): string | undefined {
    return this.active.value
  }

  get activeDocument(): EditorDocument | undefined {
    return this.items.value.find(document => document.id === this.active.value)
  }

  get activeIndex(): number {
    return this.items.value.findIndex(document => document.id === this.active.value)
  }

  /** 打开或激活文档。 */
  open(document: EditorDocument, options: OpenDocumentOptions = {}): IDisposable {
    const existing = this.items.value.find(item => item.id === document.id)
    if (existing) {
      Object.assign(existing, {
        ...document,
        component: markRaw(document.component),
      })
      this.items.value = [...this.items.value]
      if (options.activate !== false) {
        this.activate(document.id)
      }
      this.ctx.emit('editor/changed')
      return this.disposerFor(document.id)
    }
    const stored: EditorDocument = {
      ...document,
      component: markRaw(document.component),
      closable: document.closable !== false,
    }
    const next = [...this.items.value]
    let index = options.index === undefined
      ? next.length
      : Math.max(0, Math.min(options.index, next.length))
    if (stored.pinned) {
      index = next.filter(item => item.pinned).length
    }
    next.splice(index, 0, stored)
    this.items.value = next
    this.ctx.emit('editor/opened', stored.id)
    if (options.activate !== false) {
      this.active.value = stored.id
      this.ctx.emit('editor/active-changed', stored.id)
    }
    this.ctx.emit('editor/changed')
    return this.disposerFor(stored.id)
  }

  /** 激活文档。 */
  activate(id: string, notify = true): boolean {
    if (!this.items.value.some(document => document.id === id)) {
      return false
    }
    if (this.active.value === id) {
      return true
    }
    this.active.value = id
    if (notify) {
      this.ctx.emit('editor/active-changed', id)
      this.ctx.emit('editor/changed')
    }
    return true
  }

  /** 关闭文档。不可关闭的文档会被忽略。 */
  close(id: string): boolean {
    const document = this.items.value.find(item => item.id === id)
    if (!document || document.closable === false) {
      return false
    }
    return this.remove(id)
  }

  /** 关闭其他文档。 */
  closeOthers(id: string): void {
    for (const document of [...this.items.value]) {
      if (document.id !== id) {
        this.close(document.id)
      }
    }
    this.activate(id)
  }

  /** 关闭右侧文档。 */
  closeToRight(id: string): void {
    const index = this.items.value.findIndex(document => document.id === id)
    if (index < 0) {
      return
    }
    for (const document of this.items.value.slice(index + 1)) {
      this.close(document.id)
    }
    this.activate(id)
  }

  /** 关闭所有可关闭文档。 */
  closeAll(): void {
    for (const document of [...this.items.value]) {
      this.close(document.id)
    }
  }

  /** 下一个标签页。 */
  next(): void {
    if (this.items.value.length === 0) {
      return
    }
    const index = this.activeIndex < 0
      ? 0
      : (this.activeIndex + 1) % this.items.value.length
    this.activate(this.items.value[index].id)
  }

  /** 上一个标签页。 */
  previous(): void {
    if (this.items.value.length === 0) {
      return
    }
    const index = this.activeIndex < 0
      ? this.items.value.length - 1
      : (this.activeIndex - 1 + this.items.value.length) % this.items.value.length
    this.activate(this.items.value[index].id)
  }

  /** 按 id 列表重排；固定标签页保持在最前。 */
  reorder(ids: readonly string[]): void {
    const byId = new Map(this.items.value.map(document => [document.id, document]))
    const ordered = ids
      .map(id => byId.get(id))
      .filter((document): document is EditorDocument => Boolean(document))
    for (const document of this.items.value) {
      if (!ordered.includes(document)) {
        ordered.push(document)
      }
    }
    const pinned = ordered.filter(document => document.pinned)
    const normal = ordered.filter(document => !document.pinned)
    this.items.value = [
      ...pinned,
      ...normal,
    ]
    this.ctx.emit('editor/changed')
  }

  /** 更新脏状态。 */
  setDirty(id: string, dirty: boolean): void {
    const document = this.items.value.find(item => item.id === id)
    if (!document || document.dirty === dirty) {
      return
    }
    document.dirty = dirty
    this.items.value = [...this.items.value]
    this.ctx.emit('editor/changed')
  }

  /** 固定 / 取消固定。 */
  togglePin(id: string): void {
    const document = this.items.value.find(item => item.id === id)
    if (!document) {
      return
    }
    document.pinned = !document.pinned
    const rest = this.items.value.filter(item => item.id !== id)
    const pinned = rest.filter(item => item.pinned)
    const normal = rest.filter(item => !item.pinned)
    this.items.value = document.pinned
      ? [
          document,
          ...pinned,
          ...normal,
        ]
      : [
          ...pinned,
          document,
          ...normal,
        ]
    this.ctx.emit('editor/changed')
  }

  /** 打开欢迎页。 */
  openWelcome(): void {
    this.open({
      id: 'welcome',
      title: '欢迎',
      icon: 'home',
      component: markRaw(WelcomeView),
      closable: true,
    })
  }

  /** 强制移除文档；用于插件卸载时释放自己的不可关闭文档。 */
  private remove(id: string): boolean {
    const index = this.items.value.findIndex(document => document.id === id)
    if (index < 0) {
      return false
    }
    const next = this.items.value.filter(item => item.id !== id)
    this.items.value = next
    if (this.active.value === id) {
      const fallback = next[index] ?? next[index - 1]
      this.active.value = fallback?.id
      this.ctx.emit('editor/active-changed', this.active.value)
    }
    this.ctx.emit('editor/closed', id)
    this.ctx.emit('editor/changed')
    return true
  }

  private disposerFor(id: string): IDisposable {
    return {
      dispose: () => {
        this.remove(id)
      },
    }
  }

  private registerCommands(): void {
    const commands: CommandDefinition[] = [
      {
        id: 'editor.closeActive',
        title: '关闭当前标签页',
        category: '标签页',
        icon: 'close',
        keybinding: 'Mod+W',
        enabled: () => Boolean(this.activeDocument) && this.activeDocument?.closable !== false,
        menu: {
          path: ['编辑'],
          order: 50,
        },
        run: () => {
          if (this.activeId) {
            this.close(this.activeId)
          }
        },
      },
      {
        id: 'editor.nextTab',
        title: '下一个标签页',
        category: '标签页',
        icon: 'arrow-right',
        keybinding: 'Ctrl+Tab',
        run: () => this.next(),
      },
      {
        id: 'editor.previousTab',
        title: '上一个标签页',
        category: '标签页',
        icon: 'arrow-left',
        keybinding: 'Ctrl+Shift+Tab',
        run: () => this.previous(),
      },
      {
        id: 'editor.closeAll',
        title: '关闭所有标签页',
        category: '标签页',
        icon: 'close-all',
        menu: {
          path: ['编辑'],
          order: 51,
        },
        run: () => this.closeAll(),
      },
      {
        id: 'editor.openWelcome',
        title: '打开欢迎页',
        category: '标签页',
        icon: 'home',
        ribbon: {
          tab: 'home',
          tabTitle: '主页',
          tabOrder: 0,
          group: '开始',
          groupOrder: 60,
          order: 0,
          size: 'half',
        },
        menu: {
          path: ['帮助'],
          order: 5,
        },
        run: () => this.openWelcome(),
      },
    ]
    for (const command of commands) {
      this.ctx.effect(() => {
        const registration = this.ctx.commands.register(command)
        return () => registration.dispose()
      }, `editor:${command.id}`)
    }
  }
}

export const name = 'framework:editor'
export const inject = ['commands']

export function apply(ctx: Context): void {
  ctx.plugin(EditorService)
}

export default { name, inject, apply }
