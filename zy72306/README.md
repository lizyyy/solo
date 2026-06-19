# 时间序列异常分解系统

## 核心设计原则

**数据一致性优先**：导出明细、API接口、页面展示读同一份结果（通过 `StateStore` 统一入口），杜绝"一个地方显示异常、另一个地方消失"的问题。

**可复盘、可重跑**：留下完整审计追踪，而不是只给一个汇总数。提供命令行工具和 API，一键重新运行。

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
- 支持 **CSV / Excel(.xlsx/.xls)** 多源导入，中英文列名自动识别归一
- 记录**原始行号**（对应旧公式截图位置）
- 记录**原始分母值**（永远保留空字符串/0等原始输入）
- 自动识别边界案例，标记但不处理
- 状态：`imported`

### 步骤2：数据分析师小祁补看老师批注
- 添加**老师批注**到每条记录
- 所有记录进入 `pending_review` 状态
- **关键规则**：分母为0却被填成空字符串的记录，标记为 `pending_verification`，**不自动归为正常**，留给数据复核人

### 步骤3：课堂演示结果更新
- 数据复核人可人工修改任何字段，或做人工复核
- 复核必须填写七要素：**原始说法、改后的值、处理原因、下一步找谁、复核人、时间、复核后异常类型**
- 所有修改记录**审计追踪**（修改人、时间、原值、新值、原因）
- `pending_verification` 类型的记录**不会被 finalize 自动确认**，始终留给复核人

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
| `process_status` | 处理状态：`imported`/`pending_review`/`reviewed`/`finalized`/`manual_updated` |
| `source_screenshot_ref` | 旧公式截图引用 |
| `teacher_comment` | 老师批注 |
| `manual_modifications` | 人工修改记录列表 |
| `review_records` | 复核记录列表（含7要素证据链） |
| `boundary_rule_triggered` | 触发的边界规则类型 |
| `review_note` | 复核备注 |

**代码位置**：[data_models.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L66-L90)

### ReviewRecord（复核记录 - 七要素）

每条复核记录必须包含：
- `reviewed_at` - 复核时间
- `reviewed_by` - 复核人
- `original_statement` - **原始说法**（当时的表述/截图内容）
- `corrected_value` - **改后的值**
- `review_reason` - **处理原因**
- `next_owner` - **下一步找谁/下一步动作**
- `anomaly_type_after_review` - 复核后判定的异常类型

---

## 统一数据出口

所有数据都通过 `StateStore` 统一入口读取，确保：
- CLI 命令（`list`/`detail`/`summary`/`history`）
- API 接口（`/api/list`/`/api/detail`/`/api/summary`）
- 导出文件（CSV/Excel）

都来自**同一份结果**，不会出现不一致。

