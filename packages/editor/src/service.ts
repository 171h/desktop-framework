/**
 * @df/editor · 编辑器文档标签页
 *
 * 标签页语义参考 VS Code 的 EditorGroupModel：预览标签会被新预览替换，
 * 固定（对应 VS Code 的 sticky）标签保持在最左侧，活动编辑器维护 MRU
 * 顺序，关闭活动标签时优先回到最近使用的标签。
 */
import type { CommandDefinition, IDisposable } from '@df/core'
import type { Context } from 'cordis'
import type { DetachedEditorPayload, EditorDetachHandler, EditorDocument, OpenDocumentOptions } from './types'
import { Service } from 'cordis'
import { markRaw, ref } from 'vue'
import DetachedDocumentView from './DetachedDocumentView.vue'
import WelcomeView from './WelcomeView.vue'

export type {
  DetachedEditorPayload,
  EditorDetachHandler,
  EditorDocument,
  OpenDocumentOptions,
} from './types'

declare module 'cordis' {
  interface Context {
    editor: EditorService
  }
}

const MAX_CLOSED_EDITORS = 20

export class EditorService extends Service {
  static inject = ['commands']

  private readonly items = ref<EditorDocument[]>([])
  private readonly active = ref<string>()
  private mru: string[] = []
  private readonly closed: EditorDocument[] = []
  private readonly detachHandlers = new Map<string, EditorDetachHandler>()

  constructor(ctx: Context) {
    super(ctx, 'editor')
    this.registerBuiltinDetachHandlers()
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
    return this.documentById(this.active.value)
  }

  get activeIndex(): number {
    return this.items.value.findIndex(document => document.id === this.active.value)
  }

  /** 最近使用顺序（不含已关闭文档）。 */
  get recentDocuments(): readonly EditorDocument[] {
    this.pruneMru()
    return this.mru
      .map(id => this.documentById(id))
      .filter((document): document is EditorDocument => Boolean(document))
  }

  /** 打开或激活文档。 */
  open(document: EditorDocument, options: OpenDocumentOptions = {}): IDisposable {
    const existing = this.documentById(document.id)
    const wantsPreview = options.preview ?? document.preview ?? false
    const wantsPinned = options.pinned ?? document.pinned ?? false

    if (existing) {
      const wasPinned = existing.pinned
      Object.assign(existing, {
        ...document,
        component: markRaw(document.component),
        closable: document.closable !== false,
      })
      if (options.preview !== undefined) {
        existing.preview = options.preview
      }
      if (options.pinned !== undefined) {
        existing.pinned = options.pinned
      }
      if (existing.pinned) {
        existing.preview = false
      }
      if (existing.pinned !== wasPinned) {
        this.moveForPin(existing)
      }
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
      preview: wantsPreview && !wantsPinned,
      pinned: wantsPinned,
    }
    const next = [...this.items.value]
    let index = options.index === undefined
      ? next.length
      : Math.max(0, Math.min(options.index, next.length))
    const pinnedCount = next.filter(item => item.pinned).length
    let replacedActive = false

    if (stored.pinned) {
      index = pinnedCount
    }
    else if (stored.preview) {
      const previewIndex = next.findIndex(item => item.preview)
      if (previewIndex >= 0) {
        const replaced = next[previewIndex]
        index = previewIndex
        if (replaced.id !== stored.id) {
          replacedActive = replaced.id === this.active.value
          next.splice(previewIndex, 1)
          this.mru = this.mru.filter(id => id !== replaced.id)
          this.ctx.emit('editor/closed', replaced.id)
        }
      }
      else {
        index = Math.max(index, pinnedCount)
      }
    }
    else {
      index = Math.max(index, pinnedCount)
    }

    next.splice(index, 0, stored)
    this.items.value = next
    this.ctx.emit('editor/opened', stored.id)
    if (options.activate !== false || replacedActive) {
      this.activate(stored.id)
    }
    this.ctx.emit('editor/changed')
    return this.disposerFor(stored.id)
  }

