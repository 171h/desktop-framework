/**
 * @desktop-framework/surface · 无限画布服务
 *
 * 画布数据与相机状态放在服务中，视图只负责渲染与手势。插件可以调用
 * `addNode` / `moveNode` 扩展画布内容，选择状态通过全局 selection 服务共享。
 */
import type { Context } from 'cordis'
import type { GridMetrics } from './renderer'
import { clamp } from '@desktop-framework/core'
import { Service } from 'cordis'
import { computed, markRaw, reactive, ref } from 'vue'
import SurfaceView from './SurfaceView.vue'

declare module 'cordis' {
  interface Context {
    surface: SurfaceService
  }
}

export type SurfaceTone = 'amber' | 'blue' | 'teal' | 'slate' | 'rose'

export interface SurfaceNode {
  id: string
  title: string
  subtitle?: string
  category: string
  tone: SurfaceTone
  x: number
  y: number
  width: number
  height: number
  meta?: Record<string, string>
}

export interface SurfaceConnection {
  from: string
  to: string
  tone?: SurfaceTone
}

export interface SurfaceCamera {
  x: number
  y: number
  zoom: number
}

export interface SurfaceViewport {
  width: number
  height: number
  dpr: number
}

const DEFAULT_NODES: SurfaceNode[] = [
  {
    id: 'shell',
    title: 'Application Shell',
    subtitle: '标题栏 · Ribbon · 状态栏',
    category: '框架',
    tone: 'amber',
    x: -390,
    y: -176,
    width: 236,
    height: 108,
    meta: { module: 'packages/app', role: 'layout' },
  },
  {
    id: 'kernel',
    title: 'Cordis Kernel',
    subtitle: '插件生命周期与依赖注入',
    category: '内核',
    tone: 'rose',
    x: -78,
    y: -258,
    width: 220,
    height: 108,
    meta: { module: 'packages/kernel', role: 'runtime' },
  },
  {
    id: 'commands',
    title: 'Command Registry',
    subtitle: '唯一交互入口',
    category: '命令',
    tone: 'blue',
    x: 236,
    y: -190,
    width: 230,
    height: 108,
    meta: { module: 'packages/commands', role: 'service' },
  },
  {
    id: 'ribbon',
    title: 'Command Ribbon',
    subtitle: '从命令元数据生成工具栏',
    category: '界面',
    tone: 'blue',
    x: 286,
    y: 20,
    width: 238,
    height: 108,
    meta: { module: 'packages/ribbon', role: 'toolbar' },
  },
  {
    id: 'workspace',
    title: 'Workspace Presets',
    subtitle: '可保存的停靠布局',
    category: '工作区',
    tone: 'teal',
    x: -324,
    y: 52,
    width: 230,
    height: 108,
    meta: { module: 'packages/workbench', role: 'layout' },
  },
  {
    id: 'ui',
    title: 'nusys-ui',
    subtitle: 'Web Components 设计系统',
    category: 'UI',
    tone: 'teal',
    x: -18,
    y: 10,
    width: 212,
    height: 108,
    meta: { module: 'submodules/nusys-ui', role: 'design-system' },
  },
  {
    id: 'electron',
    title: 'Electron Host',
    subtitle: '窗口 · 协议 · IPC',
    category: '桌面',
    tone: 'slate',
    x: 44,
    y: 222,
    width: 220,
    height: 108,
    meta: { module: 'packages/electron', role: 'host' },
  },
  {
    id: 'wasm',
    title: 'WASM Hot Paths',
    subtitle: '模糊搜索与批量计算',
    category: '性能',
    tone: 'amber',
    x: -280,
    y: 250,
    width: 220,
    height: 108,
    meta: { module: 'crates/df_fuzzy', role: 'compute' },
  },
]

const DEFAULT_CONNECTIONS: SurfaceConnection[] = [
  { from: 'shell', to: 'kernel' },
  { from: 'shell', to: 'workspace', tone: 'teal' },
  { from: 'kernel', to: 'commands', tone: 'rose' },
  { from: 'commands', to: 'ribbon', tone: 'blue' },
  { from: 'ui', to: 'shell', tone: 'teal' },
  { from: 'workspace', to: 'ui', tone: 'teal' },
  { from: 'electron', to: 'shell' },
  { from: 'wasm', to: 'commands', tone: 'amber' },
]

export class SurfaceService extends Service {
  static inject = [
    'commands',
    'editor',
    'selection',
    'statusbar',
  ]

