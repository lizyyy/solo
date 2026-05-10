# 预算滚动预测锁定 API 系统

一个完整的预算滚动预测锁定 API 系统，支持多轮提交、状态锁定、回退审批等企业级场景。

## 项目概述

本系统解决了年度预算滚动预测多轮提交场景下的核心问题：

- **版本管理**：支持同一季度多轮滚动预测版本，保持历史追溯
- **部门提交**：各部门独立提交预算数据，支持多次修改和重新提交
- **锁定窗口**：财务部门可设置提交窗口期，控制数据提交时机
- **差异说明**：预算变更必须附带差异说明，方便审计和追溯
- **回退审批**：锁定后如需修改，需走正式回退审批流程
- **预测报表**：报表可影响最终预测结果，灵活支持业务调整
- **幂等性保护**：重复提交不会把状态写乱，保证数据一致性
- **状态机验证**：非法状态流转会被拦截并给出清晰原因

## 技术栈

- **后端框架**：Node.js + Express
- **数据库**：SQLite（可方便切换到 PostgreSQL/MySQL）
- **ORM**：Prisma
- **语言**：TypeScript
- **测试**：Jest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run prisma:generate

# 创建数据库迁移
npm run prisma:migrate -- --name init
```

### 3. 初始化测试数据（可选）

```bash
npx ts-node src/seed.ts
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

服务启动后访问：http://localhost:3000

## 核心概念

### 状态流转

#### 预算版本状态机

```
DRAFT(草稿) → SUBMITTED(已提交) → UNDER_REVIEW(审核中) → APPROVED(已通过) → LOCKED(已锁定)
      ↑                  ↓              ↓                   ↑
      └─────────────── REJECTED(已驳回) ───────────────────┘
                                                          ↓
                                               ROLLBACK_REQUESTED(已申请回退)
                                               ↙                 ↘
                            ROLLBACK_APPROVED(回退已批准)   ROLLBACK_REJECTED(回退已驳回)
```

#### 部门提交状态机

```
PENDING(待提交) → SUBMITTED(已提交) → UNDER_REVIEW(审核中) → APPROVED(已通过) → LOCKED(已锁定)
       ↑                ↓               ↓
       └─────────── REJECTED(已驳回)
                        ↓
                 RESUBMITTED(需重新提交)
                        ↓
                 SUBMITTED(已提交)
```

#### 锁定窗口状态机

```
OPEN(开放中) → CLOSED(已关闭) → LOCKED(已锁定)
       ↑                ↓
       └────────────────┘
```

### 业务流程

典型的预算滚动预测流程：

1. **创建预算版本**：财务创建新的滚动预测版本
2. **设置锁定窗口**：设定部门提交的时间窗口
3. **部门提交数据**：各部门在窗口期内提交预算数据
4. **审核部门提交**：财务审核各部门数据
5. **添加差异说明**：如有变更，必须填写差异原因
6. **提交预算版本**：所有部门审核通过后提交整体版本
7. **审批锁定**：财务审批后锁定版本，数据固化
8. **如需修改**：申请回退 → 审批 → 修改 → 重新锁定

## API 接口

所有接口返回格式统一，便于非开发人员理解：

```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "操作成功的业务描述",
  "data": {},
  "timestamp": "2026-05-10T12:00:00.000Z"
}
```

错误示例：

```json
{
  "success": false,
  "code": "STATE_TRANSITION_ERROR",
  "message": "预算版本无法从「已锁定」变更为「草稿」。当前允许变更为：「已申请回退」",
  "details": {
    "currentState": "LOCKED",
    "targetState": "DRAFT"
  },
  "timestamp": "2026-05-10T12:00:00.000Z"
}
```

### 1. 预算版本管理

#### 创建预算版本

```bash
POST /api/budget-versions
Content-Type: application/json

{
  "year": 2026,
  "quarter": 1,
  "description": "2026年Q1第2轮滚动预测",
  "previousVersionId": "uuid-of-v1",
  "actorId": "finance-user-id"
}
```

