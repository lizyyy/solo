# route-orphan-cli

前端路由孤儿排查工具 - 检测SPA项目中路由与页面文件不匹配的问题

## 问题背景

在SPA项目开发过程中，经常会遇到以下问题：

1. **删页面后路由还在**：删除了页面文件，但路由配置没有同步删除，导致构建不一定报错
2. **有页面文件没有入口**：创建了新的页面文件，但忘记在路由中配置入口
3. **路由配置错误**：路由指向了不存在的组件路径，或者懒加载路径错误

这些问题在开发阶段可能不会立即暴露，等到测试或上线时才发现，影响开发效率。

## 功能特性

- 🔍 **源码扫描**：自动扫描路由文件和页面文件
- 📝 **路由解析**：支持Vue Router和React Router的路由配置解析
- 🔗 **文件匹配**：智能匹配路由与页面文件的对应关系
- 🕵️ **孤儿检测**：检测以下类型的问题：
  - `route-without-page`：路由配置了但页面文件不存在
  - `page-without-route`：页面文件存在但没有路由入口
  - `invalid-route`：无效的路由配置（缺少path或component）
- 📊 **多格式报告**：
  - 终端摘要：便于快速查看结果
  - JSON结果：机器可读，便于CI集成
  - HTML报告：美观易读，适合发给同事
- 📍 **保留原始位置**：坏行或异常样本保留原始文件位置和原因
- ♻️ **可重复执行**：每次运行生成带时间戳的新文件，不污染旧结果

## 安装

```bash
npm install
npm run build
npm link
```

## 使用方法

### 基础用法

```bash
# 扫描当前目录
route-orphan

# 指定源码目录和输出目录
route-orphan -s ./src -o ./reports
```

### 命令行选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --source <dir>` | 源码目录路径 | 当前目录 |
| `-o, --output <dir>` | 报告输出目录 | `./route-orphan-report` |
| `--route-patterns <patterns>` | 路由文件匹配模式（逗号分隔） | `**/router/**/*.{ts,js,tsx,jsx},**/router.{ts,js,tsx,jsx}` |
| `--page-patterns <patterns>` | 页面文件匹配模式（逗号分隔） | `**/pages/**/*.{vue,tsx,jsx,ts,js},**/views/**/*.{vue,tsx,jsx,ts,js}` |
| `--exclude <patterns>` | 排除文件模式（逗号分隔） | `node_modules,dist,build,*.d.ts,*.test.*` |
| `--framework <type>` | 框架类型: vue\|react\|auto | `auto` |
| `--format <formats>` | 输出格式: terminal,json,html（逗号分隔） | `terminal,json,html` |
| `--strict` | 严格模式，更多警告转为错误 | `false` |
| `--quiet` | 静默模式，减少终端输出 | `false` |

### 示例

```bash
# 指定框架为Vue
route-orphan -s ./src -o ./reports --framework vue

# 只输出JSON和HTML报告
route-orphan -s ./src -o ./reports --format json,html

# 严格模式，发现任何问题都返回非零退出码（适合CI）
route-orphan -s ./src -o ./reports --strict
```

## 报告说明

### 终端输出

- 扫描概要统计
- 问题分类统计
- 详细问题列表（包含文件位置、行号、代码片段）

### JSON报告

输出完整的扫描结果，结构如下：

```json
{
  "routes": [...],
  "pageFiles": [...],
  "orphans": [...],
  "summary": {
    "totalRoutes": 10,
    "totalPages": 8,
    "orphanCount": 3,
    "routeWithoutPage": 1,
    "pageWithoutRoute": 2,
    "invalidRoute": 0
  },
  "metadata": {
    "scanTime": "2024-01-01T00:00:00.000Z",
    "sourceDir": "/path/to/src",
    "outputDir": "/path/to/output",
    "durationMs": 1234
  }
}
```

### HTML报告

生成美观的HTML报告，包含：
- 扫描概要卡片
- 问题分类统计
- 详细问题列表（带高亮）
- 扫描元数据

每次运行会生成：
- `route-orphan-report-YYYY-MM-DDTHH-MM-SS-SSS.html`（带时间戳）
- `latest-report.html`（始终指向最新报告）

## 支持的项目结构

### Vue 项目

```
src/
├── router/
│   └── index.ts
├── views/
│   ├── Home.vue
│   └── About.vue
└── pages/
    └── User.vue
```

### React 项目

```
src/
├── router/
│   └── index.tsx
├── views/
│   ├── Home.tsx
│   └── About.tsx
└── pages/
    └── User.tsx
```

## CI/CD 集成

在 CI 中使用严格模式：

```yaml
# GitHub Actions 示例
- name: Check route orphans
  run: |
    npm install -g route-orphan-cli
    route-orphan -s ./src -o ./reports --strict
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（自动编译）
npm run dev

# 构建
npm run build

# 测试
npm test
```

## License

MIT