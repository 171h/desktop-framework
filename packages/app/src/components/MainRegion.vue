<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'

const ctx = useCordis()
const activeMain = computed(() => ctx.workbench.activeView('main'))
</script>

<template>
  <div class="df-main">
    <component :is="activeMain?.component" v-if="activeMain?.component" />
    <div v-else class="df-main__empty">
      <vscode-icon name="layout" />
      <strong>没有主视图</strong>
      <p>插件可以通过 workbench.registerView({ location: 'main' }) 贡献主工作区。</p>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.df-main {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--df-canvas);
}

.df-main__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--df-faint);
  text-align: center;
}

.df-main__empty strong {
  color: var(--df-text);
  font-size: 13px;
}

.df-main__empty p {
  margin: 0;
  max-width: 320px;
  font-size: 11px;
  line-height: 1.6;
}
</style>
