# Release Scope

一个 CLI 工具，帮助小团队在发版前快速整理 "这次 Git 改动到底影响了哪里"。

## 功能特性

- 🔍 **智能分析**: 自动读取 Git 工作区或指定 commit 范围的改动
- 📋 **规则驱动**: 基于路径 glob、文件类型、关键字命中进行智能匹配
- 🚦 **风险分级**: critical/high/medium/low 四级风险评估
- 📊 **多维分组**: 按模块、负责人、风险级别分组展示
- 📝 **多种输出**: 终端表格、JSON、Markdown 三种输出格式
- 🎯 **内置示例**: 无需真实 Git 仓库也能体验完整功能

## 安装

```bash
# 克隆项目
git clone <repo-url>
cd release-scope

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# （可选）链接到全局命令
npm link
```

## 快速开始

### 方式一：使用内置示例体验

```bash
# 查看可用示例
release-scope list-samples

# 使用默认示例运行分析
release-scope scan --sample

# 使用指定示例
release-scope scan --sample mobile-only
```

### 方式二：在你的项目中使用

```bash
# 1. 生成示例配置文件
release-scope init-sample

# 2. 编辑配置文件，根据你的项目修改模块和规则
vi release-scope.yaml

# 3. 扫描当前工作区的改动
release-scope scan

# 4. 或者扫描两个版本之间的改动
release-scope scan -f v1.0.0 -t v1.1.0

# 5. 导出报告到文件
release-scope export -o impact-report.md
release-scope export --format json -o impact-report.json
```

## 命令详解

### scan - 扫描改动并生成报告

```bash
# 扫描当前工作区
release-scope scan

# 扫描指定项目目录
release-scope scan -p /path/to/project

# 使用指定配置文件
release-scope scan -c ./my-config.yaml

# 扫描两个 commit 之间的改动
release-scope scan -f abc123 -t def456

# 输出为 JSON 格式
release-scope scan --json

# 输出为 Markdown 格式
release-scope scan --md
```

### explain-config - 解释配置文件

```bash
# 检查当前目录的配置文件
release-scope explain-config

# 检查指定配置文件
release-scope explain-config ./release-scope.yaml

# 显示完整的配置详情
release-scope explain-config --full
```

### init-sample - 初始化示例配置

```bash
# 使用默认示例生成配置
release-scope init-sample

# 指定输出路径
release-scope init-sample -o ./config/release-scope.yaml

# 使用移动端项目示例
release-scope init-sample -s mobile-only

# 覆盖已存在的文件
release-scope init-sample --force
```

### export - 导出报告

```bash
# 导出为 Markdown（默认）
release-scope export -o report.md

# 导出为 JSON
release-scope export --format json -o report.json

# 使用示例数据导出
release-scope export --sample -o sample-report.md
```

### list-samples - 列出内置示例

```bash
release-scope list-samples
```

## 配置文件说明

配置文件支持 YAML 和 JSON 格式。以下是一个完整的配置示例：

```yaml
version: '1.0'
projectName: my-fullstack-app

# 模块定义
modules:
  - name: frontend
    paths:
      - 'src/**/*.tsx'
      - 'src/**/*.ts'
      - 'src/components/**/*'
    owners:
      - 'frontend-team'
      - 'alice'
    defaultCheckCommands:
      - 'npm run test:frontend'
      - 'npm run lint:frontend'
    riskLevel: medium

  - name: backend
    paths:
      - 'backend/**/*.py'
      - 'backend/api/**/*'
    owners:
      - 'backend-team'
      - 'bob'
    defaultCheckCommands:
      - 'pytest backend/'
      - 'flake8 backend/'
    riskLevel: high

  - name: database
    paths:
      - 'backend/db/migrations/**/*'
    owners:
      - 'dba-team'
    defaultCheckCommands:
      - 'sqitch verify'
    riskLevel: critical

# 规则定义
rules:
  - id: auth-changes
    name: 认证相关改动
    description: 涉及用户认证、授权、MFA 等安全相关的改动
    keywords:
      - 'auth'
      - 'login'
      - 'password'
      - 'MFA'
      - 'token'
      - 'jwt'
    paths:
      - '**/*auth*'
    riskLevel: critical
    blockingLevel: required
    checkCommands:
      - 'npm run test:auth'
      - 'npm run security:scan'
    confirmations:
      - '确认认证逻辑变更不会影响现有用户登录'

  - id: db-migrations
    name: 数据库迁移
    description: 数据库 schema 变更
    fileTypes:
      - '.sql'
    paths:
      - '**/migrations/**/*'
    riskLevel: critical
    blockingLevel: required
    checkCommands:
      - 'sqitch verify'
    confirmations:
      - '确认迁移脚本有对应的回滚脚本'
      - '确认大数据表的变更已考虑锁表风险'

# 全局检查命令（所有改动都会触发）
globalCheckCommands:
  - 'npm run lint'
  - 'npm run typecheck'

# 默认风险级别
defaultRiskLevel: medium
```

