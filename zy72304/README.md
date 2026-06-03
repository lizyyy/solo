# 整数规划班车排班系统

## 系统简介

本系统用于根据抽样名单进行班车排班的整数规划计算。核心特点是能够处理抽样名单中**百分数和小数混合出现**的情况，并提供完整的复核、修改、回滚机制。

> ⚠️ **重要：所有边界规则均已写在代码中，不依赖口头约定。**

---

## 目录结构

```
.
├── bus_scheduling/          # 核心代码
│   ├── __init__.py
│   ├── models.py           # 数据模型
│   ├── exceptions.py       # 异常处理（人类可读错误提示）
│   ├── validator.py        # 边界校验器（判定/修改/回滚）
│   ├── importer.py         # 抽样名单导入器（去重机制）
│   ├── scheduler.py        # 排班计算器（整数规划）
│   └── workflow.py         # 工作流程管理器（三步流程）
├── test_data/              # 测试数据
│   ├── sampling_list_mixed.csv        # 含混合数的测试数据
│   ├── sampling_list_decimal_only.csv # 仅小数的测试数据
│   └── sampling_list_percentage_only.csv # 仅百分数的测试数据
├── tests/                  # 测试用例
│   ├── test_boundary_validator.py
│   ├── test_importer.py
│   └── test_workflow.py
├── requirements.txt
└── README.md               # 本文档
```

---

## 核心功能

### 1. 百分数和小数混合处理

#### 判定规则（写在代码中，不靠口头约定）

