# 插值曲线仪表修补系统

## 启动

```bash
pip3 install -r requirements.txt
python3 -m uvicorn interpolation_gauge.main:app --reload --port 8000
```

打开 `http://localhost:8000/docs` 查看交互式 API 文档。

---

## 三步复核流程

| 步骤 | 名称 | 操作 | 接口 |
|------|------|------|------|
| 1 | 评分权重表导入 | 上传评分权重表，系统自动执行插值计算和边界值判定 | `POST /api/interpolation-gauge/import` |
| 2 | 旧公式截图补看 | 数据分析师小祁对照旧公式截图，在修补记录中留下截图引用和备注 | `POST /api/interpolation-gauge/review-old-formula` |
| 3 | 反例列表更新 | 更新反例列表；如该行边界值等于阈值，留待任课老师复核 | `POST /api/interpolation-gauge/update-counterexample` |

### 阶段推进规则（链路稳定关键）

- **只按 1→2→3 顺序推进，不可跳步**。所有接口都有阶段校验。
- **阶段推进操作**（`review-old-formula`、`update-counterexample`）：必须按顺序，`target_idx == current_idx + 1` 或 `target_idx == current_idx`（允许重复执行同一阶段）。
- **修改操作**（`manual-override`、`quick-fix`、`rollback`、`boundary-review`、`export`）：要求当前批次阶段 >= 目标依赖阶段。
- **跳步拦截**：导入后直接调用 `update-counterexample` 或 `manual-override` 会返回 HTTP 400，错误信息包含明确提示。
- **只有批次内所有行都完成当前阶段，整个批次阶段才推进**（任意一行没做完都不推进）。
- 第 1 步执行完批次进入 `weight_table_imported`；所有行都做完第 2 步 → 进入 `old_formula_reviewed`；所有行都做完第 3 步 → 进入 `counterexample_updated`。
- 流程状态通过 `GET /api/interpolation-gauge/workflow/{batch_id}` 查询。
- 阶段校验逻辑见 `interpolation_gauge/services/repair_service.py` 中的 `_check_phase_allowed()`。
- 步骤推进逻辑见 `interpolation_gauge/services/repair_service.py` 中的 `_determine_phase_after_action()`。

### 跳步拦截错误码

| 错误场景 | HTTP 状态码 | 错误提示示例 |
|----------|------------|--------------|
| 导入后直接调 `update-counterexample` | 400 | 禁止跳步！当前批次阶段为「第一步：评分权重表导入」，不能直接执行「第三步：反例列表更新」。请先完成「第一步：评分权重表导入」 |
| 导入后直接调 `manual-override` | 400 | 禁止跳步修改！当前批次阶段为「第一步：评分权重表导入」，必须先完成「第二步：补看旧公式截图」才能执行此修改操作。 |

---

## 边界值规则（代码 + 文档双重约定，修改同步）

### 判定规则

边界值判定函数位于 `interpolation_gauge/services/interpolation.py` 中的 `judge_boundary()`。

| 条件 | 判定结果 | 处理方式 |
|------|----------|----------|
| `value < threshold` | `below_threshold` | 正常，低于阈值 |
| `value > threshold` | `above_threshold` | 正常，高于阈值 |
| `|value - threshold| ≤ 1e-9` | `equal_threshold` | **边界值等于阈值，不得自动归为 ABOVE 或 BELOW** |

### 等于阈值时的处理

**核心原则：不急着归正常，留给任课老师复核。**

1. **判定阶段**：当 `|value - threshold| ≤ 1e-9` 时，`boundary_judgment` 设为 `equal_threshold`，`processing_status` 设为 `boundary_pending_review`，`next_action_owner` 标记为 `instructor`（下一步找任课老师）。
2. **修补阶段**：所有修补操作（人工改动、快捷修补、反例更新）遇到 `equal_threshold` 的行，均保持 `boundary_pending_review`、`instructor_reviewed=False`，不会自动改为 `confirmed`。
3. **复核阶段**：只有任课老师通过 `POST /api/interpolation-gauge/boundary-review` 明确确认后，才能从 `boundary_pending_review` 转为 `confirmed`。
4. **任课老师拒绝**：如任课老师判定不应归正常，状态转回 `reviewing`，`next_action_owner` 回到 `analyst_qi`（数据分析师继续处理）。

### 修改 / 改值重算规则

- 修改 `original_value` 或 `threshold` **会同时触发三件事**：
  1. 重算 `boundary_judgment`（边界判定）
  2. 重算 `interpolated_value`（分段线性插值）
  3. 根据最新边界判定重设 `processing_status`（改回等于阈值 → 再次 `boundary_pending_review`）
