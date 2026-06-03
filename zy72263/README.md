# 机场廊桥停靠预演系统

## 项目概述

展陈设计师阿景的"机场廊桥停靠预演"工具，用于从临时拼接的坐标原点说明和巡检照片编号中解耦出标准化的预演流程。

## 快速开始

```bash
# 运行三步流程测试
python3 test_workflow.py

# 查看生成的复盘记录
cat workflow_log.json

# 重新执行流程
python3 replay_script.py
```

## 核心功能

### 1. 坐标原点说明管理

- **去重导入**: 重复导入同一批坐标原点不会导致预演记录翻倍
- **哈希校验**: 基于 `id + name + x + y + z` 生成唯一哈希值进行去重
- **代码位置**: [preflight.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/preflight.py#L14-L42) 中 `import_coordinate_origins()` 方法

### 2. 巡检照片编号关联

- **备注历史**: 修改备注时记录改前改后差异
- **遮挡检测**: 自动检测移动端截图是否遮挡告警标签
- **代码位置**: [preflight.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/preflight.py#L77-L104) 中 `update_photo_remark()` 方法

### 3. 3D/图表展示与回溯

- **多视图切换**: 支持列表视图、3D视图、图表视图
- **点击回溯**: 点击任意记录可跳转回坐标原点说明或巡检照片编号
- **代码位置**: [visualization.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/visualization.py)

## 边界规则

### 规则一：移动端截图挡住告警标签的判断

**判定条件** (代码中实现):
```python
# 当且仅当以下两个条件同时满足时判定为遮挡
has_mobile_screenshot = True  AND  alert_label_visible = False
```

**代码位置**: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/models.py#L58-L59) 中 `is_alert_label_blocked()` 方法

**触发动作**:
- 预演记录状态自动变为 `needs_review`
- 自动进入施工经理复核队列

---

### 规则二：移动端截图挡住告警标签的修改流程

| 阶段 | 操作人 | 操作 | 状态变化 |
|------|--------|------|----------|
| 1 | 展陈设计师阿景 | 提交施工经理复核 | `needs_review` → `manager_review` |
| 2 | 施工经理 | 复核确认/驳回 | `manager_review` → `block_confirmed` 或 `normal` |
| 3 | 展陈设计师阿景 | 解决问题（重拍/接受） | `block_confirmed` → `resolved` |

**代码位置**: [review.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/review.py)

---

### 规则三：回滚机制

**支持回滚的操作**:
- 施工经理复核结果
- 问题解决操作
- 备注修改

**回滚方法**:
```python
# 回滚到上一个状态
review_manager.rollback(record_id, actor="system")
```

**代码位置**: [review.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/review.py#L141-L167) 中 `rollback()` 方法

**快照内容**: 每次关键操作前自动保存状态快照，包括：
- `status`: 记录状态
- `review_status`: 复核状态
- `block_detected`: 遮挡检测标记
- `block_verified`: 复核确认标记

---

### 规则四：重复导入不翻倍

**去重算法** (代码中实现):

1. 对每个坐标原点计算 SHA256 哈希：
   ```python
   data = {
       "id": origin.id,
       "name": origin.name,
       "x": origin.x,
       "y": origin.y,
       "z": origin.z,
   }
   ```

2. 哈希已存在时跳过导入，并返回 `duplicate_of_{existing_id}` 标记

3. 哈希不存在时创建新的预演记录

**代码位置**:
- 哈希计算: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/models.py#L20-L28)
- 去重逻辑: [preflight.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/preflight.py#L20-L26)

---

### 规则五：备注修改留痕

**历史记录格式**:
```json
{
  "timestamp": "2024-01-01T12:00:00",
  "action": "remark_updated",
  "actor": "designer_ajing",
  "details": {
    "photo_id": "photo_001",
    "old_remark": "修改前的备注",
    "new_remark": "修改后的备注"
  }
}
```

**查看差异方法**:
```python
workflow_engine.verify_history_diff(record_id)
```

**代码位置**: [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/workflow.py#L167-L191)

---

### 规则六：3D/图表点击不丢源

**点击交互规则**:
1. 在 3D 视图或图表视图中点击任意记录
2. 系统返回完整上下文数据：
   - 预演记录详情
   - 关联的坐标原点说明
   - 关联的巡检照片编号列表
3. 提供回退链接：`back_links.to_origin` 和 `back_links.to_photos`

**代码位置**: [visualization.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/visualization.py#L21-L37)

---

### 规则七：三步流程必走复核

**标准三步流程**:

| 步骤 | 操作 | 关键检查点 |
|------|------|------------|
| 1 | 坐标原点说明第一次导入 | 去重检查、创建预演记录 |
| 2 | 展陈设计师阿景补看巡检照片编号 | 自动检测遮挡告警 |
| 3 | 安全距离报告更新 | **遇到遮挡不自动归正常，留施工经理复核** |

**关键代码逻辑**:
```python
# 第三步：不自动清除遮挡标记，必须人工复核
# 见 workflow.py 中 _step3_update_report()
# 仅提交复核，不改变 block_detected 状态
```

**代码位置**: [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72263/airbridge/workflow.py#L72-L103)

## 输出物说明

运行测试后生成三类输出：

### 1. 可复盘记录：workflow_log.json

包含完整操作历史，每条记录带时间戳、操作人、详细内容。

### 2. 可重新跑的命令：replay_script.py

自动生成的 Python 脚本，可重复执行整个预演流程。

### 3. 可视化报告：visualization_report.json

包含 3D 视图数据和图表统计数据，可用于前端展示。

## 目录结构

```
.
├── airbridge/
│   ├── __init__.py          # 包入口
│   ├── models.py            # 数据模型 (CoordinateOrigin, InspectionPhoto, PreflightRecord)
│   ├── preflight.py         # 预演核心管理器
│   ├── review.py            # 复核流程管理器
│   ├── visualization.py     # 可视化与回溯
│   └── workflow.py          # 工作流引擎
├── test_workflow.py         # 三步流程测试脚本
├── requirements.txt         # 依赖包
└── README.md                # 本文档
```

## 状态流转图

```
imported → photo_attached → needs_review → manager_review
                                                      ↓
                                         block_confirmed ──┐
                                               ↓            │
                                            resolved        │
                                               ↓            │
                                   (可回滚) ────┴────────────┘
```

## 关键角色

| 角色 | 英文标识 | 权限 |
|------|----------|------|
| 展陈设计师阿景 | `designer_ajing` | 导入坐标、添加照片、修改备注、提交复核、解决问题 |
| 施工经理 | `construction_manager` | 复核遮挡问题、确认/驳回 |
| 系统 | `system` | 自动操作、回滚 |

## 常见问题

**Q: 如何判断一条记录是否需要复核？**
A: 检查 `record.status == 'needs_review'` 或 `record.status == 'manager_review'`

**Q: 如何查看所有待复核记录？**
A: 调用 `review_manager.get_records_needing_review()`

**Q: 回滚能回几次？**
A: 每次关键操作前保存一个快照，可回滚到上一次操作前的状态。如需多级回滚需自行扩展。
