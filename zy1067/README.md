# 🎯 键盘可访问性巡检工具 (KAS)

本地 CLI 工具，专门用于网页键盘可访问性巡检。通过自动化键盘操作（Tab/Shift+Tab/Escape/Enter）检查网页的键盘导航体验，帮助开发者在验收前发现可访问性问题。

## ✨ 功能特性

- **自动键盘导航**: 模拟用户按 Tab 键遍历页面，捕获完整焦点路径
- **多种检查器**: 检测焦点顺序、可见焦点、跳过链接、弹窗焦点陷阱、表单 label、按钮可访问名称等问题
- **多格式报告**: 支持导出 JSON、Markdown、HTML 三种格式的报告
- **详细问题定位**: 提供元素选择器、DOM 片段、截图线索和修复建议
- **友好错误处理**: 遇到页面打不开、选择器不存在、配置错误时给出清晰的错误提示

## 📋 检测的问题类型

| 检查器 | 描述 | 严重程度 |
|--------|------|----------|
| `focus-order` | 检测正 tabindex、不可见元素获取焦点等焦点顺序问题 | critical/high/medium |
| `focus-visibility` | 检测 outline: none 但无替代焦点样式的问题 | high |
| `skip-link` | 检查是否存在跳过导航的链接 | medium/high/low |
| `form-label` | 检查表单控件是否有关联的 label 标签 | high/medium/low |
| `button-name` | 检查按钮是否有可访问的名称 | high |
| `modal-trap` | 检查模态框的焦点管理和 ARIA 属性 | high/medium |

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 安装 Playwright 浏览器

```bash
npx playwright install chromium
```

### 3. 构建项目

```bash
npm run build
```

### 4. 初始化配置和示例页面

```bash
npm start -- init
```

这会在当前目录生成：
- `routes.json` - 配置文件
- `examples/demo.html` - 包含多种可访问性问题的演示页面

### 5. 执行巡检

```bash
npm start -- scan
```

### 6. 生成报告

```bash
# Markdown 格式
npm start -- report

# HTML 格式
npm start -- report --format html

# JSON 格式
npm start -- report --format json
```

## 📖 命令详解

### init - 初始化配置

```bash
kas init [options]
```

**选项:**
- `-o, --output <path>` - 输出目录（默认为当前目录）
- `--no-demo` - 不创建示例页面

**示例:**
```bash
# 初始化到当前目录
kas init

# 初始化到指定目录
kas init -o ./my-project

# 只创建配置文件，不创建 demo 页面
kas init --no-demo
```

### scan - 执行巡检

```bash
kas scan [options]
```

**选项:**
- `-c, --config <path>` - 配置文件路径（默认为 `./routes.json`）
- `-o, --output <path>` - 输出目录（默认为 `./.kas`）
- `--no-headless` - 不使用无头模式（显示浏览器窗口）
- `--slow-mo <ms>` - 慢动作模式，延迟毫秒数
- `--timeout <ms>` - 页面加载超时时间（毫秒）
- `--viewport <size>` - 视口大小，格式如 `1280x720`
- `--groups <list>` - 扫描指定分组，用逗号分隔
- `--routes <list>` - 扫描指定路由 ID，用逗号分隔
- `--checkers <list>` - 使用指定的检查器，用逗号分隔

**示例:**
```bash
# 使用默认配置执行扫描
kas scan

# 显示浏览器窗口，方便调试
kas scan --no-headless

# 只扫描指定路由
kas scan --routes demo-page,login-page

# 只使用部分检查器
kas scan --checkers focus-order,focus-visibility,form-label

# 自定义视口大小
kas scan --viewport 1920x1080
```

### report - 生成报告

```bash
kas report [options]
```

**选项:**
- `-i, --input <path>` - 指定扫描结果 JSON 文件路径
- `-o, --output <path>` - 输出文件路径
- `-f, --format <format>` - 输出格式 (`json`|`markdown`|`html`)，默认为 `markdown`
- `--data-dir <path>` - 数据目录（默认为 `./.kas`）

**示例:**
```bash
# 生成 Markdown 报告（默认）
kas report

# 生成 HTML 报告
kas report --format html

# 生成 JSON 报告
kas report --format json

# 使用指定的扫描结果文件
kas report -i ./.kas/results/scan-20260503-182730-09bdc94d.json
```

### checkers - 列出可用检查器

```bash
kas checkers
```

显示所有可用的检查器及其描述。

## ⚙️ 配置文件 (routes.json)

