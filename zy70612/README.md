# 价签版本促销到期门店确认后端API

## 项目概述

解决门店换价签靠群里发Excel，临时促销结束后常有门店忘记恢复原价的问题。

## 技术栈

- Python 3.9+
- FastAPI
- SQLite
- SQLAlchemy 2.0

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

API文档: http://localhost:8000/docs

### 3. 造测试数据

```bash
python seed_data.py
```

## API接口

### 主流程Curl示例

#### 1. 创建价签版本
```bash
curl -X POST "http://localhost:8000/api/v1/price-tag-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version_code": "V20240501-PROMO",
    "name": "五一促销价签版本",
    "description": "五一劳动节全场促销",
    "promotion_start": "2024-05-01T00:00:00",
    "promotion_end": "2024-05-05T23:59:59",
    "created_by": "admin@company.com"
  }'
```

#### 2. 添加商品到价签版本
```bash
curl -X POST "http://localhost:8000/api/v1/price-tag-versions/1/items" \
  -H "Content-Type: application/json" \
  -d '{
    "barcode": "6901234567890",
    "product_name": "可口可乐330ml",
    "original_price": 3.50,
    "promotion_price": 2.99,
    "unit": "瓶"
  }'
```

#### 3. 分配门店
```bash
curl -X POST "http://localhost:8000/api/v1/price-tag-versions/1/stores" \
  -H "Content-Type: application/json" \
  -d '{
    "store_ids": [1, 2, 3]
  }'
```

#### 4. 门店确认
```bash
curl -X POST "http://localhost:8000/api/v1/confirmations" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": 1,
    "version_id": 1,
    "confirmed_by": "store1_manager@company.com",
    "confirmation_type": "start",
    "photo_url": "https://example.com/photo1.jpg"
  }'
```

#### 5. 查询确认状态
```bash
curl "http://localhost:8000/api/v1/price-tag-versions/1/status"
```

#### 6. 导出差异报告
```bash
curl "http://localhost:8000/api/v1/price-tag-versions/1/export" \
  -H "Content-Type: application/json" \
  -o discrepancy_report.json
```

### 冲突路径Curl示例

#### 1. 重复确认冲突
```bash
curl -X POST "http://localhost:8000/api/v1/confirmations" \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": 1,
    "version_id": 1,
    "confirmed_by": "another_user@company.com",
    "confirmation_type": "start"
  }'
```

#### 2. 人工修正差异
```bash
curl -X POST "http://localhost:8000/api/v1/discrepancies/1/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "门店已完成价签更换，重新确认",
    "resolved_by": "admin@company.com",
    "correct_action": "reconfirm"
  }'
```

## 运行测试

```bash
pytest tests/ -v
```

## 数据模型

- **门店(Store)**: 门店ID、名称、编码、区域
- **价签版本(PriceTagVersion)**: 版本编码、名称、促销窗口、创建人
- **价签商品(PriceTagItem)**: 商品条码、原价、促销价
- **门店确认(Confirmation)**: 门店、版本、确认类型（开始/结束）、确认人
- **差异记录(Discrepancy)**: 异常路径记录、原始输入、处理人、处理结论
