<script setup lang="ts">
import { EditorTabBar } from '@df/editor'
import { useCordis } from '@df/vue'
import { computed } from 'vue'

const ctx = useCordis()
const activeMain = computed(() => ctx.workbench.activeView('main'))
const activeDocument = computed(() => ctx.editor.activeDocument)
const hasDocuments = computed(() => ctx.editor.documents.length > 0)
</script>

<template>
  <div class="df-main">
    <EditorTabBar v-if="hasDocuments" />
    <div class="df-main__content">
      <KeepAlive :max="16">
        <component
          :is="activeDocument.component"
          v-if="activeDocument?.component"
          :key="activeDocument.id"
        />
      </KeepAlive>
      <component
        :is="activeMain?.component"
        v-if="!hasDocuments && activeMain?.component"
      />
      <div v-else-if="!hasDocuments" class="df-main__empty">
        <vscode-icon name="layout" />
        <strong>没有打开的文档</strong>
        <p>插件可以通过 ctx.editor.open() 打开文档，或使用 workbench.registerView({ location: 'main' }) 贡献主工作区。</p>
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.df-main {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--df-canvas);
}

.df-main__content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
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
  max-width: 360px;
  font-size: 11px;
  line-height: 1.6;
}
</style>
