// nusys-ui 的 Custom Element 属性以 JS 属性传递，Vue 不需要把它们当组件解析。
export interface UiSlotContribution {
  id: string
  slot: string
  component: object
  props?: Record<string, unknown>
  order?: number
}

export interface PromptOptions {
  title: string
  message?: string
  placeholder?: string
  value?: string
  confirmLabel?: string
  cancelLabel?: string
}

export interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void
}
