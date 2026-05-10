# 错误预算台账 API

一个专注于服务错误预算按接口、租户和时间窗计算的后端服务。解决告警没有依据的问题，让 SLO 配置、错误采样、时间窗扣减形成完整链路。

## 核心能力

1. **多维度预算计算** - 支持按租户、服务、接口三个维度配置 SLO
2. **灵活的时间窗** - 日/周/月固定窗口 + 24h/7d/30d 滚动窗口
3. **错误采样与扣减** - 记录错误事件并自动扣减对应 SLO 的错误预算
4. **预算冻结** - 当预算耗尽或人工干预时冻结预算
5. **告警抑制** - 基于预算状态智能抑制告警
6. **流程追踪** - 每一步操作都有完整的流程记录，可查询当前卡点和前一次处理记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`

```bash
cp .env.example .env
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 执行数据库迁移
npm run db:migrate
```

### 4. 导入示例数据（可选）

```bash
npm run seed
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

服务将在 http://localhost:3000 启动

## 普通用户确认功能可用的步骤

按照以下顺序操作，就能验证整个链路是否正常工作：

### 第一步：检查服务是否运行

```bash
curl http://localhost:3000/api/v1/health
```

**确认**：返回 `{"success": true, "status": "ok"}` 说明服务已启动

---

### 第二步：查看已有数据（如果执行了 seed）

查看租户列表：
```bash
curl http://localhost:3000/api/v1/tenants
```

**下一步**：记录返回的租户 ID，后续操作都需要用到

---

### 第三步：查看 SLO 配置

用刚才的租户 ID 查看 SLO 配置：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/slo-configs
```

**确认**：能看到 1-2 条 SLO 配置记录

**理解**：
- `targetValue` = SLO 目标（如 99.9% 表示允许 0.1% 的错误）
- `timeWindowType` = 时间窗类型（DAILY 表示每天重置）
- 总预算 = 10000 请求/天 × 0.1% = 10 个错误预算

---

### 第四步：触发一次完整链路（重点）

用一个错误样本触发"记录→扣减"完整流程：

```bash
curl -X POST http://localhost:3000/api/v1/tenants/<租户ID>/error-samples/batch-deduct \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "<服务ID>",
    "source": "API",
    "errorType": "500 Internal Server Error",
    "errorMessage": "数据库连接超时",
    "statusCode": 500,
    "operator": "test-user"
  }'
```

**确认**：返回 `{"success": true, "processedSLOs": 1, "data": [...]}`

**检查点**：看返回数据中的
- `deductionAmount` = 扣减了多少预算
- `remainingPercentage` = 剩余预算百分比

---

### 第五步：查看预算状态

查看某个 SLO 配置的实时预算状态：
```bash
curl http://localhost:3000/api/v1/slo-configs/<SLO配置ID>/budget/status
```

**确认**：
- `budget.usedBudget` 应该比之前多了 1
- `budget.remainingBudget` 应该减少了
- `utilization.isWarning` 如果剩余 < 20% 会变成 true

---

### 第六步：验证流程追踪（重要特性）

查看刚才操作产生的流程记录：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/process-traces
```

**确认**：能看到多条记录，每条都有：
- `step` = 流程步骤（SLO_CONFIG_REVIEW, ERROR_SAMPLE_VALIDATION, BUDGET_DEDUCTION...）
- `status` = 状态（IN_PROGRESS, APPROVED, REJECTED）
- `currentCheckpoint` = 当前检查点
- `checkpointMessage` = 详细描述

**查看卡点**（如果有操作被拒绝）：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/process-traces/current-blocker
```

**理解**：如果某一步被拒绝，这个接口会告诉你：
- `currentBlocker` = 当前卡住的地方
- `previousTrace` = 前一次处理记录

---

### 第七步：测试预算冻结（可选）

先获取预算 ID（从第五步的返回结果中找 `budget.id`），然后冻结：

```bash
curl -X POST http://localhost:3000/api/v1/budgets/<预算ID>/freeze \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "MANUAL_FREEZE",
    "description": "测试冻结功能",
    "operator": "admin"
  }'
```

**验证冻结生效**：再试一次扣减（第四步的请求），应该返回错误说"预算已被冻结"

---

### 第八步：查看报表

生成预算报表：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/reports/budget
```

查看错误趋势：
```bash
curl "http://localhost:3000/api/v1/tenants/<租户ID>/reports/error-trend?days=7"
```

