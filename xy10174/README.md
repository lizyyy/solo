# 采购预算锁定 API

用于解决采购审批还没完成时，预算已被多个申请同时占用的问题。

## 核心功能

- **预算锁定**：在采购申请提交时锁定预算，防止超支
- **审批流程**：审批通过后提交预算，拒绝或取消后释放预算
- **并发控制**：使用乐观锁和重试机制处理并发冲突
- **补偿机制**：基于交易日志支持事后补偿
- **部门报表**：按部门统计预算使用情况

## 技术栈

- **Node.js + Express** - 后端框架
- **SQLite** - 轻量级数据库（自动创建）
- **Knex.js** - SQL 查询构建器
- **Jest** - 测试框架
- **Supertest** - HTTP 测试库

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务会自动：
- 创建 `data/` 目录（如果不存在）
- 创建 SQLite 数据库 `data/dev.sqlite3`
- 执行数据库迁移
- 监听 3000 端口

### 3. 运行测试

```bash
npm test
```

测试使用内存数据库，确保隔离性。

## 项目结构

```
.
├── src/
│   ├── config/
│   │   ├── database.js         # 数据库配置
│   │   └── error-codes.js      # 错误码定义
│   ├── db/
│   │   ├── knex.js             # Knex 实例管理
│   │   └── migrations/         # 数据库迁移
│   ├── services/               # 业务逻辑层
│   │   ├── budget-lock.service.js   # 预算锁定服务
│   │   ├── approval.service.js      # 审批服务
│   │   └── report.service.js        # 报表服务
│   ├── controllers/            # 控制器层
│   ├── routes/                 # 路由层
│   ├── utils/
│   │   └── response.js         # 响应和错误处理
│   ├── app.js                  # Express 应用工厂
│   └── index.js                # 服务入口
├── tests/
│   └── budget-lock.test.js     # 测试用例
└── data/                       # SQLite 数据目录（自动创建）
```

## API 接口

### 预算管理

#### 创建部门
```
POST /api/budget/departments
Content-Type: application/json

{
  "name": "技术部",
  "code": "TECH"
}
```

#### 创建预算
```
POST /api/budget/budgets
Content-Type: application/json

{
  "departmentId": "uuid",
  "budgetType": "PURCHASE",
  "fiscalYear": "2024",
  "totalAmount": 100000,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T23:59:59.000Z"
}
```

#### 锁定预算
```
POST /api/budget/locks
Content-Type: application/json

{
  "budgetId": "uuid",
  "applicationId": "PO-2024-001",
  "applicationType": "PURCHASE_REQUEST",
  "amount": 15000,
  "createdBy": "user_001",
  "reason": "采购办公设备"
}
```

#### 修改锁定金额
```
PUT /api/budget/locks/:lockId
Content-Type: application/json

{
  "newAmount": 20000,
  "operator": "user_001"
}
```

#### 释放锁定
```
POST /api/budget/locks/:lockId/release
Content-Type: application/json

{
  "operator": "user_001",
  "reason": "申请取消"
}
```

#### 提交锁定
```
POST /api/budget/locks/:lockId/commit
Content-Type: application/json

{
  "operator": "manager_001"
}
```

### 审批流程

#### 创建审批
```
POST /api/approvals
Content-Type: application/json

{
  "applicationId": "PO-2024-001",
  "currentApprover": "manager_001",
  "approvalLevel": "LEVEL_1"
}
```

#### 审批通过
```
POST /api/approvals/:id/approve
Content-Type: application/json

{
  "approvedBy": "manager_001"
}
```
- 自动提交预算锁定

#### 审批拒绝
```
POST /api/approvals/:id/reject
Content-Type: application/json

{
  "rejectReason": "不符合规定",
  "operator": "manager_001"
}
```
- 自动释放预算锁定

#### 取消审批
```
POST /api/approvals/:id/cancel
Content-Type: application/json

{
  "operator": "user_001"
}
```
- 自动释放预算锁定

### 报表查询

#### 所有部门报表
```
GET /api/reports/departments
GET /api/reports/departments?fiscalYear=2024
```

#### 单个部门报表
```
GET /api/reports/departments/:departmentId
GET /api/reports/departments/:departmentId?fiscalYear=2024
```

#### 预算使用趋势
```
GET /api/reports/departments/:departmentId/trend?budgetType=PURCHASE&fiscalYear=2024
```

### 健康检查

```
GET /health
```

## 数据模型

### departments（部门表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | VARCHAR | 部门名称 |
| code | VARCHAR | 部门编码（唯一） |

### budgets（预算表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| department_id | UUID | 所属部门 |
| budget_type | VARCHAR | 预算类型 |
| fiscal_year | VARCHAR | 财年 |
| total_amount | DECIMAL | 总预算 |
| used_amount | DECIMAL | 已使用 |
| locked_amount | DECIMAL | 已锁定 |
| available_amount | DECIMAL | 可用余额 |
| version | INTEGER | 乐观锁版本 |

### budget_locks（预算锁定表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| application_id | VARCHAR | 关联申请单（唯一） |
| amount | DECIMAL | 锁定金额 |
| status | ENUM | ACTIVE/RELEASED/COMMITTED |
| expires_at | TIMESTAMP | 过期时间 |

### approval_records（审批记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| application_id | VARCHAR | 关联申请单 |
| status | ENUM | PENDING/APPROVED/REJECTED/CANCELLED |

### transaction_logs（交易日志表）
用于审计和补偿。

## 错误码

| 错误码 | 类别 | 说明 |
|--------|------|------|
| 1001 | 预算 | 预算不存在 |
| 1002 | 预算 | 预算已过期 |
| 1003 | 预算 | 预算余额不足 |
| 1004 | 预算 | 预算已禁用 |
| 2001 | 锁定 | 预算锁定不存在 |
| 2002 | 锁定 | 该申请已存在预算锁定 |
| 2003 | 锁定 | 预算锁定已过期 |
| 2004 | 锁定 | 预算锁定已被释放 |
| 2005 | 锁定 | 预算锁定已被提交 |
| 3001 | 审批 | 审批记录不存在 |
| 3002 | 审批 | 审批已完成 |
| 3003 | 审批 | 无效的审批状态 |
| 3004 | 审批 | 审批状态冲突 |
| 4001 | 并发 | 并发冲突，请重试 |
| 4002 | 并发 | 检测到死锁 |
| 5001 | 部门 | 部门不存在 |
| 9001 | 通用 | 参数校验失败 |
| 9999 | 通用 | 服务器内部错误 |

## 核心设计

### 预算锁定流程

1. **提交申请** → 检查预算余额 → 创建锁定记录 → 更新预算状态
2. **审批通过** → 提交锁定 → 从 locked_amount 转至 used_amount
3. **审批拒绝/取消** → 释放锁定 → 从 locked_amount 退回 available_amount

### 并发控制

- 使用 `version` 字段实现乐观锁
- 并发冲突时自动重试（最多 3 次）
- `application_id` 唯一约束防重复提交

### 事务一致性

- 所有预算操作在事务中执行
- 审批操作与预算操作在同一事务中
- 任一环节失败则全部回滚
