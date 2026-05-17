# 无人货柜库存快照货损补货结算后端API

## 项目介绍

本系统实现了无人货柜的完整库存管理、补货流程、货损处理、临期下架和结算功能，解决了只看总销量不考虑损耗的问题。

### 核心功能

- **库存快照**: 记录每个时间点的库存状态
- **补货管理**: 支持创建补货单、补货员确认、幂等处理
- **货损处理**: 记录货损、审核确认、结算时自动扣除
- **临期下架**: 处理临期商品，记录损耗
- **结算管理**: 生成结算报告，包含销售额、货损金额、临期损失
- **人工修正**: 支持库存盘点修正
- **操作日志**: 所有操作留痕，异常保留原始输入

## 技术栈

- FastAPI: Web框架
- SQLAlchemy: ORM
- SQLite: 数据库
- Pydantic: 数据验证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或者使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 造数脚本

```bash
pip install requests
python seed_data.py
```

## API 主流程示例 (curl)

### 基础数据管理

```bash
# 创建货柜
curl -X POST "http://localhost:8000/cabinets/" \
  -H "Content-Type: application/json" \
  -d '{"cabinet_no": "CAB001", "location": "一楼大厅"}'

# 创建SKU
curl -X POST "http://localhost:8000/skus/" \
  -H "Content-Type: application/json" \
  -d '{"sku_code": "SKU001", "name": "可乐", "price": 3.0, "unit": "瓶"}'

# 创建库存快照
curl -X POST "http://localhost:8000/inventory/snapshots/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "sku_code": "SKU001",
    "quantity": 50,
    "batch_no": "B20240101",
    "created_by": "admin"
  }'
```

### 补货流程

```bash
# 创建补货单
curl -X POST "http://localhost:8000/replenishments/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "replenishment_no": "REP20240115001",
    "items": [
      {"sku_code": "SKU001", "quantity": 20, "batch_no": "B20240115"}
    ],
    "remark": "日常补货",
    "operator_id": "OP001",
    "operator_name": "张三"
  }'

# 确认补货单
curl -X POST "http://localhost:8000/replenishments/REP20240115001/confirm" \
  -H "Content-Type: application/json" \
  -d '{"operator_id": "OP001", "operator_name": "张三"}'

# 查询补货单列表
curl "http://localhost:8000/replenishments/?status=confirmed"
```

### 货损处理流程

```bash
# 创建货损记录
curl -X POST "http://localhost:8000/damages/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "sku_code": "SKU001",
    "quantity": 2,
    "damage_type": "包装破损",
    "reason": "运输过程中挤压",
    "reporter_id": "OP001",
    "reporter_name": "张三"
  }'

# 确认货损记录（假设返回的damage_no是DMxxxxxxxxxx）
curl -X POST "http://localhost:8000/damages/DMxxxxxxxxxx/confirm" \
  -H "Content-Type: application/json" \
  -d '{"confirmer_id": "MGR001", "confirmer_name": "经理"}'
```

### 临期下架流程

```bash
# 创建临期下架记录
curl -X POST "http://localhost:8000/expired-products/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "sku_code": "SKU001",
    "quantity": 3,
    "batch_no": "B20231201",
    "operator_id": "OP001",
    "operator_name": "张三"
  }'

# 确认临期下架
curl -X POST "http://localhost:8000/expired-products/EXxxxxxxxxxx/confirm"
```

### 结算流程

```bash
# 创建结算单
curl -X POST "http://localhost:8000/settlements/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "settlement_no": "SET202401",
    "period_start": "2024-01-01T00:00:00",
    "period_end": "2024-01-31T23:59:59",
    "created_by": "finance"
  }'

# 确认结算单
curl -X POST "http://localhost:8000/settlements/SET202401/confirm" \
  -H "Content-Type: application/json" \
  -d '{"confirmed_by": "finance_manager"}'

# 导出结算单CSV
curl -O "http://localhost:8000/settlements/SET202401/export?format=csv"
```

### 人工修正

```bash
curl -X POST "http://localhost:8000/corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "sku_code": "SKU001",
    "quantity": 65,
    "reason": "盘点后发现实际库存多1件",
    "operator_id": "OP001",
    "operator_name": "张三"
  }'
```

