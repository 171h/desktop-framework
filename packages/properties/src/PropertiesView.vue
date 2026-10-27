<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'

const ctx = useCordis()

const current = computed(() => ctx.selection.current.value)
const rows = computed<Array<{ label: string, value: string }>>(() => {
  const item = current.value
  const data = item?.data ?? {}
  if (!item) {
    return []
  }
  const common = [
    { label: '标识', value: item.id },
    { label: '类型', value: item.kind },
  ]
  if (item.kind === 'plugin') {
    return [
      ...common,
      {
        label: '版本',
        value: String(data.version ?? '—'),
      },
      {
        label: '来源',
        value: String(data.source ?? '—'),
      },
      {
        label: '状态',
        value: String(data.status ?? '—'),
      },
      {
        label: '加载耗时',
        value: data.durationMs
          ? `${Number(data.durationMs).toFixed(2)} ms`
          : '—',
      },
      {
        label: '错误',
        value: String(data.error ?? '—'),
      },
    ]
  }
  if (item.kind === 'workspace') {
    const layout = data.layout as Record<string, unknown> | undefined
    return [
      ...common,
      {
        label: '内置',
        value: data.builtin ? '是' : '否',
      },
      {
        label: '左侧栏',
        value: layout
          ? JSON.stringify(layout.left)
          : '—',
      },
      {
        label: '右侧栏',
        value: layout
          ? JSON.stringify(layout.right)
          : '—',
      },
      {
        label: '底部面板',
        value: layout
          ? JSON.stringify(layout.bottom)
          : '—',
      },
    ]
  }
  if (item.kind === 'surface.node') {
    return [
      ...common,
      {
        label: '分类',
        value: String(data.category ?? '—'),
      },
      {
        label: '模块',
        value: String(data.module ?? '—'),
      },
      {
        label: '色调',
        value: String(data.tone ?? '—'),
      },
      { label: '位置', value: `${data.x ?? 0}, ${data.y ?? 0}` },
      { label: '尺寸', value: `${data.width ?? 0} × ${data.height ?? 0}` },
    ]
  }
  return [
    ...common,
    ...Object.entries(data).map(([key, value]) => ({
      label: key,
      value: String(value),
    })),
  ]
})

const environment = computed(() => [
  { label: '平台', value: ctx.platform.platform },
  {
    label: '宿主',
    value: ctx.platform.isElectron ? 'Electron' : 'Browser',
  },
  { label: '框架', value: ctx.kernel.version },
  { label: '内核环境', value: ctx.kernel.environment },
  {
    label: 'WASM',
    value: ctx.wasm.status === 'ready'
      ? ctx.wasm.version
      : ctx.wasm.status,
  },
  { label: '主题', value: ctx.ui.theme },
  { label: '工作区', value: ctx.workbench.activeWorkspace.name },
  {
    label: '已加载插件',
    value: String(ctx.kernel.plugins.filter(plugin => plugin.status === 'loaded').length),
  },
])
</script>

<template>
  <div class="properties">
    <div class="properties__toolbar">
      <span>{{ current ? '选中对象' : '属性' }}</span>
      <vscode-toolbar-button
        v-if="current"
        icon="close"
        label="清除选择"
        @click="ctx.selection.clear()"
      />
    </div>

    <div v-if="current" class="properties__content">
      <div class="properties__hero">
        <div class="properties__icon">
          <vscode-icon :name="current.kind === 'plugin' ? 'extensions' : current.kind === 'surface.node' ? 'symbol-color' : 'briefcase'" />
        </div>
        <div>
          <h3>{{ current.label }}</h3>
          <p>{{ current.description || current.id }}</p>
        </div>
      </div>

      <vscode-collapsible heading="对象属性" open>
        <vscode-table class="properties__table" size="small">
          <vscode-table-header>
            <vscode-table-header-cell>属性</vscode-table-header-cell>
            <vscode-table-header-cell>值</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body>
            <vscode-table-row v-for="row in rows" :key="row.label">
              <vscode-table-cell>{{ row.label }}</vscode-table-cell>
              <vscode-table-cell class="properties__value">
                {{ row.value }}
              </vscode-table-cell>
            </vscode-table-row>
          </vscode-table-body>
        </vscode-table>
      </vscode-collapsible>
    </div>

    <div v-else class="properties__content">
      <div class="properties__empty">
        <vscode-icon name="inspect" />
        <strong>未选择对象</strong>
        <p>在资源浏览器中选择一个插件，或在画布中选择卡片以查看属性。</p>
      </div>

      <vscode-collapsible heading="运行环境" open>
        <vscode-table class="properties__table" size="small">
          <vscode-table-header>
            <vscode-table-header-cell>项目</vscode-table-header-cell>
            <vscode-table-header-cell>值</vscode-table-header-cell>
          </vscode-table-header>
          <vscode-table-body>
            <vscode-table-row v-for="row in environment" :key="row.label">
              <vscode-table-cell>{{ row.label }}</vscode-table-cell>
              <vscode-table-cell class="properties__value">
                {{ row.value }}
              </vscode-table-cell>
            </vscode-table-row>
          </vscode-table-body>
        </vscode-table>
      </vscode-collapsible>
    </div>
  </div>
</template>

<style scoped>
.properties {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--df-surface);
}

.properties__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid var(--df-border);
  color: var(--df-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.properties__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.properties__hero {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(160deg, color-mix(in srgb, var(--df-accent) 7%, var(--df-surface)), var(--df-surface) 60%);
}

.properties__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--df-border);
  border-radius: 4px;
  background: var(--df-elevated);
  color: var(--df-accent);
}

.properties__hero h3 {
  margin: 0 0 3px;
  font-size: 14px;
  font-weight: 600;
}

.properties__hero p {
  margin: 0;
  color: var(--df-muted);
  font-size: 10.5px;
  line-height: 1.5;
  word-break: break-all;
}

vscode-collapsible {
  display: block;
  border-bottom: 1px solid var(--df-border);
}

.properties__table {
  display: block;
  width: 100%;
}

.properties__value {
  color: var(--df-text);
  font-family: var(--vscode-editor-font-family);
  font-size: 10.5px;
  word-break: break-all;
}

.properties__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 24px 28px;
  color: var(--df-muted);
  text-align: center;
}

.properties__empty vscode-icon {
  color: var(--df-faint);
}

.properties__empty strong {
  color: var(--df-text);
  font-size: 12px;
  font-weight: 600;
}

.properties__empty p {
  margin: 0;
  max-width: 220px;
  font-size: 10.5px;
  line-height: 1.6;
}
</style>
