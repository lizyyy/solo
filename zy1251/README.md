# Auth API Service

一个本地可运行的认证与鉴权 API 服务，专为小团队接口权限演练设计。

## ✨ 功能特性

- **用户认证**: 注册、登录、JWT 访问令牌 + 刷新令牌
- **安全机制**: 密码错误锁定、账户状态管理
- **RBAC 权限模型**: 角色/权限/资源三层配置
- **多租户隔离**: 支持租户级数据隔离
- **接口鉴权**: 灵活的中间件（角色校验、权限校验）
- **权限管理**: 管理员给用户改角色、权限试算接口
- **审计日志**: 完整的操作日志追踪
- **报告导出**: Markdown 格式权限核对报告

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run prisma:setup
```

这会执行以下操作：
- 生成 Prisma Client
- 创建 SQLite 数据库表结构
- 导入 seed 测试数据

### 3. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 4. 验证服务

```bash
curl http://localhost:3000/health
```

## 👤 测试用户 (Seed 数据)

运行 `npm run prisma:seed` 后会创建以下测试用户：

| 角色 | 邮箱 | 密码 | 权限说明 |
|------|------|------|---------|
| 超级管理员 | `superadmin@demo.com` | `Admin@123` | 拥有系统所有权限 |
| 管理员 | `admin@demo.com` | `Admin@123` | 用户管理、权限检查 |
| 普通用户 | `user@demo.com` | `User@123` | 基础读写权限 |
| 访客 | `guest@demo.com` | `User@123` | 只读权限 |

**租户信息**:
- 租户名称: `演示租户`
- 租户代码 (slug): `demo`

## 🎭 角色说明

| 角色代码 | 角色名称 | 权限范围 |
|---------|---------|---------|
| `super_admin` | 超级管理员 | 所有权限 |
| `admin` | 管理员 | 用户管理、角色查看、权限检查 |
| `user` | 普通用户 | 基础读写权限 |
| `guest` | 访客 | 只读权限 |

## 🔌 API 端点

### 认证相关

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 否 |
| POST | `/api/auth/login` | 用户登录 | 否 |
| POST | `/api/auth/refresh` | 刷新令牌 | 否 |
| POST | `/api/auth/logout` | 用户登出 | 是 |
| GET | `/api/auth/me` | 获取当前用户 | 是 |

### 用户管理

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| GET | `/api/users` | 用户列表 | admin, super_admin |
| GET | `/api/users/:id` | 用户详情 | admin, super_admin |
| POST | `/api/users` | 创建用户 | admin, super_admin |
| PUT | `/api/users/:id` | 更新用户 | admin, super_admin |
| DELETE | `/api/users/:id` | 删除用户 | super_admin |
| POST | `/api/users/:id/unlock` | 解锁用户 | admin, super_admin |
| GET | `/api/users/:id/roles` | 获取用户角色 | admin, super_admin |
| POST | `/api/users/:id/roles` | 分配角色 | admin, super_admin |
| DELETE | `/api/users/:id/roles/:roleId` | 移除角色 | admin, super_admin |

### 角色管理

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| GET | `/api/roles` | 角色列表 | admin, super_admin |
| GET | `/api/roles/:id` | 角色详情 | admin, super_admin |
| POST | `/api/roles` | 创建角色 | super_admin |
| PUT | `/api/roles/:id` | 更新角色 | super_admin |
| DELETE | `/api/roles/:id` | 删除角色 | super_admin |

### 权限管理

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| GET | `/api/permissions` | 权限列表 | admin, super_admin |
| GET | `/api/permissions/my` | 我的权限 | 登录用户 |
| POST | `/api/permissions` | 创建权限 | super_admin |
| PUT | `/api/permissions/:id` | 更新权限 | super_admin |
| DELETE | `/api/permissions/:id` | 删除权限 | super_admin |

### 资源管理

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| GET | `/api/resources` | 资源列表 | admin, super_admin |
| POST | `/api/resources` | 创建资源 | super_admin |
| PUT | `/api/resources/:id` | 更新资源 | super_admin |
| DELETE | `/api/resources/:id` | 删除资源 | super_admin |

### 权限试算与报告

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| POST | `/api/permission-check/check-user` | 检查用户权限 | admin, super_admin |
| POST | `/api/permission-check/check-role` | 检查角色权限 | admin, super_admin |
| GET | `/api/permission-check/user-roles/:userId` | 获取用户角色权限 | admin, super_admin |
| GET | `/api/permission-check/report` | 权限核对报告 (JSON) | admin, super_admin |
| GET | `/api/permission-check/report/export` | 导出权限报告 (Markdown) | admin, super_admin |
| GET | `/api/permission-check/report/user/:userId` | 用户权限报告 (JSON) | admin, super_admin |
| GET | `/api/permission-check/report/user/:userId/export` | 导出用户权限报告 (Markdown) | admin, super_admin |

### 审计日志

| 方法 | 端点 | 描述 | 所需角色 |
|------|------|------|---------|
| GET | `/api/audit-logs` | 审计日志列表 | admin, super_admin |
| GET | `/api/audit-logs/my` | 我的操作日志 | 登录用户 |

## 📝 CURL 示例

### 1. 登录获取令牌

```bash
# 超级管理员登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@demo.com",
    "password": "Admin@123",
    "tenantSlug": "demo"
  }'
