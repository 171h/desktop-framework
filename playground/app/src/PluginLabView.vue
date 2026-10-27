<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'

const ctx = useCordis()

function execute(command: string): void {
  void ctx.commands.execute(command).catch(() => {})
}
</script>

<template>
  <div class="lab">
    <header class="lab__hero">
      <div class="lab__icon">
        <vscode-icon name="beaker" />
      </div>
      <div>
        <h3>插件实验室</h3>
        <p>这个视图、Ribbon 页签与命令都来自 <code>playground/app</code> 插件。</p>
      </div>
    </header>

    <vscode-collapsible heading="可执行操作" open>
      <div class="lab__actions">
        <vscode-button secondary block icon="add" @click="execute('playground.addNode')">
          添加画布卡片
        </vscode-button>
        <vscode-button secondary block icon="bell" @click="execute('playground.notify')">
          发送通知
        </vscode-button>
        <vscode-button secondary block icon="save" @click="execute('playground.saveWorkspace')">
          保存工作区
        </vscode-button>
      </div>
    </vscode-collapsible>

    <vscode-collapsible heading="扩展点" open>
      <ul class="lab__list">
        <li><code>ctx.commands.register()</code> 添加命令与 Ribbon 放置。</li>
        <li><code>ctx.workbench.registerView()</code> 添加停靠视图。</li>
        <li><code>ctx.surface.addNode()</code> 向画布写入内容。</li>
        <li><code>ctx.ui.registerSlot()</code> 注入任意界面区域。</li>
        <li><code>ctx.notifications</code> 统一反馈。</li>
      </ul>
    </vscode-collapsible>

    <vscode-collapsible heading="运行时状态">
      <dl class="lab__stats">
        <div><dt>插件</dt><dd>{{ ctx.kernel.plugins.length }}</dd></div>
        <div><dt>命令</dt><dd>{{ ctx.commands.list.length }}</dd></div>
        <div><dt>WASM</dt><dd>{{ ctx.wasm.status }}</dd></div>
        <div><dt>主题</dt><dd>{{ ctx.ui.theme }}</dd></div>
      </dl>
    </vscode-collapsible>
  </div>
</template>

<style scoped>
.lab {
  height: 100%;
  overflow: auto;
  background: var(--df-surface);
}

.lab__hero {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(150deg, color-mix(in srgb, var(--df-accent) 8%, var(--df-surface)), var(--df-surface) 65%);
}

.lab__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--df-accent) 30%, var(--df-border));
  border-radius: 5px;
  background: var(--df-elevated);
  color: var(--df-accent);
}

.lab__hero h3 {
  margin: 0 0 4px;
  font-size: 14px;
}

.lab__hero p {
  margin: 0;
  color: var(--df-muted);
  font-size: 10.5px;
  line-height: 1.6;
}

.lab__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.lab__list {
  margin: 0;
  padding: 10px 18px 16px 28px;
  color: var(--df-muted);
  font-size: 10.5px;
  line-height: 1.8;
}

.lab__list code,
.lab__hero code {
  color: var(--df-accent);
  font-family: var(--vscode-editor-font-family);
}

.lab__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  background: var(--df-border);
}

.lab__stats div {
  padding: 10px 12px;
  background: var(--df-surface);
}

.lab__stats dt {
  color: var(--df-faint);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lab__stats dd {
  margin: 3px 0 0;
  color: var(--df-text);
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
}
</style>
