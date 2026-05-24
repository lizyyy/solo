# 多语言长度溢出检测 CLI 工具

用于检测多语言翻译文案的长度溢出问题，帮助设计师和运营在交付前发现风险。

## 功能特性

- ✅ **全角字符宽度计算** - 正确处理中日韩等全角字符
- ✅ **占位符校验** - 检测占位符缺失、多余或顺序错误
- ✅ **复数形式支持** - 处理多语言复数分支（zero/one/two/few/many/other）
- ✅ **风险分级** - 严重/警告/提示/安全四级风险
- ✅ **多格式输出** - 终端摘要、JSON、Markdown 报告
- ✅ **结果稳定性** - 配置哈希确保重复运行结果可追溯
- ✅ **覆盖/追加模式** - 灵活处理已有报告文件

## 安装

```bash
npm install
npm run build
npm link  # 全局安装命令
```

## 快速开始

### 命令行直接使用

```bash
# 检测单个文件
i18n-length ./locales/en.json -l en -p "登录按钮" -w 20

# 检测多个文件
i18n-length ./locales/*.json -l en -p "登录按钮" -w 20

# 指定输出格式
i18n-length ./locales/*.json -l en -p "按钮" -w 20 -f json md
```

### 使用配置文件

```bash
i18n-length -c ./checks.json ./locales/*.json
```

## 配置文件示例 (checks.json)

```json
{
  "checks": [
    {
      "keyPattern": "^button\\.",
      "locale": "zh-CN",
      "interfacePosition": "登录按钮",
      "maxWidth": 20,
      "placeholders": []
    },
    {
      "keyPattern": "^button\\.",
      "locale": "en",
      "interfacePosition": "登录按钮",
      "maxWidth": 30,
      "placeholders": []
    },
    {
      "keyPattern": "^sms\\.",
      "locale": "*",
      "interfacePosition": "短信验证码",
      "maxWidth": 70,
      "maxChars": 35,
      "placeholders": ["{code}", "{username}"]
    }
  ],
  "output": {
    "dir": "./reports",
    "formats": ["console", "json", "md"]
  }
}
```

### 配置项说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `keyPattern` | **推荐** - 按 key 模式过滤配置，支持正则表达式。如 `^button\\.` 匹配所有 `button.` 开头的 key | `"^sms\\."` |
| `locale` | 语言代码，`*` 表示所有语言 | `"en"`, `"zh-CN"`, `"*"` |
| `interfacePosition` | 界面位置名称，用于报告展示 | `"登录按钮"`, `"短信验证码"` |
| `maxWidth` | 最大宽度单位（全角字符占 2 单位） | `20` |
| `maxChars` | 可选 - 最大字符数 | `35` |
| `placeholders` | 可选 - 预期占位符列表 | `["{code}", "{username}"]` |

## 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `-i, --input` | 输入文件 | `-i locales/en.json,locales/ja.json` |
| `-o, --output` | 输出目录 | `-o ./reports` |
| `-c, --config` | 配置文件路径 | `-c ./checks.json` |
| `-l, --locale` | 目标语言代码 | `-l en` |
| `-p, --position` | 界面位置名称 | `-p "登录按钮"` |
| `-w, --max-width` | 最大宽度单位 | `-w 20` |
| `--max-chars` | 最大字符数 | `--max-chars 35` |
| `--placeholders` | 预期占位符 | `--placeholders "{code},{name}"` |
| `-f, --format` | 输出格式 | `-f json md console` |
| `--overwrite` | 覆盖已存在报告 | `--overwrite` |
| `--append` | 追加到已有报告 | `--append` |
| `-v, --verbose` | 显示详细信息 | `-v` |
| `-q, --quiet` | 静默模式 | `-q` |

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 无问题 |
| 1 | 存在警告 |
| 2 | 存在严重问题 |
| 3 | 命令行参数错误 |
| 4 | 文件读取错误 |

## 项目结构

```
src/
├── types.ts            # 类型定义
├── parser.ts           # i18n 文件解析器
├── widthCalculator.ts  # 字符宽度计算器
├── placeholderChecker.ts # 占位符校验
├── riskAssessor.ts     # 风险分级
├── checker.ts          # 核心检测逻辑
├── reportGenerator.ts  # 报告生成器
├── cli.ts              # CLI 入口
└── index.ts            # 模块导出
```

## 示例

查看 `examples/` 目录获取完整的使用示例。

```bash
# 运行示例
node dist/cli.js -c examples/checks.json examples/locales/*.json --overwrite
```
