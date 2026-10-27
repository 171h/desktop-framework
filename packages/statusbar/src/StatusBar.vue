<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'

const ctx = useCordis()

function activate(command?: string): void {
  if (command) {
    void ctx.commands.execute(command).catch(() => {})
  }
}
</script>

<template>
  <footer class="df-statusbar">
    <div class="df-statusbar__group">
      <span class="df-statusbar__message">{{ ctx.statusbar.statusMessage }}</span>
      <template v-for="item in ctx.statusbar.items.filter(entry => entry.alignment === 'left')" :key="item.id">
        <vscode-toolbar-button
          v-if="item.command"
          :icon="item.icon"
          :label="item.tooltip ?? item.text"
          @click="activate(item.command)"
        >
          {{ ctx.statusbar.text(item) }}
        </vscode-toolbar-button>
        <span v-else class="df-statusbar__item" :title="item.tooltip">
          <vscode-icon v-if="item.icon" :name="item.icon" />
          {{ ctx.statusbar.text(item) }}
        </span>
      </template>
    </div>
    <div class="df-statusbar__group df-statusbar__group--right">
      <template v-for="item in ctx.statusbar.items.filter(entry => entry.alignment === 'right')" :key="item.id">
        <vscode-toolbar-button
          v-if="item.command"
          :icon="item.icon"
          :label="item.tooltip ?? item.text"
          @click="activate(item.command)"
        >
          {{ ctx.statusbar.text(item) }}
        </vscode-toolbar-button>
        <span v-else class="df-statusbar__item" :title="item.tooltip">
          <vscode-icon v-if="item.icon" :name="item.icon" />
          {{ ctx.statusbar.text(item) }}
        </span>
      </template>
    </div>
  </footer>
</template>

<style scoped>
.df-statusbar {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  height: 24px;
  padding: 0 6px;
  border-top: 1px solid var(--df-border);
  background: var(--df-statusbar);
  color: var(--df-muted);
  font-size: 11px;
  user-select: none;
}

.df-statusbar__group {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.df-statusbar__group--right {
  justify-content: flex-end;
}

.df-statusbar__message {
  padding: 0 8px 0 4px;
  color: var(--df-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 360px;
}

.df-statusbar__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  height: 100%;
  white-space: nowrap;
}

vscode-toolbar-button {
  --vscode-icon-foreground: var(--df-muted);
  --vscode-toolbar-hoverBackground: var(--df-hover);
  height: 22px;
  font-size: 11px;
}
</style>
