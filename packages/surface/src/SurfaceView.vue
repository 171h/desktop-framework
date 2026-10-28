<script setup lang="ts">
import type { SurfaceNode } from './service'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { GridRenderer } from './renderer'

const ctx = useCordis()
const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const size = reactive({ width: 0, height: 0, dpr: 1 })
const rendererStatus = ref<'webgl2' | 'unavailable'>('unavailable')

let renderer: GridRenderer | undefined
let observer: ResizeObserver | undefined
let frame = 0
let panning = false
let lastX = 0
let lastY = 0
let drag: {
  id: string
  startX: number
  startY: number
  nodeX: number
  nodeY: number
  pointerId: number
  moved: boolean
} | undefined

const camera = computed(() => ctx.surface.camera)
const zoom = computed(() => camera.value.zoom)
const selectedId = computed(() => ctx.surface.selected.value?.id)
const screenNodes = computed(() => {
  return ctx.surface.nodes.map(node => ({
    node,
    left: size.width / 2 + node.x * zoom.value + camera.value.x,
    top: size.height / 2 + node.y * zoom.value + camera.value.y,
  }))
})

const connectors = computed(() => {
  const byId = new Map(ctx.surface.nodes.map(node => [node.id, node]))
  return ctx.surface.links
    .map((connection) => {
      const from = byId.get(connection.from)
      const to = byId.get(connection.to)
      if (!from || !to) {
        return undefined
      }
      const center = (node: SurfaceNode): { x: number, y: number } => ({
        x: size.width / 2 + (node.x + node.width / 2) * zoom.value + camera.value.x,
        y: size.height / 2 + (node.y + node.height / 2) * zoom.value + camera.value.y,
      })
      return {
        id: `${connection.from}-${connection.to}`,
        from: center(from),
        to: center(to),
        selected: selectedId.value === connection.from || selectedId.value === connection.to,
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
})

function nodeTransform(node: SurfaceNode): Record<string, string> {
  const left = size.width / 2 + node.x * zoom.value + camera.value.x
  const top = size.height / 2 + node.y * zoom.value + camera.value.y
  return {
    transform: `translate3d(${left}px, ${top}px, 0) scale(${zoom.value})`,
    width: `${node.width}px`,
    height: `${node.height}px`,
  }
}

function requestRender(): void {
  if (frame) {
    return
  }
  frame = requestAnimationFrame(() => {
    frame = 0
    if (!renderer) {
      return
    }
    const metrics = renderer.render(ctx.surface.camera)
    rendererStatus.value = metrics.renderer
    ctx.surface.setStats(metrics)
  })
}

function resize(): void {
  const element = root.value
  if (!element) {
    return
  }
  size.width = element.clientWidth
  size.height = element.clientHeight
  size.dpr = Math.min(window.devicePixelRatio || 1, 2)
  ctx.surface.setViewport(size.width, size.height, size.dpr)
  renderer?.resize(size.width, size.height, size.dpr)
  requestRender()
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || (event.target as HTMLElement).closest('.surface-node')) {
    return
  }
  panning = true
  lastX = event.clientX
  lastY = event.clientY
  root.value?.setPointerCapture(event.pointerId)
  root.value?.classList.add('is-panning')
}

function onPointerMove(event: PointerEvent): void {
  if (!panning) {
    return
  }
  ctx.surface.panBy(event.clientX - lastX, event.clientY - lastY)
  lastX = event.clientX
  lastY = event.clientY
  requestRender()
}

function onPointerUp(event: PointerEvent): void {
  if (!panning) {
    return
  }
  panning = false
  root.value?.releasePointerCapture(event.pointerId)
  root.value?.classList.remove('is-panning')
}

function onWheel(event: WheelEvent): void {
  const element = root.value
  if (!element) {
    return
  }
  const rect = element.getBoundingClientRect()
  const factor = event.deltaY < 0
    ? 1.12
    : 1 / 1.12
  ctx.surface.zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor)
  requestRender()
}

function startNodeDrag(event: PointerEvent, node: SurfaceNode): void {
  event.stopPropagation()
  ctx.surface.selectNode(node.id)
  if (event.button !== 0) {
    return
  }
  drag = {
    id: node.id,
    startX: event.clientX,
    startY: event.clientY,
    nodeX: node.x,
    nodeY: node.y,
    pointerId: event.pointerId,
    moved: false,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveNode(event: PointerEvent): void {
  if (!drag) {
    return
  }
  event.stopPropagation()
  const dx = (event.clientX - drag.startX) / zoom.value
  const dy = (event.clientY - drag.startY) / zoom.value
  if (Math.abs(dx) + Math.abs(dy) > 1) {
    drag.moved = true
  }
  ctx.surface.moveNode(drag.id, drag.nodeX + dx, drag.nodeY + dy)
}

function endNodeDrag(event: PointerEvent): void {
  if (!drag) {
    return
  }
  ;(event.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId)
  drag = undefined
}

function execute(command: string): void {
  void ctx.commands.execute(command).catch(() => {})
}

onMounted(async () => {
  await nextTick()
  resize()
  observer = new ResizeObserver(() => resize())
  if (root.value) {
    observer.observe(root.value)
  }
  if (canvas.value) {
    renderer = new GridRenderer(canvas.value)
    const available = renderer.init()
    rendererStatus.value = available ? 'webgl2' : 'unavailable'
    renderer.resize(size.width, size.height, size.dpr)
    requestRender()
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (frame) {
    cancelAnimationFrame(frame)
  }
  renderer?.dispose()
})

watch(() => ctx.surface.camera, requestRender, { deep: true })
</script>

<template>
  <section
    ref="root"
    class="surface"
    :class="{ 'is-fallback': rendererStatus === 'unavailable' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
    @dblclick="ctx.surface.fitView()"
  >
    <canvas ref="canvas" class="surface__grid" aria-hidden="true" />

    <svg class="surface__links" aria-hidden="true">
      <line
        v-for="line in connectors"
        :key="line.id"
        :x1="line.from.x"
        :y1="line.from.y"
        :x2="line.to.x"
        :y2="line.to.y"
        :class="{ 'is-selected': line.selected }"
      />
    </svg>

    <div class="surface__nodes">
      <article
        v-for="entry in screenNodes"
        :key="entry.node.id"
        class="surface-node"
        :class="{ 'is-selected': selectedId === entry.node.id, 'is-dimmed': zoom < 0.55 }"
        :data-tone="entry.node.tone"
        :style="nodeTransform(entry.node)"
        @pointerdown="startNodeDrag($event, entry.node)"
        @pointermove="moveNode"
        @pointerup="endNodeDrag"
        @pointercancel="endNodeDrag"
      >
        <header class="surface-node__header">
          <span class="surface-node__dot" />
          <span class="surface-node__category">{{ entry.node.category }}</span>
          <span class="surface-node__id">{{ entry.node.id }}</span>
        </header>
        <h3 class="surface-node__title">
          {{ entry.node.title }}
        </h3>
        <p v-if="entry.node.subtitle" class="surface-node__subtitle">
          {{ entry.node.subtitle }}
        </p>
        <footer class="surface-node__footer">
          <span>{{ entry.node.meta?.module ?? 'plugin' }}</span>
          <span>{{ entry.node.width }} × {{ entry.node.height }}</span>
        </footer>
      </article>
    </div>

    <div class="surface__heading">
      <span class="surface__eyebrow">SURFACE / {{ ctx.workbench.activeWorkspace.name }}</span>
      <h2>工作流画布</h2>
      <p>拖动空白处平移 · 滚轮缩放 · 拖动卡片调整布局 · 双击自动适配</p>
    </div>

    <div class="surface__toolbar">
      <vscode-toolbar-container aria-label="画布工具">
        <vscode-toolbar-button icon="add" label="添加卡片" @click="execute('surface.addNode')" />
        <vscode-toolbar-button icon="screen-full" label="适应全部内容" @click="execute('surface.fitView')" />
        <vscode-toolbar-button icon="home" label="重置视图" @click="execute('surface.resetView')" />
        <span class="surface__toolbar-divider" />
        <vscode-toolbar-button icon="zoom-in" label="放大" @click="execute('surface.zoomIn')" />
        <vscode-toolbar-button icon="zoom-out" label="缩小" @click="execute('surface.zoomOut')" />
        <vscode-toolbar-button
          icon="trash"
          label="删除选中卡片"
          :disabled="!ctx.surface.selected.value"
          @click="execute('surface.deleteNode')"
        />
      </vscode-toolbar-container>
    </div>

    <div class="surface__hud">
      <span class="surface__badge" :class="{ 'is-warn': rendererStatus === 'unavailable' }">
        <vscode-icon :name="rendererStatus === 'webgl2' ? 'zap' : 'warning'" />
        {{ rendererStatus === 'webgl2' ? 'WEBGL2' : 'FALLBACK' }}
      </span>
      <span>{{ Math.round(zoom * 100) }}%</span>
      <span>{{ ctx.surface.nodes.length }} 卡片</span>
      <span>{{ ctx.surface.stats.frameMs.toFixed(2) }} ms</span>
      <span>{{ ctx.surface.stats.drawCalls }} draw</span>
      <span>{{ size.width }} × {{ size.height }}</span>
    </div>

    <div class="surface__selection">
      <vscode-icon name="target" />
      <span>{{ ctx.surface.selected.value?.title ?? '未选择对象' }}</span>
    </div>
  </section>
</template>

<style scoped>
.surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--df-canvas);
  touch-action: none;
  user-select: none;
}

.surface.is-panning {
  cursor: grabbing;
}

.surface__grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.surface.is-fallback {
  background-image:
    linear-gradient(rgb(255 255 255 / 4%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 4%) 1px, transparent 1px),
    radial-gradient(circle at 50% 42%, rgb(226 162 68 / 8%), transparent 60%);
  background-size: 32px 32px, 32px 32px, 100% 100%;
}

.surface__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.surface__links line {
  stroke: color-mix(in srgb, var(--df-border-strong) 72%, transparent);
  stroke-width: 1.2;
  stroke-dasharray: 4 5;
  vector-effect: non-scaling-stroke;
}

.surface__links line.is-selected {
  stroke: var(--df-accent);
  stroke-dasharray: none;
}

.surface__nodes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.surface-node {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--node-tone) 35%, var(--df-border));
  border-radius: 6px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--node-tone) 11%, var(--df-elevated)), var(--df-elevated) 62%);
  box-shadow: 0 14px 32px rgb(0 0 0 / 18%);
  color: var(--df-text);
  transform-origin: top left;
  pointer-events: auto;
  cursor: grab;
  transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}