  readonly nodesRef = ref<SurfaceNode[]>(structuredClone(DEFAULT_NODES))
  readonly connections = ref<SurfaceConnection[]>(structuredClone(DEFAULT_CONNECTIONS))
  readonly cameraRef = ref<SurfaceCamera>({ x: 0, y: 0, zoom: 1 })
  readonly viewport = reactive<SurfaceViewport>({ width: 0, height: 0, dpr: 1 })
  readonly stats = reactive<GridMetrics>({ renderer: 'unavailable', frameMs: 0, drawCalls: 0 })
  readonly selected = computed(() => {
    const item = this.ctx.selection.current.value
    if (item?.kind !== 'surface.node') {
      return undefined
    }
    return this.nodesRef.value.find(node => node.id === item.id)
  })

  private lastNode = 0

  constructor(ctx: Context) {
    super(ctx, 'surface')
    ctx.effect(() => {
      const registration = ctx.editor.open({
        id: 'surface',
        title: '工作流画布',
        icon: 'symbol-color',
        component: markRaw(SurfaceView),
        closable: false,
        pinned: true,
      })
      return () => registration.dispose()
    }, 'surface:document')
    ctx.effect(() => ctx.statusbar.register({
      id: 'surface.zoom',
      alignment: 'right',
      icon: 'zoom-in',
      text: '100%',
      tooltip: '画布缩放',
      getText: () => `${Math.round(this.cameraRef.value.zoom * 100)}%`,
      command: 'surface.fitView',
    }).dispose, 'surface:status-zoom')
    ctx.effect(() => ctx.statusbar.register({
      id: 'surface.selection',
      alignment: 'right',
      icon: 'selection',
      text: '无选择',
      tooltip: '当前选择',
      getText: () => this.selected.value?.title ?? '无选择',
    }).dispose, 'surface:status-selection')
    this.registerCommands()
  }

  get nodes(): readonly SurfaceNode[] {
    return this.nodesRef.value
  }

  get links(): readonly SurfaceConnection[] {
    return this.connections.value
  }

  get camera(): SurfaceCamera {
    return this.cameraRef.value
  }

  get selectedNode(): SurfaceNode | undefined {
    return this.selected.value
  }

  /** 更新视口尺寸。 */
  setViewport(width: number, height: number, dpr: number): void {
    this.viewport.width = width
    this.viewport.height = height
    this.viewport.dpr = dpr
  }

  /** 更新渲染统计。 */
  setStats(metrics: GridMetrics): void {
    Object.assign(this.stats, metrics)
  }

  /** 平移。 */
  panBy(dx: number, dy: number): void {
    this.cameraRef.value = {
      ...this.cameraRef.value,
      x: this.cameraRef.value.x + dx,
      y: this.cameraRef.value.y + dy,
    }
  }

  /** 以视口坐标为锚点缩放。 */
  zoomAt(cursorX: number, cursorY: number, factor: number): void {
    const camera = this.cameraRef.value
    const nextZoom = clamp(camera.zoom * factor, 0.35, 2.4)
    if (nextZoom === camera.zoom) {
      return
    }
    const centerX = this.viewport.width / 2
    const centerY = this.viewport.height / 2
    const worldX = (cursorX - centerX - camera.x) / camera.zoom
    const worldY = (cursorY - centerY - camera.y) / camera.zoom
    this.cameraRef.value = {
      zoom: nextZoom,
      x: cursorX - centerX - worldX * nextZoom,
      y: cursorY - centerY - worldY * nextZoom,
    }
  }

  /** 以中心缩放。 */
  zoomBy(factor: number): void {
    this.zoomAt(this.viewport.width / 2, this.viewport.height / 2, factor)
  }

  /** 重置到 100% 与原点。 */
  resetView(): void {
    this.cameraRef.value = { x: 0, y: 0, zoom: 1 }
  }

  /** 适配全部节点。 */
  fitView(): void {
    if (this.nodesRef.value.length === 0 || this.viewport.width <= 0) {
      this.resetView()
      return
    }
    const minX = Math.min(...this.nodesRef.value.map(node => node.x))
    const maxX = Math.max(...this.nodesRef.value.map(node => node.x + node.width))
    const minY = Math.min(...this.nodesRef.value.map(node => node.y))
    const maxY = Math.max(...this.nodesRef.value.map(node => node.y + node.height))
    const padding = 120
    const zoom = clamp(
      Math.min(
        (this.viewport.width - padding * 2) / Math.max(maxX - minX, 1),
        (this.viewport.height - padding * 2) / Math.max(maxY - minY, 1),
      ),
      0.35,
      1.6,
    )
    this.cameraRef.value = {
      zoom,
      x: -((minX + maxX) / 2) * zoom,
      y: -((minY + maxY) / 2) * zoom,
    }
  }

