# 幂等窗口调停API

## 项目简介

解决支付侧补发请求的幂等性问题，通过窗口匹配、载荷指纹、冲突裁决等机制，确保接口、状态和报告的一致性。

## 核心特性

- **请求号唯一性校验**：确保同一个请求号不会被重复处理
- **时间窗口机制**：在指定时间窗口内进行幂等检查
- **载荷指纹验证**：通过SHA256哈希对请求内容进行指纹比对
- **冲突自动检测**：相同幂等键但不同载荷时标记为冲突
- **历史结果复用**：相同请求直接返回历史结果
- **调停记录追踪**：完整记录所有状态变更和操作轨迹
- **人工修正接口**：支持人工介入处理冲突和异常
- **数据导出功能**：支持CSV格式导出请求和调停记录

## 状态枚举

| 状态 | 说明 |
|------|------|
| PENDING | 待处理 |
| PROCESSING | 处理中 |
| SUCCESS | 成功 |
| FAILED | 失败 |
| DUPLICATE | 重复请求 |
| CONFLICT | 冲突 |
| MANUAL_RESOLVED | 人工解决 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

开发模式（自动重启）:
```bash
npm run dev
```

服务默认运行在: `http://localhost:3000`

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

## API 接口文档

所有接口前缀: `/api/idempotent`

### 1. 创建请求

**POST** `/requests`

请求体:
```json
{
  "request_no": "PAY202401010001",
  "business_type": "PAYMENT",
  "idempotent_key": "ORDER123456",
  "time_window": 600,
  "payload": {
    "order_id": "ORDER123456",
    "amount": 100.00,
    "channel": "ALIPAY"
  }
}
```

调用示例:
```bash
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "PAY202401010001",
    "business_type": "PAYMENT",
    "idempotent_key": "ORDER123456",
    "time_window": 600,
    "payload": {
      "order_id": "ORDER123456",
      "amount": 100.00,
      "channel": "ALIPAY"
    }
  }'
```

### 2. 查询请求详情

**GET** `/requests/:request_no`

调用示例:
```bash
curl http://localhost:3000/api/idempotent/requests/PAY202401010001
```

### 3. 更新状态

**PUT** `/requests/:request_no/status`

请求体:
```json
{
  "status": "SUCCESS",
  "result": {
    "transaction_id": "TXN789012",
    "success": true
  },
  "operator": "payment-system"
}
```

调用示例:
```bash
curl -X PUT http://localhost:3000/api/idempotent/requests/PAY202401010001/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SUCCESS",
    "result": {
      "transaction_id": "TXN789012",
      "success": true
    },
    "operator": "payment-system"
  }'
```

### 4. 异常处理

**POST** `/requests/:request_no/exception`

请求体:
```json
{
  "exception_info": {
    "code": "CHANNEL_TIMEOUT",
    "message": "支付渠道超时",
    "stack_trace": "..."
  },
  "operator": "monitor-system"
}
```

调用示例:
```bash
curl -X POST http://localhost:3000/api/idempotent/requests/PAY202401010001/exception \
  -H "Content-Type: application/json" \
  -d '{
    "exception_info": {
      "code": "CHANNEL_TIMEOUT",
      "message": "支付渠道超时"
    },
    "operator": "monitor-system"
  }'
```

### 5. 人工修正

**POST** `/requests/:request_no/manual-correction`

请求体:
```json
{
  "status": "MANUAL_RESOLVED",
  "result": {
    "manual_note": "已核实为重复通知，忽略",
    "resolved_by": "operator_001"
  },
  "reason": "支付侧重复通知，实际支付已成功",
  "processing_basis": "银行对账单显示交易成功",
  "final_conclusion": "认定为重复通知，标记为已解决",
  "operator": "admin_001"
}
```

调用示例:
```bash
curl -X POST http://localhost:3000/api/idempotent/requests/PAY202401010001/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "status": "MANUAL_RESOLVED",
    "result": {
      "manual_note": "已核实为重复通知，忽略",
      "resolved_by": "operator_001"
    },
    "reason": "支付侧重复通知，实际支付已成功",
    "processing_basis": "银行对账单显示交易成功",
    "final_conclusion": "认定为重复通知，标记为已解决",
    "operator": "admin_001"
  }'
```

### 6. 查询请求列表

**GET** `/requests?business_type=PAYMENT&status=SUCCESS&page=1&page_size=20`

参数说明:
- `business_type`: 业务类型（可选）
- `status`: 状态（可选）
- `page`: 页码，默认1
- `page_size`: 每页数量，默认20，最大100

调用示例:
```bash
curl "http://localhost:3000/api/idempotent/requests?status=SUCCESS&page=1&page_size=10"
```

### 7. 查询调停记录

**GET** `/mediation-records?action=STATUS_CHANGE&page=1&page_size=20`

