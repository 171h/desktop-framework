<script setup lang="ts">
import type { SidebarId } from '@df/core'
import { clamp } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import DockPanel from './DockPanel.vue'

const props = defineProps<{
  location: SidebarId
}>()

const ctx = useCordis()
const root = ref<HTMLElement>()
const state = computed(() => ctx.workbench.layout[props.location])
const floating = computed(() => state.value.floating)

const style = computed(() => {
  const value = floating.value
  if (!value) {
    return {}
  }
  return {
    left: `${value.x}px`,
    top: `${value.y}px`,
    width: `${value.width}px`,
    height: `${value.height}px`,
  }
})

type ResizeEdge = 'e' | 's' | 'se'

interface ResizeSession {
  edge: ResizeEdge
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
  maxWidth: number
  maxHeight: number
}

let resize: ResizeSession | undefined
let observer: ResizeObserver | undefined

function fitToWorkbench(): void {
  const value = floating.value
  const workbench = root.value?.closest<HTMLElement>('.df-workbench')
  if (!value || !workbench) {
    return
  }
  const rect = workbench.getBoundingClientRect()
  const width = Math.min(value.width, Math.max(240, rect.width - 16))
  const height = Math.min(value.height, Math.max(180, rect.height - 16))
  const x = clamp(value.x, 0, Math.max(0, rect.width - width))
  const y = clamp(value.y, 0, Math.max(0, rect.height - height))
  if (width !== value.width || height !== value.height) {
    ctx.workbench.resizeFloatingDock(props.location, width, height)
  }
  if (x !== value.x || y !== value.y) {
    ctx.workbench.moveFloatingDock(props.location, x, y)
  }
}

function onResizeMove(event: PointerEvent): void {
  if (!resize) {
    return
  }
  const dx = event.clientX - resize.startX
  const dy = event.clientY - resize.startY
  const width = resize.edge === 's'
    ? resize.width
    : clamp(resize.width + dx, 240, Math.max(240, resize.maxWidth))
  const height = resize.edge === 'e'
    ? resize.height
    : clamp(resize.height + dy, 180, Math.max(180, resize.maxHeight))
  ctx.workbench.resizeFloatingDock(props.location, width, height)
}

function stopResize(): void {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
  window.removeEventListener('blur', stopResize)
  document.body.classList.remove('df-dock-resizing')
  resize = undefined
}

function startResize(event: PointerEvent, edge: ResizeEdge): void {
  const value = floating.value
  const workbench = root.value?.closest<HTMLElement>('.df-workbench')
  if (event.button !== 0 || !value || !workbench) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  stopResize()
  const workRect = workbench.getBoundingClientRect()
  resize = {
    edge,
    startX: event.clientX,
    startY: event.clientY,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    maxWidth: Math.max(240, workRect.width - value.x),
    maxHeight: Math.max(180, workRect.height - value.y),
  }
  document.body.classList.add('df-dock-resizing')
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
  window.addEventListener('blur', stopResize)
}

onMounted(async () => {
  await nextTick()
  fitToWorkbench()
  const workbench = root.value?.closest<HTMLElement>('.df-workbench')
  if (workbench) {
    observer = new ResizeObserver(() => fitToWorkbench())
    observer.observe(workbench)
  }
})

onBeforeUnmount(() => {
  stopResize()
  observer?.disconnect()
})
</script>

<template>
  <div
    v-if="floating"
    ref="root"
    class="df-floating-dock"
    role="region"
    :aria-label="location === 'left' ? '浮动左侧栏' : '浮动右侧栏'"
    :style="style"
  >
    <DockPanel :location="location" />
    <span
      class="df-floating-dock__resize df-floating-dock__resize--e"
      @pointerdown="startResize($event, 'e')"
    />
    <span
      class="df-floating-dock__resize df-floating-dock__resize--s"
      @pointerdown="startResize($event, 's')"
    />
    <span
      class="df-floating-dock__resize df-floating-dock__resize--se"
      @pointerdown="startResize($event, 'se')"
    />
  </div>
</template>

<style scoped>
.df-floating-dock {
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--df-border-strong);
  border-radius: 8px;
  background: var(--df-surface);
  box-shadow:
    0 22px 48px var(--df-shadow),
    0 0 0 1px color-mix(in srgb, var(--df-accent) 10%, transparent);
  pointer-events: auto;
}

.df-floating-dock :deep(.df-dock) {
  border-radius: 7px;
}

.df-floating-dock__resize {
  position: absolute;
  z-index: 2;
}

.df-floating-dock__resize--e {
  top: 0;
  right: 0;
  bottom: 10px;
  width: 7px;
  cursor: ew-resize;
}

.df-floating-dock__resize--s {
  right: 10px;
  bottom: 0;
  left: 0;
  height: 7px;
  cursor: ns-resize;
}

.df-floating-dock__resize--se {
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
}

.df-floating-dock__resize--se::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-right: 1px solid var(--df-faint);
  border-bottom: 1px solid var(--df-faint);
  content: '';
}
</style>
