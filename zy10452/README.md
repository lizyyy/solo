# Terraform 漂移摘要 CLI

一个专业的命令行工具，用于解析 Terraform plan 输出并生成简洁、可操作的漂移摘要报告。

## 功能特性

- **多格式输入支持**：同时支持 JSON 格式和文本格式的 Terraform plan 输出
- **智能变更分类**：自动识别创建、更新、删除等动作，并评估严重程度
- **敏感字段保护**：自动检测并遮蔽密码、密钥等敏感字段
- **团队归属**：基于资源类型或模块路径自动分配责任团队
- **多种输出格式**：
  - 终端彩色摘要（支持详细程度控制）
  - 机器可读 JSON 数据
  - 美观的 HTML 报告（适合邮件分享）
- **错误追踪**：坏行或异常样本可追溯到原文件位置
- **重复运行保护**：检测已有输出文件，避免意外覆盖

## 安装

```bash
# 使用 poetry 安装依赖
poetry install

# 安装到系统
poetry build
pip install dist/*.whl
```

## 快速开始

### 1. 生成 Terraform Plan 输出

```bash
# JSON 格式（推荐）
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json

# 或文本格式
terraform plan > plan.txt
```

### 2. 运行摘要生成

```bash
# 基本用法（JSON 输入）
tf-drift-summary generate examples/sample_plan.json

# 使用团队映射
tf-drift-summary generate examples/sample_plan.json \
  --team-mapping examples/team_mapping.json

# 指定输出目录
tf-drift-summary generate examples/sample_plan.json \
  --output-dir ./my-reports

# 详细输出（-v 显示详情，-vv 显示变更列表）
tf-drift-summary generate examples/sample_plan.json -vv

# 仅输出特定格式
tf-drift-summary generate examples/sample_plan.json --format json
tf-drift-summary generate examples/sample_plan.json --format html

# 强制覆盖已有文件
tf-drift-summary generate examples/sample_plan.json --force
```

### 3. 重新格式化已有 JSON 摘要

```bash
tf-drift-summary reformat drift_summaries/drift_summary_data.json
```

## 命令参考

### generate

从 Terraform plan 文件生成漂移摘要报告。

**参数：**
- `INPUT_FILE`：输入的 plan 文件路径（JSON 或文本格式）

**选项：**
- `--output-dir, -o`：输出目录（默认：./drift_summaries）
- `--team-mapping, -t`：团队映射 JSON 文件路径
- `--sensitive-fields, -s`：需要遮蔽的敏感字段名（可多次指定）
- `--no-mask`：禁用敏感字段遮蔽
- `--show-noop`：显示无变更资源
- `--format, -f`：输出格式（terminal|json|html|all，默认：all）
- `--force`：强制覆盖已有输出文件
- `--verbose, -v`：详细输出（可多次使用）

### reformat

从已有的 JSON 摘要重新生成其他格式报告。

**参数：**
- `JSON_FILE`：已有的漂移摘要 JSON 文件

**选项：**
- `--output-dir, -o`：输出目录
- `--force`：强制覆盖

## 团队映射配置

创建一个 JSON 文件来定义团队归属规则：

```json
[
  {
    "team_name": "平台团队",
    "patterns": ["aws_instance", "aws_security_group"],
    "priority": 10
  }
]
```

- `patterns`：匹配资源地址或类型的关键词
- `priority`：优先级（数字越大优先级越高）

## 输出说明

运行命令后，输出目录会包含：

1. **终端输出**：即时显示统计信息和关键变更
2. **drift_summary_*_data.json**：完整的机器可读数据
3. **drift_summary_*_report.html**：美观的 HTML 报告

## 严重等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| Critical | 红色 | 删除操作，需要立即确认 |
| High | 橙色 | 高风险操作（如创建关键资源） |
| Medium | 黄色 | 常规更新操作 |
| Low | 绿色 | 低风险变更 |

## 示例

### 示例 1：完整工作流

```bash
# 1. 生成 plan
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json

# 2. 生成摘要
tf-drift-summary generate plan.json --team-mapping team_mapping.json -vv

# 3. 查看 HTML 报告
open drift_summaries/*_report.html
```

### 示例 2：CI/CD 集成

```bash
# 在 CI 中生成机器可读结果
tf-drift-summary generate plan.json --format json --output-dir ./artifacts

# 检查是否有关注项
jq '.changes_requiring_attention' artifacts/*.json
```

## 项目结构

```
src/terraform_drift_summary/
├── __init__.py          # 包版本
├── cli.py               # 命令行入口
├── models.py            # 数据模型定义
├── config.py            # 配置和输入校验
├── plan_parser.py       # Plan 文件解析核心
├── output_generator.py  # 输出生成器
└── templates/
    └── summary.html     # HTML 报告模板
```

## 开发

```bash
# 安装开发依赖
poetry install --dev

# 运行测试
pytest

# 代码格式化
black src/
```

## 许可证

MIT
