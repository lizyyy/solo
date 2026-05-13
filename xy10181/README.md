# 限额审批占用释放 API 服务

一个基于 Node.js + Express + PostgreSQL 的限额审批管理系统，实现了限额占用、审批回调、超时释放、并发校验和审计统计等核心功能。

## 功能特性

- **限额占用**：申请审批时自动占用限额，确保额度可控
- **审批回调**：支持审批通过、驳回、撤回等状态流转
- **超时释放**：审批未处理超时时自动释放占用的限额
- **并发校验**：使用乐观锁机制处理并发冲突
- **幂等性保障**：重复请求不会制造脏数据
- **审计统计**：完整的操作日志和数据一致性校验
- **数据一致性**：统计结果与数据库明细一致

## 技术栈

- **后端框架**：Node.js + Express
- **数据库**：PostgreSQL
- **ORM**：原生 pg (无需额外 ORM)
- **验证**：Joi
- **日志**：Winston
- **定时任务**：node-cron
- **测试**：Jest + Supertest

## 快速开始

### 前置条件

- Node.js >= 18.0.0
- PostgreSQL >= 12.0
- npm 或 yarn

### 环境配置

1. 安装依赖：

```bash
npm install
```

2. 配置环境变量，复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

环境变量说明：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 5432 |
| `DB_USER` | 数据库用户 | postgres |
| `DB_PASSWORD` | 数据库密码 | postgres |
| `DB_NAME` | 数据库名 | quota_approval |
| `APPROVAL_TIMEOUT_SECONDS` | 审批超时时间（秒） | 3600 |
| `CRON_EXPRESSION` | 定时任务表达式 | */5 * * * * * |

3. 创建数据库：

```sql
CREATE DATABASE quota_approval;
```

4. 初始化数据库表和示例数据：

```bash
npm run db:init
```

### 启动服务

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

服务启动后访问：`http://localhost:3000/health`

## API 文档

### 健康检查

```
GET /health
```

### 审批管理

#### 1. 提交审批申请（占用限额）

```
POST /api/v1/quota/apply
Content-Type: application/json

{
  "quotaCode": "QUOTA_001",
  "applyAmount": 10000.00,
  "applicant": "张三",
  "reason": "采购办公用品",
  "requestId": "REQ-20240101-001"
}
```

**参数说明**：
- `quotaCode`: 限额编码（必填）
- `applyAmount`: 申请金额，正数（必填）
- `applicant`: 申请人（必填）
- `reason`: 申请原因（可选）
- `requestId`: 请求ID，用于幂等性控制（可选，不传则自动生成）

**返回示例**：

```json
{
  "code": 0,
  "message": "审批申请提交成功",
  "data": {
    "requestId": "REQ-20240101-001",
    "approvalId": 1,
    "quotaCode": "QUOTA_001",
    "applyAmount": 10000.00,
    "status": "pending",
    "applicant": "张三",
    "expiredAt": "2024-01-01T02:00:00.000Z",
    "createdAt": "2024-01-01T01:00:00.000Z",
    "quotaSnapshot": {
      "total": 1000000.00,
      "used": 0.00,
      "occupied": 10000.00,
      "available": 990000.00
    }
  }
}
```

#### 2. 审批通过

```
POST /api/v1/quota/:requestId/approve
Content-Type: application/json

{
  "approver": "王经理",
  "comments": "同意申请"
}
```

#### 3. 审批驳回

```
POST /api/v1/quota/:requestId/reject
Content-Type: application/json

{
  "approver": "李总",
  "comments": "预算不足"
}
```

#### 4. 撤回申请

```
POST /api/v1/quota/:requestId/cancel
Content-Type: application/json

{
  "operator": "张三",
  "comments": "取消申请"
}
```

#### 5. 查询审批状态

```
GET /api/v1/quota/:requestId/status
```

### 统计接口

#### 1. 获取汇总统计

```
GET /api/v1/quota/stats/summary
```

返回所有限额的使用情况、审批状态统计和操作统计。

#### 2. 数据一致性校验

```
GET /api/v1/quota/stats/consistency
```

校验限额余额与操作记录是否一致，确保数据完整性。

#### 3. 获取审计日志

```
GET /api/v1/quota/stats/audit?limit=100
```

获取最近的操作审计日志。

#### 4. 获取限额操作记录

```
GET /api/v1/quota/stats/quota/:quotaCode/operations?limit=100
```

获取指定限额的所有操作历史。

## 状态流转

审批状态流转图：

```
                    ┌──────────────┐
                    │   pending    │◄──── 初始状态（占用限额）
                    └──────┬───────┘
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ approved │      │ rejected │      │ canceled │
   └──────────┘      └──────────┘      └──────────┘
    (扣除限额)         (释放限额)         (释放限额)
         │
         └─────► 终态，不可再变更
```

