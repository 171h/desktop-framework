<script setup lang="ts">
import { useCordis } from '@df/vue'
import { computed, ref } from 'vue'
import FloatingDock from './FloatingDock.vue'

const ctx = useCordis()
const order = ref<string[]>([])
const panels = computed(() => ctx.workbench.docking.floating.filter(panel => ctx.workbench.visibleDockNode(panel.node)))
function focus(id: string): void {
  order.value = [
    ...order.value.filter(value => value !== id && ctx.workbench.docking.floating.some(panel => panel.id === value)),
    id,
  ]
}
</script>

<template>
  <div class="df-floating-docks">
    <FloatingDock v-for="panel in panels" :key="panel.id" :panel="panel" :style="{ zIndex: 30 + order.indexOf(panel.id) }" @pointerdown.capture="focus(panel.id)" />
  </div>
</template>

<style scoped>
.df-floating-docks { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
</style>
