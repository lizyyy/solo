# env-checker

一个用于检查前端/Node.js 项目中环境变量"漂移"问题的命令行工具。

## 问题背景

在日常开发中，你是否经常遇到以下问题：

- `.env.example` 写了一套环境变量，但 `.env.local` 又多了几项
- `docker-compose.yml` 中引用了其他地方没定义的变量
- `package.json` 的 scripts 里偷偷用了别的环境变量
- README 文档里提到了某些变量，但实际配置文件中没有
- 同一个变量在不同文件中有不同的默认值
- 部署时才发现缺少某些环境变量

`env-checker` 就是为了解决这些问题而设计的。

## 功能特性

- 🔍 **全面扫描**：支持扫描 `.env*`、`docker-compose.yml/yaml`、`package.json` scripts、Markdown 文档
- 📋 **统一归并**：将分散在各处的环境变量引用统一整理
- 🚨 **智能检测**：
  - 检测 example 文件中缺失但代码/脚本用到的变量
  - 检测 local 文件中有但 example 中未声明的变量
  - 检测同一个变量在不同文件的默认值冲突
  - 检测看起来像密钥的敏感值
- 🔒 **密钥脱敏**：报告中的敏感值会自动脱敏
- ⚙️ **灵活配置**：支持通过配置文件标记可选变量或本地专用变量
- 📊 **多种输出**：终端彩色输出、Markdown 报告、JSON 结果（适合 CI）

## 安装

### 从源码安装

```bash
# 克隆项目
git clone <repo-url>
cd env-checker

# 安装依赖
npm install

# 全局链接（可选）
npm link
```

### 直接运行

```bash
node /path/to/env-checker/src/cli.js --help
```

## 快速开始

### 1. 生成配置文件（可选但推荐）

```bash
env-checker init-config
```

这会在当前目录生成 `.env-checker.config.json` 配置文件，你可以编辑它来：

- 标记可选变量（这些变量缺失不会被视为错误）
- 标记仅本地使用的变量（这些变量在 .env.local 中存在但 .env.example 中缺失不会被视为问题）
- 配置要排除的文件/目录
- 调整扫描范围

### 2. 扫描项目

```bash
# 扫描当前目录
env-checker scan

# 扫描指定目录
env-checker scan /path/to/your/project

# 扫描并导出报告
env-checker scan /path/to/project --json report.json --markdown report.md

# 扫描并导出到目录（自动生成带时间戳的文件名）
env-checker scan /path/to/project -o ./reports
```

## 命令说明

### `scan` 命令

扫描项目中的环境变量并检查问题。

**用法：**
```bash
env-checker scan [options] [directory]
```

**参数：**
- `directory`：项目目录路径（默认：当前目录）

**选项：**
- `-c, --config <path>`：指定配置文件路径
- `-o, --output <path>`：输出报告目录（自动生成 JSON 和 Markdown 报告）
- `--json <file>`：导出 JSON 报告到指定文件
- `--markdown <file>`：导出 Markdown 报告到指定文件
- `--no-console`：不输出终端报告

**示例：**
```bash
# 基本扫描
env-checker scan ./my-project

# 使用自定义配置
env-checker scan ./my-project -c ./my-config.json

# 导出报告
env-checker scan ./my-project --json ./result.json --markdown ./report.md

# CI 中使用（只输出 JSON，不输出终端报告）
env-checker scan ./my-project --json ./ci-result.json --no-console
```

### `init-config` 命令

生成带注释的配置模板文件。

**用法：**
```bash
env-checker init-config [path]
```

**参数：**
- `path`：配置文件路径（默认：`.env-checker.config.json`）

**示例：**
```bash
# 在当前目录生成默认配置
env-checker init-config

# 在指定位置生成配置
env-checker init-config ./my-project/.env-checker.json
```

## 配置文件说明

配置文件是一个 JSON 文件，包含以下选项：

```json
{
  "optionalVars": [
    "DEBUG",
    "LOG_LEVEL"
  ],
  "localOnlyVars": [
    "DEV_TOOLS",
    "HOT_RELOAD"
  ],
  "excludedFiles": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**"
  ],
  "envFilePatterns": [
    ".env",
    ".env.example",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test"
  ],
  "scanMarkdown": true,
  "scanDockerCompose": true,
  "scanPackageJson": true,
  "redactSecrets": true
}
```

