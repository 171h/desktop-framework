<script setup lang="ts">
import type { DetachedPanelPayload, WindowContext } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import appIcon from './assets/icon.png'
import DetachedPanelNode from './DetachedPanelNode.vue'

const props = defineProps<{ context: WindowContext }>()
const ctx = useCordis()
const payload = props.context.payload as DetachedPanelPayload
const title = ref(payload?.title ?? '面板')
const isMac = computed(() => ctx.platform.platform === 'darwin')

function syncTitle(): void {
  document.title = `${title.value} — Desktop Framework`
}

watch(title, syncTitle, { flush: 'post' })
onMounted(() => {
  void nextTick(syncTitle)
})

watch(
  () => ctx.ui.resolvedTheme,
  (theme) => {
    if (isMac.value) {
      return
    }
    void ctx.platform.setTitleBarOverlay({
      color: theme === 'dark'
        ? '#101215'
        : '#f4f6f8',
      symbolColor: theme === 'dark'
        ? '#e7e9ec'
        : '#20242a',
      height: 38,
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="df-detached-panel" :class="{ 'is-mac': isMac }">
    <header class="df-detached-panel__titlebar df-app-region-drag">
      <img class="df-detached-panel__brand" :src="appIcon" alt="" draggable="false">
      <span class="df-detached-panel__title">{{ title }}</span>
      <span class="df-detached-panel__spacer" aria-hidden="true" />
    </header>
    <div class="df-detached-panel__content">
      <DetachedPanelNode v-if="payload?.node" :node="payload.node" @activate="title = $event" />
    </div>
  </div>
</template>

<style scoped>
.df-detached-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--df-surface);
  color: var(--df-text);
}

.df-detached-panel__titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  min-height: 38px;
  padding-top: 0;
  padding-right: calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 6px);
  padding-bottom: 0;
  padding-left: calc(env(titlebar-area-x, 0px) + 10px);
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(180deg, var(--df-titlebar), color-mix(in srgb, var(--df-titlebar) 88%, var(--df-canvas)));
  user-select: none;
  -webkit-app-region: drag;
}

.df-detached-panel.is-mac .df-detached-panel__titlebar {
  padding-left: 78px;
}

.df-detached-panel__brand {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
}

.df-detached-panel__title {
  min-width: 0;
  overflow: hidden;
  color: var(--df-text);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-detached-panel__spacer {
  flex: 1;
  align-self: stretch;
}

.df-detached-panel__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