- 所有改动同时写入两张表，**两张表都带 before/after 快照**：
  - `audit_trails`：字段级旧值 → 新值 + 原因 + 操作人
  - `repair_records`：`original_value_before/after` + `interpolated_value_before/after` + `threshold_before/after` + 断点 + 下一步找谁
- 每次改动后自动刷新 `WorkflowState` 的计数：`boundary_equal_threshold_count`、`wrong_caliber_count`、`supplementary_rework_count`。
- 改值重算统一入口：`interpolation_gauge/services/repair_service.py` 中的 `_recompute_value_and_status()`。

### 回滚规则

- 通过 `POST /api/interpolation-gauge/rollback` 回滚，行状态变为 `rolled_back`。
- 回滚原因同时写入审计轨迹和修补记录的 `rollback_reason`。
- 回滚后可再次人工改动或快捷修补重新处理。
- 回滚不会改动该条的历史修补记录（保留完整证据链）。

---

## 单数据源保证（消除"一个地方异常、另一个地方消失"）

**所有读取（列表 / 详情 / 摘要 / 边界待复核 / 导出）最终都从 `ScoringWeightRow` + `AuditTrail` + `RepairRecord` 三张表组装**，且计数一致刷新。

| 视图 | 接口 | 读同一份数据 |
|------|------|------------|
| 单行详情（页面展示/接口返回） | `GET /api/interpolation-gauge/detail/{row_id}` | `get_export_detail()` |
| 批次导出明细（报告/CSV） | `GET /api/interpolation-gauge/batch/{import_batch_id}` | 逐行调用 `get_export_detail()` |
| 批次摘要（列表页/仪表板） | `GET /api/interpolation-gauge/batch-summary/{import_batch_id}` | 读同三张表 + 实时重算计数 |
| 工作流状态 | `GET /api/interpolation-gauge/workflow/{import_batch_id}` | `_refresh_workflow_counts()` 实时重算 |
| 待复核边界列表 | `GET /api/interpolation-gauge/boundary-pending/{import_batch_id}` | `ScoringWeightRow` 按状态过滤 |

`ExportDetailResponse` 统一返回：
- `row`: 当前行（原始行号、指标名、阈值、权重、原始值、插值、边界判定、状态、错误类型）
- `audit_trails`: 全部字段级修改轨迹
- `repair_records`: 全部 before/after 快照（含截图、反例、原因、下一步找谁）

---

## 修补记录证据链

`RepairRecord` 每条记录包含改值前后完整快照（任课老师追问时能回到证据，不靠汇总数）：

| 字段 | 说明 |
|------|------|
| `original_value_before / after` | 改值前后原始值（能看到临时补材料时怎么改的） |
| `interpolated_value_before / after` | 改值前后插值结果（能看到插值是否同步重算） |
| `threshold_before / after` | 改值前后阈值（阈值改了也留痕） |
| `interpolated_curve_data` | 本次用的插值断点（证据） |
| `action_type` | 本次动作类型（import / old_formula_review / counterexample_update / manual_override:original_value / quick_fix_* / boundary_instructor_review / rollback） |
| `change_reason` | 本次处理原因（原始说法保留） |
| `changed_by` | 本次操作人（system / analyst_qi / instructor） |
| `next_action_owner` | 下一步该找谁（analyst_qi / instructor / 无） |
| `instructor_reviewed` | 生成这条记录时任课老师是否已复核（保留当时状态，不被后续复核覆盖） |
| `old_formula_screenshot_ref` | 旧公式截图引用 |
| `counterexample_note` | 反例备注 |
| `rollback_reason` | 回滚原因 |
| `original_row_number`（通过关联） | 评分权重表原始行号 |
| `phase` | 流程阶段 |

任课老师追问时用 `GET /api/interpolation-gauge/detail/{row_id}`，**`repair_records` 按时间升序打印就是完整证据链**。

---

## 审计轨迹

每条 `AuditTrail` 记录字段级改动：

| 字段 | 说明 |
|------|------|
| `original_row_number` | 评分权重表原始行号 |
| `field_name` | 修改的字段名 |
| `old_value` / `new_value` | 改值前后值（原始说法保留） |
| `change_reason` | 修改原因 |
| `changed_by` | 操作人 |
| `changed_at` | 操作时间 |

---

## 常见错误快捷修补

| 类型 | 说明 | 接口 |
|------|------|------|
| 错口径 (wrong_caliber) | 原始数据录入使用了错误口径 | `POST /api/interpolation-gauge/quick-fix`，`error_type=wrong_caliber` |
| 补录返工 (supplementary_rework) | 临时补录的数据需要返工修正 | `POST /api/interpolation-gauge/quick-fix`，`error_type=supplementary_rework` |