**返回示例：**
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "已成功创建 2026 年第 1 季度第 2 轮滚动预测版本",
  "data": {
    "id": "uuid",
    "year": 2026,
    "quarter": 1,
    "version": 2,
    "status": "DRAFT",
    "statusLabel": "草稿"
  }
}
```

#### 查询预算版本列表

```bash
GET /api/budget-versions
GET /api/budget-versions?year=2026&quarter=1
GET /api/budget-versions?status=LOCKED
```

#### 提交预算版本

```bash
POST /api/budget-versions/:id/submit
Content-Type: application/json

{
  "actorId": "finance-user-id"
}
```

#### 审核预算版本

```bash
POST /api/budget-versions/:id/review
{
  "actorId": "finance-user-id"
}
```

#### 批准预算版本

```bash
POST /api/budget-versions/:id/approve
{
  "actorId": "finance-user-id"
}
```

#### 锁定预算版本

```bash
POST /api/budget-versions/:id/lock
{
  "actorId": "finance-user-id"
}
```

**锁定后：**
- 预算版本状态变为「已锁定」
- 所有关联的锁定窗口自动锁定
- 所有已批准的部门提交自动锁定
- 数据固化，不可修改

#### 申请回退

```bash
POST /api/budget-versions/:id/request-rollback
{
  "actorId": "finance-user-id",
  "reason": "发现销售部预算数据有误，需要重新调整"
}
```

#### 批准回退

```bash
POST /api/budget-versions/:id/approve-rollback
{
  "actorId": "admin-user-id"
}
```

#### 驳回回退

```bash
POST /api/budget-versions/:id/reject-rollback
{
  "actorId": "admin-user-id",
  "reason": "数据已上报总部，不允许回退"
}
```

### 2. 部门提交管理

#### 创建部门提交

```bash
POST /api/department-submissions
{
  "budgetVersionId": "budget-version-uuid",
  "departmentId": "dept-uuid",
  "actorId": "dept-head-id",
  "data": {
    "revenue": 1000000,
    "expense": 500000,
    "profit": 500000
  }
}
```

#### 提交部门数据

```bash
POST /api/department-submissions/:id/submit
{
  "actorId": "dept-head-id",
  "data": {
    "revenue": 1200000,
    "expense": 550000,
    "profit": 650000
  }
}
```

**注意：** 提交必须在开放的锁定窗口内，否则会被拒绝。

#### 审核部门提交

```bash
POST /api/department-submissions/:id/review
{
  "actorId": "finance-user-id"
}
```

#### 批准部门提交

```bash
POST /api/department-submissions/:id/approve
{
  "actorId": "finance-user-id"
}
```

#### 驳回部门提交

```bash
POST /api/department-submissions/:id/reject
{
  "actorId": "finance-user-id",
  "reason": "收入预测过高，请重新评估"
}
```

#### 重新提交

```bash
POST /api/department-submissions/:id/resubmit
{
  "actorId": "dept-head-id",
  "data": {
    "revenue": 900000,
    "expense": 500000,
    "profit": 400000
  }
}
```

### 3. 锁定窗口管理

#### 创建锁定窗口

```bash
POST /api/lock-windows
{
  "budgetVersionId": "budget-version-uuid",
  "name": "2026Q1第一轮提交窗口",
  "description": "请各部门在此窗口内提交数据",
  "startDate": "2026-05-01T00:00:00Z",
  "endDate": "2026-05-15T23:59:59Z",
  "actorId": "finance-user-id"
}
```

#### 查询当前开放窗口

```bash
GET /api/lock-windows/active/:budgetVersionId
```

#### 关闭窗口

```bash
POST /api/lock-windows/:id/close
{
  "actorId": "finance-user-id"
}
```

#### 重新开放窗口

```bash
POST /api/lock-windows/:id/reopen
{
  "actorId": "finance-user-id"
}
```

#### 最终锁定窗口

```bash
POST /api/lock-windows/:id/lock
{
  "actorId": "finance-user-id"
}
```

#### 延长窗口期

```bash
POST /api/lock-windows/:id/extend
{
  "actorId": "finance-user-id",
  "newEndDate": "2026-05-20T23:59:59Z"
}
```

### 4. 差异说明

#### 添加差异说明

```bash
POST /api/difference-notes
{
  "submissionId": "submission-uuid",
  "category": "收入调整",
  "description": "由于新客户签约，收入预测从100万调整为120万",
  "amount": 200000,
  "previousValue": 1000000,
  "currentValue": 1200000,
  "actorId": "dept-head-id"
}
```

#### 查询差异汇总

```bash
GET /api/difference-notes/summary/:budgetVersionId
```

**返回示例：**
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "共 3 条差异说明，差异总额：350,000 元",
  "data": {
    "totalNotes": 3,
    "totalAmount": 350000,
    "byCategory": {
      "收入调整": { "count": 2, "amount": 300000 },
      "费用调整": { "count": 1, "amount": 50000 }
    }
  }
}
```

