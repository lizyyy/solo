# 无人货柜补货结算 API

本地后端 API 服务，提供货柜补货、货损记录、临期下架、结算管理等功能。

## 技术栈

- **Python 3.7+**
- **FastAPI**: 高性能 Web 框架
- **SQLAlchemy**: ORM 框架
- **SQLite**: 本地持久化数据库
- **Uvicorn**: ASGI 服务器

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心功能

### 1. 数据模型

| 模型 | 说明 |
|------|------|
| Cabinet | 货柜信息 |
| SKUStock | SKU 库存 |
| ReplenishmentBatch | 补货批次 |
| ReplenishmentItem | 补货明细 |
| DamageRecord | 货损记录 |
| ExpiredRemoval | 临期下架记录 |
| OperatorConfirmation | 补货员确认 |
| SettlementSummary | 结算摘要 |
| InventorySnapshot | 库存快照 |
| ExceptionLog | 异常日志 |
| ManualCorrection | 人工修正记录 |

### 2. 核心业务规则

- **库存快照**: 创建补货单时自动记录当前库存状态
- **货损扣减**: 结算时自动扣除货损金额
- **临期下架**: 结算时自动扣除临期商品金额
- **幂等性**: 相同批次号或幂等键的重复请求返回现有数据
- **结算公式**: `最终结算金额 = 补货总金额 - 货损金额 - 临期金额`

### 3. API 接口

#### 货柜管理
- `POST /api/cabinets/` - 创建货柜
- `GET /api/cabinets/` - 查询货柜列表

#### 库存管理
- `GET /api/cabinets/{cabinet_no}/skus/` - 查询货柜 SKU 库存

#### 补货管理
- `POST /api/replenishments/` - 创建补货单（支持幂等）
- `GET /api/replenishments/` - 查询补货单列表
- `GET /api/replenishments/{batch_no}/` - 查询补货单详情
- `PATCH /api/replenishments/{batch_no}/status/` - 更新补货状态

#### 结算管理
- `POST /api/settlements/` - 创建结算单
- `GET /api/settlements/` - 查询结算单列表
- `GET /api/settlements/{settlement_no}/export/` - 导出结算数据

#### 人工修正
- `POST /api/manual-corrections/` - 创建人工修正
- `GET /api/manual-corrections/` - 查询修正记录

#### 异常日志
- `GET /api/exception-logs/` - 查询异常日志

## 使用样例

### 创建补货单

```json
{
  "batch_no": "BATCH001",
  "cabinet_no": "CAB001",
  "operator_id": "OP001",
  "operator_name": "张三",
  "idempotent_key": "unique_key_123",
  "items": [
    {
      "sku_code": "SKU001",
      "sku_name": "农夫山泉500ml",
      "replenish_quantity": 30,
      "unit_price": 2.0
    }
  ],
  "damages": [
    {
      "sku_code": "SKU001",
      "sku_name": "农夫山泉500ml",
      "damage_type": "破损",
      "quantity": 2,
      "unit_price": 2.0,
      "reason": "运输途中瓶身破损"
    }
  ],
  "expired_removals": [
    {
      "sku_code": "SKU001",
      "sku_name": "农夫山泉500ml",
      "quantity": 1,
      "unit_price": 2.0
    }
  ]
}
```

### 创建结算单

```json
{
  "settlement_no": "SET001",
  "cabinet_no": "CAB001",
  "batch_no": "BATCH001"
}
```

## 测试与自检

### 运行自检脚本

```bash
# 先启动服务
uvicorn main:app --host 0.0.0.0 --port 8000

# 新开终端运行测试
python test_api.py
```

### 测试覆盖范围

1. **正常流程测试**: 创建货柜 → 创建补货 → 状态确认 → 创建结算 → 导出
2. **幂等性测试**: 相同批次号、相同幂等键的重复请求处理
3. **脏数据测试**: 无效 JSON、缺失必填字段、无效状态的异常处理
4. **导出一致性测试**: 结算金额计算正确性验证
5. **人工修正测试**: 人工修正功能及记录保存

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # 数据模型
├── schemas.py           # Pydantic 数据验证
├── crud.py              # 业务逻辑
├── database.py          # 数据库配置
├── sample_data.py       # 样例数据生成
├── test_api.py          # 自检脚本
├── requirements.txt     # 依赖列表
└── README.md           # 项目说明
```

## 数据库

使用 SQLite 本地数据库，启动时自动创建，数据库文件为 `vending_machine.db`。

## 注意事项

1. 确保端口 8000 未被占用
2. 首次启动会自动创建数据库表
3. 异常请求会自动记录到异常日志表
4. 所有修改操作均会保存历史记录
