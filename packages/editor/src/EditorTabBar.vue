<script setup lang="ts">
import type { WindowMessage } from '@df/core'
import type {} from '@df/platform'
import type { DetachedEditorPayload, EditorDocument } from './types'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const ctx = useCordis()
const scroller = ref<HTMLElement>()
const track = ref<HTMLElement>()
const contextMenu = ref<HTMLElement & { data: Array<Record<string, unknown>>, show: boolean }>()
const contextTarget = ref<string>()
const menuStyle = reactive({ left: '0px', top: '0px' })
const dropIndex = ref<number>()
const dropLeft = ref(0)
const dragId = ref<string>()
const remoteDrag = ref<{ id: string, payload: DetachedEditorPayload }>()
const localDrag = ref<{ id: string, documentId: string, accepted: boolean }>()
let dropped = false
let leftWindow = false
let lastDragEvent: DragEvent | undefined
let scrollerObserver: ResizeObserver | undefined
let remoteDragTimer: ReturnType<typeof setTimeout> | undefined
let messageSubscription: { dispose: () => void } | undefined
let detachedWindow = false

const documents = computed(() => ctx.editor.documents)
const activeId = computed(() => ctx.editor.activeId)
const pinnedCount = computed(() => documents.value.filter(document => document.pinned).length)
const compact = computed(() => documents.value.length > 10)

function isActive(document: EditorDocument): boolean {
  return document.id === activeId.value
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
    tabElement(activeId.value)?.focus()
  })
}

function tabElement(id?: string): HTMLElement | undefined {
  if (!id) {
    return
  }
  return [
    ...(track.value?.querySelectorAll<HTMLElement>('[data-doc-id]') ?? []),
  ].find(element => element.dataset.docId === id)
}

function revealActive(): void {
  const element = tabElement(activeId.value)
  const container = scroller.value
  if (!element || !container) {
    return
  }
  if (element.classList.contains('is-pinned')) {
    return
  }
  const pinnedWidth = pinnedTabsWidth()
  const bounds = container.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  const leftEdge = bounds.left + pinnedWidth
  if (rect.left < leftEdge) {
    container.scrollLeft -= leftEdge - rect.left
  }
  else if (rect.right > bounds.right) {
    container.scrollLeft += rect.right - bounds.right
  }
}

function pinnedTabsWidth(): number {
  return [
    ...(track.value?.querySelectorAll<HTMLElement>('.df-editor-tab.is-pinned') ?? []),
  ].reduce((total, tab) => total + tab.offsetWidth, 0)
}

function updatePinnedOffsets(): void {
  const container = scroller.value
  const tabs = [
    ...(track.value?.querySelectorAll<HTMLElement>('.df-editor-tab') ?? []),
  ]
  let left = 0
  for (const tab of tabs) {
    if (!tab.classList.contains('is-pinned')) {
      tab.style.left = ''
      continue
    }
    tab.style.left = `${left}px`
    left += tab.offsetWidth
  }
  track.value?.classList.toggle('is-pinned-overflow', left > Math.max(0, (container?.clientWidth ?? 0) - 44))
}

function onWheel(event: WheelEvent): void {
  const element = scroller.value
  if (!element || element.scrollWidth <= element.clientWidth) {
    return
  }
  element.scrollLeft += event.deltaY || event.deltaX
  event.preventDefault()
}

function onMiddleClick(document: EditorDocument, event: MouseEvent): void {
  if (event.button === 1) {
    event.preventDefault()
    close(document)
  }
}

function onDoubleClick(document: EditorDocument): void {
  if (document.preview) {
    ctx.editor.keepOpen(document.id)
  }
}

