<script setup lang="ts">
import type { CommandDefinition } from '@df/core'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ icon: string }>()
const ctx = useCordis()
const open = ref(false)
const panel = ref<HTMLElement>()

interface MenuAction {
  command: string
  label: string
  icon?: string
  description?: string
  keybinding?: string
  disabled: boolean
}

const primaryActions = computed<MenuAction[]>(() => [
  action('app.newWorkspace', '新建工作区', 'add'),
  action('workbench.saveWorkspace', '保存工作区…', 'save'),
  action('view.resetLayout', '重置当前工作区布局', 'refresh'),
  action('editor.openWelcome', '打开欢迎页', 'home'),
  action('ui.commandPalette', '打开命令面板', 'search'),
  action('ui.theme.cycle', '切换界面主题', 'color-mode'),
])

const secondaryActions = computed<MenuAction[]>(() => [
  action('app.openDocs', '框架文档', 'book'),
  action('app.about', '关于 Desktop Framework', 'info'),
  action('app.quit', '退出应用', 'sign-out'),
])

const activeWorkspaceId = computed(() => ctx.workbench.activeWorkspace.id)
const appName = computed(() => ctx.shell.title.split(' — ')[0] || ctx.shell.title)

function action(command: string, fallbackLabel: string, fallbackIcon: string): MenuAction {
  const definition = ctx.commands.get(command)
  return {
    command,
    label: definition?.title ?? fallbackLabel,
    icon: definition?.icon ?? fallbackIcon,
    description: definition?.description,
    keybinding: definition?.keybinding
      ? ctx.keybindings.format(definition.keybinding)
      : undefined,
    disabled: !ctx.commands.isEnabled(command),
  }
}

async function toggle(): Promise<void> {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    panel.value?.querySelector<HTMLButtonElement>('.df-app-menu__action')?.focus()
  }
}

function close(): void {
  open.value = false
}

function execute(item: MenuAction): void {
  if (item.disabled) {
    return
  }
  close()
  void ctx.commands.execute(item.command).catch(() => {})
}

function applyWorkspace(id: string): void {
  ctx.workbench.applyWorkspace(id)
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function keybindingOf(command: CommandDefinition | undefined): string | undefined {
  return command?.keybinding
    ? ctx.keybindings.format(command.keybinding)
    : undefined
}
</script>

<template>
  <div class="df-app-menu">
    <button
      class="df-app-menu__trigger df-app-region-no-drag"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :title="`${appName} 应用菜单`"
      @click="toggle"
    >
      <img :src="props.icon" :alt="appName" draggable="false">
      <vscode-icon class="df-app-menu__caret" name="chevron-down" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div v-if="open" class="df-app-menu__scrim" @click.self="close">
        <section ref="panel" class="df-app-menu__panel" role="dialog" aria-label="应用菜单">
          <header class="df-app-menu__hero">
            <img class="df-app-menu__logo" :src="props.icon" :alt="appName" draggable="false">
            <div class="df-app-menu__identity">
              <span class="df-app-menu__eyebrow">APPLICATION MENU</span>
              <strong>{{ appName }}</strong>
              <span>工作区、文件与应用操作</span>
            </div>
            <button class="df-app-menu__close" type="button" title="关闭应用菜单" @click="close">
              <vscode-icon name="close" aria-hidden="true" />
            </button>
          </header>

          <div class="df-app-menu__body">
            <div class="df-app-menu__primary">
              <h3>应用操作</h3>
              <button
                v-for="item in primaryActions"
                :key="item.command"
                class="df-app-menu__action"
                type="button"
                :disabled="item.disabled"
                @click="execute(item)"
              >
                <span class="df-app-menu__action-icon">
                  <vscode-icon :name="item.icon ?? 'circle-large-outline'" aria-hidden="true" />
                </span>
                <span class="df-app-menu__action-copy">
                  <strong>{{ item.label }}</strong>
                  <small v-if="item.description">{{ item.description }}</small>
                </span>
                <kbd v-if="item.keybinding">{{ item.keybinding }}</kbd>
              </button>
            </div>

            <aside class="df-app-menu__side">
              <section class="df-app-menu__section">
                <h3>最近工作区</h3>
                <button
                  v-for="workspace in ctx.workbench.workspaces"
                  :key="workspace.id"
                  class="df-app-menu__workspace"
                  type="button"
                  :class="{ 'is-active': workspace.id === activeWorkspaceId }"
                  @click="applyWorkspace(workspace.id)"
                >
                  <vscode-icon :name="workspace.id === activeWorkspaceId ? 'check' : 'multiple-windows'" aria-hidden="true" />
                  <span>{{ workspace.name }}</span>
                  <small>{{ workspace.builtin ? '内置' : '自定义' }}</small>
                </button>
              </section>

              <section class="df-app-menu__section">
                <h3>应用</h3>
                <button
                  v-for="item in secondaryActions"
                  :key="item.command"
                  class="df-app-menu__secondary"
                  type="button"
                  :disabled="item.disabled"
                  @click="execute(item)"
                >
                  <vscode-icon :name="item.icon ?? 'circle-large-outline'" aria-hidden="true" />
                  <span>{{ item.label }}</span>
                  <kbd v-if="item.keybinding">{{ item.keybinding }}</kbd>
                </button>
              </section>
            </aside>
          </div>

          <footer class="df-app-menu__footer">
            <span>{{ appName }} · 本地工作台</span>
            <span class="df-meta">{{ ctx.kernel.version }} · {{ ctx.kernel.plugins.length }} 个插件</span>
            <span v-if="keybindingOf(ctx.commands.get('ui.commandPalette'))" class="df-meta">
              {{ keybindingOf(ctx.commands.get('ui.commandPalette')) }} 打开命令面板
            </span>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.df-app-menu {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  -webkit-app-region: no-drag;
}

.df-app-menu__trigger {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.df-app-menu__trigger:hover,
.df-app-menu__trigger[aria-expanded='true'] {
  background: var(--df-hover);
}

.df-app-menu__trigger img {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
}

.df-app-menu__caret {
  position: absolute;
  right: -2px;
  bottom: 2px;
  color: var(--df-faint);
  font-size: 9px;
}

.df-app-menu__scrim {
  position: fixed;
  inset: 38px 0 0;
  z-index: 90;
  background: rgb(0 0 0 / 48%);
  backdrop-filter: blur(2px);
}

.df-app-menu__panel {
  display: flex;
  flex-direction: column;
  width: min(760px, calc(100vw - 24px));
  height: 100%;
  max-height: calc(100vh - 38px);
  border-right: 1px solid var(--df-border-strong);
  border-bottom: 1px solid var(--df-border-strong);
  border-radius: 0 10px 10px 0;
  background: var(--df-elevated);
  box-shadow: 26px 0 80px rgb(0 0 0 / 50%);
  overflow: hidden;
  animation: df-app-menu-in 140ms ease-out;
}

@keyframes df-app-menu-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
}

.df-app-menu__hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  border-bottom: 1px solid var(--df-border);
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--df-accent) 16%, transparent), transparent 48%),
    var(--df-titlebar);
}

