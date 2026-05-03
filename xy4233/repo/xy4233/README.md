# 标注漂移体检员 (Label Drift Inspector)

客服意图分类离线标注质量审计工具 - 帮助你发现标注员新标签混用、同一会话跨数据集分割、标注员突然偏科等问题。

## 功能特性

- **数据校验** (`import`)：校验字段完整性、标签有效性、版本匹配
- **质量审计** (`audit`)：计算一致率、混淆矩阵、标注员漂移、数据泄漏、高风险样本
- **复核管理** (`review`)：记录复核决定、跟踪处理状态
- **报告导出** (`report`)：导出 Markdown、CSV 和 JSON 审计包
- **示例生成** (`init`)：一键生成测试用的示例数据

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目到本地
cd xy4233

# 以可编辑模式安装（开发时）
pip install -e .

# 或者安装生产版本
pip install .
```

### 依赖包

项目会自动安装以下依赖：

- `click>=8.0.0` - CLI框架
- `pandas>=1.3.0` - 数据处理
- `pyyaml>=5.4.0` - YAML解析
- `numpy>=1.20.0` - 数值计算
- `scikit-learn>=0.24.0` - 机器学习工具
- `tabulate>=0.8.0` - 表格输出

## 快速开始

### 1. 生成示例数据

```bash
ldi init ./sample_data
```

这会在 `./sample_data` 目录下生成四个文件：
- `label_schema.yaml` - 标签体系定义
- `annotations.jsonl` - 标注员结果
- `predictions.csv` - 模型预测结果
- `sampling_feedback.csv` - 抽检反馈表

示例数据包含了故意设计的问题场景：
- `annotator_03` 有明显的标签偏好（故意偏科）
- 部分会话同时出现在训练集和验证集（数据泄漏）
- 部分标注与预测不一致（高风险样本）

### 2. 数据校验

```bash
ldi import --schema ./sample_data/label_schema.yaml \
           --annotations ./sample_data/annotations.jsonl \
           --predictions ./sample_data/predictions.csv \
           --feedback ./sample_data/sampling_feedback.csv
```

校验内容包括：
- 字段完整性检查
- 标签有效性验证
- 版本匹配检查
- 数据一致性警告

### 3. 执行审计

```bash
ldi audit --schema ./sample_data/label_schema.yaml \
          --annotations ./sample_data/annotations.jsonl \
          --predictions ./sample_data/predictions.csv \
          --feedback ./sample_data/sampling_feedback.csv
```

审计分析包括：

**一致率分析：**
- 整体一致率（标注 vs 预测）
- Cohen's Kappa 系数
- 各标签一致率分布
- 各标注员一致率分布

**混淆矩阵：**
- 混淆矩阵表
- 各标签 Precision/Recall/F1/Support

**标注员漂移检测：**
- 基于 KL 散度和 JS 散度的漂移分数
- 异常标签识别（标注员偏好超过整体3倍）
- 按漂移分数排序

**数据泄漏检测：**
- 检测同一会话出现在不同数据集分割（train/val/test）
- 按严重程度分级（high/medium/low）

**高风险样本识别：**
- 标注-预测不一致
- 低置信度预测（< 0.5）
- 抽检不同意
- 无效标签
- 文本过短

### 4. 复核管理

```bash
# 列出所有复核记录
ldi review list

# 按状态筛选
ldi review list --status pending

# 添加复核记录
ldi review add --session-id session_0001 \
               --text "我的账户余额是多少？" \
               --label account_query

# 更新复核状态
ldi review update --record-id abc123 \
                  --decision disagree \
                  --final-label account_modify \
                  --notes "原标签错误，应为账户修改" \
                  --reviewer reviewer_01

# 查看复核统计
ldi review stats
```

**复核状态说明：**
- `pending` - 待处理
- `agree` - 同意原标签
- `disagree` - 不同意原标签
- `need_relabel` - 需要重新标注

### 5. 导出报告

```bash
ldi report --schema ./sample_data/label_schema.yaml \
           --annotations ./sample_data/annotations.jsonl \
           --predictions ./sample_data/predictions.csv \
           --output ./audit_report
