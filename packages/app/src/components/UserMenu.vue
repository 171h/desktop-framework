<script setup lang="ts">
import type { AccountUser } from '../account'
import { useCordis } from '@df/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const ctx = useCordis()
const user = computed<AccountUser | null>(() => ctx.account.user)
const loginOpen = ref(false)
const accountOpen = ref(false)
const error = ref('')
const nameInput = ref<HTMLInputElement>()
const form = reactive({
  name: '',
  email: '',
  password: '',
})

const avatarStyle = computed(() => ({
  background: user.value?.color ?? 'var(--df-accent)',
}))

async function openLogin(): Promise<void> {
  accountOpen.value = false
  loginOpen.value = true
  error.value = ''
  form.name = ''
  form.email = ''
  form.password = ''
  await nextTick()
  nameInput.value?.focus()
}

function closeLogin(): void {
  loginOpen.value = false
  error.value = ''
}

function submitLogin(): void {
  error.value = ''
  try {
    const account = ctx.account.login({
      name: form.name,
      email: form.email,
      password: form.password,
    })
    loginOpen.value = false
    ctx.notifications.success(`欢迎，${account.name}`)
  }
  catch (cause) {
    error.value = cause instanceof Error
      ? cause.message
      : String(cause)
  }
}

function toggleAccount(): void {
  accountOpen.value = !accountOpen.value
}

function closeAccount(): void {
  accountOpen.value = false
}

async function rename(): Promise<void> {
  if (!user.value) {
    return
  }
  const name = await ctx.ui.showPrompt({
    title: '账户资料',
    message: '修改当前账户的显示名称。',
    placeholder: '显示名称',
    value: user.value.name,
    confirmLabel: '保存',
  })
  if (!name?.trim()) {
    return
  }
  ctx.account.updateName(name)
  ctx.notifications.success('显示名称已更新')
}

async function switchAccount(): Promise<void> {
  ctx.account.logout()
  closeAccount()
  await openLogin()
}

function signOut(): void {
  const name = user.value?.name
  ctx.account.logout()
  closeAccount()
  ctx.notifications.info(name
    ? `${name} 已退出登录`
    : '已退出登录')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return
  }
  if (loginOpen.value) {
    event.preventDefault()
    closeLogin()
  }
  else if (accountOpen.value) {
    event.preventDefault()
    closeAccount()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="df-user-menu df-app-region-no-drag">
    <button
      v-if="!user"
      class="df-user-menu__login"
      type="button"
      title="登录账户"
      @click="openLogin"
    >
      <vscode-icon name="account" aria-hidden="true" />
      <span>登录</span>
    </button>
    <button
      v-else
      class="df-user-menu__avatar"
      type="button"
      :style="avatarStyle"
      :title="`${user.name} · 账户管理`"
      aria-haspopup="menu"
      :aria-expanded="accountOpen"
      @click="toggleAccount"
    >
      {{ user.initials }}
    </button>

    <Teleport to="body">
      <div v-if="loginOpen" class="df-user-menu__scrim df-user-menu__scrim--dialog" @click.self="closeLogin">
        <form class="df-user-menu__dialog" aria-label="登录" @submit.prevent="submitLogin">
          <header class="df-user-menu__dialog-header">
            <div class="df-user-menu__dialog-mark">
              <vscode-icon name="account" />
            </div>
            <div>
              <strong>登录账户</strong>
              <span>登录后可访问账户资料与快捷操作</span>
            </div>
            <button class="df-user-menu__icon-button" type="button" title="关闭登录" @click="closeLogin">
              <vscode-icon name="close" aria-hidden="true" />
            </button>
          </header>

          <div class="df-user-menu__fields">
            <label>
              <span>显示名称</span>
              <input ref="nameInput" v-model="form.name" type="text" autocomplete="name" placeholder="例如：张三">
            </label>
            <label>
              <span>邮箱</span>
              <input v-model="form.email" type="email" autocomplete="email" placeholder="name@example.com" required>
            </label>
            <label>
              <span>密码</span>
              <input v-model="form.password" type="password" autocomplete="current-password" placeholder="至少 6 个字符" required>
            </label>
            <p class="df-user-menu__hint">
              当前为本地演示账户，登录信息只保存在本机，密码不会被持久化。
            </p>
            <p v-if="error" class="df-user-menu__error" role="alert">
              {{ error }}
            </p>
          </div>

          <footer class="df-user-menu__dialog-footer">
            <button class="df-user-menu__button" type="button" @click="closeLogin">
              取消
            </button>
            <button class="df-user-menu__button df-user-menu__button--primary" type="submit">
              登录
            </button>
          </footer>
        </form>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="accountOpen && user" class="df-user-menu__scrim" @click.self="closeAccount">
        <section class="df-user-menu__panel" role="menu" aria-label="账户管理">
          <header class="df-user-menu__profile">
            <span class="df-user-menu__profile-avatar" :style="avatarStyle">{{ user.initials }}</span>
            <div>
              <strong>{{ user.name }}</strong>
              <span>{{ user.email }}</span>
            </div>
          </header>
          <div class="df-user-menu__items">
            <button type="button" role="menuitem" @click="rename">
              <vscode-icon name="edit" aria-hidden="true" />
              <span>修改显示名称</span>
            </button>
            <button type="button" role="menuitem" @click="switchAccount">
              <vscode-icon name="arrow-swap" aria-hidden="true" />
              <span>切换账户</span>
            </button>
            <button type="button" role="menuitem" @click="signOut">
              <vscode-icon name="sign-out" aria-hidden="true" />
              <span>退出登录</span>
            </button>
          </div>
          <footer class="df-user-menu__panel-footer">
            本地演示账户 · 未连接身份服务
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.df-user-menu {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.df-user-menu__login {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--df-border);
  border-radius: 5px;
  background: transparent;
  color: var(--df-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.df-user-menu__login:hover {
  border-color: var(--df-border-strong);
  background: var(--df-hover);
  color: var(--df-text);
}

.df-user-menu__avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--df-text) 18%, transparent);
  border-radius: 50%;
  color: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
}