快捷修补会：
1. 更新 `original_value`（如提供 `fix_value`）
2. 重算边界判定 + 插值
3. 标记 `error_type`
4. 写入审计轨迹 + 带 before/after 快照的修补记录
5. 刷新批次计数

---

## 导出接口（同一份数据源）

导出接口与列表、详情、摘要读取同一份最新数据，必须先完成第三步（反例列表更新）才能导出。

| 导出格式 | 接口 | 说明 |
|---------|------|------|
| JSON | `GET /api/interpolation-gauge/export/{batch_id}/json` | 完整结构：元数据 + 摘要 + 工作流 + 所有行明细（含历史轨迹） |
| CSV | `GET /api/interpolation-gauge/export/{batch_id}/csv` | 表格格式：当前行状态 + 最新修补快照 + 末尾追加批次摘要 |

### CSV 导出字段

| 字段 | 说明 |
|------|------|
| `batch_id` | 批次ID |
| `original_row_number` | 评分权重表原始行号 |
| `indicator_name` | 指标名称 |
| `threshold` | 阈值 |
| `weight` | 权重 |
| `original_value` | 当前原始值 |
| `interpolated_value` | 当前插值结果 |
| `boundary_judgment` | 边界判定结果 |
| `processing_status` | 当前处理状态 |
| `error_type` | 错误类型 |
| `next_action_owner` | 下一步找谁（analyst_qi / instructor） |
| `instructor_reviewed` | 任课老师是否已复核（1=是/0=否） |
| `latest_repair_action` | 最新修补动作类型 |
| `latest_change_reason` | 最新处理原因 |
| `latest_repair_at` | 最新修补时间 |
| `original_value_before / after` | 最新修补前后原始值 |
| `interpolated_value_before / after` | 最新修补前后插值结果 |
| `old_formula_screenshot_ref` | 旧公式截图引用 |
| `counterexample_note` | 反例备注 |
| `rollback_reason` | 回滚原因 |
| `row_created_at / updated_at` | 行创建/更新时间 |

### 导出前置条件

- 批次必须已完成第三步（反例列表更新），否则返回 400 错误
- 导出时自动做阶段校验，防止未完成流程就导出报告

---

## 可复现验证脚本

项目提供 `reproduce_issue.py` 可一键复现完整流程，覆盖以下场景：

```bash
# 清理并重启服务
lsof -t -i :8000 | xargs kill 2>/dev/null
rm -f interpolation_gauge.db
nohup python3 -m uvicorn interpolation_gauge.main:app --host 0.0.0.0 --port 8000 > /tmp/gauge_server.log 2>&1 & disown
sleep 3

# 运行完整复现脚本
python3 reproduce_issue.py
```

脚本覆盖的 10 个场景：
1. **跳步拦截测试**：导入后直接调用反例更新 → HTTP 400 拦截
2. **跳步改值拦截**：导入后直接调用 manual_override → HTTP 400 拦截
3. **按顺序推进**：导入 → 补看截图 → 更新反例，阶段正确推进
4. **边界值等于阈值详情**：导入时识别，标记 `boundary_pending_review`，留待任课老师
5. **改值重算**：80.0 → 79.5，插值+边界判定+状态同步更新
6. **临时补材料场景**：79.5 → 80.0，再次触发边界待复核
7. **多视图一致性**：列表/详情/摘要/待复核/导出五处一致
8. **任课老师复核**：边界值确认正常，状态流转为 confirmed
9. **导出 JSON**：解析验证，与实时接口一致
10. **导出 CSV**：解析验证 24 个字段 + 末尾摘要
11. **持久化数据验证**：直接读取 SQLite 三张表核对

脚本运行完成后，所有输出保存在 `reproduction_output/` 目录。

## 处理状态流转

```
pending → reviewing → confirmed
   ↓          ↓           ↑
   → boundary_pending_review → confirmed（任课老师确认）
                    ↓
              reviewing（任课老师拒绝）
                    ↓
              rolled_back（回滚）
```

- `pending`: 刚导入，未经任何处理
- `reviewing`: 正在补看旧公式/审核中
- `boundary_pending_review`: 边界值等于阈值，等待任课老师复核（`next_action_owner=instructor`）
- `confirmed`: 已确认（正常或任课老师确认）
- `rolled_back`: 已回滚

---

## 浮点精度

使用 `FLOAT_EPSILON = 1e-9` 作为浮点比较容差。如需调整，修改 `interpolation_gauge/services/interpolation.py` 中的 `FLOAT_EPSILON` 常量。
