# 内容安全样本回流系统

## 概述

内容安全样本回流系统用于**合并模型输出片段与人工改判表两边的证据**，确保明细导出、页面展示、接口返回读取同一份结果。系统提供完整的可复盘记录和可重新执行的命令。

---

## 核心设计原则

### 1. 单一数据源原则
> 明细导出、页面展示、API接口返回**读取同一份 UnifiedResult 数据**
>
> 绝不出现：一个地方显示异常、另一个地方消失的情况

### 2. 证据可追溯原则
> 每个样本保留：
> - 模型输出的**原始行号**（original_line_number）
> - 人工改动的**完整记录**（change_history）
> - 当前**处理状态**（status）
>
> 安全审核同事追问时，能回到原始证据，而不是只看一个汇总数

### 3. 边界规则固化原则
> 所有边界规则写在代码和文档里，**不靠口头约定**

---

## 边界规则（Boundary Rules）

### 规则一：人工改判被新批跑覆盖

**场景**：样本已有有效人工改判，下一次批跑（batch_id不同）重新导入模型输出

**判定逻辑**：
1. 检测到 batch_id 变化，且存在 active_manual_judgment
2. **不急于归为正常**，状态设为 `covered_pending_review`（被覆盖·待复核）
3. 所有历史人工改判标记 `is_overridden = true`，记录 `override_batch_id` 和 `override_time`
4. `active_manual_judgment` 置空，等待安全审核同事复核

**复核操作**（安全审核同事）：
- `approve = true`：恢复原有人工改判的效力
- `approve = false`：以新批跑模型输出为准

