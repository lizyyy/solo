# 自助洗衣异常退款 API 服务

基于 Node.js + Express + SQLite 构建的本地后端 API 服务，用于处理自助洗衣机的异常退款申请。

## 功能特性

- 退款申请创建与查询
- 支付记录自动核验
- 启动事件智能匹配
- 退款状态机管理
- 重复申请幂等处理
- 人工信息修正
- 数据导出（JSON/CSV）
- 异常处理记录
- 本地 SQLite 数据持久化

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 基础路径

```
http://localhost:3000/api/refunds
```

### 接口列表

#### 1. 健康检查

```bash
GET /health
```

示例：
```bash
curl http://localhost:3000/health
```

---

#### 2. 创建退款申请

```bash
POST /api/refunds
Content-Type: application/json
```

请求体：
```json
{
  "machine_id": "WASH-001",
  "payment_id": "PAY-20240515-001",
  "fault_code": "E001",
  "fault_screenshot": "screenshot.jpg",
  "applicant_name": "张三",
  "applicant_phone": "13800138001",
  "reason": "机器无法启动，显示故障代码",
  "amount": 8.00
}
```

正常路径示例（成功创建）：
```bash
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-002",
    "fault_code": "E002",
    "applicant_name": "李四",
    "amount": 8.00
  }'
```

异常路径示例 1 - 支付核验失败：
```bash
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-NONEXIST",
    "amount": 8.00
  }'
```

异常路径示例 2 - 机器不一致校验：
```bash
# 支付 PAY-20240515-001 属于 WASH-001，却用 WASH-002 申请退款
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-002",
    "payment_id": "PAY-20240515-001",
    "amount": 8.00
  }'
```

异常路径示例 3 - 重复申请（幂等性）：
```bash
# 连续提交两次相同支付的申请
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-002",
    "amount": 8.00
  }'

# 再次提交，会提示重复申请
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-002",
    "amount": 8.00
  }'
```

---

#### 3. 查询退款列表

```bash
GET /api/refunds?status={status}&machine_id={machine_id}
```

示例：
```bash
# 查询所有退款
curl http://localhost:3000/api/refunds

# 按状态筛选
curl "http://localhost:3000/api/refunds?status=completed"

# 按机器筛选
curl "http://localhost:3000/api/refunds?machine_id=WASH-001"
```

---

#### 4. 查询单条退款详情

```bash
GET /api/refunds/:refundId
```

示例：
```bash
curl http://localhost:3000/api/refunds/REF-001
```

---

#### 5. 更新退款状态

```bash
PUT /api/refunds/:refundId/status
Content-Type: application/json
```

请求体：
```json
{
  "status": "approved",
  "operator": "admin",
  "remarks": "审核通过，情况属实"
}
```

状态流转说明：
- pending → verifying | rejected
- verifying → approved | rejected
- approved → refunding | rejected
- refunding → completed | failed
- completed → （终态）
- rejected → （终态）
- failed → pending | verifying （可重试）

示例：
```bash
# 先创建一个新的退款申请
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-002",
    "amount": 8.00
  }'

# 记录返回的 refund_id，替换下面的 <refund_id>
curl -X PUT http://localhost:3000/api/refunds/<refund_id>/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "operator": "admin",
    "remarks": "故障属实，同意退款"
  }'
```

异常路径示例 - 无效的状态流转：
```bash
curl -X PUT http://localhost:3000/api/refunds/REF-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending",
    "operator": "admin"
  }'
```

---

#### 6. 人工修正退款信息

```bash
PATCH /api/refunds/:refundId/correct
Content-Type: application/json
```

请求体：
```json
{
  "amount": 10.00,
  "reason": "修正后的退款原因",
  "operator": "admin"
}
```

示例：
```bash
curl -X PATCH http://localhost:3000/api/refunds/REF-001/correct \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.00,
    "reason": "人工核实后调整退款金额",
    "operator": "admin"
  }'
```

---

#### 7. 查询处理日志

```bash
GET /api/refunds/:refundId/logs
```

示例：
```bash
curl http://localhost:3000/api/refunds/REF-001/logs
```

---

#### 8. 记录异常

```bash
POST /api/refunds/:refundId/exception
Content-Type: application/json
```

请求体：
```json
{
  "error_details": {
    "code": "PAYMENT_GATEWAY_ERROR",
    "message": "支付通道连接超时"
  },
  "operator": "system"
}
```