function onTabKeydown(document: EditorDocument, event: KeyboardEvent): void {
  const tabs = documents.value
  const index = tabs.findIndex(item => item.id === document.id)
  let next: EditorDocument | undefined
  if (event.key === 'ArrowLeft') {
    next = tabs[(index - 1 + tabs.length) % tabs.length]
  }
  else if (event.key === 'ArrowRight') {
    next = tabs[(index + 1) % tabs.length]
  }
  else if (event.key === 'Home') {
    next = tabs[0]
  }
  else if (event.key === 'End') {
    next = tabs[tabs.length - 1]
  }
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate(document)
    return
  }
  if (!next) {
    return
  }
  event.preventDefault()
  const element = tabElement(next.id)
  element?.focus()
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function onDragStart(document: EditorDocument, event: DragEvent): void {
  if (!event.dataTransfer) {
    return
  }
  if (event.composedPath().some(target => target instanceof HTMLElement && target.dataset.noDrag !== undefined)) {
    event.preventDefault()
    return
  }
  dragId.value = document.id
  dropped = false
  leftWindow = false
  lastDragEvent = event
  remoteDrag.value = undefined
  localDrag.value = undefined
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData('application/x-df-editor-tab', document.id)
  event.dataTransfer.setData('text/plain', document.title)
  if (!ctx.platform.supportsDetachedWindows) {
    return
  }
  const payload = ctx.editor.detachPayload(document.id)
  if (!payload) {
    return
  }
  const drag = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    documentId: document.id,
    accepted: false,
  }
  localDrag.value = drag
  ctx.platform.sendWindowMessage('editor/drag-begin', {
    dragId: drag.id,
    payload,
  })
}

function onDragOver(event: DragEvent): void {
  const local = dragId.value
  const remote = local
    ? undefined
    : remoteDrag.value
  if ((!local && !remote) || !track.value || !scroller.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  const tabs = [
    ...track.value.querySelectorAll<HTMLElement>('[data-doc-id]'),
  ]
  let target = tabs.length
  for (let index = 0; index < tabs.length; index++) {
    const rect = tabs[index].getBoundingClientRect()
    if (event.clientX < rect.left + rect.width / 2) {
      target = index
      break
    }
  }
  if (local) {
    const source = documents.value.find(document => document.id === local)
    if (source?.pinned) {
      target = Math.min(target, pinnedCount.value)
    }
    else {
      target = Math.max(target, pinnedCount.value)
    }
  }
  dropIndex.value = target
  const scrollerRect = scroller.value.getBoundingClientRect()
  if (target < tabs.length) {
    dropLeft.value = tabs[target].getBoundingClientRect().left - scrollerRect.left + scroller.value.scrollLeft
  }
  else {
    const last = tabs[tabs.length - 1]
    dropLeft.value = last
      ? last.getBoundingClientRect().right - scrollerRect.left + scroller.value.scrollLeft
      : 0
  }
  const bounds = scroller.value.getBoundingClientRect()
  if (event.clientX < bounds.left + 24) {
    scroller.value.scrollLeft -= 16
  }
  else if (event.clientX > bounds.right - 24) {
    scroller.value.scrollLeft += 16
  }
}

function onDrop(event: DragEvent): void {
  const remote = remoteDrag.value
  if (!dragId.value && !remote) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (remote) {
    const target = dropIndex.value ?? documents.value.length
    const accepted = ctx.editor.acceptDetached(remote.payload)
    if (accepted) {
      reorderAccepted(remote.payload.id, target)
      ctx.platform.sendWindowMessage('editor/drag-accept', { dragId: remote.id })
    }
    remoteDrag.value = undefined
    clearTimeout(remoteDragTimer)
    remoteDragTimer = undefined
    clearDropFeedback()
    return
  }
  const id = dragId.value
  if (!id) {
    return
  }
  applyReorder(id, dropIndex.value ?? documents.value.length)
  dropped = true
  clearDropFeedback()
}

function reorderAccepted(id: string, target: number): void {
  const ids = documents.value.map(document => document.id)
  const from = ids.indexOf(id)
  if (from >= 0) {
    ids.splice(from, 1)
  }
  ids.splice(Math.max(0, Math.min(target, ids.length)), 0, id)
  ctx.editor.reorder(ids)
  ctx.editor.activate(id)
}

function onDragLeave(event: DragEvent): void {
  const related = event.relatedTarget
  if (!(related instanceof Node) || !scroller.value?.contains(related)) {
    clearDropFeedback()
  }
}

function applyReorder(id: string, target: number): void {
  const ordered = [...documents.value]
  const from = ordered.findIndex(document => document.id === id)
  if (from < 0) {
    return
  }
  const source = ordered[from]
  const ids = ordered.map(document => document.id)
  ids.splice(from, 1)
  const remainingPinned = pinnedCount.value - (source.pinned
    ? 1
    : 0)
  let to = target > from
    ? target - 1
    : target
  to = source.pinned
    ? Math.max(0, Math.min(to, remainingPinned))
    : Math.max(remainingPinned, Math.min(to, ids.length))
  ids.splice(to, 0, id)
  ctx.editor.reorder(ids)
}

function clearDropFeedback(): void {
  dropIndex.value = undefined
}

function onWindowDrag(event: DragEvent): void {
  if (!dragId.value) {
    return
  }
  lastDragEvent = event
  if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
    leftWindow = true
  }
}

