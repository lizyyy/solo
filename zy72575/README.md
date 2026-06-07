# 排名学习点击偏差可追溯记录系统

## 系统目标

解决"排名学习点击偏差"记录可追溯问题，确保推荐负责人追问时能回到原始证据，而非仅看汇总数。

## 核心功能

### 1. 特征快照全链路追踪
- **原始行号记录**：导入时记录每个快照在源文件中的原始行号
- **人工改动追踪**：所有字段变更均记录改前、改后值、操作人、时间、原因
- **处理状态流转**：完整的工作流状态机，支持每步追溯

### 2. 边界规则引擎（代码固化，非口头约定）

#### 规则1：线上特征缺失却给了默认分
- **触发条件**：`record.missing_features and record.default_score_applied`
- **自动动作**：
  - 状态设为 `needs_review`（需复核）
  - 自动分配给「推荐负责人」
  - **不自动归为正常**，必须人工复核
- **判定标准**：同时满足以下两个条件
  1. 存在缺失特征列表（`missing_features` 非空）
  2. 使用了默认分（`default_score_applied = True`）
- **修改流程**：
  - 由推荐负责人复核
  - 复核通过后才可标记为正常
  - 复核时需填写复核意见
- **回滚方式**：
  ```python
  rule_engine.rollback_rule(record, rule_id, rolled_back_by="操作人")
  ```

#### 规则2：排名学习点击偏差前后不一致
- **触发条件**：同一特征快照多次导入，分数差异 > 0.1
- **自动动作**：标记需复核并记录原因

### 3. 去重导入机制
- 基于 `snapshot_id` 或内容哈希去重
- 重复导入同一批特征快照编号时：
  - 已存在的自动跳过（返回 skipped 列表）
  - 不会导致数量翻倍
  - 已有的变更历史保留

### 4. 历史变更对比
- 支持查看任一字段的完整修改历史
- 备注修改时可清晰看出改前改后差别
- 支持版本间对比功能

### 5. 三步标准工作流

```
Step 1: 特征快照编号第一次导入
        ↓
Step 2: 数据科学家林姐补看训练日志曲线
        ↓
Step 3: 可解释摘要更新
        ↓
[如果触发边界规则] → 推荐负责人复核 → 通过/驳回
```

**关键细节**：
- Step 3 中如果检测到「线上特征缺失却给了默认分」，自动进入复核队列
- 不急着归正常，留给推荐负责人人工判断

### 6. 复盘与重放
- 每个快照可生成完整的复盘记录（JSON 格式）
- 自动生成可重新跑的 Python 命令脚本
- 支持按批次生成报告

## 快速开始

### 安装与初始化

```bash
# 无需额外依赖，Python 3.7+ 即可
cd /path/to/project
```

### 命令行使用

```bash
# 1. 导入特征快照
python -m ranking_click_bias.cli import --file examples/sample_snapshots.json --by 林姐

# 2. 查看系统概览
python -m ranking_click_bias.cli summary

# 3. 执行工作流 Step 2 - 审阅训练日志
python -m ranking_click_bias.cli workflow step2 \
    --snapshot-id SNAP001 \
    --by 林姐 \
    --log-analysis "训练曲线收敛正常，AUC=0.85" \
    --curve-findings "第10轮后loss趋于稳定"

# 4. 执行工作流 Step 3 - 更新可解释摘要（模拟特征缺失场景）
python -m ranking_click_bias.cli workflow step3 \
    --snapshot-id SNAP001 \
    --by 林姐 \
    --summary "该样本点击偏差主要源于位置偏置" \
    --score 0.15 \
    --missing-features feature_003 feature_007 \
    --default-score

# 5. 查看需推荐负责人复核的列表
python -m ranking_click_bias.cli review-list

# 6. 推荐负责人复核通过
python -m ranking_click_bias.cli approve \
    --snapshot-id SNAP001 \
    --by 推荐负责人 \
    --notes "已确认特征缺失原因，同意标记为正常"

# 7. 生成复盘报告
python -m ranking_click_bias.cli audit --snapshot-id SNAP001 --save

# 8. 生成可重放命令
python -m ranking_click_bias.cli replay --snapshot-id SNAP001 --save
```

### Python API 使用

