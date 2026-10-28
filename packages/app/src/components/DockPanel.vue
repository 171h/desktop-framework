<script setup lang="ts">
import type { DockSide, SidebarId } from '@df/core'
import { clamp } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, ref } from 'vue'
import { startDockDrag } from '../dock-drag'

const props = defineProps<{
  location: SidebarId | 'bottom'
}>()

const ctx = useCordis()
const root = ref<HTMLElement>()
const views = computed(() => ctx.workbench.viewsAt(props.location))
const active = computed(() => ctx.workbench.activeView(props.location))
const isSidebar = computed(() => props.location !== 'bottom')
const dock = computed(() => ctx.workbench.layout[props.location])
const floating = computed(() => Boolean(dock.value.floating))

function activate(id: string): void {
  ctx.workbench.openView(id)
}

function close(): void {
  ctx.workbench.toggleDock(props.location)
}

function floatPanel(): void {
  if (props.location === 'bottom') {
    return
  }
  const panel = root.value
  const workbench = panel?.closest<HTMLElement>('.df-workbench')
  if (!panel || !workbench) {
    ctx.workbench.floatDock(props.location)
    return
  }
  const panelRect = panel.getBoundingClientRect()
  const workRect = workbench.getBoundingClientRect()
  const width = clamp(panelRect.width, 240, Math.max(240, workRect.width - 24))
  const height = clamp(panelRect.height, 320, Math.max(320, Math.min(workRect.height - 32, 560)))
  ctx.workbench.floatDock(props.location, {
    x: clamp(panelRect.left - workRect.left + 18, 16, Math.max(16, workRect.width - width - 16)),
    y: clamp(panelRect.top - workRect.top + 48, 16, Math.max(16, workRect.height - height - 16)),
    width,
    height,
  })
}

function dockTo(side: DockSide): void {
  if (props.location !== 'bottom') {
    ctx.workbench.dockSidebar(props.location, side)
  }
}

function onHeaderPointerDown(event: PointerEvent): void {
  if (props.location === 'bottom') {
    return
  }
  startDockDrag(ctx, props.location, event, root.value)
}
</script>

<template>
  <section ref="root" class="df-dock" :data-location="location">
    <header
      class="df-dock__header"
      :class="{ 'is-draggable': isSidebar }"
      @pointerdown="onHeaderPointerDown"
    >
      <vscode-icon
        v-if="isSidebar"
        class="df-dock__grip"
        name="gripper"
        title="拖动以浮动或停靠"
      />
      <div class="df-dock__tabs">
        <vscode-toolbar-button
          v-for="view in views"
          :key="view.id"
          :icon="view.icon"
          :label="view.title"
          class="df-dock__tab"
          :class="{ 'is-active': active?.id === view.id }"
          @click="activate(view.id)"
        >
          {{ view.title }}
        </vscode-toolbar-button>
      </div>
      <div class="df-dock__actions">
        <template v-if="isSidebar">
          <template v-if="floating">
            <vscode-toolbar-button
              icon="layout-sidebar-left-dock"
              label="停靠到左侧"
              @click="dockTo('left')"
            />
            <vscode-toolbar-button
              icon="layout-sidebar-right-dock"
              label="停靠到右侧"
              @click="dockTo('right')"
            />
          </template>
          <vscode-toolbar-button
            v-else
            icon="multiple-windows"
            label="浮动侧栏"
            @click="floatPanel"
          />
        </template>
        <vscode-toolbar-button icon="close" label="隐藏面板" @click="close" />
      </div>
    </header>
    <div class="df-dock__body">
      <component :is="active?.component" v-if="active?.component" />
      <div v-else class="df-dock__empty">
        <vscode-icon name="window" />
        <span>没有可用视图</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.df-dock {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--df-surface);
}

.df-dock__header {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  padding: 0 4px;
  border-bottom: 1px solid var(--df-border);
  background: var(--df-titlebar);
  flex: 0 0 auto;
  -webkit-app-region: no-drag;
  user-select: none;
}

.df-dock__header.is-draggable {
  cursor: grab;
  touch-action: none;
}

.df-dock__grip {
  flex: 0 0 auto;
  margin: 0 2px 0 0;
  color: var(--df-faint);
}

.df-dock__tabs {
  display: flex;
  align-items: center;
  gap: 1px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  flex: 1;
}

.df-dock__tabs::-webkit-scrollbar {
  display: none;
}

.df-dock__tab {
  position: relative;
  flex: 0 0 auto;
  height: 26px;
  color: var(--df-muted);
  font-size: 10.5px;
}

.df-dock__tab.is-active {
  color: var(--df-text);
  background: var(--df-surface);
  box-shadow: inset 0 -2px 0 var(--df-accent);
}

.df-dock__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.df-dock__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.df-dock__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--df-faint);
  font-size: 11px;
}
</style>