```json
{
  "version": "1.0",
  "name": "我的项目可访问性巡检",
  "description": "检测我的项目的键盘可访问性问题",
  "defaultSettings": {
    "viewport": {
      "width": 1280,
      "height": 720
    },
    "checkers": [
      "focus-order",
      "focus-visibility",
      "skip-link",
      "form-label",
      "button-name",
      "modal-trap"
    ],
    "timeout": 30000
  },
  "groups": [
    {
      "id": "auth",
      "name": "认证页面",
      "description": "登录、注册等认证相关页面"
    }
  ],
  "routes": [
    {
      "id": "login",
      "name": "登录页面",
      "url": "./pages/login.html",
      "type": "html",
      "description": "用户登录页面",
      "group": "auth",
      "keyControls": [
        {
          "selector": "#username",
          "name": "用户名输入框",
          "expectedRole": "textbox",
          "expectedActions": ["tab", "enter"]
        },
        {
          "selector": "#login-btn",
          "name": "登录按钮",
          "expectedRole": "button",
          "expectedActions": ["tab", "enter", "click"]
        }
      ]
    },
    {
      "id": "dashboard",
      "name": "仪表盘",
      "url": "http://localhost:3000/dashboard",
      "type": "url",
      "description": "用户仪表盘页面",
      "group": "main"
    }
  ]
}
```

### 配置字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| `version` | string | 配置文件版本 |
| `name` | string | 项目名称 |
| `description` | string | 项目描述 |
| `defaultSettings` | object | 默认设置 |
| `defaultSettings.viewport` | object | 默认视口大小 |
| `defaultSettings.checkers` | string[] | 使用的检查器列表 |
| `defaultSettings.timeout` | number | 页面超时时间（毫秒） |
| `groups` | array[] | 页面分组定义 |
| `routes` | array[] | 页面路由定义 |

### 路由配置字段

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 路由唯一标识 |
| `name` | string | 页面名称 |
| `url` | string | 页面 URL 或本地 HTML 文件路径 |
| `type` | string | `html`（本地文件）或 `url`（远程 URL） |
| `description` | string | 页面描述 |
| `group` | string | 所属分组 ID |
| `keyControls` | array[] | 关键控件列表 |

### 关键控件配置

| 字段 | 类型 | 描述 |
|------|------|------|
| `selector` | string | CSS 选择器 |
| `name` | string | 控件名称 |
| `expectedRole` | string | 期望的 ARIA role |
| `expectedActions` | string[] | 期望支持的操作 |

## 📊 报告示例

### Markdown 报告

报告包含以下内容：
- 扫描概览（页面数、问题数、耗时）
- 问题按严重程度分布
- 问题按类型分布
- 各页面详情（焦点路径、问题列表）
- 元素选择器和 DOM 片段
- 修复建议

### HTML 报告

HTML 报告包含：
- 响应式设计
- 颜色编码的严重程度显示
- 可折叠的问题详情
- 美观的排版和样式

## 📁 目录结构

```
.
├── .kas/                    # 运行时数据目录
│   ├── results/             # 扫描结果
│   │   ├── latest.json      # 最新结果快捷方式
│   │   └── scan-*.json      # 单次扫描结果
│   └── screenshots/         # 页面截图
├── dist/                    # 编译输出
├── examples/                # 示例页面
│   └── demo.html           # 演示页面
├── src/                     # 源代码
│   ├── checkers/           # 可访问性检查器
│   ├── cli/                # CLI 命令
│   ├── config/             # 配置验证
│   ├── reporter/           # 报告生成器
│   ├── scanner/            # 扫描引擎
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── package.json
├── tsconfig.json
└── routes.json             # 配置文件
```

## 🔧 开发指南

### 安装开发依赖

```bash
npm install
```

### 编译 TypeScript

```bash
npm run build
```

### 监听模式编译

```bash
npm run dev
```

### 运行 CLI

```bash
npm start -- [command] [options]
```

## 🐛 常见问题

### 1. 浏览器启动失败

**错误:** `browserType.launch: Executable doesn't exist`

**解决:** 安装 Playwright 浏览器：
```bash
npx playwright install chromium
```

### 2. 页面加载超时

**错误:** `Timeout 30000ms exceeded`

**解决:** 增加超时时间：
```bash
kas scan --timeout 60000
```

### 3. 配置文件验证失败

**错误:** `配置验证失败`

**解决:** 检查 routes.json 格式是否正确，确保所有必填字段都已填写。

### 4. 本地 HTML 文件找不到

**错误:** `Cannot read property 'goto' of null`

**解决:** 确保 HTML 文件路径是相对于配置文件的，或使用绝对路径。

## 📝 待办事项

- [ ] 添加更多检查器（颜色对比度、ARIA 属性验证等）
- [ ] 支持更多浏览器（Firefox、WebKit）
- [ ] 添加交互式报告
- [ ] 支持 CI/CD 集成
- [ ] 添加基准测试功能（对比两次扫描结果）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示:** 第一次使用时，建议运行 `kas init` 生成示例配置和演示页面，然后运行 `kas scan` 查看工具的实际效果。