```

导出的报告包包含：

**Markdown 报告 (`audit_report_*.md`)：**
- 数据概览
- 警告信息汇总
- 一致率分析
- 标注员漂移分析
- 数据泄漏检测
- 高风险样本详情（Top 10）
- 复核记录统计

**JSON 详情 (`audit_detail_*.json`)：**
- 完整审计数据
- 混淆矩阵原始数据
- 所有标注员漂移数据
- 所有数据泄漏记录
- 所有高风险样本

**CSV 统计表格：**
- `confusion_matrix.csv` - 混淆矩阵
- `high_risk_samples.csv` - 高风险样本列表
- `data_leakages.csv` - 数据泄漏记录
- `annotator_drifts.csv` - 标注员漂移数据
- `label_statistics.csv` - 各标签统计指标

## 输入数据格式

### 1. 标签体系 YAML

```yaml
name: customer_service_intents
version: "2.0.0"
description: 客服意图分类标签体系
labels:
  account_query: 账户查询
  account_modify: 账户修改
  password_reset: 密码重置
  order_query: 订单查询
  order_modify: 订单修改
  order_cancel: 订单取消
  payment_query: 支付查询
  payment_issue: 支付问题
  refund_apply: 退款申请
  refund_query: 退款查询
  complaint: 投诉
  suggestion: 建议
  product_query: 商品查询
  service_query: 服务查询
  other: 其他
parent_labels:
  account:
    - account_query
    - account_modify
    - password_reset
  order:
    - order_query
    - order_modify
    - order_cancel
```

**关键字段说明：**
- `version`：标签版本，用于校验数据一致性
- `labels`：标签定义，key 为英文标签名，value 为中文描述
- `parent_labels`（可选）：父标签分类，用于层级分析

### 2. 标注结果 JSONL

每行一个 JSON 对象：

```json
{
  "session_id": "session_0001",
  "turn_id": "turn_01",
  "text": "我的账户余额是多少？",
  "label": "account_query",
  "annotator_id": "annotator_01",
  "annotated_at": "2026-04-27T10:30:00",
  "split": "train",
  "metadata": {
    "source": "manual",
    "batch": "2026_w18"
  }
}
```

**必需字段：**
- `session_id`：会话ID（用于数据泄漏检测）
- `text`：文本内容
- `label`：标注标签
- `annotator_id`：标注员ID（用于标注员漂移检测）

**可选字段：**
- `turn_id`：轮次ID（多轮对话场景）
- `annotated_at`：标注时间
- `split`：数据集分割（train/val/test/unknown），用于数据泄漏检测
- `metadata`：元数据

### 3. 模型预测 CSV

| session_id | turn_id | predicted_label | confidence | model_version | predicted_at |
|------------|---------|-----------------|------------|---------------|--------------|
| session_0001 | turn_01 | account_query | 0.95 | v2.3.1 | 2026-04-27T14:00:00 |
| session_0002 | | order_query | 0.82 | v2.3.1 | 2026-04-27T14:01:00 |

**必需字段：**
- `session_id`：会话ID
- `predicted_label`：预测标签
- `confidence`：置信度（0.0-1.0）
- `model_version`：模型版本

**可选字段：**
- `turn_id`：轮次ID
- `predicted_at`：预测时间

### 4. 抽检反馈 CSV

| session_id | turn_id | original_label | reviewer_label | reviewer_id | is_agreement | feedback_notes | reviewed_at |
|------------|---------|----------------|----------------|-------------|--------------|----------------|-------------|
| session_0001 | | account_query | account_query | reviewer_01 | True | 确认无误 | 2026-04-28T09:00:00 |
| session_0002 | | account_query | order_query | reviewer_01 | False | 应该是订单查询 | 2026-04-28T09:05:00 |

**字段说明：**
- `original_label`：原标注标签
- `reviewer_label`：抽检标签
- `is_agreement`：是否同意（True/False）
- `feedback_notes`：备注说明

## 验证流程

### 标准工作流程

```
每周收到数据
     ↓
ldi import 校验数据格式和标签
     ↓
发现错误 → 修复数据 → 重新校验
     ↓
ldi audit 执行质量审计
     ↓
分析审计报告：
  - 整体一致率是否过低？
  - 哪些标注员有漂移？
  - 是否存在数据泄漏？
  - 高风险样本有哪些？
     ↓
