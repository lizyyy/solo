# 异常订单冻结API

风控发现异常订单后，先冻结履约动作，等人工复核后再释放或取消的完整解决方案。

## 核心特性

- ✅ **订单冻结管理**：创建、查询、状态流转
- ✅ **履约拦截**：冻结期间拦截所有履约操作
- ✅ **复核流程**：提交复核、审核通过/拒绝
- ✅ **释放幂等**：重复操作不产生副作用
- ✅ **异常处理**：保留原始输入和处理依据
- ✅ **操作审计**：完整的操作日志追踪
- ✅ **人工修正**：支持特殊情况人工干预
- ✅ **数据导出**：CSV/JSON格式导出，支持审计
- ✅ **持久化存储**：重启服务数据不丢失

## 技术栈

- Node.js + Express
- SQLite (嵌入式数据库)
- Joi (参数验证)
- csv-writer (数据导出)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 3. 运行测试

```bash
# 先启动服务，然后开新终端运行
npm test
```

## API 接口文档

### 基础信息

- 基础路径: `http://localhost:3000/api/freeze`
- 请求头: `Content-Type: application/json`
- 操作人标识: `x-operator: 用户名` (可选，默认system)

### 接口列表

#### 1. 创建订单冻结

```
POST /api/freeze
```

**请求体:**
```json
{
  "orderNo": "ORDER123456",
  "riskReason": "风控规则触发：订单金额异常",
  "freezeAction": "ALL",
  "freezeActionDetails": "暂停履约、冻结支付",
  "releaseCondition": "人工审核通过后释放",
  "processingBasis": "风控系统规则v2.3"
}
```

**冻结动作类型:**
- `ALL`: 全部冻结
- `STOP_FULFILLMENT`: 停止履约
- `HOLD_PAYMENT`: 冻结支付
- `SUSPEND_DELIVERY`: 暂停发货
- `BLOCK_REFUND`: 阻止退款

#### 2. 查询冻结记录详情

```
GET /api/freeze/{id}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_no": "ORDER123456",
    "status": "FROZEN",
    "risk_reason": "...",
    "operationLogs": [...],
    "fulfillmentIntercepts": [...]
  }
}
```

**状态列表:**
- `FROZEN`: 已冻结
- `UNDER_REVIEW`: 复核中
- `RELEASED`: 已释放
- `CANCELLED`: 已取消
- `MANUALLY_CORRECTED`: 已人工修正

#### 3. 查询冻结记录列表

```
GET /api/freeze?page=1&pageSize=20&status=FROZEN&orderNo=xxx
```

**查询参数:**
- `page`: 页码 (默认1)
- `pageSize`: 每页数量 (默认20，最大100)
- `status`: 按状态筛选
- `orderNo`: 按订单号模糊搜索
- `reviewer`: 按复核人筛选
- `startTime`/`endTime`: 时间范围

#### 4. 提交复核

```
POST /api/freeze/{id}/submit-review
```

**请求体:**
```json
{
  "reviewer": "审核员A"
}
```

#### 5. 释放订单冻结

```
POST /api/freeze/{id}/release
```

**请求体:**
```json
{
  "finalConclusion": "审核通过：订单正常，予以释放"
}
```

#### 6. 取消订单冻结

```
POST /api/freeze/{id}/cancel
```

**请求体:**
```json
{
  "finalConclusion": "取消冻结：误判，恢复正常"
}
```

#### 7. 人工修正冻结记录

```
PUT /api/freeze/{id}/manual-correct
```

**请求体:**
```json
{
  "riskReason": "修正后的风险原因",
  "freezeAction": "SUSPEND_DELIVERY",
  "processingSummary": "特殊情况说明",
  "processingBasis": "修正依据"
}
```

#### 8. 履约拦截检查

```
POST /api/freeze/intercept
```

**请求体:**
```json
{
  "orderNo": "ORDER123456",
  "interceptType": "FULFILLMENT",
  "requestData": { "warehouseId": "WH001" }
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "shouldIntercept": true,
    "orderNo": "ORDER123456",
    "riskReason": "风控规则触发",
    "message": "订单已被冻结，履约动作被拦截"
  }
}
```

