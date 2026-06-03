# 蒙特卡洛库存波动 - 批注追踪系统

## 系统概述

本系统用于追踪老师批注的完整证据链，支持三段式追踪：
1. 老师批注来源
2. 抽样名单补录
3. 人工确认

## 边界规则 (Boundary Rules)

### 核心边界判断逻辑见 [service.py:96-106](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L96-L106)

```
阈值 (Threshold): 0.15
```

| 数值范围 | 判断结果 | 处理方式 |
|---------|---------|---------|
| value < 0.15 | normal (正常) | 自动判定，无需复核 |
| value = 0.15 | pending_teacher_review (待老师复核) | **边界值，留给任课老师复核** |
| value > 0.15 | warning (异常) | 自动判定，无需复核 |

### 边界值处理规则

1. **判断标准**: 当波动值恰好等于阈值时，使用浮点精度比较 `abs(value - threshold) < 1e-9`
2. **状态标记**: `is_boundary_case = 1` 且 `needs_teacher_review = 1`
3. **人工复核**: 必须由任课老师最终判定为 normal 或 warning
4. **回滚机制**: 支持回滚至任意历史版本

## 三段式证据链

### 阶段一：老师批注导入
- 保留原始行号 (`original_line_number`)
- 保留原始内容 (`original_content`)
- 保留批注文本 (`comment_text`)
- 记录导入批次 (`import_batch_id`)

### 阶段二：抽样名单补录
- 关联样本ID (`sample_id`)
- 记录补录人员 (`supplementary_operator`)
- 记录补录时间 (`supplementary_at`)
- 补录备注 (`supplementary_note`)

### 阶段三：人工确认
- 实验助理备注修改（保留历史版本）
- 任课老师复核结论
- 完整变更历史记录

## 防重复导入机制

见 [service.py:37-46](file:///Users/lzy/pro/solo/workspaces/zy72305/service.py#L37-L46)

通过以下组合判断重复：
- `source_file` (来源文件)
- `original_line_number` (原始行号)
- `comment_text` (批注文本)

重复导入时自动跳过，不会导致数量翻倍。

## 历史版本对比

每条记录的所有修改都保存在 `change_history` 表中，包括：
- 修改前值 (`old_value`)
- 修改后值 (`new_value`)
- 操作人 (`operator`)
- 操作类型 (`operation_type`)
- 操作时间 (`operated_at`)

## 数据库表结构

1. **teacher_comments** - 老师批注原始数据
2. **sampling_list** - 抽样名单补录
3. **processing_records** - 处理记录
4. **change_history** - 变更历史
5. **import_batches** - 导入批次
6. **boundary_rules** - 边界规则配置

## 使用示例

### 初始化数据库

```python
from models import init_db
init_db()
```

### 导入老师批注

```python
from service import import_teacher_comments

comments = [
    {
        'line_number': 42,
        'original_content': '库存波动率: 0.12',
        'comment_text': '波动率在正常范围内',
        'boundary_value': 0.12
    }
]

batch_id, count, skipped = import_teacher_comments(
    comments, 
    '蒙特卡洛库存波动.docx',
    '实验助理小穆'
)
```

### 补录抽样名单

```python
from service import supplementary_sampling_list

samples = [
    {
        'sample_id': 'S001',
        'sample_name': 'A商品抽样',
        'comment_id': 1,
        'supplementary_note': '对照群内补录'
    }
]

count, messages = supplementary_sampling_list(samples, '实验助理小穆')
```

### 查看完整证据链

```python
from service import get_complete_trace, get_record_history_diff

trace = get_complete_trace(record_id=1)
history = get_record_history_diff(record_id=1)
```

## 状态说明

| 状态 | 说明 |
|-----|-----|
| pending | 待处理 |
| normal | 正常（波动率 < 阈值） |
| warning | 异常（波动率 > 阈值） |
| pending_teacher_review | 待老师复核（波动率 = 阈值） |