ldi review 记录复核决定
     ↓
ldi report 导出审计包存档
     ↓
问题修复/标注员培训
     ↓
进入下一周循环
```

### 预警阈值建议

以下是一些建议的预警阈值，可根据实际情况调整：

| 指标 | 警告阈值 | 严重阈值 | 说明 |
|------|---------|---------|------|
| 整体一致率 | < 80% | < 70% | 标注与模型预测差异过大 |
| Cohen's Kappa | < 0.6 | < 0.4 | 一致性较差（考虑偶然一致性） |
| 标注员漂移分数 | > 0.5 | > 0.7 | 标注偏好偏离整体分布 |
| 高风险样本占比 | > 10% | > 20% | 需要重点关注的样本过多 |
| 数据泄漏数 | > 0 | > 0 | 任何泄漏都可能影响模型评估 |

### 常见问题及处理

**1. 发现无效标签**

问题：标注员使用了标签体系外的新标签。

处理：
```bash
# 查看错误详情
ldi import --schema schema.yaml --annotations annotations.jsonl

# 确认是新标签还是拼写错误
# 如果是新标签：更新标签体系
# 如果是拼写错误：修改标注数据
```

**2. 标注员漂移**

问题：某个标注员的标签分布显著偏离其他标注员。

处理：
```bash
# 查看漂移详情
ldi audit --schema schema.yaml --annotations annotations.jsonl

# 重点关注 drift_score > 0.7 的标注员
# 检查该标注员的 unusual_labels
# 可能需要培训或重新标注该标注员的数据
```

**3. 数据泄漏**

问题：同一会话同时出现在训练集和验证/测试集。

处理：
```bash
# 查看泄漏详情
ldi audit ...

# 按 severity 分级处理：
# - high: train + val/test 混合 → 必须修复
# - medium: val + test 混合 → 建议修复
# - low: unknown 混合 → 可忽略

# 修复方法：统一分配到同一个分割集
```

**4. 高风险样本**

问题：存在标注-预测不一致、低置信度、抽检不同意等样本。

处理：
```bash
# 导出高风险样本列表
ldi report ...

# 使用复核功能记录处理
ldi review add --session-id xxx --text xxx --label xxx
ldi review update --record-id xxx --decision agree/disagree/need_relabel
```

## 运行测试

项目包含完整的单元测试，运行方式：

```bash
# 安装测试依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=label_drift_inspector

# 运行特定测试文件
pytest tests/test_models.py
pytest tests/test_auditor.py
```

测试覆盖范围：
- `test_models.py`：数据模型类测试
- `test_parser.py`：解析校验模块测试
- `test_auditor.py`：统计评估模块测试

## 项目结构

```
xy4233/
├── label_drift_inspector/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型 (dataclasses)
│   ├── parser.py            # 解析校验模块
│   ├── auditor.py           # 统计评估模块
│   ├── review_store.py      # 复核存储模块
│   ├── exporter.py          # 导出模块
│   ├── sample_data.py       # 示例数据模块
│   └── cli.py               # 主CLI入口
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_parser.py
│   └── test_auditor.py
├── pyproject.toml           # 项目配置
└── README.md
```

## 模块说明

### 1. 数据模型 (`models.py`)

定义所有核心数据结构：

- `LabelSchema`：标签体系
- `AnnotationRecord`：标注记录
- `PredictionRecord`：预测记录
- `SamplingFeedback`：抽检反馈
- `ReviewRecord`：复核记录
- `ConsistencyMetrics`：一致率指标
- `AnnotatorDrift`：标注员漂移
- `DataLeakage`：数据泄漏
- `HighRiskSample`：高风险样本
- `AuditResult`：审计结果
- `ImportValidationResult`：导入校验结果

### 2. 解析校验 (`parser.py`)

负责解析各种输入数据格式：

- `LabelSchemaParser`：解析 YAML 标签体系
- `AnnotationParser`：解析 JSONL 标注结果
- `PredictionParser`：解析 CSV 预测结果
- `SamplingFeedbackParser`：解析 CSV 抽检反馈
- `DataValidator`：执行数据校验

### 3. 统计评估 (`auditor.py`)

核心审计逻辑：

- `ConsistencyCalculator`：计算一致率
- `ConfusionMatrixGenerator`：生成混淆矩阵
- `AnnotatorDriftDetector`：检测标注员漂移（KL/JS 散度）
- `DataLeakageDetector`：检测数据泄漏
- `HighRiskSampleDetector`：识别高风险样本
- `AuditEngine`：执行完整审计流程

### 4. 复核存储 (`review_store.py`)

复核记录的持久化管理：

- `ReviewStore`：JSON 文件存储
- 支持 CRUD 操作
- 状态管理

### 5. 导出 (`exporter.py`)

多种格式报告导出：

- `MarkdownExporter`：生成可读的 Markdown 报告
- `CSVExporter`：导出各类统计表格
- `JSONExporter`：导出完整 JSON 数据
- `AuditPackageExporter`：打包导出所有文件

### 6. 示例数据 (`sample_data.py`)

生成用于演示和测试的示例数据：

- 包含 15 个客服意图标签
- 5 个标注员（其中一个故意偏科）
- 设计了数据泄漏场景
- 包含低置信度预测和不一致样本

## 命令参考

### `ldi init`

```
Usage: ldi init [OPTIONS] OUTPUT_DIR

  生成示例数据文件