function onWindowDragLeave(event: DragEvent): void {
  if (dragId.value && event.relatedTarget === null) {
    leftWindow = true
  }
}

function onWindowDragEnter(event: DragEvent): void {
  if (dragId.value && event.relatedTarget === null) {
    leftWindow = false
  }
}

async function onDragEnd(): Promise<void> {
  const id = dragId.value
  const drag = localDrag.value
  const outside = leftWindow || Boolean(lastDragEvent && (
    lastDragEvent.clientX <= 0
    || lastDragEvent.clientY <= 0
    || lastDragEvent.clientX >= window.innerWidth
    || lastDragEvent.clientY >= window.innerHeight
  ))
  const shouldDetach = Boolean(id) && !dropped && outside
  const document = id
    ? documents.value.find(item => item.id === id)
    : undefined
  dragId.value = undefined
  dropped = false
  leftWindow = false
  lastDragEvent = undefined
  clearDropFeedback()
  if (!drag) {
    return
  }
  if (drag.accepted) {
    finishLocalDrag(drag)
    closeEmptyDetachedWindow()
    return
  }
  if (shouldDetach && document) {
    // 先等待目标窗口通过 IPC 确认接收，避免跨窗口拖放时又创建新窗口。
    await new Promise(resolve => setTimeout(resolve, 350))
    if (!drag.accepted) {
      await detachDocument(document)
    }
  }
  finishLocalDrag(drag)
  closeEmptyDetachedWindow()
}

function finishLocalDrag(drag: { id: string, documentId: string, accepted: boolean }): void {
  if (localDrag.value !== drag) {
    return
  }
  localDrag.value = undefined
  ctx.platform.sendWindowMessage('editor/drag-end', { dragId: drag.id })
}

function closeEmptyDetachedWindow(): void {
  if (detachedWindow && documents.value.length === 0) {
    void ctx.platform.windowControl('close')
  }
}

function onEditorWindowMessage(message: WindowMessage): void {
  if (message.topic === 'editor/drag-begin') {
    const data = message.payload as { dragId?: unknown, payload?: unknown }
    if (typeof data?.dragId !== 'string' || !data.payload || typeof data.payload !== 'object') {
      return
    }
    remoteDrag.value = {
      id: data.dragId,
      payload: data.payload as DetachedEditorPayload,
    }
    clearTimeout(remoteDragTimer)
    remoteDragTimer = setTimeout(() => {
      remoteDrag.value = undefined
    }, 10_000)
    return
  }
  if (message.topic === 'editor/drag-end') {
    const data = message.payload as { dragId?: unknown }
    if (!remoteDrag.value || typeof data?.dragId !== 'string' || data.dragId === remoteDrag.value.id) {
      remoteDrag.value = undefined
      clearTimeout(remoteDragTimer)
      remoteDragTimer = undefined
    }
    return
  }
  if (message.topic !== 'editor/drag-accept') {
    return
  }
  const data = message.payload as { dragId?: unknown }
  const drag = localDrag.value
  if (!drag || data?.dragId !== drag.id) {
    return
  }
  drag.accepted = true
  ctx.editor.release(drag.documentId)
  finishLocalDrag(drag)
  dragId.value = undefined
  dropped = false
  leftWindow = false
  lastDragEvent = undefined
  clearDropFeedback()
  void nextTick(closeEmptyDetachedWindow)
}

async function detachDocument(document: EditorDocument): Promise<void> {
  if (!ctx.platform.supportsDetachedWindows) {
    return
  }
  const payload = ctx.editor.detachPayload(document.id)
  if (!payload) {
    return
  }
  try {
    const created = await ctx.platform.openDetachedWindow({
      kind: 'editor',
      title: document.title,
      payload,
      bounds: {
        x: window.screenX + 48,
        y: window.screenY + 48,
        width: Math.max(640, Math.round(window.outerWidth * 0.72)),
        height: Math.max(480, Math.round(window.outerHeight * 0.8)),
      },
    })
    if (created) {
      ctx.editor.release(document.id)
    }
  }
  catch (error) {
    ctx.logger.warn(`[editor] 创建独立窗口失败：${String(error)}`)
  }
}

