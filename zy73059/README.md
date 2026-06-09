# 电梯故障异常归因

一个让**交接不漏信息、导出不和屏幕分家、坏材料来了知道先看哪里**的轻量归因系统。

---

## 两三步操作

### Step 1 · 跑一遍样例

```bash
python run_demo.py
```

脚本会按序打印：汇总 → 链路追踪 → 导出 → 交接报告 → 坏材料排查路径。
每一步输出的 JSON 就是**真实接口返回**，可以直接对字段。

### Step 2 · 坏材料来了先看哪里

1. **看 BLOCKED 列表**：`api.bad_material_triage()["blocked"]`
   - `block_reason` 告诉你为什么被拦（采样断档 / 撤回没填说明）
   - `block_detail` 写明具体哪一段日志出了问题
   - 点 `detail_link` → 调用 `api.fault_detail(fault_id)` 下钻
2. **看撤回日志**：`api.bad_material_triage()["with_revoked"]`
   - 核对 `revoke_note` 是否填了充分的撤回理由，空的先补
3. **看低置信度**：`api.bad_material_triage()["low_confidence"]`
   - 置信度 < 0.6 的已归因记录，最后复核

### Step 3 · 交接时写什么（短版）

```python
report = api.handover_report(since_ts="2026-06-09 00:00:00", operator="algo_zhang")
print(report["handover_text"])   # 这段直接贴群
```

- `handover_text`：三行内的交接摘要
- `changes[]`：每条变更都有 `before / after / change_note`，上一班改了什么一眼可见

---

## 核心接口速查

| 要做的事 | 调什么 | 关键字段 |
|---|---|---|
| 首页汇总（和屏幕一致） | `api.summary(criteria)` | `filter_criteria`、`summary_stats`、`records[]` |
| 列表/分页 | `api.list_faults(criteria, page, page_size)` | 同上 + `pagination` |
| 一路追到异常 | `api.fault_detail(fault_id)` | `trace.chains[]` → summary → detail → raw_logs → changes |
| 导出（口径在返回里） | `api.export(criteria)` | `filter_criteria`、`records[]`、`summary_stats.blocked_detail` |
| 执行归因 | `api.do_attribution(fault_id, root_cause, operator)` | 若 `blocked=true`，看 `block_reason` + `block_detail` |
| 撤回传感器日志 | `api.do_revoke_log(fault_id, log_id, operator, revoke_note)` | `revoke_note` 必须填，否则下次归因会被拦 |
| 生成交接文字 | `api.handover_report(since_ts, operator)` | `handover_text` 直接贴群 |
| 坏材料三步排障 | `api.bad_material_triage()` | `blocked` → `with_revoked` → `low_confidence` |

> **关键保证**：`summary / list_faults / export` 三者**共用一套 FilterCriteria**，且每次返回都会把本次 `filter_criteria` 带回来——导出数字和屏幕数字永远同源，不会分家。

---

## 为什么会被拦？归因前的两道硬卡

| 拦截原因 | 触发条件 | block_detail 怎么说 |
|---|---|---|
| **采样断档** | 有效传感器日志相邻时间差 > 120 秒 | 列出具体哪两条日志之间断了多少秒，让你知道补哪一段 |
| **存在待确认撤回** | 日志 `is_revoked=true` 且 `revoke_note=""` | 列出具体哪些日志没填撤回说明，补齐再归因 |

- 两条都过 → 正常归因，生成归因链路 `chain_id`
- 被拦住了 → `block_reason` + `block_detail` 说清楚为什么
- 一定要强上 → `do_attribution(..., force=True)` 跳过拦截（记得写 change_note）

---

## 目录结构

```
elevator_attribution/
  models.py       # 数据模型：FaultRecord / SensorLog / AuditLog / AttributionChain 等
  processor.py    # 核心逻辑：断档检测、变动审计、归因流程、链路构建、导出
  sample_data.py  # 样例：标准行 + 撤回记录 + 采样断档 + 待确认撤回 + PENDING
  api.py          # 对外接口层（汇总/列表/详情/导出/交接/坏材料排查）
run_demo.py       # 一键跑通样例
```
