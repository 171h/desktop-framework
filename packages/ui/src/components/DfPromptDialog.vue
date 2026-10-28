<script setup lang="ts">
import { useCordis } from '@df/vue'
import { nextTick, ref, watch } from 'vue'

const ctx = useCordis()
const field = ref<HTMLElement & { value?: string, focus?: () => void }>()
const value = ref('')

watch(
  () => ctx.ui.prompt,
  async (prompt) => {
    value.value = prompt?.value ?? ''
    if (prompt) {
      await nextTick()
      field.value?.focus?.()
      if (field.value) {
        field.value.value = value.value
      }
    }
  },
  { immediate: true },
)

function onInput(): void {
  value.value = field.value?.value ?? ''
}

function confirm(): void {
  ctx.ui.resolvePrompt(value.value)
}

function cancel(): void {
  ctx.ui.resolvePrompt(null)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ctx.ui.prompt"
      class="df-dialog-backdrop"
      @click.self="cancel"
      @keydown.esc="cancel"
    >
      <section class="df-dialog" role="dialog" aria-modal="true" :aria-label="ctx.ui.prompt.title">
        <header class="df-dialog__header">
          <span>{{ ctx.ui.prompt.title }}</span>
          <vscode-toolbar-button icon="close" label="关闭" @click="cancel" />
        </header>
        <div class="df-dialog__body">
          <p v-if="ctx.ui.prompt.message" class="df-dialog__message">
            {{ ctx.ui.prompt.message }}
          </p>
          <vscode-textfield
            ref="field"
            :placeholder="ctx.ui.prompt.placeholder"
            :value="ctx.ui.prompt.value"
            @input="onInput"
            @keydown.enter="confirm"
          />
        </div>
        <footer class="df-dialog__footer">
          <vscode-button secondary @click="cancel">
            {{ ctx.ui.prompt.cancelLabel ?? '取消' }}
          </vscode-button>
          <vscode-button @click="confirm">
            {{ ctx.ui.prompt.confirmLabel ?? '确定' }}
          </vscode-button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.df-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(0 0 0 / 46%);
  backdrop-filter: blur(2px);
}

.df-dialog {
  width: min(460px, 100%);
  border: 1px solid var(--df-border-strong);
  border-radius: 6px;
  background: var(--df-elevated);
  box-shadow: 0 24px 80px rgb(0 0 0 / 42%);
}

.df-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--df-border);
  color: var(--df-text);
  font-size: 13px;
  font-weight: 600;
}

.df-dialog__body {
  padding: 16px;
}

.df-dialog__message {
  margin: 0 0 12px;
  color: var(--df-muted);
  font-size: 12px;
  line-height: 1.6;
}

.df-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--df-border);
}

vscode-textfield {
  width: 100%;
}
</style>
