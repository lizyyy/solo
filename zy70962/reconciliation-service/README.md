# 区域财务对账服务（Reconciliation Service）

面向区域财务的偏后端对账服务，把 **缴存 CSV、销售 JSON、备用金流水**
三种日常来源统一导入、自动比对、人工复核、覆盖重算、报告导出串成一条线。

目标：现场同事只负责录数据，区域财务不再手动摊开三个表——差异由系统解释，
复核结论带可读说明，复核修改后明细/汇总/导出里的数字同步变化。

## 能力

- 📥 **三源导入**：缴存 CSV / 销售 JSON / 备用金 CSV，表头中英文都能识别。
- 🤖 **自动比对**：按门店 + 营业日匹配，自动标记：
  - 长款 / 短款
  - 重复缴存
  - 缺缴存 / 缺销售
  - 节假日/周末延迟缴存（与下一个工作日的缴存自动匹配）
  - 备用金余额异常
- 🧑‍💼 **人工复核**：每条差异都能 `放行 / 退回 / 要求补材料`，并支持覆盖缴存或销售金额。
- 🔁 **改动即重算**：复核覆盖数值后会回写到原始流水并重新对账，
  明细、汇总、导出报告里的数字同步变化。
- 📤 **报告下载**：`GET /api/reports/download/{id}/{kind}` 支持 `detail.csv / summary.csv / detail.xlsx / summary.xlsx`。
- 📖 **可读说明**：每条差异自带人可读说明，复核结论会保留原因，方便财务向别人解释。

## 运行

```bash
cd reconciliation-service
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn recon_service.main:app --reload --host 0.0.0.0 --port 8000
```

打开 <http://localhost:8000/docs> 查看 Swagger。

## 典型流程（curl 示例）

```bash
# 1. 创建批次
BATCH_ID=$(curl -s -X POST localhost:8000/api/batches \
  -H 'Content-Type: application/json' \
  -d '{"name":"2025-W21 区域对账","period_start":"2025-05-24","period_end":"2025-05-27"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["id"])')

# 2. 导入缴存 CSV
curl -s -X POST localhost:8000/api/imports/deposits \
  -F "batch_id=$BATCH_ID" \
  -F "file=@examples/deposits.csv"

# 3. 导入销售 JSON
curl -s -X POST localhost:8000/api/imports/sales \
  -F "batch_id=$BATCH_ID" \
  -F "file=@examples/sales.json"

# 4. 导入备用金 CSV
curl -s -X POST localhost:8000/api/imports/petty-cash \
  -F "batch_id=$BATCH_ID" \
  -F "file=@examples/petty_cash.csv"

# 5. 查看汇总
curl -s localhost:8000/api/reports/summary/$BATCH_ID | python -m json.tool

# 6. 复核一条差异（示例：对 S003 的短款放行，并在备注中说明 0.01 是零钞差异）
# 先从详情里拿 discrepancy_id
DISC_ID=$(curl -s localhost:8000/api/batches/$BATCH_ID \
  | python -c 'import sys,json;d=[x for x in json.load(sys.stdin)["discrepancies"] if x["type"]=="short"][0]["id"];print(d)')
curl -s -X POST localhost:8000/api/reviews/batches/$BATCH_ID/discrepancies/$DISC_ID \
  -H 'Content-Type: application/json' \
  -d '{"action":"approve","reviewer":"zhang.san","note":"¥0.01 为零钞差异，门店正常"}'

# 7. 导出 Excel
curl -s -o detail.xlsx "localhost:8000/api/reports/download/$BATCH_ID/detail.xlsx"
```

## 差异类型与解释

| 类型 | 触发条件 | 默认行为 |
| --- | --- | --- |
| `over` (长款) | 缴存 > 销售现金 | 标注差额与建议核对项 |
| `short` (短款) | 缴存 < 销售现金 | 同上 |
| `duplicate` | 门店+日期有多条缴存 | 每条重复都列明细，含流水号 |
| `missing_deposit` | 有销售无缴存 | 若为节假日/周末则尝试匹配下一工作日 |
| `missing_sales` | 有缴存无销售 | 提示核对销售漏报 |
| `holiday_delay` | 销售发生在节假日/周末 | 自动匹配下一个工作日的缴存 |
| `petty_imbalance` | 备用金余额<0 | 提示核对备用金额度 |

## 数据格式示例

### 缴存 CSV（表头支持中英文）

```
store_id,deposit_date,amount,reference,note
S001,2025-05-25,3120.50,DEP525001,周末缴存
```

### 销售 JSON

```json
[
  {"store_id":"S001","sale_date":"2025-05-24","pos_sales_amount":850,"cash_sales_amount":3120.50}
]
```

### 备用金 CSV

```
store_id,tx_date,tx_type,amount,purpose,reference
S001,2025-05-26,out,300,找零备用金,PC5261
```

## 目录结构

```
reconciliation-service/
├── examples/                      示例数据
├── pyproject.toml
└── src/recon_service/
    ├── main.py                    FastAPI 应用入口
    ├── config.py                  节假日等配置
    ├── models.py                  Pydantic 数据模型
    ├── routes/
    │   ├── health.py
    │   ├── batches.py
    │   ├── imports.py
    │   ├── reviews.py
    │   └── reports.py
    └── services/
        ├── deps.py                单例仓储
        ├── repository.py          批次持久化
        ├── importers.py           CSV/JSON 解析
        ├── reconciler.py          对账引擎 + 解释器
        ├── review.py              复核服务 + 重算
        └── reporting.py           汇总 + 导出
```

## 可扩展点

- **持久化**：当前仓储写本地 JSON，上线前可替换为 PostgreSQL / MySQL。
- **节假日表**：目前内置 2025–2026 美国主要节假日，可改为从接口或配置加载。
- **匹配策略**：在 `reconciler.run_reconciliation` 中按业务调整容差、延迟窗口、配对键（例如加收银员维度）。
