<script setup lang="ts">
import type { SidebarId } from '@desktop-framework/core'
import { useCordis } from '@desktop-framework/vue'
import { computed, ref } from 'vue'
import FloatingDock from './FloatingDock.vue'

const ctx = useCordis()
const order = ref<SidebarId[]>(['left', 'right'])
const floating = computed(() => (['left', 'right'] as const).filter((location) => {
  const dock = ctx.workbench.layout[location]
  return dock.visible && Boolean(dock.floating)
}))

function bringToFront(location: SidebarId): void {
  order.value = [
    ...order.value.filter(item => item !== location),
    location,
  ]
}
</script>

<template>
  <div class="df-floating-docks">
    <FloatingDock
      v-for="location in floating"
      :key="location"
      :location="location"
      :style="{ zIndex: 30 + order.indexOf(location) }"
      @pointerdown.capture="bringToFront(location)"
    />
  </div>
</template>

<style scoped>
.df-floating-docks {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}
</style>
