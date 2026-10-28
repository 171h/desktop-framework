<script setup lang="ts">
import type { EditorDocument } from './types'
import { useCordis } from '@df/vue'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'

const ctx = useCordis()
const tabs = ref<HTMLElement & { selectedIndex: number }>()
const contextMenu = ref<HTMLElement & { data: Array<Record<string, unknown>>, show: boolean }>()
const contextTarget = ref<string>()
const menuStyle = reactive({ left: '0px', top: '0px' })

const documents = () => ctx.editor.documents

function isActive(document: EditorDocument): boolean {
  return document.id === ctx.editor.activeId
}

function activate(document: EditorDocument): void {
  ctx.editor.activate(document.id)
}

function close(document: EditorDocument, event?: Event): void {
  event?.stopPropagation()
  ctx.editor.close(document.id)
  focusActive()
}

function closeAll(): void {
  ctx.editor.closeAll()
  focusActive()
}

function focusActive(): void {
  void nextTick(() => {
    const activeId = ctx.editor.activeId
    if (!activeId) {
      return
    }
    const header = Array.from(tabs.value?.children ?? [])
      .find((element): element is HTMLElement => element instanceof HTMLElement && element.getAttribute('data-doc-id') === activeId)
    header?.focus()
  })
}

function onSelect(event: Event): void {
  const detail = (event as CustomEvent<{ selectedIndex: number }>).detail
  const document = ctx.editor.documents[detail.selectedIndex]
  if (document) {
    ctx.editor.activate(document.id)
  }
}

function onLayoutChange(event: Event): void {
  const detail = (event as CustomEvent<{ header?: HTMLElement }>).detail
  if (!detail.header) {
    return
  }
  const headers = Array.from(tabs.value?.children ?? [])
    .filter((element): element is HTMLElement => element.tagName === 'VSCODE-TAB-HEADER')
  const ids = headers
    .map(header => header.getAttribute('data-doc-id'))
    .filter((id): id is string => Boolean(id))
  if (ids.length === ctx.editor.documents.length) {
    ctx.editor.reorder(ids)
    void nextTick(syncSelectedIndex)
  }
}

function onMiddleClick(document: EditorDocument, event: MouseEvent): void {
  if (event.button === 1) {
    event.preventDefault()
    close(document)
  }
}

function openContext(document: EditorDocument, event: MouseEvent): void {
  contextTarget.value = document.id
  menuStyle.left = `${Math.min(event.clientX, Math.max(12, window.innerWidth - 230))}px`
  menuStyle.top = `${Math.min(event.clientY, Math.max(12, window.innerHeight - 230))}px`
  if (contextMenu.value) {
    contextMenu.value.data = contextData()
    void nextTick(() => {
      if (contextMenu.value) {
        contextMenu.value.show = true
      }
    })
  }
}

function contextData(): Array<Record<string, unknown>> {
  const document = ctx.editor.documents.find(item => item.id === contextTarget.value)
  if (!document) {
    return []
  }
  return [
    {
      label: '关闭',
      value: 'close',
      keybinding: ctx.keybindings.format('Mod+W'),
    },
    { label: '关闭其他标签页', value: 'others' },
    { label: '关闭右侧标签页', value: 'right' },
    { separator: true },
    {
      label: document.pinned ? '取消固定' : '固定标签页',
      value: 'pin',
    },
    { separator: true },
    { label: '全部关闭', value: 'all' },
  ]
}

function onContextSelect(event: Event): void {
  const action = (event as CustomEvent<{ value: string }>).detail.value
  const id = contextTarget.value
  if (!id) {
    return
  }
  if (action === 'close') {
    ctx.editor.close(id)
    focusActive()
  }
  else if (action === 'others') {
    ctx.editor.closeOthers(id)
    focusActive()
  }
  else if (action === 'right') {
    ctx.editor.closeToRight(id)
    focusActive()
  }
  else if (action === 'pin') {
    ctx.editor.togglePin(id)
  }
  else if (action === 'all') {
    ctx.editor.closeAll()
    focusActive()
  }
  contextTarget.value = undefined
}

function syncSelectedIndex(): void {
  if (!tabs.value) {
    return
  }
  const index = ctx.editor.activeIndex
  tabs.value.selectedIndex = index < 0
    ? 0
    : index
}

function onWheel(event: WheelEvent): void {
  const inner = tabs.value?.shadowRoot?.querySelector<HTMLElement>('.tablist')
  if (!inner || inner.scrollWidth <= inner.clientWidth) {
    return
  }
  inner.scrollLeft += event.deltaY || event.deltaX
  event.preventDefault()
}

