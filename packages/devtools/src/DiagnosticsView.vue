<script setup lang="ts">
import { errorMessage } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, onActivated, ref } from 'vue'

const ctx = useCordis()
const snapshot = computed(() => ctx.devtools.snapshot.value)
const busy = ref(false)
const error = ref('')
const labels = {
  loaded: '已加载',
  pending: '等待依赖',
  failed: '失败',
  unloaded: '已卸载',
}

async function refresh(): Promise<void> {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  try {
    await ctx.devtools.refresh()
  }
  catch (reason) {
    error.value = errorMessage(reason)
  }
  finally {
    busy.value = false
  }
}

async function exportDiagnostics(): Promise<void> {
  try {
    await ctx.commands.execute('developer.exportDiagnostics')
  }
  catch (reason) {
    error.value = errorMessage(reason)
  }
}

onActivated(refresh)
</script>

<template>
  <section class="diagnostics" aria-label="开发者运行诊断">
    <header class="diagnostics__header">
      <div>
        <h1>运行诊断</h1>
        <p>运行环境、插件、进程资源与启动阶段快照</p>
      </div>
      <vscode-toolbar-container aria-label="诊断工具">
        <vscode-toolbar-button icon="refresh" label="刷新诊断" :disabled="busy" @click="refresh" />
        <vscode-toolbar-button icon="export" label="导出诊断 JSON" :disabled="busy" @click="exportDiagnostics" />
      </vscode-toolbar-container>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
    </p>
    <p v-if="busy" role="status">
      正在读取诊断…
    </p>
    <template v-if="snapshot">
      <p>快照时间：{{ new Date(snapshot.capturedAt).toLocaleString() }} · 点击刷新更新数据</p>
      <h2>运行环境</h2>
      <dl>
        <dt>宿主</dt><dd>{{ snapshot.environment }} / {{ snapshot.platform }}</dd>
        <template v-for="(version, key) in snapshot.versions" :key="key">
          <dt>{{ key }}</dt><dd>{{ version ?? '不可用' }}</dd>
        </template>
        <dt>框架运行时</dt><dd>{{ snapshot.runtime?.mode ?? '内置框架' }}</dd>
        <template v-if="snapshot.runtime">
          <dt>Commit</dt><dd>{{ snapshot.runtime.commit }}</dd>
          <dt>缓存命中</dt><dd>{{ snapshot.runtime.cached ? '是' : '否' }}</dd>
        </template>
      </dl>
      <h2>插件（{{ snapshot.plugins.length }}）</h2>
      <div class="diagnostics__table">
        <table>
          <thead>
            <tr>
              <th scope="col">
                插件
              </th><th scope="col">
                状态
              </th><th scope="col">
                加载等待 / ms
              </th><th scope="col">
                错误
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plugin in snapshot.plugins" :key="plugin.id">
              <td>{{ plugin.name }}<small>{{ plugin.id }}</small></td>
              <td :class="{ diagnostics__failed: plugin.status === 'failed' }">
                {{ labels[plugin.status] }}
              </td>
              <td>{{ plugin.durationMs?.toFixed(1) ?? '—' }}</td><td>{{ plugin.error ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2>进程资源</h2>
      <p v-if="!snapshot.desktop">
        进程资源需要支持诊断接口的 Electron 宿主。浏览器可通过自带开发者工具检查页面资源。
      </p>
      <template v-else>
        <p>CPU 为两次采样之间的平均使用率，首次采样可能为 0。内存为进程工作集。</p>
        <div class="diagnostics__table">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  PID
                </th><th scope="col">
                  类型
                </th><th scope="col">
                  CPU / %
                </th><th scope="col">
                  内存 / MB
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="process in snapshot.desktop.processes" :key="process.pid">
                <td>{{ process.pid }}</td><td>{{ process.type }}</td><td>{{ process.cpuPercent.toFixed(1) }}</td><td>{{ process.memoryMB.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2>主进程启动阶段</h2>
        <div class="diagnostics__table">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  阶段
                </th><th scope="col">
                  自进程时间起点 / ms
                </th><th scope="col">
                  阶段间隔 / ms
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(phase, index) in snapshot.desktop.startup" :key="index">
                <td>{{ phase.name }}</td><td>{{ phase.at.toFixed(1) }}</td><td>{{ phase.delta.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <h2>渲染进程启动阶段</h2>
      <p v-if="!snapshot.rendererStartup.length">
        当前没有渲染进程启动标记。
      </p>
      <dl v-else>
        <template v-for="(phase, index) in snapshot.rendererStartup" :key="index">
          <dt>{{ phase.name }}</dt><dd>{{ phase.at.toFixed(1) }} ms（相对首个标记）</dd>
        </template>
      </dl>
    </template>
    <p v-if="!ctx.platform.supportsDeveloperTools">
      浏览器调试：Windows / Linux 使用 F12 或 Ctrl+Shift+I，macOS 使用 ⌘⌥I；旧版桌面宿主请升级后使用调试入口。
    </p>
  </section>
</template>

<style scoped>
.diagnostics { height: 100%; overflow: auto; padding: 24px; box-sizing: border-box; color: var(--df-text); background: var(--df-surface); }
.diagnostics__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
h1 { margin: 0; font-size: 20px; }
h2 { margin: 28px 0 12px; font-size: 14px; }
p { color: var(--df-muted); font-size: 12px; }
dl { display: grid; grid-template-columns: minmax(140px, max-content) minmax(0, 1fr); gap: 8px 20px; font-size: 12px; }
dt { color: var(--df-muted); }
dd { margin: 0; overflow-wrap: anywhere; }
.diagnostics__table { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
th, td { padding: 9px 12px; border-bottom: 1px solid var(--df-border); vertical-align: top; }
th { color: var(--df-muted); }
small { display: block; color: var(--df-muted); margin-top: 3px; }
.diagnostics__failed, [role='alert'] { color: var(--df-danger); }
</style>
