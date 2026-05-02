# a11y-smoke-cli

本地前端无障碍冒烟巡检器，给接手旧页面的前端同学用。上线前把静态页面目录或者小型 Vite/React 项目目录丢进去，它能先扫一轮常见的可访问性问题。

## 功能特性

- 📁 **递归扫描**: 自动查找目录中的 HTML、JSX、TSX、CSS 文件
- 🔍 **8 类规则检查**:
  - `img-alt`: 图片 alt 属性检查
  - `form-label`: 表单控件标签关联检查
  - `button-text`: 按钮可读文本检查
  - `link-text`: 链接可读文本检查
  - `duplicate-id`: 重复 ID 检查
  - `tabindex`: tabindex 焦点顺序风险检查
  - `aria-misuse`: ARIA 属性常见误用检查
  - `color-contrast`: 颜色对比度检查（WCAG AA 标准）
- 📋 **详细报告**: 每条问题包含严重级别、规则编号、文件路径、源码定位、修复建议
- ⚙️ **配置文件**: 支持自定义规则开关、对比度阈值、忽略模式
- 📊 **多格式输出**: 控制台输出、JSON、Markdown、交互式 HTML 报告

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd a11y-smoke-cli

# 安装依赖
npm install

# 全局链接（可选）
npm link
```

## 快速开始

### 运行示例

项目包含一个故意有问题的示例页面，可以用来测试工具：

```bash
# 扫描示例项目
node src/cli.js scan examples/bad-page

# 如果已经 npm link，可以直接用
a11y-smoke scan examples/bad-page
```

### 扫描你的项目

```bash
# 扫描指定目录
a11y-smoke scan ./src

# 或使用完整路径
a11y-smoke scan /path/to/your/project
```

## 命令说明

### scan 命令

扫描目录中的可访问性问题。

```bash
# 基本用法
a11y-smoke scan <directory>

# 指定配置文件
a11y-smoke scan <directory> -c ./my-config.json
```

**选项**:
- `-c, --config <path>`: 指定配置文件路径
- `-h, --help`: 显示帮助信息

### report 命令

生成详细的报告文件。

```bash
# 生成所有格式的报告
a11y-smoke report -s <directory>

# 只生成 HTML 报告
a11y-smoke report -s <directory> -f html

# 只生成 Markdown 报告
a11y-smoke report -s <directory> -f md

# 只生成 JSON 报告
a11y-smoke report -s <directory> -f json

# 指定输出路径
a11y-smoke report -s <directory> -f html -o ./my-report.html
```

**选项**:
- `-s, --scan <path>`: 扫描目录路径
- `-f, --format <format>`: 输出格式 (json|md|html|all，默认: all)
- `-o, --output <path>`: 输出文件路径
- `-c, --config <path>`: 配置文件路径
- `-h, --help`: 显示帮助信息

### rules 命令

列出所有支持的规则。

```bash
a11y-smoke rules
```

### init 命令

在当前目录创建默认配置文件。

```bash
a11y-smoke init
```

## 配置文件

配置文件命名为 `a11y-smoke.config.json`，工具会自动在以下位置查找：
1. 命令行通过 `-c` 指定的路径
2. 扫描目录根目录
3. 当前工作目录
4. 用户主目录

### 完整配置示例

```json
{
  "rules": {
    "img-alt": { "enabled": true, "severity": "error" },
    "form-label": { "enabled": true, "severity": "error" },
    "button-text": { "enabled": true, "severity": "error" },
    "link-text": { "enabled": true, "severity": "error" },
    "duplicate-id": { "enabled": true, "severity": "error" },
    "tabindex": { "enabled": true, "severity": "warning" },
    "aria-misuse": { "enabled": true, "severity": "error" },
    "color-contrast": { "enabled": true, "severity": "warning" }
  },
  "contrastThreshold": 4.5,
  "ignorePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "*.min.css",
    "vendor/**"
  ],
  "fileExtensions": [".html", ".jsx", ".tsx", ".css"]
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `rules` | object | - | 各规则的启用状态和严重级别 |
| `contrastThreshold` | number | 4.5 | WCAG 对比度阈值（AA 标准为 4.5，AAA 为 7） |
| `ignorePatterns` | array | 见示例 | 忽略的文件/目录模式（glob 格式） |
| `fileExtensions` | array | `[".html", ".jsx", ".tsx", ".css"]` | 要扫描的文件扩展名 |

### 忽略规则

#### 关闭某条规则

在配置文件中将规则的 `enabled` 设为 `false`：

```json
{
  "rules": {
    "color-contrast": { "enabled": false }
  }
}
```

#### 忽略某些文件

使用 `ignorePatterns` 配置：

```json
{
  "ignorePatterns": [
    "node_modules/**",
    "**/test/**",
    "legacy-old-code/**"
  ]
}
```

## 规则说明

### img-alt

检查图片是否有适当的 `alt` 属性。

**问题类型**:
- 图片缺少 `alt` 属性
- 图片 `alt` 为空但不是装饰性图片

