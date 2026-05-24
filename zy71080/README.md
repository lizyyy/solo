# 邮件模板变量预检 CLI 工具

一个功能完善的邮件模板变量检查工具，用于在发送邮件前预检模板中的变量问题。

## ✨ 功能特性

- **模板解析**: 自动提取模板中的所有变量
- **条件块支持**: 识别 `{% if %}` 条件块中的变量
- **默认值检测**: 识别变量默认值配置
- **大小写检查**: 检测变量命名大小写不一致
- **多语言比对**: 对比不同语言版本的变量一致性
- **变量清单校验**: 与预设变量清单比对
- **样例渲染**: 使用样例数据渲染模板预览
- **多格式报告**: 终端摘要、JSON、Markdown 报告

## 📦 安装

```bash
# 克隆项目后安装依赖
npm install

# 全局链接（可选，方便全局使用）
npm link
```

## 🚀 快速开始

### 基本用法

```bash
# 检查单个模板
email-lint templates/welcome.html

# 使用变量清单校验
email-lint templates/*.html -m manifest.json

# 带样例数据渲染
email-lint templates/*.html -m manifest.json -s sample-data.json --render

# 指定输出目录
email-lint templates/*.html -o ./my-reports
```

### 完整示例

```bash
email-lint examples/templates/*.html \
  -m examples/manifest.json \
  -s examples/sample-data.json \
  --render \
  -v
```

## 🔧 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `templates` | - | 模板文件路径，支持 glob 模式 | `templates/**/*.html` |
| `--manifest` | `-m` | 变量清单 JSON 文件路径 | - |
| `--sample-data` | `-s` | 样例数据 JSON 文件路径 | - |
| `--locale` | `-l` | 指定语言版本（如 en-US） | - |
| `--output-dir` | `-o` | 输出报告目录 | `./reports` |
| `--formats` | `-f` | 输出格式: terminal,json,markdown | `terminal,json,markdown` |
| `--case-sensitive` | - | 大小写敏感模式 | `false` |
| `--no-color` | - | 禁用彩色输出 | - |
| `--verbose` | `-v` | 详细输出模式 | `false` |
| `--render` | - | 渲染样例预览 | `false` |
| `--version` | `-V` | 显示版本号 | - |
| `--help` | `-h` | 显示帮助信息 | - |

## 📁 目录结构

```
project/
├── templates/              # 邮件模板目录
│   ├── welcome.zh-CN.html  # 中文版本
│   ├── welcome.en-US.html  # 英文版本
│   └── reset-password.html
├── manifest.json           # 变量清单（可选）
├── sample-data.json        # 样例数据（可选）
└── reports/                # 输出报告目录
    ├── report.json         # 机器可读报告
    ├── report.md           # 给同事看的Markdown报告
    └── previews/           # 渲染后的样例预览
        ├── welcome_zh-CN.html
        └── welcome_en-US.html
```

## 📋 模板语法

### 变量语法

```html
<!-- 基本变量 -->
{{ userName }}

<!-- 带默认值的变量 -->
{{ userEmail | default: "未设置" }}

<!-- 嵌套变量 -->
{{ user.profile.name }}
```

### 条件块语法

```html
{% if isVip %}
  <p>尊敬的VIP会员</p>
{% else %}
  <p>普通会员</p>
{% endif %}

{% if hasPromotion and isVip %}
  <p>双重优惠!</p>
{% endif %}
```

## 📝 变量清单格式

`manifest.json` 文件格式：

```json
{
  "variables": [
    {
      "name": "userName",
      "required": true,
      "description": "用户姓名",
      "type": "string",
      "default": "访客"
    }
  ],
  "locales": {
    "en-US": [
      {
        "name": "extraMessage",
        "required": false,
        "description": "英文版本专属变量"
      }
    ]
  }
}
```

### 变量字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 变量名称 |
| `required` | boolean | 是否必填 |
| `description` | string | 变量描述 |
| `type` | string | 数据类型 |
| `default` | string | 默认值 |

## 📊 样例数据格式

`sample-data.json` 文件格式：

