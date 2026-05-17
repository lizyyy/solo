# 称重价格扣杂结算复核系统

基于 FastAPI + SQLite 的称重价格扣杂结算复核后端API系统，完整实现了重量复核、价格版本控制、扣杂计算、重复结算拦截、审计日志和报告导出功能。

## 核心功能

### 业务规则
- **重量复核**: 毛重必须大于0，皮重不能为负，毛重必须大于皮重
- **价格版本**: 每个品类的价格带版本控制，新价格自动升级版本
- **扣杂计算**: 按比例自动计算扣杂重量和净重
- **重复结算拦截**: 已结算的称重记录不能再次结算
- **状态流转**: weighed → priced → deducted → settled → reviewed/closed

### 异常审计（核心新增）
- **失败操作全部可追溯**: 非法重量、重复结算、状态错误、权限校验等所有异常分支全部记录审计日志
- **原始输入保留**: 异常请求的原始输入数据完整保存，用于客户质疑时举证
- **操作人追踪**: 每个失败操作都记录操作员信息
- **错误原因留存**: 记录详细的错误信息和处理结论
- **审计字段**:
  - `is_success`: 操作是否成功 (0=失败, 1=成功)
  - `error_message`: 失败原因
  - `original_data`: 原始请求数据
  - `operator`: 操作人
  - `weighing_id`: 关联称重记录（可选）

### 审计日志查询 API
```bash
# 查询全部审计日志（含失败操作）
curl -X GET "http://localhost:8000/api/audits/"

# 查询指定称重记录的所有审计日志
curl -X GET "http://localhost:8000/api/audits/?weighing_id=1"

# 查询失败操作记录
curl -X GET "http://localhost:8000/api/audits/" | jq '.[] | select(.is_success == 0)'
```

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

### 3. 造数（生成测试数据）
```bash
python seed_data.py
```

## 主流程 Curl 示例

### 1. 创建客户
```bash
curl -X POST "http://localhost:8000/api/customers/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三农场",
    "phone": "13800138001",
    "contact": "张三",
    "address": "北京市朝阳区"
  }'
```

### 2. 创建品类
```bash
curl -X POST "http://localhost:8000/api/categories/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "玉米",
    "code": "CORN001",
    "description": "黄玉米"
  }'
```

### 3. 创建价格（带版本）
```bash
curl -X POST "http://localhost:8000/api/prices/" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": 1,
    "price": 2.5,
    "effective_date": "2024-01-01T00:00:00",
    "created_by": "管理员"
  }'
```

### 4. 创建扣杂比例（带版本）
```bash
curl -X POST "http://localhost:8000/api/deductions/" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": 1,
    "name": "标准扣杂",
    "ratio": 0.02,
    "effective_date": "2024-01-01T00:00:00",
    "created_by": "管理员"
  }'
```

### 5. 创建称重记录
```bash
curl -X POST "http://localhost:8000/api/weighings/" \
  -H "Content-Type: application/json" \
  -d '{
    "record_no": "W20240101001",
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1000,
    "tare_weight": 300,
    "weigher": "小李",
    "created_by": "管理员"
  }'
```

### 6. 设置价格
```bash
curl -X POST "http://localhost:8000/api/weighings/1/set-price" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": 1,
    "operator": "计价员"
  }'
```

### 7. 设置扣杂
```bash
curl -X POST "http://localhost:8000/api/weighings/1/set-deduction" \
  -H "Content-Type: application/json" \
  -d '{
    "deduction_id": 1,
    "operator": "扣杂员"
  }'
```

### 8. 结算
```bash
curl -X POST "http://localhost:8000/api/settlements/" \
  -H "Content-Type: application/json" \
  -d '{
    "settlement_no": "S20240101001",
    "customer_id": 1,
    "weighing_ids": [1],
    "settled_by": "结算员"
  }'
```

### 9. 复核
```bash
curl -X POST "http://localhost:8000/api/settlements/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "主管",
    "approved": true,
    "remarks": "数据无误，复核通过"
  }'
```

### 10. 导出结算报告
```bash
curl -X GET "http://localhost:8000/api/export/settlement/1" \
  -o settlement_report.json
```

## 冲突路径 Curl 示例

### 1. 重量验证失败（毛重小于皮重）
```bash
curl -X POST "http://localhost:8000/api/weighings/" \
  -H "Content-Type: application/json" \
  -d '{
    "record_no": "W20240101002",
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 300,
    "tare_weight": 1000,
    "weigher": "小李",
    "created_by": "管理员"
  }'
```
**预期结果**: 400 错误，提示"毛重必须大于皮重"