| 规则 | 说明 | 代码位置 |
|------|------|----------|
| **格式判定** | 先检查是否为百分数（带`%`号），再检查是否为小数 | [BoundaryValidator.detect_number_type](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/validator.py#L52-L97) |
| **混合判定** | 同一批次的同一字段（如`客流量`）中同时出现百分数和小数，即判定为混合 | [BoundaryValidator.check_mixed_numbers](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/validator.py#L99-L147) |
| **不自动归一化** | 发现混合情况时，**不急着归正常**，标记为`待复核`状态，留给活动负责人复核 | [SamplingImporter.import_file](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/importer.py#L173-L286) |

#### 处理流程

```
发现混合数 → 标记为 PENDING_REVIEW → 活动负责人复核 → 三种处理方式：
                ├─ 1. APPROVED（通过，保留原值）
                ├─ 2. MODIFIED（修改为新值）
                └─ 3. REJECTED（拒绝，数据作废）
```

#### 复核操作

**方法签名：**
```python
workflow.review_issue(
    issue_id: str,           # 问题ID
    approved: bool,          # 是否通过
    reviewer: str,           # 复核人
    retain_reason: str,      # 保留/修改理由（必须填写，方便后续追溯）
    modified_value: float    # 新值（当approved=False时可选）
)
```

#### 回滚机制

如果复核有误，可以回滚到待复核状态：

```python
workflow.rollback_issue(
    issue_id: str,
    operator: str,
    reason: str              # 回滚理由
)
```

**回滚规则：**
- 回滚后状态回到 `PENDING_REVIEW`
- 记录完整的变更历史，包含修改前、修改后的值
- 回滚操作本身也会被记录

---

### 2. 重复导入去重机制

#### 规则

**指纹生成规则**（写在代码中）：
使用 `线路编号 + 线路名称 + 发车时间 + 原始客流量` 生成MD5指纹作为唯一标识。

**去重逻辑：**
1. 每条记录导入时生成唯一指纹
2. 如果指纹已存在，标记 `is_duplicate = True`
3. 重复记录不参与排班计算，**不会导致数量翻倍**
4. 返回警告信息，但不抛出异常

**代码位置：** [SamplingImporter._generate_fingerprint](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/importer.py#L60-L81)

---

### 3. 历史变更追踪

所有变更都会被记录，包括：
- 导入操作
- 参数查看
- 备注修改
- 问题复核
- 回滚操作
- 计算执行

**即使只修改一条备注，历史记录中也能看出改前改后的差别：**

```python
# 修改备注
result = workflow.update_remark(
    record_id="rec_xxx",
    new_remark="新备注内容",
    operator="实验助理小穆",
    reason="修改理由"
)

# 查看历史
history = workflow.get_record_history("rec_xxx")
```

**历史记录字段：**
- `field_name`: 修改的字段名
- `old_value`: 修改前的值
- `new_value`: 修改后的值
- `operator`: 操作人
- `change_time`: 修改时间
- `change_reason`: 修改理由

---

### 4. 三步工作流程

严格按照以下顺序执行，不能跳过：

```
STEP1_IMPORT（导入抽样名单）
        ↓
STEP2_PARAM_DEBUG（参数调试 + 复核）
        ↓
STEP3_CALC_UPDATE（计算明细更新）
        ↓
COMPLETED（完成）
```

#### 第一步：导入抽样名单

**方法：** `workflow.step1_import_sampling_list(file_path, operator)`

**功能：**
- 导入CSV或Excel文件
- 检测百分数和小数混合
- 去重处理
- 生成待复核问题列表

**代码位置：** [SchedulingWorkflow.step1_import_sampling_list](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py#L105-L169)

#### 第二步：参数调试 + 复核

**方法：** `workflow.step2_review_parameters(reviewer, config_updates)`

**功能：**
- 实验助理小穆补看参数调试表
- 可以调整计算参数（车辆容量、成本等）
- 显示所有待复核问题
- **必须复核完所有混合问题后才能进入下一步**

**代码位置：** [SchedulingWorkflow.step2_review_parameters](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py#L171-L236)

#### 第三步：计算明细更新

**方法：** `workflow.step3_calculate(operator, skip_review_check=False)`

**功能：**
- 使用整数规划进行排班计算
- 生成详细的计算过程记录
- **如果还有待复核问题，默认阻止计算**

**代码位置：** [SchedulingWorkflow.step3_calculate](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py#L411-L494)

---

### 5. 计算明细下钻

**计算明细不只给总览，至少能点开一条百分数和小数混着出现，看到实验助理小穆当时保留它的理由。**

**方法：** `workflow.drilldown_detail(detail_id)`

**返回内容：**
- 详细的计算步骤（5步）
  1. 获取有效客流量
  2. 高峰时段判断
  3. 调整客流量
  4. 计算班车数量
  5. 应用边界限制
- 关联的抽样记录
- 关联的混合问题
- **保留理由**（实验助理小穆当时填写的）
- 跳转链接（返回抽样名单、返回参数调试表）

**代码位置：** [SchedulingWorkflow.drilldown_detail](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py#L496-L533)

---

### 6. 3D/图表展示的复核跳转

**如果选择3D或图表展示，先服务复核：点到一条百分数和小数混着出现时，要能回到抽样名单或参数调试表，不要只剩漂亮画面。**

**方法：** `workflow.navigate_from_chart(issue_id)`

**返回的跳转选项：**
```python
{
    "navigation_options": [
        {
            "name": "返回抽样名单",
            "url": "/sampling/list?highlight=xxx",
            "description": "查看该记录在抽样名单中的完整信息"
        },
        {
            "name": "返回参数调试表",
            "url": "/params/debug?record=xxx",
            "description": "调整该记录的计算参数"
        },
        {
            "name": "查看计算明细",
            "url": "/calculation/detail?record=xxx",
            "description": "查看该记录的完整计算过程"
        }
    ]
}
```

**代码位置：** [SchedulingWorkflow.navigate_from_chart](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py#L561-L606)

---

### 7. 人类可读错误提示

**错误提示要说人话，别只吐内部字段名。**

所有错误信息都在 [exceptions.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/exceptions.py#L49-L64) 中定义：

| 错误代码 | 人类可读提示 |
|----------|-------------|
| `mixed_number_detected` | 发现百分数和小数混合出现，请活动负责人复核后再继续 |
| `duplicate_import` | 该批次抽样名单已导入过，系统将自动跳过重复记录，不会重复计算 |
| `invalid_percentage` | 百分数格式不正确，请检查后重新导入 |
| `invalid_decimal` | 小数格式不正确，请检查后重新导入 |
| `missing_required_field` | 缺少必填字段：{field_name} |
| `workflow_step_skipped` | 请先完成上一步骤再继续 |
| `review_required` | 该数据需要活动负责人复核后才能继续 |
| `rollback_failed` | 回滚失败，请检查操作记录 |

---

## 边界规则汇总

### 数据格式规则

| 规则 | 说明 |
|------|------|
| **百分数格式** | 必须包含`%`符号，数值范围 0-100，例：`85%` |
| **小数格式** | 纯数字，数值范围 0-10000，例：`120` 或 `120.5` |
| **混合判定** | 同一字段同时出现百分数和小数 → 判定为混合 |
| **混合处理** | 自动标记为待复核，**不自动归一化**，需活动负责人复核 |

### 复核规则

| 状态 | 说明 |
|------|------|
| `PENDING_REVIEW` | 待复核，不能参与计算 |
| `APPROVED` | 复核通过，保留原值 |
| `MODIFIED` | 已修改，使用新值 |
| `REJECTED` | 已拒绝，不参与计算 |
| `ROLLED_BACK` | 已回滚，回到待复核状态 |

### 工作流规则

| 规则 | 说明 |
|------|------|
| **步骤顺序** | 必须按 导入→参数调试→计算 顺序执行 |
| **复核前置** | 所有混合问题必须复核完成后才能计算 |
| **去重规则** | 重复导入时，相同指纹的记录标记为重复，不参与计算 |
| **历史记录** | 所有操作都记录变更历史，可追溯 |

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 完整使用示例

```python
from bus_scheduling import (
    BoundaryValidator,
    SamplingImporter,
    BusScheduler,
    SchedulingWorkflow,
)

# 初始化组件
validator = BoundaryValidator()
importer = SamplingImporter(validator)
scheduler = BusScheduler(validator)
workflow = SchedulingWorkflow(validator, importer, scheduler)

# ==================== 第一步：导入抽样名单 ====================
result1 = workflow.step1_import_sampling_list(
    file_path="test_data/sampling_list_mixed.csv",
    operator="实验助理小穆",
)
print(f"第一步完成，发现 {result1['issues_found']} 条混合问题")

# ==================== 第二步：参数调试 ====================
result2 = workflow.step2_review_parameters(
    reviewer="活动负责人",
    config_updates={"bus_capacity": 50, "cost_per_bus": 600.0},
)
print(f"第二步完成，还有 {result2['pending_count']} 条待复核")

# ==================== 复核所有问题 ====================
pending_issues = workflow.get_pending_issues()
for issue in pending_issues:
    workflow.review_issue(
        issue_id=issue["issue_id"],
        approved=True,
        reviewer="活动负责人",
        retain_reason="数据正常，保留原值",
    )

# 再次检查参数调试状态
result2b = workflow.step2_review_parameters(reviewer="活动负责人")
print(f"复核完成，可以进入下一步：{result2b['can_proceed']}")

# ==================== 第三步：计算 ====================
result3 = workflow.step3_calculate(operator="实验助理小穆")
print(f"计算完成，共需要 {result3['total_buses']} 辆车")
print(f"总成本：{result3['total_cost']}")

# ==================== 下钻查看明细 ====================
first_detail = result3["drilldown_available"][0]
drilldown = workflow.drilldown_detail(first_detail["detail_id"])
print(f"保留理由：{drilldown['retain_reason']}")
print(f"计算步骤数：{len(drilldown['detail']['calculation_steps'])}")

# ==================== 查看边界规则 ====================
rules = workflow.get_boundary_rules()
print("边界规则：", rules)
```

### 运行测试

```bash
# 运行边界校验器测试
python tests/test_boundary_validator.py

# 运行导入器测试
python tests/test_importer.py

# 运行工作流程测试
python tests/test_workflow.py
```

---

## 关键代码参考

| 功能 | 文件 | 关键类/方法 |
|------|------|------------|
| 数据模型 | [models.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/models.py) | `MixedNumberIssue`, `SamplingRecord`, `ChangeHistory` |
| 边界校验 | [validator.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/validator.py) | `BoundaryValidator` |
| 导入去重 | [importer.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/importer.py) | `SamplingImporter._generate_fingerprint` |
| 排班计算 | [scheduler.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/scheduler.py) | `BusScheduler._integer_programming_optimize` |
| 工作流程 | [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/workflow.py) | `SchedulingWorkflow` |
| 错误提示 | [exceptions.py](file:///Users/lzy/pro/solo/workspaces/zy72304/bus_scheduling/exceptions.py) | `ERROR_MESSAGES`, `format_error` |

---

## 注意事项

1. **不要跳过复核**：即使赶时间，也必须由活动负责人复核混合问题后再计算
2. **保留理由必填**：复核时必须填写保留/修改理由，方便后续追溯
3. **所有规则在代码中**：如果规则需要修改，请修改代码，不要靠口头约定
4. **错误提示要转发**：系统返回的错误提示已经是人类可读的，直接展示给用户即可
5. **历史记录不删除**：所有变更历史永久保存，用于审计和追溯
