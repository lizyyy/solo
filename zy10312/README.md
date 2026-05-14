# 多云对象存储路由 API

一个基于 Go 实现的多云对象存储路由服务，提供策略匹配、失败切换、摘要校验、链接签发和路由审计等核心功能。

## 项目结构

```
.
├── cmd/api/
│   └── main.go              # 程序入口
├── internal/
│   ├── model/
│   │   └── model.go         # 数据模型定义
│   ├── service/
│   │   ├── store.go         # 存储层实现
│   │   └── router.go        # 路由逻辑实现
│   └── handler/
│       └── handler.go       # HTTP 处理器
└── pkg/
    └── errors/
        └── errors.go        # 错误处理
```

## 核心功能

### 1. 数据模型

- **Bucket (存储桶)**: 云存储桶配置，支持多供应商
- **RoutingStrategy (路由策略)**: 支持优先级、轮询、加权等策略
- **UploadRequest (上传请求)**: 上传任务管理
- **RoutingSwitch (切换记录)**: 失败切换记录
- **ChecksumSummary (校验摘要)**: 文件完整性校验
- **AccessLink (访问链接)**: 临时访问链接
- **RoutingAudit (审计日志)**: 操作审计追踪

### 2. 核心规则

- **策略匹配**: 根据路由策略选择目标存储桶，支持优先级、轮询、加权三种策略
- **失败切换**: 上传失败时自动切换到备用存储桶，支持最大重试次数限制
- **摘要校验**: 支持 MD5、SHA1、SHA256 等哈希算法校验
- **链接签发**: 生成带过期时间的访问链接
- **路由审计**: 完整的操作日志记录

### 3. API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/buckets | 创建存储桶 |
| GET | /api/buckets | 列出所有存储桶 |
| POST | /api/strategies | 创建路由策略 |
| POST | /api/uploads | 创建上传请求 |
| POST | /api/uploads/{id}/route | 执行路由选择 |
| POST | /api/uploads/{id}/failover | 处理失败切换 |
| POST | /api/uploads/{id}/checksum | 执行摘要校验 |
| POST | /api/uploads/{id}/link | 生成访问链接 |
| POST | /api/uploads/{id}/complete | 完成上传 |
| GET | /api/uploads/{id} | 获取上传请求详情 |
| GET | /api/uploads/{id}/history | 获取单条上传历史 |
| GET | /api/history | 获取所有上传历史 |

### 4. 策略类型说明

- **priority (优先级策略)**: 根据 bucket 的 priority 字段排序，priority 越小优先级越高；重试时依次尝试下一个优先级桶
- **round_robin (轮询策略)**: 依次循环选择每个可用的存储桶，基于策略级别的计数器实现
- **weighted (加权策略)**: 根据 bucket 的 weight 字段按概率选择，weight 越大选中概率越高

### 5. 幂等性

- 支持通过 `idempotency_key` 请求字段实现幂等性
- 重复提交相同的幂等键 + 相同请求内容，直接返回已存在的记录
- 相同幂等键 + 不同请求内容，返回 IDEMPOTENCY_CONFLICT 错误
- 创建上传请求时会校验 strategy_id 对应的策略是否真实存在

## 启动服务

```bash
go run cmd/api/main.go
```

服务将在 `http://localhost:8080` 启动。

## 完整流程示例

以下是使用 curl 走完整流程的示例：

### 1. 创建存储桶

```bash
# 创建 AWS 存储桶
curl -X POST http://localhost:8080/api/buckets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-aws-bucket",
    "provider": "aws",
    "region": "us-east-1",
    "endpoint": "https://s3.amazonaws.com",
    "status": "active",
    "priority": 1
  }'

# 创建阿里云存储桶（带权重，用于加权策略）
curl -X POST http://localhost:8080/api/buckets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-aliyun-bucket",
    "provider": "aliyun",
    "region": "cn-hangzhou",
    "endpoint": "https://oss-cn-hangzhou.aliyuncs.com",
    "status": "active",
    "priority": 2,
    "weight": 3
  }'
```

### 2. 创建路由策略

