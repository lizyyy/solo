# 采购样品评审 API

一个完整的采购样品从寄送、试用到定版的全流程管理后端系统。

## 功能特性

### 核心业务链路
- **样品编号**: 自动生成唯一样品编号，格式：`SAM-YYYYMMDD-XXXX`
- **评审任务**: 支持多种评审类型（初始评审、试用评审、最终评审、技术评审、质量评审）
- **试用反馈**: 支持多维度测试项评分和综合评价
- **定版冻结**: 确认最终版本后自动冻结，防止误修改
- **退样记录**: 完整的退样流程管理
- **评审导出**: 支持单个样品完整报告和批量列表导出

### 数据一致性保障
- **幂等性支持**: 通过 `x-idempotency-key` 请求头确保重复操作结果一致
- **状态转换校验**: 严格的状态流转规则，防止非法状态跳转
- **历史记录追踪**: 所有操作均有完整日志记录
- **数量金额校验**: 不允许负数，退样数量不超过当前库存

### 后台任务机制
- **异步报告生成**: 支持异步生成复杂报告
- **自动重试**: 任务失败后自动重试（最多 3 次）
- **状态监控**: 可实时查询任务执行状态
- **手动干预**: 支持手动重试和取消

### 数据存储
- **轻量持久化**: 使用 SQLite 数据库，无需额外配置
- **重启恢复**: 所有历史数据持久化存储

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm run start
```

服务启动后访问：
- 服务地址: http://localhost:3000
- 健康检查: http://localhost:3000/health
- API 概览: http://localhost:3000/api

## 业务流程

```
创建样品 (CREATED)
    ↓
确认寄送 (SHIPPED)
    ↓
开始试用 (IN_TRIAL)
    ↓
提交试用反馈 → 等待评审 (PENDING_REVIEW)
    ↓
创建评审任务
    ↓
完成评审 → 评审完成 (REVIEWED)
    ↙    ↘