function openContext(document: EditorDocument, event: MouseEvent): void {
  contextTarget.value = document.id
  menuStyle.left = `${Math.min(event.clientX, Math.max(12, window.innerWidth - 260))}px`
  menuStyle.top = `${Math.min(event.clientY, Math.max(12, window.innerHeight - 330))}px`
  if (contextMenu.value) {
    contextMenu.value.data = contextData(document)
    void nextTick(() => {
      if (contextMenu.value) {
        contextMenu.value.show = true
      }
    })
  }
}

function contextData(document: EditorDocument): Array<Record<string, unknown>> {
  return [
    {
      label: '关闭',
      value: 'close',
      keybinding: ctx.keybindings.format('Mod+W'),
    },
    { label: '关闭其他标签页', value: 'others' },
    { label: '关闭右侧标签页', value: 'right' },
    { label: '关闭已保存的标签页', value: 'saved' },
    { separator: true },
    ...(ctx.platform.supportsDetachedWindows
      ? [
          {
            label: '移动到新窗口',
            value: 'detach',
          },
          { separator: true },
        ]
      : []),
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
  else if (action === 'saved') {
    ctx.editor.closeSaved()
    focusActive()
  }
  else if (action === 'pin') {
    ctx.editor.togglePin(id)
  }
  else if (action === 'detach') {
    const document = documents.value.find(item => item.id === id)
    if (document) {
      void detachDocument(document)
    }
  }
  else if (action === 'all') {
    ctx.editor.closeAll()
    focusActive()
  }
  contextTarget.value = undefined
}

watch(
  () => [activeId.value, documents.value.length] as const,
  () => void nextTick(revealActive),
  { immediate: true },
)

const layoutSignature = computed(() => documents.value
  .map(document => `${document.id}:${document.pinned ? 1 : 0}:${document.dirty ? 1 : 0}:${document.title}`)
  .join('|'))

watch(
  layoutSignature,
  () => void nextTick(() => {
    updatePinnedOffsets()
    revealActive()
  }),
  { immediate: true },
)

onMounted(() => {
  if (scroller.value) {
    scrollerObserver = new ResizeObserver(() => {
      updatePinnedOffsets()
      revealActive()
    })
    scrollerObserver.observe(scroller.value)
  }
  messageSubscription = ctx.platform.onWindowMessage(onEditorWindowMessage)
  void ctx.platform.getWindowContext().then((context) => {
    detachedWindow = Boolean(context)
  })
  window.addEventListener('drag', onWindowDrag, true)
  window.addEventListener('dragleave', onWindowDragLeave, true)
  window.addEventListener('dragenter', onWindowDragEnter, true)
})

onBeforeUnmount(() => {
  scrollerObserver?.disconnect()
  messageSubscription?.dispose()
  clearTimeout(remoteDragTimer)
  window.removeEventListener('drag', onWindowDrag, true)
  window.removeEventListener('dragleave', onWindowDragLeave, true)
  window.removeEventListener('dragenter', onWindowDragEnter, true)
})
</script>

<template>
  <div class="df-editor-tabs" :class="{ 'is-compact': compact }" role="group" aria-label="打开的文档">
    <div
      ref="scroller"
      class="df-editor-tabs__scroller"
      role="tablist"
      aria-label="文档标签"
      @wheel="onWheel"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div ref="track" class="df-editor-tabs__track">
        <div
          v-for="document in documents"
          :key="document.id"
          :data-doc-id="document.id"
          class="df-editor-tab"
          :class="{
            'is-active': isActive(document),
            'is-dirty': document.dirty,
            'is-dragging': dragId === document.id,
            'is-pinned': document.pinned,
            'is-preview': document.preview,
          }"
          role="tab"
          :aria-selected="isActive(document) ? 'true' : 'false'"
          :tabindex="isActive(document) ? 0 : -1"
          :title="document.description ?? document.title"
          draggable="true"
          @click="activate(document)"
          @dblclick="onDoubleClick(document)"
          @auxclick="onMiddleClick(document, $event)"
          @contextmenu.prevent="openContext(document, $event)"
          @dragstart="onDragStart(document, $event)"
          @dragend="onDragEnd"
          @keydown="onTabKeydown(document, $event)"
        >
          <vscode-icon v-if="document.icon" class="df-editor-tab__icon" :name="document.icon" aria-hidden="true" />
          <span class="df-editor-tab__label">{{ document.title }}</span>
          <span v-if="document.pinned" class="df-editor-tab__pin" aria-hidden="true">
            <vscode-icon name="pin" />
          </span>
          <span v-else-if="document.dirty" class="df-editor-tab__dirty" title="未保存" />
          <vscode-icon
            v-if="!document.pinned && document.closable !== false"
            class="df-editor-tab__close"
            :class="{ 'is-dirty': document.dirty }"
            name="close"
            action-icon
            label="关闭标签页"
            data-no-drag
            :draggable="false"
            @pointerdown.stop
            @click.stop
            @vsc-click.stop="close(document, $event)"
          />
        </div>
        <div
          v-if="dropIndex !== undefined"
          class="df-editor-tabs__drop-indicator"
          :style="{ left: `${dropLeft}px` }"
          aria-hidden="true"
        />
      </div>
    </div>

    <vscode-toolbar-container class="df-editor-tabs__actions" aria-label="标签页操作">
      <vscode-toolbar-button icon="close-all" label="关闭所有标签页" @click="closeAll" />
    </vscode-toolbar-container>

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
  display: flex;
  align-items: stretch;
  flex: 0 0 38px;
  min-height: 38px;
  background: var(--df-titlebar);
  border-bottom: 1px solid var(--df-border);
  z-index: 3;
}