```json
{
  "zh-CN": {
    "userName": "张三",
    "userEmail": "zhangsan@example.com",
    "isVip": true
  },
  "en-US": {
    "userName": "John Doe",
    "userEmail": "john@example.com",
    "isVip": false
  }
}
```

## 🚨 问题类型说明

| 问题类型 | 严重程度 | 说明 | 修复建议 |
|----------|----------|------|----------|
| `missing_variable` | ❌ 错误 | 变量清单中必填变量未使用 | 检查模板或更新清单 |
| `extra_variable` | ⚠️ 警告 | 使用了清单中不存在的变量 | 确认必要性或更新清单 |
| `case_inconsistency` | ⚠️ 警告 | 变量大小写不一致 | 统一命名风格 |
| `i18n_missing_variable` | ❌ 错误 | 某语言版本缺少变量 | 检查翻译版本 |
| `conditional_issue` | ⚠️ 警告 | 条件块可能有问题 | 检查条件逻辑 |
| `missing_sample` | ⚠️ 警告 | 样例数据缺失且无默认值 | 补充样例或设置默认值 |

## 🚪 退出码说明

| 退出码 | 说明 |
|--------|------|
| `0` | 所有检查通过 |
| `1` | 存在警告 |
| `2` | 存在错误 |
| `3` | 输入参数无效 |
| `4` | 文件未找到 |
| `5` | 致命错误 |

## ❌ 坏数据处理

### 无效的模板文件

- 工具会自动跳过无法读取的文件
- 语法错误的模板会产生警告信息
- 建议使用 `--verbose` 查看详细错误

### 无效的 JSON 文件

- 变量清单或样例数据 JSON 解析失败会报错并退出
- 错误信息会显示具体的解析位置

### 不匹配的变量名

- 默认大小写不敏感模式：`userName` 和 `username` 视为同一变量
- 使用 `--case-sensitive` 启用严格模式

### 空模板或无变量模板

- 工具会正常处理并报告"未发现变量"
- 不会产生错误，仅在摘要中显示

## 📄 报告输出

### 终端输出

实时显示检查进度和摘要，支持彩色高亮。

### JSON 报告

`reports/report.json` - 机器可读格式，适合 CI/CD 集成：

```json
{
  "meta": { "version": "1.0.0", "generatedAt": "..." },
  "summary": { "errors": 2, "warnings": 5 },
  "templateResults": [...],
  "i18nComparison": {...}
}
```

### Markdown 报告

`reports/report.md` - 格式化的报告，方便分享给同事：

- 检查摘要表格
- 模板详情和问题列表
- 多语言变量对比矩阵
- 问题类型说明

## 🔄 CI/CD 集成

```bash
# 在 CI 中使用，失败时退出
email-lint templates/*.html -m manifest.json || exit 1

# 仅生成 JSON 报告用于后续处理
email-lint templates/*.html -f json -o reports
```

## 📚 项目结构

```
src/
├── cli.js                    # CLI 入口
├── constants/
│   └── exit-codes.js         # 退出码定义
├── parsers/
│   ├── template-parser.js    # 模板解析器
│   ├── variable-manifest-parser.js
│   └── sample-data-parser.js
├── core/
│   ├── variable-validator.js # 变量校验器
│   ├── i18n-comparator.js    # 多语言比对器
│   └── template-renderer.js  # 模板渲染器
└── reporters/
    ├── terminal-reporter.js  # 终端输出
    ├── json-reporter.js      # JSON 报告
    └── markdown-reporter.js  # Markdown 报告
```

## 🤝 常见问题

### Q: 如何处理多语言模板？

A: 使用命名约定，如 `welcome.zh-CN.html`、`welcome.en-US.html`，工具会自动识别并比对变量一致性。

### Q: 默认值语法是什么？

A: 使用 `{{ varName | default: "默认值" }}` 格式，支持单引号和双引号。

### Q: 如何忽略某些警告？

A: 目前版本不支持单独忽略，建议修复问题或使用退出码判断。

### Q: 支持 Handlebars/Nunjucks 语法吗？

A: 目前支持基本的变量和 `{% if %}` 条件块语法，兼容大部分模板引擎。

## 📄 License

MIT
