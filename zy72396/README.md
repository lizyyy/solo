# 机械表摆轮误差管理系统

## 概述

本系统用于管理机械表摆轮误差的工况照片处理流程，核心目标是**证据可追溯**，而非只看汇总数。系统严格遵循三步标准流程，并特别处理摄氏度和开尔文混用的边界情况。

---

## 核心设计原则

1. **证据不丢失**：原始行号、原始文本、每次人工改动都完整保留
2. **边界不模糊**：摄氏度/开尔文混用有明确的判定、修改、回滚规则
3. **重复不翻倍**：同一批照片重复导入时不重复计数，只更新变化字段
4. **状态可回滚**：任何修改都可追溯并回滚到任意历史版本
5. **混用不急判**：检测到温度单位混用时，不急着归正常，留给训练教练复核

---

## 三步标准工作流程

### 第一步：工况照片第一次导入
- 操作员导入工况照片数据
- 系统自动解析温度单位
- **关键：检测到摄氏度/开尔文混用时，自动标记为 `COACH_REVIEW_PENDING`，不进入下一步
- 正常照片进入"等待林老师补看备注"状态

### 第二步：实验老师林老师补看手写巡检备注
- 仅林老师角色可操作
- 补充手写巡检备注
- **前提：没有待教练复核的混用问题**
- 完成后进入可更新报告状态

### 第三步：交接报告更新
- 仅训练教练角色可操作
- 更新交接报告内容
- **前提：没有待教练复核的混用问题**
- 完成后流程结束

---

## 边界规则：摄氏度和开尔文混用

### 1. 判定规则

当同一工况照片满足以下任一条件时，判定为"摄氏度/开尔文混用"：

- 温度文本中同时包含摄氏度标识（`°C`, `C`, `摄氏度`）和开尔文标识（`K`, `开尔文`）
- 同一行数据中出现多个温度值且单位不一致

**判定标记**：
- `has_mixed_units = True`
- `temperature_unit = MIXED`
- `error_status = COACH_REVIEW_PENDING`

### 2. 处理规则

| 操作 | 允许角色 | 说明 |
|------|----------|------|
| 自动修正 | ❌ 禁止 | 系统不得自动修正或忽略混用情况 |
| 补充备注 | ✅ 林老师 | 可补充备注，但不能改变状态或单位 |
| 修正单位 | ✅ 训练教练 | 指定最终单位，系统自动转换温度值 |
| 回滚 | ✅ 训练教练 | 可回滚到任意历史版本 |

### 3. 修改操作要求

教练修正混用时必须记录：
- 最终采用的单位（CELSIUS 或 KELVIN）
- 修改备注（必填
- 修改人、时间、旧值、新值

**修正后：
- 状态变为 `COACH_APPROVED`
- **保留** `has_mixed_units = True` 作为历史标记，方便追溯
- `temperature_raw` 原始文本永不修改

### 4. 回滚规则

- 任何已完成的修改都可回滚
- 回滚仅限训练教练操作
- 回滚后状态恢复到目标版本时的状态
- 所有变更历史完整保留，回滚记录追加到末尾
- 标记 `is_rollbacked = True` 和 `rollback_to_version`

---

## 重复导入规则

### 去重逻辑

唯一键：`source_file + file_name + original_row_number`

同一照片重复导入时：
- ✅ 不创建新记录，不增加计数
- ✅ 仅更新有变化的字段（如 `handwritten_remark`）
- ✅ 每条变更都记录到 `change_history`
- ✅ 可对比改前改后的差别在历史中完整可见

### 示例场景

林老师第一次只改了一条备注后重新导入：
- 其他无变化的照片：跳过
- 备注变化的照片：更新备注，追加变更记录
- 新增的照片：正常导入

---

## 证据追溯能力

训练教练追问时，可通过以下路径追溯：

1. **按原始行号或文件名找到目标照片
2. **查看 `change_history` 列表，每次改动包含：
   - 版本号
   - 操作时间
   - 操作人角色
   - 变更类型
   - 修改的字段名
   - 旧值 ↔ 新值
   - 操作备注