### 2. 重复结算拦截
```bash
# 先结算一次（假设称重记录已完成扣杂）
curl -X POST "http://localhost:8000/api/settlements/" \
  -H "Content-Type: application/json" \
  -d '{
    "settlement_no": "S20240101001",
    "customer_id": 1,
    "weighing_ids": [1],
    "settled_by": "结算员"
  }'

# 尝试再次结算同一条记录
curl -X POST "http://localhost:8000/api/settlements/" \
  -H "Content-Type: application/json" \
  -d '{
    "settlement_no": "S20240101002",
    "customer_id": 1,
    "weighing_ids": [1],
    "settled_by": "结算员"
  }'
```
**预期结果**: 400 错误，提示"称重记录 1 已结算，重复结算拦截"

### 3. 已取消记录无法修改
```bash
# 先取消称重记录
curl -X POST "http://localhost:8000/api/weighings/1/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "主管",
    "reason": "客户取消"
  }'

# 尝试设置价格
curl -X POST "http://localhost:8000/api/weighings/1/set-price" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": 1,
    "operator": "计价员"
  }'
```
**预期结果**: 400 错误，提示"称重记录已关闭或取消，无法修改"

### 4. 未结算记录不能关闭
```bash
curl -X POST "http://localhost:8000/api/weighings/1/close" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "主管",
    "reason": "关闭"
  }'
```
**预期结果**: 400 错误，提示"未结算记录不能关闭，请先结算"

### 5. 已结算记录无法人工修正
```bash
curl -X POST "http://localhost:8000/api/weighings/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "gross_weight": 1200,
    "operator": "主管",
    "reason": "修正"
  }'
```
**预期结果**: 400 错误，提示"称重记录已结算，无法修改"

### 6. 扣杂前必须先设置价格
```bash
# 创建新的称重记录
curl -X POST "http://localhost:8000/api/weighings/" \
  -H "Content-Type: application/json" \
  -d '{
    "record_no": "W20240101003",
    "customer_id": 1,
    "category_id": 1,
    "gross_weight": 1000,
    "tare_weight": 300,
    "weigher": "小李",
    "created_by": "管理员"
  }'

# 直接设置扣杂（跳过价格）
curl -X POST "http://localhost:8000/api/weighings/2/set-deduction" \
  -H "Content-Type: application/json" \
  -d '{
    "deduction_id": 1,
    "operator": "扣杂员"
  }'
```
**预期结果**: 400 错误，提示"请先设置价格"

## 审计日志查询

```bash
# 查询称重记录的完整审计日志
curl -X GET "http://localhost:8000/api/audits/?weighing_id=1"
```

## Pytest 测试

### 运行所有测试
```bash
pytest test_api.py -v
```

### 运行指定测试类
```bash
pytest test_api.py::TestWeighing -v
```

### 运行指定测试用例
```bash
pytest test_api.py::TestSettlement::test_duplicate_settlement_block -v
```

### 生成测试覆盖率报告
```bash
pytest test_api.py --cov=. --cov-report=html
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── database.py          # 数据库配置
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据验证
├── routers/             # API 路由
│   ├── customer.py      # 客户管理
│   ├── category.py      # 品类管理
│   ├── weighing.py      # 称重记录
│   ├── price.py         # 价格管理
│   ├── deduction.py     # 扣杂管理
│   ├── settlement.py    # 结算管理
│   ├── audit.py         # 审计日志
│   └── export.py        # 报告导出
├── seed_data.py         # 造数脚本
├── test_api.py          # pytest 测试用例
├── requirements.txt     # 依赖列表
└── README.md            # 说明文档
```

## 状态流转说明

```
称重记录创建 → weighed
    ↓
设置价格 → priced
    ↓  
设置扣杂 → deducted
    ↓
结算 → settled
    ↓
复核通过 → reviewed
    ↓
关闭 → closed

可随时取消 → cancelled
```

## 数据模型关系

- **客户 (Customer)**: 1对多 称重记录
- **品类 (Category)**: 1对多 称重记录、价格、扣杂比例
- **称重记录 (WeighingRecord)**: 关联1个客户、1个品类、1个价格、1个扣杂比例、1个结算
- **价格 (Price)**: 带版本控制，每个品类可有多个价格版本
- **扣杂比例 (DeductionRatio)**: 带版本控制
- **结算 (Settlement)**: 1对多 称重记录
- **审计日志 (AuditLog)**: 每条称重记录有多条操作日志
