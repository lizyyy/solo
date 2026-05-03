# 云资源审计 CLI 工具 (Cloud Resource Audit CLI)

一个用于云资源发布前安全审计的 TypeScript CLI 工具，帮助检测 Terraform 计划和 IAM 策略中的安全风险。

## 功能特性

- 🔍 **多格式支持**: 解析 Terraform plan JSON、IAM 策略 YAML、资源 Owner CSV 和例外清单
- 🛡️ **安全检测**: 自动检测以下安全风险：
  - 通配符权限 (Wildcard Permissions)
  - 跨账号信任 (Cross-Account Trust)
  - 公开存储桶 (Public Buckets)
  - 未登记 Owner (Unregistered Owners)
- 📊 **多格式报告**: 生成 CSV、Markdown 和 HTML 图表三种格式的报告
- ⚠️ **智能告警**: 遇到 plan 为空或 Principal 类型混乱时给出清晰告警
- ✅ **例外机制**: 支持例外清单，允许合规的特殊配置

## 安装

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd cloud-resource-audit

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# （可选）全局安装 CLI
npm link
```

## 使用方法

### 基本命令

```bash
# 使用编译后的版本
cloud-audit audit [选项]

# 或者使用 ts-node 直接运行
npm run dev -- audit [选项]
```

### 命令选项

| 选项 | 缩写 | 描述 | 必填 |
|------|------|------|------|
| `--plan <path>` | `-p` | Terraform plan JSON 文件路径 | 否 |
| `--iam <path>` | `-i` | IAM 策略 YAML 文件路径 | 否 |
| `--owners <path>` | `-o` | 资源 Owner CSV 文件路径 | 否 |
| `--exceptions <path>` | `-e` | 例外清单文件路径 (JSON/CSV) | 否 |
| `--output <dir>` | `-O` | 输出目录路径 (默认: ./output) | 否 |
| `--verbose` | `-v` | 显示详细日志 | 否 |
| `--help` | `-h` | 显示帮助信息 | 否 |

### 使用示例

```bash
# 完整示例 - 使用所有输入文件
cloud-audit audit \
  --plan sample/terraform_plan.json \
  --iam sample/iam_policy.yaml \
  --owners sample/resource_owners.csv \
  --exceptions sample/exceptions.json \
  --output output \
  --verbose

# 仅分析 Terraform plan
cloud-audit audit \
  --plan sample/terraform_plan.json \
  --output output

# 仅分析 IAM 策略
cloud-audit audit \
  --iam sample/iam_policy.yaml \
  --output output
