<script setup lang="ts">
import type { DockEdge } from '@df/core'
import { useCordis } from '@df/vue'

const ctx = useCordis()
const edges: DockEdge[] = ['left', 'right', 'bottom']
</script>

<template>
  <div class="df-hidden-panels" aria-label="隐藏面板恢复按钮">
    <div v-for="edge in edges" :key="edge" class="df-hidden-panels__rail" :class="`df-hidden-panels__rail--${edge}`">
      <vscode-button
        v-for="view in ctx.workbench.hiddenPanels.filter(view => ctx.workbench.panelSide(view.id) === edge)"
        :key="view.id" secondary :icon="view.icon" :title="`恢复 ${view.title}（也可使用 Ctrl/⌘+Alt+P 恢复最近隐藏面板）`"
        :data-restore-panel="view.id" @click="ctx.workbench.openView(view.id)"
      >
        {{ view.title }}
      </vscode-button>
    </div>
  </div>
</template>

<style scoped>
.df-hidden-panels { position: absolute; inset: 0; z-index: 65; pointer-events: none; }
.df-hidden-panels__rail { position: absolute; display: flex; gap: 4px; pointer-events: auto; max-height: calc(100% - 80px); overflow: auto; }
.df-hidden-panels__rail--left { left: 4px; top: 40px; flex-direction: column; }
.df-hidden-panels__rail--right { right: 4px; top: 40px; flex-direction: column; }
.df-hidden-panels__rail--bottom { bottom: 4px; left: 50%; transform: translateX(-50%); max-width: 80%; }
vscode-button { font-size: 10px; opacity: 0.92; }
</style>
