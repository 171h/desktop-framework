<script setup lang="ts">
import type { SidebarId } from '@df/core'
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import { computed } from 'vue'
import BottomRegion from './BottomRegion.vue'
import DockPanel from './DockPanel.vue'

const props = defineProps<{
  group?: SidebarId
}>()

const ctx = useCordis()
const dock = computed(() => props.group
  ? ctx.workbench.layout[props.group]
  : undefined)

function setSize(size: number): void {
  if (props.group) {
    ctx.workbench.setDockSize(props.group, size)
  }
}
</script>

<template>
  <DfSplitLayout
    v-if="props.group && dock"
    split="vertical"
    :size="dock.size"
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
      <DockPanel :location="props.group" />
    </template>
  </DfSplitLayout>
  <BottomRegion v-else>
    <slot />
  </BottomRegion>
</template>
