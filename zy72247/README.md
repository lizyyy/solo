# 资管计划费用预提

## 概述

本系统将除权日截图（主流程）和税费率备注（现场说法）两份证据整合到同一份结果中，确保导出明细、页面展示和接口返回读同一份数据源。

## 核心功能

### 三步工作流

1. **除权日截图首次导入** — 风控值班老秦导入截图行数据，系统自动检测拆行
2. **税费率备注补看** — 风控值班老秦录入税费率备注，系统关联到已有记录
3. **差异清单更新** — 系统自动计算差异，标记需结算主管复核的项

### 证据保留

每条记录保留：
- 除权日截图的**原始行号**（`original_line_number`）
- 截图原始文本（`raw_text`）
- 税费率备注的来源人（`stated_by`）和日期（`stated_date`）
- **人工改动**记录：改动人、时间、字段、旧值、新值、原因
- **当前处理状态**：`pending_review` / `confirmed` / `modified` / `rolled_back` / `split_line_pending_supervisor`

### 统一结果源

导出明细（CSV）、页面展示（API `/accrual-result`）、差异清单（API `/diff-list`）均从同一个 `ExpenseAccrualService` 实例读取，不存在数据分叉。

## 边界规则

### 拆行判定规则

同一业务号出现两行以上记录时，按以下规则判定是否为"拆行"：

| 条件 | 说明 |
|------|------|
| 同一业务号 ≥ 2 行 | 前提条件 |
| 行类型包含"手续费"和"本金" | 关键词匹配 |
| 手续费金额 + 本金金额 ≈ 总金额（容差 0.01 元） | 金额互补校验 |

三条同时满足 → 判定为拆行。

### 拆行处理规则

| 动作 | 规则 |
|------|------|
| 自动标记 | 状态设为 `split_line_pending_supervisor`，**不自动归为正常** |
| 人工确认 | 结算主管复核后手动改为 `confirmed` 或 `modified` |
| 回滚 | 撤回时恢复上一版差异清单，拆行标记一并回滚 |
| 禁止 | **不得**在未经结算主管确认的情况下将拆行记录自动归入正常 |

### 撤回规则

风控值班老秦误把税费率备注当成新材料时：
1. 调用 `withdraw_tax_note` 接口，传入业务号和撤回原因
2. 系统清除该业务号的税费率备注，状态改为 `rolled_back`
3. 人工改动记录保留旧值，可追溯
4. 差异清单新增一版（版本号递增），内容反映撤回后的状态

### 版本回滚规则

1. 差异清单每次变更都产生新版本，旧版本不可变
2. 回滚到指定版本时，系统从该版本深拷贝数据，创建新版本（版本号递增）
3. 回滚不会删除历史版本，所有版本永久可查

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/expense-accrual/screenshot/import` | 导入除权日截图 |
| POST | `/api/v1/expense-accrual/tax-note/review` | 复核税费率备注 |
| POST | `/api/v1/expense-accrual/diff-list/update` | 更新差异清单 |
| POST | `/api/v1/expense-accrual/diff-list/rollback` | 回滚差异清单 |
| POST | `/api/v1/expense-accrual/tax-note/withdraw` | 撤回税费率备注 |
| POST | `/api/v1/expense-accrual/manual-change` | 人工改动 |
| GET  | `/api/v1/expense-accrual/records` | 查看所有记录 |
| GET  | `/api/v1/expense-accrual/records/{business_no}` | 按业务号查看 |
| GET  | `/api/v1/expense-accrual/accrual-result` | 获取预提结果 |
| GET  | `/api/v1/expense-accrual/diff-list` | 获取差异清单 |
| GET  | `/api/v1/expense-accrual/diff-list/version/{version}` | 获取指定版本 |
| GET  | `/api/v1/expense-accrual/export/details.csv` | 导出明细 CSV |
| GET  | `/api/v1/expense-accrual/export/accrual.csv` | 导出预提结果 CSV |

## 命令行工具

```bash
# 导入除权日截图
python cli.py import-screenshot screenshot_data.json --operator 风控值班老秦

# 复核税费率备注
python cli.py review-tax-note tax_note_data.json --operator 风控值班老秦

# 更新差异清单
python cli.py update-diff --operator 风控值班老秦

# 回滚差异清单到版本 1
python cli.py rollback 1 --operator 风控值班老秦

# 撤回某业务号的税费率备注
python cli.py withdraw-tax-note BIZ001 --reason "误把税费率备注当成新材料" --operator 风控值班老秦

# 导出明细
python cli.py export-details --output details.csv

# 导出预提结果
python cli.py export-accrual --output accrual.csv

# 查看所有记录
python cli.py show-records
```

## 输入数据格式

### 除权日截图 JSON

```json
[
  {
    "original_line_number": 1,
    "ex_rights_date": "2025-06-01",
    "business_no": "BIZ001",
    "amount": 10000,
    "line_type": "利息",
    "raw_text": "原始行文本"
  },
  {
    "original_line_number": 2,
    "ex_rights_date": "2025-06-01",
    "business_no": "BIZ002",
    "amount": 30,
    "line_type": "手续费",
    "raw_text": "原始行文本"
  },
  {
    "original_line_number": 3,
    "ex_rights_date": "2025-06-01",
    "business_no": "BIZ002",
    "amount": 970,
    "line_type": "本金",
    "raw_text": "原始行文本"
  }
]
```

### 税费率备注 JSON

```json
[
  {
    "business_no": "BIZ001",
    "tax_rate": 0.06,
    "note_text": "利息收入税率6%",
    "stated_by": "现场财务张工",
    "stated_date": "2025-06-02"
  }
]
```

## 测试

```bash
python -m pytest tests/ -v
```

## 启动服务

```bash
pip install fastapi uvicorn
uvicorn amc_expense_accrual.app:app --reload --port 8000
```
