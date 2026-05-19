# 图片生成额度管理系统

## 项目概述

这是一个专为设计团队打造的图片生成额度管理系统，解决多人共用额度时的超用追踪和成本分摊问题。

## 核心特性

### 数据模型
- **成员 (Member)**: 使用系统的用户
- **项目 (Project)**: 每个成员下的工作项目
- **额度包 (Quota Package)**: 分配给成员或项目的额度
- **生成请求 (Generation Request)**: 每次图片生成消耗记录
- **失败退费 (Failure Credit)**: 生成失败时的退费申请
- **月度汇总 (Monthly Summary)**: 每月使用统计

### 业务规则
1. **额度扣减**: 创建请求时从可用额度包中扣减
2. **失败返还**: 生成失败时自动创建退费申请，需审核
3. **项目分摊**: 按项目维度统计使用情况
4. **超额拦截**: 额度不足时拒绝创建请求
5. **月报导出**: 支持导出月度报表和成员明细

### 关键技术特性
- **幂等性保障**: 通过 idempotency_key 防止重复请求
- **事务处理**: 所有额度操作使用数据库事务
- **状态机管理**: 严格的请求状态流转控制
- **审计追踪**: 完整记录额度变化历史

## 快速开始

### 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 初始化数据库
```bash
cd backend
npm run seed
```
这将创建测试数据：3个成员、4个项目、若干额度包。

### 启动服务
```bash
# 启动后端 (端口 3001)
cd backend
npm run dev

# 启动前端 (端口 3000)
cd ../frontend
npm run dev
```

访问 http://localhost:3000 即可使用系统。

## 测试指南

### 1. 重复调用测试 (幂等性验证)

**操作步骤**:
1. 在前端进入「生成请求」页面，点击「新建请求」
2. 填写：选择任意成员、选择任意项目、消耗额度 10、**幂等Key填写: test-key-001**
3. 点击创建，记录返回的请求ID
4. **保持幂等Key不变**，再次点击创建

**预期结果**:
- 第二次创建不会产生新的扣费
- 系统直接返回第一次创建的请求
- 数据库中只有一条记录
- 额度包余额只减少了一次

### 2. 脏数据与补偿机制测试

**场景A: 失败退费流程**
1. 创建一个新的生成请求（状态为processing）
2. 点击「失败」按钮将其标记为失败
3. 进入「退费审核」页面，看到新的待审核记录
4. 查看该请求详情，可以看到额度变化时间线
5. 审核通过该退费
6. 验证：
   - 原额度包的余额已恢复
   - 请求状态变为 refunded
   - 月度汇总中返还额度已统计

**场景B: 拒绝退费测试**
1. 重复场景A步骤1-3
2. 审核时选择「拒绝」
3. 验证：
   - 额度包余额不变
   - 退费记录状态变为 rejected
   - 请求状态保持 failed

### 3. 超额拦截测试
1. 选择一个剩余额度较少的成员
2. 创建一个额度超过该成员剩余额度的请求
3. 验证系统返回错误提示，不允许创建
4. 检查数据库，确认没有新的请求记录

### 4. 状态流转验证

**正常流程**:
```
processing → completed
```

**失败流程**:
```
processing → failed → [审核通过] → refunded
processing → failed → [审核拒绝] → failed
```

**状态限制**:
- processing 状态下才能标记为 completed 或 failed
- 已完成的请求不能再次修改状态
- 已退费的请求不能重复退费

### 5. 报表导出测试
1. 进入「报表导出」页面
2. 选择年份和月份，点击导出月度报表
3. 选择成员，点击导出成员明细
4. 验证CSV文件内容正确

## API文档

### 创建生成请求
```
POST /api/generation-requests
{
  "member_id": "string",
  "project_id": "string",
  "quota_amount": 10,
  "idempotency_key": "unique-key-123"
}
```

### 完成请求
```
POST /api/generation-requests/{id}/complete
```

### 标记失败
```
POST /api/generation-requests/{id}/fail
{
  "error_message": "失败原因"
}
```

### 审核退费
```
POST /api/failure-credits/{id}/review
{
  "status": "approved | rejected",
  "reviewed_by": "审核人",
  "review_note": "备注"
}
```

### 查询接口
- `GET /api/generation-requests` - 查询请求列表
- `GET /api/generation-requests/{id}` - 请求详情（含历史）
- `GET /api/failure-credits` - 退费列表
- `GET /api/monthly-summaries` - 月度汇总
- `GET /api/dashboard/stats` - 仪表盘统计

### 导出接口
- `GET /api/export/monthly-report` - 导出月度报表
- `GET /api/export/member-details` - 导出成员明细

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── database.ts          # 数据库连接与初始化
│   │   ├── types.ts             # 类型定义
│   │   ├── routes.ts            # API路由
│   │   ├── seed.ts              # 种子数据
│   │   └── services/
│   │       ├── quotaService.ts  # 核心业务逻辑
│   │       └── queryService.ts  # 查询与导出服务
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── router/
│   │   ├── stores/
│   │   └── views/
│   │       ├── Dashboard.vue    # 总览页面
│   │       ├── Requests.vue     # 请求列表
│   │       ├── RequestDetail.vue # 详情页
│   │       ├── Credits.vue      # 退费审核
│   │       └── Reports.vue      # 报表导出
│   └── package.json
└── README.md
```

## 技术栈

- **后端**: Node.js + Express + TypeScript + SQLite
- **前端**: Vue 3 + Vue Router + Pinia + Element Plus
- **特性**: 幂等性、事务、状态机、CSV导出

## 注意事项

1. **幂等Key**: 客户端生成，保证唯一性，建议使用 UUID
2. **事务隔离**: 所有额度操作使用数据库事务，防止并发问题
3. **状态校验**: 每次状态变更前都做前置校验，防止非法状态流转
4. **额度包选择**: 按有效期优先、剩余额度从小到大分配
