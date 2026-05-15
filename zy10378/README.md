# 外部回调白名单 API

一个基于 Go + Gin 实现的单体后端服务，用于管理和验证外部系统回调请求的白名单规则。

## 核心特性

- ✅ **回调方管理**：管理外部回调系统的基本信息
- ✅ **白名单规则**：支持源 IP、请求路径、HTTP 方法、请求头的多维度校验
- ✅ **状态流转**：草稿 → 测试中 → 已激活 → 已停用，支持回滚
- ✅ **幂等性保证**：重复提交不会产生脏数据
- ✅ **试运行模式**：Dry Run 模式下不校验规则状态，方便测试
- ✅ **拒绝记录**：所有被拒绝的请求都有完整审计日志
- ✅ **版本管理**：规则的每次变更都有版本记录
- ✅ **Web 管理控制台**：简单易用的可视化操作界面

## 项目结构

```
.
├── cmd/
│   └── main.go              # 程序入口
├── internal/
│   ├── model/
│   │   ├── model.go         # 核心数据模型
│   │   └── dto.go           # 请求/响应 DTO
│   ├── storage/
│   │   └── storage.go       # 内存存储层（含幂等性、状态校验）
│   ├── service/
│   │   └── service.go       # 业务逻辑层
│   └── handler/
│       └── handler.go       # HTTP 接口层
├── web/
│   └── index.html           # Web 管理控制台
├── test/
│   └── service_test.go      # 单元测试
├── scripts/
│   └── self_check.sh        # 集成自检脚本
├── go.mod
├── go.sum
└── README.md
```

## 快速开始

### 1. 启动服务

```bash
cd /Users/lzy/pro/solo/workspaces/zy10378
go run cmd/main.go
```

服务将在 `http://localhost:8080` 启动。

### 2. 访问管理控制台

打开浏览器访问：`http://localhost:8080`

### 3. 运行自检脚本

```bash
chmod +x scripts/self_check.sh
./scripts/self_check.sh
```

### 4. 运行单元测试

```bash
go test -v ./test/...
```

## API 文档

### 基础路径

所有 API 都以 `/api/v1` 为前缀。

### 1. 回调方管理

#### 创建回调方

```http
POST /api/v1/parties
Content-Type: application/json

{
  "name": "支付系统",
  "app_id": "pay_001"
}
```

#### 查询回调方

```http
GET /api/v1/parties/{id}
```

### 2. 白名单规则管理

#### 创建规则

```http
POST /api/v1/rules
Content-Type: application/json

{
  "party_id": "party-uuid",
  "name": "支付回调规则",
  "description": "允许支付系统的回调请求",
  "source_rules": ["192.168.1.0/24", "10.0.0.1"],
  "path_rules": ["/webhook/.*", "/callback"],
  "method_rules": ["POST", "PUT"],
  "header_rules": ["X-Signature"],
  "idempotency_key": "optional-unique-key"
}
```

#### 查询规则

```http
GET /api/v1/rules/{id}
GET /api/v1/rules?party_id={party_id}
```

#### 更新规则状态

```http
PUT /api/v1/rules/{id}/status
Content-Type: application/json

{
  "status": "testing",  // draft | testing | active | inactive | rollback
  "comment": "进入测试阶段"
}
```

**状态流转规则**：
- `draft` → `testing` 或 `inactive`
- `testing` → `active` 或 `draft` 或 `inactive`
- `active` → `testing` 或 `inactive` 或 `rollback`
- `inactive` → `draft`
- `rollback` → `active` 或 `draft`

#### 查询规则版本历史

```http
GET /api/v1/rules/{id}/versions
```

### 3. 回调验证

#### 验证回调请求

```http
POST /api/v1/verify
Content-Type: application/json

{
  "rule_id": "rule-uuid",
  "party_id": "party-uuid",
  "source_ip": "192.168.1.100",
  "request_path": "/webhook/payment",
  "request_method": "POST",
  "headers": {
    "X-Signature": "valid-signature"
  },
  "is_dry_run": false,
  "idempotency_key": "optional-unique-key"
}
```

**验证逻辑**：
1. 源 IP 校验：检查 IP 是否在允许的 CIDR 范围内
2. 路径校验：检查请求路径是否匹配任一正则表达式
3. 方法校验：检查 HTTP 方法是否在允许列表中
4. 请求头校验：检查是否包含所有必需的请求头
5. 规则状态校验：非 Dry Run 模式下规则必须处于 `active` 状态

### 4. 拒绝记录查询

```http
GET /api/v1/rejections
GET /api/v1/rejections?party_id={party_id}
GET /api/v1/rejections?rule_id={rule_id}
```

## 核心数据模型

### CallbackParty（回调方）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 回调方名称 |
| app_id | string | 应用标识 |
| secret | string | 密钥（不返回给前端） |
| is_active | bool | 是否激活 |
| created_at | time | 创建时间 |

### WhitelistRule（白名单规则）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| party_id | string | 所属回调方 ID |
| version | int | 当前版本号 |
| name | string | 规则名称 |
| status | string | 状态：draft/testing/active/inactive/rollback |
| source_rules | []string | 源 IP 规则（CIDR 或单个 IP） |
| path_rules | []string | 路径正则规则 |
| method_rules | []string | 允许的 HTTP 方法 |
| header_rules | []string | 必需的请求头 |
| created_at | time | 创建时间 |

### RejectionRecord（拒绝记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| rule_id | string | 关联的规则 ID |
| party_id | string | 关联的回调方 ID |
| reason_code | string | 拒绝原因代码 |
| reason | string | 详细拒绝原因 |
| source_ip | string | 请求源 IP |
| request_path | string | 请求路径 |
| rejected_at | time | 拒绝时间 |

## 幂等性设计

### 规则创建幂等性

- 自动根据 `party_id + name` 生成幂等性 Key
- 也支持传入自定义的 `idempotency_key`
- 重复请求返回已存在的规则，不会创建新记录

### 验证请求幂等性

- 自动根据 `party_id + rule_id + source_ip + request_path + request_method + is_dry_run` 生成幂等性 Key
- 支持传入自定义的 `idempotency_key`
- 相同请求重复调用会返回首次验证结果，不会产生重复的拒绝记录

## 测试覆盖

单元测试覆盖以下场景：

1. ✅ 幂等性测试：重复创建规则返回相同 ID
2. ✅ 状态流转测试：非法流转被拒绝，合法流转成功
3. ✅ 回调验证测试：Dry Run 模式与真实模式的行为差异
4. ✅ 源 IP 验证：合法 IP 通过，非法 IP 被拒绝
5. ✅ 重复验证请求：相同请求返回相同结果

## 扩展建议

1. **持久化存储**：当前使用内存存储，可扩展为 Redis/MySQL 等持久化方案
2. **认证授权**：添加 API Key 或 JWT 认证
3. **限流保护**：针对验证接口添加频率限制
4. **Webhook 通知**：规则状态变更时通知相关方
5. **指标监控**：添加 Prometheus 指标暴露
6. **规则分组**：支持规则的分组和优先级
7. **批量操作**：支持规则的批量导入导出
8. **审计日志**：完整的操作审计记录

## License

MIT
