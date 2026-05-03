# i18n-lint-cli

多语言文案质量检查 CLI 工具，专门帮助前端项目在发版前检查多语言文案的各种问题。

## 功能特性

- **文件格式支持**: 支持 JSON、YAML、PO (gettext) 格式的多语言文件
- **嵌套 Key 支持**: 自动将嵌套的 JSON/YAML 结构展平为 `checkout.pay.button` 格式的路径
- **全面的检查规则**:
  - 缺失 Key / 多余 Key 检查
  - 空文案检查
  - 占位符一致性检查 (`{name}`, `%{count}` 等)
  - ICU plural 分支完整性检查
  - 变量名一致性检查
  - 翻译长度风险检查 (防止撑爆 UI)
- **灵活的忽略规则**: 支持按 Key 模式、语言、规则类型忽略检查
- **多种输出格式**: 终端摘要、JSON 明细、Markdown 报告、HTML 交互式报告
- **友好的错误提示**: YAML 解析错误、PO 文件格式错误等会给出具体位置和原因

## 安装

```bash
npm install
```

## 快速开始

### 1. 检查正常样例（应该通过）

```bash
cd examples/normal
node ../../bin/i18n-lint.js -l ./locales -b zh-CN
```

### 2. 检查有错误的样例

```bash
cd examples/with-errors
node ../../bin/i18n-lint.js -l ./locales -b zh-CN -f console json markdown html
```

### 3. 使用配置文件

```bash
cd examples
node ../bin/i18n-lint.js -c ./i18n-lint.config.js -l ./normal/locales
```

## 命令行选项

```
i18n-lint [options]

选项:
  -v, --version                显示版本号
  -c, --config <path>          配置文件路径
  -l, --locale-dir <path>      locale 目录路径
  -b, --base-lang <lang>       基准语言 (默认: zh-CN)
  -o, --output-dir <path>      输出报告目录
  -f, --formats <formats...>   输出格式: console, json, markdown, html
  --no-console                 不输出到终端
  --strict                     严格模式：所有警告视为错误
  -h, --help                   显示帮助信息
```

## 配置文件

支持以下配置文件格式：
- `i18n-lint.config.js`
- `i18n-lint.config.json`
- `.i18n-lintrc.js`
- `.i18n-lintrc.json`

### 完整配置示例

```javascript
module.exports = {
  // locale 目录路径
  localeDir: './locales',
  
  // 基准语言（其他语言以此为标准对齐）
  baseLang: 'zh-CN',
  
  // 报告输出目录
  outputDir: './reports',
  
  // 输出格式
  formats: ['console', 'json', 'markdown', 'html'],
  
  // 启用/禁用检查规则
  checks: {
    missingKeys: true,      // 缺失 Key
    extraKeys: true,        // 多余 Key
    emptyValues: true,      // 空文案
    placeholders: true,     // 占位符一致性
    icuPlurals: true,       // ICU plural 完整性
    variableNames: true,    // 变量名一致性
    lengthRisk: true        // 翻译长度风险
  },
  
  // 长度风险检查配置
  lengthRisk: {
    threshold: 1.5,         // 长度比例阈值（翻译长度/基准长度 > 阈值则报警）
    minBaseLength: 5,       // 基准文案最小长度（短于此的不检查）
    ignoreKeys: []          // 忽略的 Key 列表
  },
  
  // 忽略规则
  ignore: {
    keys: [                 // 按 Key 模式忽略（支持通配符 * 和 ?）
      'debug.*',
      '*.internal'
    ],
    languages: [],          // 按语言忽略
    rules: []               // 按规则类型忽略
  },
  
  // 支持的文件类型
  fileTypes: ['.json', '.yaml', '.yml', '.po']
};
```

## 检查规则详解

### 1. 缺失 Key (missing-key)

检查翻译文件中是否缺少基准语言中存在的 Key。

**示例问题**:
- 基准语言有 `user.logout`，但英文翻译中没有

### 2. 多余 Key (extra-key)

检查翻译文件中是否存在基准语言中没有的 Key。

**示例问题**:
- 英文翻译有 `extraKey`，但基准语言中没有

### 3. 空文案 (empty-value)

检查翻译值是否为空字符串或 null。

**示例问题**:
- `common.cancel` 的值为 `""`

### 4. 占位符不一致 (placeholder-mismatch)

检查占位符 `{name}`、`%{count}` 等是否在翻译中被错误修改。

**示例问题**:
- 基准: `你好，{name}！`
- 错误翻译: `Hello, {user}！` (占位符名改变)

### 5. ICU Plural 分支缺失/多余 (icu-plural-missing/extra)

检查 ICU message format 的 plural 分支是否完整。

支持的分支: `zero`, `one`, `two`, `few`, `many`, `other`, `=0`, `=1` 等

**示例问题**:
- 基准: `{count, plural, =0 {无} one {1个} other {{count}个}}`
- 错误翻译: `{count, plural, =0 {None} one {1 item}}` (缺少 `other` 分支)

### 6. 变量名不一致 (variable-name-mismatch)

检查同一个 Key 在不同语言中的变量名是否一致。

