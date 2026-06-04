# 磁场线圈均匀区 - 可追溯数据管理系统

## 系统概述

本系统用于整合"传感器编号"（主流程证据）和"工况照片"（现场说法证据）两类数据到"磁场线圈均匀区"统一结果中，确保所有改动可追溯、可复盘、可回滚。

---

## 核心设计原则

1. **证据双轨制**：传感器编号的原始行号、人工改动、处理状态永久留存
2. **边界规则代码化**：所有判定逻辑写在代码中，不依赖口头约定
3. **历史可追溯**：每条变更记录改前改后的值，训练教练追问时能回到原始证据
4. **防重复机制**：重复导入不新增记录，只更新批次号和差异字段
5. **晚到材料保护**：工况照片晚上补进时，只刷新相关明细，不洗掉已确认内容

---

## 边界规则（代码化，见 [rules.py](file:///Users/lzy/pro/solo/workspaces/zy72375/rules.py)）

### 规则 TEMP_MIX_001: 摄氏度(°C)与开尔文(K)混用检测

**触发条件**：
- 同一批导入的传感器记录中，同时存在温度单位为°C和K的记录
- 单条记录的温度值与单位明显不匹配（如25K应是25°C，300°C应是300K）

**执行动作**：
1. 设置 `has_mixed_temp_units = True`
2. 设置 `coach_review_required = True`
3. 状态流转为 `TEMP_MIXED`（温度单位混用待复核）
4. **不自动修正**，必须等待训练教练复核
5. 记录混用详情到 `review_notes`

**回滚动作**：
1. 清除 `has_mixed_temp_units` 标记
2. 清除 `coach_review_required` 标记
3. 恢复到前一个有效状态（通常是 `IMPORTED`）
4. 清空因混用添加的 `review_notes`

---

### 规则 TEMP_MIX_002: 温度值范围合理性校验

**触发条件**：
- 单位为°C时，温度值 < -273.15 或 > 1000
- 单位为K时，温度值 < 0 或 > 1273
- 缺少单位但有数值

**执行动作**：
1. 标记为 `coach_review_required = True`
2. 状态流转为 `TEMP_MIXED`
3. 在 `review_notes` 中记录异常值详情

**回滚动作**：
1. 清除 `coach_review_required` 标记
2. 恢复到 `IMPORTED` 状态
3. 清空异常值相关的 `review_notes`

---

### 规则 TEMP_CORR_001: 训练教练复核后温度单位修正

**触发条件**：
训练教练明确确认修正方向：
- °C -> K: value + 273.15
- K -> °C: value - 273.15
- 数值修正：如25K实为25°C

**执行动作**：
1. 按教练确认的公式修正温度值
2. 更新 `temperature_unit` 为正确单位
3. 设置 `processing_status = COACH_REVIEWED`
4. 记录修改前后值到历史记录
5. 在 `manual_annotation` 中记录修正依据
6. 设置 `coach_review_required = False`

**回滚动作**：
1. 从历史记录恢复 `temperature_value` 和 `temperature_unit`
2. 恢复 `processing_status = TEMP_MIXED`
3. 设置 `coach_review_required = True`
4. 清空本次修正的 `manual_annotation`

---

### 规则 LATE_ARRIVAL_001: 晚到工况照片处理规则

**触发条件**：
- 工况照片上传时间晚于传感器编号导入时间超过4小时
- 或明确标记为 `is_late_arrival = True`

**执行动作**：
1. 只更新 `related_photo_ids` 字段
2. 只刷新 `review_notes` 中与该照片相关的内容
3. **不修改** `sensor_id`、`temperature_value`、`uniform_zone_flag`
4. **不修改** 已为 `CONFIRMED` 状态的记录
5. 状态流转为 `PHOTO_REVIEWED`（如果之前低于此状态）
6. 在 `review_notes` 中标注"晚到材料"

**回滚动作**：
1. 移除该 `photo_id` 从 `related_photo_ids`
2. 移除 `review_notes` 中与该照片相关的内容
3. 如果状态是 `PHOTO_REVIEWED` 且没有其他照片，回退到 `IMPORTED`

---

### 规则 DUPLICATE_001: 重复导入防翻倍规则

**触发条件**：
传感器记录的 `sensor_id + original_line_number + source_file` 哈希值已存在于系统中

**执行动作**：
1. **不创建新的** `UniformZoneRecord`（防止数量翻倍）
2. 对比新旧 `raw_data`，如有差异则更新
3. 只更新 `import_batch_id` 为最新批次
4. 记录一条 `MANUAL_EDIT` 类型的历史变更
5. 状态保持不变

**回滚动作**：
1. 恢复 `raw_data` 到重复导入前的版本
2. 恢复 `import_batch_id` 到之前的批次
3. 移除本次重复导入产生的历史记录

---

## 标准三步法业务流程

### 第一步：传感器编号导入
由数据员执行，将传感器编号主流程数据导入系统。

