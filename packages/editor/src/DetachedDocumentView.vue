<script setup lang="ts">
import { useCordis } from '@df/vue'
import { computed } from 'vue'

const ctx = useCordis()
const document = computed(() => ctx.editor.activeDocument)
</script>

<template>
  <div class="df-detached-document">
    <vscode-icon name="window" />
    <h2>{{ document?.title ?? '独立文档' }}</h2>
    <p>该文档由插件提供，尚未注册独立窗口恢复逻辑。关闭此窗口即可释放文档。</p>
  </div>
</template>

<style scoped>
.df-detached-document {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  padding: 32px;
  color: var(--df-faint);
  text-align: center;
  background: var(--df-canvas);
}

.df-detached-document vscode-icon {
  color: var(--df-accent);
}

.df-detached-document h2 {
  margin: 0;
  color: var(--df-text);
  font-size: 18px;
  font-weight: 600;
}

.df-detached-document p {
  max-width: 380px;
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}
</style>