  /** 激活文档。 */
  activate(id: string, notify = true): boolean {
    if (!this.documentById(id)) {
      return false
    }
    this.touchMru(id)
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
    const document = this.documentById(id)
    if (!document || document.closable === false) {
      return false
    }
    return this.remove(id, true)
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

  /** 关闭所有已保存（无未保存修改）的文档。 */
  closeSaved(): void {
    for (const document of [...this.items.value]) {
      if (!document.dirty) {
        this.close(document.id)
      }
    }
  }

  /** 关闭所有可关闭文档。 */
  closeAll(): void {
    for (const document of [...this.items.value]) {
      this.close(document.id)
    }
  }

  /** 重新打开最近关闭的文档。 */
  reopenClosed(): boolean {
    while (this.closed.length) {
      const document = this.closed.shift()!
      if (this.documentById(document.id)) {
        continue
      }
      const reopened = { ...document }
      delete reopened.preview
      this.open({
        ...reopened,
        preview: false,
      }, {
        activate: true,
        pinned: document.pinned,
      })
      return true
    }
    return false
  }

  /** 切换到最近使用的下一个标签页。 */
  next(): void {
    this.cycleMru(1)
  }

  /** 切换到最近使用的上一个标签页。 */
  previous(): void {
    this.cycleMru(-1)
  }

  /** 按标签顺序切换。 */
  nextInOrder(): void {
    this.cycleOrder(1)
  }

  /** 按标签顺序反向切换。 */
  previousInOrder(): void {
    this.cycleOrder(-1)
  }

  /** 清除预览状态，保留标签页。 */
  keepOpen(id: string): void {
    const document = this.documentById(id)
    if (!document?.preview) {
      return
    }
    document.preview = false
    this.items.value = [...this.items.value]
    this.ctx.emit('editor/changed')
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
    const document = this.documentById(id)
    if (!document || document.dirty === dirty) {
      return
    }
    document.dirty = dirty
    this.items.value = [...this.items.value]
    this.ctx.emit('editor/changed')
  }

  /** 固定 / 取消固定。取消固定时按 VS Code 语义恢复为预览标签。 */
  togglePin(id: string): void {
    const document = this.documentById(id)
    if (!document) {
      return
    }
    document.pinned = !document.pinned
    if (document.pinned) {
      document.preview = false
    }
    this.moveForPin(document)
    this.items.value = [...this.items.value]
    this.touchMru(id)
    this.ctx.emit('editor/changed')
  }

  /** 注册独立窗口中文档的恢复逻辑。 */
  registerDetachHandler(key: string, handler: EditorDetachHandler): IDisposable {
    this.detachHandlers.set(key, handler)
    return {
      dispose: () => {
        if (this.detachHandlers.get(key) === handler) {
          this.detachHandlers.delete(key)
        }
      },
    }
  }

  /** 生成拖出到独立窗口所需的文档描述。 */
  detachPayload(id: string): DetachedEditorPayload | undefined {
    const document = this.documentById(id)
    if (!document) {
      return
    }
    let state: unknown
    try {
      state = document.getDetachState?.()
      if (state !== undefined) {
        // IPC 只接受可结构化克隆的纯数据；同时剥离 Vue 响应式代理。
        state = JSON.parse(JSON.stringify(state))
      }
    }
    catch (error) {
      state = undefined
      this.ctx.logger.warn(`[editor] 读取文档 ${id} 的独立窗口状态失败：${String(error)}`)
    }
    return {
      id: document.id,
      title: document.title,
      icon: document.icon,
      detachKey: document.detachKey ?? document.id,
      state,
    }
  }

  /** 在独立窗口中恢复文档，并只保留该文档。 */
  restoreDetached(payload: DetachedEditorPayload): boolean {
    const accepted = this.acceptDetached(payload)
    if (accepted) {
      this.isolate(payload.id)
    }
    return accepted
  }

  /** 接受来自其他窗口的文档；保留目标窗口已有标签。 */
  acceptDetached(payload: DetachedEditorPayload): boolean {
    const handler = this.detachHandlers.get(payload.detachKey)
    const restored = handler?.(payload.state)
    if (restored) {
      this.open(restored, {
        activate: true,
        preview: false,
        pinned: restored.pinned,
      })
    }
    else if (!this.documentById(payload.id)) {
      this.open({
        id: payload.id,
        title: payload.title,
        icon: payload.icon,
        component: markRaw(DetachedDocumentView),
        closable: true,
      }, {
        activate: true,
      })
    }
    else {
      this.activate(payload.id)
    }
    return Boolean(this.documentById(payload.id))
  }

  /** 移除已转移到独立窗口的文档，不记录到可恢复列表。 */
  release(id: string): boolean {
    return this.remove(id, false)
  }

  /** 只保留指定文档。 */
  isolate(id: string): void {
    for (const document of [...this.items.value]) {
      if (document.id !== id) {
        this.remove(document.id, false)
      }
    }
    this.activate(id)
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

  private documentById(id?: string): EditorDocument | undefined {
    return id
      ? this.items.value.find(document => document.id === id)
      : undefined
  }

  private touchMru(id: string): void {
    this.mru = [
      id,
      ...this.mru.filter(value => value !== id),
    ]
  }

  private pruneMru(): void {
    this.mru = this.mru.filter(id => this.documentById(id))
  }

  private cycleMru(direction: number): void {
    const documents = this.recentDocuments
    if (!documents.length) {
      return
    }
    const index = documents.findIndex(document => document.id === this.active.value)
    const next = documents[(Math.max(0, index) + direction + documents.length) % documents.length]
    this.activate(next.id)
  }

  private cycleOrder(direction: number): void {
    if (!this.items.value.length) {
      return
    }
    const index = this.activeIndex < 0
      ? 0
      : (this.activeIndex + direction + this.items.value.length) % this.items.value.length
    this.activate(this.items.value[index].id)
  }

  private moveForPin(document: EditorDocument): void {
    const rest = this.items.value.filter(item => item.id !== document.id)
    const pinned = rest.filter(item => item.pinned)
    const normal = rest.filter(item => !item.pinned)
    this.items.value = [
      ...pinned,
      document,
      ...normal,
    ]
  }

  /** 强制移除文档，并在关闭活动标签时按 MRU 选择回退标签。 */
  private remove(id: string, remember: boolean): boolean {
    const index = this.items.value.findIndex(document => document.id === id)
    if (index < 0) {
      return false
    }
    const document = this.items.value[index]
    if (remember) {
      this.closed.unshift({ ...document })
      this.closed.splice(MAX_CLOSED_EDITORS)
    }
    const next = this.items.value.filter(item => item.id !== id)
    this.items.value = next
    this.mru = this.mru.filter(value => value !== id)
    if (this.active.value === id) {
      this.pruneMru()
      const fallback = this.documentById(this.mru[0]) ?? next[index] ?? next[index - 1]
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
        this.remove(id, false)
      },
    }
  }

  private registerBuiltinDetachHandlers(): void {
    this.registerDetachHandler('welcome', () => ({
      id: 'welcome',
      title: '欢迎',
      icon: 'home',
      component: markRaw(WelcomeView),
      closable: true,
    }))
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
        title: '切换到下一个最近使用的标签页',
        category: '标签页',
        icon: 'arrow-right',
        keybinding: 'Ctrl+Tab',
        run: () => this.next(),
      },
      {
        id: 'editor.previousTab',
        title: '切换到上一个最近使用的标签页',
        category: '标签页',
        icon: 'arrow-left',
        keybinding: 'Ctrl+Shift+Tab',
        run: () => this.previous(),
      },
      {
        id: 'editor.nextTabInOrder',
        title: '切换到右侧标签页',
        category: '标签页',
        icon: 'arrow-right',
        keybinding: 'Ctrl+PageDown',
        run: () => this.nextInOrder(),
      },
      {
        id: 'editor.previousTabInOrder',
        title: '切换到左侧标签页',
        category: '标签页',
        icon: 'arrow-left',
        keybinding: 'Ctrl+PageUp',
        run: () => this.previousInOrder(),
      },
      {
        id: 'editor.closeSaved',
        title: '关闭已保存的标签页',
        category: '标签页',
        icon: 'close-all',
        run: () => this.closeSaved(),
      },
      {
        id: 'editor.reopenClosed',
        title: '重新打开已关闭的标签页',
        category: '标签页',
        icon: 'history',
        keybinding: 'Ctrl+Shift+T',
        run: () => this.reopenClosed(),
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
