/** 编辑器文档。 */
export interface EditorDocument {
  id: string
  title: string
  icon?: string
  description?: string
  component: object
  dirty?: boolean
  /** 固定的标签页；固定在非固定标签页左侧。 */
  pinned?: boolean
  /** 预览标签页；同一时间最多一个，打开新预览会替换它。 */
  preview?: boolean
  closable?: boolean
  /**
   * 在独立窗口重建文档时使用的恢复键。
   * 插件可通过 `ctx.editor.registerDetachHandler()` 注册对应恢复逻辑。
   */
  detachKey?: string
  /** 提供拖出到独立窗口时需要携带的可序列化状态。 */
  getDetachState?: () => unknown
}

/** 打开文档选项。 */
export interface OpenDocumentOptions {
  /** 是否立即激活，默认 true。 */
  activate?: boolean
  /** 插入下标；默认追加到末尾，固定标签页会被放到固定区末尾。 */
  index?: number
  /** 以预览标签页打开；默认沿用文档自身的 `preview`。 */
  preview?: boolean
  /** 以固定标签页打开；默认沿用文档自身的 `pinned`。 */
  pinned?: boolean
}

/** 拖出到独立窗口时传递给新窗口的文档描述。 */
export interface DetachedEditorPayload {
  id: string
  title: string
  icon?: string
  detachKey: string
  state?: unknown
}

/** 独立窗口恢复文档的回调；返回文档或直接激活已有文档。 */
export type EditorDetachHandler = (state: unknown) => EditorDocument | void
