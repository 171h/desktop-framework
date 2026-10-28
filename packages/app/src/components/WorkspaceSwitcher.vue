<script setup lang="ts">
import { errorMessage } from '@desktop-framework/core'
import { useCordis } from '@desktop-framework/vue'
import { computed, nextTick, ref, watch } from 'vue'

const ctx = useCordis()
const menu = ref<HTMLElement & { data?: Array<{ label: string, value: string, keybinding?: string, separator?: boolean }>, show: boolean }>()
const open = ref(false)

const menuData = computed(() => [
  ...ctx.workbench.workspaces.map(workspace => ({
    label: `${workspace.name}${workspace.id === ctx.workbench.activeWorkspace.id
      ? '  ✓'
      : ''}`,
    value: `workspace:${workspace.id}`,
  })),
  { label: '', value: 'separator', separator: true },
  { label: '保存当前工作区…', value: 'save' },
])

watch(open, async (value) => {
  await nextTick()
  if (!menu.value) {
    return
  }
  menu.value.data = menuData.value
  menu.value.show = value
})

async function toggle(): Promise<void> {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    if (menu.value) {
      menu.value.data = menuData.value
      menu.value.show = true
    }
  }
}

async function onSelect(event: Event): Promise<void> {
  const detail = (event as CustomEvent<{ value: string }>).detail
  open.value = false
  if (detail.value === 'save') {
    const name = await ctx.ui.showPrompt({
      title: '保存工作区',
      message: '当前停靠/浮动布局、面板尺寸与可见性将保存为新的工作区。',
      placeholder: '例如：审阅 - 双屏',
      value: `我的工作区 ${ctx.workbench.workspaces.filter(workspace => !workspace.builtin).length + 1}`,
      confirmLabel: '保存',
    })
    if (name?.trim()) {
      try {
        const workspace = ctx.workbench.saveWorkspace(name)
        ctx.notifications.success(`工作区「${workspace.name}」已保存`)
      }
      catch (error) {
        ctx.notifications.error(`保存工作区失败：${errorMessage(error)}`)
      }
    }
    return
  }
  if (detail.value.startsWith('workspace:')) {
    ctx.workbench.applyWorkspace(detail.value.slice('workspace:'.length))
  }
}
</script>

<template>
  <div class="workspace-switcher df-app-region-no-drag">
    <vscode-button secondary icon="multiple-windows" @click="toggle">
      {{ ctx.workbench.activeWorkspace.name }}
    </vscode-button>
    <vscode-context-menu ref="menu" class="workspace-switcher__menu" @vsc-context-menu-select="onSelect" />
  </div>
</template>

<style scoped>
.workspace-switcher {
  position: relative;
  -webkit-app-region: no-drag;
}

.workspace-switcher :deep(vscode-button) {
  --vscode-button-secondaryBackground: transparent;
  --vscode-button-secondaryHoverBackground: var(--df-hover);
  --vscode-button-secondaryForeground: var(--df-text);
  height: 25px;
  font-size: 11px;
}

.workspace-switcher__menu {
  position: absolute;
  top: 30px;
  right: 0;
  z-index: 50;
  min-width: 220px;
}
</style>
