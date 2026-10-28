<script setup lang="ts">
import type { DockGroupNode } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { startDockDrag } from '../dock-drag'

const props = defineProps<{ group: DockGroupNode }>()
const ctx = useCordis()
const root = ref<HTMLElement>()
const tabsRoot = ref<HTMLElement>()
const views = computed(() => ctx.workbench.panelViews(props.group))
const active = computed(() => views.value.find(view => view.id === props.group.activeView) ?? views.value[0])
const floating = computed(() => ctx.workbench.docking.floating.some((panel) => {
  let found = false
  const visit = (node: typeof panel.node): void => {
    if (node.id === props.group.id)
      found = true
    if (node.type === 'split')
      node.children.forEach(visit)
  }
  visit(panel.node)
  return found
}))

function drag(event: PointerEvent, viewId?: string): void {
  if (viewId)
    ctx.workbench.activatePanel(props.group.id, viewId)
  startDockDrag(ctx, props.group.id, event, root.value, viewId)
}

function floatGroup(): void {
  const rect = root.value?.getBoundingClientRect()
  const bounds = root.value?.closest('.df-workbench')?.getBoundingClientRect()
  if (!rect || !bounds)
    return
  ctx.workbench.floatPanel(props.group.id, {
    x: Math.max(0, rect.left - bounds.left + 24),
    y: Math.max(0, rect.top - bounds.top + 24),
    width: Math.max(240, Math.min(rect.width, bounds.width - 24)),
    height: Math.max(180, Math.min(rect.height, bounds.height - 24, 560)),
  })
}

function hideGroup(): void {
  views.value.forEach(view => ctx.workbench.hidePanel(view.id))
}

async function cycle(direction: number): Promise<void> {
  ctx.workbench.cyclePanel(props.group.id, direction)
  await nextTick()
  const selected = [
    ...(tabsRoot.value?.querySelectorAll<HTMLElement>('vscode-tab-header') ?? []),
  ]
    .find(element => element.dataset.viewId === active.value?.id)
  selected?.focus()
  selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function scrollTabs(event: WheelEvent): void {
  const element = tabsRoot.value
  if (element && element.scrollWidth > element.clientWidth) {
    element.scrollLeft += event.deltaY || event.deltaX
    event.preventDefault()
  }
}

function activeTab(): HTMLElement | undefined {
  return [
    ...(tabsRoot.value?.querySelectorAll<HTMLElement>('vscode-tab-header') ?? []),
  ].find(element => element.dataset.viewId === active.value?.id)
}

async function revealActive(): Promise<void> {
  await nextTick()
  activeTab()?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

// 合并标签组或调整浮窗宽度后，活动标签可能位于滚动区域外，需自动滚入可视范围。
watch(
  () => [active.value?.id, views.value.length] as const,
  () => void revealActive(),
  { immediate: true },
)

let stripObserver: ResizeObserver | undefined
onMounted(() => {
  if (!tabsRoot.value)
    return
  stripObserver = new ResizeObserver(() => void revealActive())
  stripObserver.observe(tabsRoot.value)
})
onBeforeUnmount(() => stripObserver?.disconnect())
</script>

<template>
  <section v-if="views.length" ref="root" class="df-panel-group" :data-group-id="group.id" :aria-label="active?.title">
    <header class="df-panel-group__header" title="拖动标题移动标签组；拖动标签可拆出单个面板" @pointerdown="drag($event)">
      <vscode-icon class="df-panel-group__grip" name="gripper" />
      <div ref="tabsRoot" class="df-panel-group__tabs" role="tablist" aria-label="面板标签" @wheel="scrollTabs">
        <vscode-tab-header
          v-for="view in views" :key="view.id" :title="view.title" :active="active?.id === view.id"
          role="tab" :aria-selected="active?.id === view.id" :tabindex="active?.id === view.id ? 0 : -1"
          :data-view-id="view.id"
          @pointerdown.stop="drag($event, view.id)"
          @click="ctx.workbench.activatePanel(group.id, view.id)"
          @keydown.enter.prevent="ctx.workbench.activatePanel(group.id, view.id)"
          @keydown.space.prevent="ctx.workbench.activatePanel(group.id, view.id)"
          @keydown.left.prevent="cycle(-1)"
          @keydown.right.prevent="cycle(1)"
        >
          {{ view.title }}
        </vscode-tab-header>
      </div>
      <vscode-toolbar-container class="df-panel-group__actions" aria-label="面板操作">
        <template v-if="floating">
          <vscode-toolbar-button icon="layout-sidebar-left-dock" label="停靠左侧（保留已有面板）" @click="ctx.workbench.dockPanel(group.id, 'left')" />
          <vscode-toolbar-button icon="layout-sidebar-right-dock" label="停靠右侧（保留已有面板）" @click="ctx.workbench.dockPanel(group.id, 'right')" />
        </template>
        <vscode-toolbar-button v-else icon="multiple-windows" label="浮动整个标签组" @click="floatGroup" />
        <vscode-toolbar-button icon="pin" label="收起标签组，通过边缘按钮恢复" @click="hideGroup" />
        <vscode-toolbar-button icon="close" label="隐藏当前面板" @click="active && ctx.workbench.hidePanel(active.id)" />
      </vscode-toolbar-container>
    </header>
    <div class="df-panel-group__body" role="tabpanel">
      <component :is="active.component" v-if="active?.component" :key="active.id" />
      <div v-else class="df-panel-group__empty">
        没有可用视图
      </div>
    </div>
  </section>
</template>

<style scoped>
.df-panel-group { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; min-height: 0; background: var(--df-surface); }
.df-panel-group__header { display: flex; align-items: center; flex: 0 0 32px; min-width: 0; padding: 0 3px; border-bottom: 1px solid var(--df-border); background: var(--df-titlebar); cursor: grab; user-select: none; touch-action: none; -webkit-app-region: no-drag; }
.df-panel-group__grip { color: var(--df-faint); flex: 0 0 auto; }
.df-panel-group__tabs { display: flex; flex: 1; align-items: center; min-width: 0; height: 31px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.df-panel-group__tabs::-webkit-scrollbar { display: none; }
vscode-tab-header { flex: 0 0 auto; height: 30px; font-size: 11px; }
.df-panel-group__actions { flex: 0 0 auto; }
.df-panel-group__body { flex: 1; min-height: 0; overflow: hidden; }
.df-panel-group__empty { padding: 16px; color: var(--df-muted); }
</style>
