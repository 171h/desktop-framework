<script setup lang="ts">
import type { WindowState } from '@desktop-framework/core'
import AppMenu from '@desktop-framework/menu/AppMenu.vue'
import QuickAccess from '@desktop-framework/menu/QuickAccess.vue'
import NotificationStack from '@desktop-framework/notifications/NotificationStack.vue'
import RibbonBar from '@desktop-framework/ribbon/RibbonBar.vue'
import StatusBar from '@desktop-framework/statusbar/StatusBar.vue'
import { DfPromptDialog, DfSlot } from '@desktop-framework/ui'
import { useCordis } from '@desktop-framework/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CommandPalette from './components/CommandPalette.vue'
import WorkspaceBody from './components/WorkspaceBody.vue'
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue'

const ctx = useCordis()
const windowState = ref<WindowState>({ maximized: false, fullscreen: false, focused: true })
const disposers: (() => void)[] = []

const isMac = computed(() => ctx.platform.platform === 'darwin')
const showWindowControls = computed(() => ctx.platform.isElectron && !isMac.value)
const layout = computed(() => ctx.workbench.layout)

onMounted(async () => {
  if (!ctx.platform.isElectron) {
    return
  }
  const state = await ctx.platform.getWindowState()
  if (state) {
    windowState.value = state
  }
  disposers.push(ctx.platform.onWindowState((next) => {
    windowState.value = next
  }).dispose)
})

onBeforeUnmount(() => {
  for (const dispose of disposers) {
    dispose()
  }
})

async function windowAction(action: 'minimize' | 'toggleMaximize' | 'close'): Promise<void> {
  const state = await ctx.platform.windowControl(action)
  if (state) {
    windowState.value = state
  }
}

function onTitlebarDoubleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('vscode-button, vscode-toolbar-button, input, vscode-textfield, .workspace-switcher')) {
    return
  }
  void windowAction('toggleMaximize')
}
</script>

<template>
  <div class="df-app" :class="{ 'is-mac': isMac }">
    <header class="df-titlebar df-app-region-drag" @dblclick="onTitlebarDoubleClick">
      <div class="df-titlebar__left">
        <div class="df-brand" aria-hidden="true">
          DF
        </div>
        <AppMenu />
        <span class="df-titlebar__divider" />
        <QuickAccess />
      </div>

      <div class="df-titlebar__center">
        <span class="df-titlebar__title">{{ ctx.shell.title }}</span>
        <span class="df-titlebar__breadcrumb">· {{ ctx.workbench.activeWorkspace.name }}</span>
        <span class="df-titlebar__dirty" title="本地工作台">LOCAL</span>
      </div>

      <div class="df-titlebar__right">
        <WorkspaceSwitcher />
        <vscode-toolbar-button
          icon="search"
          label="命令面板"
          @click="ctx.ui.togglePalette(true)"
        />
        <div v-if="showWindowControls" class="df-window-controls">
          <vscode-toolbar-button icon="chrome-minimize" label="最小化" @click="windowAction('minimize')" />
          <vscode-toolbar-button
            :icon="windowState.maximized ? 'chrome-restore' : 'chrome-maximize'"
            :label="windowState.maximized ? '还原' : '最大化'"
            @click="windowAction('toggleMaximize')"
          />
          <vscode-toolbar-button icon="chrome-close" label="关闭" class="df-window-controls__close" @click="windowAction('close')" />
        </div>
      </div>
    </header>

    <RibbonBar />

    <div class="df-workbench">
      <WorkspaceBody>
        <DfSlot name="main.overlay" />
      </WorkspaceBody>
    </div>

    <StatusBar v-if="layout.statusbarVisible" />

    <NotificationStack />
    <DfPromptDialog />
    <CommandPalette />
    <div class="df-sr-only" aria-live="polite">
      {{ ctx.statusbar.statusMessage }}
    </div>
  </div>
</template>

<style scoped>
.df-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--df-canvas);
  color: var(--df-text);
  overflow: hidden;
}

.df-titlebar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  min-height: 38px;
  padding: 0 6px 0 10px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(180deg, var(--df-titlebar), color-mix(in srgb, var(--df-titlebar) 88%, var(--df-canvas)));
  user-select: none;
}

.df-app.is-mac .df-titlebar {
  padding-left: 78px;
}

.df-titlebar__left,
.df-titlebar__right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  -webkit-app-region: no-drag;
}

.df-titlebar__left {
  flex: 1;
  min-width: 0;
}

.df-titlebar__right {
  flex: 1;
  justify-content: flex-end;
}

.df-titlebar__center {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
  pointer-events: none;
}

.df-brand {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  margin-right: 2px;
  border-radius: 4px;
  background: var(--df-accent);
  color: #17130b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--df-accent) 30%, transparent);
}

.df-titlebar__divider {
  width: 1px;
  height: 16px;
  background: var(--df-border);
  margin: 0 2px;
}

.df-titlebar__title {
  overflow: hidden;
  color: var(--df-text);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-titlebar__breadcrumb {
  color: var(--df-muted);
  font-size: 10px;
  white-space: nowrap;
}

.df-titlebar__dirty {
  padding: 1px 4px;
  border: 1px solid color-mix(in srgb, var(--df-accent) 35%, transparent);
  border-radius: 3px;
  color: var(--df-accent);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.df-window-controls {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 5px;
  padding-left: 5px;
  border-left: 1px solid var(--df-border);
  -webkit-app-region: no-drag;
}

.df-window-controls__close:hover {
  --vscode-toolbar-hoverBackground: #c42b1c;
  color: #ffffff;
}

.df-workbench {
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: 0;
  overflow: hidden;
}
</style>
