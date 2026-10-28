/** 编辑器文档。 */
export interface EditorDocument {
  id: string
  title: string
  icon?: string
  description?: string
  component: object
  dirty?: boolean
  pinned?: boolean
  preview?: boolean
  closable?: boolean
}

/** 打开文档选项。 */
export interface OpenDocumentOptions {
  /** 是否立即激活，默认 true。 */
  activate?: boolean
  /** 插入下标；默认追加到末尾，固定标签页会被放到最前。 */
  index?: number
}