**示例问题**:
- 基准: `欢迎回来，{username}`
- 日文: `おかえりなさい、{user_name}` (变量名使用下划线)

### 7. 长度风险 (length-risk)

检查翻译长度是否比基准文案长太多，可能导致 UI 显示问题。

**配置说明**:
- `threshold`: 长度比例阈值，默认 1.5 倍
- `minBaseLength`: 基准文案最小长度，默认 5 字符（短文案不检查）

**示例问题**:
- 基准: `立即支付` (4 字符)
- 英文: `Pay Now Button` (14 字符) → 比例 3.5x，超过阈值

## 输出报告

### 终端输出 (console)

彩色的终端摘要，按严重级别分组显示问题详情。

### JSON 报告 (json)

完整的结构化数据，包含所有问题详情和统计信息。

```json
{
  "metadata": {
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "baseLanguage": "zh-CN",
    "localeDir": "./locales"
  },
  "statistics": {
    "total": 5,
    "bySeverity": { "error": 3, "warning": 2, "info": 0 },
    "byRule": { "missing-key": 2, "placeholder-mismatch": 1 },
    "byLanguage": { "en-US": 4, "ja-JP": 1 }
  },
  "issues": [...],
  "ignored": [...]
}
```

### Markdown 报告 (markdown)

适合放到 CI 评论或文档中的 Markdown 格式报告。

### HTML 报告 (html)

交互式的 HTML 报告，支持按严重级别筛选查看问题。

## 退出码规则

| 退出码 | 含义 |
|--------|------|
| 0 | 成功（无错误，可能有警告） |
| 1 | 发现错误 |
| 2 | 配置错误 |
| 3 | 文件解析错误 |
| 4 | 运行时错误 |

### 在 CI 中使用

```bash
#!/bin/bash

# 运行检查
i18n-lint -l ./locales -b zh-CN -f console json

# 获取退出码
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 检查通过"
elif [ $EXIT_CODE -eq 1 ]; then
  echo "❌ 发现错误，需要修复"
  exit 1
else
  echo "⚠️  工具执行出错"
  exit 1
fi
```

## 目录结构

```
i18n-lint-cli/
├── bin/
│   └── i18n-lint.js         # CLI 入口脚本
├── src/
│   ├── cli.js                # 主 CLI 逻辑
│   ├── config/
│   │   └── index.js          # 配置模块
│   ├── parsers/
│   │   └── index.js          # 文件解析器 (JSON/YAML/PO)
│   ├── checkers/
│   │   └── index.js          # 检查规则实现
│   └── reporters/
│       └── index.js          # 报告生成器
├── examples/
│   ├── i18n-lint.config.js   # 示例配置文件
│   ├── normal/               # 正常样例（应该通过）
│   │   └── locales/
│   │       ├── zh-CN.json
│   │       ├── en-US.json
│   │       └── ja-JP.yaml
│   ├── with-errors/          # 错误样例（会检出问题）
│   │   └── locales/
│   │       ├── zh-CN.json
│   │       ├── en-US.json
│   │       └── ja-JP.yaml
│   └── po-format/            # PO 格式样例
│       └── locales/
│           ├── zh-CN.po
│           └── en-US.po
├── package.json
└── README.md
```

## 示例数据说明

### 正常样例 (examples/normal)

所有语言的 Key、占位符、ICU plural 都完全对齐，运行检查应该通过。

### 错误样例 (examples/with-errors)

包含以下类型的问题：

| 问题类型 | 示例 Key | 说明 |
|----------|----------|------|
| 缺失 Key | `user.logout`, `common.error` | 英文翻译缺少这些 Key |
| 空文案 | `common.cancel` | 英文翻译值为空字符串 |
| 占位符错误 | `user.greeting`, `order.checkout.pay.amount` | 占位符名被错误修改 |
| ICU Plural 缺失 | `order.pluralCount` | 英文缺少 `other` 分支 |
| ICU Plural 多余 | `order.pluralCount` | 日文多了 `few` 分支 |
| 变量名不一致 | `user.welcome`, `validation.minLength` | 变量名风格不一致 |
| 长度风险 | `common.success`, `order.title` | 翻译长度超过阈值 |
| 多余 Key | `extraKey`, `anotherExtra.nestedExtra` | 英文有基准没有的 Key |

### PO 格式样例 (examples/po-format)

展示 gettext PO 格式文件的支持，同样包含一些问题用于测试。

## 错误处理

工具会优雅处理以下错误情况：

### 1. 配置文件错误

- 配置文件不存在 → 使用默认配置
- 配置字段类型错误 → 给出清晰的错误提示
- JSON 格式错误 → 给出具体的行号和列号

### 2. 文件解析错误

- JSON 语法错误 → 显示错误位置（行、列）
- YAML 缩进错误 → 显示错误位置
- PO 文件格式错误 → 显示具体错误信息

### 3. 运行时错误

- locale 目录不存在 → 给出提示
- 无权限读取文件 → 显示权限错误

## 调试模式

设置 `DEBUG` 环境变量可以显示详细的错误堆栈：

```bash
DEBUG=1 i18n-lint -l ./locales
```

## License

MIT
