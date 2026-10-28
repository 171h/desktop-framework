<script setup lang="ts">
import { useCordis } from '@desktop-framework/vue'
import { computed } from 'vue'

const ctx = useCordis()
const workspace = computed(() => ctx.workbench.activeWorkspace)

function closeActive(): void {
  const id = ctx.editor.activeId
  if (id) {
    ctx.editor.close(id)
  }
}

function cycleTheme(): void {
  void ctx.commands.execute('ui.theme.cycle')
}

function saveWorkspace(): void {
  void ctx.commands.execute('workbench.saveWorkspace')
}
</script>

<template>
  <div class="df-welcome">
    <div class="df-welcome__hero">
      <div class="df-welcome__mark">
        <vscode-icon name="symbol-color" size="large" />
      </div>
      <div>
        <p class="df-welcome__eyebrow">
          DESKTOP FRAMEWORK
        </p>
        <h2>工作台已就绪</h2>
        <p class="df-welcome__lead">
          当前工作区为「{{ workspace.name }}」。文档以 VS Code 风格标签页呈现，
          支持拖拽排序、溢出滚动、中键关闭、固定与右键菜单。
        </p>
      </div>
    </div>

    <div class="df-welcome__actions">
      <vscode-button icon="search" @click="ctx.ui.togglePalette(true)">
        打开命令面板
      </vscode-button>
      <vscode-button secondary icon="symbol-color" @click="ctx.editor.next()">
        切换标签页
      </vscode-button>
      <vscode-button secondary icon="close" @click="closeActive">
        关闭当前标签页
      </vscode-button>
      <vscode-button secondary icon="color-mode" @click="cycleTheme">
        切换主题
      </vscode-button>
      <vscode-button secondary icon="save" @click="saveWorkspace">
        保存工作区
      </vscode-button>
    </div>

    <div class="df-welcome__grid">
      <section class="df-welcome__card">
        <h3><vscode-icon name="keyboard" /> 标签页快捷键</h3>
        <dl>
          <dt><kbd>Ctrl</kbd> + <kbd>W</kbd></dt>
          <dd>关闭当前标签页</dd>
          <dt><kbd>Ctrl</kbd> + <kbd>Tab</kbd></dt>
          <dd>切换到下一个标签页</dd>
          <dt><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd></dt>
          <dd>切换到上一个标签页</dd>
          <dt>鼠标中键</dt>
          <dd>关闭指针下的标签页</dd>
        </dl>
      </section>

      <section class="df-welcome__card">
        <h3><vscode-icon name="layout" /> 交互方式</h3>
        <ul>
          <li>拖拽标签页调整顺序，固定标签会保持在最左侧。</li>
          <li>标签过多时水平滚动，不会挤压主工作区。</li>
          <li>右键标签页可关闭其他、关闭右侧或固定标签页。</li>
          <li>功能区标签可放在标题栏或独立一行，默认在标题栏。</li>
        </ul>
      </section>

      <section class="df-welcome__card">
        <h3><vscode-icon name="extensions" /> 插件扩展</h3>
        <p>
          任何插件都可以通过
          <code>ctx.editor.open()</code>
          打开文档；文档组件、标题、图标、固定与脏状态均由服务统一管理。
        </p>
        <p class="df-welcome__hint">
          在 Ribbon 的「功能区」组中切换标签栏位置，即可验证两种布局。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.df-welcome {
  height: 100%;
  overflow: auto;
  padding: 36px 44px 48px;
  color: var(--df-text);
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--df-accent) 8%, transparent), transparent 42%),
    var(--df-canvas);
}

.df-welcome__hero {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  max-width: 920px;
  margin: 0 auto;
}

.df-welcome__mark {
  display: grid;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--df-accent) 38%, var(--df-border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--df-accent) 12%, var(--df-surface));
  color: var(--df-accent);
}

.df-welcome__eyebrow {
  margin: 0 0 6px;
  color: var(--df-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.df-welcome h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.df-welcome__lead {
  max-width: 680px;
  margin: 8px 0 0;
  color: var(--df-muted);
  font-size: 12px;
  line-height: 1.8;
}

.df-welcome__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 920px;
  margin: 24px auto 0;
}

.df-welcome__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  max-width: 920px;
  margin: 24px auto 0;
}

.df-welcome__card {
  padding: 16px 18px;
  border: 1px solid var(--df-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--df-surface) 74%, transparent);
}

.df-welcome__card h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 650;
}

.df-welcome__card h3 vscode-icon {
  color: var(--df-accent);
}

.df-welcome__card dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  margin: 0;
  font-size: 11px;
}

.df-welcome__card dt {
  color: var(--df-faint);
}

.df-welcome__card dd {
  margin: 0;
  color: var(--df-muted);
}

.df-welcome__card ul {
  margin: 0;
  padding-left: 18px;
  color: var(--df-muted);
  font-size: 11px;
  line-height: 1.9;
}

.df-welcome__card p {
  margin: 0;
  color: var(--df-muted);
  font-size: 11px;
  line-height: 1.8;
}

.df-welcome__card code {
  padding: 1px 4px;
  border: 1px solid var(--df-border);
  border-radius: 4px;
  background: var(--df-canvas);
  color: var(--df-text);
  font-family: var(--vscode-editor-font-family);
  font-size: 10px;
}

.df-welcome__hint {
  margin-top: 10px !important;
  color: var(--df-faint) !important;
}

kbd {
  padding: 1px 4px;
  border: 1px solid var(--df-border);
  border-radius: 3px;
  background: var(--df-canvas);
  color: var(--df-text);
  font-family: var(--vscode-editor-font-family);
  font-size: 9px;
}
</style>