.surface-node:hover {
  border-color: color-mix(in srgb, var(--node-tone) 64%, var(--df-border));
  box-shadow: 0 18px 38px rgb(0 0 0 / 26%);
}

.surface-node.is-selected {
  border-color: var(--node-tone);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--node-tone) 55%, transparent), 0 20px 44px rgb(0 0 0 / 30%);
}

.surface-node.is-dimmed .surface-node__subtitle,
.surface-node.is-dimmed .surface-node__footer {
  opacity: 0;
}

.surface-node[data-tone='amber'] { --node-tone: #e2a244; }
.surface-node[data-tone='blue'] { --node-tone: #6ea8ff; }
.surface-node[data-tone='teal'] { --node-tone: #54c3b5; }
.surface-node[data-tone='slate'] { --node-tone: #aeb8c6; }
.surface-node[data-tone='rose'] { --node-tone: #e88a9b; }

.surface-node__header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--df-muted);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.surface-node__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--node-tone);
  box-shadow: 0 0 10px color-mix(in srgb, var(--node-tone) 60%, transparent);
}

.surface-node__category {
  color: var(--node-tone);
  font-weight: 700;
}

.surface-node__id {
  margin-left: auto;
  overflow: hidden;
  color: var(--df-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-transform: none;
}

.surface-node__title {
  margin: 2px 0 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.surface-node__subtitle {
  margin: 0;
  overflow: hidden;
  color: var(--df-muted);
  font-size: 10.5px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.surface-node__footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid color-mix(in srgb, var(--df-border) 70%, transparent);
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 9px;
}

.surface__heading {
  position: absolute;
  top: 18px;
  left: 20px;
  pointer-events: none;
}

.surface__eyebrow {
  color: var(--df-accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.surface__heading h2 {
  margin: 4px 0 2px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.surface__heading p {
  margin: 0;
  color: var(--df-faint);
  font-size: 10.5px;
}

.surface__toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 3px;
  border: 1px solid var(--df-border);
  border-radius: 5px;
  background: color-mix(in srgb, var(--df-elevated) 88%, transparent);
  box-shadow: 0 10px 24px rgb(0 0 0 / 22%);
  backdrop-filter: blur(8px);
}

.surface__toolbar-divider {
  width: 1px;
  height: 16px;
  margin: 0 3px;
  background: var(--df-border);
}

.surface__hud {
  position: absolute;
  left: 20px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 10px;
  border: 1px solid var(--df-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--df-titlebar) 82%, transparent);
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 9.5px;
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.surface__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--df-success);
  font-weight: 700;
}

.surface__badge.is-warn {
  color: var(--df-warning);
}

.surface__selection {
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--df-border);
  border-radius: 4px;
  background: color-mix(in srgb, var(--df-titlebar) 82%, transparent);
  color: var(--df-muted);
  font-size: 10px;
  pointer-events: none;
  backdrop-filter: blur(8px);
}
</style>
