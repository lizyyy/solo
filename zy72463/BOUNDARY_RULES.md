# 城市树池破损巡检 - 边界规则

本文档定义了"城市树池破损巡检"系统的所有边界规则，所有规则同时在代码中实现。

---

## 1. 导入去重与批次追踪规则

### 规则描述
重复导入同一批居民投诉编号时，不会创建重复的巡检记录；重复导入会被记录，且能区分历史批次和本次重传。

### 判定条件
- 以 `complaint_id`（居民投诉编号）作为唯一键
- 导入前检查该 `complaint_id` 是否已存在于系统中
- 已存在的记录不创建新巡检，但在历史中记录 `reimport_skipped`

### 重复导入追踪
重复导入时，系统自动记录：
- 历史批次号（`import_batch`）：首次导入时的批次
- 本次重传批次号（`import_batch`）：本次重传的批次
- 其间变更数量和操作人列表
- 当前状态和评分

### 批次标识
- 每次导入可指定 `batch_id`
- 未指定时自动生成 `batch_` 前缀的批次号
- `TreePoolInspection.import_batch` 记录首次导入批次
- `ChangeRecord.import_batch` 记录该变更所属批次

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L87-L167) `import_complaints` 方法

### 行为
- 返回值: `(created_list, skipped_with_existing_list)`
- 已存在的ID会出现在 `skipped_with_existing` 中，附带现有巡检记录
- 不报错，不中断导入流程
- 重复导入不翻倍，但留下追踪记录

### 查看方式
```bash
python cli.py history --complaint C001
# 会看到 reimport_skipped 类型记录，包含批次对比和变更摘要
```

---

## 2. 三步工作流规则

### 规则描述
标准巡检流程必须按以下三步顺序执行：
1. **居民投诉编号第一次导入** → 状态: `pending`
2. **街道规划员小姜补看路口照片** → 状态: `photo_reviewed`
3. **整改建议更新** → 状态: `suggestion_updated`

### 状态流转
```
pending (已导入，待补照片)
    ↓ 添加照片
photo_reviewed (已补看照片，待写建议)
    ↓ 更新整改建议
suggestion_updated (完成三步流程)
```

### 代码位置
- 状态定义: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L8-L14) `InspectionStatus`
- 状态流转逻辑: [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L169-L213) `add_photo` 和 [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L335-L369) `update_suggestion`

---

## 3. 坡道补录评分无变化处理规则

### 规则描述
坡道补录后，如果评分没有变化，不能直接归为"正常"，必须标记为"需复核"，留给交通协管处理。

### 判定条件
坡道补录时，同时满足以下条件：
1. 补录前已有评分 (`old_score is not None`)
2. 补录后设置了评分 (`new_score is not None`)
3. `abs(old_score - new_score) < 0.001`（浮点精度范围内相等）

### 触发动作
- 巡检状态自动变更为 `needs_review`
- 历史记录中标记 `[评分未变化，需复核]`
- 出现在"待复核列表"中
- `ChangeRecord.old_status`/`new_status` 记录状态变化前后值

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L280-L333) `add_ramp_supplement` 方法

### 复核流程
1. 交通协管查看 `needs_review` 列表
2. 执行复核操作，可调整评分或确认正常
3. 状态变为 `reviewed`

---

## 4. 备注历史追踪规则

### 规则描述
街道规划员小姜只改了一条备注，历史记录里要能看出改前改后的差别。

### 记录内容
每次备注更新时，历史变更记录包含：
- `change_type`: `remark_updated`
- `field_name`: `"remark"`
- `old_value`: 修改前的备注内容
- `new_value`: 修改后的备注内容
- `old_status`/`new_status`: 操作前后的状态
- `old_score`/`new_score`: 操作前后的评分
- `changed_by`: 操作人
- `changed_at`: 操作时间
- `remark`: 人类可读的变化描述

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L215-L246) `update_remark` 方法

### 查看方式
```bash
python cli.py history --complaint <投诉编号>
```

---

## 5. 回滚规则

### 规则描述
支持对历史变更进行回滚，回滚操作本身也会被记录。回滚必须同步恢复状态和评分。

### 可回滚的字段
- `remark` - 备注（恢复到旧值，状态同步恢复）
- `score` - 评分（恢复到旧值，状态同步恢复）
- `suggestion` - 整改建议（恢复到旧值，状态同步恢复）
- `photos` - 照片（弹出最后一张，状态同步恢复）
- `ramp_supplements` - 坡道补录（弹出最后一条，**状态和评分必须同步恢复**）

### 回滚行为
1. 将字段值恢复到变更前的值
2. **同步恢复状态**：利用 `ChangeRecord.old_status` 恢复到操作前的状态
3. **同步恢复评分**：利用 `ChangeRecord.old_score` 恢复到操作前的评分
4. 新增一条 `rolled_back` 类型的历史记录
5. 回滚记录包含状态变化和评分变化的完整描述

