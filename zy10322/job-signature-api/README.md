# 作业结果签名 API

一个用于作业批次结果签名和验签的后端 API 服务，基于 Go + Gin + SQLite 实现。

## 功能特性

- **作业批次管理**：创建、查询、列出作业批次
- **结果签名**：对作业批次的文件哈希进行聚合签名
- **摘要校验**：验证签名摘要是否匹配
- **消费验签**：消费方验签并记录审计日志
- **过期失效**：支持按时间过期和验签次数限制
- **状态机**：严格的状态流转控制（pending → signed → verified → expired/revoked）
- **审计追踪**：完整的验签历史记录

## 数据模型

### JobBatch (作业批次)
- `id`: 批次唯一标识
- `batch_no`: 业务批次号（唯一）
- `creator`: 创建者
- `total_files`: 文件总数
- `status`: 状态 (pending/signed/verified/expired/revoked)
- `expire_at`: 过期时间

### ResultFile (结果文件)
- `id`: 文件记录 ID
- `batch_id`: 所属批次 ID
- `file_index`: 文件索引
- `file_name`: 文件名
- `file_hash`: 文件哈希
- `file_size`: 文件大小

### SignatureDigest (签名摘要)
- `id`: 摘要记录 ID
- `batch_id`: 批次 ID
- `algorithm`: 签名算法
- `digest`: 摘要值
- `signer`: 签名者

### Consumer (消费方)
- `id`: 消费方 ID
- `name`: 消费方名称
- `app_key`: 应用密钥
- `is_active`: 是否激活

### VerifyRecord (验签记录)
- `id`: 记录 ID
- `batch_id`: 批次 ID
- `consumer_id`: 消费方 ID
- `verify_result`: 验签结果
- `error_message`: 错误信息
- `verify_at`: 验签时间
- `client_ip`: 客户端 IP

### ExpireStrategy (失效策略)
- `batch_id`: 批次 ID
- `expire_days`: 有效天数
- `max_verify_count`: 最大验签次数
- `current_verify_count`: 当前验签次数

## API 接口

### 健康检查
```
GET /api/v1/health
```

### 批次管理
```
POST   /api/v1/batches              # 创建批次
GET    /api/v1/batches              # 列出批次
GET    /api/v1/batches/:batchId     # 获取批次状态
POST   /api/v1/batches/:batchId/sign    # 签名批次
POST   /api/v1/batches/:batchId/verify  # 验证批次
POST   /api/v1/batches/:batchId/revoke  # 吊销批次
GET    /api/v1/batches/:batchId/history # 验签历史
```

### 消费方管理
```
POST   /api/v1/consumers            # 创建消费方
```

## 状态流转

```
pending (待签名)
    ↓
  signed (已签名) ←→ verified (已验证)
    ↓                    ↓
    └───────→ expired / revoked ←───────┘
```

## 快速开始

### 1. 启动服务
```bash
cd cmd
go run main.go
```

服务将在 `http://localhost:8080` 启动。

### 2. 运行自检脚本
```bash
chmod +x scripts/test_api.sh
./scripts/test_api.sh
```

### 3. 运行单元测试
```bash
go test -v api_test.go
```

## 使用示例

### 创建作业批次
```bash
curl -X POST http://localhost:8080/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240101-001",
    "creator": "job-runner",
    "expire_days": 7,
    "files": [
      {"file_name": "part-0001.txt", "file_hash": "abc123...", "file_size": 1024},
      {"file_name": "part-0002.txt", "file_hash": "def456...", "file_size": 2048}
    ]
  }'
```

### 签名批次
```bash
curl -X POST http://localhost:8080/api/v1/batches/{batchId}/sign \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "{batchId}",
    "signer": "sign-service",
    "algorithm": "SHA256"
  }'
```

### 验签
```bash
curl -X POST http://localhost:8080/api/v1/batches/{batchId}/verify \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "{batchId}",
    "consumer_id": "{consumerId}",
    "digest": "{digest_value}"
  }'
```

## 测试场景覆盖

- ✅ 健康检查
- ✅ 创建批次
- ✅ 重复批次号（返回 409 Conflict）
- ✅ 签名批次
- ✅ 重复签名（返回 400 Bad Request）
- ✅ 错误摘要验签（返回 401 Unauthorized）
- ✅ 正确摘要验签（返回 200 OK）
- ✅ 吊销批次
- ✅ 验签已吊销批次（返回 400 Bad Request）
- ✅ 批次不存在（返回 404 Not Found）
- ✅ 验签历史记录

## 项目结构

```
job-signature-api/
├── cmd/
│   └── main.go              # 程序入口
├── internal/
│   ├── model/               # 数据模型和 DTO
│   │   ├── model.go
│   │   └── dto.go
│   ├── dal/                 # 数据访问层
│   │   └── database.go
│   ├── service/             # 业务逻辑层
│   │   └── service.go
│   └── handler/             # API 处理层
│       └── handler.go
├── api_test.go              # 单元测试
├── scripts/                 # 工具脚本
│   └── test_api.sh          # API 自检脚本
├── go.mod
├── go.sum
└── README.md
```

## 错误码

| HTTP 码 | 错误码 | 说明 |
|---------|--------|------|
| 400 | INVALID_REQUEST | 请求参数错误 |
| 400 | STATUS_TRANSITION_NOT_ALLOWED | 状态不允许跳转 |
| 400 | INVALID_STATUS | 批次状态无效 |
| 401 | DIGEST_MISMATCH | 摘要不匹配 |
| 403 | CONSUMER_INACTIVE | 消费方未激活 |
| 404 | BATCH_NOT_FOUND | 批次不存在 |
| 404 | CONSUMER_NOT_FOUND | 消费方不存在 |
| 409 | BATCH_ALREADY_EXISTS | 批次已存在 |
| 410 | BATCH_EXPIRED | 批次已过期 |
| 429 | VERIFY_COUNT_EXCEEDED | 验签次数超限 |
