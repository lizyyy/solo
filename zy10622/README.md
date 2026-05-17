# 身份认证服务临时权限二次确认 API

本地可测试的临时权限管理服务，支持完整的权限申请、确认、生效、到期、回收流转。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 运行测试

```bash
npm test
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 核心数据模型

### 用户 (users)
- id: 用户ID
- username: 用户名
- name: 姓名
- email: 邮箱
- department: 部门

### 权限包 (permission_packages)
- id: 包ID
- code: 权限代码
- name: 权限名称
- description: 描述
- permissions: 权限列表 (JSON数组)

### 临时权限 (temp_permissions)
- id: 申请ID
- user_id: 申请人
- permission_package_id: 权限包
- reason: 申请理由
- status: 状态
  - `pending_confirm`: 待确认
  - `active`: 已生效
  - `expired`: 已到期
  - `revoked`: 已回收
- valid_from: 生效时间
- valid_to: 失效时间
- applied_by: 申请人
- confirmed_by: 确认人
- confirmed_at: 确认时间
- revoked_by: 回收人
- revoked_at: 回收时间
- revoked_reason: 回收原因

### 操作历史 (permission_history)
- id: 记录ID
- temp_permission_id: 关联权限
- action: 动作 (apply/confirm/revoke/expire)
- old_status: 旧状态
- new_status: 新状态
- operator: 操作人
- remark: 备注
- created_at: 操作时间

## API 接口

### 健康检查
```
GET /health
```

### 用户管理
```
GET /api/users
```

### 权限包管理
```
GET /api/packages
```

### 临时权限

#### 列表查询
```
GET /api/temp-permissions
```

可选筛选参数:
- `user_id`: 按用户筛选
- `status`: 按状态筛选
- `package_id`: 按权限包筛选

#### 详情查询
```
GET /api/temp-permissions/:id
```

#### 操作历史
```
GET /api/temp-permissions/:id/history
```

#### 申请临时权限
```
POST /api/temp-permissions
{
  "user_id": "u002",
  "package_id": "p001",
  "reason": "年终审计需要",
  "valid_from": 1735689600000,
  "valid_to": 1736294400000,
  "applied_by": "u002"
}
```

#### 二次确认
```
POST /api/temp-permissions/:id/confirm
{
  "confirmed_by": "u001"
}
```

#### 回收权限
```
POST /api/temp-permissions/:id/revoke
{
  "revoked_by": "u001",
  "revoked_reason": "工作已完成"
}
```

#### 批量导入
```
POST /api/temp-permissions/batch-import
{
  "records": [
    { "user_id": "u002", "package_id": "p001", "reason": "...", "valid_from": ..., "valid_to": ... }
  ],
  "operator": "u001"
}
```

**特点**:
- 行级错误处理，单条失败不中断整批
- 到期权限导入会失败，提示："权限已到期，刷新令牌后仍可访问，但不建议继续使用"
- 返回详细的成功/失败明细

#### CSV导出
```
GET /api/temp-permissions/export/csv
```

## 测试说明

运行 `npm test` 会执行以下测试:

1. **完整流转测试**: 申请 → 确认 → 生效 → 查看历史 → 回收
2. **状态冲突验证**: 验证非法状态流转会被正确拒绝
3. **列表筛选导出**: 测试列表查询、条件筛选、CSV导出
4. **批量导入测试**: 包含成功、用户不存在、权限包不存在、缺字段、时间错误、到期权限等 7 条测试数据

## 预置数据

### 用户
- u001: 系统管理员 (技术部)
- u002: 张三 (财务部)
- u003: 李四 (运营部)
- u004: 王五 (市场部)
- u005: 赵六 (人力资源部)

### 权限包
- p001: 财务数据查看 (finance:view, finance:report)
- p002: 用户管理 (user:create, user:read, user:update, user:delete)
- p003: 系统配置 (system:config, system:log)
- p004: 数据导出 (data:export, data:download)
- p005: 审计日志查看 (audit:view, audit:export)

### 临时权限申请 (预置4条，覆盖所有状态)

## 配置

环境变量:
- `PORT`: 服务端口 (默认 3000)
- `DB_PATH`: SQLite 数据库路径 (默认 ./data/auth-permissions.db)

示例:
```bash
PORT=8080 DB_PATH=/tmp/test.db npm start
```
