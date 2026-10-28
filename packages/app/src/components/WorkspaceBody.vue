<script setup lang="ts">
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import { computed } from 'vue'
import DockNodeView from './DockNodeView.vue'
import RightRegion from './RightRegion.vue'

const ctx = useCordis()
const left = computed(() => ctx.workbench.visibleDockNode(ctx.workbench.docking.roots.left))
const right = computed(() => ctx.workbench.visibleDockNode(ctx.workbench.docking.roots.right))
</script>

<template>
  <DfSplitLayout v-if="left" :size="ctx.workbench.layout.left.size" min-start="180px" min-end="320px" @update:size="ctx.workbench.setDockSize('left', $event)">
    <template #start>
      <DockNodeView :node="left" />
    </template>
    <template #end>
      <RightRegion :node="right">
        <slot />
      </RightRegion>
    </template>
  </DfSplitLayout>
  <RightRegion v-else :node="right">
    <slot />
  </RightRegion>
</template>