Options:
  --num-records INTEGER  生成的标注记录数量
  --help                 Show this message and exit.
```

### `ldi import`

```
Usage: ldi import [OPTIONS]

  校验数据字段和标签版本

Options:
  --schema PATH           标签体系YAML文件路径 [required]
  --annotations PATH      标注结果JSONL文件路径 [required]
  --predictions PATH      模型预测CSV文件路径
  --feedback PATH         抽检反馈CSV文件路径
  --expected-version TEXT 期望的标签版本号
  --json                  以JSON格式输出结果
  --help                  Show this message and exit.
```

### `ldi audit`

```
Usage: ldi audit [OPTIONS]

  执行质量审计分析

Options:
  --schema PATH        标签体系YAML文件路径 [required]
  --annotations PATH   标注结果JSONL文件路径 [required]
  --predictions PATH   模型预测CSV文件路径
  --feedback PATH      抽检反馈CSV文件路径
  --json               以JSON格式输出结果
  --help               Show this message and exit.
```

### `ldi review list`

```
Usage: ldi review list [OPTIONS]

  列出复核记录

Options:
  --store PATH         复核存储文件路径
  --status [pending|agree|disagree|need_relabel]
                       按状态筛选
  --json               以JSON格式输出
  --help               Show this message and exit.
```

### `ldi review add`

```
Usage: ldi review add [OPTIONS]

  添加复核记录

Options:
  --store PATH        复核存储文件路径
  --session-id TEXT   会话ID [required]
  --text TEXT         文本内容 [required]
  --label TEXT        标注标签 [required]
  --annotator-id TEXT 标注员ID
  --notes TEXT        备注
  --help              Show this message and exit.
```

### `ldi review update`

```
Usage: ldi review update [OPTIONS]

  更新复核状态

Options:
  --store PATH              复核存储文件路径
  --record-id TEXT          复核记录ID [required]
  --decision [agree|disagree|need_relabel]
                            复核决定 [required]
  --final-label TEXT        最终标签
  --notes TEXT              备注
  --reviewer TEXT           复核人ID
  --help                    Show this message and exit.
```

### `ldi review stats`

```
Usage: ldi review stats [OPTIONS]

  查看复核统计

Options:
  --store PATH  复核存储文件路径
  --json        以JSON格式输出
  --help        Show this message and exit.
```

### `ldi report`

```
Usage: ldi report [OPTIONS]

  导出审计报告包

Options:
  --audit-id TEXT       审计ID(如未指定则重新执行审计)
  --output PATH         输出目录路径 [required]
  --schema PATH         标签体系YAML文件路径
  --annotations PATH    标注结果JSONL文件路径
  --predictions PATH    模型预测CSV文件路径
  --feedback PATH       抽检反馈CSV文件路径
  --review-store PATH   复核存储文件路径
  --help                Show this message and exit.
```

## 许可证

本项目仅供内部使用。

## 更新日志

### v0.1.0 (2026-04-27)

- 初始版本发布
- 实现核心功能：init, import, audit, review, report
- 包含完整的单元测试
- 支持多种数据格式导入导出
