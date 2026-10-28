/**
 * @df/app · 本地账户
 *
 * 当前版本不连接远端身份服务：登录信息只保存在本机，用于演示账户入口、
 * 头像和账户管理菜单。密码不会持久化。
 */
import type { Context } from 'cordis'
import { Service } from 'cordis'
import { ref } from 'vue'

declare module 'cordis' {
  interface Context {
    account: AccountService
  }
}

export interface AccountUser {
  id: string
  name: string
  email: string
  initials: string
  color: string
}

export interface LoginInput {
  name?: string
  email: string
  password: string
}

const USER_KEY = 'account.user'
const COLORS = [
  '#c8913f',
  '#4c8bd8',
  '#46a07a',
  '#b46ac8',
  '#d26464',
  '#5d9aa8',
]

export class AccountService extends Service {
  static inject = ['storage']

  private readonly current = ref<AccountUser | null>(null)

  constructor(ctx: Context) {
    super(ctx, 'account')
    this.current.value = this.ctx.storage.get<AccountUser | null>(USER_KEY, null)
  }

  get user(): AccountUser | null {
    return this.current.value
  }

  get signedIn(): boolean {
    return Boolean(this.current.value)
  }

  get avatarColor(): string {
    return this.current.value?.color ?? COLORS[0]
  }

  /** 本地演示登录；密码只用于本次校验，不写入存储。 */
  login(input: LoginInput): AccountUser {
    const email = input.email.trim()
    const [local, domain] = email.split('@')
    if (!local || !domain || !domain.includes('.') || /\s/.test(email)) {
      throw new Error('请输入有效的邮箱地址')
    }
    if (input.password.length < 6) {
      throw new Error('密码至少需要 6 个字符')
    }
    const name = input.name?.trim() || email.split('@')[0]
    const user: AccountUser = {
      id: email.toLowerCase(),
      name,
      email,
      initials: initialsOf(name, email),
      color: colorOf(email),
    }
    this.current.value = user
    this.ctx.storage.set(USER_KEY, user)
    return user
  }

  /** 修改显示名称。 */
  updateName(name: string): AccountUser | null {
    const user = this.current.value
    const trimmed = name.trim()
    if (!user || !trimmed) {
      return user
    }
    const next: AccountUser = {
      ...user,
      name: trimmed,
      initials: initialsOf(trimmed, user.email),
    }
    this.current.value = next
    this.ctx.storage.set(USER_KEY, next)
    return next
  }

  /** 退出当前账户。 */
  logout(): void {
    this.current.value = null
    this.ctx.storage.remove(USER_KEY)
  }
}

function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  const source = parts[0] || email
  return source.slice(0, 2).toUpperCase()
}

function colorOf(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return COLORS[hash % COLORS.length]
}

export const name = 'framework:account'
export const inject = ['storage']

export function apply(ctx: Context): void {
  ctx.plugin(AccountService)
}

export default { name, inject, apply }
