<script setup lang="ts">
import { DfSplitLayout } from '@desktop-framework/ui'
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'
import BottomRegion from './BottomRegion.vue'
import DockPanel from './DockPanel.vue'

const ctx = useCordis()
const layout = computed(() => ctx.workbench.layout)

function setSize(size: number): void {
  ctx.workbench.setDockSize('right', size)
}
</script>

<template>
  <DfSplitLayout
    v-if="layout.right.visible"
    split="vertical"
    :size="layout.right.size"
    size-side="end"
    min-start="320px"
    min-end="220px"
    @update:size="setSize"
  >
    <template #start>
      <BottomRegion>
        <slot />
      </BottomRegion>
    </template>
    <template #end>
      <DockPanel location="right" />
    </template>
  </DfSplitLayout>
  <BottomRegion v-else>
    <slot />
  </BottomRegion>
</template>
