<script setup lang="ts">
import { computed } from 'vue'
import { dockDragState } from '../dock-drag'

const target = computed(() => dockDragState.target)
const labels = {
  left: '左右并排',
  right: '左右并排',
  top: '上下堆叠',
  bottom: '上下堆叠',
  center: '合并为标签组',
}
const preview = computed(() => target.value
  ? {
      left: `${target.value.preview.x}px`,
      top: `${target.value.preview.y}px`,
      width: `${target.value.preview.width}px`,
      height: `${target.value.preview.height}px`,
    }
  : {})
</script>

<template>
  <div v-if="dockDragState.active" class="df-dock-drop-overlay" aria-hidden="true">
    <div class="df-dock-drop-help">
      拖到面板中心合并标签，四边并排 / 堆叠；窗口边缘停靠 · Ctrl 暂停吸附 · Esc 取消
    </div>
    <div v-if="target" class="df-dock-drop-preview" :style="preview">
      <span>{{ target.edge ? `停靠到${target.edge === 'left' ? '左侧' : target.edge === 'right' ? '右侧' : '底部'}` : labels[target.placement] }}</span>
    </div>
  </div>
</template>

<style scoped>
.df-dock-drop-overlay { position: absolute; inset: 0; z-index: 80; pointer-events: none; }
.df-dock-drop-help { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); padding: 8px 16px; max-width: 80%; border-radius: 5px; color: var(--df-text); background: var(--df-titlebar); font-size: 11px; text-align: center; box-shadow: 0 4px 16px var(--df-shadow); }
.df-dock-drop-preview { position: absolute; display: grid; place-items: center; box-sizing: border-box; border: 2px solid var(--df-accent); border-radius: 4px; background: color-mix(in srgb, var(--df-accent) 18%, transparent); }
.df-dock-drop-preview span { padding: 5px 10px; border-radius: 3px; color: var(--df-text); background: var(--df-titlebar); font-size: 12px; }
</style>
