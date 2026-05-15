# 预签名链接治理 API

基于 Go 的单体后端服务，用于治理和管理文件预签名链接，支持签发、次数限制、撤销失效、访问审计、过期清理等核心规则。

## 项目结构

```
.
├── main.go              # 主入口
├── go.mod               # 依赖配置
├── model/
│   └── model.go         # 数据模型定义
├── config/
│   └── db.go            # 数据库配置
├── repository/
│   └── repository.go    # 数据访问层
├── service/
│   ├── service.go       # 业务逻辑层
│   └── cleanup.go       # 定时清理任务
├── api/
│   └── handler.go       # API 处理器
└── cmd/
    └── example.go       # 命令行示例
```

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动。

### 3. 运行示例

新开终端运行：

```bash
go run cmd/example.go
```

## API 接口

### 文件管理

- `POST /api/v1/files` - 创建文件对象
- `GET /api/v1/files` - 获取文件列表
- `GET /api/v1/files/:id` - 获取单个文件

### 签发人管理

- `POST /api/v1/issuers` - 创建签发人
- `GET /api/v1/issuers` - 获取签发人列表
- `GET /api/v1/issuers/:id` - 获取单个签发人

### 链接管理

- `POST /api/v1/links` - 创建预签名链接（支持幂等性）
- `GET /api/v1/links` - 获取链接列表
- `GET /api/v1/links/:id` - 获取单个链接
- `POST /api/v1/links/:id/revoke` - 撤销链接
- `GET /api/v1/links/:id/logs` - 获取链接访问日志

### 访问验证

- `GET /api/v1/access/validate/:token` - 验证链接有效性
- `GET /api/v1/access/logs` - 获取所有访问日志

### 健康检查

- `GET /health` - 服务健康检查

---

## 造数据指南

### 1. 创建文件对象

**请求：**
```bash
curl -X POST http://localhost:8080/api/v1/files \
  -H "Content-Type: application/json" \
  -d '{"name": "report.pdf", "path": "/documents/report.pdf", "size": 1024000}'
```

**响应：**
```json
{
  "id": "uuid-xxx",
  "name": "report.pdf",
  "path": "/documents/report.pdf",
  "size": 1024000,
  "createdAt": "2024-01-01T10:00:00Z"
}
```

### 2. 创建签发人

**请求：**
```bash
curl -X POST http://localhost:8080/api/v1/issuers \
  -H "Content-Type: application/json" \
  -d '{"name": "李四", "email": "lisi@example.com", "department": "技术部"}'
```

**响应：**
```json
{
  "id": "uuid-xxx",
  "name": "李四",
  "email": "lisi@example.com",
  "department": "技术部",
  "createdAt": "2024-01-01T10:00:00Z"
}
```

### 3. 创建预签名链接

**请求（基本）：**
```bash
curl -X POST http://localhost:8080/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "文件ID",
    "issuer_id": "签发人ID",
    "expire_hours": 24,
    "max_access": 5
  }'
```

**请求（带幂等性）：**
```bash
curl -X POST http://localhost:8080/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "order-12345-file-access",
    "file_id": "文件ID",
    "issuer_id": "签发人ID",
    "expire_hours": 24,
    "max_access": 5
  }'
```

**响应：**
```json
{
  "id": "uuid-xxx",
  "token": "link-token-xxx",
  "file_id": "文件ID",
  "issuer_id": "签发人ID",
  "expiresAt": "2024-01-02T10:00:00Z",
  "max_access": 5,
  "access_count": 0,
  "status": "active"
}
```

---

## 触发异常场景

### 场景 1: 文件不存在

**请求：**
```bash
curl -X POST http://localhost:8080/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "non-existent-id",
    "issuer_id": "有效签发人ID",
    "expire_hours": 24,
    "max_access": 5
  }'
```

**响应（404）：**
```json
{
  "error": "file not found"
}
```

### 场景 2: 签发人不存在

类似场景 1，使用无效的 `issuer_id`。

### 场景 3: 访问次数耗尽

1. 创建一个 `max_access=2` 的链接
2. 验证链接 3 次：

```bash
# 第1次 - 成功
curl http://localhost:8080/api/v1/access/validate/你的token

# 第2次 - 成功
curl http://localhost:8080/api/v1/access/validate/你的token

# 第3次 - 失败
curl http://localhost:8080/api/v1/access/validate/你的token
```

**第3次响应（403）：**
```json
{
  "valid": false,
  "status": "exhausted",
  "fail_reason": "access count exhausted"
}
```

