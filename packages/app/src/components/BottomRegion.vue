<script setup lang="ts">
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import { computed } from 'vue'
import DockNodeView from './DockNodeView.vue'
import MainRegion from './MainRegion.vue'

const ctx = useCordis()
const node = computed(() => ctx.workbench.visibleDockNode(ctx.workbench.docking.roots.bottom))
</script>

<template>
  <DfSplitLayout v-if="node" split="horizontal" :size="ctx.workbench.layout.bottom.size" size-side="end" min-start="180px" min-end="100px" @update:size="ctx.workbench.setDockSize('bottom', $event)">
    <template #start>
      <MainRegion><slot /></MainRegion>
    </template>
    <template #end>
      <DockNodeView :node="node" />
    </template>
  </DfSplitLayout>
  <MainRegion v-else>
    <slot />
  </MainRegion>
</template>
