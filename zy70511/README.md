# 资源配额借用管理 API

用于团队之间 CPU 和存储配额借用流程的标准化管理，实现借用申请、审批、归还、逾期处理、结算导出的全流程可追溯。

## 快速启动

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化样例数据
```bash
node scripts/init-sample-data.js
```

### 3. 启动服务
```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 数据模型

### 团队 (teams)
- `name`: 团队名称
- `cpu_quota`: CPU总配额
- `storage_quota`: 存储总配额(GB)
- `cpu_used`: 已借出CPU额度
- `storage_used`: 已借出存储额度

### 借用记录 (borrow_records)
- `request_id`: 申请单号
- `borrower_team`: 借用方团队
- `lender_team`: 出借方团队
- `resource_type`: 资源类型 (CPU/STORAGE)
- `amount`: 借用额度
- `borrow_date`: 借用日期
- `due_date`: 归还期限
- `return_date`: 实际归还日期
- `status`: 状态
- `approver`: 审批人
- `approval_comment`: 审批意见
- `settlement_summary`: 结算摘要

### 操作日志 (operation_logs)
记录所有操作的原始输入、处理依据、最终结论

## 状态流转

```
PENDING_APPROVAL (待审批)
    ├──> APPROVED → ACTIVE (借用中)
    │       ├──> 到期检测 → OVERDUE (已逾期)
    │       └──> 主动归还 → RETURNED (已归还)
    └──> REJECTED (已拒绝)

RETURNED / OVERDUE → SETTLED (已结算)
```

## API 接口

### 基础信息

**获取所有状态和资源类型**
```bash
curl http://localhost:3000/api/statuses
```

**获取所有团队**
```bash
curl http://localhost:3000/api/teams
```

**创建新团队**
```bash
curl -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试开发组",
    "cpuQuota": 100,
    "storageQuota": 5000
  }'
```

### 借用流程

**1. 创建借用申请**
```bash
curl -X POST http://localhost:3000/api/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerTeam": "业务开发组",
    "lenderTeam": "平台架构组",
    "resourceType": "CPU",
    "amount": 20,
    "dueDate": "2026-06-01T23:59:59Z",
    "operator": "张三"
  }'
```

**2. 审批通过**
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "李四",
    "comment": "业务高峰期临时支持，到期请按时归还"
  }'
```

**3. 审批拒绝**
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "李四",
    "comment": "本团队资源也紧张，请寻找其他团队协调"
  }'
```

**4. 归还资源**
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/return \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "张三"
  }'
```

**5. 结算记录**
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/settle \
  -H "Content-Type: application/json" \
  -d '{
    "settlementSummary": "按期归还，感谢支持",
    "operator": "李四"
  }'
```

### 查询操作

**查询所有借用记录**
```bash
curl http://localhost:3000/api/borrows
```

**按条件过滤查询**
```bash
curl "http://localhost:3000/api/borrows?status=ACTIVE&borrowerTeam=业务开发组"
```

**查询单条记录详情**
```bash
curl http://localhost:3000/api/borrows/{requestId}
```

**查询操作日志**
```bash
curl http://localhost:3000/api/borrows/{requestId}/logs
```

### 异常处理

**检测逾期记录**
```bash
curl -X POST http://localhost:3000/api/overdue/check
```

**人工修正记录**
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "amount": 25,
      "dueDate": "2026-06-15T23:59:59Z",
      "status": "ACTIVE"
    },
    "operator": "管理员"
  }'
```

### 导出报告

**JSON 格式导出**
```bash
curl "http://localhost:3000/api/reports/settlement?startDate=2026-01-01T00:00:00Z&endDate=2026-12-31T23:59:59Z"
```

**CSV 格式导出**
```bash
curl -o settlement.csv "http://localhost:3000/api/reports/settlement?startDate=2026-01-01T00:00:00Z&endDate=2026-12-31T23:59:59Z&format=csv"
```

## 被规则拦住的路径示例

### ❌ 配额不足被拦截
```bash
curl -X POST http://localhost:3000/api/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerTeam": "业务开发组",
    "lenderTeam": "平台架构组",
    "resourceType": "CPU",
    "amount": 200,
    "dueDate": "2026-06-01T23:59:59Z",
    "operator": "张三"
  }'
```

**返回错误：**
```json
{
  "error": {
    "code": "INSUFFICIENT_QUOTA",
    "message": "出借方CPU配额不足，可用: 100, 请求: 200"
  }
}
```

### ❌ 相同团队不能互借
```bash
curl -X POST http://localhost:3000/api/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "borrowerTeam": "平台架构组",
    "lenderTeam": "平台架构组",
    "resourceType": "CPU",
    "amount": 10,
    "dueDate": "2026-06-01T23:59:59Z",
    "operator": "张三"
  }'
```

**返回错误：**
```json
{
  "error": {
    "code": "SAME_TEAM",
    "message": "借用方和出借方不能是同一个团队"
  }
}
```

### ❌ 状态不允许操作
对已归还的记录再次执行归还：
```bash
curl -X POST http://localhost:3000/api/borrows/{requestId}/return \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "张三"
  }'
```

**返回错误：**
```json
{
  "error": {
    "code": "INVALID_STATUS",
    "message": "当前状态 RETURNED 不允许归还"
  }
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `INVALID_RESOURCE_TYPE` | 资源类型必须是 CPU 或 STORAGE |
| `INVALID_AMOUNT` | 借用额度必须大于 0 |
| `BORROWER_NOT_FOUND` | 借用方团队不存在 |
| `LENDER_NOT_FOUND` | 出借方团队不存在 |
| `SAME_TEAM` | 借用方和出借方不能是同一个团队 |
| `INSUFFICIENT_QUOTA` | 出借方配额不足 |
| `RECORD_NOT_FOUND` | 借用记录不存在 |
| `INVALID_STATUS` | 当前状态不允许此操作 |
| `NO_CHANGES` | 没有提供需要修改的字段 |
| `MISSING_PARAMS` | 缺少必要参数 |

## 目录结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── database.js         # 数据库操作
│   ├── routes.js           # API 路由
│   └── services/
│       └── quotaService.js # 业务逻辑
├── scripts/
│   └── init-sample-data.js # 样例数据
├── data/                   # SQLite 数据库
├── package.json
└── README.md
```
