<script setup lang="ts">
import type { KernelPluginInfo } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const ctx = useCordis()
const filter = ref('')
const revision = ref(0)
const disposers: (() => void)[] = []

const workspaces = computed(() => {
  const term = filter.value.trim().toLowerCase()
  return ctx.workbench.workspaces.filter(workspace =>
    !term || workspace.name.toLowerCase().includes(term) || workspace.id.includes(term),
  )
})

const plugins = computed(() => {
  const term = filter.value.trim().toLowerCase()
  // kernel.plugins 是普通数组，通过 revision 与事件桥接 Vue 响应式。
  void revision.value
  return ctx.kernel.plugins.filter(plugin =>
    !term || plugin.name.toLowerCase().includes(term) || plugin.id.toLowerCase().includes(term),
  )
})

const counts = computed(() => ({
  loaded: plugins.value.filter(plugin => plugin.status === 'loaded').length,
  failed: plugins.value.filter(plugin => plugin.status === 'failed').length,
}))

function refresh(): void {
  revision.value++
}

function selectWorkspace(id: string): void {
  ctx.workbench.applyWorkspace(id)
}

function selectPlugin(plugin: KernelPluginInfo): void {
  ctx.selection.select({
    id: plugin.id,
    kind: 'plugin',
    label: plugin.name,
    description: plugin.id,
    data: { ...plugin },
  })
}

function onInput(event: Event): void {
  filter.value = (event.target as HTMLInputElement).value ?? ''
}

onMounted(() => {
  disposers.push(
    ctx.on('kernel/plugin-loaded', refresh),
    ctx.on('kernel/plugin-failed', refresh),
    ctx.on('kernel/plugin-unloaded', refresh),
    ctx.on('workbench/workspace-applied', refresh),
  )
})

onBeforeUnmount(() => {
  for (const dispose of disposers) {
    dispose()
  }
})
</script>

<template>
  <div class="explorer">
    <div class="explorer__filter">
      <vscode-textfield
        placeholder="筛选工作区与插件"
        :value="filter"
        @input="onInput"
      >
        <vscode-icon slot="content-before" name="filter" />
      </vscode-textfield>
    </div>

    <div class="explorer__tree">
      <vscode-tree aria-label="工作区与插件" indent-guides="always" expand-mode="singleClick">
        <vscode-tree-item open>
          <vscode-icon slot="icon-branch" name="briefcase" />
          <vscode-icon slot="icon-branch-opened" name="briefcase" />
          工作区
          <span slot="description">{{ workspaces.length }}</span>
          <vscode-tree-item
            v-for="workspace in workspaces"
            :key="workspace.id"
            :active="workspace.id === ctx.workbench.activeWorkspace.id"
            @click.stop="selectWorkspace(workspace.id)"
          >
            <vscode-icon slot="icon-leaf" :name="workspace.id === ctx.workbench.activeWorkspace.id ? 'check' : 'circle-outline'" />
            {{ workspace.name }}
            <span slot="description">{{ workspace.builtin ? '内置' : '自定义' }}</span>
          </vscode-tree-item>
        </vscode-tree-item>

        <vscode-tree-item open>
          <vscode-icon slot="icon-branch" name="extensions" />
          <vscode-icon slot="icon-branch-opened" name="extensions" />
          插件
          <span slot="description">{{ counts.loaded }}/{{ plugins.length }}</span>
          <vscode-tree-item
            v-for="plugin in plugins"
            :key="plugin.id"
            @click.stop="selectPlugin(plugin)"
          >
            <vscode-icon slot="icon-leaf" :name="plugin.status === 'failed' ? 'error' : plugin.status === 'loaded' ? 'pass-filled' : 'circle-outline'" />
            {{ plugin.name }}
            <span slot="description">{{ plugin.status === 'failed' ? '失败' : `${Math.round(plugin.durationMs ?? 0)}ms` }}</span>
          </vscode-tree-item>
        </vscode-tree-item>
      </vscode-tree>
    </div>

    <footer class="explorer__footer">
      <span>{{ counts.loaded }} 个插件已加载</span>
      <span v-if="counts.failed" class="explorer__failure">{{ counts.failed }} 个失败</span>
      <span v-else>内核 {{ ctx.kernel.version }}</span>
    </footer>
  </div>
</template>

<style scoped>
.explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--df-surface);
}

.explorer__filter {
  padding: 8px;
  border-bottom: 1px solid var(--df-border);
}

.explorer__filter vscode-textfield {
  width: 100%;
}

.explorer__tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 2px;
}

.explorer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid var(--df-border);
  color: var(--df-faint);
  font-size: 9.5px;
}

.explorer__failure {
  color: var(--df-danger);
}
</style>
