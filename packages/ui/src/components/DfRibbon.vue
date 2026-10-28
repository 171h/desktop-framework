<script setup lang="ts">
import type { VscRibbonTab } from 'nusys-ui'
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  tabs: VscRibbonTab[]
  activeTabId?: string
  collapsed?: boolean
  collapsible?: boolean
  /** 由外部标题栏渲染页签时，隐藏组件内置页签栏。 */
  hideTabs?: boolean
}>(), {
  activeTabId: undefined,
  collapsed: false,
  collapsible: true,
  hideTabs: false,
})

const emit = defineEmits<{
  command: [detail: { command?: string, arguments?: readonly unknown[], tabId: string }]
  select: [tabId: string]
  collapse: [collapsed: boolean]
  dialog: [detail: { tabId: string, groupId: string }]
}>()

const el = ref<HTMLElement & {
  tabs: VscRibbonTab[]
  activeTabId: string
  collapsed: boolean
}>()

const HIDE_TABS_STYLE_ID = 'df-ribbon-hide-tabs'

/**
 * nusys-ui 的 `vscode-ribbon` 尚未开放“隐藏页签栏”属性。这里在它的开放
 * Shadow DOM 中注入一条最小样式：外部标题栏渲染页签时，内置页签栏仍保留
 * 在 DOM 中供组件内部状态同步，但不占布局空间。
 */
function syncTabsVisibility(): void {
  const root = el.value?.shadowRoot
  if (!root) {
    return
  }
  const existing = root.querySelector<HTMLStyleElement>(`#${HIDE_TABS_STYLE_ID}`)
  if (!props.hideTabs) {
    existing?.remove()
    return
  }
  if (existing) {
    return
  }
  const style = document.createElement('style')
  style.id = HIDE_TABS_STYLE_ID
  style.textContent = `
    .ribbon-tabs { display: none !important; }
    .ribbon-content.is-overlay { top: 0 !important; }
  `
  root.append(style)
}

function syncTabs(): void {
  if (el.value && el.value.tabs !== props.tabs) {
    el.value.tabs = props.tabs
  }
}

function syncState(): void {
  if (!el.value) {
    return
  }
  if (props.activeTabId) {
    el.value.activeTabId = props.activeTabId
  }
  el.value.collapsed = props.collapsed
}

onMounted(() => {
  syncTabs()
  syncState()
  void nextTick(syncTabsVisibility)
})

watch(() => props.tabs, syncTabs, { deep: true })
watch(() => props.activeTabId, syncState)
watch(() => props.collapsed, syncState)
watch(() => props.hideTabs, () => {
  void nextTick(syncTabsVisibility)
})

function onCommand(event: Event): void {
  const detail = (event as CustomEvent<{ command?: string, arguments?: readonly unknown[], tabId: string }>).detail
  emit('command', detail)
}

function onSelect(event: Event): void {
  const detail = (event as CustomEvent<{ tabId: string }>).detail
  emit('select', detail.tabId)
}

function onCollapse(event: Event): void {
  const detail = (event as CustomEvent<{ collapsed: boolean }>).detail
  emit('collapse', detail.collapsed)
}

function onDialog(event: Event): void {
  const detail = (event as CustomEvent<{ tabId: string, groupId: string }>).detail
  emit('dialog', detail)
}
</script>

<template>
  <vscode-ribbon
    ref="el"
    class="df-ribbon"
    tablist-label="功能区"
    :collapsible="collapsible"
    @vsc-ribbon-command="onCommand"
    @vsc-ribbon-select="onSelect"
    @vsc-ribbon-collapse="onCollapse"
    @vsc-ribbon-dialog="onDialog"
  >
    <slot slot="tabs-start" name="tabs-start" />
    <slot slot="tabs-end" name="tabs-end" />
  </vscode-ribbon>
</template>

<style scoped>
.df-ribbon {
  --vscode-editor-background: var(--df-surface);
  --vscode-panel-border: var(--df-border);
  --vscode-foreground: var(--df-text);
  --vscode-descriptionForeground: var(--df-muted);
  --vscode-focusBorder: var(--df-accent);
  --vscode-toolbar-hoverBackground: var(--df-hover);
  display: block;
  width: 100%;
  min-width: 0;
}
</style>
