# 水站桶押金流转API服务

提供桶装水配送站桶押金全流程管理的后端API服务，支持本地持久化存储。

## 功能特性

- **客户管理**: 创建、查询客户信息，跟踪押金和桶数量
- **桶号流转**: 管理桶的入库、出库、在途状态
- **押金管理**: 收押金、退押金、押金抵扣
- **配送管理**: 创建配送单，关联桶编号和押金
- **退桶管理**: 退桶记录，支持损坏扣款
- **重复拦截**: 同一单号重复提交自动拦截
- **异常处理**: 异常日志记录，支持人工处理
- **人工修正**: 支持押金和桶数量的人工调整
- **状态历史**: 所有操作状态变更记录
- **报表导出**: CSV格式报表导出

## 技术栈

- Node.js + Express
- SQLite (本地文件数据库)
- UUID (唯一标识生成)

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 导入样例数据
```bash
npm run seed-data
```

### 4. 启动服务
```bash
npm start
```

服务将在 http://localhost:3000 启动

## API接口文档

### 健康检查
```
GET /api/health
```

### 客户管理
```
POST /api/customers          - 创建客户
GET  /api/customers          - 客户列表（支持分页、搜索）
GET  /api/customers/:id      - 客户详情
```

**创建客户请求体:**
```json
{
  "name": "张三",
  "phone": "13800138001",
  "address": "北京市朝阳区..."
}
```

### 配送单管理
```
POST /api/delivery-orders              - 创建配送单（冻结押金，状态pending）
GET  /api/delivery-orders/:id          - 配送单详情
PUT  /api/delivery-orders/:id/confirm  - 确认配送单（押金入账，状态pending→completed）
PUT  /api/delivery-orders/:id/cancel   - 取消配送单（押金解冻，状态pending→cancelled）
```

**配送单状态流转:**
- `pending`: 已创建，押金已冻结但未正式入账
- `completed`: 已确认，押金正式入账，桶数量更新
- `cancelled`: 已取消，押金解冻，桶恢复库存

**创建配送单请求体:**
```json
{
  "customer_id": "客户ID",
  "bucket_count": 2,
  "bucket_nos": ["A0001", "A0002"],  // 可选，不指定则自动分配
  "deposit_amount": 100,             // 可选，默认按50元/桶计算
  "delivery_address": "配送地址",    // 可选
  "order_no": "DO20240115001",       // 可选，不指定自动生成
  "created_by": "操作员A",
  "remark": "备注"
}
```

**确认/取消配送单请求体:**
```json
{
  "operator": "操作员A"
}
```

### 退桶记录
```
POST /api/return-records     - 创建退桶记录
```

**创建退桶记录请求体:**
```json
{
  "customer_id": "客户ID",
  "bucket_nos": ["A0001", "A0002"],
  "deduction_amount": 10,          // 可选，扣款金额
  "deduction_reason": "桶壁损坏",  // 可选，扣款原因
  "operator": "操作员B",
  "remark": "备注"
}
```

### 桶管理
```
GET /api/buckets              - 桶列表（支持按状态、客户过滤）
```

### 状态历史
```
GET /api/status-history/:entityType/:entityId  - 获取实体状态历史
```
entityType: delivery_order, return_record, manual_correction

### 异常处理
```
GET  /api/exceptions          - 异常列表（支持按状态过滤）
PUT  /api/exceptions/:id      - 处理异常
```

**处理异常请求体:**
```json
{
  "handling_result": "已联系客户重新提交",
  "handled_by": "管理员"
}
```

### 人工修正
```
POST /api/manual-corrections  - 创建人工修正记录
```

**人工修正请求体:**
```json
{
  "customer_id": "客户ID",
  "correction_type": "deposit",  // 或 bucket_count
  "after_value": 200,
  "reason": "系统计算错误",
  "operator": "管理员",
  "related_exception_id": "异常记录ID"  // 可选
}
```

### 报表管理
```
GET  /api/reports/deposit          - 获取押金报表
GET  /api/reports/deposit/export   - 导出押金报表CSV
GET  /api/reports/customers/export - 导出客户报表CSV
GET  /api/reports/exceptions/export - 导出异常日志CSV
GET  /api/exports/:fileName         - 下载导出文件
```

## 验收测试流程

### 1. 正常流程测试
```bash
# 获取客户列表
curl http://localhost:3000/api/customers

# 创建配送单
curl -X POST http://localhost:3000/api/delivery-orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"...","bucket_count":2,"deposit_amount":100}'
```

### 2. 重复提交拦截测试
```bash
# 使用同一单号提交两次，第二次应被拦截
curl -X POST http://localhost:3000/api/delivery-orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"...","bucket_count":2,"order_no":"TEST001"}'

# 再次提交
curl -X POST http://localhost:3000/api/delivery-orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"...","bucket_count":2,"order_no":"TEST001"}'

# 查看异常日志
curl http://localhost:3000/api/exceptions
```

### 3. 异常场景测试
```bash
# 测试押金不足退款
curl -X POST http://localhost:3000/api/return-records \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"...","bucket_nos":["A0001"],"deduction_amount":1000}'
```

### 4. 人工修正测试
```bash
# 创建人工修正记录
curl -X POST http://localhost:3000/api/manual-corrections \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"...","correction_type":"deposit","after_value":200,"reason":"系统错误","operator":"管理员"}'
```

### 5. 状态历史和报表验证
```bash
# 查看状态历史
curl http://localhost:3000/api/status-history/delivery_order/{order_id}

# 查看押金报表
curl http://localhost:3000/api/reports/deposit

# 导出报表
curl http://localhost:3000/api/reports/deposit/export
```

## 数据库表结构

- **customers**: 客户表
- **buckets**: 桶表
- **delivery_orders**: 配送单表
- **deposit_orders_buckets**: 配送单-桶关联表
- **deposit_transactions**: 押金交易流水表
- **return_records**: 退桶记录表
- **exception_logs**: 异常日志表
- **status_history**: 状态历史表
- **manual_corrections**: 人工修正记录表

## 项目结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── routes/
│   │   └── index.js           # API路由
│   ├── controllers/
│   │   └── DepositController.js  # 控制器
│   ├── services/
│   │   ├── DepositService.js  # 核心业务逻辑
│   │   └── ExportService.js   # 导出服务
│   └── models/
│       └── database.js        # 数据库连接
├── scripts/
│   ├── init-db.js             # 数据库初始化脚本
│   ├── seed-data.js           # 样例数据脚本
│   └── api-test-examples.http # API测试示例
├── db/                        # 数据库文件目录
├── exports/                   # 导出文件目录
├── package.json
└── README.md
```
