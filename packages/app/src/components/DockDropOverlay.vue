<script setup lang="ts">
import { dockDragState } from '../dock-drag'
</script>

<template>
  <div v-if="dockDragState.active" class="df-dock-drop-overlay" aria-hidden="true">
    <div
      class="df-dock-drop-zone df-dock-drop-zone--left"
      :class="{ 'is-active': dockDragState.hint === 'left' }"
    >
      <vscode-icon name="layout-sidebar-left-dock" />
      <span>停靠到左侧</span>
    </div>
    <div
      class="df-dock-drop-zone df-dock-drop-zone--right"
      :class="{ 'is-active': dockDragState.hint === 'right' }"
    >
      <vscode-icon name="layout-sidebar-right-dock" />
      <span>停靠到右侧</span>
    </div>
  </div>
</template>

<style scoped>
.df-dock-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 80;
  pointer-events: none;
}

.df-dock-drop-zone {
  position: absolute;
  top: 8px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 58px;
  border: 1px dashed color-mix(in srgb, var(--df-accent) 38%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--df-accent) 6%, transparent);
  color: var(--df-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease;
}

.df-dock-drop-zone--left {
  left: 8px;
}

.df-dock-drop-zone--right {
  right: 8px;
}

.df-dock-drop-zone.is-active {
  border-color: var(--df-accent);
  background: color-mix(in srgb, var(--df-accent) 18%, transparent);
  color: var(--df-text);
}
</style>