调用示例:
```bash
curl "http://localhost:3000/api/idempotent/mediation-records?action=CONFLICT_DETECTED"
```

### 8. 导出数据

**GET** `/export?export_type=both&business_type=PAYMENT`

参数说明:
- `export_type`: 导出类型 - requests/mediation/both，默认both
- `business_type`: 业务类型过滤（可选）
- `status`: 状态过滤（可选）
- `start_time`: 开始时间戳（可选）
- `end_time`: 结束时间戳（可选）

调用示例:
```bash
curl "http://localhost:3000/api/idempotent/export?export_type=both"
```

导出文件保存在 `exports/` 目录下。

## 被规则拦住的路径示例

### 场景1: 重复请求号

同一个请求号重复提交会被拦截:

```bash
# 第一次提交
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "DUPLICATE_TEST_001",
    "business_type": "PAYMENT",
    "idempotent_key": "KEY_DUPLICATE",
    "time_window": 600,
    "payload": {"amount": 100}
  }'

# 第二次提交同样的请求号，会被拦截
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "DUPLICATE_TEST_001",
    "business_type": "PAYMENT",
    "idempotent_key": "KEY_DUPLICATE",
    "time_window": 600,
    "payload": {"amount": 200}
  }'
```

返回结果:
```json
{
  "success": false,
  "code": "DUPLICATE_REQUEST_NO",
  "message": "请求号已存在",
  "data": {...}
}
```

### 场景2: 相同幂等键和载荷

在时间窗口内提交相同幂等键和相同载荷的请求，会自动复用历史结果:

```bash
# 第一次提交
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "REUSE_TEST_001",
    "business_type": "PAYMENT",
    "idempotent_key": "SAME_KEY_SAME_PAYLOAD",
    "time_window": 600,
    "payload": {"order_id": "ORDER_SAME", "amount": 100}
  }'

# 10分钟内提交相同幂等键和相同载荷的不同请求号
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "REUSE_TEST_002",
    "business_type": "PAYMENT",
    "idempotent_key": "SAME_KEY_SAME_PAYLOAD",
    "time_window": 600,
    "payload": {"order_id": "ORDER_SAME", "amount": 100}
  }'
```

返回结果:
```json
{
  "success": true,
  "code": "HISTORY_REUSED",
  "message": "相同幂等键和载荷，复用历史结果",
  "data": {...},
  "isReuse": true
}
```

### 场景3: 相同幂等键但不同载荷（冲突检测）

在时间窗口内提交相同幂等键但不同载荷的请求，会触发冲突检测:

```bash
# 第一次提交
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "CONFLICT_TEST_001",
    "business_type": "PAYMENT",
    "idempotent_key": "SAME_KEY_DIFF_PAYLOAD",
    "time_window": 600,
    "payload": {"order_id": "ORDER_DIFF_1", "amount": 100}
  }'

# 10分钟内提交相同幂等键但不同载荷的请求
curl -X POST http://localhost:3000/api/idempotent/requests \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "CONFLICT_TEST_002",
    "business_type": "PAYMENT",
    "idempotent_key": "SAME_KEY_DIFF_PAYLOAD",
    "time_window": 600,
    "payload": {"order_id": "ORDER_DIFF_2", "amount": 200}
  }'
```

返回结果:
```json
{
  "success": true,
  "code": "CONFLICT_CREATED",
  "message": "检测到冲突，已创建新请求并标记原请求为冲突",
  "data": {...},
  "conflict": true
}
```

## 项目结构

```
.
├── src/
│   ├── app.js                    # 应用入口
│   ├── config/
│   │   └── database.js           # 数据库配置
│   ├── controllers/
│   │   └── IdempotentController.js  # 控制器
│   ├── models/
│   │   ├── IdempotentRequest.js  # 请求模型
│   │   └── MediationRecord.js    # 调停记录模型
│   ├── routes/
│   │   └── idempotent.js         # 路由
│   ├── scripts/
│   │   └── init-db.js            # 数据库初始化脚本
│   └── services/
│       └── IdempotentMediationService.js  # 核心业务服务
├── data/                         # 数据库文件目录
├── exports/                      # 导出文件目录
├── package.json
└── README.md
```

## 统一响应格式

所有接口返回格式统一:

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {}
}
```

错误响应示例:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "请求号不能为空",
  "errors": [...]
}
```

## 常见错误码

| 错误码 | 说明 |
|--------|------|
| VALIDATION_ERROR | 参数验证错误 |
| DUPLICATE_REQUEST_NO | 请求号重复 |
| NOT_FOUND | 资源不存在 |
| INTERNAL_ERROR | 服务器内部错误 |
| HISTORY_REUSED | 历史结果复用 |
| CONFLICT_CREATED | 检测到冲突并创建新请求 |
