<script setup lang="ts">
import { useCordis } from '@df/vue'

const ctx = useCordis()

function execute(command: string): void {
  ctx.menu.close()
  void ctx.commands.execute(command).catch(() => {})
}

function applyWorkspace(id: string): void {
  ctx.workbench.applyWorkspace(id)
  ctx.menu.close()
}
</script>

<template>
  <div class="df-app-menu">
    <vscode-button
      class="df-app-menu__trigger"
      secondary
      icon="menu"
      @click="ctx.menu.toggle()"
    >
      应用
    </vscode-button>
    <Teleport to="body">
      <div v-if="ctx.menu.visible" class="df-app-menu__scrim" @click.self="ctx.menu.close()">
        <section class="df-app-menu__panel" aria-label="应用菜单">
          <header class="df-app-menu__brand">
            <div class="df-app-menu__mark">
              DF
            </div>
            <div>
              <strong>Desktop Framework</strong>
              <span>可组合桌面应用工作台</span>
            </div>
            <vscode-toolbar-button icon="close" label="关闭应用菜单" @click="ctx.menu.close()" />
          </header>

          <div class="df-app-menu__columns">
            <div v-for="section in ctx.menu.sections" :key="section.id" class="df-app-menu__section">
              <h3>{{ section.label }}</h3>
              <vscode-button
                v-for="item in section.items"
                :key="item.id"
                class="df-app-menu__item"
                secondary
                block
                :icon="item.icon"
                :disabled="item.disabled"
                @click="execute(item.command)"
              >
                <span>{{ item.label }}</span>
                <span v-if="item.keybinding" class="df-app-menu__key">{{ item.keybinding }}</span>
              </vscode-button>
            </div>

            <div class="df-app-menu__section">
              <h3>工作区</h3>
              <vscode-button
                v-for="workspace in ctx.workbench.workspaces"
                :key="workspace.id"
                class="df-app-menu__item"
                secondary
                block
                icon="multiple-windows"
                @click="applyWorkspace(workspace.id)"
              >
                <span>{{ workspace.name }}</span>
                <span v-if="workspace.id === ctx.workbench.activeWorkspace.id" class="df-app-menu__key">当前</span>
              </vscode-button>
            </div>
          </div>

          <footer class="df-app-menu__footer">
            <span>命令、菜单、Ribbon 与快捷键共享同一注册表</span>
            <span class="df-meta">{{ ctx.kernel.plugins.length }} 个插件</span>
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
  -webkit-app-region: no-drag;
}

.df-app-menu__trigger {
  --vscode-button-secondaryBackground: transparent;
  --vscode-button-secondaryHoverBackground: var(--df-hover);
  --vscode-button-secondaryForeground: var(--df-text);
  height: 26px;
  padding-inline: 8px;
}

.df-app-menu__scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  padding: 44px 0 0 12px;
  background: rgb(0 0 0 / 30%);
}

.df-app-menu__panel {
  display: flex;
  flex-direction: column;
  width: min(780px, calc(100vw - 24px));
  max-height: min(620px, calc(100vh - 80px));
  border: 1px solid var(--df-border-strong);
  border-radius: 6px;
  background: var(--df-elevated);
  box-shadow: 0 24px 72px rgb(0 0 0 / 45%);
  overflow: hidden;
}

.df-app-menu__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(120deg, color-mix(in srgb, var(--df-accent) 10%, var(--df-elevated)), var(--df-elevated));
}

.df-app-menu__brand > div:nth-child(2) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.df-app-menu__brand strong {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.df-app-menu__brand span {
  color: var(--df-muted);
  font-size: 11px;
}

.df-app-menu__mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 5px;
  background: var(--df-accent);
  color: #17130b;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.df-app-menu__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 18px 24px;
  padding: 18px;
  overflow: auto;
}

.df-app-menu__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.df-app-menu__section h3 {
  margin: 0 0 4px;
  padding: 0 2px;
  color: var(--df-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.df-app-menu__item {
  --vscode-button-secondaryBackground: transparent;
  --vscode-button-secondaryHoverBackground: var(--df-hover);
  --vscode-button-secondaryForeground: var(--df-text);
  justify-content: flex-start;
  height: 30px;
  padding-inline: 8px;
}

.df-app-menu__item span:first-child {
  flex: 1;
  text-align: left;
}

.df-app-menu__key {
  margin-left: 12px;
  color: var(--df-faint);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
}

.df-app-menu__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  border-top: 1px solid var(--df-border);
  color: var(--df-faint);
  font-size: 10px;
}
</style>