**代码位置**：[reflow_engine.py](file:///Users/lzy/pro/solo/workspaces/zy72547/content_safety_reflow/reflow_engine.py#L67-L112) → `_handle_batch_override`

---

### 规则二：三步工作流状态流转

```
模型导入 → 人工补看 → 报告更新
   ↓           ↓
model_imported → manual_supplemented → report_updated
                    ↓ （被新批跑覆盖时）
              covered_pending_review
                    ↓ （安全审核复核）
              review_approved → report_updated
```

**Step 1：模型输出片段第一次导入**
- 操作人：数据工程师
- 状态：`model_imported`
- 证据：保留 original_line_number、batch_id、evidence_snippets

**Step 2：标注负责人周姐补看人工改判表**
- 操作人：周姐
- 状态：`manual_supplemented`
- 证据：合并模型证据 + 现场说法（on_site_statement）
- 特殊：若处于 `covered_pending_review`，添加改判后仍保持待复核

**Step 3：评测报告更新**
- 操作人：评测人员
- 状态：`report_updated`
- 输入：所有处于 `manual_supplemented` 或 `review_approved` 状态的样本

**代码位置**：[workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72547/content_safety_reflow/workflow.py)

---

### 规则三：撤回与回滚

**场景A：周姐误把人工改判表当成新材料导入**
- 执行 `rollback_last_report`
- 评测报告恢复到上一版
- 每个样本的 change_history 记录撤回操作

**场景B：需要回滚到任意历史快照**
- 执行 `rollback_to_snapshot(snapshot_id)`
- 所有样本状态置为 `rollbacked`
- change_history 记录回滚原因

**代码位置**：[version_control.py](file:///Users/lzy/pro/solo/workspaces/zy72547/content_safety_reflow/version_control.py)

---

## 目录结构

```
.
├── content_safety_reflow/       # 核心包
│   ├── __init__.py
│   ├── models.py                # 数据模型定义
│   ├── reflow_engine.py         # 回流核心引擎
│   ├── workflow.py              # 三步工作流管理
│   ├── version_control.py       # 版本控制与回滚
│   ├── unified_output.py        # 统一输出（API/页面/明细）
│   └── cli.py                   # 命令行工具
├── examples/                    # 示例数据
│   ├── model_outputs_batch_001.json
│   ├── model_outputs_batch_002.json
│   └── manual_judgments.json
├── data/                        # 运行数据（自动生成）
│   ├── reports/                 # 评测报告历史
│   ├── snapshots/               # 版本快照
│   └── workflow_log.json        # 工作流日志
├── tests/                       # 测试用例
├── requirements.txt
└── README.md
```

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 执行完整三步工作流

```bash
python -m content_safety_reflow.cli workflow \
  --model-outputs examples/model_outputs_batch_001.json \
  --manual-judgments examples/manual_judgments.json \
  --report-id EVAL-2024-06-001 \
  --version 1 \
  --operator 周姐
```

### 模拟"人工改判被下一次批跑覆盖"场景

```bash
# Step 1: 导入第一批模型输出
python -m content_safety_reflow.cli import examples/model_outputs_batch_001.json --operator 工程师A

# Step 2: 周姐补看人工改判
python -m content_safety_reflow.cli supplement examples/manual_judgments.json --operator 周姐

# Step 3: 导入第二批（覆盖 SAMPLE-001）
python -m content_safety_reflow.cli import examples/model_outputs_batch_002.json --operator 工程师B

# Step 4: 查看 SAMPLE-001 状态应为 covered_pending_review
python -m content_safety_reflow.cli export --format json
```

### 撤回操作（评测报告恢复上一版）

```bash
# 先创建快照
python -m content_safety_reflow.cli snapshot --operator 周姐 --description "报告生成前快照"

# 列出所有快照
python -m content_safety_reflow.cli list-snapshots

# 回滚到指定快照
python -m content_safety_reflow.cli rollback --snapshot-id snap_0001_20240601120000 --operator 周姐
```

---

## 可重新跑的命令清单

| 命令 | 用途 |
|------|------|
| `python -m content_safety_reflow.cli import <文件> --operator <人>` | 导入模型输出 |
| `python -m content_safety_reflow.cli supplement <文件> --operator <人>` | 补充人工改判 |
| `python -m content_safety_reflow.cli workflow ...` | 执行完整三步流 |
| `python -m content_safety_reflow.cli report --report-id <ID> ...` | 生成评测报告 |
| `python -m content_safety_reflow.cli export --format json/csv` | 导出回流明细 |
| `python -m content_safety_reflow.cli snapshot --operator <人> --description <描述>` | 创建版本快照 |
| `python -m content_safety_reflow.cli list-snapshots` | 列出历史快照 |
| `python -m content_safety_reflow.cli rollback [--snapshot-id <ID>] --operator <人>` | 回滚操作 |

---

## 统一输出格式

### API 接口、页面展示、明细导出 共用同一份数据结构

核心字段说明（UnifiedResult）：

| 字段 | 说明 | 留存目的 |
|------|------|----------|
| `sample_id` | 样本唯一ID | 关联 |
| `status` | 当前处理状态 | 流转跟踪 |
| `model_output.original_line_number` | 模型输出原始行号 | 溯源 |
| `model_output.batch_id` | 批跑批次 | 识别覆盖 |
| `manual_judgments[]` | 所有历史人工改判 | 完整保留 |
| `active_manual_judgment` | 当前生效的人工改判 | 当前值 |
| `is_covered` | 是否被新批跑覆盖 | 异常识别 |
| `covered_by_batch_id` | 被哪个批次覆盖 | 溯源 |
| `final_evidence[]` | 合并后的全部证据 | 审核依据 |
| `change_history[]` | 完整操作轨迹 | 复盘 |

**代码位置**：[unified_output.py](file:///Users/lzy/pro/solo/workspaces/zy72547/content_safety_reflow/unified_output.py)

---

## 状态枚举（ReflowStatus）

| 状态值 | 说明 |
|--------|------|
| `pending` | 待处理 |
| `model_imported` | 模型已导入 |
| `manual_supplemented` | 人工已补看 |
| `covered_pending_review` | 被覆盖·待复核 |
| `review_approved` | 复核通过 |
| `report_updated` | 报告已更新 |
| `rollbacked` | 已回滚 |
| `abnormal` | 异常 |

**代码位置**：[models.py](file:///Users/lzy/pro/solo/workspaces/zy72547/content_safety_reflow/models.py#L7-L15)

---

## 运行测试

```bash
python -m pytest tests/ -v
```

---

## 复盘记录说明

每次操作后，以下位置会留下可审计痕迹：

1. **样本级**：`UnifiedResult.change_history` - 每个样本的完整操作轨迹
2. **工作流级**：`data/workflow_log.json` - 三步工作流执行日志
3. **报告级**：`data/reports/<report_id>_v<version>.json` - 评测报告历史版本
4. **快照级**：`data/snapshots/<snap_id>.json` - 全量版本快照

安全审核同事追问时，任意一项都能定位到当时的证据和操作人。
