# 跨境汇款合规抽检系统

Cross-Border Remittance Compliance Spot Check System

## 项目概述

本系统将"跨境汇款合规抽检"从除权日截图和税费率备注的临时拼接中解耦出来，
形成独立、可追溯、可复核的合规抽检流程。

> **核心设计原则**：边界规则写在代码和 README 里，不靠口头约定。

---

## 目录结构

```
cross_border_compliance/
├── __init__.py          # 包初始化
├── database.py          # 数据库连接和会话管理
├── models.py            # 核心数据模型（7张表）
├── boundary_rules.py    # 边界规则引擎（判定/修改/回滚/复核）
├── services.py          # 核心业务服务（导入/三步流程/审计）
└── cli.py               # 命令行接口
test_data/               # 测试数据
tests/                   # 集成测试
compliance.db            # SQLite数据库（运行后生成）
```

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python -m cross_border_compliance.cli init
```

### 3. 运行完整流程示例

```bash
# 第一步：导入除权日截图
python -m cross_border_compliance.cli import-screenshots \
  --source-file "/data/screenshots_20260603.png" \
  --data-file test_data/screenshots_20260603.json \
  --operator assistant_zhou

# 第二步：补看税费率备注（假设返回的spot-check-id是1）
python -m cross_border_compliance.cli add-remark \
  --spot-check-id 1 \
  --institution-name "摩根大通银行" \
  --remark-content "跨境汇款税率10%，需补缴差额" \
  --tax-rate "10%" \
  --tax-type "withholding" \
  --operator assistant_zhou

# 第三步：补录记录更新
python -m cross_border_compliance.cli update-record \
  --spot-check-id 1 \
  --check-result "合规，已按10%税率补缴" \
  --operator assistant_zhou
```

### 4. 运行测试

```bash
python -m pytest tests/test_integration.py -v
```

---

## 一、边界规则（代码化，不靠口头约定）

### 1.1 机构简称不一致判定规则

所有规则定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L82-L123)

| 规则 | 判定条件 | 结果 |
|------|----------|------|
| **规则1：空值判定** | 任意一方为 `None` 或空字符串 | ❌ 不一致，留待复核 |
| **规则2：精确匹配** | 去除首尾空白后完全相同（不区分大小写，区分中英文） | ✅ 一致 |
| **规则3：别名映射匹配** | 两个名称映射到同一个 `standard_name`（别名必须 `is_active=True`） | ✅ 一致 |
| **规则4：相似度判定** | 编辑距离相似度 < 80% | ❌ 不一致 + 相似度提示，留待复核 |

**代码实现**：
```python
# 位于 boundary_rules.py check_institution_name_consistency()
# 1. 空值判定
if not name_from_screenshot or not name_from_remark:
    return False, "机构名称为空，留待财务复核"
# 2. 精确匹配
if norm_screenshot == norm_remark:
    return True, "精确匹配一致"
# 3. 别名映射匹配
if std_screenshot and std_remark and std_screenshot == std_remark:
    return True, f"通过别名映射一致，标准名称: {std_screenshot}"
# 4. 相似度判定（仅提示，不自动一致）
return False, f"相似度{similarity:.0%}，留待财务复核确认"
```

### 1.2 修改规则

定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L180-L237)

| 规则 | 说明 |
|------|------|
| **规则1：修改留痕** | 每次修改必须记录 `change_history`，必须填写 `change_reason` |
| **规则2：修改权限** | assistant 只能修改 remark 相关字段，reviewer 可以修改机构名和状态 |
| **规则3：修改后状态** | 修改机构名后自动变为 `review_required`，必须重新复核 |

### 1.3 回滚规则

定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L278-L326)

| 规则 | 说明 |
|------|------|
| **规则1：可回滚范围** | 所有 `update` 操作均可回滚，`create` 操作可回滚为 `delete` |
| **规则2：回滚命令** | 每次操作自动生成 `rollback_command`，可直接执行回滚 |
| **规则3：回滚后状态** | 回滚本身也记录为一条 `change_history`（action=rollback），不删除原历史记录 |

**回滚命令示例**：
```bash
python -m cross_border_compliance.cli rollback --change-id 5 --operator assistant_zhou
```

### 1.4 机构简称不一致怎么判、怎么改、怎么回滚

**怎么判**：
- 导入时自动检测除权日截图和税费率备注中的机构名
- 按上述4条规则判定一致性
- 不一致时 **不自动归一化**，状态变为 `review_required`，自动创建复核任务

**怎么改**：
```bash
# 投研助理修改备注（会自动触发重新复核）
python -m cross_border_compliance.cli update-field \
  --spot-check-id 1 \
  --field institution_name_from_remark \
  --value "摩根大通银行（中国）" \
  --reason "补充完整机构名称" \
  --operator assistant_zhou