```

保存返回的 `accessToken` 和 `refreshToken` 用于后续请求。

```bash
# 保存令牌到环境变量 (替换为实际返回的 token)
export ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. 获取当前用户信息

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 3. 获取用户列表

```bash
# 需要 admin 或 super_admin 角色
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 4. 创建新用户

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "email": "newuser@demo.com",
    "password": "NewPass@123",
    "name": "新用户",
    "roleIds": []
  }'
```

### 5. 权限试算接口

```bash
# 检查用户是否拥有某权限
curl -X POST http://localhost:3000/api/permission-check/check-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "userId": "用户ID",
    "permissionCodes": ["user:list", "demo:read", "demo:delete"]
  }'
```

### 6. 导出权限核对报告

```bash
# 导出 Markdown 格式报告
curl -o permission-report.md http://localhost:3000/api/permission-check/report/export \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 7. 刷新令牌

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

### 8. 用户登出

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}"
```

## ❌ 异常场景示例

### 1. 无效令牌 (Bad Token)

```bash
# 使用伪造或过期的令牌
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid-token-123"
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "令牌无效或已过期"
  },
  "timestamp": "..."
}
```

### 2. 越权访问 (Forbidden)

使用普通用户账号尝试访问需要 admin 权限的接口：

```bash
# 先用普通用户登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@demo.com",
    "password": "User@123",
    "tenantSlug": "demo"
  }'

# 保存普通用户的 token
export USER_TOKEN="普通用户的 accessToken"

# 尝试访问需要 admin 权限的用户列表接口
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer $USER_TOKEN"
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_ROLE",
    "message": "没有权限访问此资源"
  },
  "timestamp": "..."
}
```

### 3. 权限不足 (Insufficient Permission)

使用 guest 用户尝试写入操作：

```bash
# guest 用户登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "guest@demo.com",
    "password": "User@123",
    "tenantSlug": "demo"
  }'

# guest 用户只有 demo:read 权限，没有 demo:write 权限
# 模拟一个需要 demo:write 权限的场景
# 可以通过权限试算接口验证
curl -X POST http://localhost:3000/api/permission-check/check-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "userId": "guest用户的ID",
    "permissionCodes": ["demo:read", "demo:write", "demo:delete"]
  }'
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "checks": [
      {
        "permissionCode": "demo:read",
        "granted": true,
        "grantedBy": { "roleCode": "guest" }
      },
      {
        "permissionCode": "demo:write",
        "granted": false,
        "reason": "用户没有分配的角色包含此权限"
      },
      {
        "permissionCode": "demo:delete",
        "granted": false,
        "reason": "用户没有分配的角色包含此权限"
      }
    ],
    "summary": {
      "total": 3,
      "granted": 1,
      "denied": 2
    }
  },
  "timestamp": "..."
}
```

### 4. 过期刷新令牌 (Expired Refresh Token)

当刷新令牌过期后尝试刷新：

```bash
# 使用已过期的 refresh token
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "expired-refresh-token"}'
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "刷新令牌已过期或已被撤销"
  },
  "timestamp": "..."
}
```

### 5. 密码错误锁定 (Account Lockout)

连续错误输入密码会触发账户锁定：

```bash
# 连续输入错误密码 5 次
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "user@demo.com",
      "password": "wrong-password",
      "tenantSlug": "demo"
    }'
  echo ""
done
```

**第 5 次的预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "密码错误次数过多，账户已锁定 30 分钟"
  },
  "timestamp": "..."
}
```

### 6. 解锁用户

管理员可以解锁被锁定的用户：

```bash
# 使用 superadmin 账号解锁
curl -X POST http://localhost:3000/api/users/[被锁定用户的ID]/unlock \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 7. 缺少认证头 (Missing Token)

```bash
# 不携带 Authorization 头
curl http://localhost:3000/api/users
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "MISSING_TOKEN",
    "message": "缺少认证令牌"
  },
  "timestamp": "..."
}
```

