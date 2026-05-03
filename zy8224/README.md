# gh-actions-guard

GitHub Actions 工作流离线预检 CLI 工具，用于在发布前检查工作流配置中的安全风险和配置问题。

## 功能特性

- 🔐 **Secret 暴露检查** - 检测 prod secret 是否可能暴露到非 prod 分支
- 🔢 **Matrix 覆盖检查** - 检查矩阵配置中的缺失维度和空数组问题
- 🔄 **并发组冲突检查** - 检测跨工作流的并发组覆盖问题
- 📦 **Artifact 过期检查** - 检查 artifact 保留期配置
- ✅ **审批规则检查** - 检测 prod 环境部署是否缺少审批保护

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本命令

```bash
npm run start -- [选项]
```

或者编译后直接运行：

```bash
node dist/cli/index.js [选项]
```

### 命令行选项

| 选项 | 简写 | 描述 | 默认值 |
|------|------|------|--------|
| `--workflows-dir <dir>` | `-w` | 工作流目录路径 | `.github/workflows` |
| `--environments <file>` | `-e` | 环境清单 CSV 文件路径 | - |
| `--secrets <file>` | `-s` | Secret 白名单 JSON 文件路径 | - |
| `--approval <file>` | `-a` | 审批规则 YAML 文件路径 | - |
| `--output <dir>` | `-o` | 输出目录 | `reports` |
| `--verbose` | - | 显示详细日志 | `false` |
| `--fail-on-critical` | - | 发现 Critical 问题时退出码为 1 | `false` |
| `--version` | `-v` | 显示版本号 | - |
| `--help` | `-h` | 显示帮助信息 | - |

### Demo 命令

使用示例数据运行预检：

```bash
cd samples

npm run start -- \
  --workflows-dir .github/workflows \
  --environments config/environments.csv \
  --secrets config/secret-whitelist.json \
  --approval config/approval-rules.yml \
  --output ../reports \
  --verbose
```

或者：

```bash
cd samples

node ../dist/cli/index.js \
  -w .github/workflows \
  -e config/environments.csv \
  -s config/secret-whitelist.json \
  -a config/approval-rules.yml \
  -o ../reports \
  --verbose
```

## 配置文件说明

### 环境清单 CSV

定义各环境的类型和对应的分支模式：

```csv
name,type,branches,description
production,prod,main,Production environment
staging,non-prod,develop,Staging environment
feature,non-prod,feature/*,Feature branch preview environment
```

| 字段 | 说明 |
|------|------|
| `name` | 环境名称 |
| `type` | 环境类型：`prod` 或 `non-prod` |
| `branches` | 该环境对应的分支模式（逗号分隔，支持通配符） |
| `description` | 环境描述（可选） |

### Secret 白名单 JSON

定义哪些 secret 属于 prod，哪些属于 non-prod：

```json
{
  "prodSecrets": [
    "PRODUCTION_API_KEY",
    "PRODUCTION_DB_PASSWORD"
  ],
  "nonProdSecrets": [
    "STAGING_API_KEY",
    "DEVELOPMENT_TOKEN"
  ],
  "environmentSecrets": {
    "production": [
      "PRODUCTION_API_KEY"
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| `prodSecrets` | 仅允许在 prod 环境使用的 secret 列表 |
| `nonProdSecrets` | 可以在所有环境使用的非敏感 secret 列表 |
| `environmentSecrets` | 按环境分组的 secret 映射 |

### 审批规则 YAML

定义各环境在不同触发类型下是否需要审批：

```yaml
rules:
  - environment: production
    triggerType:
      - push
      - workflow_dispatch
      - schedule
    requiresApproval: true
    approvers:
      - dev-leads
      - sre-team
    minApprovals: 2

  - environment: staging
    triggerType:
      - "*"
    requiresApproval: false