```bash
python3 main.py import-sensors \
    --input-file test_data/sensors.json \
    --operator "数据员"
```

**系统自动处理**：
- 为每条传感器记录创建对应的"磁场线圈均匀区"记录
- 保留 `original_line_number`（原始行号）
- 自动检测温度单位混用情况，触发 `TEMP_MIX_001` 或 `TEMP_MIX_002` 规则
- 检测到的混用记录标记为 `教练待复核`，**不自动修正**

---

### 第二步：设备工程师何工补看工况照片
由设备工程师"何工"执行，将现场说法照片关联到对应记录。

```bash
python3 main.py review-photos \
    --input-file test_data/photos.json \
    --operator "何工"
```

**系统自动处理**：
- 将照片关联到对应的均匀区记录
- 状态从 `IMPORTED` 流转为 `PHOTO_REVIEWED`
- 晚到照片（标记 `is_late_arrival: true`）只更新照片相关字段
- 已 `CONFIRMED` 的记录不受晚到照片影响

**晚到材料场景**：
```bash
python3 main.py review-photos \
    --input-file test_data/late_photos.json \
    --operator "何工"
```

---

### 第三步：交接报告更新
由设备工程师"何工"执行，更新交接报告。

```bash
python3 main.py update-report \
    --uz-ids "uz-id-1,uz-id-2" \
    --notes "现场核验完成，数据与照片一致" \
    --operator "何工"
```

**重要约束**：
- 如果记录处于 `TEMP_MIXED` 状态且 `coach_review_required = True`，**拒绝更新**
- 必须先由训练教练完成温度单位复核，才能更新交接报告
- 状态从 `PHOTO_REVIEWED` 流转为 `REPORT_UPDATED`

---

## 温度单位混用处理流程（核心）

```
传感器导入
    ↓
系统检测到温度混用（如同一批有°C也有K）
    ↓
自动标记: has_mixed_temp_units=true, coach_review_required=true
状态: TEMP_MIXED
    ↓
┌─────────────────────────────────────┐
│  训练教练复核（必须人工确认）        │
│  python3 main.py coach-review ...     │
└─────────────────────────────────────┘
    ↓
按教练确认的公式修正温度
状态: COACH_REVIEWED
    ↓
何工才能继续更新交接报告
状态: REPORT_UPDATED
    ↓
最终确认
状态: CONFIRMED
```

**训练教练复核命令**：

场景1：单位标签写错了，数值正确（25K 实为 25°C）
```bash
python3 main.py coach-review \
    --uz-id <均匀区记录ID> \
    --target-unit "°C" \
    --correction-mode fix_unit \
    --remark "现场工艺要求用摄氏度，25K是记录错误，应为25°C，数值保持25不变" \
    --operator "训练教练"
```

场景2：单位正确但需要转换（298.15K 转换为 25°C）
```bash
python3 main.py coach-review \
    --uz-id <均匀区记录ID> \
    --target-unit "°C" \
    --correction-mode convert \
    --remark "按公式转换：298.15K - 273.15 = 25°C" \
    --operator "训练教练"
```

---

## 防重复导入机制

重复导入同一批传感器数据时，系统通过 `sensor_id + original_line_number + source_file` 的哈希值判断重复：

1. **哈希匹配** → 不创建新记录，数量不翻倍
2. **数据有差异** → 更新 `raw_data`，记录 `MANUAL_EDIT` 历史
3. **数据无差异** → 仅更新 `import_batch_id`，保留原始导入时间

**验证方式**：
```bash
# 第一次导入
python3 main.py import-sensors --input-file test_data/sensors.json --operator "数据员"
python3 main.py stats  # 查看总数

# 重复导入
python3 main.py import-sensors --input-file test_data/sensors.json --operator "数据员"
python3 main.py stats  # 总数不变
```

---

## 可复盘记录与可重跑命令

### 查看单条记录的完整证据链
```bash
python3 main.py show --uz-id <记录ID>
```

输出包含：
- `uniform_zone`: 磁场线圈均匀区当前状态
- `sensor_evidence`: 传感器编号原始证据（含原始行号）
- `photo_evidences`: 工况照片现场说法
- `history`: 所有变更历史
- `change_comparisons`: 每次变更的改前改后对比
- `audit_summary`: 审计汇总
- `replay_commands`: 可重跑命令列表

### 生成可重跑命令
```bash
python3 main.py history --uz-id <记录ID> --replay
```

输出示例：
```
# [2026-06-04T10:00:00] 导入 - 数据员: 首次导入，批次: BATCH-20260604100000
python3 main.py import-sensors --source sensors.csv --sensor-id S001 --line 5

# [2026-06-04T11:00:00] 工况照片关联 - 何工: 工况照片复核: 线圈A区温度均匀
python3 main.py attach-photo --uz-id xxx --photo-id P001
```

### 导出完整复盘报告
```bash
python3 main.py export --output reports/full_audit.json
```

---

## 人工改动追踪