  /** 选中节点。 */
  selectNode(id: string): void {
    const node = this.nodesRef.value.find(candidate => candidate.id === id)
    if (!node) {
      return
    }
    this.ctx.selection.select({
      id: node.id,
      kind: 'surface.node',
      label: node.title,
      description: node.subtitle,
      data: {
        category: node.category,
        module: node.meta?.module ?? '',
        tone: node.tone,
        x: Math.round(node.x),
        y: Math.round(node.y),
        width: node.width,
        height: node.height,
      },
    })
  }

  /** 移动节点（世界坐标）。 */
  moveNode(id: string, x: number, y: number): void {
    const node = this.nodesRef.value.find(candidate => candidate.id === id)
    if (node) {
      node.x = x
      node.y = y
    }
  }

  /** 添加节点。 */
  addNode(input: Partial<Omit<SurfaceNode, 'id'>> = {}): SurfaceNode {
    const index = ++this.lastNode
    const zoom = this.cameraRef.value.zoom
    const centerX = (-this.cameraRef.value.x) / zoom
    const centerY = (-this.cameraRef.value.y) / zoom
    const tones: SurfaceTone[] = [
      'amber',
      'blue',
      'teal',
      'slate',
      'rose',
    ]
    const node: SurfaceNode = {
      id: `node-${Date.now().toString(36)}-${index}`,
      title: input.title ?? `扩展卡片 ${index}`,
      subtitle: input.subtitle ?? '由插件通过 SurfaceService 添加',
      category: input.category ?? '扩展',
      tone: input.tone ?? tones[index % tones.length],
      x: input.x ?? centerX - 110 + (index % 3) * 18,
      y: input.y ?? centerY - 54 + (index % 3) * 18,
      width: input.width ?? 220,
      height: input.height ?? 108,
      meta: input.meta,
    }
    this.nodesRef.value = [...this.nodesRef.value, node]
    this.selectNode(node.id)
    return node
  }

  /** 删除节点。 */
  removeNode(id: string): boolean {
    const before = this.nodesRef.value.length
    this.nodesRef.value = this.nodesRef.value.filter(node => node.id !== id)
    this.connections.value = this.connections.value.filter(link => link.from !== id && link.to !== id)
    if (this.ctx.selection.isSelected('surface.node', id)) {
      this.ctx.selection.clear()
    }
    return this.nodesRef.value.length !== before
  }

  private registerCommands(): void {
    const commands = [
      {
        id: 'surface.addNode',
        title: '添加画布卡片',
        category: '画布',
        icon: 'add',
        toolbar: { order: 10 },
        ribbon: {
          tab: 'home',
          tabTitle: '主页',
          tabOrder: 0,
          group: '画布',
          order: 0,
          size: 'half' as const,
        },
        menu: {
          path: ['编辑'],
          order: 10,
        },
        run: () => {
          this.addNode()
        },
      },
      {
        id: 'surface.fitView',
        title: '适应全部内容',
        category: '画布',
        icon: 'screen-full',
        toolbar: { order: 20 },
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '画布',
          order: 0,
          size: 'half' as const,
        },
        menu: {
          path: ['视图'],
          order: 10,
        },
        run: () => this.fitView(),
      },
      {
        id: 'surface.resetView',
        title: '重置画布视图',
        category: '画布',
        icon: 'home',
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '画布',
          order: 1,
          size: 'half' as const,
        },
        menu: {
          path: ['视图'],
          order: 11,
        },
        run: () => this.resetView(),
      },
      {
        id: 'surface.zoomIn',
        title: '放大画布',
        category: '画布',
        icon: 'zoom-in',
        keybinding: 'Mod+=',
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '画布',
          order: 2,
          size: 'third' as const,
        },
        run: () => this.zoomBy(1.2),
      },
      {
        id: 'surface.zoomOut',
        title: '缩小画布',
        category: '画布',
        icon: 'zoom-out',
        keybinding: 'Mod+-',
        ribbon: {
          tab: 'view',
          tabTitle: '视图',
          tabOrder: 20,
          group: '画布',
          order: 3,
          size: 'third' as const,
        },
        run: () => this.zoomBy(1 / 1.2),
      },
      {
        id: 'surface.deleteNode',
        title: '删除选中卡片',
        category: '画布',
        icon: 'trash',
        keybinding: 'Delete',
        enabled: () => Boolean(this.selected.value),
        menu: {
          path: ['编辑'],
          order: 20,
        },
        run: () => {
          const node = this.selected.value
          if (node) {
            this.removeNode(node.id)
          }
        },
      },
    ]
    for (const command of commands) {
      this.ctx.effect(() => {
        const registration = this.ctx.commands.register(command)
        return () => registration.dispose()
      }, `surface:${command.id}`)
    }
  }
}

export const name = 'framework:surface'
export const inject = [
  'commands',
  'editor',
  'selection',
  'statusbar',
]

export function apply(ctx: Context): void {
  ctx.plugin(SurfaceService)
}

export default { name, inject, apply }