#### 9. 添加处理摘要

```
POST /api/freeze/{id}/summary
```

**请求体:**
```json
{
  "summary": "已联系用户核实，用户确认订单正常"
}
```

#### 10. 记录异常

```
POST /api/freeze/{id}/exception
```

**请求体:**
```json
{
  "errorInfo": { "code": "E001", "message": "系统异常" },
  "originalInput": { ...原始请求数据... }
}
```

#### 11. 查看操作日志

```
GET /api/freeze/{id}/logs
```

#### 12. 导出冻结记录 (CSV)

```
POST /api/freeze/exports/freeze-records
```

#### 13. 导出操作日志 (CSV)

```
POST /api/freeze/exports/operation-logs?freezeId={id}
```

#### 14. 导出完整追踪数据 (JSON)

```
POST /api/freeze/{id}/export-full-trace
```

#### 15. 查看导出文件列表

```
GET /api/freeze/exports
```

#### 16. 下载导出文件

```
GET /api/freeze/exports/download/{filename}
```

## 数据库设计

### order_freezes (冻结主表)

| 字段 | 说明 |
|------|------|
| id | 主键UUID |
| order_no | 订单编号 |
| risk_reason | 风险原因 |
| freeze_action | 冻结动作 |
| freeze_action_details | 冻结详情 |
| reviewer | 复核人 |
| release_condition | 释放条件 |
| status | 状态 |
| processing_summary | 处理摘要 |
| original_input | 原始输入(JSON) |
| processing_basis | 处理依据 |
| final_conclusion | 最终结论 |
| created_at/updated_at | 创建/更新时间 |
| frozen_at/released_at/cancelled_at | 各状态时间 |
| version | 版本号(乐观锁) |

### freeze_operation_logs (操作日志表)

| 字段 | 说明 |
|------|------|
| id | 主键UUID |
| freeze_id | 冻结记录ID |
| operation_type | 操作类型 |
| operator | 操作人 |
| before_status | 变更前状态 |
| after_status | 变更后状态 |
| operation_details | 操作详情 |
| original_input | 原始输入 |
| processing_basis | 处理依据 |
| ip_address | IP地址 |
| user_agent | 用户代理 |
| created_at | 创建时间 |

### fulfillment_intercepts (履约拦截表)

| 字段 | 说明 |
|------|------|
| id | 主键UUID |
| freeze_id | 冻结记录ID |
| order_no | 订单编号 |
| intercept_type | 拦截类型 |
| intercept_status | 拦截状态 |
| intercept_details | 拦截详情 |
| original_request | 原始请求 |
| created_at | 创建时间 |

## 目录结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── models/             # 数据模型
│   │   ├── database.js     # 数据库初始化
│   │   ├── OrderFreeze.js  # 冻结模型
│   │   ├── FreezeOperationLog.js  # 操作日志模型
│   │   └── FulfillmentIntercept.js # 履约拦截模型
│   ├── services/           # 业务逻辑
│   │   ├── OrderFreezeService.js   # 冻结服务
│   │   └── ExportService.js        # 导出服务
│   ├── controllers/        # 控制器
│   │   └── OrderFreezeController.js
│   ├── routes/             # 路由
│   │   └── freezeRoutes.js
│   └── middleware/         # 中间件
│       └── validation.js   # 参数验证
├── data/                   # 数据文件 (SQLite)
│   └── exports/            # 导出文件
├── tests/                  # 测试用例
├── package.json
└── README.md
```

## 核心业务规则

1. **订单冻结**：同一订单只能有一个活跃的冻结记录
2. **履约拦截**：冻结期间自动拦截所有相关履约操作
3. **状态流转**：FROZEN → UNDER_REVIEW → RELEASED/CANCELLED
4. **幂等性**：重复释放/取消操作不会产生副作用
5. **操作审计**：所有状态变更都有完整日志记录
6. **异常保留**：异常情况保留原始输入和处理依据
7. **数据持久化**：所有数据持久化存储，重启不丢失

## 健康检查

```
GET /health
```

响应:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "service": "risk-order-freeze-api"
}
```
