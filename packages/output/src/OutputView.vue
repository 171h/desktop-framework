<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCordis } from '@df/vue'

interface LogEntry {
  id: number
  time: string
  level: 'info' | 'success' | 'warning' | 'error'
  channel: string
  message: string
}

const ctx = useCordis()
const logs = ref<LogEntry[]>([])
const scroller = ref<HTMLElement>()
let nextId = 0
const disposers: (() => void)[] = []

function append(level: LogEntry['level'], channel: string, message: string): void {
  const now = new Date()
  logs.value = [
    ...logs.value.slice(-299),
    {
      id: ++nextId,
      time: `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`,
      level,
      channel,
      message,
    },
  ]
  void nextTick(() => {
    if (scroller.value) {
      scroller.value.scrollTop = scroller.value.scrollHeight
    }
  })
}

function clear(): void {
  logs.value = []
  append('info', 'output', '输出已清空')
}

function execute(command: string): void {
  void ctx.commands.execute(command).catch(() => {})
}

onMounted(() => {
  append('info', 'framework', `工作台已就绪 · ${ctx.kernel.plugins.length} 个插件`)
  disposers.push(
    ctx.on('kernel/plugin-loaded', info => append('success', 'kernel', `${info.name} 已加载 ${info.durationMs?.toFixed(1)}ms`)),
    ctx.on('kernel/plugin-failed', info => append('error', 'kernel', `${info.name} 加载失败：${info.error ?? '未知错误'}`)),
    ctx.on('kernel/plugin-unloaded', id => append('warning', 'kernel', `${id} 已卸载`)),
    ctx.on('command/executed', id => append('info', 'command', `${id} 执行完成`)),
    ctx.on('command/failed', (id, error) => append('error', 'command', `${id}：${error instanceof Error ? error.message : String(error)}`)),
    ctx.on('workbench/workspace-applied', workspace => append('info', 'workbench', `切换到工作区「${workspace.name}」`)),
    ctx.on('ui/theme-changed', theme => append('info', 'ui', `主题切换为 ${theme}`)),
  )
})

onBeforeUnmount(() => {
  for (const dispose of disposers) {
    dispose()
  }
})
</script>

<template>
  <div class="output">
    <div class="output__toolbar">
      <span class="output__title">
        <vscode-icon name="output" />
        运行输出
      </span>
      <vscode-toolbar-container aria-label="输出工具">
        <vscode-toolbar-button icon="clear-all" label="清空输出" @click="clear" />
        <vscode-toolbar-button icon="settings-gear" label="切换主题" @click="execute('ui.theme.cycle')" />
      </vscode-toolbar-container>
    </div>
    <div ref="scroller" class="output__scroll">
      <div v-for="entry in logs" :key="entry.id" class="output__line" :data-level="entry.level">
        <span class="output__time">{{ entry.time }}</span>
        <span class="output__channel">{{ entry.channel }}</span>
        <span class="output__message">{{ entry.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="output__empty">暂无输出</div>
    </div>
  </div>
</template>

<style scoped>
.output {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--df-surface);
}

.output__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  padding: 0 6px 0 10px;
  border-bottom: 1px solid var(--df-border);
}

.output__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--df-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.output__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 0;
  font-family: var(--vscode-editor-font-family);
  font-size: 10.5px;
}

.output__line {
  display: grid;
  grid-template-columns: 82px 68px minmax(0, 1fr);
  gap: 8px;
  padding: 2px 12px;
  line-height: 1.55;
}

.output__line:hover {
  background: var(--df-hover);
}

.output__time {
  color: var(--df-faint);
}

.output__channel {
  color: var(--df-accent);
  text-transform: uppercase;
}

.output__line[data-level='success'] .output__channel {
  color: var(--df-success);
}

.output__line[data-level='warning'] .output__channel {
  color: var(--df-warning);
}

.output__line[data-level='error'] .output__message,
.output__line[data-level='error'] .output__channel {
  color: var(--df-danger);
}

.output__message {
  color: var(--df-text);
  word-break: break-word;
}

.output__empty {
  padding: 18px 12px;
  color: var(--df-faint);
}
</style>
