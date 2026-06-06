# 播客片头音乐排期系统

## 核心原则

1. **单一数据源**：页面展示、导出明细、接口返回，读取同一份数据，绝不各自计算
2. **证据链完整**：调音师留言的原始行号、人工改动、处理状态，全程留痕可追溯
3. **异常不自动归一**：请假课时被算进已消耗等异常，留给巡演统筹复核，不自动归正常
4. **边界规则固化**：所有判定逻辑写在代码里，不只靠口头约定

## 三步核心流程

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

## 边界规则（Boundary Rules）

### 规则1: 请假课时被算进已消耗
**判定条件**：
- `is_leave = True`（标记为请假）
- 且 `consumed = True`（标记为已消耗）

**处理结果**：
- 状态 = `REVIEW_REQUIRED`（待统筹复核）
- 异常类型 = `LEAVE_COUNTED_AS_CONSUMED`
- **禁止自动归为正常**，必须由巡演统筹人工复核

**复核选项**：
- 复核通过：状态变为 `REVIEW_APPROVED`，保留 consumed 标记
- 复核驳回：状态变为 `REVIEW_REJECTED`，自动取消 consumed 标记

### 规则2: 多来源数据不一致
**判定条件**：
- 同一记录有多个来源（调音师留言、群接龙、核对表等）
- 关键字段（日期、时间、时长、曲目名）不一致

**处理结果**：
- 状态 = `ABNORMAL`（异常）
- 异常类型 = `MISMATCH_BETWEEN_SOURCES`

### 规则3: 人工改动留痕
**要求**：
- 任何字段的人工修改，都记录 `manual_edits`
- 记录修改时间、修改的字段、前后值
- 通过 `audit_logs` 保留完整操作历史

### 规则4: 回滚可追溯
**回滚条件**：
- 状态不是 PENDING
- 存在至少一条审计日志

**回滚行为**：
- 状态变为 `ROLLED_BACK`
- 恢复到上一个状态的字段值
- 记录回滚操作人和原因

## 数据一致性保证

### 三个视图，一份数据
| 视图 | 读取方法 | 说明 |
|------|----------|------|
| 页面展示 | `source.get_for_display()` | 格式化展示字段 |
| 导出明细 | `source.get_for_export()` | 导出专用字段名 |
| 接口返回 | `source.get_for_api()` | 完整原始数据 |

**所有视图都从 `SingleSourceOfTruth` 读取，不做独立计算。**

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
```

## 项目结构

```
core/
├── __init__.py          # 模块导出
├── models.py            # 数据模型定义
├── single_source.py     # 单一数据源（核心）
├── processor.py         # 流程处理器 + 边界规则
├── view.py              # 页面展示层
├── export.py            # 导出服务
└── api.py               # API接口层
```

## 使用示例

```python
from core import SingleSourceOfTruth, ScheduleProcessor

# 初始化
source = SingleSourceOfTruth("data/schedule.json")
processor = ScheduleProcessor(source)

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

# 巡演统筹复核
record = processor.coordinator_review(
    record.id,
    approved=False,
    reviewer="巡演统筹老王",
    note="确认是请假，取消消耗标记"
)
```
