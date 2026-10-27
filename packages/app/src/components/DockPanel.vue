<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'

const props = defineProps<{
  location: 'left' | 'right' | 'bottom'
}>()

const ctx = useCordis()
const views = computed(() => ctx.workbench.viewsAt(props.location))
const active = computed(() => ctx.workbench.activeView(props.location))

function activate(id: string): void {
  ctx.workbench.store.setActiveView(props.location, id)
}

function close(): void {
  ctx.workbench.toggleDock(props.location)
}
</script>

<template>
  <section class="df-dock" :data-location="location">
    <header class="df-dock__header">
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
      <vscode-toolbar-button icon="close" label="隐藏面板" @click="close" />
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