```

| 字段 | 说明 |
|------|------|
| `environment` | 环境名称，支持 `*` 通配符 |
| `triggerType` | 触发类型列表，支持 `*` 通配符 |
| `requiresApproval` | 是否需要审批 |
| `approvers` | 审批者列表（可选） |
| `minApprovals` | 最小审批数（可选） |

## 检查规则详解

### 1. Secret 暴露检查 (secret_exposure)

**严重级别**: Critical / High

检测逻辑：
- 识别工作流中引用的所有 secret
- 检查工作流是否可能在非 prod 分支运行
- 如果工作流可以在非 prod 分支运行，且使用了 prod secret，则报告问题

边界处理：
- 考虑 `workflow_dispatch` 和 `workflow_call` 可以手动触发任意分支
- 分析 `on.push.branches` 和 `on.pull_request.branches` 配置
- 尊重 `if` 条件中的分支限制

### 2. Matrix 覆盖检查 (matrix_coverage)

**严重级别**: Critical / High / Medium / Low

检测逻辑：
- 检查 `matrix.include` 条目是否缺少必要维度
- 检查 `matrix.exclude` 是否引用不存在的维度
- 检查是否有空数组导致 job 数量为 0
- 检查 matrix 配置是否会产生零个 job

### 3. 并发组冲突检查 (concurrency_conflict)

**严重级别**: High / Medium

检测逻辑：
- 检查同一工作流内多个 job 是否使用相同的静态并发组
- 检查跨工作流的并发组冲突
- 忽略包含动态变量（如 `${{ github.run_id }}`）的并发组

### 4. Artifact 过期检查 (artifact_expiration)

**严重级别**: High / Medium / Low

检测逻辑：
- 检查 `actions/upload-artifact` 步骤
- 警告未设置 `retention-days` 的步骤
- 警告保留期超过 365 天的步骤
- 警告保留期为 0 天（立即过期）的步骤

### 5. 审批缺失检查 (approval_missing)

**严重级别**: Critical / High

检测逻辑：
- 检查部署到 prod 环境的 job
- 根据审批规则判断是否需要审批
- 特别警告 cron 触发的 prod 部署（可能绕过手动审批）

边界处理：
- 区分 `schedule` (cron) 和 `workflow_dispatch` (手动) 触发
- 检查 `environment` 字段配置

## 输出文件

### issues.csv

包含所有发现的问题，便于导入其他工具：

| 列名 | 说明 |
|------|------|
| ID | 问题唯一标识 |
| Category | 问题类别 |
| Severity | 严重程度 |
| Workflow | 工作流名称 |
| Job | Job 名称 |
| Step | Step 名称 |
| Title | 问题标题 |
| Description | 问题描述 |
| Remediation | 修复建议 |
| Line_Number | 行号 |

### release_guard_report.md

详细的 Markdown 报告，包含：
- 执行摘要和状态徽章
- 问题分类统计
- 按类别分组的问题详情
- 工作流概览表
- 扫描元数据

## 项目结构

```
src/
├── cli/
│   └── index.ts          # CLI 入口
├── parser/
│   ├── workflow.ts       # 工作流 YAML 解析器
│   └── config.ts         # 配置文件解析器 (CSV/JSON/YAML)
├── engine/
│   └── rules.ts          # 规则引擎（5大检查规则）
├── reporter/
│   ├── csv.ts            # CSV 报告导出
│   └── markdown.ts       # Markdown 报告导出
└── types/
    └── index.ts          # TypeScript 类型定义

samples/
├── .github/workflows/
│   ├── deploy.yml        # 示例工作流（包含问题场景）
│   └── reusable-deploy.yml  # 可复用工作流示例
└── config/
    ├── environments.csv      # 环境清单
    ├── secret-whitelist.json # Secret 白名单
    └── approval-rules.yml    # 审批规则
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行（使用 ts-node）
npm run dev -- [选项]

# 编译 TypeScript
npm run build

# 运行编译后的代码
node dist/cli/index.js [选项]

# Lint 检查
npm run lint
```

## 许可证

MIT
