# WebGPU 着色器兼容性实验台

一个用于在浏览器中验证 WGSL 着色器兼容性的本地实验台工具。

## 功能特性

- **内置 Shader 选择**：提供渐变、波浪、分形、像素化等多种预设着色器
- **实时编辑运行**：支持自定义 WGSL 代码编辑和即时运行预览
- **设备能力探针**：自动检测并显示 GPU 适配器信息、WebGPU/WebGL 支持状态
- **编译错误定位**：精确定位 WGSL 编译错误，支持行号和错误信息显示
- **帧耗时曲线**：实时绘制帧时间图表，监控渲染性能
- **降级预览**：WebGPU 不可用时自动降级至 WebGL 或 Canvas 2D
- **报告导出**：支持导出 `compatibility_report.md` 和 `traces.json`

## 本地启动

### 方式一：直接打开

双击 `index.html` 文件在浏览器中打开。

### 方式二：本地服务器（推荐）

```bash
# 使用 Python 3
python -m http.server 8080

# 或使用 Node.js (npx)
npx serve .

# 或使用 PHP
php -S localhost:8080
```

然后在浏览器中访问 `http://localhost:8080`

### 方式三：使用 VS Code Live Server

安装 VS Code 扩展 "Live Server"，右键点击 `index.html`，选择 "Open with Live Server"。

## 浏览器要求

### WebGPU 支持

- **Chrome 113+** (桌面版) - 开启 `chrome://flags/#enable-unsafe-webgpu`
- **Edge 113+** (桌面版) - 开启 `edge://flags/#enable-unsafe-webgpu`
- **Firefox** - 暂不支持 WebGPU
- **Safari** - 技术预览版部分支持

### WebGL 支持

- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## 使用演示

1. **选择预设 Shader**：从下拉菜单选择 "波浪效果"
2. **点击运行**：点击 "▶ 运行" 按钮，查看渲染效果
3. **编辑自定义 Shader**：选择 "自定义 Shader"，修改 WGSL 代码
4. **编译检查**：点击 "🔍 编译检查" 验证代码正确性
5. **导出报告**：点击 "📄 导出报告" 下载兼容性报告

## WGSL 示例

```wgsl
struct Uniforms {
    resolution: vec2f,
    time: f32,
    mouse: vec2f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let uv = pos.xy / uniforms.resolution;
    return vec4f(uv.x, uv.y, 0.5 + 0.5 * sin(uniforms.time), 1.0);
}
```

## 项目结构

```
.
├── index.html          # 主页面
├── js/
│   ├── main.js         # 主应用逻辑
│   ├── shaders.js      # WGSL 着色器示例
│   ├── renderer.js     # WebGPU/WebGL/Canvas 渲染器
│   └── capabilities.js # GPU 能力检测
├── compatibility_report.md  # 兼容性报告模板
└── traces.json         # 追踪数据模板
```

## 边界情况处理

### 1. WGSL 编译失败

当 WGSL 代码存在语法错误时：
- 系统会捕获编译错误信息
- 在错误框中显示错误位置（行号）和错误详情
- 追踪日志记录错误类型和数量

### 2. 浏览器无 GPUAdapter

当浏览器不支持 WebGPU 或无法获取 GPU 适配器时：
- 自动检测 WebGL 是否可用
- 启用 WebGL 降级模式，将 WGSL 转换为 GLSL
- 如 WebGL 也不可用，启用 Canvas 2D 降级模式
- 在界面顶部显示降级原因警告
- 导出报告包含降级原因说明

### 3. 其他异常

- 设备断开连接：停止渲染并提示用户
- 着色器运行时错误：捕获并显示错误信息
- 内存不足：显示警告信息

## 技术栈

- **前端**：原生 HTML5 + CSS3 + JavaScript ES6+
- **图形 API**：WebGPU (WGSL)、WebGL (GLSL)、Canvas 2D
- **无需构建工具**：直接使用 ES6 模块

## 许可

MIT License
