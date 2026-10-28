# 集成到自己的软件

框架不再要求使用方长期维护 submodule。使用方只需在配置文件中声明**框架仓库**与**精确 commit**，启动器会在运行时解析、拉取并校验对应版本。

## 配置文件

在应用资源目录放置 `desktop-framework.config.json`：

```json
{
  "$schema": "https://raw.githubusercontent.com/171h/desktop-framework/main/playground/desktop-framework.schema.json",
  "framework": {
    "repository": "https://github.com/171h/desktop-framework",
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "mode": "auto",
    "entry": "index.js",
    "artifact": {
      "url": "https://github.com/171h/desktop-framework/releases/download/framework-{shortCommit}/desktop-framework-runtime-{shortCommit}.tar.gz",
      "integrity": "sha256-..."
    },
    "cache": true,
    "timeoutMs": 15000
  },
  "app": {
    "id": "com.example.myapp",
    "title": "My Application"
  }
}
```

### 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `repository` | 是 | http(s) 仓库地址 |
| `commit` | 是 | 完整 commit 或至少 7 位短哈希 |
| `mode` | 否 | `workspace`、`remote`、`auto`，默认 `auto` |
| `entry` | 否 | 归档内入口，默认 `index.js` |
| `artifact.url` | 否 | 自定义制品地址，支持 `{commit}` / `{shortCommit}` / `{repository}` |
| `artifact.integrity` | 建议 | SRI 或 `sha256:<hex>` |
| `cache` | 否 | 是否复用本地缓存，默认 true |
| `timeoutMs` | 否 | 下载超时，默认 15000 |

`mode: auto` 在远程不可用（网络、404、校验失败）时回退到宿主内置版本，并把原因写入日志；`mode: remote` 会记录错误、不静默切换到其他 commit，适合对版本一致性要求严格的生产环境（宿主渲染层仍可选择本地入口保证可用性）。

示例仓库默认使用 `mode: workspace`，保证离线开发与 CI 不依赖网络。需要验证运行时拉取时，把 `playground/desktop-framework.config.json` 替换为 `playground/desktop-framework.remote.example.json` 的内容，并填入实际 commit 与 integrity。

## 构建运行时制品

```bash
pnpm build:runtime
```

输出：

```text
packages/runtime/release/
├─ desktop-framework-runtime-<short>.tar.gz
└─ integrity.txt
```

归档结构：

```text
manifest.json    # commit、version、entry、style
index.js         # ESM 运行时
style.css        # 框架与组件样式
assets/          # WASM、字体等
```

把归档上传为 GitHub Release 资产：

```bash
gh release create framework-<short> \
  packages/runtime/release/desktop-framework-runtime-<short>.tar.gz \
  --title "Framework <short>" \
  --notes "Runtime bundle for commit <sha>"
```

`release.yml` 会自动完成这一步。

## 宿主启动流程

Electron 主进程通过 `bootstrapElectron` 启动：

```ts
import { join } from 'node:path'
import { bootstrapElectron } from '@df/electron/main'
import { app } from 'electron'

bootstrapElectron({
  appId: 'com.example.myapp',
  productName: 'My Application',
  renderer: {
    devUrl: process.env.ELECTRON_RENDERER_URL,
    file: join(__dirname, '../renderer/index.html'),
  },
  runtime: {
    configPath: app.isPackaged
      ? join(process.resourcesPath, 'desktop-framework.config.json')
      : join(app.getAppPath(), 'desktop-framework.config.json'),
  },
})
```

主进程会：

1. 读取配置；
2. 计算 `userData/framework/<commit>-<repoHash>`；
3. 命中 manifest 且 commit 匹配时直接复用；
4. 否则下载 tar.gz、校验 SHA-256、限制路径后解压；
5. 通过 `df-runtime://<shortCommit>/index.js` 暴露入口；
6. preload 的 `getRuntime()` 把入口、样式和缓存状态交给渲染进程。

渲染进程加载远程运行时：

```ts
const runtime = await window.desktopFramework?.getRuntime()
if (runtime?.mode === 'remote' && runtime.entryUrl) {
  if (runtime.styleUrl) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = runtime.styleUrl
    document.head.append(link)
  }
  const framework = await import(/* @vite-ignore */ runtime.entryUrl)
  await framework.createFrameworkApp({ el: '#app', title: 'My Application' })
}
```

如果远程不可用，加载宿主自带的 `@df/app` 即可。

## 本地开发与生产

开发时建议把 `mode` 设为 `workspace`，直接使用工作区源码，热更新最快。发布前把配置改为目标 commit 的 `remote` 或 `auto`，并填入 integrity。

## 自定义业务插件

业务能力仍然通过插件接入，不修改框架内部：

```ts
import { definePlugin } from '@df/kernel'

export default definePlugin({
  name: 'acme:review',
  inject: ['commands', 'workbench'],
  apply(ctx) {
    ctx.commands.register({
      id: 'acme.review.start',
      title: '开始审阅',
      icon: 'checklist',
      ribbon: { tab: 'review', tabTitle: '审阅', group: '流程' },
      run: () => {},
    })
  },
})
```

通过 `createFrameworkApp({ plugins: [pluginEntry(myPlugin)] })` 注入。

## 安全边界

- 只允许 http(s) 制品地址；生产建议固定域名或使用企业制品服务器。
- `integrity` 使用 SHA-256；缺失时至少校验 manifest commit。
- 归档解压拒绝绝对路径、`..` 和符号链接。
- 运行时通过只读自定义协议暴露，不能借协议读取任意本地文件。
- 远程运行时与宿主页面共享 `df-app://bundle` 源，受相同 CSP 约束。