```python
from ranking_click_bias import (
    SnapshotManager,
    HistoryTracker,
    BoundaryRuleEngine,
    WorkflowEngine,
    AuditReporter,
)

# 初始化各模块
snapshot_mgr = SnapshotManager()
history_tracker = HistoryTracker()
rule_engine = BoundaryRuleEngine()
workflow = WorkflowEngine(snapshot_mgr, history_tracker, rule_engine)
reporter = AuditReporter(snapshot_mgr, history_tracker, workflow)

# 导入快照
snapshots_data = [
    {"snapshot_id": "SNAP001", "feature_001": 0.5, "feature_002": 0.8},
    {"snapshot_id": "SNAP002", "feature_001": 0.3, "feature_002": 0.6},
]
imported, skipped = snapshot_mgr.import_snapshots(
    snapshots_data, source="daily_run", imported_by="林姐"
)

# 执行三步工作流
snapshot_id = "SNAP001"
workflow.step_1_import(snapshot_id, imported_by="林姐")
workflow.step_2_review_logs(
    snapshot_id,
    reviewed_by="林姐",
    training_log_analysis="训练曲线正常收敛",
    curve_findings="无异常波动",
)
workflow.step_3_update_summary(
    snapshot_id,
    updated_by="林姐",
    explainable_summary="偏差主要来自曝光位置因素",
    click_bias_score=0.12,
    missing_features=["feature_003"],
    default_score_applied=True,  # 触发边界规则
)

# 查看是否触发复核
status = workflow.get_workflow_status(snapshot_id)
if status["needs_leader_review"]:
    print("需要推荐负责人复核！")

# 生成复盘报告
print(reporter.save_audit_report(snapshot_id))
```

## 数据目录结构

```
data/
├── snapshots/
│   └── records.json          # 快照记录数据
├── rules/
│   └── boundary_rules.json   # 边界规则定义
├── history/
│   ├── changes.json          # 字段变更历史
│   └── audit.json            # 审计追踪记录
└── reports/                  # 生成的复盘报告和重放脚本
```

## 边界规则详细说明

### 「线上特征缺失却给了默认分」处理流程

```
检测到特征缺失 + 使用默认分
        ↓
自动标记为 needs_review
自动分配给 推荐负责人
        ↓
推荐负责人查看证据：
  - 原始行号
  - 缺失特征列表
  - 训练日志分析
  - 可解释摘要
  - 所有历史变更
        ↓
    ┌───┴───┐
    ↓       ↓
  通过     驳回
    ↓       ↓
标记正常  打回修改
```

### 如何添加自定义规则

```python
from ranking_click_bias import BoundaryRule, BoundaryRuleType

custom_rule = BoundaryRule(
    rule_type=BoundaryRuleType.CUSTOM,
    name="自定义规则名",
    description="规则描述",
    condition="record.click_bias_score > 0.5",
    action="record.status = ProcessingStatus.NEEDS_REVIEW",
    rollback_action="record.status = ProcessingStatus.IMPORTED",
)
rule_engine.add_rule(custom_rule)
```

## 针对典型场景的操作指南

### 场景1：推荐负责人追问"为什么前后不一致"

```bash
# 1. 找出有问题的快照
python -m ranking_click_bias.cli show --snapshot-id SNAP001

# 2. 查看完整历史（谁改了什么，什么时候改的）
python -m ranking_click_bias.cli history --snapshot-id SNAP001

# 3. 生成完整复盘报告（带回原始证据）
python -m ranking_click_bias.cli audit --snapshot-id SNAP001 --save
```

### 场景2：林姐只改了一条备注

系统自动记录：
- 改前的备注内容
- 改后的备注内容
- 修改人：林姐
- 修改时间
- 修改原因

```bash
# 查看备注变更历史
python -m ranking_click_bias.cli history --snapshot-id SNAP001
```

### 场景3：重复导入同一批数据

系统自动：
- 跳过已存在的快照
- 不重复计数
- 保留原有的所有历史记录

```bash
# 再次导入同一份文件
python -m ranking_click_bias.cli import --file snapshots.json --by 林姐
# 输出: 成功导入: 0 条, 跳过重复: N 条
```

## 常见问题

**Q: 推荐负责人复核时能看到哪些原始证据？**
A: 原始行号、原始数据、缺失特征列表、训练日志分析、曲线发现、可解释摘要、所有字段的完整变更历史、每步操作的审计记录。

**Q: 边界规则可以修改吗？**
A: 可以，但规则的增删改本身也建议记录操作人信息。默认规则不建议删除。

**Q: 数据会丢失吗？**
A: 所有变更都是追加写入，不会物理删除历史记录。回滚操作也会生成新的变更记录。

## 模块结构

| 文件 | 职责 |
|------|------|
| [models.py](ranking_click_bias/models.py) | 数据模型定义 |
| [snapshot_manager.py](ranking_click_bias/snapshot_manager.py) | 快照导入、查询、更新 |
| [boundary_rules.py](ranking_click_bias/boundary_rules.py) | 边界规则引擎 |
| [history_tracker.py](ranking_click_bias/history_tracker.py) | 变更历史追踪 |
| [workflow.py](ranking_click_bias/workflow.py) | 三步工作流 + 复核机制 |
| [audit.py](ranking_click_bias/audit.py) | 复盘报告 + 重放命令 |
| [cli.py](ranking_click_bias/cli.py) | 命令行接口 |
