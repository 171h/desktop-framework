<script setup lang="ts">
import type { FloatingPanel } from '@df/core'
import { clamp } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DockNodeView from './DockNodeView.vue'

const props = defineProps<{ panel: FloatingPanel }>()
const ctx = useCordis()
const root = ref<HTMLElement>()
const style = computed(() => ({
  left: `${props.panel.geometry.x}px`,
  top: `${props.panel.geometry.y}px`,
  width: `${props.panel.geometry.width}px`,
  height: `${props.panel.geometry.height}px`,
}))
const edges = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
] as const
type Edge = typeof edges[number]
let observer: ResizeObserver | undefined
let stop: (() => void) | undefined

function fit(): void {
  const bounds = root.value?.closest('.df-workbench')?.getBoundingClientRect()
  if (!bounds)
    return
  const value = props.panel.geometry
  const width = Math.min(value.width, Math.max(200, bounds.width - 8))
  const height = Math.min(value.height, Math.max(140, bounds.height - 8))
  const x = clamp(value.x, 0, Math.max(0, bounds.width - width))
  const y = clamp(value.y, 0, Math.max(0, bounds.height - height))
  if (x !== value.x || y !== value.y || width !== value.width || height !== value.height)
    ctx.workbench.setFloatingGeometry(props.panel.id, { x, y, width, height })
}

function resize(event: PointerEvent, edge: Edge): void {
  if (event.button !== 0)
    return
  const bounds = root.value?.closest('.df-workbench')?.getBoundingClientRect()
  if (!bounds)
    return
  event.preventDefault()
  event.stopPropagation()
  stop?.()
  const original = { ...props.panel.geometry }
  const start = { x: event.clientX, y: event.clientY }
  const move = (current: PointerEvent): void => {
    if (current.pointerId !== event.pointerId)
      return
    const dx = current.clientX - start.x
    const dy = current.clientY - start.y
    const value = { ...original }
    if (edge.includes('e'))
      value.width = clamp(original.width + dx, 200, bounds.width - original.x)
    if (edge.includes('s'))
      value.height = clamp(original.height + dy, 140, bounds.height - original.y)
    if (edge.includes('w')) {
      value.x = clamp(original.x + dx, 0, original.x + original.width - 200)
      value.width = original.x + original.width - value.x
    }
    if (edge.includes('n')) {
      value.y = clamp(original.y + dy, 0, original.y + original.height - 140)
      value.height = original.y + original.height - value.y
    }
    ctx.workbench.setFloatingGeometry(props.panel.id, value)
  }
  stop = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop!)
    window.removeEventListener('pointercancel', stop!)
    window.removeEventListener('blur', stop!)
    document.body.classList.remove('df-dock-resizing')
    stop = undefined
  }
  document.body.classList.add('df-dock-resizing')
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
  window.addEventListener('blur', stop)
}
onMounted(() => {
  fit()
  const workbench = root.value?.closest('.df-workbench')
  observer = new ResizeObserver(fit)
  if (workbench)
    observer.observe(workbench)
})
onBeforeUnmount(() => {
  stop?.()
  observer?.disconnect()
})
</script>

<template>
  <div ref="root" class="df-floating-dock" :data-floating-id="panel.id" :style="style" role="region" aria-label="浮动面板">
    <DockNodeView :node="panel.node" />
    <span v-for="edge in edges" :key="edge" class="df-floating-dock__resize" :class="`df-floating-dock__resize--${edge}`" @pointerdown="resize($event, edge)" />
  </div>
</template>

<style scoped>
.df-floating-dock { position: absolute; min-width: 0; min-height: 0; border: 1px solid var(--df-border-strong); border-radius: 6px; overflow: hidden; background: var(--df-surface); box-shadow: 0 16px 40px var(--df-shadow); pointer-events: auto; }
.df-floating-dock__resize { position: absolute; z-index: 4; touch-action: none; }
.df-floating-dock__resize--e, .df-floating-dock__resize--w { top: 8px; bottom: 8px; width: 5px; cursor: ew-resize; }
.df-floating-dock__resize--e { right: 0; }
.df-floating-dock__resize--w { left: 0; }
.df-floating-dock__resize--n, .df-floating-dock__resize--s { left: 8px; right: 8px; height: 5px; cursor: ns-resize; }
.df-floating-dock__resize--n { top: 0; }
.df-floating-dock__resize--s { bottom: 0; }
.df-floating-dock__resize--ne, .df-floating-dock__resize--nw, .df-floating-dock__resize--se, .df-floating-dock__resize--sw { width: 9px; height: 9px; }
.df-floating-dock__resize--ne { top: 0; right: 0; cursor: nesw-resize; }
.df-floating-dock__resize--nw { top: 0; left: 0; cursor: nwse-resize; }
.df-floating-dock__resize--se { bottom: 0; right: 0; cursor: nwse-resize; }
.df-floating-dock__resize--sw { bottom: 0; left: 0; cursor: nesw-resize; }
</style>
