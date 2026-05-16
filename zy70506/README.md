# 审批回调补偿 API 服务

解决审批系统偶尔漏发回调导致业务单据卡在等待中的问题，替代聊天和表格推进的低效流程。

## 核心特性

- ✅ **数据模型**: 审批单号、业务单据、回调事件、补偿动作、重试次数、补偿结果
- ✅ **关键规则**: 回调缺口识别、补偿互斥、重试幂等、人工确认、结果报告
- ✅ **失败审计**: 保留原始输入、处理依据、最终结论完整链路
- ✅ **接口覆盖**: 创建、查询、状态推进、异常处理、人工修正、导出

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## 接口文档

### 基础信息

- 健康检查: `GET /health`
- API 前缀: `/api/compensation`

### 1. 创建补偿记录

```bash
curl -X POST http://localhost:3000/api/compensation \
  -H "Content-Type: application/json" \
  -d '{
    "approval_no": "AP20240515001",
    "business_order_no": "BIZ20240515001",
    "callback_event": "APPROVAL_PASS",
    "compensation_action": "RETRY_CALLBACK",
    "created_by": "zhangsan",
    "raw_input": {
      "orderId": "BIZ20240515001",
      "status": "APPROVED",
      "operator": "admin",
      "amount": 50000
    },
    "max_retry": 3
  }'
```

### 2. 查询补偿列表

```bash
curl "http://localhost:3000/api/compensation?status=PENDING&page=1&page_size=10"
```

### 3. 查询单条补偿详情

```bash
curl http://localhost:3000/api/compensation/{id}
```

### 4. 查看补偿操作日志

```bash
curl http://localhost:3000/api/compensation/{id}/logs
```

### 5. 识别回调缺口

```bash
curl -X POST http://localhost:3000/api/compensation/identify-gap \
  -H "Content-Type: application/json" \
  -d '{
    "approvals": [
      {
        "approval_no": "AP20240515002",
        "business_order_no": "BIZ20240515002",
        "expected_events": ["APPROVAL_PASS", "APPROVAL_REJECT"]
      }
    ]
  }'
```

### 6. 开始补偿执行

```bash
curl -X POST http://localhost:3000/api/compensation/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"operator": "lisi"}'
```

### 7. 执行补偿处理

```bash
curl -X POST http://localhost:3000/api/compensation/{id}/process \
  -H "Content-Type: application/json" \
  -d '{
    "processing_evidence": {
      "request_id": "req_123456",
      "target_system": "order-service",
      "retry_time": "2024-05-15T10:30:00Z",
      "request_payload": {"status": "APPROVED"}
    }
  }'
```

### 8. 人工修正

```bash
curl -X POST http://localhost:3000/api/compensation/{id}/manual-fix \
  -H "Content-Type: application/json" \
  -d '{
    "handled_by": "wangwu",
    "final_conclusion": {
      "result": "MANUAL_FIXED",
      "fix_method": "DIRECT_DATABASE_UPDATE",
      "fix_time": "2024-05-15T11:00:00Z",
      "remark": "已直接更新数据库状态，无需回调"
    },
    "raw_input_override": {
      "orderId": "BIZ20240515001",
      "status": "MANUALLY_PROCESSED"
    }
  }'
```

### 9. 取消补偿

```bash
curl -X POST http://localhost:3000/api/compensation/{id}/cancel \
  -H "Content-Type: application/json" \
  -d '{"operator": "zhaoliu", "reason": "业务单据已作废，无需补偿"}'
```

### 10. 导出CSV

```bash
curl -o compensation_export.csv "http://localhost:3000/api/compensation/export?status=SUCCESS"
```

### 11. 获取状态枚举

```bash
curl http://localhost:3000/api/compensation/constants/status
```

## 被规则拦住的路径示例

### 场景1: 补偿互斥 - 重复创建

同一审批单的同一回调事件只能创建一条补偿记录：