3. **对比任意两个版本的差异**
4. **必要时回滚到任意历史版本**

---

## 项目结构

```
src/
├── models/
│   ├── enums.py          # 枚举定义（状态、单位、角色、变更类型）
│   ├── base.py           # 基类和变更记录
│   ├── photo.py          # 工况照片数据模型
│   └── batch.py          # 导入批次模型
├── services/
│   ├── import_service.py  # 导入服务（含去重）
│   ├── boundary_rules.py  # 边界规则服务（混用判定、修改、回滚）
│   └── workflow.py       # 工作流服务（三步流程）
├── utils/
│   ├── temperature.py    # 温度解析和单位转换
│   └── hash.py         # ID生成
└── app.py              # 统一应用入口
```

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行示例

```bash
python examples/demo.py
```

### 基本使用

```python
from src.app import BalanceWheelErrorApp
from src.models.enums import TemperatureUnit

app = BalanceWheelErrorApp()

# 第一步：导入照片
rows = [
    {"file_name": "IMG_001.jpg", "original_row": 1, "temperature": "25°C", "balance_wheel_error": 0.5},
    {"file_name": "IMG_002.jpg", "original_row": 2, "temperature": "25°C / 298.15K", "balance_wheel_error": 0.3},
]
result = app.import_photos(rows, "工况表.xlsx")
batch_id = result["batch_id"]

# 查看待教练复核的混用照片
pending = app.get_pending_coach_review()

# 教练修正混用
photo_id = pending[0]["photo_id"]
app.coach_fix_mixed_units(photo_id, TemperatureUnit.CELSIUS, "经核对以摄氏度为准")

# 第二步：林老师补备注
app.lin_teacher_add_remark(photo_id, "巡检正常，磨损轻微")

# 第三步：教练更新报告
app.coach_update_report(photo_id, "交接报告：误差在允许范围内")

# 追溯变更历史
ok, msg, trail = app.get_photo_audit_trail(photo_id)
```

---

## 关键数据字段说明

### WorkingConditionPhoto（工况照片）

| 字段 | 说明 | 是否可修改 | 追溯要求 |
|------|------|-----------|----------|
| `original_row_number` | 原始行号 | ❌ 永不 | 必须保留 |
| `temperature_raw` | 原始温度文本 | ❌ 永不 | 必须保留 |
| `temperature_value` | 解析后的温度值 | ✅ 教练 | 记录变更 |
| `temperature_unit` | 温度单位 | ✅ 教练 | 记录变更 |
| `has_mixed_units` | 是否混用标记 | ✅ 仅设为True | 永久保留历史 |
| `error_status` | 处理状态 | ✅ 按流程 | 记录变更 |
| `handwritten_remark` | 手写备注 | ✅ 林老师 | 记录变更 |
| `report_content` | 交接报告 | ✅ 教练 | 记录变更 |
| `change_history` | 变更历史列表 | ❌ 仅追加 | 完整保留 |
| `is_rollbacked` | 是否已回滚 | ✅ 教练 | 记录变更 |
| `rollback_to_version` | 回滚到的版本 | ✅ 教练 | 记录变更 |

---

## 状态流转图

```
IMPORTED (导入)
    │
    ├─→ 检测到混用 ──→ COACH_REVIEW_PENDING (待教练复核)
    │                         │
    │                         └─→ 教练修正 ──→ COACH_APPROVED
    │                                                       │
    └─→ 无混用 ──→ MANUAL_REVIEW_PENDING (待林老师备注) ────┘
                                    │
                                    └─→ 林老师补备注 ──→ LIN_TEACHER_REVIEWED
                                                          │
                                                          └─→ 教练更新报告 ──→ REPORT_UPDATED (完成)

任意状态 ──→ 回滚 ──→ ROLLBACKED (可重新走流程)
```

---

## 代码中的边界规则

边界规则同时存在于：
- 代码：[src/services/boundary_rules.py](src/services/boundary_rules.py) 中的 `BOUNDARY_RULES_DOC` 常量和 `BoundaryRuleService` 类
- 文档：本 README

两处保持同步更新
