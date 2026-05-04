# 批量发薪后端服务 (Payroll Batch Service)

一个本地可运行的高性能批量发薪后端服务，专为月底几万人同时发薪场景设计。

## 功能特性

### 🚀 核心功能
- **批量分片处理**：将大数据集分成多个分片，避免内存溢出
- **并发控制**：灵活配置并发数，防止系统过载
- **速率限制**：令牌桶算法控制请求频率，保护下游银行接口
- **幂等性保障**：每条发放记录有唯一幂等键，防止重复打款
- **自动重试**：失败记录自动计数，支持手动重试
- **状态追踪**：实时记录每个人的发放状态、失败原因

### 📊 管理功能
- **批次管理**：创建、启动、暂停、恢复、取消发薪批次
- **进度查询**：实时查看处理进度、成功率、预计剩余时间
- **失败重试**：一键重试所有失败的发放记录
- **账本核对**：自动核对预期金额和实际发放金额
- **性能统计**：查看系统吞吐量、平均处理时间、成功率

### 🔒 安全特性
- **幂等键机制**：基于员工ID + 年份 + 月份 + 批次ID生成唯一键
- **重复检测**：自动跳过已存在的发放记录
- **状态保护**：完成/取消的批次不可重复启动

## 技术栈

- **运行时**: Node.js 18+
- **Web框架**: Express.js
- **数据库**: SQLite (本地轻量级)
- **类型系统**: TypeScript
- **日志系统**: Pino
- **请求日志**: Morgan
- **参数验证**: Joi
- **测试框架**: Jest + Supertest

## 项目结构

```
src/
├── index.ts              # 应用入口
├── types/                # 类型定义
│   └── index.ts          # 核心类型定义
├── database/             # 数据库层
│   ├── index.ts          # 数据库连接管理
│   └── schema.ts         # 数据库Schema初始化
├── repositories/         # 数据访问层
│   ├── EmployeeRepository.ts
│   ├── PayrollRepository.ts
│   ├── BatchRepository.ts
│   └── DisbursementRepository.ts
├── services/             # 业务逻辑层
│   ├── ConcurrencyPool.ts    # 并发池
│   ├── RateLimiter.ts        # 速率限制器
│   └── BatchProcessor.ts     # 批次处理器 (核心)
├── routes/               # API路由层
│   ├── index.ts          # 路由聚合
│   ├── employees.ts      # 员工管理
│   ├── payrolls.ts       # 工资单管理
│   ├── batches.ts        # 批次管理
│   └── performance.ts    # 性能统计
├── utils/                # 工具函数
│   ├── logger.ts         # 日志配置
│   └── idempotency.ts    # 幂等键生成
└── scripts/              # 脚本
    └── seed.ts           # 数据生成脚本

docs/
├── curl-examples.md      # API使用示例
└── error-examples.md     # 错误处理样例

tests/                    # 测试文件 (待添加)
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成测试数据

```bash
# 生成默认 1000 条员工和工资单数据
npm run seed

# 生成 10000 条数据并重置数据库
npm run seed -- --count 10000 --reset

# 生成指定月份的数据
npm run seed -- --count 5000 --year 2024 --month 5

# 查看帮助
npm run seed -- --help
```

### 3. 启动服务

```bash
# 开发模式 (带热重载)
npm run dev

# 生产模式
npm run build
npm start
```

服务默认运行在 `http://localhost:3000`

### 4. 验证服务

```bash
# 健康检查
curl http://localhost:3000/api/health

# 性能统计
curl http://localhost:3000/api/performance/stats
```

## 核心使用流程

### 1. 导入员工数据

```bash
curl -X POST http://localhost:3000/api/employees/import \
  -H "Content-Type: application/json" \
  -d '{
    "employees": [
      {
        "employeeNumber": "EMP00000001",
        "name": "张三",
        "email": "zhangsan@company.com",
        "phone": "13800138001",
        "bankName": "中国工商银行",
        "bankAccountNumber": "6222021234567890123",
        "bankAccountName": "张三",
        "department": "技术研发部",
        "position": "高级工程师"
      }
    ]
  }'
```

### 2. 导入工资单数据

```bash
curl -X POST http://localhost:3000/api/payrolls/import \
  -H "Content-Type: application/json" \
  -d '{
    "payrolls": [
      {
        "employeeNumber": "EMP00000001",
        "baseSalary": 25000,
        "bonus": 5000,
        "allowance": 2000,
        "deduction": 1000,
        "tax": 2500,
        "socialInsurance": 3000,
        "housingFund": 3000,
        "year": 2024,
        "month": 5
      }
    ]
  }'
```

> 注：`netSalary` 会自动计算：基本工资 + 奖金 + 津贴 - 扣除 - 个税 - 社保 - 公积金

### 3. 创建发薪批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放",
    "description": "本月工资发放，包含绩效奖金",
    "year": 2024,
    "month": 5,
    "concurrency": 10,
    "rateLimit": 100,
    "chunkSize": 100
  }'