```bash
# 注意: 替换下面的 bucket_ids 为实际返回的 ID

# 优先级策略示例
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "multi-cloud-priority",
    "type": "priority",
    "failover_mode": "automatic",
    "bucket_ids": ["bkt_xxx", "bkt_yyy"],
    "retry_count": 3,
    "timeout_sec": 30
  }'

# 轮询策略示例
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "multi-cloud-roundrobin",
    "type": "round_robin",
    "failover_mode": "automatic",
    "bucket_ids": ["bkt_xxx", "bkt_yyy"],
    "retry_count": 3,
    "timeout_sec": 30
  }'

# 加权策略示例（weight 越大，选中概率越高）
curl -X POST http://localhost:8080/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "multi-cloud-weighted",
    "type": "weighted",
    "failover_mode": "automatic",
    "bucket_ids": ["bkt_xxx", "bkt_yyy"],
    "retry_count": 3,
    "timeout_sec": 30
  }'
```

### 3. 创建上传请求（带幂等性）

```bash
# 注意: 替换 strategy_id 为实际返回的策略 ID
curl -X POST http://localhost:8080/api/uploads \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "example.txt",
    "file_size": 1024,
    "content_type": "text/plain",
    "strategy_id": "strat_xxx",
    "idempotency_key": "unique-key-12345"
  }'

# 重复提交相同的 idempotency_key + 相同内容，将返回相同结果（不会创建新记录）
curl -X POST http://localhost:8080/api/uploads \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "example.txt",
    "file_size": 1024,
    "content_type": "text/plain",
    "strategy_id": "strat_xxx",
    "idempotency_key": "unique-key-12345"
  }'

# 相同 idempotency_key + 不同内容，将返回 IDEMPOTENCY_CONFLICT 错误
curl -X POST http://localhost:8080/api/uploads \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "different.txt",
    "file_size": 2048,
    "content_type": "text/plain",
    "strategy_id": "strat_xxx",
    "idempotency_key": "unique-key-12345"
  }'
```

### 4. 执行路由选择

```bash
# 注意: 替换 upload_id 为实际返回的上传请求 ID
curl -X POST http://localhost:8080/api/uploads/upload_xxx/route
```

### 5. 模拟失败并切换

```bash
curl -X POST http://localhost:8080/api/uploads/upload_xxx/failover \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "timeout",
    "error_code": "504",
    "error_msg": "Gateway Timeout"
  }'
```

### 6. 摘要校验

```bash
curl -X POST http://localhost:8080/api/uploads/upload_xxx/checksum \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "md5",
    "expected_hash": "d41d8cd98f00b204e9800998ecf8427e",
    "actual_data": "SGVsbG8gV29ybGQ="
  }'
```

### 7. 生成访问链接

```bash
curl -X POST http://localhost:8080/api/uploads/upload_xxx/link \
  -H "Content-Type: application/json" \
  -d '{
    "object_key": "path/to/example.txt",
    "expires_in": 3600
  }'
```

### 8. 完成上传

```bash
curl -X POST http://localhost:8080/api/uploads/upload_xxx/complete
```

### 9. 查询历史记录

```bash
# 查询单条上传历史
curl http://localhost:8080/api/uploads/upload_xxx/history

# 查询所有历史
curl http://localhost:8080/api/history
```

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "CHECKSUM_MISMATCH",
    "message": "checksum verification failed",
    "details": "additional error details"
  }
}
```

## 支持的错误码

- `INVALID_REQUEST`: 请求参数无效
- `NOT_FOUND`: 资源不存在
- `CONFLICT`: 资源冲突
- `IDEMPOTENCY_CONFLICT`: 幂等性冲突
- `STRATEGY_NOT_FOUND`: 路由策略不存在
- `BUCKET_NOT_FOUND`: 存储桶不存在
- `NO_AVAILABLE_BUCKET`: 无可用存储桶
- `CHECKSUM_MISMATCH`: 摘要校验失败
- `UPLOAD_FAILED`: 上传失败
- `INTERNAL_ERROR`: 内部错误
