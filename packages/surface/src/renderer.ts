/**
 * WebGL2 无限网格渲染器。
 *
 * 只负责背景网格与轴向提示。节点卡片由 GPU 合成的 CSS transform 渲染，
 * 文本保持系统字体清晰度；这样既避免了 WebGL 字形图集，也能在大量卡片时
 * 维持滚动与缩放流畅度。
 */
export interface GridCamera {
  x: number
  y: number
  zoom: number
}

export interface GridMetrics {
  renderer: 'webgl2' | 'unavailable'
  frameMs: number
  drawCalls: number
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_pan;
uniform float u_zoom;
uniform float u_dpr;
uniform vec3 u_background;
uniform vec3 u_grid;
uniform vec3 u_major;
uniform vec3 u_axis;

float gridLine(vec2 world, float spacing) {
  vec2 coord = world / spacing;
  vec2 derivative = fwidth(coord);
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / max(derivative, vec2(1e-5));
  return 1.0 - min(min(grid.x, grid.y), 1.0);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;
  vec2 centered = screen - u_resolution / u_dpr * 0.5;
  vec2 world = (centered - u_pan) / max(u_zoom, 0.001);

  float spacing = 32.0;
  if (u_zoom < 0.6) spacing *= 2.0;
  if (u_zoom < 0.3) spacing *= 2.0;
  if (u_zoom > 1.8) spacing *= 0.5;

  float minor = gridLine(world, spacing);
  float major = gridLine(world, spacing * 5.0);
  float axisX = 1.0 - min(abs(world.y) / max(fwidth(world.y), 1e-5), 1.0);
  float axisY = 1.0 - min(abs(world.x) / max(fwidth(world.x), 1e-5), 1.0);

  vec3 color = u_background;
  // 中心柔光，避免纯色背景显得扁平。
  vec2 uv = screen / max(u_resolution / u_dpr, vec2(1.0));
  color += vec3(0.012, 0.016, 0.022) * (1.0 - smoothstep(0.0, 0.85, distance(uv, vec2(0.5))));

  color = mix(color, u_grid, minor * 0.13);
  color = mix(color, u_major, major * 0.26);
  color = mix(color, u_axis, max(axisX, axisY) * 0.24);

  // 细小的背景噪点由屏幕导数生成，不引入纹理采样。
  float hash = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (hash - 0.5) * 0.006;

  outColor = vec4(color, 1.0);
}
`

export class GridRenderer {
  private gl?: WebGL2RenderingContext
  private program?: WebGLProgram
  private vao?: WebGLVertexArrayObject
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>()
  private width = 1
  private height = 1
  private dpr = 1
  private disposed = false
  private lost = false

  constructor(private readonly canvas: HTMLCanvasElement) {}

  get isAvailable(): boolean {
    return Boolean(this.gl) && !this.lost
  }

  init(): boolean {
    if (this.disposed) {
      return false
    }
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    })
    if (!gl) {
      return false
    }
    this.gl = gl
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vertex || !fragment) {
      return false
    }
    const program = gl.createProgram()
    if (!program) {
      return false
    }
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[surface] 着色器链接失败', gl.getProgramInfoLog(program))
      return false
    }
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    this.program = program
    this.vao = gl.createVertexArray()
    for (const name of [
      'u_resolution',
      'u_pan',
      'u_zoom',
      'u_dpr',
      'u_background',
      'u_grid',
      'u_major',
      'u_axis',
    ]) {
      this.uniforms.set(name, gl.getUniformLocation(program, name))
    }
    gl.bindVertexArray(this.vao ?? null)
    this.canvas.addEventListener('webglcontextlost', this.onLost)
    this.canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.resize(this.width, this.height, this.dpr)
    return true
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
    this.dpr = Math.max(1, Math.min(dpr, 2))
    if (!this.gl) {
      return
    }
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  render(camera: GridCamera): GridMetrics {
    const started = performance.now()
    const gl = this.gl
    if (!gl || !this.program || this.lost) {
      return { renderer: 'unavailable', frameMs: 0, drawCalls: 0 }
    }
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao ?? null)
    this.setUniform('u_resolution', '2f', [this.canvas.width, this.canvas.height])
    this.setUniform('u_pan', '2f', [camera.x, camera.y])
    this.setUniform('u_zoom', '1f', camera.zoom)
    this.setUniform('u_dpr', '1f', this.dpr)
    this.setUniform('u_background', '3f', [0.075, 0.086, 0.1])
    this.setUniform('u_grid', '3f', [0.38, 0.42, 0.48])
    this.setUniform('u_major', '3f', [0.58, 0.62, 0.68])
    this.setUniform('u_axis', '3f', [0.23, 0.45, 0.68])
    gl.clearColor(0.075, 0.086, 0.1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return { renderer: 'webgl2', frameMs: performance.now() - started, drawCalls: 1 }
  }

  dispose(): void {
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    const gl = this.gl
    if (gl) {
      if (this.program) {
        gl.deleteProgram(this.program)
      }
      if (this.vao) {
        gl.deleteVertexArray(this.vao)
      }
    }
    this.gl = undefined
  }

  private setUniform(name: string, type: '1f' | '2f' | '3f', value: number | number[]): void {
    const gl = this.gl
    const location = this.uniforms.get(name)
    if (!gl || location === undefined || location === null) {
      return
    }
    if (type === '1f') {
      gl.uniform1f(location, value as number)
    }
    else if (type === '2f') {
      const [x, y] = value as number[]
      gl.uniform2f(location, x, y)
    }
    else {
      const [x, y, z] = value as number[]
      gl.uniform3f(location, x, y, z)
    }
  }

  private readonly onLost = (event: Event): void => {
    event.preventDefault()
    this.lost = true
  }

  private readonly onRestored = (): void => {
    this.lost = false
    this.uniforms.clear()
    this.program = undefined
    this.vao = undefined
    this.init()
  }
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[surface] 着色器编译失败', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}