**状态说明**：
- `pending`: 待审批，已占用限额
- `approved`: 审批通过，从占用中扣除到已使用
- `rejected`: 审批驳回，释放占用的限额
- `canceled`: 已撤回，释放占用的限额
- `expired`: 已过期，定时任务自动释放限额

## 错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1001 | 限额不存在 |
| 1002 | 限额不足 |
| 1003 | 限额已禁用 |
| 1004 | 限额已过期 |
| 2001 | 审批记录不存在 |
| 2002 | 审批不在待处理状态 |
| 2003 | 审批已处理 |
| 2004 | 审批已过期 |
| 3001 | 并发冲突 |
| 4000 | 参数验证失败 |
| 4001 | 缺少必填字段 |
| 5000 | 内部服务器错误 |
| 5001 | 数据库错误 |

## 运行测试

### 单元测试

```bash
npm test
```

### 覆盖率测试

```bash
npm run test:coverage
```

### 验收测试

```bash
npm run acceptance
```

或者手动执行：

```bash
bash scripts/acceptance-test.sh
```

## 项目结构

```
quota-approval-service/
├── src/
│   ├── config/
│   │   └── database.js       # 数据库连接配置
│   ├── controllers/
│   │   ├── QuotaController.js     # 审批控制器
│   │   └── StatisticsController.js # 统计控制器
│   ├── models/
│   │   ├── dbInit.js           # 数据库初始化
│   │   ├── QuotaModel.js       # 限额模型
│   │   ├── ApprovalRecordModel.js # 审批记录模型
│   │   ├── QuotaOperationModel.js # 限额操作模型
│   │   └── AuditLogModel.js    # 审计日志模型
│   ├── routes/
│   │   └── quota.js            # 路由定义
│   ├── services/
│   │   ├── QuotaService.js     # 核心业务逻辑
│   │   ├── StatisticsService.js # 统计服务
│   │   └── cronService.js      # 定时任务
│   ├── utils/
│   │   ├── constants.js        # 常量定义
│   │   ├── errors.js           # 错误码定义
│   │   └── logger.js           # 日志配置
│   ├── scripts/
│   │   └── init-db.js          # 数据库初始化脚本
│   ├── app.js                  # Express 应用
│   └── server.js               # 服务入口
├── tests/
│   └── quota.test.js           # 单元测试
├── scripts/
│   └── acceptance-test.sh      # 验收测试脚本
├── .env                        # 环境变量
├── .env.example                # 环境变量示例
├── package.json                # 项目配置
├── jest.config.js              # Jest 配置
└── README.md                   # 项目文档
```

## 核心机制

### 并发控制

使用 PostgreSQL 的乐观锁机制，通过 `version` 字段控制并发更新：

```sql
UPDATE quotas 
SET occupied_amount = occupied_amount + $2, version = version + 1
WHERE id = $1 AND version = (SELECT version FROM quotas WHERE id = $1)
```

如果更新失败（返回 0 行），说明发生了并发冲突，返回 `CONCURRENT_CONFLICT` 错误，客户端应重试。

### 幂等性设计

- **提交申请**：使用 `requestId` 作为唯一键，重复提交返回已有记录
- **审批操作**：对已处理的审批重复操作时，直接返回结果而不重复处理
- **限额释放**：检查是否已存在释放操作，避免重复释放

### 数据一致性

通过 `GET /api/v1/quota/stats/consistency` 接口校验：

1. 限额的 `used_amount` 应等于所有 `deduct` 类型操作的金额总和
2. 限额的 `occupied_amount` 应等于 `occupy - release - deduct`

## 定时任务

默认每 5 秒执行一次过期审批处理：

- 检查所有 `pending` 状态且 `expired_at <= NOW()` 的审批
- 自动将状态更新为 `expired`
- 释放占用的限额
- 记录操作日志和审计记录

可通过 `CRON_EXPRESSION` 环境变量调整执行频率。

## 示例

### 正常审批流程

```bash
# 1. 提交申请
curl -X POST http://localhost:3000/api/v1/quota/apply \
  -H "Content-Type: application/json" \
  -d '{"quotaCode":"QUOTA_001","applyAmount":50000,"applicant":"张三","requestId":"REQ-001"}'

# 2. 审批通过
curl -X POST http://localhost:3000/api/v1/quota/REQ-001/approve \
  -H "Content-Type: application/json" \
  -d '{"approver":"王经理","comments":"同意"}'
```

### 驳回流程

```bash
# 1. 提交申请
curl -X POST http://localhost:3000/api/v1/quota/apply \
  -H "Content-Type: application/json" \
  -d '{"quotaCode":"QUOTA_002","applyAmount":10000,"applicant":"李四","requestId":"REQ-002"}'

# 2. 驳回申请（限额被释放）
curl -X POST http://localhost:3000/api/v1/quota/REQ-002/reject \
  -H "Content-Type: application/json" \
  -d '{"approver":"李总","comments":"预算不足"}'
```

## License

MIT
