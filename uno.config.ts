import {
  defineConfig,
  presetAttributify,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

/**
 * 全仓库共用的 UnoCSS 配置。
 *
 * 组件视觉变量来自 `@df/ui/theme.css`，UnoCSS 只负责布局与
 * 间距等原子类，避免主题颜色散落在模板中。
 */
export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  shortcuts: {
    'df-row': 'flex items-center',
    'df-col': 'flex flex-col',
    'df-panel': 'df-col min-h-0 min-w-0 bg-df-surface',
    'df-panel-header': 'h-9 px-3 df-row gap-2 shrink-0 select-none border-b border-df-border text-[11px] font-600 tracking-[0.08em] uppercase text-df-muted',
    'df-scroll': 'overflow-auto min-h-0',
    'df-tool-button': 'h-7 min-w-7 px-2 df-row justify-center gap-1.5 rounded-sm text-xs text-df-muted hover:bg-df-hover hover:text-df-text transition-colors duration-150',
    'df-tool-button-active': 'bg-df-active text-df-text shadow-[inset_0_-2px_0_var(--df-accent)]',
    'df-meta': 'text-[11px] text-df-muted font-mono tabular-nums',
    'df-divider': 'h-px bg-df-border',
  },
  theme: {
    colors: {
      df: {
        canvas: 'var(--df-canvas)',
        surface: 'var(--df-surface)',
        elevated: 'var(--df-elevated)',
        border: 'var(--df-border)',
        text: 'var(--df-text)',
        muted: 'var(--df-muted)',
        accent: 'var(--df-accent)',
        hover: 'var(--df-hover)',
        active: 'var(--df-active)',
        success: 'var(--df-success)',
        warning: 'var(--df-warning)',
        danger: 'var(--df-danger)',
      },
    },
  },
})