### 配置字段说明

#### 模块配置 (modules)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模块名称 |
| paths | string[] | 是 | 路径 glob 模式数组 |
| owners | string[] | 否 | 负责人列表 |
| defaultCheckCommands | string[] | 否 | 默认检查命令 |
| riskLevel | string | 否 | 模块默认风险级别 |

#### 规则配置 (rules)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 规则唯一标识 |
| name | string | 是 | 规则名称 |
| description | string | 否 | 规则描述 |
| paths | string[] | 否 | 路径 glob 模式 |
| fileTypes | string[] | 否 | 文件扩展名（如 `.sql`） |
| keywords | string[] | 否 | 关键字（在 diff 内容中匹配） |
| modules | string[] | 否 | 模块名称列表 |
| owners | string[] | 否 | 负责人列表 |
| riskLevel | string | 是 | 风险级别：critical/high/medium/low |
| blockingLevel | string | 是 | 阻断级别：required/recommended/optional |
| checkCommands | string[] | 否 | 建议执行的检查命令 |
| confirmations | string[] | 否 | 需要人工确认的事项 |

### 风险级别 (Risk Level)

| 级别 | 颜色 | 说明 |
|------|------|------|
| critical | 🔴 红色 | 严重风险，必须立即处理 |
| high | 🟠 橙色 | 高风险，需要重点关注 |
| medium | 🟡 黄色 | 中等风险，建议检查 |
| low | 🟢 绿色 | 低风险，一般改动 |

### 阻断级别 (Blocking Level)

| 级别 | 优先级 | 说明 |
|------|--------|------|
| required | 3 | 必须执行 |
| recommended | 2 | 建议执行 |
| optional | 1 | 可选执行 |

## 输出格式

### 终端表格输出

运行 `release-scope scan --sample` 会显示：

- 📊 改动统计表格
- 🔴 Critical 风险文件详情
- 🟠 High 风险文件详情
- 🟡 Medium 风险文件详情
- 🛠️ 建议执行的检查命令（按优先级排序）
- ⚠️ 需要人工确认的事项
- 📦 按模块分组
- 👥 按负责人分组

### Markdown 输出

适合粘贴到 PR 描述中，包含：

- 改动统计
- 按风险级别分组的文件详情
- 建议执行的检查命令
- 需要人工确认的事项清单
- 模块分布
- 负责人汇总

### JSON 输出

适合 CI/CD 集成，包含完整的结构化数据。

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── types/
│   └── index.ts          # TypeScript 类型定义
├── git/
│   └── collector.ts      # Git 改动采集器
├── config/
│   └── parser.ts         # 配置解析和校验
├── matcher/
│   └── rule-matcher.ts   # 规则匹配引擎
├── analyzer/
│   └── engine.ts         # 分析引擎
├── reporter/
│   └── generator.ts      # 报告生成器
└── samples/
    └── index.ts          # 内置示例数据
```

## 模块职责

1. **Git Collector**: 负责读取 Git 改动，支持工作区、commit 范围、文件重命名、二进制文件识别
2. **Config Parser**: 解析 YAML/JSON 配置，进行完整的字段校验和默认值处理
3. **Rule Matcher**: 路径 glob 匹配、文件类型匹配、关键字命中（支持 diff 内容和文件名）
4. **Analysis Engine**: 协调各模块，计算风险评分，去重排序检查命令
5. **Report Generator**: 生成终端表格、JSON、Markdown 三种格式的报告

## License

MIT
