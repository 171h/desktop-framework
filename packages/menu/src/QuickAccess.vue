<script setup lang="ts">
import { useCordis } from '@df/vue'

const ctx = useCordis()
</script>

<template>
  <vscode-toolbar-container class="df-quick-access" aria-label="快速访问工具栏">
    <vscode-toolbar-button
      v-for="item in ctx.menu.quickAccess"
      :key="item.id"
      :icon="item.icon"
      :label="item.label"
      @click="ctx.commands.execute(item.command).catch(() => {})"
    />
  </vscode-toolbar-container>
</template>

<style scoped>
.df-quick-access {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 28px;
  -webkit-app-region: no-drag;
}
</style>