# 财务复核人复核
python -m cross_border_compliance.cli review \
  --spot-check-id 1 \
  --approved \
  --standard-name "摩根大通银行" \
  --resolution "确认是同一机构" \
  --reviewer finance_reviewer
```

**怎么回滚**：
```bash
# 查看变更历史，找到要回滚的change-id
python -m cross_border_compliance.cli history --spot-check-id 1

# 执行回滚
python -m cross_border_compliance.cli rollback --change-id 5 --operator assistant_zhou
```

---

## 二、去重导入机制

定义在 [services.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/services.py#L44-L175)

**去重规则**：
- 根据 `source_file` + `ex_dividend_date` + `institution_name` 联合去重
- 同一来源文件中相同机构+日期的记录只保留一份
- 重复导入时跳过已存在的记录，**不把"跨境汇款合规抽检"数量翻倍**

**验证命令**：
```bash
# 第一次导入（3条记录）
python -m cross_border_compliance.cli import-screenshots \
  --source-file "/data/screenshots_20260603.png" \
  --data-file test_data/screenshots_20260603.json

# 第二次导入相同文件（0条新建，3条跳过）
python -m cross_border_compliance.cli import-screenshots \
  --source-file "/data/screenshots_20260603.png" \
  --data-file test_data/screenshots_20260603.json

# 查看列表，确认还是3条
python -m cross_border_compliance.cli list
```

---

## 三、三步核心工作流

定义在 [services.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/services.py)

### 状态流转图

```
imported (导入除权日截图)
    ↓
remark_added (补看税费率备注，机构一致)
    ↓        ↖
review_required (机构不一致) → 财务复核
    ↓              ↓
reviewed      rejected (可回滚修改)
    ↓
completed (补录更新完成)
```

### 第一步：导入除权日截图
- 操作人：投研助理小周
- 输入：除权日截图数据（机构名、除权日、分红金额等）
- 输出：状态 = `imported` 的抽检记录
- 关键：自动去重，不翻倍

### 第二步：补看税费率备注
- 操作人：投研助理小周
- 输入：税费率备注（机构名、税率、备注内容等）
- 输出：
  - 机构一致 → 状态 = `remark_added`
  - 机构不一致 → 状态 = `review_required`，**不急着归正常，留给财务复核人复核**
- 关键：自动检测一致性，不一致自动创建复核任务

### 第三步：补录记录更新
- 操作人：投研助理小周
- 输入：抽检结果
- 输出：
  - 从 `reviewed` 更新 → 状态 = `completed`
  - 从 `remark_added` 更新 → 状态保持 `remark_added`
- 关键：记录每次更新的变更历史

---

## 四、变更历史追踪

定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L329-L364)

**特性**：
- 如果投研助理小周**只改了一条备注**，历史里能看出**改前改后的差别**
- 每次修改记录：`old_value`、`new_value`、`changed_by`、`change_reason`
- 每次修改自动生成 `rollback_command`

**查看变更历史**：
```bash
python -m cross_border_compliance.cli history --spot-check-id 1
```

**输出示例**：
```
📜 变更历史 - 抽检记录#1
总变更次数: 5
--------------------------------------------------------------------------------

