<script setup lang="ts">
import type { VscRibbonTab } from 'nusys-ui'
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  tabs: VscRibbonTab[]
  activeTabId?: string
  collapsed?: boolean
  collapsible?: boolean
}>(), {
  activeTabId: undefined,
  collapsed: false,
  collapsible: true,
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
})

watch(() => props.tabs, syncTabs, { deep: true })
watch(() => props.activeTabId, syncState)
watch(() => props.collapsed, syncState)

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