.df-user-menu__avatar:hover {
  filter: brightness(1.12);
}

.df-user-menu__scrim {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: transparent;
}

.df-user-menu__scrim--dialog {
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 42%);
  backdrop-filter: blur(3px);
}

.df-user-menu__dialog {
  display: flex;
  flex-direction: column;
  width: min(420px, calc(100vw - 40px));
  border: 1px solid var(--df-border-strong);
  border-radius: 10px;
  background: var(--df-elevated);
  box-shadow: 0 24px 80px rgb(0 0 0 / 55%);
  overflow: hidden;
}

.df-user-menu__dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(120deg, color-mix(in srgb, var(--df-accent) 10%, var(--df-elevated)), var(--df-elevated));
}

.df-user-menu__dialog-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--df-accent) 32%, var(--df-border));
  border-radius: 9px;
  background: color-mix(in srgb, var(--df-accent) 10%, transparent);
  color: var(--df-accent);
  font-size: 20px;
}

.df-user-menu__dialog-header > div:nth-child(2) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.df-user-menu__dialog-header strong {
  font-size: 15px;
  font-weight: 600;
}

.df-user-menu__dialog-header span {
  color: var(--df-muted);
  font-size: 10.5px;
}

.df-user-menu__icon-button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--df-muted);
  cursor: pointer;
}

.df-user-menu__icon-button:hover {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-user-menu__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
}

.df-user-menu__fields label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--df-muted);
  font-size: 10px;
  font-weight: 600;
}

.df-user-menu__fields input {
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--df-border);
  border-radius: 5px;
  outline: none;
  background: var(--df-canvas);
  color: var(--df-text);
  font: inherit;
  font-size: 12px;
}

.df-user-menu__fields input:focus {
  border-color: var(--df-accent);
  box-shadow: 0 0 0 1px var(--df-accent);
}

.df-user-menu__hint {
  margin: 0;
  color: var(--df-faint);
  font-size: 10px;
  line-height: 1.6;
}

.df-user-menu__error {
  margin: 0;
  color: var(--df-danger);
  font-size: 11px;
}

.df-user-menu__dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--df-border);
  background: color-mix(in srgb, var(--df-surface) 45%, transparent);
}

.df-user-menu__button {
  height: 30px;
  padding: 0 16px;
  border: 1px solid var(--df-border);
  border-radius: 5px;
  background: transparent;
  color: var(--df-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.df-user-menu__button:hover {
  background: var(--df-hover);
}

.df-user-menu__button--primary {
  border-color: var(--df-accent);
  background: var(--df-accent);
  color: #17130b;
  font-weight: 600;
}

.df-user-menu__button--primary:hover {
  background: color-mix(in srgb, var(--df-accent) 86%, #fff);
}

.df-user-menu__panel {
  position: fixed;
  top: 42px;
  right: 10px;
  width: 276px;
  border: 1px solid var(--df-border-strong);
  border-radius: 8px;
  background: var(--df-elevated);
  box-shadow: 0 18px 52px rgb(0 0 0 / 48%);
  overflow: hidden;
}

.df-user-menu__profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid var(--df-border);
  background: linear-gradient(120deg, color-mix(in srgb, var(--df-accent) 8%, var(--df-elevated)), var(--df-elevated));
}

.df-user-menu__profile-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  height: 34px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.df-user-menu__profile > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.df-user-menu__profile strong,
.df-user-menu__profile span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.df-user-menu__profile strong {
  font-size: 12px;
  font-weight: 600;
}

.df-user-menu__profile span {
  color: var(--df-muted);
  font-size: 10px;
}

.df-user-menu__items {
  display: flex;
  flex-direction: column;
  padding: 5px;
}

.df-user-menu__items button {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--df-muted);
  font: inherit;
  font-size: 11.5px;
  text-align: left;
  cursor: pointer;
}

.df-user-menu__items button:hover {
  background: var(--df-hover);
  color: var(--df-text);
}

.df-user-menu__panel-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--df-border);
  color: var(--df-faint);
  font-size: 9.5px;
}
</style>