### 场景 4: 链接被撤销

1. 创建链接
2. 撤销链接：
```bash
curl -X POST http://localhost:8080/api/v1/links/链接ID/revoke \
  -H "Content-Type: application/json" \
  -d '{"reason": "文件内容变更", "revoked_by": "admin"}'
```
3. 验证链接：
```bash
curl http://localhost:8080/api/v1/access/validate/你的token
```

**响应（403）：**
```json
{
  "valid": false,
  "status": "revoked",
  "fail_reason": "link revoked: 文件内容变更"
}
```

### 场景 5: 链接不存在

**请求：**
```bash
curl http://localhost:8080/api/v1/access/validate/invalid-token
```

**响应（403）：**
```json
{
  "valid": false,
  "status": "not_found",
  "fail_reason": "link not found"
}
```

### 场景 6: 幂等性测试（重复提交）

使用相同的 `idempotency_key` 发送两次创建请求：

```bash
# 第一次
curl -X POST http://localhost:8080/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key": "test-key-001", "file_id": "文件ID", "issuer_id": "签发人ID", "expire_hours": 1, "max_access": 3}'

# 第二次（返回相同的链接，不创建新记录）
curl -X POST http://localhost:8080/api/v1/links \
  -H "Content-Type: application/json" \
  -d '{"idempotency_key": "test-key-001", "file_id": "文件ID", "issuer_id": "签发人ID", "expire_hours": 1, "max_access": 3}'
```

两次返回的链接 ID 完全相同！

---

## 查看处理记录

### 1. 查看单个链接的访问日志

```bash
curl http://localhost:8080/api/v1/links/链接ID/logs?limit=10
```

**响应：**
```json
[
  {
    "id": "log-id-1",
    "link_id": "链接ID",
    "link_token": "token",
    "access_time": "2024-01-01T10:00:00Z",
    "client_ip": "::1",
    "user_agent": "curl/7.68.0",
    "success": true,
    "fail_reason": ""
  },
  {
    "id": "log-id-2",
    "success": false,
    "fail_reason": "access count exhausted"
  }
]
```

### 2. 查看所有访问日志（分页）

```bash
curl http://localhost:8080/api/v1/access/logs?limit=50&offset=0
```

**响应：**
```json
{
  "data": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### 3. 查看链接状态

```bash
curl http://localhost:8080/api/v1/links/链接ID
```

可以查看链接的：
- 当前状态 (active/revoked/expired/exhausted)
- 已访问次数
- 剩余访问次数
- 过期时间
- 撤销信息

### 4. 查看所有链接列表

```bash
curl http://localhost:8080/api/v1/links
```

---

## 核心规则说明

### 链接状态流转

```
active (活跃)
   |
   |-- 访问次数达到 max_access --> exhausted (耗尽)
   |
   |-- 手动撤销 --> revoked (已撤销)
   |
   |-- 时间过期 --> expired (已过期)
```

### 审计字段

每次访问都会记录：
- 访问时间
- 客户端 IP
- User-Agent
- 是否成功
- 失败原因

### 定时清理

- 服务每小时自动扫描过期链接
- 将状态从 `active` 更新为 `expired`
- 可在 `service/cleanup.go` 调整频率

---

## 数据模型

### FileObject (文件对象)
- `id`: 唯一标识
- `name`: 文件名
- `path`: 文件路径
- `size`: 文件大小
- `mime_type`: MIME 类型

### Issuer (签发人)
- `id`: 唯一标识
- `name`: 姓名
- `email`: 邮箱（唯一）
- `department`: 部门
- `is_active`: 是否激活

### PresignedLink (预签名链接)
- `id`: 唯一标识
- `idempotency_key`: 幂等性键（唯一）
- `file_id`: 关联文件ID
- `issuer_id`: 签发人ID
- `token`: 访问令牌（唯一）
- `expires_at`: 过期时间
- `max_access`: 最大访问次数
- `access_count`: 已访问次数
- `status`: 状态 (active/revoked/expired/exhausted)
- `revoke_reason`: 撤销原因
- `revoked_at`: 撤销时间
- `revoked_by`: 撤销人

### AccessLog (访问日志)
- `id`: 唯一标识
- `link_id`: 链接ID
- `link_token`: 链接Token
- `access_time`: 访问时间
- `client_ip`: 客户端IP
- `user_agent`: 用户代理
- `success`: 是否成功
- `fail_reason`: 失败原因