.df-app-menu__logo {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  object-fit: contain;
  -webkit-user-drag: none;
}

.df-app-menu__identity {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.df-app-menu__eyebrow {
  color: var(--df-accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.df-app-menu__identity strong {
  overflow: hidden;
  color: var(--df-text);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-app-menu__identity span:last-child {
  color: var(--df-muted);
  font-size: 11px;
}

.df-app-menu__close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--df-muted);
  cursor: pointer;
}

.df-app-menu__close:hover {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-app-menu__body {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(250px, 0.85fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.df-app-menu__primary,
.df-app-menu__side {
  min-height: 0;
  overflow: auto;
  padding: 18px;
}

.df-app-menu__side {
  border-left: 1px solid var(--df-border);
  background: color-mix(in srgb, var(--df-surface) 45%, transparent);
}

.df-app-menu__primary h3,
.df-app-menu__section h3 {
  margin: 0 0 8px;
  padding: 0 4px;
  color: var(--df-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.df-app-menu__action {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  padding: 8px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--df-text);
  text-align: left;
  cursor: pointer;
}

.df-app-menu__action:hover:not(:disabled) {
  background: var(--df-hover);
}

.df-app-menu__action:disabled,
.df-app-menu__secondary:disabled {
  opacity: 0.45;
  cursor: default;
}

.df-app-menu__action-icon {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--df-accent) 28%, var(--df-border));
  border-radius: 6px;
  background: color-mix(in srgb, var(--df-accent) 8%, transparent);
  color: var(--df-accent);
}

.df-app-menu__action-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.df-app-menu__action-copy strong {
  font-size: 13px;
  font-weight: 550;
}

.df-app-menu__action-copy small {
  overflow: hidden;
  color: var(--df-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-app-menu__action kbd,
.df-app-menu__secondary kbd {
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
  white-space: nowrap;
}

.df-app-menu__section + .df-app-menu__section {
  margin-top: 20px;
}

.df-app-menu__workspace,
.df-app-menu__secondary {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 34px;
  padding: 6px 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--df-muted);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.df-app-menu__workspace:hover,
.df-app-menu__secondary:hover:not(:disabled) {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-app-menu__workspace.is-active {
  color: var(--df-text);
}

.df-app-menu__workspace span,
.df-app-menu__secondary span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-app-menu__workspace small {
  color: var(--df-faint);
  font-size: 9px;
}

.df-app-menu__workspace.is-active small {
  color: var(--df-accent);
}

.df-app-menu__footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 22px;
  border-top: 1px solid var(--df-border);
  color: var(--df-faint);
  font-size: 10px;
}

.df-app-menu__footer .df-meta:last-child {
  margin-left: auto;
}
</style>