### 关键场景：回滚坡道补录
当回滚一条坡道补录变更时：
- 坡道补录数从 N → N-1
- 状态从 `needs_review` 恢复到坡道补录前的状态（如 `suggestion_updated`）
- 评分恢复到坡道补录前的评分
- 从待复核列表中移除
- 回滚记录中明确标注状态和评分的前后变化

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L409-L481) `rollback` 方法

### 使用方式
```bash
# 先查看历史获取 change_id
python cli.py history --complaint C001

# 回滚指定变更
python cli.py rollback --complaint C001 --change chg_xxxxxx

# 验证回滚后状态
python cli.py show --complaint C001
```

---

## 6. 3D/图表展示数据溯源规则

### 规则描述
如果选择3D或图表展示，点击数据点后必须能回到原始数据来源：
- 居民投诉编号
- 路口照片（含关键备注）

### 代码保障
每条数据记录都包含完整的溯源链路：
```
图表数据点
    ↓ (关联 inspection_id)
TreePoolInspection
    ↓ (complaint_id)
ResidentComplaint (居民投诉编号)
    ↓ (photos 列表)
IntersectionPhoto (路口照片，含 file_path 和 remark)
```

### 反查命令
```bash
python cli.py trace --complaint C001
```
输出包含：投诉编号、路口、照片及关键备注、坡道补录、完整时间线（含改前改后、状态变化）

### 代码位置
- 数据模型: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L131-L148) `TreePoolInspection`
- 反查方法: [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L508-L581) `trace_from_complaint`

---

## 7. 可复盘与可重放规则

### 规则描述
系统产出的不是功能清单，而是一份能复盘的记录和可重新跑的命令。

### 复盘记录
每条巡检都包含完整的 `history` 列表，按时间排序，记录所有变更。每条变更记录包含：
- `old_status`/`new_status`: 操作前后状态
- `old_score`/`new_score`: 操作前后评分
- `import_batch`: 所属批次

### 可重放命令
每次操作都会生成对应的命令行命令，存储在 `ChangeRecord.command_replay` 中。

### 查看方式
```bash
python cli.py replay --complaint C001
```

---

## 8. 状态机完整规则

```
                    +------------+
                    |  pending   |  (初始：已导入投诉)
                    +-----+------+
                          | add_photo
                          ↓
                    +------------+
                    |photo_review|  (已补看路口照片)
                    +-----+------+
                          | update_suggestion
                          ↓
              +------------------------+
              |   suggestion_updated   |  (已更新整改建议)
              +-----------+------------+
                          |
                          | add_ramp (评分不变时)
                          ↓
                    +------------+
                    |needs_review|  (需交通协管复核)
                    +-----+------+
                          | review
                          ↓
                    +------------+
                    |  reviewed  |  (已复核)
                    +------------+

    回滚路径:
    needs_review --rollback ramp--> suggestion_updated
    (状态和评分同步恢复)
```

### 状态列表
| 状态 | 说明 | 触发操作 |
|------|------|----------|
| `pending` | 待处理，已导入投诉 | `import_complaints` |
| `photo_reviewed` | 已补看照片 | `add_photo` |
| `suggestion_updated` | 已更新整改建议 | `update_suggestion` |
| `needs_review` | 需复核（评分未变） | `add_ramp_supplement`（评分不变时） |
| `reviewed` | 已复核 | `review_by_traffic_assistant` |
| `closed` | 已关闭 | 预留 |

---

## 9. 数据一致性规则

### 主键约束
- `complaint_id` 全局唯一，对应一条巡检记录
- `inspection_id` 内部唯一标识
- `change_id` 每条变更记录唯一

### 不可删除原则
- 所有数据只追加，不物理删除
- 删除操作通过回滚实现
- 历史记录永久保留

### 浮点比较规则
评分比较使用精度阈值 `0.001`，避免浮点精度问题。

代码位置: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L170-L175) `has_ramp_score_unchanged`

---

## 10. 变更记录上下文快照规则

### 规则描述
每条变更记录不仅保存字段的新旧值，还保存操作时的状态快照和评分快照，确保回滚和复盘时能完整还原。

### ChangeRecord 上下文字段
| 字段 | 说明 |
|------|------|
| `old_status` | 操作前状态 |
| `new_status` | 操作后状态 |
| `old_score` | 操作前评分 |
| `new_score` | 操作后评分 |
| `import_batch` | 该变更所属的导入批次 |

### 代码位置
[models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L76-L105) `ChangeRecord`

### 回滚保障
- 回滚时读取 `old_status` 和 `old_score` 恢复状态和评分
- 回滚记录自身也保存回滚前后的状态和评分，支持二次回滚

---

## 11. 重复导入变更影响追踪规则

### 规则描述
备注或评分变过以后，重复导入要能讲清谁改了什么、改完影响了哪条结果。

### 追踪内容
重复导入时，`reimport_skipped` 类型的历史记录包含：
- 历史批次号 vs 本次重传批次号
- 首次导入以来的变更数量
- 变更操作人列表
- 当前状态和评分

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L100-L129) `import_complaints` 中的重复导入分支