.df-editor-tabs__scroller {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.df-editor-tabs__scroller::-webkit-scrollbar {
  display: none;
}

.df-editor-tabs__track {
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: 100%;
  height: 37px;
}

.df-editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 auto;
  min-width: 52px;
  max-width: 220px;
  height: 37px;
  padding: 0 10px;
  border-right: 1px solid var(--df-border);
  color: var(--df-muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition: background 120ms ease, color 120ms ease, opacity 120ms ease;
}

.df-editor-tab:hover {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-editor-tab.is-active {
  background: var(--df-surface);
  box-shadow: inset 0 2px 0 var(--df-accent);
  color: var(--df-text);
}

.df-editor-tab.is-pinned {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--df-titlebar);
}

.df-editor-tab.is-pinned:hover {
  background: var(--df-hover);
}

.df-editor-tab.is-pinned.is-active {
  background: var(--df-surface);
}

.df-editor-tabs__track.is-pinned-overflow .df-editor-tab.is-pinned {
  position: static;
}

.df-editor-tab:focus-visible {
  outline: 1px solid var(--df-accent);
  outline-offset: -2px;
}

.df-editor-tab.is-dragging {
  opacity: 0.55;
}

.df-editor-tab__icon {
  flex: 0 0 auto;
  font-size: 13px;
}

.df-editor-tabs.is-compact .df-editor-tab {
  gap: 4px;
  padding: 0 6px;
}

.df-editor-tabs.is-compact .df-editor-tab__icon {
  display: none;
}

.df-editor-tab__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-editor-tab.is-preview .df-editor-tab__label {
  font-style: italic;
}

.df-editor-tab__pin {
  display: inline-flex;
  flex: 0 0 auto;
  margin-left: 4px;
  color: var(--df-faint);
  font-size: 10px;
}

.df-editor-tab__dirty {
  display: inline-block;
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--df-accent);
}

.df-editor-tab__close {
  display: none;
  flex: 0 0 auto;
  margin-left: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.df-editor-tab:hover .df-editor-tab__close,
.df-editor-tab.is-active .df-editor-tab__close {
  display: inline-flex;
  opacity: 1;
  pointer-events: auto;
}

.df-editor-tab.is-active .df-editor-tab__close.is-dirty {
  display: none;
  opacity: 0;
  pointer-events: none;
}

.df-editor-tab:hover .df-editor-tab__close.is-dirty {
  display: inline-flex;
  opacity: 1;
  pointer-events: auto;
}

.df-editor-tab:hover .df-editor-tab__dirty {
  display: none;
}

.df-editor-tabs__drop-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 1px;
  background: var(--df-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--df-accent) 30%, transparent);
  pointer-events: none;
  z-index: 2;
}

.df-editor-tabs__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  padding-right: 4px;
}

.df-editor-tabs__menu {
  position: fixed;
  z-index: 120;
}
</style>
