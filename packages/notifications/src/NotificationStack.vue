<script setup lang="ts">
import { useCordis } from '@df/vue'

const ctx = useCordis()
const icons: Record<string, string> = {
  info: 'info',
  success: 'pass-filled',
  warning: 'warning',
  error: 'error',
}
</script>

<template>
  <div class="df-notifications" role="status" aria-live="polite">
    <TransitionGroup name="df-notification">
      <div
        v-for="notification in ctx.notifications.list"
        :key="notification.id"
        class="df-notification"
        :data-level="notification.level"
      >
        <vscode-icon :name="icons[notification.level] ?? 'info'" class="df-notification__icon" />
        <span class="df-notification__message">{{ notification.message }}</span>
        <vscode-toolbar-button
          icon="close"
          label="关闭通知"
          @click="ctx.notifications.dismiss(notification.id)"
        />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.df-notifications {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(380px, calc(100vw - 32px));
  pointer-events: none;
}

.df-notification {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px 10px 12px;
  border: 1px solid var(--df-border);
  border-left: 3px solid var(--df-accent);
  border-radius: 4px;
  background: var(--df-elevated);
  box-shadow: 0 12px 32px rgb(0 0 0 / 28%);
  color: var(--df-text);
  font-size: 12px;
  pointer-events: auto;
}

.df-notification[data-level='success'] {
  border-left-color: var(--df-success);
}

.df-notification[data-level='warning'] {
  border-left-color: var(--df-warning);
}

.df-notification[data-level='error'] {
  border-left-color: var(--df-danger);
}

.df-notification__icon {
  margin-top: 2px;
  color: var(--df-accent);
}

.df-notification__message {
  flex: 1;
  min-width: 0;
  line-height: 1.55;
  word-break: break-word;
}

.df-notification-enter-active,
.df-notification-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.df-notification-enter-from,
.df-notification-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