### 5. 预测报表

#### 生成预测报表

```bash
POST /api/forecast-reports
{
  "name": "2026Q1销售预测报告",
  "description": "基于最新销售数据的预测",
  "budgetVersionId": "budget-version-uuid",
  "submissionId": "submission-uuid",
  "type": "SALES_FORECAST",
  "data": {
    "projectedRevenue": 1500000,
    "confidenceLevel": 0.85,
    "assumptions": ["Q2新客户签约", "产品升级"]
  },
  "affectsFinalResult": true,
  "actorId": "finance-user-id"
}
```

**重要：** `affectsFinalResult` 字段决定该报表是否影响最终预测结果。

#### 查询最终预测结果

```bash
GET /api/forecast-reports/final-result/:budgetVersionId
```

**返回示例：**
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "预算版本已锁定，财务数据已固化。最终预测结果受到预测报表影响。",
  "data": {
    "budgetVersion": {...},
    "submissions": [...],
    "reports": [...],
    "affectedByReports": true,
    "summary": {
      "totalBudget": 5,
      "totalApproved": 5,
      "totalLocked": 5
    }
  }
}
```

## 重跑机制

### 幂等性设计

系统所有关键操作都内置了幂等性保护：

1. **重复成功操作**：直接返回成功信息，不会重复执行
2. **进行中的操作**：提示"正在处理中，请稍后再试"
3. **失败的操作**：提示上次失败原因，需要修复后重试

### 失败后继续处理

当操作失败时，系统会记录失败信息。你有两种处理方式：

#### 方式一：重试相同操作

如果失败是临时问题（如网络超时、数据库连接问题），修复后可以直接重试。

**注意**：只有失败的操作才允许重试。成功或进行中的操作不能重试。

#### 方式二：重新创建新操作

如果失败是业务逻辑问题（如数据校验不通过），需要：

1. 查看错误信息中的具体原因
2. 修复问题（如修改数据、调整参数）
3. 创建新的操作

### 操作状态查询

你可以通过以下方式了解操作状态：

1. **查看实体状态**：通过 GET 接口查询实体当前状态
2. **查看审批记录**：部门提交的审批记录包含完整的操作历史
3. **查看锁定状态**：预算版本和锁定窗口都有明确的锁定标识

### 常见失败场景及处理

| 场景 | 错误码 | 处理建议 |
|------|--------|----------|
| 状态不允许变更 | STATE_TRANSITION_ERROR | 查看当前状态允许的转换，按正确流程操作 |
| 已在处理中 | IDEMPOTENCY_ERROR | 等待片刻后重试 |
| 已成功执行过 | IDEMPOTENCY_ERROR | 无需重复操作，查询结果即可 |
| 上次执行失败 | VALIDATION_ERROR | 查看失败原因，修复问题后重试 |
| 数据已锁定 | LOCKED_ERROR | 如需修改，请先申请回退 |
| 不在窗口期内 | VALIDATION_ERROR | 检查锁定窗口时间，或联系财务延长窗口期 |
| 有未完成的部门提交 | VALIDATION_ERROR | 先完成所有部门的审核 |

## 项目结构

```
.
├── prisma/
│   └── schema.prisma       # 数据库模型定义
├── src/
│   ├── config/
│   │   └── index.ts         # 配置文件
│   ├── controllers/         # 控制器层
│   │   ├── budgetVersionController.ts
│   │   ├── departmentSubmissionController.ts
│   │   ├── lockWindowController.ts
│   │   ├── differenceNoteController.ts
│   │   └── forecastReportController.ts
│   ├── db/
│   │   └── prisma.ts        # Prisma 客户端
│   ├── routes/
│   │   └── index.ts         # 路由定义
│   ├── services/            # 服务层（核心业务逻辑）
│   │   ├── stateMachine.ts           # 状态机
│   │   ├── idempotency.ts            # 幂等性控制
│   │   ├── budgetVersionService.ts   # 预算版本服务
│   │   ├── departmentSubmissionService.ts
│   │   ├── lockWindowService.ts
│   │   ├── differenceNoteService.ts
│   │   └── forecastReportService.ts
│   ├── utils/
│   │   ├── errors.ts        # 自定义错误类
│   │   └── response.ts      # 统一响应格式
│   ├── app.ts               # Express 应用
│   ├── index.ts             # 入口文件
│   └── seed.ts              # 测试数据初始化
├── .env                     # 环境变量
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 核心特性详解

