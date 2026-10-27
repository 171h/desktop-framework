# 配置参考

## desktop-framework.config.json

```json
{
  "$schema": "./desktop-framework.schema.json",
  "framework": {
    "repository": "https://github.com/171h/desktop-framework",
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "mode": "auto",
    "entry": "index.js",
    "artifact": {
      "url": "https://.../desktop-framework-runtime-{shortCommit}.tar.gz",
      "integrity": "sha256-..."
    },
    "cache": true,
    "timeoutMs": 15000,
    "headers": {}
  },
  "app": {
    "id": "com.example.app",
    "title": "My App"
  }
}
```

## framework

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `repository` | string | — | http(s) 仓库 |
| `commit` | string | — | 完整或 ≥7 位 commit |
| `mode` | `workspace \| remote \| auto` | `auto` | 解析策略 |
| `entry` | string | `index.js` | 归档内入口 |
| `artifact.url` | string | GitHub Release 约定 | 制品地址 |
| `artifact.integrity` | string | — | SHA-256，推荐 |
| `cache` | boolean | `true` | 是否复用缓存 |
| `timeoutMs` | number | `15000` | 下载超时 |
| `headers` | object | `{}` | 自定义 HTTP 头 |

## manifest.json

运行时归档根目录必须包含：

```json
{
  "commit": "<40位 commit>",
  "version": "0.1.0",
  "entry": "index.js",
  "style": "style.css",
  "files": {}
}
```

`files` 可选的逐文件哈希用于进一步校验，当前解析器至少校验 commit 与入口存在性。

## Electron 宿主选项

```ts
bootstrapElectron({
  appId,
  productName,
  version,
  renderer: { devUrl, file, title, backgroundColor },
  window: { width, height, minWidth, minHeight, ...BrowserWindowConstructorOptions },
  runtime: { configPath, cacheDirectory, offline, headers },
  menu: MenuItemConstructorOptions[] | false,
  plugins: PluginEntry[],
  setup: (ctx) => {},
  singleInstance: true,
  crashReportUrl,
  externalProtocols: ['https:', 'http:', 'mailto:'],
})
```

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DF_OFFLINE=1` | 强制运行时解析为 workspace |
| `DF_DISABLE_GPU=1` | 关闭 Electron 硬件加速 |
| `DOCS_BASE` | VitePress 部署基路径 |
| `ELECTRON_RENDERER_URL` | electron-vite 开发服务器地址 |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Windows 代码签名 |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS 公证 |
