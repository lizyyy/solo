# 乡镇农资店赊销管理系统

赊销回款退货抵扣欠款重算后端API

## 技术栈

- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite
- openpyxl (Excel导出)

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

## 运行自检脚本

```bash
python test_self_check.py
```

## 核心功能

### 1. 客户管理
- 创建客户
- 查询客户列表（支持按姓名筛选）
- 更新客户信息

### 2. 赊销订单管理
- 创建赊销订单（支持多商品、折扣）
- 查询订单列表
- 查看订单详情

### 3. 回款管理
- 记录回款（支持分期）
- 自动抵扣欠款
- 幂等性保证

### 4. 退货管理
- 记录退货
- 自动抵扣欠款
- 支持按商品退货

### 5. 欠款重算
- 重新计算订单欠款
- 自动处理异常情况

### 6. 欠款报告
- 生成欠款报告
- 导出Excel报告

## 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| missing_field | 400 | 缺少必填字段 |
| invalid_status | 400 | 状态不允许操作 |
| need_review | 409 | 需要人工复核 |
| already_processed | 409 | 已处理过的请求 |
| not_found | 404 | 资源不存在 |
| business_error | 400 | 业务逻辑错误 |

## API接口示例

### 创建客户
```bash
curl -X POST "http://localhost:8000/api/customers/" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "phone": "13800138000", "village": "东村村"}'
```

### 创建赊销订单
```bash
curl -X POST "http://localhost:8000/api/sales-orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "discount_amount": 50,
    "items": [
      {"product_name": "尿素", "quantity": 10, "unit_price": 120},
      {"product_name": "复合肥", "quantity": 5, "unit_price": 180}
    ]
  }'
```

### 记录回款
```bash
curl -X POST "http://localhost:8000/api/payments/" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1, "amount": 1000, "payment_method": "cash"}'
```

### 记录退货
```bash
curl -X POST "http://localhost:8000/api/returns/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 1,
    "items": [{"order_item_id": 1, "quantity": 2, "reason": "质量问题"}]
  }'
```

### 欠款重算
```bash
curl -X POST "http://localhost:8000/api/recalculate/" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1}'
```

### 生成报告
```bash
curl -X POST "http://localhost:8000/api/debt-reports/" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 项目结构

```
.
├── main.py                 # FastAPI主程序
├── database.py             # 数据库模型和连接
├── schemas.py              # Pydantic模型（请求/响应）
├── services.py             # 业务逻辑
├── requirements.txt        # 依赖列表
├── test_self_check.py      # 自检脚本
└── README.md              # 说明文档
```

## 数据模型关系

- Customer (客户) 1 -> N SalesOrder (赊销订单)
- SalesOrder 1 -> N SalesOrderItem (订单项)
- SalesOrder 1 -> N PaymentRecord (回款记录)
- SalesOrder 1 -> N ReturnRecord (退货记录)
- ReturnRecord 1 -> N ReturnItem (退货项)