查看 SLO 合规性：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/reports/slo-compliance/<SLO配置ID>
```

---

## 如果某一步失败，怎么排查？

### 场景 1：创建 SLO 时被拒绝

查看流程卡点：
```bash
curl http://localhost:3000/api/v1/tenants/<租户ID>/process-traces/current-blocker
```

看返回的：
- `currentBlocker.checkpointMessage` = 具体的失败原因
- `previousTrace` = 前一次成功/失败的记录

### 场景 2：扣减预算失败

同样查看卡点，常见原因：
- `BUDGET_FROZEN` = 预算被冻结了
- `ALREADY_DEDUCTED` = 这个错误样本已经被扣减过
- `DATA_MISSING` = SLO 配置或错误样本不存在

### 场景 3：查看完整流程链

如果想了解某个操作的完整历史，用 trace ID 查询链路：
```bash
curl http://localhost:3000/api/v1/process-traces/<traceID>/chain
```

---

## API 总览

### 基础管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/health | 健康检查 |
| POST/GET/PUT/DELETE | /api/v1/tenants | 租户管理 |
| POST/GET/PUT/DELETE | /api/v1/tenants/:tenantId/services | 服务管理 |
| POST/GET/PUT/DELETE | /api/v1/services/:serviceId/endpoints | 接口管理 |

### SLO 配置
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/tenants/:tenantId/slo-configs | 创建 SLO 配置 |
| GET | /api/v1/tenants/:tenantId/slo-configs | 列出 SLO 配置 |
| GET/PUT/DELETE | /api/v1/slo-configs/:id | 单个 SLO 操作 |
| POST | /api/v1/slo-configs/:id/activate | 激活 SLO |
| POST | /api/v1/slo-configs/:id/deactivate | 停用 SLO |

### 错误采样与预算
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/tenants/:tenantId/error-samples | 记录错误样本 |
| GET | /api/v1/tenants/:tenantId/error-samples | 列出错误样本 |
| GET | /api/v1/tenants/:tenantId/error-samples/pending | 待扣减的错误 |
| POST | /api/v1/tenants/:tenantId/error-samples/batch-deduct | **记录并自动扣减（推荐）** |
| GET | /api/v1/slo-configs/:sloConfigId/budget | 获取/创建时间窗预算 |
| GET | /api/v1/slo-configs/:sloConfigId/budget/status | **预算状态概览** |
| POST | /api/v1/slo-configs/:sloConfigId/budget/deduct/:errorSampleId | 手动扣减预算 |

### 预算冻结与告警抑制
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/budgets/:budgetId/freeze | 冻结预算 |
| POST | /api/v1/budgets/:budgetId/unfreeze | 解冻预算 |
| POST | /api/v1/budgets/:budgetId/alert-suppressions | 添加告警抑制 |
| POST | /api/v1/alert-suppressions/:suppressionId/unsuppress | 取消抑制 |
| GET | /api/v1/budgets/:budgetId/alert-suppressions/:alertType/check | 检查是否被抑制 |

### 报表查询
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/tenants/:tenantId/reports/budget | **预算报表** |
| GET | /api/v1/tenants/:tenantId/reports/error-trend | 错误趋势 |
| GET | /api/v1/tenants/:tenantId/reports/slo-compliance/:sloConfigId | SLO 合规性 |
| GET | /api/v1/tenants/:tenantId/reports/process-blockers | 流程卡点统计 |

### 流程追踪
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/tenants/:tenantId/process-traces | 流程记录列表 |
| GET | /api/v1/process-traces/:id | 单条记录详情 |
| GET | /api/v1/tenants/:tenantId/process-traces/current-blocker | **当前卡点查询** |
| GET | /api/v1/process-traces/:traceId/chain | 完整流程链路 |

## 枚举值说明

### SLOType (SLO 类型)
- `AVAILABILITY` - 可用性
- `LATENCY` - 延迟
- `ERROR_RATE` - 错误率

### TimeWindowType (时间窗类型)
- `DAILY` - 每日（自然日）
- `WEEKLY` - 每周
- `MONTHLY` - 每月
- `ROLLING_24H` - 24小时滚动
- `ROLLING_7D` - 7天滚动
- `ROLLING_30D` - 30天滚动

### FreezeReason (冻结原因)
- `BUDGET_EXHAUSTED` - 预算耗尽
- `MANUAL_FREEZE` - 手动冻结
- `MAINTENANCE` - 维护中
- `INCIDENT` - 事故处理

### ErrorSource (错误来源)
- `API` - API 接口错误
- `INTERNAL` - 内部错误
- `EXTERNAL` - 外部依赖错误
- `MANUAL` - 手动录入

## 数据模型概览

```
Tenant (租户)
  └── Service (服务)
        └── APIEndpoint (接口)
              └── SLOConfiguration (SLO配置)
                    └── TimeWindowBudget (时间窗预算)
                          ├── BudgetDeduction (扣减记录)
                          ├── BudgetFreeze (冻结记录)
                          └── AlertSuppression (告警抑制)
                    └── ErrorSample (错误样本)
                          └── BudgetDeduction (关联扣减)
              └── ProcessTrace (流程追踪)
```

## 扩展建议

后续可以扩展的方向：
1. **告警集成** - 对接 Prometheus Alertmanager、钉钉/企业微信机器人
2. **实时预算更新** - 引入消息队列，异步处理高并发错误事件
3. **多租户隔离增强** - 添加请求级别的租户验证中间件
4. **可视化面板** - 开发前端 UI 展示预算趋势和告警状态
5. **权限系统** - 基于 RBAC 的操作权限控制
6. **历史归档** - 定期归档老数据，优化查询性能