**代码位置**：
- 状态存储：[state_store.py](file:///Users/lzy/pro/solo/workspaces/zy72306/src/state_store.py)
- 导出器：[data_models.py UnifiedDataExporter](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L200-L280)

---

## 快速开始

### 安装依赖

```bash
pip3 install -r requirements.txt
```

### 生成示例数据

```bash
python3 cli.py sample
```

生成的文件在 `examples/` 目录下：
- `sample_input.csv` - 标准列名 CSV
- `sample_input.xlsx` - 标准列名 Excel
- `sample_input_cn.xlsx` - **中文列名 Excel**（演示字段别名归一）
- `sample_comments.json` - 老师批注示例
- `sample_review.json` - 复核记录示例

### 一键运行完整流水线

```bash
# 使用中文列名 Excel（演示字段归一）
python3 cli.py run examples/sample_input_cn.xlsx examples/sample_comments.json \
    --review-json examples/sample_review.json \
    --workdir ./output

# 或使用标准 CSV
python3 cli.py run examples/sample_input.csv examples/sample_comments.json \
    --review-json examples/sample_review.json \
    --workdir ./output
```

### 分步运行

```bash
# 步骤1：从CSV/Excel导入（多源+字段归一）
python3 cli.py import examples/sample_input.csv --workdir ./output
python3 cli.py import examples/sample_input_cn.xlsx --workdir ./output  # 中文列名自动识别

# 步骤2：添加老师批注，进入待复核
python3 cli.py comment examples/sample_comments.json --workdir ./output

# 步骤3-复核：批量复核（需完整7要素）
python3 cli.py review-file examples/sample_review.json --workdir ./output

# 步骤3-复核：单条复核（命令行交互，需完整7要素）
python3 cli.py review-one 2 \
    --reviewed-by "数据复核人-张" \
    --original-statement "公式截图中分母格为空，老师批注说漏填了100" \
    --corrected-value 100 \
    --review-reason "根据旧公式截图 screenshot_002 和老师批注补录" \
    --next-owner "数据分析师小祁确认改后数" \
    --final-type normal \
    --workdir ./output

# 步骤3-最终确认：pending_verification 记录会被自动跳过，不提前归正常
python3 cli.py finalize --workdir ./output
```

### 查看数据

```bash
# 列表视图
python3 cli.py list --workdir ./output
python3 cli.py list --pending --workdir ./output   # 只看待验证/待复核的

# 详情视图（含完整证据链）
python3 cli.py detail 2 --workdir ./output

# 摘要视图
python3 cli.py summary --workdir ./output

# 历史记录
python3 cli.py history --workdir ./output
python3 cli.py history 2 --workdir ./output  # 只看某行的历史

# 一致性检查（验证列表/详情/摘要/导出是否来自同一份）
python3 cli.py verify --workdir ./output
python3 cli.py verify 2 --workdir ./output   # 检查指定行
```

### 人工补录/修正

```bash
# 修改行号2的分母为100，修改后自动刷新列表/详情/摘要/导出
python3 cli.py modify 2 denominator 100 \
    --reason "根据旧公式截图 screenshot_002 老师批注漏填了100补录" \
    --workdir ./output
```

### 查看边界规则

```bash
python3 cli.py rules
```

---

## API 接口（真实入口）

所有接口从同一份 `StateStore` 读取，和 CLI 命令数据完全一致。

### 启动 API 服务

```bash
python3 app.py
# 服务地址: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

### 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/list` | GET | 列表（和 `cli.py list` 同源） |
| `/api/detail/{row_number}` | GET | 详情（含完整证据链，和 `cli.py detail` 同源） |
| `/api/summary` | GET | 摘要（和 `cli.py summary` 同源） |
| `/api/history/{row_number}` | GET | 历史记录（和 `cli.py history` 同源） |
| `/api/verify` | GET | 一致性检查（和 `cli.py verify` 同源） |
| `/api/export/csv` | GET | 导出 CSV（和 CLI 导出同源） |
| `/api/export/excel` | GET | 导出 Excel（和 CLI 导出同源） |
| `/api/modify/{row_number}` | POST | 人工补录/修正（修改后自动同步所有视图） |

### 调用示例

```bash
# 列表接口
curl http://localhost:8000/api/list

# 行号2详情接口（含完整证据链）
curl http://localhost:8000/api/detail/2

# 摘要接口
curl http://localhost:8000/api/summary

# 人工补录（修改后所有视图自动同步）
curl -X POST "http://localhost:8000/api/modify/2?field_name=denominator&new_value=120&reason=API测试补录&modified_by=API测试人"
```

---

## 导出文件说明

所有导出基于同一份 `StateStore` 最新快照，格式包括：

### CSV
- `timeseries_anomaly.csv` - 标准格式
- `timeseries_anomaly_flat.csv` - 扁平化格式（复核记录展开成多行）

### Excel（4 个 Sheet）
1. **异常分解结果** - 8 条主记录，完整字段
2. **复核记录明细** - 每条复核记录一行，包含7要素
3. **人工修改审计追踪** - 每次修改一行
4. **汇总统计** - 按异常类型、处理状态、边界规则分组统计

### JSON
- `timeseries_anomaly_audit_trail.json` - 完整审计追踪

---

## 项目结构

```
.
├── README.md                    # 本文档
├── requirements.txt             # 依赖列表（含 openpyxl/fastapi/uvicorn）
├── cli.py                       # 命令行工具入口（14个命令）
├── app.py                       # FastAPI 服务入口（真实 API 接口）
├── check_state.py               # 状态检查工具
├── test_full_pipeline.py        # 完整流水线测试脚本
└── src/
    ├── __init__.py
    ├── data_models.py           # 数据模型、边界规则定义
    ├── anomaly_decomposer.py    # 异常分解核心算法、多源导入器
    ├── audit_trail.py           # 审计追踪系统（向后兼容）
    ├── state_store.py           # 统一状态存储层（真相源）
    └── pipeline.py              # 三步流程流水线
```

---

## 关键代码位置

| 功能 | 文件 |
|------|------|
| 边界规则定义 | [data_models.py BOUNDARY_RULES](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L149-L171) |
| 分母为0空字符串检测 | [anomaly_decomposer.py _check_zero_denominator_empty_string](file:///Users/lzy/pro/solo/workspaces/zy72306/src/anomaly_decomposer.py#L21-L48) |
| 统一状态存储 | [state_store.py StateStore](file:///Users/lzy/pro/solo/workspaces/zy72306/src/state_store.py) |
| 多源导入（CSV/Excel/中文列名） | [anomaly_decomposer.py MultiSourceImporter](file:///Users/lzy/pro/solo/workspaces/zy72306/src/anomaly_decomposer.py#L200-L330) |
| 去重合并（防指数级重复） | [state_store.py upsert_results](file:///Users/lzy/pro/solo/workspaces/zy72306/src/state_store.py#L108-L127) |
| 三步流程定义 | [pipeline.py DecompositionPipeline](file:///Users/lzy/pro/solo/workspaces/zy72306/src/pipeline.py) |
| 统一数据导出 | [data_models.py UnifiedDataExporter](file:///Users/lzy/pro/solo/workspaces/zy72306/src/data_models.py#L200-L280) |
| FastAPI 服务 | [app.py](file:///Users/lzy/pro/solo/workspaces/zy72306/app.py) |

---

## 完整验证方式（一键复现）

运行测试脚本，覆盖全流程验证：

```bash
python3 test_full_pipeline.py
```

测试覆盖：
1. 安装依赖检查
2. 示例数据生成
3. CSV 导入 + 一致性检查
4. 中文 Excel 导入 + 字段归一验证
5. 行号2 分母补录 + 验证只产生1条修改记录（不会被放大成8条）
6. 加批注 + 复核 + finalize + 验证3条复核记录不变
7. pending_verification 记录（行号6）不被 finalize 自动确认
8. CLI 全视图（list/detail/summary/history/verify）数据一致
9. API 接口（list/detail/summary）与 CLI 数据一致
10. 导出文件（CSV/Excel）与 StateStore 数据一致

---

## 设计思考

> "数据分析师小祁不是不会算'时间序列异常分解'，真正耗时间的是分母为0却被填成空字符串出现后，还要回头找旧公式截图和老师批注谁更可信。"

这个系统的核心不是"计算"，而是**记录和留存证据**：
1. 保留原始行号 → 能回溯到截图
2. 保留原始分母值 → 不丢失"空字符串"这个信息
3. 保留老师批注 → 有上下文
4. 保留人工修改记录 → 谁改了、为什么改
5. 保留完整复核七要素 → 原始说法/改后值/原因/下一步找谁
6. 边界案例不自动处理 → 把判断权还给人

这样，数据复核人追问时，能回到证据，而不是只看一个汇总数。