何工只改了一条备注时，历史记录能看出改前改后的差别：

```bash
python3 main.py manual-edit \
    --uz-id <记录ID> \
    --field "manual_annotation" \
    --value "补充：现场观察到线圈振动轻微，不影响均匀性" \
    --reason "补充现场观察记录" \
    --operator "何工"
```

查看改动对比：
```bash
python3 main.py history --uz-id <记录ID> --compare-id <历史条目ID>
```

输出：
```json
{
  "modified": {
    "manual_annotation": {
      "before": "原始备注",
      "after": "原始备注\n补充：现场观察到线圈振动轻微..."
    }
  }
}
```

---

## 回滚机制

任何变更都可以回滚：

```python
from history import HistoryManager
hm = HistoryManager()
hm.rollback_to("<历史条目ID>", operator="何工")
```

回滚会创建一条 `ROLLBACK` 类型的历史记录，将 `before_value` 和 `after_value` 互换。

---

## 数据存储结构

所有数据存储在 `data/` 目录下：

- `sensors.json` - 传感器编号原始记录（含原始行号）
- `photos.json` - 工况照片记录
- `uniform_zones.json` - 磁场线圈均匀区整合结果
- `history.json` - 所有变更历史和审计日志

**绝不能直接编辑这些JSON文件**，必须通过命令行或API操作，以确保历史记录完整。

---

## 查看所有边界规则

```bash
python3 main.py rules
```

---

## 查看统计信息

```bash
python3 main.py stats
```

输出示例：
```json
{
  "total_uniform_zones": 10,
  "total_sensors": 10,
  "total_photos": 5,
  "status_distribution": {
    "已导入": 2,
    "照片已复核": 3,
    "温度单位混用待复核": 2,
    "教练已复核": 2,
    "交接报告已更新": 1
  },
  "pending_coach_review": 2
}
```

---

## 代码结构

| 文件 | 说明 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72375/models.py) | 数据模型定义 |
| [rules.py](file:///Users/lzy/pro/solo/workspaces/zy72375/rules.py) | 边界规则引擎 |
| [history.py](file:///Users/lzy/pro/solo/workspaces/zy72375/history.py) | 历史记录管理 |
| [processor.py](file:///Users/lzy/pro/solo/workspaces/zy72375/processor.py) | 核心业务处理器 |
| [main.py](file:///Users/lzy/pro/solo/workspaces/zy72375/main.py) | 命令行入口 |
| [test_data/](file:///Users/lzy/pro/solo/workspaces/zy72375/test_data/) | 测试数据 |
| [run_full_demo.py](file:///Users/lzy/pro/solo/workspaces/zy72375/run_full_demo.py) | 完整流程演示脚本 |

---

## 完整流程演示

运行演示脚本，体验完整的三步法流程 + 温度混用处理 + 晚到材料场景：

```bash
python run_full_demo.py
```

演示脚本涵盖以下场景：
1. 导入含温度混用的传感器数据
2. 系统自动检测并标记待复核
3. 何工补看工况照片
4. 尝试更新报告（因待复核被拒绝）
5. 训练教练复核修正温度单位
6. 何工更新交接报告
7. 何工修改一条备注
8. 晚到照片补录
9. 导出可复盘报告
10. 生成可重跑命令

---

## 核心状态流转

```
待处理 (PENDING)
    ↓ 导入
已导入 (IMPORTED)
    │
    ├─→ 检测到温度混用 → 温度单位混用待复核 (TEMP_MIXED)
    │                           ↓ 教练复核
    │                      教练已复核 (COACH_REVIEWED)
    │                           ↓
    └───────────────────────────┘
    ↓ 照片复核
照片已复核 (PHOTO_REVIEWED)
    ↓ 更新报告
交接报告已更新 (REPORT_UPDATED)
    ↓ 最终确认
已确认 (CONFIRMED)
```

---

## 关键字段留存说明

每条"磁场线圈均匀区"记录必须留存以下证据字段：

| 字段 | 说明 | 证据来源 |
|------|------|----------|
| `original_line_number` | 传感器编号在原始文件中的行号 | 传感器编号主流程 |
| `sensor_record_key` | 传感器记录唯一哈希键 | 传感器编号主流程 |
| `source_file` | 原始数据文件路径 | 传感器编号主流程 |
| `import_batch_id` | 导入批次号 | 导入操作 |
| `related_photo_ids` | 关联的工况照片ID列表 | 工况照片现场说法 |
| `review_notes` | 所有复核备注汇总 | 何工、教练 |
| `manual_annotation` | 人工改动说明 | 何工 |
| `has_mixed_temp_units` | 是否存在温度单位混用 | 系统自动检测 |
| `coach_review_required` | 是否需要教练复核 | 系统自动检测 |
| `history_ids` | 所有历史变更ID列表 | 系统自动记录 |

---

**本系统确保：训练教练追问时，能回到每一条证据，而不是只看一个汇总数。**
