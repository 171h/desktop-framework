<script setup lang="ts">
import AppMenu from '@desktop-framework/menu/AppMenu.vue'
import QuickAccess from '@desktop-framework/menu/QuickAccess.vue'
import NotificationStack from '@desktop-framework/notifications/NotificationStack.vue'
import RibbonBar from '@desktop-framework/ribbon/RibbonBar.vue'
import StatusBar from '@desktop-framework/statusbar/StatusBar.vue'
import { DfPromptDialog, DfSlot } from '@desktop-framework/ui'
import { useCordis } from '@desktop-framework/vue'
import { computed, watch } from 'vue'
import appIcon from './assets/icon.png'
import CommandPalette from './components/CommandPalette.vue'
import WorkspaceBody from './components/WorkspaceBody.vue'
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue'

const ctx = useCordis()
const isMac = computed(() => ctx.platform.platform === 'darwin')
const layout = computed(() => ctx.workbench.layout)

// Windows/Linux 的原生窗口控制按钮由 titleBarOverlay 绘制。主题变化时同步
// 覆盖层颜色，避免浅色主题下出现一块深色标题栏。
watch(
  () => ctx.ui.resolvedTheme,
  (theme) => {
    if (!ctx.platform.isElectron || isMac.value) {
      return
    }
    void ctx.platform.setTitleBarOverlay({
      color: theme === 'dark'
        ? '#101215'
        : '#f4f6f8',
      symbolColor: theme === 'dark'
        ? '#e7e9ec'
        : '#20242a',
      height: 38,
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="df-app" :class="{ 'is-mac': isMac }">
    <header class="df-titlebar df-app-region-drag">
      <div class="df-titlebar__left">
        <img class="df-brand" :src="appIcon" alt="Desktop Framework" draggable="false">
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
  padding-top: 0;
  padding-right: calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 6px);
  padding-bottom: 0;
  padding-left: calc(env(titlebar-area-x, 0px) + 10px);
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
  width: 20px;
  height: 20px;
  margin-right: 4px;
  border-radius: 4px;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
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

.df-workbench {
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: 0;
  overflow: hidden;
}
</style>
