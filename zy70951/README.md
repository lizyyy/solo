# 体检套餐加项结算 API 服务

体检中心财务加项结算处理系统。核心能力：
- 批量提交加项、优惠券、单位账单材料，系统自动入账
- **重复提交同一批材料自动识别，返回原处理结果，不会重复生成记录**
- 提供批次查询、统计、导出 CSV 报告接口
- 导出内容包含：加项差异、优惠券差异、单位账单差异、最后处理人

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务默认运行在 `http://127.0.0.1:5001`，首次启动会自动创建 SQLite 数据库 `settlement.db`。

### 3. 一键跑通验证

```bash
python run_demo.py
```

脚本会自动：创建批次 → 查询统计 → 追加处理人 → 下载报告 → 重复提交验证去重 → 校验导出与查询一致。

---

## API 接口

所有接口返回 JSON。导出接口返回 CSV。

### 创建批次（核心）

```
POST /api/batches
Content-Type: application/json
```

请求体字段：

| 字段         | 类型   | 必填 | 说明                     |
|--------------|--------|------|--------------------------|
| submitter    | string | 是   | 提交人                   |
| handler      | string | 否   | 处理人，默认取 submitter |
| handler_note | string | 否   | 处理备注                 |
| remark       | string | 否   | 批次备注                 |
| addons       | array  | 是   | 加项记录列表             |
| coupons      | array  | 是   | 优惠券列表               |
| unit_bills   | array  | 是   | 单位结算账单列表         |

`addons` 元素字段：`item_name`、`patient_name`、`onsite_price`、`settle_price`
`coupons` 元素字段：`coupon_code`、`patient_name`、`onsite_amount`、`settle_amount`
`unit_bills` 元素字段：`patient_name`、`onsite_total`、`settle_total`

> **去重规则**：系统仅根据 `addons` + `coupons` + `unit_bills` 三个数组的内容计算哈希判重。
> `submitter`、`handler`、`remark` 等元数据变化不会影响去重判定——只要材料内容相同，即视为同一批。

### 查询批次列表

```
GET /api/batches
```

### 查询单个批次详情

```
GET /api/batches/:batch_no
```

### 查询批次统计

```
GET /api/batches/:batch_no/stats
```

返回：加项、优惠券、单位账单的现场金额总计、结算金额总计、差异，以及总差异。

### 追加处理人

```
POST /api/batches/:batch_no/handlers
Content-Type: application/json

{"handler": "王五", "note": "财务复核通过"}
```

### 下载结算报告 CSV

```
GET /api/batches/:batch_no/report
```

CSV 列：批次号、提交人、提交时间、最后处理人、最后处理时间、最后处理备注、
类别、编号/项目、姓名、现场金额、结算金额、差异、
加项差异总计、优惠券差异总计、单位账单差异总计、差异总计。

### 健康检查

```
GET /api/health
```

---

## curl 命令示例：从创建到下载

### 第一步：创建批次

```bash
curl -s -X POST http://127.0.0.1:5001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "handler": "李四",
    "handler_note": "首次录入",
    "remark": "2026年5月体检套餐加项结算",
    "addons": [
      {"item_name": "甲状腺彩超加项", "patient_name": "王小明", "onsite_price": 280.0, "settle_price": 260.0},
      {"item_name": "颈椎MRI加项",   "patient_name": "李小红", "onsite_price": 650.0, "settle_price": 650.0},
      {"item_name": "胃镜加项",     "patient_name": "赵六",   "onsite_price": 420.0, "settle_price": 400.0}
    ],
    "coupons": [
      {"coupon_code": "VIP100", "patient_name": "王小明", "onsite_amount": 100.0, "settle_amount": 80.0},
      {"coupon_code": "NEW50",  "patient_name": "李小红", "onsite_amount": 50.0,  "settle_amount": 50.0}
    ],
    "unit_bills": [
      {"patient_name": "王小明", "onsite_total": 1280.0, "settle_total": 1200.0},
      {"patient_name": "李小红", "onsite_total":  980.0, "settle_total":  980.0},
      {"patient_name": "赵六",   "onsite_total":  720.0, "settle_total":  700.0}
    ]
  }' | python -m json.tool
```

记下返回的 `batch_no`（如 `B202605270001`），下面步骤用它替换。

### 第二步：查询批次统计

```bash
curl -s http://127.0.0.1:5001/api/batches/B202605270001/stats | python -m json.tool
```

### 第三步：追加最后处理人（财务复核）

```bash
curl -s -X POST http://127.0.0.1:5001/api/batches/B202605270001/handlers \
  -H "Content-Type: application/json" \
  -d '{"handler": "王五", "note": "财务复核通过"}' | python -m json.tool
```

### 第四步：下载结算报告

```bash
curl -s -o report.csv http://127.0.0.1:5001/api/batches/B202605270001/report
head -5 report.csv
```

### 第五步：重复提交验证去重

使用**完全相同的材料内容**（可修改 submitter/handler/remark 等元数据）再次提交，应返回 `duplicate: true` 和原始批次：

```bash
curl -s -X POST http://127.0.0.1:5001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "另一个提交人",
    "handler": "另一个处理人",
    "remark": "不同的备注",
    "addons": [
      {"item_name": "甲状腺彩超加项", "patient_name": "王小明", "onsite_price": 280.0, "settle_price": 260.0},
      {"item_name": "颈椎MRI加项",   "patient_name": "李小红", "onsite_price": 650.0, "settle_price": 650.0},
      {"item_name": "胃镜加项",     "patient_name": "赵六",   "onsite_price": 420.0, "settle_price": 400.0}
    ],
    "coupons": [
      {"coupon_code": "VIP100", "patient_name": "王小明", "onsite_amount": 100.0, "settle_amount": 80.0},
      {"coupon_code": "NEW50",  "patient_name": "李小红", "onsite_amount": 50.0,  "settle_amount": 50.0}
    ],
    "unit_bills": [
      {"patient_name": "王小明", "onsite_total": 1280.0, "settle_total": 1200.0},
      {"patient_name": "李小红", "onsite_total":  980.0, "settle_total":  980.0},
      {"patient_name": "赵六",   "onsite_total":  720.0, "settle_total":  700.0}
    ]
  }' | python -m json.tool
```

> 预期：`duplicate` 为 `true`，`batch_no` 与第一次返回相同，系统不会插入新记录。

---

## 数据说明

### 统计一致保证

- 查询接口 `/api/batches/:batch_no/stats` 返回的 `total_diff` 与导出 CSV 每一行最后一列「差异总计」完全一致。
- 差异 = 现场金额 - 结算金额。

### 数据库文件

SQLite 数据库位于项目根目录 `settlement.db`，删除后重启服务会重建。
