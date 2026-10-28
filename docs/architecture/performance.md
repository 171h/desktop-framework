# 性能策略

## 启动

- 主进程在 app ready 前完成协议注册、单实例锁与命令行开关。
- 窗口 `show: false`，`ready-to-show` 后再显示，避免白屏。
- 渲染进程资源使用 `df-app://` 加载，减少 `file://` 兼容分支与额外权限。
- 远程运行时优先读缓存；未命中时下载与解压不阻塞其他插件初始化（主进程插件按依赖顺序等待）。
- `StartupTimer` 记录阶段耗时，便于定位慢插件。

### Windows 特定项

与 VS Code 相同，在 Windows 上关闭 `CalculateNativeWinOcclusion`，避免窗口被系统判定遮挡后降频。

## 渲染

`@df/surface` 采用：

- WebGL2 单次 draw call 绘制无限网格与轴向；
- 节点卡片使用 CSS transform 合成，文本保持系统字体清晰度；
- 脏标记 + `requestAnimationFrame` 合并重绘，静止时不占 GPU；
- DPR 上限 2，避免 4K/5K 屏线性放大填充率；
- `ResizeObserver` 驱动尺寸更新，无轮询；
- 上下文丢失自动恢复；
- 绘制帧耗时、draw call、缩放与视口尺寸实时显示。

## 响应式

- 命令列表使用 `reactive(Map)`，UI 只订阅注册表变化。
- Ribbon 每次构建都读取最新 enabled/checked，避免在 Pinia 中复制状态。
- 工作区布局只在用户操作时写入；持久化使用 150ms 防抖。
- 通知与输出日志限制最大长度（输出 300 条），避免长时间运行内存膨胀。
- 插件诊断使用事件 + revision，不把内核内部 Map 变成深度响应式对象。

## Rust / WASM

`df_fuzzy`：

- 线性扫描，子序列匹配；
- 单词边界、camelCase、连续字符加分；
- 长度惩罚避免长文本淹没短命令；
- 只返回命中下标、分数与位置，不复制候选文本。

前端在 WASM 不可用时使用等价 TypeScript 实现，保证可用性。

## Electron 资源

- `DisposableStore` 统一释放窗口、协议、IPC、菜单监听器。
- 窗口关闭时保存状态；`before-quit` 先释放 Cordis，再退出。
- 权限请求默认拒绝，减少无意义系统对话框与后台能力。
- WASM 通过 `application/wasm` + `instantiateStreaming` 友好 MIME 加载。

## 大规模扩展建议

- 插件视图使用异步组件与 `markRaw`，避免 Vue 深度代理。
- 大表格使用虚拟滚动（nusys-ui 表格或自定义窗口化）。
- 远程插件按需 import，不要把所有业务塞进首屏 bundle。
- CPU 密集算法继续放入独立 Rust crate，通过 `df_wasm` 暴露，保持主线程只做 UI。
