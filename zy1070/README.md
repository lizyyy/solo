# Token Drift Detector

Design Token 漂移检测 CLI 工具 - 检测前端项目中 Design Token 的漂移问题。

## 功能特性

- 🔍 **多源 Token 解析**: 支持 tokens.json/tokens.yaml、CSS/SCSS 变量、Tailwind 配置
- 📁 **全面扫描**: 扫描 ts/tsx/js/jsx/vue/css/scss 文件
- 🎯 **问题检测**:
  - 硬编码的颜色/间距/字体值
  - 引用不存在的 Token
  - 已定义但未使用的 Token
  - 主题值不完整（亮色/暗色主题缺值）
  - 无效的别名引用
  - 循环别名引用

- 📊 **多种报告格式**: JSON、Markdown、HTML
- ⚙️ **灵活配置**: 支持配置文件定义 token 位置、忽略路径、白名单等

## 安装

```bash
npm install
npm run build
npm link
```

或者使用开发模式运行：

```bash
npm install
npx ts-node src/cli.ts <command>
```

## 快速开始

### 1. 初始化示例项目

```bash
token-drift init ./my-demo-project
```

这会创建一个包含示例问题的演示项目，让你可以立即体验检测功能。

### 2. 运行扫描

```bash
cd ./my-demo-project
token-drift scan
```

### 3. 生成报告

```bash
token-drift report

# 指定格式
token-drift report -f json html
token-drift report -f markdown
```

### 4. 查看问题说明

```bash
# 查看所有问题类型
token-drift explain --all

# 查看特定问题类型
token-drift explain hardcoded_color
token-drift explain missing_token
```

## 命令列表

| 命令 | 描述 |
|------|------|
| `init [directory]` | 初始化示例项目 |
| `scan [-p <path>]` | 扫描项目并在终端显示摘要 |
| `report [-p <path>] [-f <formats>]` | 生成报告文件 |
| `explain [issueType] [-a]` | 查看问题类型的详细说明 |

## 配置文件

在项目根目录创建 `token-drift.config.json`：

```json
{
  "tokenFiles": [
    "design-tokens/tokens.json",
    "src/styles/variables.css",
    "tailwind.config.js"
  ],
  "sourceDirs": ["src"],
  "ignorePatterns": [
    "node_modules/**",
    "dist/**",
    "**/*.test.ts"
  ],
  "allowedHardcoded": [
    "transparent",
    "inherit",
    "currentColor"
  ],
  "themeNames": ["light", "dark"],
  "outputDir": "./token-drift-report"
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tokenFiles` | string[] | `['tokens.json', 'tokens.yaml']` | Token 定义文件路径 |
| `sourceDirs` | string[] | `['src']` | 源码目录 |
| `ignorePatterns` | string[] | `['node_modules/**', ...]` | 忽略路径模式 |
| `allowedHardcoded` | string[] | `['transparent', ...]` | 允许的硬编码值 |
| `themeNames` | string[] | `['light', 'dark']` | 主题名称列表 |
| `outputDir` | string | `'./token-drift-report'` | 报告输出目录 |

## 支持的 Token 格式

### 1. JSON/YAML 格式

```json
{
  "color": {
    "primary": { "value": "#3b82f6", "type": "color" },
    "secondary": { "value": "#8b5cf6", "type": "color" }
  },
  "spacing": {
    "sm": { "value": "8px", "type": "spacing" },
    "md": { "value": "16px", "type": "spacing" }
  },
  "light": {
    "text": {
      "primary": { "alias": "color.text.primary" }
    }
  },
  "dark": {
    "text": {
      "primary": { "value": "#f9fafb", "type": "color" }
    }
  }
}
```

### 2. CSS 变量

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --spacing-sm: 8px;
  --spacing-md: 16px;
}
```

### 3. Tailwind 配置

```javascript
module.exports = {
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
    },
    spacing: {
      '1': '4px',
      '2': '8px',
      '4': '16px',
    },
    fontSize: {
      sm: '14px',
      base: '16px',
    },
  },
};
```

## 检测的问题类型

| 类型 | 严重程度 | 描述 |
|------|----------|------|
| `hardcoded_color` | High | 硬编码颜色值 |
| `hardcoded_spacing` | Medium | 硬编码间距值 |
| `hardcoded_font` | Medium | 硬编码字体值 |
| `missing_token` | Critical | 引用不存在的 Token |
| `unused_token` | Low | 已定义但未使用的 Token |
| `theme_mismatch` | High | 主题值不完整 |
| `invalid_alias` | Critical | 无效的别名引用 |
| `circular_alias` | Critical | 循环别名引用 |

## 示例报告

### 终端输出

```
📊 Design Token 漂移检测结果
==================================================

┌─────────────────────┬────────┐
│ 严重程度            │ 数量   │
├─────────────────────┼────────┤
│ Critical (严重)     │ 1      │
├─────────────────────┼────────┤
│ High (高)           │ 15     │
├─────────────────────┼────────┤
│ Medium (中)         │ 12     │
├─────────────────────┼────────┤
│ Low (低)            │ 8      │
├─────────────────────┼────────┤
│ 总计                │ 36     │
└─────────────────────┴────────┘
```

### HTML 报告

生成的 HTML 报告包含：
- 响应式设计的统计概览卡片
- 按严重程度分组的问题列表
- 每个问题的详细信息（文件、行号、上下文）
- Token 统计信息

## 项目结构

```
.
├── src/
│   ├── cli.ts           # CLI 入口
│   ├── core.ts          # 核心业务逻辑
│   ├── config.ts        # 配置解析
│   ├── token-parser.ts  # Token 解析器
│   ├── scanner.ts       # 文件扫描器
│   ├── analyzer.ts      # 问题检测引擎
│   ├── reporter.ts      # 报告生成器
│   └── types.ts         # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 编译
npm run build

# 开发模式运行
npm run dev -- scan
npm run dev -- report

# 测试
npm test
```

## 常见问题

### Q: 如何忽略某些硬编码值？

在配置文件的 `allowedHardcoded` 中添加白名单，支持通配符：

```json
{
  "allowedHardcoded": [
    "transparent",
    "inherit",
    "#ff0000",  // 特定颜色
    "0px"         // 特定值
  ]
}
```

### Q: 如何检测 Vue 单文件组件？

工具会自动扫描 `.vue` 文件，包括 `<template>`、`<script>` 和 `<style>` 部分。

### Q: 支持哪些颜色格式？

- Hex: `#fff`, `#ffffff`, `#ffffffff`
- RGB/RGBA: `rgb(255,0,0)`, `rgba(255,0,0,0.5)`
- HSL/HSLA: `hsl(0,100%,50%)`
- CSS 颜色关键字: `red`, `blue`, `transparent` 等

## License

MIT