watch(() => [ctx.editor.documents.length, ctx.editor.activeIndex], syncSelectedIndex)
onMounted(() => {
  void nextTick(syncSelectedIndex)
})
</script>

<template>
  <div class="df-editor-tabs" role="group" aria-label="打开的文档">
    <vscode-tabs
      ref="tabs"
      class="df-editor-tabs__bar"
      overflow="scroll"
      @vsc-tabs-select="onSelect"
      @vsc-tabs-layout-change="onLayoutChange"
      @wheel="onWheel"
    >
      <template v-for="document in documents()" :key="document.id">
        <vscode-tab-header
          :active="isActive(document)"
          :icon="document.icon"
          :title="document.description ?? document.title"
          :data-doc-id="document.id"
          :class="{ 'is-dirty': document.dirty, 'is-preview': document.preview, 'is-pinned': document.pinned }"
          @click="activate(document)"
          @auxclick="onMiddleClick(document, $event)"
          @contextmenu.prevent="openContext(document, $event)"
        >
          <span class="df-editor-tab__label">{{ document.title }}</span>
          <vscode-icon
            v-if="document.pinned"
            slot="content-after"
            class="df-editor-tab__pin"
            name="pin"
            aria-hidden="true"
          />
          <span
            v-if="document.dirty"
            slot="content-after"
            class="df-editor-tab__dirty"
            title="未保存"
          />
          <vscode-icon
            v-if="document.closable !== false && !document.pinned"
            slot="content-after"
            class="df-editor-tab__close"
            :class="{ 'is-dirty': document.dirty }"
            name="close"
            action-icon
            label="关闭标签页"
            @click.stop
            @vsc-click.stop="close(document, $event)"
          />
        </vscode-tab-header>
        <vscode-tab-panel class="df-editor-tabs__panel" />
      </template>

      <vscode-toolbar-container slot="addons" class="df-editor-tabs__actions" aria-label="标签页操作">
        <vscode-toolbar-button icon="close-all" label="关闭所有标签页" @click="closeAll" />
      </vscode-toolbar-container>
    </vscode-tabs>

    <vscode-context-menu
      ref="contextMenu"
      class="df-editor-tabs__menu"
      :style="menuStyle"
      @vsc-context-menu-select="onContextSelect"
    />
  </div>
</template>

<style scoped>
.df-editor-tabs {
  position: relative;
  flex: 0 0 38px;
  min-height: 38px;
  background: var(--df-titlebar);
  border-bottom: 1px solid var(--df-border);
  z-index: 3;
}

.df-editor-tabs__bar {
  height: 38px;
  --vsc-tab-header-height: 20px;
  --vscode-panelTitle-activeForeground: var(--df-text);
  --vscode-panelTitle-inactiveForeground: var(--df-muted);
  --vscode-tab-activeBorderTop: var(--df-accent);
  --vscode-settings-headerBorder: transparent;
}

.df-editor-tabs__bar :deep(vscode-tab-header) {
  max-width: 220px;
  background: transparent;
  border-right: 1px solid var(--df-border);
  color: var(--df-muted);
  font-size: 11px;
  line-height: 1;
  transition: background 120ms ease, color 120ms ease;
}

.df-editor-tabs__bar :deep(vscode-tab-header:hover) {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-editor-tabs__bar :deep(vscode-tab-header[active]) {
  background: var(--df-surface);
  box-shadow: inset 0 2px 0 var(--df-accent);
  color: var(--df-text);
}

.df-editor-tab__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-editor-tab__close {
  margin-left: 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.df-editor-tabs__bar :deep(vscode-tab-header:hover) .df-editor-tab__close,
.df-editor-tabs__bar :deep(vscode-tab-header[active]) .df-editor-tab__close {
  opacity: 1;
  pointer-events: auto;
}

.df-editor-tabs__bar :deep(vscode-tab-header[active]) .df-editor-tab__close.is-dirty {
  opacity: 0;
  pointer-events: none;
}

.df-editor-tabs__bar :deep(vscode-tab-header:hover) .df-editor-tab__close.is-dirty {
  opacity: 1;
  pointer-events: auto;
}

.df-editor-tabs__bar :deep(vscode-tab-header:hover) .df-editor-tab__dirty {
  display: none;
}

.df-editor-tab__dirty {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--df-accent);
}

.df-editor-tab__pin {
  margin-left: 4px;
  color: var(--df-faint);
}

.is-preview .df-editor-tab__label {
  font-style: italic;
}

.df-editor-tabs__panel {
  display: none;
}

.df-editor-tabs__actions {
  align-self: center;
  margin-right: 4px;
}

.df-editor-tabs__menu {
  position: fixed;
  z-index: 120;
}
</style>
