# 连锁门店价签 API 接口调用示例

## 基础信息
- **服务地址**: http://localhost:3000
- **API 根路径**: /api
- **Content-Type**: application/json

---

## 1. 健康检查

```bash
curl http://localhost:3000/api/health
```

---

## 2. 门店管理

### 获取所有门店
```bash
curl http://localhost:3000/api/stores
```

### 获取单个门店
```bash
curl http://localhost:3000/api/stores/ST001
```

### 创建门店
```bash
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "store_code": "ST006",
    "store_name": "成都天府店",
    "address": "成都市高新区天府大道100号",
    "manager": "孙八",
    "phone": "13800138006",
    "status": "active"
  }'
```

---

## 3. 商品管理

### 获取所有商品
```bash
curl http://localhost:3000/api/products
```

### 按条码查询商品
```bash
curl http://localhost:3000/api/products/6901234567890
```

### 创建商品
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "6901234567900",
    "product_name": "测试商品",
    "category": "测试分类",
    "base_price": 10.00,
    "unit": "件"
  }'
```

---

## 4. 价签版本管理

### 获取所有价签版本
```bash
curl http://localhost:3000/api/price-versions
```

### 获取活跃价签版本
```bash
curl http://localhost:3000/api/price-versions/active
```

### 创建价签版本
```bash
curl -X POST http://localhost:3000/api/price-versions \
  -H "Content-Type: application/json" \
  -d '{
    "version_code": "PV2024010106",
    "version_name": "德芙巧克力促销价",
    "barcode": "6901234567899",
    "price": 9.90,
    "price_type": "promotion",
    "effective_start": "2024-05-01 00:00:00",
    "effective_end": "2024-05-31 23:59:59",
    "created_by": "admin"
  }'
```

### 激活价签版本
```bash
curl -X PATCH http://localhost:3000/api/price-versions/PV2024010103/activate
```

### 状态推进 - 提交复核
```bash
curl -X PATCH http://localhost:3000/api/price-versions/PV2024010103/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending_review"
  }'
```

---

## 5. 促销窗口管理

### 获取所有促销
```bash
curl http://localhost:3000/api/promotions
```

### 检查过期促销
```bash
curl http://localhost:3000/api/promotions/check-expired
```

### 创建促销窗口
```bash
curl -X POST http://localhost:3000/api/promotions \
  -H "Content-Type: application/json" \
  -d '{
    "promotion_code": "PROMO20240701",
    "promotion_name": "七一建党节促销",
    "price_version_id": 6,
    "start_time": "2024-07-01 00:00:00",
    "end_time": "2024-07-07 23:59:59",
    "store_codes": "ST001,ST002,ST003",
    "created_by": "admin"
  }'
```

### 开始促销
```bash
curl -X PATCH http://localhost:3000/api/promotions/PROMO20240601/start
```

---

## 6. 门店确认记录

### 获取所有确认记录
```bash
curl http://localhost:3000/api/confirmations
```

### 创建确认记录
```bash
curl -X POST http://localhost:3000/api/confirmations \
  -H "Content-Type: application/json" \
  -d '{
    "confirmation_code": "CONF005",
    "store_code": "ST004",
    "price_version_id": 1,
    "confirmer": "店员D",
    "remarks": "价签已确认更换"
  }'
```

---

## 7. 差异报告管理

### 获取所有差异报告
```bash
curl http://localhost:3000/api/discrepancies
```

### 获取待复核的差异
```bash
curl http://localhost:3000/api/discrepancies/pending-review
```

### 按状态查询
```bash
curl "http://localhost:3000/api/discrepancies?status=pending_review
```

### 创建差异报告
```bash
curl -X POST http://localhost:3000/api/discrepancies \
  -H "Content-Type: application/json" \
  -d '{
    "report_code": "DISP005",
    "store_code": "ST003",
    "barcode": "6901234567891",
    "price_version_id": null,
    "expected_price": 3.50,
    "actual_price": 4.00,
    "discrepancy_type": "price_mismatch",
    "reported_by": "巡检员C",
    "remarks": "价格不符，比预期高"
  }'
```

### 复核差异报告 - 通过
```bash
curl -X PATCH http://localhost:3000/api/discrepancies/DISP001/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reviewed",
    "reviewed_by": "主管A",
    "resolution": "已核实，确认存在差异，安排门店修正",
    "remarks": "优先级：高"
  }'
```

### 复核差异报告 - 已补偿
```bash
curl -X PATCH http://localhost:3000/api/discrepancies/DISP001/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "compensated",
    "reviewed_by": "主管A",
    "resolution": "已补偿顾客差价",
    "remarks": "补偿金额：1.9元"
  }'
```

### 驳回差异报告
```bash
curl -X PATCH http://localhost:3000/api/discrepancies/DISP001/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "reviewed_by": "主管A",
    "resolution": "价格正确，差异不存在",
    "remarks": "系统查询价格为正常售价"
  }'
```

---

## 8. 异常日志管理

### 获取所有异常日志
```bash
curl http://localhost:3000/api/exceptions
```

### 获取待处理异常
```bash
curl http://localhost:3000/api/exceptions/pending
```

### 处理异常
```bash
curl -X PATCH http://localhost:3000/api/exceptions/EXC-123456789-ABC12/handle \
  -H "Content-Type: application/json" \
  -d '{
    "handled_by": "管理员",
    "processing_conclusion": "已修复，系统重新处理成功"
  }'
```

---

## 9. 人工修正记录

### 获取所有人工修正
```bash
curl http://localhost:3000/api/corrections
```

### 创建人工修正记录
```bash
curl -X POST http://localhost:3000/api/corrections \
  -H "Content-Type: application/json" \
  -d '{
    "correction_code": "CORR003",
    "discrepancy_id": 1,
    "store_code": "ST004",
    "barcode": "6901234567890",
    "old_price": 8.80,
    "new_price": 6.90,
    "corrected_by": "店长C",
    "reason": "价签显示错误，人工修正"
  }'
```

---

## 10. 数据导出

### 导出门店数据CSV
```bash
curl -O http://localhost:3000/api/exports/stores
```

### 导出商品数据CSV
```bash
curl -O http://localhost:3000/api/exports/products
```

### 导出价签版本CSV
```bash
curl -O http://localhost:3000/api/exports/price-versions
```

### 导出差异报告CSV
```bash
curl -O http://localhost:3000/api/exports/discrepancies
```

### 按状态导出差异
```bash
curl -O "http://localhost:3000/api/exports/discrepancies?status=pending_review"
```

### 获取汇总报告
```bash
curl http://localhost:3000/api/exports/report/summary
```

---

## 状态说明

| 状态值 | 说明 |
|--------|------|
| `pending` | 待处理/待审核 |
| `pending_review` | 待复核 |
| `active` | 激活/生效中 |
| `reviewed` | 已复核 |
| `confirmed` | 已确认 |
| `rejected` | 已驳回 |
| `compensated` | 已补偿 |
| `expired` | 已过期 |
| `scheduled` | 已排期 |
| `completed` | 已完成 |
| `validation_error` | 验证错误 |
| `system_error` | 系统错误 |
| `not_found` | 资源不存在 |
| `duplicate` | 重复资源 |
