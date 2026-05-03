# i18n-preflight

Frontend ICU i18n preflight check CLI - 国际化发版前预检工具

## 功能特性

- ✅ **缺失 Key 检测** - 检查各语言文件中缺失的翻译 key
- ✅ **占位符类型检测** - 检测不同语言间占位符数量和类型不一致
- ✅ **复数分支检测** - 检查 ICU 复数形式是否完整（one/other 等）
- ✅ **超长文案检测** - 检测按钮、导航栏等位置的超长文案
- ✅ **旧 Key 引用检测** - 检查截图清单中是否仍引用已废弃的 key
- ✅ **嵌套 Key 解析** - 支持 `page.home.title` 形式的嵌套 key
- ✅ **未使用 Key 检测** - 找出可能未被路由或截图引用的 key
- ✅ **非法 ICU 表达式检测** - 检查 ICU 语法错误

## 安装

```bash
npm install
```

## 快速开始

运行 Demo（使用 sample 数据）：

```bash
npm run demo
```

或者完整命令：

```bash
npx tsx src/cli.ts --localeDir ./sample/locales --routes ./sample/routes.csv --screenshotManifest ./sample/screenshot-manifest.json --rules ./sample/rules.yaml --output ./output
```

## 使用方法

### 命令行参数

| 参数 | 简写 | 说明 | 必填 |
|------|------|------|------|
| `--localeDir` | `-l` | 存放 locale JSON 文件的目录 | 是 |
| `--routes` | `-r` | routes.csv 文件路径 | 否 |
| `--screenshotManifest` | `-s` | screenshot-manifest.json 文件路径 | 否 |
| `--rules` | `-c` | rules.yaml 规则配置文件路径 | 否 |
| `--output` | `-o` | 输出报告的目录（默认: ./output） | 否 |
| `--referenceLocale` | `--ref` | 参考语言（默认: en） | 否 |
| `--quiet` | `-q` | 静默模式，不输出控制台信息 | 否 |
| `--help` | `-h` | 显示帮助信息 | - |

### 示例

**基础用法**（仅检查 locale 文件）：

```bash
npx tsx src/cli.ts -l ./locales
```

**完整检查**（包含路由、截图和规则）：

```bash
npx tsx src/cli.ts \
  -l ./locales \
  -r ./routes.csv \
  -s ./screenshot-manifest.json \
  -c ./rules.yaml \
  -o ./report
```

## 输入文件格式

### 1. Locale JSON 文件 (`locales/*.json`)

```json
{
  "common": {
    "welcome": "Welcome",
    "loading": "Loading..."
  },
  "user": {
    "greeting": "Hello, {name}!",
    "messages": "You have {count, plural, one {# message} other {# messages}}"
  }
}
```

### 2. Routes CSV (`routes.csv`)

```csv
path,keys,component
/home,"common.welcome,page.home.title",HomePage
/dashboard,"user.greeting,user.messages",DashboardPage
```

### 3. Screenshot Manifest (`screenshot-manifest.json`)

```json
[
  {
    "name": "homepage",
    "path": "/screenshots/home.png",
    "keys": ["common.welcome", "page.home.title"],
    "status": "active"
  }
]
```

### 4. Rules Config (`rules.yaml`)

```yaml
maxTextLength:
  button: 30
  navigation: 20
  title: 60

pluralRules:
  requiredForms:
    - "one"
    - "other"
  localeOverrides:
    "zh-CN": ["other"]

deprecatedKeys:
  - "oldFeature.title"
  - "oldFeature.description"
```

## 输出文件

运行后会在输出目录生成三个文件：

### 1. `issues.csv`

详细的问题列表，适合导入到 Excel/Google Sheets 进行跟踪。

| 字段 | 说明 |
|------|------|
| ID | 问题唯一标识 |
| Category | 问题类别 |
| Severity | 严重程度 (error/warning/info) |
| Locale | 语言代码 |
| Key | i18n key |
| Message | 问题描述 |
| Expected | 期望值 |
| Actual | 实际值 |
| Value | 当前值 |
| Limit | 限制值 |
| Reference | 参考 |

### 2. `i18n_report.md`

Markdown 格式报告，适合在 GitHub/GitLab 中查看。

### 3. `preview.html`

可视化 HTML 报告，包含统计概览和问题详情，可以直接在浏览器中打开。

## 检测类型

| 类别 | 严重程度 | 说明 |
|------|----------|------|
| `missing_key` | error | 某语言中缺少某个 key |
| `extra_key` | warning | 某语言中有额外的 key（参考语言没有） |
| `unused_key` | info | 可能未被使用的 key |
| `placeholder_mismatch` | error/warning | 占位符不匹配 |
| `plural_missing` | error | 复数形式缺失 |
| `text_too_long` | warning | 文案超长 |
| `deprecated_key` | error/warning | 已废弃的 key |
| `invalid_icu` | error | 非法的 ICU 表达式 |

## 项目结构

```
i18n-preflight/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 模块导出
│   ├── types.ts            # TypeScript 类型定义
│   ├── parsers/            # 文件解析器
│   │   ├── index.ts
│   │   ├── json-parser.ts  # JSON 解析（嵌套 key 展平）
│   │   ├── csv-parser.ts   # CSV 解析
│   │   └── yaml-parser.ts  # YAML 解析
│   ├── icu/                # ICU 消息解析
│   │   ├── index.ts
│   │   └── icu-parser.ts   # ICU 语法解析器
│   ├── engine/             # 规则引擎
│   │   ├── index.ts
│   │   └── rules-engine.ts # 核心检测逻辑
│   └── reporters/          # 报告生成器
│       ├── index.ts
│       └── report-generator.ts
├── sample/                 # 示例数据
│   ├── locales/
│   │   ├── en.json
│   │   └── zh-CN.json
│   ├── routes.csv
│   ├── screenshot-manifest.json
│   └── rules.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## 边界处理

### 嵌套 Key

支持自动展平嵌套的 JSON 结构：

```json
// 输入
{
  "page": {
    "home": {
      "title": "Home"
    }
  }
}

// 内部展平后
{
  "page.home.title": "Home"
}
```

### 未使用 Key 检测

当提供 routes.csv 或 screenshot-manifest.json 时，工具会分析哪些 key 没有被引用。

注意：如果未提供这些文件，不会进行未使用 key 检测。

### 非法 ICU 表达式

检测以下类型的错误：
- 未闭合的占位符 `{name`
- 缺少标识符 `{ }`
- 无效的语法结构

## 退出码

| 码 | 说明 |
|---|------|
| 0 | 成功（无 error 级别问题） |
| 1 | 有 error 级别问题或执行错误 |

## License

MIT