✏️  [2 update | 2026-06-03 10:30:00
   字段: institution_name_from_remark
   修改人: assistant_zhou
   原因: 补充完整机构名称
   改前: 摩根大通银行
   改后: 摩根大通银行（中国）
   🔄 回滚命令: python -m cross_border_compliance.cli rollback ...
```

---

## 五、财务复核流程

定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L369-L484)

**复核规则**：
- 机构简称不一致时自动创建 `ReviewTask`，分配给 `finance_reviewer`
- 不急着归正常，必须经过财务复核
- 复核人可以：
  - ✅ **通过**：可指定 `standard_name` 统一机构名，状态变为 `reviewed`
  - ❌ **驳回**：状态变为 `rejected`，注明原因，投研助理重新修改

**查看待复核任务**：
```bash
python -m cross_border_compliance.cli list-review-tasks --status pending
```

**执行复核**：
```bash
# 通过并指定标准名
python -m cross_border_compliance.cli review \
  --spot-check-id 1 \
  --approved \
  --standard-name "摩根大通银行" \
  --resolution "确认是同一机构，OCR识别差异" \
  --reviewer finance_reviewer

# 或驳回
python -m cross_border_compliance.cli review \
  --spot-check-id 1 \
  --rejected \
  --resolution "机构名称确实不同，请核实后重新提交" \
  --reviewer finance_reviewer
```

---

## 六、3D/图表展示复核跳转机制

定义在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py#L489-L542)

**设计原则**：先服务复核，不要只剩漂亮画面。

**特性**：
- 选择3D或图表展示时，点击机构简称不一致的记录
- 自动返回原始材料路径和跳转建议
- 可以直接回到除权日截图或税费率备注

**获取原始材料**：
```bash
python -m cross_border_compliance.cli get-source-material --spot-check-id 1
```

**输出示例**：
```
🔍 原始材料溯源
================================================================
抽检ID: 1
抽检单号: CBC-20260603-XXXX
机构一致: False

📸 除权日截图:
   文件: /data/screenshots_20260603.png
   机构: 摩根大通银行
   除权日: 2026-06-15

📝 税费率备注:
   文件: /data/tax_remark.pdf
   机构: 摩根大通
   备注: 跨境汇款税率10%

⚠️  点击查看原始除权日截图或税费率备注进行复核
   跳转动作: navigate_to_source
   跳转至: screenshot #1
```

---

## 七、可复盘记录和可重跑命令

定义在 [services.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/services.py#L440-L502)

**设计原则**：最后给人的不是功能清单，而是一份能复盘的记录和可重新跑的命令。

### 7.1 审计时间线（复盘记录）

```bash
python -m cross_border_compliance.cli audit-timeline
```

**输出示例**：
```
📊 审计时间线
--------------------------------------------------------------------------------

⏰ 2026-06-03 10:00:00
   操作: import_ex_dividend_screenshots | 操作人: assistant_zhou
   结果: 导入除权日截图: 共3条, 新建3条, 跳过0条
   🔄 重跑: python -m cross_border_compliance.cli import-screenshots ...

⏰ 2026-06-03 10:15:00
   操作: add_tax_rate_remark | 操作人: assistant_zhou
   结果: 已添加税费率备注: 机构简称不一致...
   🔄 重跑: python -m cross_border_compliance.cli add-remark ...
```

### 7.2 可重跑命令清单

```bash
python -m cross_border_compliance.cli rerun-commands --spot-check-id 1
```

**输出示例**：
```
🏃 可重跑命令清单 - 抽检记录#1
--------------------------------------------------------------------------------

📌 Step 1: import_ex_dividend_screenshots
   时间: 2026-06-03 10:00:00
   说明: 导入除权日截图: 共3条, 新建3条, 跳过0条
   命令: python -m cross_border_compliance.cli import-screenshots ...

📌 Step 2: add_tax_rate_remark
   时间: 2026-06-03 10:15:00
   说明: 已添加税费率备注: 机构简称不一致...
   命令: python -m cross_border_compliance.cli add-remark ...

================================================================
📋 一键重跑全部命令：
   python -m cross_border_compliance.cli import-screenshots ...
   python -m cross_border_compliance.cli add-remark ...
   python -m cross_border_compliance.cli update-record ...
```

---

## 八、机构别名管理

**添加别名映射**：
```bash
python -m cross_border_compliance.cli add-alias \
  --standard-name "摩根大通银行" \
  --alias "摩根大通" \
  --operator admin
```

**检查一致性**：
```bash
python -m cross_border_compliance.cli check-consistency \
  --name-from-screenshot "摩根大通银行" \
  --name-from-remark "摩根大通"
```

---

## 九、常用命令速查

| 命令 | 说明 |
|------|------|
| `python -m cross_border_compliance.cli init` | 初始化数据库 |
| `python -m cross_border_compliance.cli import-screenshots` | 第一步：导入除权日截图 |
| `python -m cross_border_compliance.cli add-remark` | 第二步：补看税费率备注 |
| `python -m cross_border_compliance.cli update-record` | 第三步：补录记录更新 |
| `python -m cross_border_compliance.cli review` | 财务复核 |
| `python -m cross_border_compliance.cli history` | 查看变更历史 |
| `python -m cross_border_compliance.cli rollback` | 回滚变更 |
| `python -m cross_border_compliance.cli audit-timeline` | 审计时间线（复盘） |
| `python -m cross_border_compliance.cli rerun-commands` | 可重跑命令清单 |
| `python -m cross_border_compliance.cli get-source-material` | 获取原始材料（3D/图表跳转用） |
| `python -m cross_border_compliance.cli list` | 列出抽检记录 |
| `python -m cross_border_compliance.cli show` | 查看抽检详情 |
| `python -m cross_border_compliance.cli add-alias` | 添加机构别名 |

---

## 十、数据模型概览

定义在 [models.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/models.py)

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `institution_aliases` | 机构别名映射 | `standard_name`, `alias`, `is_active` |
| `ex_dividend_screenshots` | 除权日截图（主材料） | `institution_name`, `ex_dividend_date`, `source_file_hash` |
| `tax_rate_remarks` | 税费率备注（关键备注） | `institution_name`, `remark_content`, `tax_rate` |
| `compliance_spot_checks` | 合规抽检记录（核心） | `check_no`, `status`, `institution_name_consistent` |
| `change_histories` | 变更历史 | `old_value`, `new_value`, `rollback_command` |
| `review_tasks` | 财务复核任务 | `issue_type`, `status`, `resolution` |
| `audit_logs` | 审计日志 | `operation`, `rerun_command`, `parameters` |

---

## 十一、测试覆盖

定义在 [tests/test_integration.py](file:///Users/lzy/pro/solo/workspaces/zy72213/tests/test_integration.py)

共9个测试用例，覆盖：

| 测试类 | 测试用例 | 覆盖场景 |
|--------|----------|----------|
| `TestCoreWorkflow` | `test_complete_workflow_consistent_names` | 机构一致的完整三步流程 |
| `TestCoreWorkflow` | `test_institution_name_inconsistent_needs_review` | 机构不一致留待财务复核 |
| `TestCoreWorkflow` | `test_duplicate_import_not_doubled` | 重复导入不翻倍 |
| `TestChangeHistory` | `test_single_remark_change_show_diff` | 单条备注修改的前后对比 |
| `TestChangeHistory` | `test_rollback_change` | 回滚机制 |
| `TestBoundaryRules` | `test_name_consistency_rules` | 4条判定规则 |
| `TestBoundaryRules` | `test_visualization_jump_to_source` | 3D/图表跳转原始材料 |
| `TestAuditAndRerun` | `test_audit_log_and_rerun_commands` | 审计日志和可重跑命令 |
| `TestSpotCheckDetail` | `test_complete_detail_view` | 抽检记录完整详情 |

运行测试：
```bash
python -m pytest tests/test_integration.py -v
```

---

## 十二、关键细节检查清单

以下是用户明确要求检查的细节，全部已实现：

✅ **边界规则代码化**：所有判定、修改、回滚规则在 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72213/cross_border_compliance/boundary_rules.py) 中定义，不在口头约定

✅ **机构简称不一致**：怎么判（4条规则）、怎么改（`update-field` 命令）、怎么回滚（`rollback` 命令），全部代码化

✅ **重复导入不翻倍**：基于 `source_file + date + institution` 联合去重，验证见测试 `test_duplicate_import_not_doubled`

✅ **单条备注修改历史**：修改一条备注能看出改前改后差别，验证见测试 `test_single_remark_change_show_diff`

✅ **3D/图表不只剩漂亮画面**：点击不一致可回溯原始材料，验证见测试 `test_visualization_jump_to_source`

✅ **输出可复盘记录和可重跑命令**：不是功能清单，而是 `audit-timeline` 和 `rerun-commands`

✅ **三步流程完整**：导入→补看备注→补录更新，验证见测试 `test_complete_workflow_consistent_names`

✅ **不一致不急着归正常**：留给财务复核人复核，状态变为 `review_required`，验证见测试 `test_institution_name_inconsistent_needs_review`

---

## 十三、端到端演练脚本

```bash
#!/bin/bash
# 完整演练脚本

set -e

echo "=== 跨境汇款合规抽检系统 端到端演练 ==="

# 1. 初始化
python -m cross_border_compliance.cli init
echo "[1/8] 数据库初始化完成"

# 2. 添加机构别名
python -m cross_border_compliance.cli add-alias \
  --standard-name "摩根大通银行" \
  --alias "摩根大通" \
  --operator admin
echo "[2/8] 机构别名添加完成"

# 3. 第一步：导入除权日截图
IMPORT_RESULT=$(python -m cross_border_compliance.cli import-screenshots \
  --source-file "/data/screenshots_20260603.png" \
  --data-file test_data/screenshots_20260603.json \
  --operator assistant_zhou 2>&1)
echo "$IMPORT_RESULT"
echo "[3/8] 除权日截图导入完成"

# 4. 获取第一个抽检记录ID
SPOT_CHECK_ID=1

# 5. 第二步：补看税费率备注（机构不一致场景）
python -m cross_border_compliance.cli add-remark \
  --spot-check-id $SPOT_CHECK_ID \
  --institution-name "摩根大通" \
  --remark-content "跨境汇款税率10%，需补缴差额" \
  --tax-rate "10%" \
  --source-file "/data/tax_remark.pdf" \
  --operator assistant_zhou
echo "[5/8] 税费率备注添加完成（机构不一致，已创建复核任务）"

# 6. 查看复核任务
python -m cross_border_compliance.cli list-review-tasks --status pending
echo "[6/8] 待复核任务已列出"

# 7. 财务复核
python -m cross_border_compliance.cli review \
  --spot-check-id $SPOT_CHECK_ID \
  --approved \
  --standard-name "摩根大通银行" \
  --resolution "确认是同一机构，别名匹配通过" \
  --reviewer finance_reviewer
echo "[7/8] 财务复核完成"

# 8. 第三步：补录记录更新
python -m cross_border_compliance.cli update-record \
  --spot-check-id $SPOT_CHECK_ID \
  --check-result "合规，已按10%税率补缴，金额2500美元" \
  --operator assistant_zhou
echo "[8/8] 补录更新完成，流程结束"

echo ""
echo "=== 查看最终结果 ==="
python -m cross_border_compliance.cli show --spot-check-id $SPOT_CHECK_ID

echo ""
echo "=== 查看变更历史 ==="
python -m cross_border_compliance.cli history --spot-check-id $SPOT_CHECK_ID

echo ""
echo "=== 查看可重跑命令 ==="
python -m cross_border_compliance.cli rerun-commands --spot-check-id $SPOT_CHECK_ID

echo ""
echo "=== 演练完成 ==="
```

---

## 许可证

MIT License