```

**参数说明:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| concurrency | number | 10 | 并发数，同时处理的发放数量 |
| rateLimit | number | 100 | 每秒最大请求数 |
| chunkSize | number | 100 | 分片大小，每批处理多少条记录 |

### 4. 启动批次

```bash
BATCH_ID="your-batch-uuid"
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/start"
```

### 5. 实时查询进度

```bash
# 轮询进度
while true; do
  curl -s "http://localhost:3000/api/batches/$BATCH_ID/progress" | python3 -m json.tool
  sleep 5
done
```

**进度响应示例:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "batchId": "uuid",
      "status": "running",
      "totalRecords": 10000,
      "processedRecords": 3500,
      "successRecords": 3450,
      "failedRecords": 50,
      "progressPercentage": 35.00,
      "estimatedTimeRemaining": 65000,
      "currentChunk": 35,
      "totalChunks": 100
    }
  }
}
```

### 6. 暂停/恢复批次

```bash
# 暂停
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/pause"

# 恢复
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/resume"
```

### 7. 重试失败记录

```bash
# 批次完成后重试所有失败记录
curl -X POST "http://localhost:3000/api/batches/$BATCH_ID/retry"
```

### 8. 账本核对

```bash
# 核对金额和数量
curl -X GET "http://localhost:3000/api/batches/$BATCH_ID/reconcile"
```

### 9. 查看发放记录

```bash
# 所有记录
curl -X GET "http://localhost:3000/api/batches/$BATCH_ID/disbursements"

# 只看失败记录
curl -X GET "http://localhost:3000/api/batches/$BATCH_ID/disbursements?status=failed"

# 只看成功记录
curl -X GET "http://localhost:3000/api/batches/$BATCH_ID/disbursements?status=success"
```

## 并发和限速配置

### 推荐配置

| 场景 | 并发数 | 速率限制 | 分片大小 |
|------|--------|----------|----------|
| 测试环境 | 20 | 200 | 200 |
| 生产环境 (低速银行接口) | 5 | 10 | 50 |
| 生产环境 (高速接口) | 50 | 500 | 500 |
| 超大数据量 (10万+) | 100 | 1000 | 1000 |

### 配置示例

```bash
# 低并发配置 (银行接口限制严格)
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2024年5月工资发放",
    "year": 2024,
    "month": 5,
    "concurrency": 5,
    "rateLimit": 10,
    "chunkSize": 50
  }'
```

## 数据库设计

### 核心表结构

#### employees (员工表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| employee_number | TEXT | 员工工号 (唯一) |
| name | TEXT | 姓名 |
| email | TEXT | 邮箱 |
| phone | TEXT | 电话 |
| bank_name | TEXT | 银行名称 |
| bank_account_number | TEXT | 银行账号 |
| bank_account_name | TEXT | 账户名称 |
| department | TEXT | 部门 |
| position | TEXT | 职位 |
| status | TEXT | 状态: active/inactive/suspended |

#### payrolls (工资单表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| employee_id | TEXT | 外键 → employees.id |
| year | INTEGER | 年份 |
| month | INTEGER | 月份 |
| base_salary | REAL | 基本工资 |
| bonus | REAL | 奖金 |
| allowance | REAL | 津贴 |
| deduction | REAL | 扣除 |
| tax | REAL | 个税 |
| social_insurance | REAL | 社保 |
| housing_fund | REAL | 公积金 |
| net_salary | REAL | 实发工资 (自动计算) |
| status | TEXT | 状态: pending/confirmed |

#### batches (批次表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| name | TEXT | 批次名称 |
| description | TEXT | 描述 |
| year | INTEGER | 年份 |
| month | INTEGER | 月份 |
| total_records | INTEGER | 总记录数 |
| total_amount | REAL | 总金额 |
| processed_records | INTEGER | 已处理记录数 |
| success_records | INTEGER | 成功记录数 |
| failed_records | INTEGER | 失败记录数 |
| status | TEXT | 状态: pending/running/paused/completed/failed/cancelled |
| concurrency | INTEGER | 并发数 |
| rate_limit | INTEGER | 速率限制 |
| chunk_size | INTEGER | 分片大小 |

#### disbursements (发放记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 UUID |
| batch_id | TEXT | 外键 → batches.id |
| payroll_id | TEXT | 外键 → payrolls.id |
| employee_id | TEXT | 外键 → employees.id |
| amount | REAL | 发放金额 |
| idempotency_key | TEXT | 幂等键 (唯一) |
| status | TEXT | 状态: pending/processing/success/failed/cancelled |
| retry_count | INTEGER | 已重试次数 |
| max_retries | INTEGER | 最大重试次数 (默认 3) |
| error_message | TEXT | 错误信息 |
| error_code | TEXT | 错误码 |
| external_transaction_id | TEXT | 银行交易ID |
| processed_at | DATETIME | 处理时间 |

## 核心算法

