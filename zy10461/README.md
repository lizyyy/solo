# env-shadow-cli

🔍 **环境变量影子CLI - 多源环境变量优先级分析与覆盖追踪工具

在同一个项目中，`.env`、Shell脚本、Docker Compose都可能定义环境变量，而实际生效的值总是被覆盖。这个工具帮你追踪变量的来源、计算优先级、追踪覆盖链。

## ✨ 功能特性

- 📁 **多源解析**: 支持 `.env`、Shell脚本、Docker Compose 文件
- ⚖️ **优先级计算**: 自动计算不同来源的优先级
- 🔗 **覆盖链追踪**: 清晰展示每个变量的完整覆盖链路
- ❌ **坏行检测**: 检测并定位无法解析的坏配置行
- 📊 **多格式输出**: 终端摘要、JSON机器可读格式、HTML可分享报告

## 📦 安装

```bash
# 克隆项目后安装依赖
npm install

# 全局安装 CLI 命令
npm link
```

## 🚀 快速开始

### 基本用法

```bash
# 分析指定目录
env-shadow --input ./examples

# 指定输出目录
env-shadow -i ./my-project/config -o ./reports
```

### 命令选项

| 选项 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input <directory>` | `-i` | 输入目录路径（必需） | - |
| `--output <directory>` | `-o` | 输出目录路径 | `./output` |
| `--help` | `-h` | 显示帮助信息 | - |
| `--version` | `-V` | 显示版本号 | - |

## 📂 输入目录结构

工具会递归扫描输入目录下的所有支持的文件类型：

```
your-project/
├── .env                  # dotenv 文件
├── .env.production        # 环境特定的 env 文件
├── start.sh              # Shell 脚本
├── docker-compose.yml    # Docker Compose 文件
└── subdir/
    └── .env.local      # 子目录中的文件也会被扫描
```

### 支持的文件类型

| 类型 | 匹配模式 | 优先级 |
|------|---------|--------|
| dotenv | `.env`, `.env.*` | 10 (最低) |
| Shell | `*.sh`, `*.bash` | 20 |
| Compose | `docker-compose.yml`, `compose.yml` | 30 (最高) |

> **注意**: 优先级数字越大，优先级越高，会覆盖优先级低的定义。同类型文件中，后扫描的文件优先级更高。

## 📄 输出报告

### 1. 终端输出

运行命令后，终端会显示：
- 📊 统计摘要（变量总数、覆盖数、错误数等
- 📁 源文件列表
- 🔄 被覆盖变量的明细
- ✅ 最终生效的所有变量
- ❌ 解析错误详情（如存在）

### 2. JSON 报告

文件名: `env-shadow-report-<timestamp>.json`

包含完整的结构化数据，便于后续处理：

```json
{
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "inputDirectory": "/path/to/input",
  "statistics": {
    "totalVariables": 20,
    "totalDefinitions": 35,
    "overriddenCount": 8,
    "uniqueSources": 3,
    "errorCount": 2,
    "noOverrides": 12
  },
  "sources": [...],
  "variables": [
    {
      "name": "APP_NAME",
      "finalValue": "compose-web-app",
      "winner": { ... },
      "definitions": [...],
      "overrideChain": [...]
    }
  ],
  "errors": [...]
}
```

### 3. HTML 报告

文件名: `env-shadow-report-<timestamp>.html`

适合发给同事查看的交互式报告：
- 美观的统计卡片
- 可展开的覆盖链详情
- 源文件类型标签
- 错误详情高亮

## ❌ 错误处理与退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功完成，无错误 |
| 1 | 输入错误或处理失败失败| | 2 检测到解析错误（即使分析完成但有解析错误 | | | |

### | | 常见常见常见常见错误处理坏数据处理当工具有坏数据（坏行）工具，会有以下处理方式处理：
1. 坏行会被检测并记录到报告中 errors 数组
2. 每个错误都包含：类型、消息、源文件路径、行号、原始内容
3. 工具会继续执行，不会因为部分文件有坏行而终止
4. 最终退出码为 2 表示有解析错误，但报告已生成

示例错误示例：当遇到YAML语法错误时，会显示错误位置：
```
❌ 解析错误明细
  1. YAML_ERROR: 无法解析的变量格式
     📍 文件: /path/to/file.yml
     📍 行号: 15
     📍 内容: invalid: yaml: line:
```

Shell脚本中的坏行示例：
```
❌ 解析错误明细
  2. BAD_LINE: 无法解析的Shell变量格式
     📍 文件: /path/to/start.sh
     📍 行号: 22
     📍 内容: EXPORT WRONG_CASE=test
```

## 🔍 优先级规则说明

优先级计算规则：
1. **文件类型优先级**: compose (30) > shell (20) > dotenv (10)
2. **同类型文件**: 按文件扫描顺序，后扫描的文件优先级更高
3. **同一文件内**: 后定义的变量覆盖前面的定义

示例场景：
```
.env 中定义: DB_HOST=localhost (优先级 10000+)
start.sh 中定义: DB_HOST=shell-db-host (优先级 20000+)
docker-compose.yml 中定义: DB_HOST=db (优先级 30000+)

最终生效: DB_HOST=db (来自 docker-compose.yml)
覆盖链路: .env → start.sh → docker-compose.yml
```

## 📋 项目结构

```
env-shadow-cli/
├── src/
│   ├── cli.js                 # CLI 入口
│   ├── core/
│   │   └── variable-engine.js  # 核心引擎
│   ├── parsers/
│   │   ├── dotenv-parser.js    # dotenv 解析器
│   │   ├── shell-parser.js      # Shell 解析器
│   │   └── compose-parser.js   # Docker Compose 解析器
│   └── output/
│       ├── terminal-formatter.js  # 终端输出格式化
│       └── html-formatter.js     # HTML 报告格式化
├── examples/                 # 示例配置文件
├── package.json
└── README.md
```

## 🧪 运行示例

```bash
# 安装依赖
npm install

# 运行示例分析
node src/cli.js --input ./examples --output ./output

# 查看生成的报告
open ./output/env-shadow-report-*.html
```

## 📝 常见问题

### Q: 为什么我的变量没有被检测到？
- 确保文件格式符合支持的类型
- 检查变量定义语法是否正确
- 查看报告中的 errors 部分是否有解析错误

### Q: 如何判断哪个定义最终生效？
在报告中的每个变量都会显示 winner 信息，包含：
- 最终值
- 来源文件
- 行号
- 来源类型

### Q: 可以只分析单个文件吗？
当前版本只支持目录扫描。可以将单个文件放在一个目录中进行分析。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
