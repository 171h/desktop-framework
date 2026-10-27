<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  split?: 'vertical' | 'horizontal'
  size: number
  sizeSide?: 'start' | 'end'
  minStart?: string
  minEnd?: string
  resetOnDblClick?: boolean
}>(), {
  split: 'vertical',
  sizeSide: 'start',
  minStart: '180px',
  minEnd: '120px',
  resetOnDblClick: true,
})

const emit = defineEmits<{
  'update:size': [size: number]
}>()

const container = ref<HTMLElement>()
const layout = ref<HTMLElement & {
  handlePosition: string
}>()
let observer: ResizeObserver | undefined
let containerSize = 0

function measure(): number {
  const element = container.value
  if (!element) {
    return 0
  }
  return props.split === 'vertical'
    ? element.clientWidth
    : element.clientHeight
}

function applyPosition(): void {
  if (!layout.value) {
    return
  }
  containerSize = measure()
  if (containerSize <= 0) {
    return
  }
  const handle = props.sizeSide === 'start'
    ? props.size
    : containerSize - props.size
  layout.value.handlePosition = `${Math.max(0, Math.min(handle, containerSize))}px`
}

function onResize(): void {
  applyPosition()
}

function onLayoutChange(event: Event): void {
  const detail = (event as CustomEvent<{ position: number }>).detail
  containerSize = measure() || containerSize
  const next = props.sizeSide === 'start'
    ? detail.position
    : containerSize - detail.position
  emit('update:size', Math.round(next))
}

onMounted(async () => {
  await nextTick()
  applyPosition()
  observer = new ResizeObserver(() => onResize())
  if (container.value) {
    observer.observe(container.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

watch(() => props.size, applyPosition)
watch(() => props.split, () => nextTick(applyPosition))
</script>

<template>
  <div ref="container" class="df-split-layout">
    <vscode-split-layout
      ref="layout"
      :split="split"
      :fixed-pane="sizeSide"
      :min-start="minStart"
      :min-end="minEnd"
      :reset-on-dbl-click="resetOnDblClick"
      handle-size="4"
      @vsc-split-layout-change="onLayoutChange"
    >
      <div slot="start" class="df-split-layout__pane df-split-layout__pane--start">
        <slot name="start" />
      </div>
      <div slot="end" class="df-split-layout__pane df-split-layout__pane--end">
        <slot name="end" />
      </div>
    </vscode-split-layout>
  </div>
</template>

<style scoped>
.df-split-layout {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

vscode-split-layout {
  width: 100%;
  height: 100%;
}

.df-split-layout__pane {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