定版冻结 (FINALIZED)  退样 (RETURNED)
```

## API 文档

### 请求头

| Header | 说明 | 必填 |
|--------|------|------|
| `Content-Type` | `application/json` | 是 |
| `x-operator` | 操作人标识 | 否（默认 system） |
| `x-idempotency-key` | 幂等性 key（任意唯一字符串） | 否 |

### 通用响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

错误响应：
```json
{
  "success": false,
  "message": "错误描述",
  "errorCode": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 接口列表

### 样品管理

#### 1. 创建样品
```bash
POST /api/samples
Content-Type: application/json

{
  "name": "样品名称",
  "supplier": "供应商",
  "category": "分类",
  "quantity": 100,
  "unitPrice": 10.5
}
```

#### 2. 查询样品列表
```bash
GET /api/samples?status=IN_TRIAL&page=1&pageSize=20
```

查询参数：
- `status`: 状态筛选 (CREATED/SHIPPED/IN_TRIAL/PENDING_REVIEW/REVIEWED/FINALIZED/RETURNED)
- `category`: 分类筛选
- `supplier`: 供应商模糊搜索
- `isFrozen`: 是否冻结 (true/false)
- `keyword`: 名称/编号关键词搜索
- `page`: 页码
- `pageSize`: 每页条数

#### 3. 获取单个样品
```bash
GET /api/samples/:id
GET /api/samples/by-no/:sampleNo
```

#### 4. 更新样品状态
```bash
PATCH /api/samples/:id/status
Content-Type: application/json

{
  "status": "SHIPPED"
}
```

状态流转规则：
- CREATED → SHIPPED
- SHIPPED → IN_TRIAL / RETURNED
- IN_TRIAL → PENDING_REVIEW / RETURNED
- PENDING_REVIEW → REVIEWED / IN_TRIAL
- REVIEWED → FINALIZED / PENDING_REVIEW / RETURNED

#### 5. 更新样品信息
```bash
PATCH /api/samples/:id/info
Content-Type: application/json

{
  "name": "新名称",
  "quantity": 200
}
```

#### 6. 冻结/解冻样品
```bash
POST /api/samples/:id/freeze
POST /api/samples/:id/unfreeze
```

#### 7. 样品汇总
```bash
GET /api/samples/summary
```

#### 8. 样品历史记录
```bash
GET /api/samples/:id/history
```

### 评审任务

#### 1. 创建评审任务
```bash
POST /api/review-tasks
Content-Type: application/json

{
  "sampleId": "样品ID",
  "assignee": "负责人",
  "taskType": "TRIAL_REVIEW",
  "priority": "HIGH",
  "dueDate": "2024-02-01T00:00:00.000Z"
}
```

taskType 可选值：INITIAL_REVIEW, TRIAL_REVIEW, FINAL_REVIEW, TECHNICAL_REVIEW, QUALITY_REVIEW

#### 2. 查询评审任务列表
```bash
GET /api/review-tasks?sampleId=xxx&status=PENDING
```

#### 3. 更新任务状态
```bash
PATCH /api/review-tasks/:id/status
Content-Type: application/json

{
  "status": "COMPLETED",
  "opinion": "样品符合要求，建议定版",
  "rating": 5
}
```

### 试用反馈

#### 1. 提交试用反馈
```bash
POST /api/trial-feedbacks
Content-Type: application/json

{
  "sampleId": "样品ID",
  "trialUser": "试用人员",
  "trialDate": "2024-01-15",
  "trialPeriod": 7,
  "trialLocation": "实验室A",
  "testItems": [
    {
      "name": "外观检查",
      "criteria": "无明显缺陷",
      "result": "PASS",
      "remarks": "外观良好"
    },
    {
      "name": "性能测试",
      "criteria": "达到规格要求",
      "result": "PASS"
    }
  ],
  "overallRating": 5,
  "conclusion": "样品测试通过，可以批量采购",
  "suggestions": "建议增加包装防护"
}
```

> 注意：提交试用反馈后，样品状态会自动变更为 PENDING_REVIEW

#### 2. 查询试用反馈列表
```bash
GET /api/trial-feedbacks?sampleId=xxx
```

### 定版与退样

#### 1. 定版冻结
```bash
POST /api/finalization/finalize
Content-Type: application/json

{
  "sampleId": "样品ID",
  "finalQuantity": 500,
  "finalUnitPrice": 9.8,
  "remarks": "定版备注"
}
```

定版后：
- 样品状态变为 FINALIZED
- 数量和单价更新为最终值
- 样品自动冻结

#### 2. 创建退样记录
```bash
POST /api/finalization/returns
Content-Type: application/json

{
  "sampleId": "样品ID",
  "returnType": "UNQUALIFIED",
  "returnReason": "样品检测不合格",
  "returnQuantity": 50,
  "trackingNo": "SF123456789"
}
```

returnType 可选值：UNQUALIFIED, EXCESS, CANCELED, OTHER

#### 3. 确认退样签收
```bash
POST /api/finalization/returns/:id/confirm
```

### 导出功能

#### 1. 系统概览
```bash
GET /api/export/overview
```

#### 2. 导出样品列表 CSV
```bash
GET /api/export/samples/csv
```

#### 3. 获取样品完整报告
```bash
GET /api/export/samples/:id/report
```

返回内容：
- 样品基本信息
- 所有评审任务及汇总
- 所有试用反馈及汇总
- 定版记录
- 退样记录
- 历史操作记录

#### 4. 导出样品报告 CSV
```bash
GET /api/export/samples/:id/report/csv
```

#### 5. 异步生成报告
```bash
POST /api/export/samples/:id/report/async
```

### 历史记录

```bash
GET /api/history?entityType=SAMPLE&operator=张三
```

查询参数：
- `entityType`: 实体类型 (SAMPLE/REVIEW_TASK/TRIAL_FEEDBACK/FINALIZATION/RETURN)
- `startTime`: 开始时间
- `endTime`: 结束时间
- `operator`: 操作人

### 后台任务

#### 1. 创建后台任务
```bash
POST /api/background-tasks
Content-Type: application/json

{
  "taskType": "GENERATE_REPORT",
  "payload": { "sampleId": "xxx" },
  "maxRetries": 3
}
```

taskType 可选值：GENERATE_REPORT, SEND_NOTIFICATION, EXPORT_DATA, BATCH_UPDATE, SYNC_DATA

#### 2. 查询任务列表
```bash
GET /api/background-tasks?status=FAILED
```

#### 3. 查看任务详情
```bash
GET /api/background-tasks/:id
```

#### 4. 重试失败任务
```bash
POST /api/background-tasks/:id/retry
```

#### 5. 取消任务
```bash
POST /api/background-tasks/:id/cancel
```

#### 6. 任务队列控制
```bash
GET  /api/background-tasks/status     # 查看队列状态
POST /api/background-tasks/queue/start  # 启动队列
POST /api/background-tasks/queue/stop   # 停止队列
```

## 后台任务机制说明

### 任务生命周期

```
PENDING → RUNNING → COMPLETED
                ↘
                 RETRYING (等待30秒后重试)
                      ↘
                       FAILED (超过最大重试次数)
```

### 任务失败表现

1. **任务状态变为 FAILED**
2. `errorMessage` 字段包含错误描述
3. `errorStack` 字段包含错误堆栈
4. `retryCount` 显示已重试次数

### 再次执行表现

1. **手动重试**: 调用 `/api/background-tasks/:id/retry`
   - 状态重置为 PENDING
   - 重试计数归零
   - 错误信息清空

2. **自动重试**: 任务失败后
   - 如果重试次数未达到 `maxRetries`
   - 状态变为 RETRYING
   - 30 秒后自动重试
   - 每次重试会增加 `retryCount`

## 幂等性使用说明

对于涉及金额、数量等重要操作，建议使用幂等性：

```bash
POST /api/samples
x-idempotency-key: uuid-12345
Content-Type: application/json

{
  "name": "测试样品",
  "supplier": "供应商A",
  "category": "电子元件",
  "quantity": 100,
  "unitPrice": 10.5
}
```

使用相同的 `x-idempotency-key` 重复发送请求，系统会返回第一次的结果，不会重复创建。

## 数据文件

数据库文件位置：`./data/sample-review.db`

这是一个 SQLite 文件，可以使用任何 SQLite 客户端打开查看。

## 项目结构

```
.
├── data/                          # 数据目录
│   └── sample-review.db           # SQLite 数据库
├── src/
│   ├── config/
│   │   └── database.ts            # 数据库配置
│   ├── middleware/
│   │   └── idempotency.ts         # 幂等性中间件
│   ├── routes/
│   │   ├── samples.ts             # 样品路由
│   │   ├── reviewTasks.ts         # 评审任务路由
│   │   ├── trialFeedbacks.ts      # 试用反馈路由
│   │   ├── finalization.ts        # 定版退样路由
│   │   ├── export.ts              # 导出路由
│   │   ├── history.ts             # 历史记录路由
│   │   └── backgroundTasks.ts     # 后台任务路由
│   ├── services/
│   │   ├── sampleService.ts       # 样品服务
│   │   ├── reviewTaskService.ts   # 评审任务服务
│   │   ├── trialFeedbackService.ts # 试用反馈服务
│   │   ├── finalizationService.ts # 定版退样服务
│   │   ├── exportService.ts       # 导出服务
│   │   ├── historyService.ts      # 历史记录服务
│   │   └── backgroundTaskService.ts # 后台任务服务
│   ├── types/
│   │   └── index.ts               # 类型定义
│   ├── utils/
│   │   └── response.ts            # 响应工具
│   └── index.ts                   # 入口文件
├── package.json
├── tsconfig.json
└── README.md
```

## 完整示例流程

### 示例 1：完整的样品评审流程

```bash
# 1. 创建样品
curl -X POST http://localhost:3000/api/samples \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电子元件样品",
    "supplier": "供应商A",
    "category": "电子元件",
    "quantity": 100,
    "unitPrice": 10.5
  }'

# 2. 确认寄送
curl -X PATCH http://localhost:3000/api/samples/{sampleId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "SHIPPED"}'

# 3. 开始试用
curl -X PATCH http://localhost:3000/api/samples/{sampleId}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_TRIAL"}'

# 4. 提交试用反馈
curl -X POST http://localhost:3000/api/trial-feedbacks \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "trialUser": "张三",
    "trialDate": "2024-01-15",
    "trialPeriod": 7,
    "trialLocation": "实验室A",
    "testItems": [
      {"name": "外观检查", "criteria": "无缺陷", "result": "PASS"},
      {"name": "性能测试", "criteria": "达标", "result": "PASS"}
    ],
    "overallRating": 5,
    "conclusion": "测试通过"
  }'

# 5. 创建评审任务
curl -X POST http://localhost:3000/api/review-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "assignee": "李四",
    "taskType": "FINAL_REVIEW",
    "priority": "HIGH"
  }'

# 6. 完成评审
curl -X PATCH http://localhost:3000/api/review-tasks/{taskId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "opinion": "建议定版采购",
    "rating": 5
  }'

# 7. 定版冻结
curl -X POST http://localhost:3000/api/finalization/finalize \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "finalQuantity": 500,
    "finalUnitPrice": 9.8
  }'

# 8. 查看完整报告
curl http://localhost:3000/api/export/samples/{sampleId}/report
```

### 示例 2：退样流程

```bash
# 1. 创建样品（假设数量100）
# ...

# 2. 寄送后发现质量问题，部分退样
curl -X POST http://localhost:3000/api/finalization/returns \
  -H "Content-Type: application/json" \
  -d '{
    "sampleId": "{sampleId}",
    "returnType": "UNQUALIFIED",
    "returnReason": "部分样品检测不合格",
    "returnQuantity": 30
  }'

# 此时样品数量变为 70

# 3. 供应商收到退回样品，确认签收
curl -X POST http://localhost:3000/api/finalization/returns/{returnId}/confirm
```

## License

MIT
