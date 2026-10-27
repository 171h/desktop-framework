# Playground

`playground/app` 是一个独立的应用装配包，演示如何在不修改框架源码的情况下：

- 注册插件实验室视图；
- 通过命令元数据同时进入 Ribbon、应用菜单与快速访问工具栏；
- 保存自定义工作区；
- 向 WebGL2 画布添加内容；
- 使用框架通知与对话框。

`apps/web` 与 `apps/desktop` 都复用这个包。框架运行时拉取配置位于
`playground/desktop-framework.config.json`。
