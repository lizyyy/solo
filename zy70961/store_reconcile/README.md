# 门店财务对账 API

门店现金缴存、POS 销售和备用金每日对账系统。

## 核心功能

- 上传或读取缴存 CSV、销售 JSON、备用金流水
- 对账结果分正常项、待确认项、失败项返回
- 失败记录保留原始字段和建议处理方式
- 同一批材料再次提交不重复生效（幂等控制）
- 规则覆盖：长短款、重复缴存、节假日延迟
- 备用金账户可从历史追溯来源

## 快速开始

### 1. 安装依赖

```bash
cd store_reconcile
pip install -r ../requirements.txt
```

### 2. 启动 API 服务

```bash
python -m store_reconcile.main
```

服务启动后访问: http://localhost:8000

API 文档: http://localhost:8000/docs

### 3. 本地测试（无需启动服务）

```bash
python -m store_reconcile.test_local
```

## API 接口

### 结构化数据对账

```bash
POST /api/v1/reconcile
Content-Type: application/json

{
  "store_id": "STORE001",
  "batch_date": "2026-05-24",
  "deposits": [...],
  "sales": [...],
  "petty_cash": [...]
}
```

### 文件上传对账

```bash
POST /api/v1/reconcile/upload
Content-Type: multipart/form-data

store_id: STORE001
batch_date: 2026-05-24
deposit_file: @sample/deposit.csv
sales_file: @sample/sales.json
petty_cash_file: @sample/petty_cash.json
```

### 用 curl 测试

```bash
# 上传对账
curl -X POST http://localhost:8000/api/v1/reconcile/upload \
  -F "store_id=STORE001" \
  -F "batch_date=2026-05-24" \
  -F "deposit_file=@sample/deposit.csv" \
  -F "sales_file=@sample/sales.json" \
  -F "petty_cash_file=@sample/petty_cash.json"

# 查询批次
curl http://localhost:8000/api/v1/batches?store_id=STORE001

# 追溯备用金
curl "http://localhost:8000/api/v1/petty-cash/trace?store_id=STORE001&target_date=2026-05-24"
```

## 数据格式

### 缴存 CSV

```csv
store_id,deposit_date,amount,deposit_method,reference_no
STORE001,2026-05-20,5800.00,cash,DEP20260520001
```

### 销售 JSON

```json
[
  {
    "sale_date": "2026-05-20",
    "total_amount": 8500.00,
    "cash_amount": 5800.00,
    "pos_amount": 2500.00,
    "other_amount": 200.00,
    "transaction_count": 156
  }
]
```

### 备用金 JSON

```json
[
  {
    "txn_date": "2026-05-01",
    "txn_type": "replenish",
    "amount": 5000.00,
    "balance_after": 5000.00,
    "reference": "INIT202605",
    "description": "月初备用金充值"
  }
]
```

备用金类型: `income`(收入)、`expense`(支出)、`replenish`(充值)、`adjust`(调整)

## 对账规则

| 规则 | 说明 | 状态 |
|------|------|------|
| 长短款检查 | 缴存金额 vs 现金销售 + 备用金变动 | 失败 |
| 重复缴存检查 | 同参考号或同金额多次缴存 | 失败 |
| 节假日延迟 | 节假日缴存可能延迟 | 待确认/失败 |
| 缺失缴存检查 | 有销售无缴存 | 失败 |
| 缺失销售检查 | 有缴存无销售 | 失败 |
| 备用金余额检查 | 记录余额与计算余额不一致 | 失败 |

## 幂等控制

系统通过 `store_id + batch_date + source_hash` 唯一标识一批数据。
相同数据再次提交时，直接返回历史结果，不会重复处理。

## 项目结构

```
store_reconcile/
├── main.py                 # FastAPI 入口
├── test_local.py           # 本地测试脚本
├── requirements.txt        # 依赖
├── models/
│   ├── __init__.py
│   └── schemas.py          # 数据模型
├── services/
│   ├── __init__.py
│   ├── reconciler.py       # 对账引擎
│   ├── parser.py           # 数据解析
│   └── tracer.py           # 备用金追溯
├── db/
│   ├── __init__.py
│   └── database.py         # SQLite 数据库
└── sample/
    ├── deposit.csv         # 缴存示例
    ├── sales.json          # 销售示例
    └── petty_cash.json     # 备用金示例
```
