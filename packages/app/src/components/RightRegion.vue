<script setup lang="ts">
import type { DockNode } from '@df/core'
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import BottomRegion from './BottomRegion.vue'
import DockNodeView from './DockNodeView.vue'

defineProps<{ node: DockNode | null }>()
const ctx = useCordis()
</script>

<template>
  <DfSplitLayout v-if="node" :size="ctx.workbench.layout.right.size" size-side="end" min-start="320px" min-end="180px" @update:size="ctx.workbench.setDockSize('right', $event)">
    <template #start>
      <BottomRegion><slot /></BottomRegion>
    </template>
    <template #end>
      <DockNodeView :node="node" />
    </template>
  </DfSplitLayout>
  <BottomRegion v-else>
    <slot />
  </BottomRegion>
</template>
