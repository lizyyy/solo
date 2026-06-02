# 强化学习仓库调度沙盒评测系统

一个用于评测强化学习仓库调度模型的工具，支持重复评测、样本分层、冲突检测和报告持久化。

## 目录结构

```
.
├── rl_warehouse_scheduler/    # 核心代码
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── engine.py              # 评测核心引擎
│   ├── storage.py             # 报告存储和版本管理
│   ├── data_loader.py         # 数据加载器
│   └── cli.py                 # 命令行接口
├── samples/                   # 样本数据目录
│   ├── annotation_samples.json
│   ├── online_feedback_samples.json
│   └── edge_cases.json
├── reports/                   # 评测报告输出目录
├── data/                      # 配置数据目录
│   └── model_versions.json
├── main.py                    # 入口脚本
├── requirements.txt           # 依赖包
└── README.md                  # 本文档
```

## 安装

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 添加模型版本

首先需要添加一个模型版本并设置为活跃状态：

```bash
# 添加版本 v1.0.0 并设为活跃
python main.py model add v1.0.0 -d "初始版本，基础调度算法" -a
```

### 2. 放置样本数据

将样本数据文件放入 `samples/` 目录，支持以下格式：
- **JSON** (.json): 数组格式
- **JSONL** (.jsonl): 每行一个JSON对象
- **CSV** (.csv): 表格格式

### 3. 运行评测

```bash
# 使用默认样本目录运行评测
python main.py evaluate

# 指定样本目录
python main.py evaluate --samples /path/to/samples

# 指定模型版本
python main.py evaluate --model-version v1.0.0
```

### 4. 查看报告

```bash
# 列出所有报告
python main.py report list

# 按模型版本筛选
python main.py report list -m v1.0.0

# 查看特定报告详情
python main.py report show <report_id>

# 查看详细记录
python main.py report show <report_id> -d
```

## 样本数据格式

### JSON 格式示例

```json
[
  {
    "record_id": "REC-001",
    "source": "annotation",
    "scheduling_decision": {
      "warehouse_id": "WH-BJ-01",
      "priority": 3,
      "estimated_cost": 125.50,
      "model_reasoning": "模型推理过程说明"
    },
    "ground_truth": {
      "warehouse_id": "WH-BJ-01",
      "priority": 3,
      "estimated_cost": 123.00
    },
    "metadata": {
      "order_id": "ORD-2024-001",
      "category": "electronics"
    }
  }
]
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| record_id | string | 记录唯一标识 |
| source | string | 数据来源: `annotation`(标注), `online_feedback`(线上反馈), `eval_log`(评测日志) |
| scheduling_decision | object | 模型调度决策 |
| scheduling_decision.warehouse_id | string | 仓库ID |
| scheduling_decision.priority | int | 优先级 (0-10) |
| scheduling_decision.estimated_cost | float | 预估成本 |
| scheduling_decision.model_reasoning | string | 模型推理过程说明 |
| ground_truth | object/null | 人工标注结果（无标注则为null） |
| metadata | object | 附加元数据 |

## 模型版本管理

### 添加新版本

```bash
python main.py model add v1.1.0 -d "优化了成本计算逻辑"
```

### 带阈值配置添加

```bash
python main.py model add v1.2.0 -d "严格阈值版本" -t '{"cost_tolerance": 0.05, "priority_mismatch_threshold": 0}'
```

### 切换活跃版本

```bash
python main.py model use v1.1.0
```

### 查看所有版本

```bash
python main.py model list
```

## 阈值配置说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| cost_tolerance | 0.1 | 成本差异容忍率 (10%) |
| priority_mismatch_threshold | 1 | 优先级差异阈值 |
| confidence_threshold | 0.8 | 置信度阈值 |

## 查看冲突清单

评测完成后，系统会自动输出冲突/待确认记录清单。

也可以通过报告详情查看：

```bash
python main.py report show <report_id> -d
```

报告目录中的 `report_summary.json` 包含完整的冲突记录列表。

## 报告文件说明

每份报告保存在 `reports/<report_id>/` 目录下：

- **report_summary.json**: 报告摘要，包含统计数据和冲突清单
- **evaluation_details.jsonl**: 详细评测记录，每行一条

报告ID格式: `eval_report_<version>_<timestamp>_<uuid>`

**注意**: 旧版本报告不会被覆盖，每次评测生成独立的报告目录。

## 样例数据说明

项目预置了样例数据，包含以下类型：

| 记录 | 类型 | 说明 |
|------|------|------|
| REC-001 | 顺利通过 | 模型决策与标注一致 |
| REC-002 | 冲突 | 仓库选择与标注不一致 |
| REC-003 | 待人工确认 | 缺少标注结果 |
| REC-004 | 旧口径 | 线上反馈工单数据 |
| REC-005 | 无效 | 空仓库ID |
| REC-001(重复) | 无效 | 重复记录 |
| REC-006 | 边界 | 优先级=0, 成本=0 |
| REC-007 | 边界 | 优先级=10(最大值) |

运行评测即可看到完整的处理结果。

## 命令列表

```bash
# 模型版本管理
python main.py model list              # 列出所有版本
python main.py model add <version>     # 添加新版本
python main.py model use <version>     # 切换活跃版本

# 评测
python main.py evaluate                # 运行评测
python main.py evaluate -s <dir>       # 指定样本目录
python main.py evaluate -m <version>   # 指定模型版本

# 报告管理
python main.py report list             # 列出所有报告
python main.py report list -m <ver>    # 按版本筛选
python main.py report show <id>        # 查看报告
python main.py report show <id> -d     # 查看详细记录
```

## 常见问题

**Q: 模型版本变了，旧报告会被覆盖吗？**

A: 不会。每次评测生成独立的报告目录，包含时间戳和UUID，确保历史报告完整保留。

**Q: 如何处理空值和重复项？**

A: 系统自动检测空值（如空warehouse_id）和重复记录（相同record_id），标记为INVALID并给出具体原因。

**Q: 报告和明细数据一致吗？**

A: 报告摘要(`report_summary.json`)中的统计数据与详细记录(`evaluation_details.jsonl`)完全一致，基于同一批评测结果生成。
