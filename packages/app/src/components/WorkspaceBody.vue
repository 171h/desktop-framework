<script setup lang="ts">
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import RightRegion from './RightRegion.vue'

const ctx = useCordis()
const leftGroup = computed(() => ctx.workbench.dockedSidebar('left'))
const rightGroup = computed(() => ctx.workbench.dockedSidebar('right'))
const leftSize = computed(() => leftGroup.value
  ? ctx.workbench.layout[leftGroup.value].size
  : 0)

function setSize(size: number): void {
  if (leftGroup.value) {
    ctx.workbench.setDockSize(leftGroup.value, size)
  }
}
</script>

<template>
  <DfSplitLayout
    v-if="leftGroup"
    split="vertical"
    :size="leftSize"
    size-side="start"
    min-start="180px"
    min-end="420px"
    @update:size="setSize"
  >
    <template #start>
      <DockPanel :location="leftGroup" />
    </template>
    <template #end>
      <RightRegion :group="rightGroup">
        <slot />
      </RightRegion>
    </template>
  </DfSplitLayout>
  <RightRegion v-else :group="rightGroup">
    <slot />
  </RightRegion>
</template>
