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
| 回滚 | ✅ 训练教练 | 可回滚到任意历史版本，所有字段从快照恢复 |

### 3. 修改操作要求

教练修正混用时必须记录：
- 最终采用的单位（CELSIUS 或 KELVIN）
- 修改备注（必填）
- 修改人、时间、旧值、新值

**修正后：**
- 状态变为 `COACH_APPROVED`
- **保留** `has_mixed_units = True` 作为历史标记，方便追溯
- `temperature_raw` 原始文本永不修改
- 自动生成版本快照，可随时回滚

### 4. 回滚规则（可信闭环）

- 任何已完成的修改都可回滚
- 回滚仅限训练教练操作
- **字段级回滚**：所有字段从版本快照恢复，包括：
  - `temperature_value` 温度值
  - `temperature_unit` 温度单位
  - `has_mixed_units` 混用标记
  - `error_status` 处理状态
  - `handwritten_remark` 手写备注
  - `report_content` 交接报告
  - `balance_wheel_error` 摆轮误差
- 所有变更历史保留，回滚记录追加到末尾
- 标记 `is_rollbacked = True` 和 `rollback_to_version`
- **闭环验证**：可调用 `verify_rollback_closed_loop()` 验证所有字段与目标快照一致

---

## 重复导入规则

### 去重逻辑

唯一键：`source_file + file_name + original_row_number`

### 五类分类

重复导入时，每条记录会被归入以下五类之一：

| 分类 | 说明 | 计数影响 |
|------|------|----------|
| **new** 新记录 | 第一次出现的记录 | 数量+1 |
| **duplicate_in_batch** 本次重复 | 同一导入文件内重复出现 | 跳过，不计入 |
| **duplicate_from_history** 历史重复 | 之前已导入过（同文件不同批次） | 跳过，不计入 |
| **unchanged** 无变化 | 同批次已存在且无字段变化 | 跳过，不计入 |
| **updated** 有更新 | 同批次已存在且有字段变化 | 不增加，仅更新 |

### 重复导入时的处理

同一照片重复导入时：
- ✅ 不创建新记录，不增加计数
- ✅ 仅更新有变化的字段（如 `handwritten_remark`, `balance_wheel_error`）
- ✅ 每条变更都记录到 `change_history`
- ✅ 更新记录附带 `changes` 字段，含 `old`/`new` 值
- ✅ 历史重复记录附带 `existing_batch_id` 和 `existing_version`，可追溯来源

### 示例场景

林老师只改了一条备注后重新导入：
- 其他无变化的照片：unchanged 类，跳过
- 备注变化的照片：updated 类，更新备注，追加变更记录
- 新增的照片：new 类，正常导入
- 历史已有的照片：duplicate_from_history 类，可追溯到原批次

---

## 证据追溯能力

训练教练追问时，可通过以下路径追溯：

1. **按原始行号或文件名找到目标照片**
2. **查看 `change_history` 列表，每次改动包含：**
   - 版本号
   - 操作时间
   - 操作人角色
   - 变更类型
   - 修改的字段名
   - 旧值 ↔ 新值
   - 操作备注
   - 操作后的完整快照（`snapshot_after`）
3. **对比任意两个版本的差异**（字段级 diff）
4. **调用 `verify_rollback_closed_loop()` 验证回滚闭环**
5. **必要时回滚到任意历史版本**

### 追溯入口

- **批次报告**：`get_batch_summary()` 返回每张照片的 `traceback_hint`
- **单张证据报告**：`get_photo_evidence()` 返回完整证据链和追溯路径
- **导入审计日志**：`get_import_audit_log()` 记录每次导入的分类统计
- **版本对比**：`compare_photo_versions()` 返回两个版本的快照和字段差异

---

## 项目结构

```
src/
├── models/
│   ├── enums.py          # 枚举定义（状态、单位、角色、变更类型）
│   ├── base.py           # 基类和变更记录
│   ├── photo.py          # 工况照片数据模型（含快照机制）
│   └── batch.py          # 导入批次模型
├── services/
│   ├── import_service.py  # 导入服务（含五类去重分类）
│   ├── boundary_rules.py  # 边界规则服务（混用判定、修改、快照回滚）
│   ├── workflow.py       # 工作流服务（三步流程）
│   └── report_service.py  # 报告服务（证据导出、追溯）
├── utils/
│   ├── temperature.py    # 温度解析和单位转换
│   └── hash.py         # ID生成
└── app.py              # 统一应用入口

examples/
├── demo.py             # 功能演示
└── e2e_verification.py  # 端到端验证（9个场景闭环验证）
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
