# 审计日志平台 - 日志保留期例外申请 API

用于管理审计日志保留期例外申请的微服务，支持登记、审批、到期检查、归档导出全流程。

## 状态流转

```
DEFAULT_RETENTION (默认保留)
        ↓ 申请例外
EXCEPTION_APPLIED (例外申请中)
        ↓ 批准 / 拒绝
APPROVED (已批准) → DEFAULT_RETENTION
        ↓ 到期
EXPIRED (已到期)
        ↓ 归档
ARCHIVED (已归档)
```

## 本地启动

### 前置要求
- Go 1.21+

### 安装依赖
```bash
go mod download
```

### 启动服务
```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动

## API 接口

### 1. 创建例外申请
**POST** `/api/v1/applications`

```bash
curl -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "log_source": "payment-gateway-logs",
    "retention_days": 180,
    "default_days": 90,
    "department": "Security",
    "compliance_basis": "PCI DSS requirement",
    "applicant": "john.doe@company.com"
  }'
```

### 2. 查询申请列表
**GET** `/api/v1/applications`

```bash
# 查询所有
curl http://localhost:8080/api/v1/applications

# 按状态筛选
curl "http://localhost:8080/api/v1/applications?status=APPROVED"
```

### 3. 查询单个申请
**GET** `/api/v1/applications/:id`

```bash
curl http://localhost:8080/api/v1/applications/{application-id}
```

### 4. 按日志源查询
**GET** `/api/v1/applications/log-source/:logSource`

```bash
curl http://localhost:8080/api/v1/applications/log-source/payment-gateway-logs
```

### 5. 审批申请
**POST** `/api/v1/applications/:id/approve`

```bash
# 批准
curl -X POST http://localhost:8080/api/v1/applications/{application-id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "compliance-officer@company.com",
    "comment": "Approved per legal requirement",
    "approved": true
  }'

# 拒绝
curl -X POST http://localhost:8080/api/v1/applications/{application-id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "compliance@company.com",
    "comment": "No valid compliance basis",
    "approved": false
  }'
```

### 6. 到期检查（单个）
**POST** `/api/v1/applications/:id/check-expiration`

```bash
curl -X POST http://localhost:8080/api/v1/applications/{application-id}/check-expiration
```

### 7. 到期检查（全部）
**POST** `/api/v1/applications/check-all-expirations`

```bash
curl -X POST http://localhost:8080/api/v1/applications/check-all-expirations
```

### 8. 归档导出
**POST** `/api/v1/applications/:id/archive`

```bash
curl -X POST http://localhost:8080/api/v1/applications/{application-id}/archive \
  -H "Content-Type: application/json" \
  -d '{
    "archive_location": "s3://audit-archive/2024/q1/",
    "archived_by": "archive-admin@company.com"
  }'
```

### 9. 续期申请
**POST** `/api/v1/applications/:id/renew`

```bash
curl -X POST http://localhost:8080/api/v1/applications/{application-id}/renew \
  -H "Content-Type: application/json" \
  -d '{
    "additional_days": 60,
    "approver": "compliance-officer@company.com"
  }'
```

### 10. 查询已到期申请
**GET** `/api/v1/applications/expired`

```bash
curl http://localhost:8080/api/v1/applications/expired
```

### 11. 查询超期保留风险
**GET** `/api/v1/applications/long-retention-risk`

```bash
curl http://localhost:8080/api/v1/applications/long-retention-risk
```

### 12. 导出审批记录
**GET** `/api/v1/applications/:id/approval-records`

```bash
curl http://localhost:8080/api/v1/applications/{application-id}/approval-records
```

### 13. 导出归档记录
**GET** `/api/v1/applications/:id/archive-records`

```bash
curl http://localhost:8080/api/v1/applications/{application-id}/archive-records
```

## 测试命令

### 运行单元测试
```bash
go test ./service/... -v
```

### 运行测试并生成覆盖率
```bash
go test ./service/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## 验收场景测试脚本

