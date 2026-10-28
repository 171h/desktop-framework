<script setup lang="ts">
import { useCordis } from '@df/vue'
import { computed, nextTick, ref } from 'vue'

const ctx = useCordis()
const list = ref<HTMLElement>()
const tabs = computed(() => ctx.ribbon.tabs)
const collapsed = computed(() => ctx.workbench.layout.ribbonCollapsed)

function select(tabId: string): void {
  ctx.ribbon.setActiveTab(tabId)
  if (collapsed.value) {
    ctx.workbench.store.setRibbonCollapsed(false)
  }
}

function onKeydown(event: KeyboardEvent, index: number): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
    return
  }
  event.preventDefault()
  const items = tabs.value
  if (items.length === 0) {
    return
  }
  let next = index
  if (event.key === 'ArrowLeft') {
    next = (index - 1 + items.length) % items.length
  }
  else if (event.key === 'ArrowRight') {
    next = (index + 1) % items.length
  }
  else if (event.key === 'Home') {
    next = 0
  }
  else {
    next = items.length - 1
  }
  select(items[next].id)
  void nextTick(() => {
    const headers = list.value?.querySelectorAll<HTMLElement>('vscode-tab-header')
    headers?.[next]?.focus()
  })
}

function toggleCollapse(): void {
  ctx.workbench.store.setRibbonCollapsed(!collapsed.value)
}

function moveToSeparate(): void {
  ctx.ribbon.setTabPlacement('separate')
}

function onWheel(event: WheelEvent): void {
  const element = list.value
  if (!element || element.scrollWidth <= element.clientWidth) {
    return
  }
  element.scrollLeft += event.deltaY || event.deltaX
  event.preventDefault()
}
</script>

<template>
  <div class="df-ribbon-title-tabs" role="presentation">
    <div
      ref="list"
      class="df-ribbon-title-tabs__list"
      role="tablist"
      aria-label="功能区标签"
      @wheel="onWheel"
    >
      <vscode-tab-header
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :active="tab.id === ctx.ribbon.activeTabId"
        :title="tab.title"
        @click="select(tab.id)"
        @keydown="onKeydown($event, index)"
      >
        {{ tab.title }}
      </vscode-tab-header>
    </div>
    <vscode-toolbar-container class="df-ribbon-title-tabs__actions" aria-label="功能区操作">
      <vscode-toolbar-button
        icon="arrow-down"
        label="将功能区标签移到独立一行"
        @click="moveToSeparate"
      />
      <vscode-toolbar-button
        :icon="collapsed ? 'chevron-down' : 'chevron-up'"
        :label="collapsed ? '展开功能区' : '折叠功能区'"
        @click="toggleCollapse"
      />
    </vscode-toolbar-container>
  </div>
</template>

<style scoped>
.df-ribbon-title-tabs {
  display: flex;
  flex: 0 1 auto;
  align-items: stretch;
  gap: 2px;
  width: auto;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  -webkit-app-region: no-drag;
}

.df-ribbon-title-tabs__list {
  display: flex;
  flex: 1;
  align-items: stretch;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.df-ribbon-title-tabs__list::-webkit-scrollbar {
  display: none;
}

.df-ribbon-title-tabs__list :deep(vscode-tab-header) {
  flex: 0 0 auto;
  max-width: 150px;
  padding: 0 2px;
  color: var(--df-muted);
  font-size: 10.5px;
  --vsc-tab-header-height: 23px;
  --vscode-panelTitle-activeForeground: var(--df-text);
  --vscode-panelTitle-inactiveForeground: var(--df-muted);
  --vscode-panelTitle-activeBorder: var(--df-accent);
}

.df-ribbon-title-tabs__list :deep(vscode-tab-header:hover) {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-ribbon-title-tabs__list :deep(vscode-tab-header[active]) {
  background: color-mix(in srgb, var(--df-surface) 55%, transparent);
  box-shadow: inset 0 -2px 0 var(--df-accent);
  color: var(--df-text);
}

.df-ribbon-title-tabs__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding-right: 4px;
}
</style>
