# 城市树池破损巡检 - 边界规则

本文档定义了"城市树池破损巡检"系统的所有边界规则，所有规则同时在代码中实现。

---

## 1. 导入去重规则

### 规则描述
重复导入同一批居民投诉编号时，不会创建重复的巡检记录。

### 判定条件
- 以 `complaint_id`（居民投诉编号）作为唯一键
- 导入前检查该 `complaint_id` 是否已存在于系统中
- 已存在的记录直接跳过，不创建新的巡检记录

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L44-L89) 中的 `import_complaints` 方法

### 行为
- 返回值: `(created_list, skipped_list)`
- 已存在的ID会出现在 `skipped_list` 中
- 不报错，不中断导入流程

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
- 状态流转逻辑: [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L91-L128) `add_photo` 和 [service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L233-L261) `update_suggestion`

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

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L184-L231) `add_ramp_supplement` 方法

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
- `changed_by`: 操作人
- `changed_at`: 操作时间
- `remark`: 人类可读的变化描述 `"{旧值} → {新值}"`

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L130-L155) `update_remark` 方法

### 查看方式
```bash
python cli.py history --complaint <投诉编号>
```

---

## 5. 回滚规则

### 规则描述
支持对历史变更进行回滚，回滚操作本身也会被记录。

### 可回滚的字段
- `remark` - 备注
- `score` - 评分
- `suggestion` - 整改建议
- `photos` - 照片（弹出最后一张）
- `ramp_supplements` - 坡道补录（弹出最后一条）

### 回滚行为
1. 将字段值恢复到变更前的值
2. 新增一条 `rolled_back` 类型的历史记录
3. 回滚记录包含 `old_value`（回滚前的值）和 `new_value`（回滚后的值）

### 代码位置
[service.py](file:///Users/lzy/pro/solo/workspaces/zy72463/service.py#L297-L341) `rollback` 方法

### 使用方式
```bash
# 先查看历史获取 change_id
python cli.py history --complaint C001

# 回滚指定变更
python cli.py rollback --complaint C001 --change chg_xxxxxx
```

---

## 6. 3D/图表展示数据溯源规则

### 规则描述
如果选择3D或图表展示，点击数据点后必须能回到原始数据来源：
- 居民投诉编号
- 路口照片

### 代码保障
每条数据记录都包含完整的溯源链路：
```
图表数据点
    ↓ (关联 inspection_id)
TreePoolInspection
    ↓ (complaint_id)
ResidentComplaint (居民投诉编号)
    ↓ (photos 列表)
IntersectionPhoto (路口照片，含 file_path)
```

### 代码位置
数据模型关联: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L125-L175) `TreePoolInspection`

---

## 7. 可复盘与可重放规则

### 规则描述
系统产出的不是功能清单，而是一份能复盘的记录和可重新跑的命令。

### 复盘记录
每条巡检都包含完整的 `history` 列表，按时间排序，记录所有变更。

### 可重放命令
每次操作都会生成对应的命令行命令，存储在 `ChangeRecord.command_replay` 中。

### 查看方式
```bash
# 查看可重放命令
python cli.py replay --complaint C001
```

输出示例：
```
可重放命令 - C001:
  1. python cli.py import-complaints --ids C001
  2. python cli.py add-photo --complaint C001 --file photos/c001_1.jpg
  3. python cli.py update-remark --complaint C001 --remark '树池破损严重'
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

代码位置: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72463/models.py#L165-L170) `has_ramp_score_unchanged`
