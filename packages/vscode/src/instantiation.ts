export { SyncDescriptor } from 'vscode-instantiation/instantiation/descriptors'
export {
  getSingletonServiceDescriptors,
  registerSingleton,
} from 'vscode-instantiation/instantiation/extensions'
/**
 * VS Code 实例化服务适配。
 *
 * 框架主链路使用 Cordis 作为插件容器；需要复用 VS Code 生态的服务类时，
 * 可以使用这里的 `InstantiationService` 与 `ServiceCollection`。
 */
export {
  _util,
  createDecorator,
  refineServiceDecorator,
} from 'vscode-instantiation/instantiation/instantiation'
export type { IInstantiationService } from 'vscode-instantiation/instantiation/instantiation'
export { InstantiationService } from 'vscode-instantiation/instantiation/instantiationService'
export { ServiceCollection } from 'vscode-instantiation/instantiation/serviceCollection'