**配置项说明：**

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `optionalVars` | string[] | 可选变量列表，这些变量缺失不会被视为错误 |
| `localOnlyVars` | string[] | 本地专用变量列表，这些变量在 .env.local 中存在但 .env.example 中缺失不会被视为问题 |
| `excludedFiles` | string[] | 要排除的文件/目录模式（支持 glob 风格） |
| `envFilePatterns` | string[] | 要扫描的 env 文件模式 |
| `scanMarkdown` | boolean | 是否扫描 Markdown 文档中的环境变量 |
| `scanDockerCompose` | boolean | 是否扫描 docker-compose 文件 |
| `scanPackageJson` | boolean | 是否扫描 package.json 中的 scripts |
| `redactSecrets` | boolean | 是否在报告中脱敏密钥值 |

## 退出码约定

| 退出码 | 含义 |
|--------|------|
| `0` | 成功，没有发现严重/中等问题 |
| `1` | 发现了需要关注的问题（严重或中等） |
| `2` | 配置文件错误 |
| `3` | 扫描过程中出错 |

**在 CI 中使用：**

```bash
# 如果发现问题，CI 会失败
env-checker scan ./my-project --json ./report.json

# 或者使用退出码判断
env-checker scan ./my-project
if [ $? -ne 0 ]; then
  echo "发现环境变量问题！"
  exit 1
fi
```

## 检测的问题类型

### 1. Example 中缺失（严重）

变量在代码/脚本/docker-compose 中使用，但 `.env.example` 中没有定义。

**可能的影响：** 新同事克隆项目后不知道需要配置这些变量。

### 2. Local 中多余（中等）

变量在 `.env.local` 中存在，但 `.env.example` 中未声明。

**可能的影响：** 这些变量可能是临时添加的，应该考虑是否需要同步到 example 文件，或者标记为本地专用变量。

### 3. 值冲突（中等）

同一个变量在不同文件中有不同的默认值。

**可能的影响：** 导致开发、测试、生产环境行为不一致。

### 4. 潜在密钥（轻微）

变量名或值看起来像敏感信息（如 API_KEY、SECRET、PASSWORD 等）。

**提示：** 这些值在报告中会自动脱敏。

## 支持的文件类型

### .env* 文件

扫描以下格式的 env 文件：
- `.env`
- `.env.example`
- `.env.local`
- `.env.development`
- `.env.production`
- `.env.test`

支持的语法：
```bash
# 注释
VAR_NAME=value
VAR_NAME="quoted value"
VAR_NAME='single quoted'
```

### docker-compose.yml/yaml

解析 `services` 下的 `environment` 配置，支持数组和对象两种格式：

```yaml
services:
  web:
    environment:
      - NODE_ENV=production
      - API_KEY
    # 或者
    environment:
      NODE_ENV: production
      API_KEY:
```

### package.json scripts

解析 `scripts` 中的环境变量引用：

```json
{
  "scripts": {
    "start": "NODE_ENV=production node server.js",
    "dev": "PORT=3001 nodemon server.js"
  }
}
```

### Markdown 文档

解析代码块中的环境变量引用：

```markdown
```bash
export API_KEY=your_key
export DB_HOST=localhost
```
```

## 示例项目

项目包含一个示例项目 `examples/sample-project`，用于演示各种环境变量问题：

```
examples/sample-project/
├── .env.example          # 示例环境变量（缺少一些变量）
├── .env.local            # 本地环境变量（有额外变量和不同的值）
├── docker-compose.yml    # Docker Compose 配置（引用了更多变量）
├── package.json          # 包含使用环境变量的 scripts
├── README.md             # 文档中引用了环境变量
├── .env-checker.config.json # 配置文件示例
├── report.json           # 示例 JSON 报告
└── report.md             # 示例 Markdown 报告
```

### 运行示例

```bash
# 扫描示例项目
env-checker scan examples/sample-project

# 使用示例配置文件扫描
env-checker scan examples/sample-project -c examples/sample-project/.env-checker.config.json
```

## 项目结构

```
env-checker/
├── bin/
│   └── env-checker.js          # CLI 入口
├── src/
│   ├── cli.js                   # CLI 主程序
│   ├── config/
│   │   └── config.js            # 配置文件管理
│   ├── parsers/
│   │   ├── envParser.js         # .env* 文件解析
│   │   ├── dockerComposeParser.js # docker-compose 解析
│   │   ├── packageJsonParser.js # package.json 解析
│   │   └── markdownParser.js    # Markdown 解析
│   ├── scanner/
│   │   └── scanner.js           # 统一扫描器
│   ├── checker/
│   │   └── rules.js             # 规则检查
│   ├── reporter/
│   │   ├── consoleReporter.js   # 终端输出
│   │   ├── jsonReporter.js      # JSON 报告
│   │   └── markdownReporter.js  # Markdown 报告
│   └── utils/
│       └── constants.js         # 常量定义
├── examples/
│   └── sample-project/          # 示例项目
├── package.json
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 本地测试
node src/cli.js --help

# 运行测试（如果有）
npm test
```

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
