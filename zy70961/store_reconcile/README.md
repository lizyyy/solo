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

> **重要**: 所有命令均在项目根目录 `/Users/lzy/pro/solo/workspaces/zy70961` 下执行，不要进入 `store_reconcile` 子目录。

### 1. 安装依赖

```bash
cd /Users/lzy/pro/solo/workspaces/zy70961
python3 -m pip install -r requirements.txt
```

### 2. 启动 API 服务

```bash
python3 -m store_reconcile.main
```

服务启动后访问: http://localhost:8000

API 文档: http://localhost:8000/docs

如需指定端口:

```bash
python3 -c "from store_reconcile.main import app; import uvicorn; uvicorn.run(app, host='0.0.0.0', port=8001)"
```

### 3. 本地测试（无需启动服务）

```bash
python3 -m store_reconcile.test_local
```

### 4. API 集成测试（需要先启动服务）

```bash
python3 -m store_reconcile.test_api
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
deposit_file: @store_reconcile/sample/deposit.csv
sales_file: @store_reconcile/sample/sales.json
petty_cash_file: @store_reconcile/sample/petty_cash.json
```

### 用 curl 测试

> 注意文件路径相对于执行命令的目录（项目根目录）。

```bash
# 上传对账
curl -X POST http://localhost:8000/api/v1/reconcile/upload \
  -F "store_id=STORE001" \
  -F "batch_date=2026-05-24" \
  -F "deposit_file=@store_reconcile/sample/deposit.csv" \
  -F "sales_file=@store_reconcile/sample/sales.json" \
  -F "petty_cash_file=@store_reconcile/sample/petty_cash.json"

# 查询批次
curl "http://localhost:8000/api/v1/batches?store_id=STORE001"

# 查询批次明细
curl "http://localhost:8000/api/v1/batch/{batch_id}/items"

# 追溯备用金
curl "http://localhost:8000/api/v1/petty-cash/trace?store_id=STORE001&target_date=2026-05-24"

# 备用金汇总
curl "http://localhost:8000/api/v1/petty-cash/summary?store_id=STORE001"

# 健康检查
curl http://localhost:8000/api/v1/health
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

## 完整验证步骤

### 方式一：一键本地验证（推荐）

```bash
cd /Users/lzy/pro/solo/workspaces/zy70961
python3 -m store_reconcile.test_local
```

### 方式二：完整 API 流程验证

```bash
# 1. 清理旧数据
cd /Users/lzy/pro/solo/workspaces/zy70961
rm -f reconcile.db test_reconcile.db

# 2. 安装依赖
python3 -m pip install -r requirements.txt

# 3. 启动服务（另开终端）
python3 -m store_reconcile.main

# 4. 运行 API 测试
python3 -m store_reconcile.test_api
```

## 常见问题

### Q: 端口 8000 被占用怎么办？
A: 检查并清理占用端口的进程，或使用其他端口启动:
```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null
```

### Q: 数据库文件在哪里？
A: 默认在项目根目录生成 `reconcile.db`，可删除重置所有数据。

### Q: 如何添加新的对账规则？
A: 在 `store_reconcile/services/reconciler.py` 中添加新的规则方法，并在 `_rules` 列表中注册。

## 项目结构

```
zy70961/                              # 项目根目录
├── requirements.txt                  # 依赖列表（从此处安装）
├── reconcile.db                      # 运行时生成的数据库
└── store_reconcile/                  # Python 包
    ├── __init__.py
    ├── main.py                       # FastAPI 入口
    ├── test_local.py                 # 本地测试脚本
    ├── test_api.py                   # API 测试脚本
    ├── README.md                     # 本文件
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py                # 数据模型
    ├── services/
    │   ├── __init__.py
    │   ├── reconciler.py             # 对账引擎
    │   ├── parser.py                 # 数据解析
    │   └── tracer.py                 # 备用金追溯
    ├── db/
    │   ├── __init__.py
    │   └── database.py               # SQLite 数据库
    └── sample/
        ├── deposit.csv               # 缴存示例
        ├── sales.json                # 销售示例
        └── petty_cash.json           # 备用金示例
```