### 1. 状态机验证

每个实体都有严格的状态流转规则：

- **预算版本**：草稿 → 提交 → 审核 → 通过 → 锁定
- **部门提交**：待提交 → 提交 → 审核 → 通过 → 锁定
- **锁定窗口**：开放 → 关闭 → 锁定

非法的状态转换会被立即拦截，并给出清晰的业务语言描述。

### 2. 幂等性保护

所有关键操作都有幂等性键：

- `create_budget_version`：年度+季度+版本号
- `submit_budget_version`：预算版本ID
- `lock_budget_version`：预算版本ID
- `submit_department_submission`：部门提交ID

重复调用相同操作不会产生副作用。

### 3. 锁定保护

多层锁定机制：

- **预算版本锁定**：整体固化，不可修改
- **部门提交锁定**：部门数据固化
- **锁定窗口锁定**：窗口期数据固化

一旦锁定，除非走回退审批流程，否则无法修改。

### 4. 业务化输出

所有接口返回都使用业务语言：

- 成功："已成功创建 2026 年第 1 季度第 2 轮滚动预测版本"
- 失败："还有 3 个部门提交未完成审核，无法提交预算版本"
- 状态：显示中文标签（草稿、已提交、已锁定等）

非开发人员也能轻松理解操作结果。

## 测试

```bash
# 运行测试
npm test

# 监听模式
npm run test:watch
```

## 数据库管理

```bash
# 查看数据库
npm run prisma:studio

# 创建新迁移
npm run prisma:migrate -- --name migration_name

# 重新生成客户端
npm run prisma:generate
```

## 生产部署

1. **修改数据库**：在 `.env` 中修改 `DATABASE_URL`
2. **构建**：`npm run build`
3. **启动**：`npm start`

建议：
- 使用 PostgreSQL/MySQL 替代 SQLite
- 添加环境变量管理（如 dotenv）
- 添加日志系统（如 winston）
- 添加认证授权（如 JWT）
- 添加 API 文档（如 Swagger）

## 扩展方向

- 权限管理：基于角色的访问控制（RBAC）
- 通知系统：邮件/短信通知状态变更
- 审批流：多节点审批配置
- 数据对比：版本间差异可视化
- 导出功能：Excel/PDF 报表导出
- 定时任务：自动关闭锁定窗口
- 审计日志：完整的操作追踪

## 常见问题

**Q: 如何防止部门修改覆盖财务锁定版？**

A: 财务锁定后，预算版本状态变为 LOCKED，所有部门提交也会被锁定。此时任何修改操作都会被拦截。如需修改，必须先申请回退，经审批后才能解锁。

**Q: 重复提交会不会把状态写乱？**

A: 不会。系统有两层保护：
1. 幂等性控制：相同操作重复调用不会产生副作用
2. 状态机验证：只有合法的状态转换才会被执行

**Q: 为什么要有锁定窗口？**

A: 锁定窗口用于控制部门提交的时间窗口，避免财务审核过程中数据被修改。窗口关闭后，财务可以集中审核；窗口锁定后，该期间的数据完全固化。

**Q: 预测报表如何影响最终结果？**

A: 预测报表有 `affectsFinalResult` 字段，设置为 true 时，查询最终结果会包含这些报表的影响。财务可以灵活控制哪些报表参与最终计算。

## 许可证

MIT
