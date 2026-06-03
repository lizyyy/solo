# 时间序列异常分解系统

## 核心设计原则

**数据一致性优先**：导出明细、页面展示、API接口读同一份结果，杜绝"一个地方显示异常、另一个地方消失"的问题。

**可复盘、可重跑**：留下完整审计追踪，而不是只给一个汇总数。提供命令行工具，一键重新运行。

**边界规则文档化**：所有特殊情况（如分母为0填空字符串）的判定、修改、回滚方式，都写在代码和文档里，不依赖口头约定。

---

## 三步工作流程

```
旧公式截图导入 → 数据分析师小祁补看老师批注 → 课堂演示结果更新
     ↓                    ↓                              ↓
  标记行号           进入待复核                    最终确认
  保存截图引用       分母为0空字符串不自动归正常     保留复核痕迹
```

### 步骤1：旧公式截图第一次导入
- 记录**原始行号**（对应旧公式截图位置）
- 记录**截图引用**（如 `screenshot_003`）
- 自动识别边界案例，标记但不处理
- 状态：`imported`

### 步骤2：数据分析师小祁补看老师批注
- 添加**老师批注**到每条记录
- 所有记录进入 `pending_review` 状态
- **关键规则**：分母为0却被填成空字符串的记录，标记为 `pending_verification`，**不自动归为正常**，留给数据复核人

### 步骤3：课堂演示结果更新
- 数据复核人可人工修改任何字段
- 所有修改记录**审计追踪**（修改人、时间、原值、新值、原因）
- 复核完成后最终确认，状态变为 `finalized`

---

## 边界规则 (Boundary Rules)

### 1. 分母为0却被填成空字符串
**规则类型**：`zero_denominator_empty_string`

| 项目 | 内容 |
|------|------|
| **判定标准** | 原始分母值为空字符串或`'0'`，转换后分母为0或None |
| **处理方式** | 标记为 `pending_verification`（待验证），不自动归为正常，保留原始值供数据复核人审查 |
| **回滚方式** | 恢复原始分母值，重置异常类型为待验证 |
| **代码位置** | [data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L150-L156) |

**为什么这么设计？**
> 真正耗时间的不是计算，而是分母为0却被填成空字符串出现后，还要回头找旧公式截图和老师批注谁更可信。
> 所以系统**不替人做决策**，只做标记，留待复核人判断。

### 2. 分子或分母缺失
**规则类型**：`missing_value`

| 项目 | 内容 |
|------|------|
| **判定标准** | 分子或分母为None或空值 |
| **处理方式** | 标记为 `boundary_case`（边界案例），留待人工处理 |
| **回滚方式** | 恢复原始值，重置状态为已导入 |
| **代码位置** | [data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L157-L163) |

### 3. 比率超出正常阈值
**规则类型**：`outlier_threshold`

| 项目 | 内容 |
|------|------|
| **判定标准** | 比率大于2.0或小于0.5 |
| **处理方式** | 标记为 `abnormal`（异常），待复核 |
| **回滚方式** | 重新计算比率，重置异常类型 |
| **代码位置** | [data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L164-L170) |

---

## 数据结构说明

### AnomalyResult（异常分解结果）

| 字段 | 说明 |
|------|------|
| `row_number` | **原始行号**，对应旧公式截图位置，复核时可追溯 |
| `raw_denominator` | **原始分母值**，永远保留导入时的数据（包括空字符串） |
| `anomaly_type` | 异常类型：`normal`/`abnormal`/`boundary_case`/`pending_verification` |
| `process_status` | 处理状态：`imported`/`pending_review`/`reviewed`/`finalized`/`rollbacked` |
| `source_screenshot_ref` | 旧公式截图引用 |
| `teacher_comment` | 老师批注 |
| `manual_modifications` | 人工修改记录列表 |
| `boundary_rule_triggered` | 触发的边界规则类型 |
| `review_note` | 复核备注 |

**代码位置**：[data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L66-L90)

### ManualModification（人工修改记录）

| 字段 | 说明 |
|------|------|
| `modified_at` | 修改时间 |
| `modified_by` | 修改人 |
| `field_name` | 修改字段名 |
| `old_value` | 原值 |
| `new_value` | 新值 |
| `reason` | 修改原因 |

---

## 统一数据出口

所有数据都通过 `UnifiedDataExporter` 输出，确保：
- 导出的CSV/Excel明细
- 页面展示的数据
- API接口返回

都来自**同一份结果**，不会出现不一致。

**代码位置**：[data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L93-L146)

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 生成示例数据

```bash
python cli.py sample
```

### 一键运行完整流水线

```bash
python cli.py run examples/sample_input.csv examples/sample_comments.json ./output --review-json examples/sample_review.json
```

### 分步运行

```bash
# 步骤1：导入
python cli.py step1 examples/sample_input.csv

# 步骤2：添加批注
python cli.py step2 examples/sample_comments.json

# 步骤3：复核并最终确认
python cli.py step3 --review-json examples/sample_review.json
```

### 查看边界规则

```bash
python cli.py rules
```

### 查看审计历史

```bash
python cli.py audit 2
```

---

## 审计追踪

每条记录的每一次状态变更都会被记录：
- 导入记录
- 添加批注
- 人工修改
- 复核完成
- 最终确认
- 回滚

审计记录导出为 `*_audit_trail.json`，可随时回溯。

---

## 项目结构

```
.
├── README.md                    # 本文档
├── requirements.txt             # 依赖列表
├── cli.py                       # 命令行工具入口
└── src/
    ├── __init__.py
    ├── data_models.py           # 数据模型、边界规则定义
    ├── anomaly_decomposer.py    # 异常分解核心算法
    ├── audit_trail.py           # 审计追踪系统
    └── pipeline.py              # 三步流程流水线
```

---

## 关键代码位置

| 功能 | 文件 |
|------|------|
| 边界规则定义 | [data_models.py BOUNDARY_RULES](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L149-L171) |
| 分母为0空字符串检测 | [anomaly_decomposer.py _check_zero_denominator_empty_string](file:///Users/lzy/pro/solo/workspaces/zy72306/src/anomaly_decomposer.py#L21-L48) |
| 审计记录添加批注 | [audit_trail.py record_teacher_comment_added](file:///Users/lzy/pro/solo/workspaces/zy72306/src/audit_trail.py#L74-L93) |
| 三步流程定义 | [pipeline.py DecompositionPipeline](file:///Users/lzy/pro/solo/workspaces/zy72306/src/pipeline.py#L15-L294) |
| 统一数据导出 | [data_models.py UnifiedDataExporter](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L93-L146) |

---

## 设计思考

> "数据分析师小祁不是不会算'时间序列异常分解'，真正耗时间的是分母为0却被填成空字符串出现后，还要回头找旧公式截图和老师批注谁更可信。"

这个系统的核心不是"计算"，而是**记录和留存证据**：
1. 保留原始行号 → 能回溯到截图
2. 保留原始分母值 → 不丢失"空字符串"这个信息
3. 保留老师批注 → 有上下文
4. 保留人工修改记录 → 谁改了、为什么改
5. 边界案例不自动处理 → 把判断权还给人

这样，数据复核人追问时，能回到证据，而不是只看一个汇总数。