### 场景 1：正常流程（申请 → 审批 → 到期 → 归档）
```bash
#!/bin/bash
echo "=== 场景 1: 正常流程 ==="

# 1. 创建申请
echo "1. 创建例外申请..."
RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "log_source": "normal-flow-logs",
    "retention_days": 90,
    "default_days": 30,
    "department": "Audit",
    "compliance_basis": "Annual audit requirement",
    "applicant": "auditor@company.com"
  }')
echo "$RESPONSE" | jq .
APP_ID=$(echo "$RESPONSE" | jq -r .id)
echo "申请 ID: $APP_ID"

# 2. 审批通过
echo -e "\n2. 审批通过..."
curl -s -X POST http://localhost:8080/api/v1/applications/$APP_ID/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "compliance@company.com",
    "comment": "Approved for audit purposes",
    "approved": true
  }' | jq .

# 3. 检查到期状态
echo -e "\n3. 检查到期状态..."
curl -s -X POST http://localhost:8080/api/v1/applications/$APP_ID/check-expiration | jq .

# 4. 归档（模拟已到期）
echo -e "\n4. 归档导出..."
curl -s -X POST http://localhost:8080/api/v1/applications/$APP_ID/archive \
  -H "Content-Type: application/json" \
  -d '{
    "archive_location": "s3://audit-archive/normal-flow/",
    "archived_by": "archive-admin@company.com"
  }' | jq .

# 5. 导出审批记录
echo -e "\n5. 导出审批记录..."
curl -s http://localhost:8080/api/v1/applications/$APP_ID/approval-records | jq .

echo -e "\n=== 场景 1 完成 ==="
```

### 场景 2：异常流程（重复申请）
```bash
#!/bin/bash
echo "=== 场景 2: 重复申请测试 ==="

# 1. 创建第一个申请
echo "1. 创建第一个申请..."
curl -s -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "log_source": "duplicate-test-logs",
    "retention_days": 60,
    "default_days": 30,
    "department": "IT",
    "compliance_basis": "Security investigation",
    "applicant": "security@company.com"
  }' | jq .

# 2. 尝试重复申请（同一日志源）
echo -e "\n2. 尝试重复申请（应该失败）..."
curl -s -X POST http://localhost:8080/api/v1/applications \
  -H "Content-Type: application/json" \
  -d '{
    "log_source": "duplicate-test-logs",
    "retention_days": 120,
    "default_days": 30,
    "department": "IT",
    "compliance_basis": "Another reason",
    "applicant": "another@company.com"
  }' | jq .

echo -e "\n=== 场景 2 完成 ==="
```

### 场景 3：过期后再次访问 + 超期风险检测
```bash
#!/bin/bash
echo "=== 场景 3: 过期后再次访问 + 超期风险检测 ==="

# 1. 创建多个申请
echo "1. 创建多个测试申请..."
for i in 1 2 3; do
  curl -s -X POST http://localhost:8080/api/v1/applications \
    -H "Content-Type: application/json" \
    -d "{
      \"log_source\": \"risk-test-logs-$i\",
      \"retention_days\": 30,
      \"default_days\": 7,
      \"department\": \"Ops\",
      \"compliance_basis\": \"Test $i\",
      \"applicant\": \"ops@company.com\"
    }" > /dev/null
done

# 2. 批量审批
echo "2. 批量审批所有申请..."
ALL_APPS=$(curl -s http://localhost:8080/api/v1/applications | jq -r '.[].id')
for app_id in $ALL_APPS; do
  curl -s -X POST http://localhost:8080/api/v1/applications/$app_id/approve \
    -H "Content-Type: application/json" \
    -d '{"approver": "compliance@company.com", "approved": true}' > /dev/null
done

# 3. 批量检查到期
echo "3. 批量检查所有到期..."
curl -s -X POST http://localhost:8080/api/v1/applications/check-all-expirations | jq .

# 4. 查询已到期列表
echo -e "\n4. 查询已到期申请列表..."
curl -s http://localhost:8080/api/v1/applications/expired | jq .

# 5. 查询超期保留风险（超过30天未归档）
echo -e "\n5. 查询超期保留风险列表..."
curl -s http://localhost:8080/api/v1/applications/long-retention-risk | jq .

echo -e "\n=== 场景 3 完成 ==="
```

## 状态枚举值

| 状态值 | 说明 |
|--------|------|
| `DEFAULT_RETENTION` | 默认保留期（无例外申请或申请被拒绝） |
| `EXCEPTION_APPLIED` | 例外申请已提交，待审批 |
| `APPROVED` | 例外申请已批准，日志按新期限保留 |
| `EXPIRED` | 例外申请已到期，待归档 |

## 项目结构

```
.
├── main.go                 # 程序入口
├── go.mod                  # 依赖管理
├── README.md               # 本文档
├── api/
│   └── router.go           # API 路由和处理器
├── model/
│   └── retention.go        # 数据模型定义
└── service/
    ├── retention.go        # 业务逻辑实现
    └── retention_test.go   # 单元测试
```