### 8. 用户不存在

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@demo.com",
    "password": "any-password",
    "tenantSlug": "demo"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "用户名或密码错误"
  },
  "timestamp": "..."
}
```

### 9. 禁用的用户

```bash
# 先禁用用户 (需要 super_admin)
curl -X PUT http://localhost:3000/api/users/[用户ID] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"isActive": false}'

# 尝试登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@demo.com",
    "password": "User@123",
    "tenantSlug": "demo"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_DISABLED",
    "message": "账户已被禁用"
  },
  "timestamp": "..."
}
```

## 📊 数据库结构

### 核心表

| 表名 | 说明 |
|------|------|
| `tenants` | 租户表 |
| `users` | 用户表 |
| `roles` | 角色表 |
| `permissions` | 权限表 |
| `resources` | 资源表 |
| `user_roles` | 用户-角色关联表 |
| `role_permissions` | 角色-权限关联表 |
| `refresh_tokens` | 刷新令牌表 |
| `audit_logs` | 审计日志表 |

### ER 关系

```
Tenant (1) ----< (N) User
Tenant (1) ----< (N) Role
Tenant (1) ----< (N) Resource
Tenant (1) ----< (N) AuditLog

User (1) ----< (N) UserRole
Role (1) ----< (N) UserRole

Role (1) ----< (N) RolePermission
Permission (1) ----< (N) RolePermission

Resource (1) ----< (N) Permission
Resource (1) ----< (N) Resource (自关联 parent/children)

User (1) ----< (N) RefreshToken
User (1) ----< (N) AuditLog
```

## 🔧 配置选项

环境变量配置 (`.env` 文件):

```bash
# 服务端口
PORT=3000

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRES_IN=15m    # 访问令牌有效期
JWT_REFRESH_EXPIRES_IN=7d    # 刷新令牌有效期

# 数据库
DATABASE_URL="file:./dev.db"

# 密码
BCRYPT_SALT_ROUNDS=10

# 登录锁定策略
MAX_LOGIN_ATTEMPTS=5           # 最大失败尝试次数
LOCKOUT_DURATION_MINUTES=30    # 锁定时长 (分钟)
```

## 🧪 测试建议

### 权限演练场景

1. **角色继承测试**:
   - 创建角色 `manager`，继承 `user` 的所有权限并添加额外权限
   - 验证权限是否正确传递

2. **权限边界测试**:
   - 测试用户被移除角色后是否失去相应权限
   - 测试角色被删除后相关用户的权限变化

3. **并发场景**:
   - 同时使用多个账号登录测试
   - 测试刷新令牌的并发安全性

4. **边界条件**:
   - 测试空角色、空权限的用户行为
   - 测试已禁用用户的登录行为

### 安全测试

1. **令牌安全性**:
   - 测试篡改 JWT payload 后是否被拒绝
   - 测试不同用户的 token 能否互相使用

2. **注入攻击**:
   - 测试注册/登录接口的 SQL 注入
   - 测试参数注入

## 📝 开发说明

### 项目结构

```
src/
├── config/              # 配置
├── lib/                 # 库 (Prisma)
├── middleware/          # 中间件
│   ├── auth.ts          # 认证中间件
│   └── error.ts         # 错误处理
├── routes/              # 路由
│   ├── auth.ts          # 认证路由
│   ├── users.ts         # 用户路由
│   ├── roles.ts         # 角色路由
│   ├── permissions.ts   # 权限路由
│   ├── resources.ts     # 资源路由
│   ├── permissionCheck.ts  # 权限试算
│   └── auditLogs.ts     # 审计日志
├── services/            # 业务逻辑
│   ├── authService.ts
│   ├── userService.ts
│   ├── roleService.ts
│   ├── permissionService.ts
│   ├── resourceService.ts
│   ├── permissionCheckService.ts
│   ├── auditLogService.ts
│   └── reportService.ts
├── types/               # 类型定义
├── utils/               # 工具函数
│   ├── jwt.ts
│   └── password.ts
└── index.ts             # 入口

prisma/
├── schema.prisma        # 数据模型
└── seed.ts              # 种子数据
```

### 添加新权限

1. 在 `prisma/schema.prisma` 中添加资源（如需要）
2. 在 `prisma/seed.ts` 中添加权限定义
3. 在路由中使用 `requirePermission('权限代码')` 中间件

示例:

```typescript
// 在路由中使用权限校验
router.get(
  '/custom-endpoint',
  authMiddleware,
  requirePermission('custom:read'),
  (req, res) => {
    res.json({ message: '有权限访问' });
  }
);
```

## 📄 许可证

MIT
