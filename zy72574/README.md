# 特征重要性漂移报警系统

## 概述

用于检测模型特征重要性在离线训练和线上服务之间的漂移，特别关注边界规则的明确化和流程可追溯。

## 核心边界规则（写在代码里，不靠口头约定）

### 桶划分规则

分数范围划分 5 个桶：

| 桶名 | 分数范围 |
|------|----------|
| very_low | [0.0, 0.2) |
| low | [0.2, 0.4) |
| medium | [0.4, 0.6) |
| high | [0.6, 0.8) |
| very_high | [0.8, 1.0] |

### 漂移判定规则

#### 情况 1：离线与线上分数差 >= 2 个桶
- **判定**：自动判定为 `CONFIRMED_DRIFT`（确认漂移）
- **代码位置**：[BoundaryRules.evaluate_feature](file:///Users/lzy/pro/solo/workspaces/zy72574/feature_drift_alert/rules.py#L22-L38)
- **操作建议**：立即排查数据源、特征工程逻辑、线上服务配置
- **回滚方式**：调用 `storage.rollback_alert_status(alert_id, author)` 回退到上一状态

#### 情况 2：离线与线上分数差 = 1 个桶 ⚠️ 边界情况
- **判定**：**不自动判定**，状态保持 `PENDING_REVIEW`（待复核）
- **代码位置**：[BoundaryRules.evaluate_feature](file:///Users/lzy/pro/solo/workspaces/zy72574/feature_drift_alert/rules.py#L40-L46)
- **必须人工复核**，评测运营确认后才能更新状态
- **复核流程**：
  1. 点击关联的训练日志曲线，查看分数随时间变化趋势
  2. 打开阈值调参笔记，确认当前桶划分阈值是否合理
  3. 对比同批次其他特征是否存在类似漂移
  4. 复核后选择：确认漂移 / 标记为误报
- **回滚方式**：复核完成后发现误判，可在历史记录中执行回滚

#### 情况 3：离线与线上分数在同一桶
- **判定**：正常，不触发报警

## 去重导入机制

重复导入同一批训练日志时，不会把报警数量翻倍。

- **实现原理**：基于训练日志内容计算 SHA256 哈希，相同内容只导入一次
- **代码位置**：[TrainingLog.content_hash](file:///Users/lzy/pro/solo/workspaces/zy72574/feature_drift_alert/models.py#L68-L81)
- **验证方式**：调用 `step1_import_training_log` 时，返回 `is_duplicate: True` 说明已存在

## 变更历史追踪

数据科学家林姐只改了一条备注，历史里要能看出改前改后的差别。

- **支持字段**：remark（备注）、status（状态）
- **每条变更记录包含**：
  - `field_name`: 修改的字段名
  - `old_value`: 修改前的值
  - `new_value`: 修改后的值
  - `author`: 操作人
  - `timestamp`: 操作时间
- **代码位置**：[Alert.update_remark](file:///Users/lzy/pro/solo/workspaces/zy72574/feature_drift_alert/models.py#L130-L145)
- **查看方式**：调用 `VisualizationLink.get_change_history_diff(alert_id)`

## 图表/3D 展示溯源

界面再漂亮，追证据时不能断在半路。

- **每条报警都关联证据链**：
  - 训练日志 ID → 可跳转到训练日志曲线
  - 阈值笔记 ID 列表 → 可跳转到阈值调参笔记
- **代码位置**：[VisualizationLink.get_alert_detail_with_sources](file:///Users/lzy/pro/solo/workspaces/zy72574/feature_drift_alert/visualization.py#L10-L44)
- **使用原则**：
  - 图表仅作展示用
  - 复核结论必须点击溯源链接查看原始证据
  - 离线和线上分数差了一个桶时，务必回到训练日志曲线和阈值笔记复核

## 标准三步工作流

```
Step 1: 导入训练日志 → Step 2: 数据科学家补看阈值调参笔记 → Step 3: 实验对比更新
```

### Step 1: 导入训练日志
- 调用：`WorkflowEngine.step1_import_training_log()`
- 自动检测漂移，差 1 个桶的保持 `PENDING_REVIEW`
- 自动去重，重复导入不翻倍

### Step 2: 数据科学家（林姐）补看阈值调参笔记
- 调用：`WorkflowEngine.step2_review_threshold_notes()`
- 可关联已有笔记或新建笔记
- 差 1 个桶的情况：**别急着归正常**，笔记看完也不自动改状态

### Step 3: 实验对比更新
- 调用：`WorkflowEngine.step3_compare_and_update()`
- 评测运营人工复核后才能更新状态
- 差 1 个桶的边界情况必须走这一步

## 回滚机制

- **接口**：`AlertStorage.rollback_alert_status(alert_id, author)`
- **原理**：从变更历史中找到最近一次状态变更，回退到上一状态
- **适用场景**：复核误判、操作失误等情况

## 快速开始

```python
from feature_drift_alert import (
    AlertStorage,
    WorkflowEngine,
    VisualizationLink,
    FeatureScore,
)

# 初始化
storage = AlertStorage()
workflow = WorkflowEngine(storage)
viz = VisualizationLink(storage)

# Step 1: 导入训练日志
feature_scores = [
    FeatureScore("user_age", 0.75, 0.55),  # high -> medium, 差1桶，待复核
    FeatureScore("user_gender", 0.85, 0.35),  # very_high -> low, 差3桶，自动漂移
    FeatureScore("click_history", 0.65, 0.68),  # 同一桶，正常
]
result = workflow.step1_import_training_log(
    experiment_name="ctr_model_v2",
    model_version="2.1.0",
    feature_scores=feature_scores,
    author="林姐",
)
log_id = result["log_id"]

# Step 2: 林姐补看阈值调参笔记
alert_id = result["pending_alerts"][0]["alert_id"]
workflow.step2_review_threshold_notes(
    log_id=log_id,
    alert_id=alert_id,
    new_note_title="age特征桶边界说明",
    new_note_content="0.6是高/中桶边界，样本分布在0.55-0.65之间波动正常",
    reviewer="林姐",
)

# Step 3: 评测运营复核后更新
final_result = workflow.step3_compare_and_update(
    log_id=log_id,
    alert_id=alert_id,
    is_confirmed_drift=False,
    reviewer="评测运营",
    reason="边界波动，确认正常",
)

# 查看变更历史
history = viz.get_change_history_diff(alert_id)
for h in history:
    print(f"{h['field_name']}: {h['before']} → {h['after']}")
```

## 目录结构

```
feature_drift_alert/
├── __init__.py          # 导出接口
├── models.py            # 数据模型：Alert, TrainingLog, ThresholdNote, ChangeHistory
├── rules.py             # 边界规则引擎
├── storage.py           # 存储与去重逻辑
├── workflow.py          # 三步工作流引擎
└── visualization.py     # 可视化溯源
```