### 1. 并发池 (ConcurrencyPool)
```
原理: 使用信号量模式控制最大并发数
- 任务提交时，若当前并发数 < maxConcurrency，立即执行
- 否则，放入队列等待
- 任务完成后，从队列中取下一个任务执行

特点: 
- 支持动态调整并发数
- 任务队列优先级: FIFO
- 支持等待所有任务完成
```

### 2. 速率限制器 (RateLimiter)
```
算法: 令牌桶 (Token Bucket)
- 初始 tokens = maxRequestsPerSecond
- 每过 tokenInterval (1000/maxRequestsPerSecond) 毫秒，补充一个令牌
- 每次请求消耗一个令牌
- 令牌用完时，等待下一个令牌补充

特点:
- 平滑限流，避免突发流量
- 支持瞬时突发 (令牌积累)
- 高精度毫秒级控制
```

### 3. 幂等键生成
```javascript
// 算法: SHA256(employeeId + ":" + year + ":" + month + ":" + batchId)
function generateIdempotencyKey(employeeId, year, month, batchId) {
  const baseString = `${employeeId}:${year}:${month}:${batchId}`;
  return crypto.createHash('sha256').update(baseString).digest('hex');
}
```

**确保:**
- 同一员工同一月份同一批次 → 同一幂等键
- 数据库层面唯一约束防止重复
- 即使网络重试，也不会重复打款

## 错误处理

### 常见错误码

| 错误码 | 说明 | 可重试 |
|--------|------|--------|
| NETWORK_TIMEOUT | 网络超时 | ✅ |
| INSUFFICIENT_FUNDS | 余额不足 | ✅ (需先充值) |
| LIMIT_EXCEEDED | 限额超限 | ✅ (需等待) |
| ACCOUNT_VALIDATION_FAILED | 账户验证失败 | ❌ |
| ACCOUNT_FROZEN | 账户冻结 | ❌ |
| PROCESSING_EXCEPTION | 处理异常 | 需具体分析 |

### 重试策略

```
1. 自动重试:
   - 每次失败后 retry_count + 1
   - 达到 max_retries 后状态变为 cancelled
   - 默认 max_retries = 3

2. 手动重试:
   - POST /api/batches/{id}/retry
   - 只重试 status=failed 且 retry_count < max_retries 的记录
   - 可无限次手动重试
```

详细错误处理请参考 [docs/error-examples.md](docs/error-examples.md)

## API 完整文档

- [API 使用示例 (CURL)](docs/curl-examples.md)
- [错误处理和异常样例](docs/error-examples.md)

## 生产部署建议

### 1. 数据库替换
```javascript
// 建议替换 SQLite 为 PostgreSQL/MySQL
// 只需修改 src/database/index.ts
```

### 2. 支付网关实现
```typescript
// 实现 PaymentGateway 接口
interface PaymentGateway {
  processPayment(
    amount: number,
    bankAccountNumber: string,
    bankAccountName: string,
    bankName: string,
    idempotencyKey: string
  ): Promise<PaymentResult>;
}

// 替换 MockPaymentGateway
export const batchProcessor = new BatchProcessor(new YourPaymentGateway());
```

### 3. 监控告警
```yaml
# 建议的监控指标
- batch_status: 批次状态分布
- disbursement_success_rate: 发放成功率
- disbursement_error_codes: 错误码分布
- average_processing_time: 平均处理时间
- throughput: 系统吞吐量 (条/秒)
```

### 4. 高可用配置
```bash
# 建议配置
export NODE_ENV=production
export PORT=3000
export DB_PATH=/data/payroll.db
export LOG_LEVEL=info

# 使用 PM2 管理进程
pm2 start dist/index.js --name payroll-service -i 4
```

## 测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch
```

## 常见问题

### Q1: 批次卡住不前进？
**排查步骤:**
1. 检查服务状态: `GET /api/performance/health`
2. 检查批次状态: `GET /api/batches/{id}`
3. 查看日志中的错误信息

**可能原因:**
- 数据库连接问题
- 所有任务都在失败重试

### Q2: 如何防止重复打款？
**机制:**
1. **幂等键唯一约束**: 数据库层面 `idempotency_key` 唯一索引
2. **状态保护**: 已成功的记录不会重复处理
3. **批次保护**: 已完成/取消的批次不可重复启动

### Q3: 如何处理大规模数据 (10万+)？
**建议配置:**
```bash
# 高并发配置
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "大规模发薪",
    "year": 2024,
    "month": 5,
    "concurrency": 100,
    "rateLimit": 1000,
    "chunkSize": 1000
  }'
```

**优化建议:**
- 使用 PostgreSQL 替换 SQLite
- 考虑读写分离
- 建立适当的数据库索引

### Q4: 如何监控系统状态？
```bash
# 实时性能统计
curl http://localhost:3000/api/performance/stats

# 健康检查
curl http://localhost:3000/api/performance/health

# 查看所有批次
curl http://localhost:3000/api/batches
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意:** 本项目默认使用 Mock 支付网关，生产环境需要实现真实的银行接口。
