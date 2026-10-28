<script setup lang="ts">
import DfRibbon from '@desktop-framework/ui/components/DfRibbon.vue'
import { useCordis } from '@desktop-framework/vue'
import { watch } from 'vue'

const ctx = useCordis()

watch(
  () => ctx.ribbon.tabs,
  () => ctx.ribbon.ensureActiveTab(),
  { immediate: true },
)

function onCommand(detail: { command?: string, arguments?: readonly unknown[] }): void {
  if (detail.command) {
    void ctx.ribbon.execute(detail.command, detail.arguments ?? [])
  }
}

function onSelect(tabId: string): void {
  ctx.ribbon.setActiveTab(tabId)
}

function onCollapse(collapsed: boolean): void {
  ctx.workbench.store.setRibbonCollapsed(collapsed)
}
</script>

<template>
  <DfRibbon
    :tabs="ctx.ribbon.tabs"
    :active-tab-id="ctx.ribbon.activeTabId"
    :collapsed="ctx.workbench.layout.ribbonCollapsed"
    :hide-tabs="ctx.ribbon.tabPlacement === 'titlebar'"
    @command="onCommand"
    @select="onSelect"
    @collapse="onCollapse"
  />
</template>
