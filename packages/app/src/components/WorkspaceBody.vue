<script setup lang="ts">
import { DfSplitLayout } from '@desktop-framework/ui'
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import RightRegion from './RightRegion.vue'

const ctx = useCordis()
const layout = computed(() => ctx.workbench.layout)

function setSize(size: number): void {
  ctx.workbench.setDockSize('left', size)
}
</script>

<template>
  <DfSplitLayout
    v-if="layout.left.visible"
    split="vertical"
    :size="layout.left.size"
    size-side="start"
    min-start="180px"
    min-end="420px"
    @update:size="setSize"
  >
    <template #start>
      <DockPanel location="left" />
    </template>
    <template #end>
      <RightRegion>
        <slot />
      </RightRegion>
    </template>
  </DfSplitLayout>
  <RightRegion v-else>
    <slot />
  </RightRegion>
</template>
