<script setup lang="ts">
import type { DockNode, ViewDefinition } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, ref } from 'vue'

const props = defineProps<{ node: DockNode }>()
const emit = defineEmits<{ activate: [title: string] }>()
const ctx = useCordis()
const activeId = ref(props.node.type === 'group'
  ? props.node.activeView
  : undefined)
const group = computed(() => props.node.type === 'group'
  ? props.node
  : undefined)
const views = computed<readonly ViewDefinition[]>(() => {
  const current = group.value
  if (!current) {
    return []
  }
  return current.views.flatMap((id) => {
    const view = ctx.workbench.views.find(candidate => candidate.id === id)
    return view
      ? [view]
      : []
  })
})
const active = computed(() => views.value.find(view => view.id === activeId.value) ?? views.value[0])

function activate(view: ViewDefinition): void {
  activeId.value = view.id
  emit('activate', view.title)
}
</script>

<template>
  <div v-if="node.type === 'split'" class="df-detached-panel__split" :class="`is-${node.orientation}`">
    <DetachedPanelNode
      class="df-detached-panel__pane"
      :style="{ flexGrow: node.ratio }"
      :node="node.children[0]"
      @activate="$emit('activate', $event)"
    />
    <span class="df-detached-panel__divider" aria-hidden="true" />
    <DetachedPanelNode
      class="df-detached-panel__pane"
      :style="{ flexGrow: 1 - node.ratio }"
      :node="node.children[1]"
      @activate="$emit('activate', $event)"
    />
  </div>
  <section v-else class="df-detached-panel__group" :aria-label="active?.title">
    <header class="df-detached-panel__tabs" role="tablist" aria-label="面板标签">
      <button
        v-for="view in views"
        :key="view.id"
        class="df-detached-panel__tab"
        :class="{ 'is-active': view.id === active?.id }"
        role="tab"
        :aria-selected="view.id === active?.id"
        @click="activate(view)"
      >
        <vscode-icon v-if="view.icon" :name="view.icon" aria-hidden="true" />
        <span>{{ view.title }}</span>
      </button>
    </header>
    <div class="df-detached-panel__body">
      <component :is="active.component" v-if="active?.component" />
      <div v-else class="df-detached-panel__empty">
        没有可用视图
      </div>
    </div>
  </section>
</template>

<style scoped>
.df-detached-panel__split {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.df-detached-panel__split.is-horizontal {
  flex-direction: row;
}

.df-detached-panel__split.is-vertical {
  flex-direction: column;
}

.df-detached-panel__pane {
  flex-basis: 0;
  min-width: 0;
  min-height: 0;
}

.df-detached-panel__divider {
  flex: 0 0 1px;
  background: var(--df-border);
}

.df-detached-panel__split.is-horizontal .df-detached-panel__divider {
  width: 1px;
}

.df-detached-panel__split.is-vertical .df-detached-panel__divider {
  height: 1px;
}

.df-detached-panel__group {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--df-surface);
}

.df-detached-panel__tabs {
  display: flex;
  flex: 0 0 32px;
  align-items: stretch;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--df-border);
  background: var(--df-titlebar);
  scrollbar-width: none;
}

.df-detached-panel__tabs::-webkit-scrollbar {
  display: none;
}

.df-detached-panel__tab {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  height: 31px;
  padding: 0 10px;
  border: 0;
  border-right: 1px solid var(--df-border);
  background: transparent;
  color: var(--df-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.df-detached-panel__tab:hover {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-detached-panel__tab.is-active {
  background: var(--df-surface);
  box-shadow: inset 0 2px 0 var(--df-accent);
  color: var(--df-text);
}

.df-detached-panel__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.df-detached-panel__empty {
  padding: 16px;
  color: var(--df-muted);
}
</style>
