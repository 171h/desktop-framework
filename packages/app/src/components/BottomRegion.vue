<script setup lang="ts">
import { DfSplitLayout } from '@desktop-framework/ui'
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import MainRegion from './MainRegion.vue'

const ctx = useCordis()
const layout = computed(() => ctx.workbench.layout)

function setSize(size: number): void {
  ctx.workbench.setDockSize('bottom', size)
}
</script>

<template>
  <DfSplitLayout
    v-if="layout.bottom.visible"
    split="horizontal"
    :size="layout.bottom.size"
    size-side="end"
    min-start="180px"
    min-end="120px"
    @update:size="setSize"
  >
    <template #start>
      <MainRegion>
        <slot />
      </MainRegion>
    </template>
    <template #end>
      <DockPanel location="bottom" />
    </template>
  </DfSplitLayout>
  <MainRegion v-else>
    <slot />
  </MainRegion>
</template>
