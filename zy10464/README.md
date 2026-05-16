# Postman Collection 覆盖审计 CLI

一个功能完整的命令行工具，用于审计 Postman Collection 的测试覆盖情况，包括断言覆盖、示例响应覆盖和变量引用校验。

## 功能特性

- ✅ **断言覆盖检测** - 识别哪些请求缺少测试断言
- 📋 **示例响应检测** - 识别哪些请求缺少示例响应
- 🔧 **变量引用校验** - 检测未定义的环境变量引用
- 📊 **多格式输出** - 支持终端摘要、JSON 机器可读格式、Markdown 报告
- 🎯 **可配置退出码** - CI/CD 集成友好
- 🔍 **精确溯源** - 每个问题都能追溯到 Collection 中的具体位置

## 安装

```bash
# 全局安装
npm install -g .

# 或者直接使用
node src/cli.js
```

## 快速开始

```bash
# 基本使用
postman-audit --collection your-collection.json

# 同时检查环境变量
postman-audit --collection your-collection.json --environment your-env.json

# 指定输出目录和报告名称
postman-audit -c collection.json -e env.json -o ./reports -n my-project-audit

# 只生成 JSON 报告
postman-audit -c collection.json -f json

# 严格模式：缺少断言或示例时退出码非零
postman-audit -c collection.json --fail-on-missing-assert --fail-on-missing-example
```

## 命令行参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--collection <path>` | `-c` | **必填** Postman Collection JSON 文件路径 |
| `--environment <path>` | `-e` | Postman 环境变量 JSON 文件路径 |
| `--output <dir>` | `-o` | 输出目录 (默认: `./audit-output`) |
| `--format <formats>` | `-f` | 输出格式，逗号分隔: `console,json,markdown` (默认: 全部) |
| `--name <name>` | `-n` | 报告文件名前缀 (默认: `postman-audit`) |
| `--fail-on-missing-assert` | | 缺少断言时退出码为 1 |
| `--fail-on-missing-example` | | 缺少示例时退出码为 2 |
| `--verbose` | `-v` | 显示详细日志 |
| `--quiet` | `-q` | 静默模式，只显示错误 |
| `--help` | `-h` | 显示帮助信息 |
| `--version` | | 显示版本号 |

## 输出示例

### 终端输出

```
======================================================================
  Postman Collection 覆盖审计报告
======================================================================
  Collection: 示例 API Collection
  审计时间: 2026/5/17 03:40:28
  请求总数: 5
======================================================================

📊 断言覆盖统计
----------------------------------------------------------------------
  覆盖率: [████████████░░░░░░░░░░░░░░░░░░] 40%
  有断言: 2 / 5 请求
  无断言: 3 / 5 请求
  断言总数: 3 个

📋 示例响应覆盖统计
----------------------------------------------------------------------
  覆盖率: [████████████░░░░░░░░░░░░░░░░░░] 40%
  有示例: 2 / 5 请求
  无示例: 3 / 5 请求
  示例总数: 2 个

❌ 缺少断言的请求
----------------------------------------------------------------------
  [POST] 创建用户
    路径: 用户管理 > 创建用户
    URL: {{base_url}}/api/users
    源文件: /path/to/collection.json
    位置: item[0][1]

⚠️  发现的问题
----------------------------------------------------------------------
  🔵 INFO (1)
    [示例] ONLY_SUCCESS_EXAMPLE: 只有成功响应示例 (200)
       建议: 考虑添加错误场景的示例 (400, 404, 500 等)

======================================================================
  总体评价: 🔴 需要改进
  断言覆盖率: 40% | 示例覆盖率: 40%
======================================================================
```

### Markdown 报告

生成的 Markdown 报告包含以下章节：
- 基本信息
- 总体概览和评价
- 断言覆盖分析（含类型分布和缺失列表）
- 示例响应覆盖分析（含状态码分布和缺失列表）
- 变量引用分析（含未定义变量和引用统计）
- 发现的问题（按严重程度分级）
- 改进建议（按优先级排序）

### JSON 报告

JSON 报告包含完整的结构化数据，适合集成到其他工具或 CI/CD 流水线中：

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-05-16T20:40:28.263Z",
  "metadata": { ... },
  "summary": {
    "assertions": { "rate": 40, "withAssertions": 2, ... },
    "examples": { "rate": 40, "withExamples": 2, ... }
  },
  "assertions": { "coverage": { ... }, "statistics": { ... }, "requests": { ... } },
  "examples": { ... },
  "variables": { ... }
}
```

## 项目结构

```
postman-coverage-audit/
├── src/
│   ├── cli.js                    # CLI 入口和参数解析
│   ├── collection-parser.js      # Collection 文件解析器
│   ├── assertion-detector.js     # 断言识别和统计
│   ├── example-detector.js       # 示例响应检测
│   ├── variable-validator.js     # 变量引用校验
│   ├── console-reporter.js       # 终端报告生成器
│   ├── json-reporter.js          # JSON 报告生成器
│   └── markdown-reporter.js      # Markdown 报告生成器
├── examples/
│   ├── sample-collection.json    # 示例 Collection 文件
│   └── sample-environment.json   # 示例环境变量文件
├── audit-output/                 # 默认输出目录
├── package.json
└── README.md
```

## 支持的断言类型

- `pm.test()` - Postman 现代测试语法
- `pm.expect()` - Chai.js 风格断言
- `tests[]` - Postman 传统测试语法
- 状态码检查、响应体检查、响应时间检查等

## CI/CD 集成示例

```bash
# GitHub Actions / GitLab CI 示例
postman-audit -c ./api-collection.json \
  -o ./artifacts \
  -f json,markdown \
  --fail-on-missing-assert \
  --fail-on-missing-example
```

## 许可证

MIT