**修复建议**:
```html
<!-- 有意义的图片 -->
<img src="product.jpg" alt="红色圆形产品图">

<!-- 装饰性图片 -->
<img src="divider.png" alt="" role="presentation">
```

### form-label

检查表单控件是否有正确的标签关联。

**问题类型**:
- 表单控件没有 `id` 且没有 `aria-label/aria-labelledby`
- 表单控件有 `id` 但没有关联的 `<label>` 或 `aria-label`

**修复建议**:
```html
<!-- 使用 label + for -->
<label for="username">用户名</label>
<input type="text" id="username" name="username">

<!-- 使用 aria-label -->
<input type="search" aria-label="搜索">
```

### button-text

检查按钮是否有可读文本。

**问题类型**:
- 按钮没有可见文本且没有 `aria-label/aria-labelledby`

**修复建议**:
```html
<!-- 普通按钮 -->
<button>提交</button>

<!-- 图标按钮 -->
<button aria-label="删除项目">
  <span class="icon">🗑️</span>
</button>
```

### link-text

检查链接是否有可读文本。

**问题类型**:
- 链接文本不够描述性（如"点击这里"、"更多"）
- 链接没有文本且没有 `aria-label`

**修复建议**:
```html
<!-- 避免 -->
<a href="/docs">点击这里</a>

<!-- 推荐 -->
<a href="/docs">查看产品文档</a>
```

### duplicate-id

检查是否有重复的 `id` 属性。

**问题类型**:
- 同一页面中相同的 `id` 出现多次

**修复建议**:
```html
<!-- 避免 -->
<div id="card">...</div>
<div id="card">...</div>

<!-- 推荐 -->
<div id="card-1">...</div>
<div id="card-2">...</div>
```

### tabindex

检查 `tabindex` 使用是否合理。

**问题类型**:
- 使用正数 `tabindex`（会破坏自然 Tab 顺序）
- 交互元素使用 `tabindex="-1"`

**修复建议**:
```html
<!-- 避免 -->
<input type="text" tabindex="3">
<input type="text" tabindex="1">

<!-- 推荐 -->
<input type="text">
<input type="text">
```

### aria-misuse

检查 ARIA 属性是否被正确使用。

**问题类型**:
- 不必要的 ARIA role（如 `<button role="button">`）
- `aria-label` 为空
- 交互元素使用 `aria-hidden="true"`

**修复建议**:
```html
<!-- 避免 -->
<button role="button">提交</button>
<button aria-label="">空标签</button>
<button aria-hidden="true">隐藏按钮</button>

<!-- 推荐 -->
<button>提交</button>
<button aria-label="关闭对话框">✕</button>
```

### color-contrast

检查前景色和背景色的对比度是否符合 WCAG 标准。

**问题类型**:
- 对比度低于阈值（默认 4.5:1）

**修复建议**:
```css
/* 避免 */
.low-contrast {
  color: #aaaaaa;
  background: #ffffff;
}

/* 推荐 */
.good-contrast {
  color: #333333;
  background: #ffffff;
}
```

## HTML 报告

生成的 HTML 报告支持以下功能：

- **按严重级别筛选**: 显示/隐藏错误、警告
- **按文件筛选**: 只查看特定文件的问题
- **按规则筛选**: 只查看特定规则的问题
- **展开/收起**: 点击问题卡片查看详细的源码和修复建议

打开方式：
```bash
# macOS
open a11y-report.html

# 或直接在浏览器中打开
```

## 项目结构

```
a11y-smoke-cli/
├── src/
│   ├── cli.js              # CLI 入口
│   ├── index.js            # 主模块
│   ├── config.js           # 配置读取
│   ├── file-finder.js      # 文件发现
│   ├── parser.js           # 解析器（HTML/JSX/CSS）
│   ├── rules/
│   │   ├── index.js        # 规则注册和执行
│   │   └── color-utils.js  # 颜色对比度计算
│   └── reporter/
│       └── index.js        # 报告生成
├── examples/
│   └── bad-page/           # 示例问题页面
│       ├── index.html
│       ├── styles.css
│       └── components/
│           └── BadComponent.jsx
├── a11y-smoke.config.json  # 默认配置文件
├── package.json
└── README.md
```

## 支持的文件类型

- **HTML**: `.html` - 使用 cheerio 解析
- **JSX**: `.jsx` - 使用正则表达式模式匹配
- **TSX**: `.tsx` - 使用正则表达式模式匹配
- **CSS**: `.css` - 使用 css-tree 解析

## 注意事项

1. **JSX/TSX 解析限制**: 由于使用正则表达式而非完整的 AST 解析，可能无法识别所有复杂情况（如动态绑定的 `aria-label`）。
2. **颜色对比度限制**: 只能检测 CSS 中明确设置的颜色，无法检测：
   - JavaScript 动态设置的样式
   - 继承的样式
   - 伪元素的样式
3. **行号定位**: 对于复杂的 JSX 结构，行号可能不完全精确，但会尽可能定位到问题附近。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
