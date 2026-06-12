# 播客片头音乐排期系统

## 核心原则（固化在代码中，不是口头约定）

1. **单一数据源**：页面展示、导出明细、接口返回，读取同一份数据，绝不各自计算
2. **证据链完整**：调音师留言的原始行号、人工改动、处理状态，全程留痕可追溯
3. **异常不自动归一**：请假课时被算进已消耗等异常，留给巡演统筹复核，不自动归正常
4. **导出状态持久化**：导出元数据写入单一数据源，重启/重载后不丢失
5. **人工补录同步**：补录后明细、历史、后续结果都读到同一条更新
6. **回滚完整性**：回滚不能只改当前状态，必须同步更新导出状态
7. **字段统一映射**：页面/导出/API 使用同一套业务字段定义，不各自发明字段名

## 统一业务字段映射（FieldMapping）

所有视图必须使用 `FieldMapping` 定义的字段，确保底层存储一致。

| 业务字段 | 页面展示(display) | 导出明细(export) | 接口返回(api) | 说明 |
|----------|-------------------|------------------|---------------|------|
| `id` | id | 记录ID | id | 记录唯一标识 |
| `episode_number` | episode | 期数 | episode_number | 播客期数 |
| `track_name` | track | 曲目名称 | track_name | 片头音乐名称 |
| `scheduled_date` | date | 排期日期 | scheduled_date | 排期日期 |
| `scheduled_time` | time | 排期时间 | scheduled_time | 排期时间 |
| `duration_minutes` | duration | 时长(分钟) | duration_minutes | 时长(分钟) |
| `engineer_name` | engineer | 调音师 | engineer_name | 调音师姓名 |
| `status` | status | 状态 | status | 处理状态编码 |
| `status_text` | status_text | 状态文本 | status_text | 状态中文说明 |
| `abnormal_type` | abnormal_type | 异常类型 | abnormal_type | 异常类型编码 |
| `abnormal_note` | abnormal_note | 异常说明 | abnormal_note | 异常详细说明 |
| `consumed` | consumed | 是否已消耗 | consumed | 是否已消耗 |
| `is_leave` | is_leave | 是否请假 | is_leave | 是否请假 |
| `is_abnormal` | is_abnormal | 是否异常 | is_abnormal | 是否异常记录 |
| `current_step` | current_step | 当前步骤 | current_step | 当前处理步骤 |
| `reviewer` | reviewer | 复核人 | reviewer | 巡演统筹复核人 |
| `review_time` | review_time | 复核时间 | review_time | 复核时间 |
| `review_conclusion` | review_conclusion | 复核结论 | review_conclusion | 复核结论说明 |
| `export_status` | export_status | 导出状态 | export_status | 导出明细状态 |
| `export_time` | export_time | 导出时间 | export_time | 导出时间 |
| `export_operator` | export_operator | 导出人 | export_operator | 导出操作人 |
| `export_note` | export_note | 导出备注 | export_note | 导出备注说明 |
| `source_count` | source_count | 证据来源数 | source_count | 证据来源数量 |
| `has_edits` | has_edits | 有无人为改动 | has_edits | 是否有过人工改动 |
| `manual_edit_count` | manual_edit_count | 人工改动次数 | manual_edit_count | 人工改动次数 |

## 核心流程

### Step 1: 调音师留言导入
- 输入：调音师留言文本（竖线分隔格式）
- 输出：创建排期记录，状态 = 待处理
- 证据：记录每一行的原始行号、原始内容

**格式示例：**
```
EP01|片头开场音乐|2026-06-10|14:00|30|李调音师|已消耗
EP02|过渡音效|2026-06-11|15:30|15|王调音师
```

### Step 2: 录音师小段补看排练群接龙
- 输入：记录ID + 群接龙文本
- 行为：
  - 解析接龙中的请假信息
  - 与导入数据比对
  - **发现请假课时被算进已消耗 → 标记为「待统筹复核」，不自动归正常**
- 证据：接龙原文作为第二个来源追加

### Step 3: 曲目核对表更新
- 输入：记录ID + 曲目核对信息
- 行为：
  - 更新曲目名称、时长等信息
  - 正常状态 → 推进为「正常」
  - **待复核状态 → 保持不变，不自动清除异常**