### 撤回/关闭结算单

```bash
curl -X POST "http://localhost:8000/settlements/SET202401/close" \
  -H "Content-Type: application/json" \
  -d '{
    "settlement_no": "SET202401",
    "reason": "发现数据错误需要重新核算",
    "operator_id": "ADMIN001",
    "operator_name": "管理员"
  }'
```

### 查询操作日志

```bash
curl "http://localhost:8000/operation-logs/?status=success"
curl "http://localhost:8000/operation-logs/?status=failed"
```

## 冲突路径示例

### 1. 重复补货（幂等校验）

```bash
# 第一次创建补货单
curl -X POST "http://localhost:8000/replenishments/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "replenishment_no": "REPTEST001",
    "items": [{"sku_code": "SKU001", "quantity": 10}]
  }'

# 再次使用相同单号创建会返回400错误
curl -X POST "http://localhost:8000/replenishments/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "CAB001",
    "replenishment_no": "REPTEST001",
    "items": [{"sku_code": "SKU001", "quantity": 20}]
  }'
# 返回: {"detail":"补货单号已存在，幂等校验通过"}
```

### 2. 重复确认状态检查

```bash
# 尝试确认一个已确认的补货单
curl -X POST "http://localhost:8000/replenishments/REP20240115001/confirm" \
  -H "Content-Type: application/json" \
  -d '{"operator_id": "OP002", "operator_name": "李四"}'
# 返回: {"detail":"补货单状态不允许确认"}
```

### 3. 不存在的货柜/商品

```bash
curl -X POST "http://localhost:8000/inventory/snapshots/" \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_no": "NONEXIST",
    "sku_code": "SKU001",
    "quantity": 100
  }'
# 返回: {"detail":"货柜不存在"}
```

## 运行测试

```bash
pytest test_api.py -v
```

测试覆盖率：
- 基础CRUD操作
- 业务流程（补货、货损、临期、结算）
- 异常路径处理
- 幂等性校验
- 状态机流转

## 核心数据模型

### Cabinet (货柜)
- cabinet_no: 货柜编号（唯一）
- location: 位置
- status: 状态

### SKU (商品)
- sku_code: SKU编码（唯一）
- name: 商品名称
- price: 单价
- unit: 单位

### InventorySnapshot (库存快照)
- cabinet_id: 关联货柜
- sku_id: 关联商品
- quantity: 数量
- batch_no: 批次号
- snapshot_time: 快照时间

### Replenishment (补货单)
- replenishment_no: 补货单号（唯一）
- status: pending/confirmed/cancelled
- operator_id/name: 补货员
- confirmed_at: 确认时间

### DamageRecord (货损记录)
- damage_no: 货损编号（唯一）
- quantity: 货损数量
- damage_type: 货损类型
- reason: 原因
- status: pending/confirmed

### ExpiredProduct (临期下架)
- record_no: 记录编号（唯一）
- quantity: 下架数量
- batch_no: 批次
- status: pending/confirmed

### Settlement (结算单)
- settlement_no: 结算单号（唯一）
- period_start/end: 结算周期
- status: draft/confirmed/closed
- total_sales: 总销售额
- total_damage_loss: 总货损金额
- total_expired_loss: 总临期损失
- net_amount: 净结算金额

### OperationLog (操作日志)
- operation_type: 操作类型
- ref_no: 关联单号
- original_input: 原始输入（JSON）
- operator_id/name: 操作人
- conclusion: 处理结论
- status: success/failed
- error_message: 错误信息

## 结算公式

```
净结算金额 = 销售额 - 货损金额 - 临期损失

其中：
- 销售额 = Σ(销售数量 × 商品单价)
- 货损金额 = Σ(货损数量 × 商品单价)
- 临期损失 = Σ(临期下架数量 × 商品单价)
```

## 注意事项

1. 所有单号必须全局唯一
2. 状态流转有严格校验，不能跳步
3. 异常操作会完整记录原始请求便于追溯
4. 结算单确认后建议不再修改，如需修改先关闭再创建新的