```bash
# 第一次创建，成功
curl -X POST http://localhost:3000/api/compensation \
  -H "Content-Type: application/json" \
  -d '{
    "approval_no": "AP20240101001",
    "business_order_no": "BIZ20240101001",
    "callback_event": "APPROVAL_PASS",
    "compensation_action": "RETRY_CALLBACK",
    "created_by": "zhangsan"
  }'

# 第二次创建，被规则拦截
# 返回 409 DUPLICATE_COMPENSATION: 该审批单 AP20240101001 的 APPROVAL_PASS 回调补偿已存在
```

### 场景2: 补偿进行中互斥

状态为 `PROCESSING` 的记录禁止重复开始：

```bash
# 第一次开始，成功
curl -X POST http://localhost:3000/api/compensation/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"operator": "lisi"}'

# 第二次开始，被规则拦截
# 返回 409 COMPENSATION_IN_PROGRESS: 补偿正在进行中，禁止重复操作
```

### 场景3: 状态流转校验 - 已成功的记录无法操作

终态记录（SUCCESS, MANUAL_FIXED, CANCELLED）禁止状态变更：

```bash
# 对已 SUCCESS 的记录尝试开始补偿
curl -X POST http://localhost:3000/api/compensation/{success_id}/start \
  -H "Content-Type: application/json" \
  -d '{"operator": "lisi"}'

# 返回 400 INVALID_STATUS_TRANSITION: 当前状态 SUCCESS 无法开始补偿
```

### 场景4: 最大重试次数限制

超过最大重试次数后自动转入人工确认：

```bash
# 假设 max_retry = 3，已重试 3 次
curl -X POST http://localhost:3000/api/compensation/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"operator": "lisi"}'

# 返回 400 MAX_RETRY_EXCEEDED: 已达最大重试次数 3，需要人工确认
```

### 场景5: 人工修正的状态限制

只有 `NEED_MANUAL_CONFIRM` 状态才能进行人工修正：

```bash
# 对 PENDING 状态的记录尝试人工修正
curl -X POST http://localhost:3000/api/compensation/{pending_id}/manual-fix \
  -H "Content-Type: application/json" \
  -d '{"handled_by": "wangwu", "final_conclusion": {"result": "FIXED"}}'

# 返回 400 INVALID_STATUS: 只有 NEED_MANUAL_CONFIRM 状态才能进行人工修正
```

## 状态流转图

```
PENDING → PROCESSING → SUCCESS (终态)
                ↓
              FAILED → PROCESSING (可重试)
                ↓
        NEED_MANUAL_CONFIRM → MANUAL_FIXED (终态)
                ↓
            CANCELLED (终态)
```

## 状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| PENDING | 待处理 | 开始补偿、取消 |
| PROCESSING | 处理中 | 执行补偿 |
| SUCCESS | 补偿成功 | 无（终态） |
| FAILED | 补偿失败 | 重试、取消 |
| NEED_MANUAL_CONFIRM | 需要人工确认 | 人工修正、取消 |
| MANUAL_FIXED | 人工修正完成 | 无（终态） |
| CANCELLED | 已取消 | 无（终态） |

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── database/
│   │   └── index.js           # 数据库连接和初始化
│   ├── services/
│   │   └── compensationService.js  # 核心业务逻辑
│   ├── routes/
│   │   └── compensation.js    # API 路由
│   └── scripts/
│       └── initData.js        # 样例数据初始化
├── data/                      # SQLite 数据库文件目录
├── package.json
└── README.md
```

## 错误响应格式

所有接口错误响应格式统一，可直接看懂：

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述信息",
  "details": {
    "具体错误详情": "可选"
  }
}
```

### 常见错误码

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| VALIDATION_ERROR | 400 | 参数验证失败 |
| NOT_FOUND | 404 | 资源不存在 |
| DUPLICATE_COMPENSATION | 409 | 补偿记录重复（幂等） |
| COMPENSATION_IN_PROGRESS | 409 | 补偿进行中（互斥） |
| INVALID_STATUS_TRANSITION | 400 | 状态流转非法 |
| MAX_RETRY_EXCEEDED | 400 | 超过最大重试次数 |
| INVALID_STATUS | 400 | 状态不允许该操作 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |