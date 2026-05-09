# 账单分摊系统

一个稳定可靠的账单分摊系统，支持多用户、分组管理、并发控制、操作审计和报告导出。

## 核心特性

### 🔒 稳定性保障

- **幂等性处理**: 支持 `X-Request-Id` 请求头，防止重复提交
- **乐观锁并发控制**: 基于版本号的冲突检测，多人同时修改时提醒
- **事务一致性**: 所有关键操作使用数据库事务
- **完整的审计日志**: 所有关键操作都有可追溯的历史记录

### 💰 功能特性

- **用户认证**: JWT Token 认证，支持用户名/邮箱登录
- **分组管理**: 创建分组、添加/移除成员
- **账单管理**: 创建、编辑、删除、结算账单
- **灵活分摊**: 支持自定义分摊比例和平均分摊
- **版本历史**: 每次修改都保存完整快照
- **报告导出**: Excel 格式报告，包含汇总、明细、统计分析
- **操作历史**: 所有操作可查，谁在什么时候做了什么

## 快速开始

### 使用 Docker (推荐)

```bash
# 启动所有服务
docker-compose up -d

# 访问前端
open http://localhost:3000

# 查看 API 文档
open http://localhost:3001/api/docs
```

### 本地开发

#### 前置要求

- Node.js 20+
- PostgreSQL 15+

#### 后端

```bash
cd backend

# 安装依赖
npm install

# 创建环境变量
cp .env.example .env
# 编辑 .env 配置数据库连接

# 启动开发服务器
npm run start:dev
```

#### 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 系统架构

### 数据库模型

- **users**: 用户表
- **groups**: 分组表
- **user_groups**: 用户分组关联表
- **bills**: 账单表 (含 version 乐观锁字段)
- **bill_shares**: 账单分摊表
- **bill_versions**: 账单历史版本快照
- **audit_logs**: 审计日志表
- **idempotency_requests**: 幂等请求记录表

### API 端点

#### 认证

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

#### 分组

- `GET /api/groups` - 获取我的分组列表
- `POST /api/groups` - 创建分组
- `GET /api/groups/:id` - 获取分组详情
- `PUT /api/groups/:id` - 更新分组
- `POST /api/groups/:id/members` - 添加成员
- `DELETE /api/groups/:id/members/:memberId` - 移除成员
- `GET /api/groups/:id/members` - 获取成员列表

#### 账单

- `GET /api/bills/group/:groupId` - 获取分组账单列表
- `GET /api/bills/:id` - 获取账单详情
- `POST /api/bills` - 创建账单 (支持幂等)
- `PUT /api/bills/:id` - 更新账单 (需要版本号)
- `DELETE /api/bills/:id` - 删除账单
- `POST /api/bills/:id/settle` - 结算账单
- `GET /api/bills/:id/history` - 获取版本历史
- `GET /api/bills/statistics/:groupId` - 获取统计数据

#### 审计

- `GET /api/audit/group/:groupId` - 分组操作历史
- `GET /api/audit/my` - 我的操作历史

#### 报告

- `GET /api/reports/group/:groupId/excel` - 导出 Excel 报告

## 稳定性机制说明

### 1. 幂等性 (Idempotency)

创建账单等写操作支持幂等请求：

```
Request Header: X-Request-Id: <unique-uuid>

重复发送相同 Request-Id 的请求，
服务端会返回第一次的响应结果，不会重复创建数据。
```

前端会自动为每个请求生成唯一的 Request-Id。

### 2. 乐观锁 (Optimistic Locking)

账单更新需要携带 `expectedVersion` 参数：

```typescript
// 1. 获取当前账单
const bill = await api.get('/api/bills/xxx');

// 2. 修改数据
bill.title = '新标题';

// 3. 提交更新（携带当前版本号）
await api.put('/api/bills/xxx', {
  ...bill,
  expectedVersion: bill.version,  // 关键！
});

// 如果版本号不匹配，返回 409 Conflict
// 提示用户刷新数据后重试
```

### 3. 事务 (Transactions)

所有涉及多个表修改的操作都在事务中执行：

- 创建账单：同时插入 bill、bill_shares、bill_version
- 更新账单：同时更新 bill、删除旧 shares、插入新 shares、新增 version
- 结算账单：同时更新 bill 和所有 shares 状态

### 4. 审计日志 (Audit)

所有关键操作都会记录审计日志：

- 操作类型: create / update / delete / settle / join / leave / export
- 记录内容: 操作人、时间、旧值、新值、IP 地址、Request-Id
- 可追溯: 按分组或按用户查询历史

## 导出报告说明

Excel 报告包含三个 Sheet：

1. **汇总**: 分组概况、账单统计、成员列表
2. **账单明细**: 所有账单的完整明细
3. **统计分析**: 按成员统计付款、欠款、余额

## 技术栈

### 后端

- NestJS 10
- TypeORM
- PostgreSQL
- JWT 认证
- Swagger API 文档
- ExcelJS (报告生成)

### 前端

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)
- React Router
- Lucide React (图标)

## 开发建议

1. **生产环境**: 请修改 JWT_SECRET，使用强随机字符串
2. **数据备份**: 定期备份 PostgreSQL 数据
3. **日志监控**: 建议接入 ELK 或其他日志系统
4. **HTTPS**: 生产环境务必启用 HTTPS

## License

MIT