### Step 4: 导出明细
- 输入：导出格式 + 操作人 + 备注
- 输出：CSV/JSON 文件
- **关键修复**：
  - 导出元数据（谁导出的、什么时候导出的、导出结论）写入单一数据源
  - 导出的明细包含来源、处理状态、结论在同一份结果
  - 重启/重载后导出状态不丢失
  - 页面/接口能立即读到导出状态

### Step 5: 临时补材料/人工补录
- 输入：记录ID + 修正内容 + 操作人 + 备注
- **关键修复**：
  - 补录后明细、历史、后续结果都读到同一条更新
  - 必须追加来源证据（作为 SourceLine）
  - 必须记录审计日志
  - 如果是请假课时异常，补录后仍保持待复核状态

## 边界规则（Boundary Rules）

### 规则1: 请假课时被算进已消耗
**代码位置**：[BoundaryRules.check_leave_counted_as_consumed](file:///Users/lzy/pro/solo/workspaces/zy72416/core/processor.py#L29-L44)

**判定条件**：
- `is_leave = True`（标记为请假）
- 且 `consumed = True`（标记为已消耗）

**处理结果**：
- 状态 = `REVIEW_REQUIRED`（待统筹复核）
- 异常类型 = `LEAVE_COUNTED_AS_CONSUMED`
- **禁止自动归为正常**，必须由巡演统筹人工复核
- **即使人工补录了其他字段，此状态也不自动清除**

**复核选项**：
- 复核通过 → 状态 = `REVIEW_APPROVED`，保留 consumed 标记
- 复核驳回 → 状态 = `REVIEW_REJECTED`，自动取消 consumed 标记

### 规则2: 多来源数据不一致
**代码位置**：[BoundaryRules.check_source_mismatch](file:///Users/lzy/pro/solo/workspaces/zy72416/core/processor.py#L46-L65)

**判定条件**：
- 同一记录有多个来源
- 不同来源的关键字段（日期、时间、时长、曲目名）不一致
- 只比对两个来源都存在的字段，某来源缺失的字段跳过

**处理结果**：
- 状态 = `ABNORMAL`（异常）
- 异常类型 = `MISMATCH_BETWEEN_SOURCES`

### 规则3: 人工补录同步
**代码位置**：[SingleSourceOfTruth.supplementary_correction](file:///Users/lzy/pro/solo/workspaces/zy72416/core/single_source.py#L146-L197)

**要求**：
- 补录必须调用统一的 `supplementary_correction` 方法
- 补录后明细、历史、后续结果都读到同一条更新
- 必须追加来源证据（SourceLine）
- 必须记录审计日志
- 不能直接修改原始数据

### 规则4: 回滚完整性
**代码位置**：[ScheduleProcessor.rollback](file:///Users/lzy/pro/solo/workspaces/zy72416/core/processor.py#L332-L390)

**要求**：
- 必须有历史记录才能回滚
- 回滚不能只改当前状态，必须同步更新导出状态
- 回滚后导出元数据的 `exported` 标记重置为 `False`
- 临时补材料的回滚也要回到同一份可解释结果

### 规则5: 导出状态持久化
**代码位置**：[ExportService._update_export_meta](file:///Users/lzy/pro/solo/workspaces/zy72416/core/export.py#L142-L169)

**要求**：
- 导出元数据必须写入单一数据源
- 重启/重载后导出状态不丢失
- 页面/接口/导出都能读到同一份导出状态
- 回滚时导出状态同步更新

## 状态流转

```
PENDING (待处理)
    ↓ Step 3 正常
NORMAL (正常)
    ↓ 发现异常
ABNORMAL (异常)
    ↓ 请假课时被算进已消耗
REVIEW_REQUIRED (待统筹复核)
    ├─→ 复核通过 → REVIEW_APPROVED (复核通过)
    └─→ 复核驳回 → REVIEW_REJECTED (复核驳回)
    
任意状态 ← 回滚 → ROLLED_BACK (已回滚)
    ↓ 回滚时同步更新
ExportMeta.exported = False
```

## 数据一致性保证

### 三个视图，一份数据
| 视图 | 读取方法 | 字段映射 |
|------|----------|----------|
| 页面展示 | `source.get_for_display()` | FieldMapping.display |
| 导出明细 | `source.get_for_export()` | FieldMapping.export |
| 接口返回 | `source.get_for_api()` | FieldMapping.api |

**所有视图都从 `SingleSourceOfTruth` 读取，不做独立计算。**

### 一致性验证
调用 `source.verify_consistency()` 可验证：
- 三个视图的记录总数一致
- 三个视图的异常记录数一致
- 返回详细的一致性检查报告

## 项目结构

```
core/
├── __init__.py          # 模块导出
├── models.py            # 数据模型 + FieldMapping 统一字段
├── single_source.py     # 单一数据源（核心）
├── processor.py         # 流程处理器 + 边界规则引擎
├── view.py              # 页面展示层
├── export.py            # 导出服务（元数据写回数据源）
└── api.py               # API接口层
```

## 关键修复点（针对反馈的问题）

### 1. 重启/重载后页面与导出链路不可用
**原因**：原 `_load` 方法没有正确处理 `review_time` 等 datetime 字段的类型转换
**修复**：
- 新增 `ScheduleRecord.from_dict()` 方法，统一处理所有类型转换
- 新增 `ExportMeta.from_dict()` 方法，确保导出元数据正确加载
- 加载失败时记录警告但不中断，保证部分可用

### 2. 导出明细需要人工补录后不同步
**原因**：原导出操作只生成文件，没有更新单一数据源
**修复**：
- 新增 `ExportMeta` 数据模型，记录导出的所有元数据
- 每次导出后调用 `source.update_export_meta()` 写回数据源
- 补录操作使用 `source.supplementary_correction()` 统一入口

### 3. 页面说成功但接口读不到
**原因**：页面和接口使用不同的字段定义和计算逻辑
**修复**：
- 新增 `FieldMapping` 统一所有业务字段
- 三个视图共享 `_get_common_fields()` 计算逻辑
- 所有更新操作走统一入口，更新后自动持久化

### 4. 回滚只改当前状态
**原因**：原回滚逻辑只恢复业务字段，没有处理导出状态
**修复**：
- 回滚时同步设置 `ExportMeta.exported = False`
- 记录回滚原因到导出备注
- 回滚后所有视图立即读到更新后的状态

## 使用示例

```python
from core import (
    SingleSourceOfTruth,
    ScheduleProcessor,
    ExportService,
    DisplayView,
    ApiService,
)

# 初始化
source = SingleSourceOfTruth("data/schedule_records.json")
processor = ScheduleProcessor(source)
export_service = ExportService(source)
view = DisplayView(source)
api = ApiService(source)

# Step 1: 导入调音师留言
messages = [
    "EP01|片头开场音乐|2026-06-10|14:00|30|李调音师|已消耗",
    "EP02|过渡音效|2026-06-11|15:30|15|王调音师",
]
records = processor.step1_import_engineer_messages(messages, "系统导入")

# Step 2: 核对排练群接龙（发现请假但已标记消耗）
record = processor.step2_check_group_signup(
    records[0].id,
    "小段请假，今天不来排练",
    "录音师小段"
)
# 此时 record.status = REVIEW_REQUIRED，不会自动归正常

# Step 3: 曲目核对表更新
record = processor.step3_update_tracklist(
    record.id,
    {"track_name": "片头开场音乐v2", "duration_minutes": 35},
    "曲目编辑"
)
# 待复核状态保持不变

# 临时补材料（明细、历史、后续读同一条更新）
record = processor.supplementary_correction(
    record.id,
    "录音师小段",
    {"duration_minutes": 32},
    "现场确认时长改为32分钟"
)

# 导出明细（元数据写入数据源，重启后不丢失）
export_service.export_to_csv(
    "data/export.csv",
    operator="导出员小李",
    note="每日导出"
)

# 验证一致性
consistency = source.verify_consistency()
print(f"数据一致: {consistency['consistent']}")
print(f"总数一致: {consistency['total_match']}")
print(f"异常数一致: {consistency['abnormal_match']}")

# 模拟重启
source.reload()

# 重启后验证导出状态仍然存在
export_status = export_service.get_export_status_summary()
print(f"重启后已导出数: {export_status['exported_count']}")

# 巡演统筹复核
record = processor.coordinator_review(
    record.id,
    approved=False,
    reviewer="巡演统筹老王",
    note="确认是请假，取消消耗标记"
)

# 回滚（同步更新导出状态）
record = processor.rollback(
    record.id,
    operator="管理员",
    reason="误操作，需要回到复核前状态"
)
```
