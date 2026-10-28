<script setup lang="ts">
import type { CommandDefinition } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const ctx = useCordis()
const query = ref('')
const input = ref<HTMLElement & { focus?: () => void, value?: string }>()
const results = ref<readonly CommandDefinition[]>([])
const activeIndex = ref(0)
let searchToken = 0

const commands = computed(() => ctx.commands.visible().filter(command => command.id !== 'ui.commandPalette'))

async function search(): Promise<void> {
  const token = ++searchToken
  const term = query.value.trim()
  if (!term) {
    results.value = commands.value.slice(0, 60)
    activeIndex.value = 0
    return
  }
  const candidates = commands.value.map(command => `${command.title} ${command.id} ${command.category ?? ''}`)
  const hits = await ctx.wasm.fuzzySearch(term, candidates, 60)
  if (token !== searchToken) {
    return
  }
  results.value = hits
    .map(hit => commands.value[hit.index])
    .filter((command): command is CommandDefinition => Boolean(command))
  activeIndex.value = 0
}

watch(
  () => ctx.ui.commandPaletteOpen,
  async (open) => {
    if (!open) {
      return
    }
    query.value = ''
    await nextTick()
    if (input.value) {
      input.value.value = ''
      input.value.focus?.()
    }
    void search()
  },
)

function onInput(event: Event): void {
  query.value = input.value?.value ?? (event.target as HTMLInputElement).value ?? ''
  void search()
}

async function execute(command: CommandDefinition): Promise<void> {
  ctx.ui.togglePalette(false)
  try {
    await ctx.commands.execute(command.id)
  }
  catch {
    // 命令失败已由命令服务与通知中心统一处理。
  }
}

function onGlobalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && ctx.ui.commandPaletteOpen) {
    event.preventDefault()
    ctx.ui.togglePalette(false)
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    ctx.ui.togglePalette(false)
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    const command = results.value[activeIndex.value]
    if (command) {
      void execute(command)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ctx.ui.commandPaletteOpen"
      class="palette__backdrop"
      @click.self="ctx.ui.togglePalette(false)"
      @keydown="onKeydown"
    >
      <section class="palette" role="dialog" aria-modal="true" aria-label="命令面板">
        <div class="palette__search">
          <vscode-icon name="search" />
          <vscode-textfield
            ref="input"
            class="palette__input"
            placeholder="输入命令名称或标识…"
            @input="onInput"
          />
          <kbd>Esc</kbd>
        </div>
        <div class="palette__results">
          <vscode-button
            v-for="(command, index) in results"
            :key="command.id"
            class="palette__item"
            :class="{ 'is-active': index === activeIndex }"
            secondary
            block
            :icon="command.icon"
            @click="execute(command)"
            @mouseenter="activeIndex = index"
          >
            <span class="palette__item-main">
              <span class="palette__item-title">{{ command.title }}</span>
              <span class="palette__item-id">{{ command.category ?? command.id }}</span>
            </span>
            <span v-if="command.keybinding" class="palette__item-key">{{ ctx.keybindings.format(command.keybinding) }}</span>
          </vscode-button>
          <div v-if="results.length === 0" class="palette__empty">
            <vscode-icon name="search-stop" />
            <span>没有匹配的命令</span>
          </div>
        </div>
        <footer class="palette__footer">
          <span>{{ results.length }} 个命令</span>
          <span>↑↓ 选择 · Enter 执行</span>
          <span v-if="ctx.wasm.status === 'ready'">Rust/WASM 搜索</span>
          <span v-else>TypeScript 降级搜索</span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.palette__backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 24px 24px;
  background: rgb(0 0 0 / 42%);
  backdrop-filter: blur(3px);
}

.palette {
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: min(560px, 70vh);
  border: 1px solid var(--df-border-strong);
  border-radius: 6px;
  background: var(--df-elevated);
  box-shadow: 0 28px 90px rgb(0 0 0 / 48%);
  overflow: hidden;
}

.palette__search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--df-border);
  background: var(--df-titlebar);
}

.palette__search > vscode-icon {
  color: var(--df-accent);
}

.palette__input {
  flex: 1;
  --vscode-input-background: transparent;
  --vscode-input-border: transparent;
}

.palette__search kbd {
  padding: 2px 5px;
  border: 1px solid var(--df-border);
  border-radius: 3px;
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 9px;
}

.palette__results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px;
}

.palette__item {
  --vscode-button-secondaryBackground: transparent;
  --vscode-button-secondaryHoverBackground: var(--df-hover);
  --vscode-button-secondaryForeground: var(--df-text);
  height: 34px;
  padding-inline: 9px;
}

.palette__item.is-active::part(base) {
  background: var(--df-active);
  box-shadow: inset 2px 0 0 var(--df-accent);
}

.palette__item-main {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  text-align: left;
}

.palette__item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette__item-id {
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 9px;
}

.palette__item-key {
  margin-left: auto;
  color: var(--df-muted);
  font-family: var(--vscode-editor-font-family);
  font-size: 9px;
}

.palette__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px;
  color: var(--df-faint);
  font-size: 11px;
}

.palette__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 12px;
  border-top: 1px solid var(--df-border);
  color: var(--df-faint);
  font-size: 9px;
}
</style>
