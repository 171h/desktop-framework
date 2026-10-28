<script setup lang="ts">
import type { DockNode } from '@df/core'
import { DfSplitLayout } from '@df/ui'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DockPanel from './DockPanel.vue'

const props = defineProps<{ node: DockNode }>()
const ctx = useCordis()
const root = ref<HTMLElement>()
const node = computed(() => ctx.workbench.visibleDockNode(props.node))
const extent = ref(0)
let observer: ResizeObserver | undefined
function measure(): void {
  extent.value = node.value?.type === 'split' && node.value.orientation === 'horizontal'
    ? root.value?.clientWidth ?? 0
    : root.value?.clientHeight ?? 0
}
function resize(size: number): void {
  measure()
  if (node.value?.type === 'split' && extent.value > 0)
    ctx.workbench.setPanelRatio(node.value.id, size / extent.value)
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (root.value)
    observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => node.value?.type === 'split'
  ? node.value.orientation
  : undefined, () => nextTick(measure))
</script>

<template>
  <div v-if="node" ref="root" class="df-dock-tree">
    <DockPanel v-if="node.type === 'group'" :group="node" />
    <DfSplitLayout
      v-else :split="node.orientation === 'horizontal' ? 'vertical' : 'horizontal'"
      :size="extent * node.ratio" min-start="100px" min-end="100px"
      :reset-on-dbl-click="false" @update:size="resize"
    >
      <template #start>
        <DockNodeView :node="node.children[0]" />
      </template>
      <template #end>
        <DockNodeView :node="node.children[1]" />
      </template>
    </DfSplitLayout>
  </div>
</template>

<style scoped>
.df-dock-tree { width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
</style>