示例：
```bash
curl -X POST http://localhost:3000/api/refunds/REF-001/exception \
  -H "Content-Type: application/json" \
  -d '{
    "error_details": {
      "code": "PAYMENT_GATEWAY_ERROR",
      "message": "支付通道连接超时"
    },
    "operator": "system"
  }'
```

---

#### 9. 导出退款数据

```bash
GET /api/refunds/export?format={json|csv}&status={status}&start_date={date}&end_date={date}
```

示例：
```bash
# JSON 格式导出
curl "http://localhost:3000/api/refunds/export"

# CSV 格式导出
curl "http://localhost:3000/api/refunds/export?format=csv" -o refunds.csv

# 按条件筛选导出
curl "http://localhost:3000/api/refunds/export?status=completed&format=csv" -o completed_refunds.csv
```

## 样例数据说明

初始化后，数据库中包含以下测试数据：

### 机器
- WASH-001 - 1号楼洗衣房A区 (active)
- WASH-002 - 1号楼洗衣房A区 (active)
- WASH-003 - 2号楼洗衣房B区 (maintenance)
- DRY-001 - 1号楼洗衣房A区 (active)

### 支付记录
- PAY-20240515-001 - WASH-001, 8元, 有故障记录
- PAY-20240515-002 - WASH-001, 8元, 有故障记录
- PAY-20240515-003 - WASH-002, 12元, 启动成功
- PAY-20240515-004 - WASH-001, 8元, 已退款状态

### 故障代码
- E001: 电机启动失败 (高严重度, 支持自动退款)
- E002: 进水阀故障 (高严重度, 支持自动退款)
- E003: 排水超时 (中严重度, 支持自动退款)
- E004: 温度传感器异常 (低严重度, 不支持自动退款)
- E005: 门开关故障 (中严重度, 不支持自动退款)

### 退款申请
- REF-001 - 已完成的退款申请，带有完整处理日志

## 坏数据测试路径

以下是一些可以测试的异常场景：

### 1. 参数验证失败
```bash
# 缺少必填字段
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{"machine_id": "WASH-001"}'

# 金额为负数
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-001",
    "amount": -5.00
  }'
```

### 2. 支付记录不存在或状态异常
```bash
# 支付流水中的支付状态为refunded，不是success
curl -X POST http://localhost:3000/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "WASH-001",
    "payment_id": "PAY-20240515-004",
    "amount": 8.00
  }'
```

### 3. 退款申请不存在
```bash
curl http://localhost:3000/api/refunds/NONEXISTENT_REFUND
```

### 4. 无效的状态值
```bash
curl -X PUT http://localhost:3000/api/refunds/REF-001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid_status", "operator": "admin"}'
```

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── models/
│   │   ├── Refund.js            # 退款模型
│   │   ├── Payment.js           # 支付模型
│   │   └── StartEvent.js        # 启动事件模型
│   ├── services/
│   │   └── refundService.js     # 业务逻辑服务
│   ├── controllers/
│   │   └── refundController.js  # API 控制器
│   ├── middleware/
│   │   └── validation.js        # 请求验证中间件
│   ├── routes/
│   │   └── refundRoutes.js      # 路由定义
│   └── server.js                # 服务入口
├── scripts/
│   └── initData.js              # 样例数据初始化
├── data/                        # SQLite 数据库文件目录
├── package.json
└── README.md
```

## 核心业务规则

1. **支付核验**：创建退款前自动核验支付记录是否存在且状态为成功
2. **机器一致性校验**：确保退款申请的机器编号与支付记录所属机器一致，防止串号退款
3. **启动事件匹配**：自动匹配支付对应的启动故障事件
4. **退款状态机**：严格的状态流转控制，防止非法状态跳转
5. **重复申请幂等**：同一支付在存在活跃退款申请时，拒绝重复创建
6. **异常记录**：所有异常路径都会保存原始输入和处理结论
7. **操作留痕**：所有状态变更和人工操作都有完整日志记录

## 技术栈

- **运行时**: Node.js
- **Web 框架**: Express.js
- **数据库**: SQLite3
- **数据验证**: Joi
- **CSV 导出**: json2csv
- **唯一 ID**: uuid

## 注意事项

- 数据库文件存储在 `data/` 目录下
- 首次启动会自动创建数据库表结构
- 所有时间字段使用本地时间
- CSV 导出包含 BOM 头，兼容 Excel 中文显示