```

## 输入文件格式

### 1. Terraform Plan JSON

使用以下命令生成 Terraform plan JSON：

```bash
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > terraform_plan.json
```

**示例格式**:
```json
{
  "format_version": "1.0",
  "terraform_version": "1.5.0",
  "planned_values": {
    "root_module": {
      "resources": [
        {
          "address": "aws_s3_bucket.my_bucket",
          "type": "aws_s3_bucket",
          "name": "my_bucket",
          "values": {
            "bucket": "my-bucket-name",
            "acl": "private"
          }
        }
      ]
    }
  },
  "resource_changes": [...]
}
```

### 2. IAM 策略 YAML

支持单个策略或策略数组。

**示例格式**:
```yaml
- Version: '2012-10-17'
  Statement:
    - Sid: AllowS3Access
      Effect: Allow
      Action:
        - s3:GetObject
        - s3:ListBucket
      Resource:
        - arn:aws:s3:::my-bucket
        - arn:aws:s3:::my-bucket/*
      Principal:
        AWS: arn:aws:iam::123456789012:user/my-user
```

### 3. 资源 Owner CSV

**示例格式**:
```csv
resource_type,resource_name,owner,email,department
aws_s3_bucket,my_bucket,Zhang San,zhangsan@example.com,Data Engineering
aws_iam_role,admin_role,Li Si,lisi@example.com,Security
```

**字段说明**:
- `resource_type`: Terraform 资源类型 (如 `aws_s3_bucket`, `aws_iam_role`)
- `resource_name`: Terraform 资源名称
- `owner`: 负责人姓名
- `email`: 负责人邮箱
- `department`: 所属部门

### 4. 例外清单 (JSON/CSV)

支持 JSON 或 CSV 格式。

**JSON 格式示例**:
```json
[
  {
    "resource": "aws_s3_bucket.public_bucket",
    "issue_type": "public_bucket",
    "reason": "这是一个公开的文档存储桶，需要公开访问权限",
    "valid_until": "2025-12-31"
  }
]
```

**CSV 格式示例**:
```csv
resource,issue_type,reason,valid_until
aws_s3_bucket.public_bucket,public_bucket,"公开文档存储桶",2025-12-31
```

**字段说明**:
- `resource`: 资源地址 (如 `aws_s3_bucket.public_bucket`)
- `issue_type`: 问题类型，使用 `*` 表示所有类型
- `reason`: 例外原因
- `valid_until`: 有效期 (可选)

## 输出文件说明

### 1. issues.csv

包含所有检测到的问题的详细清单。

**列说明**:
| 列名 | 描述 |
|------|------|
| ID | 问题唯一标识符 |
| Resource | 资源地址 |
| Resource Type | 资源类型 |
| Issue Type | 问题类型 |
| Severity | 严重级别 (critical/high/medium/low) |
| Description | 问题描述 |
| Affected Actions | 受影响的操作 |
| Affected Principals | 受影响的主体 |
| Is Exception | 是否为例外项 |
| Exception Reason | 例外原因 |

### 2. risk_report.md

Markdown 格式的风险报告，包含：

- 报告概览和统计
- 资源变更分析 (新增/修改资源)
- 安全问题详情 (按严重级别分组)
- 例外项列表
- 统计分析
- 修复建议

### 3. graph.html

交互式 HTML 可视化报告，包含：

- 统计卡片 (按严重级别)
- 柱状图 (按严重级别分布)
- 柱状图 (按问题类型分布)
- 问题详情列表

**查看方式**: 直接在浏览器中打开 `output/graph.html`

## 检测的安全问题

### 1. 通配符权限 (Wildcard Permissions)
- **严重级别**: High
- **描述**: 检测 IAM 策略中使用 `*` 通配符的 Action
- **风险**: 过度授权可能导致权限滥用

### 2. 跨账号信任 (Cross-Account Trust)
- **严重级别**: Critical
- **描述**: 检测信任外部 AWS 账号的策略
- **风险**: 可能导致未授权的外部访问

### 3. 公开存储桶 (Public Buckets)
- **严重级别**: Critical
- **描述**: 检测配置为公开访问的 S3 存储桶
- **检测点**:
  - Principal 为 `*`
  - ACL 为 `public-read` 或 `public-read-write`
  - Public Access Block 配置不完整
- **风险**: 数据泄露风险

### 4. 未登记 Owner (Unregistered Owners)
- **严重级别**: Medium
- **描述**: 检测未在 owner 清单中登记的资源
- **风险**: 资源归属不明，难以追踪责任

## 智能告警

### 1. Plan 为空告警

当 Terraform plan 中没有待变更的资源时，会显示：
```
⚠️  警告: Terraform plan 为空，没有待变更的资源
```

### 2. Principal 类型混乱告警

当 IAM 策略中的 Principal 包含多种类型时，会显示：
```
⚠️  警告: Statement MixedPrincipalTypes 中 Principal 类型混乱，包含: AWS, Service, Federated
```

**常见的 Principal 类型**:
- `AWS`: IAM 用户/角色 ARN
- `Service`: AWS 服务 (如 `lambda.amazonaws.com`)
- `Federated`: 联合身份提供商
- `*`: 通配符 (所有主体)

## 快速开始 Demo

使用项目提供的 sample 数据快速体验：

```bash
# 1. 安装依赖
npm install

# 2. 编译项目
npm run build

# 3. 运行审计 (使用 sample 数据)
npm run dev -- audit \
  --plan sample/terraform_plan.json \
  --iam sample/iam_policy.yaml \
  --owners sample/resource_owners.csv \
  --exceptions sample/exceptions.json \
  --output output \
  --verbose

# 4. 查看生成的报告
# - 打开 output/risk_report.md 查看详细报告
# - 用浏览器打开 output/graph.html 查看可视化报告
# - 查看 output/issues.csv 获取问题清单
```

**Sample 数据包含的场景**:

| 资源 | 预期检测结果 |
|------|-------------|
| `aws_s3_bucket.public_bucket` | 公开存储桶 (Critical) + 未登记 Owner (Medium) [已例外] |
| `aws_s3_bucket.private_bucket` | 无公开问题 |
| `aws_iam_role.external_trust_role` | 跨账号信任 (Critical) + 未登记 Owner (Medium) |
| `aws_iam_policy.wildcard_policy` | 通配符权限 (High) [已例外] |
| `aws_ec2_instance.web_server` | 未登记 Owner (Medium) |

## 项目结构

```
cloud-resource-audit/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types.ts              # TypeScript 类型定义
│   ├── utils.ts              # 工具函数
│   ├── commands/
│   │   └── audit.ts          # audit 命令实现
│   ├── parsers/
│   │   ├── terraform.ts      # Terraform plan 解析器
│   │   ├── iam.ts            # IAM 策略解析器
│   │   └── csv-parser.ts     # CSV 解析器
│   ├── auditors/
│   │   └── security-auditor.ts  # 安全检测逻辑
│   └── reporters/
│       └── report-generator.ts  # 报告生成器
├── sample/
│   ├── terraform_plan.json   # Terraform plan 示例
│   ├── iam_policy.yaml       # IAM 策略示例
│   ├── resource_owners.csv   # Owner 清单示例
│   └── exceptions.json       # 例外清单示例
├── output/                   # 输出目录 (运行后生成)
│   ├── issues.csv
│   ├── risk_report.md
│   └── graph.html
├── package.json
├── tsconfig.json
└── README.md
```

## 开发指南

```bash
# 开发模式 (使用 ts-node)
npm run dev -- audit [选项]

# 编译
npm run build

# 运行编译后的版本
npm start -- audit [选项]

# 运行测试
npm test
```

## 注意事项

1. **权限检测**: 本工具检测的是配置中的安全风险，不代表实际运行时的权限
2. **例外管理**: 例外项应定期审查，确保过期的例外被移除
3. **Plan 生成**: 确保使用最新的 Terraform plan 进行审计
4. **敏感信息**: 不要将包含敏感信息的 plan/策略文件提交到版本控制

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
