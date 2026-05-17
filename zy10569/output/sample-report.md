# API 错误样本采集报告

**生成时间**: 2026-05-17T16:07:54.428Z

## 📊 统计摘要

| 指标 | 数值 |
|------|------|
| 总行数 | 13 |
| 有效条目 | 10 |
| 无效条目 | 3 |
| 错误总数 | 8 |
| 唯一错误分组 | 5 |

## ⚙️ 采样配置

- 每分组最大采样数: 3
- 包含请求体: 是
- 包含响应体: 是
- 敏感字段脱敏: password, token, secret, authorization

## 🔴 错误分组详情

### [500] POST /api/users/login

- **错误类型**: InternalServerError
- **发生次数**: 2
- **采样数量**: 2

#### 样本详情

##### 样本 `454de58532a75563`

- **时间**: 2024-01-15T10:30:45.123Z
- **Trace ID**: `abc-123-def-456`
- **原始行号**: L1
- **错误信息**: Database connection timeout
- **响应时间**: 5000ms

**请求体**:
```json
{"email":"user@example.com","password":"***MASKED***"}
```

##### 样本 `f7bd9262fa1cfa81`

- **时间**: 2024-01-15T10:30:46.456Z
- **Trace ID**: `xyz-789-uvw-012`
- **原始行号**: L2
- **错误信息**: Database connection timeout
- **响应时间**: 4800ms

**请求体**:
```json
{"email":"test@example.com","password":"***MASKED***"}
```

### [404] GET /api/users/{id}

- **错误类型**: NotFoundError
- **发生次数**: 2
- **采样数量**: 2

#### 样本详情

##### 样本 `eed386537b9853a3`

- **时间**: 2024-01-15T10:30:47.789Z
- **Trace ID**: `aaa-bbb-ccc-ddd`
- **原始行号**: L3
- **错误信息**: User not found
- **响应时间**: 150ms

##### 样本 `327770ba3a3b4ae2`

- **时间**: 2024-01-15T10:30:48.012Z
- **Trace ID**: `eee-fff-ggg-hhh`
- **原始行号**: L4
- **错误信息**: User not found
- **响应时间**: 120ms

### [400] POST /api/orders

- **错误类型**: ValidationError
- **发生次数**: 2
- **采样数量**: 2

#### 样本详情

##### 样本 `2ad2dc153091c1a6`

- **时间**: 2024-01-15T10:30:49.345Z
- **Trace ID**: `111-222-333-444`
- **原始行号**: L5
- **错误信息**: Invalid order data: missing required field 'items'
- **响应时间**: 80ms

**请求体**:
```json
{"userId":"user-001","total":99.99}
```

##### 样本 `f4a9ea2037081595`

- **时间**: 2024-01-15T10:30:50.678Z
- **Trace ID**: `555-666-777-888`
- **原始行号**: L6
- **错误信息**: Invalid order data: missing required field 'items'
- **响应时间**: 95ms

**请求体**:
```json
{"userId":"user-002","total":199.99}
```

### [0] UNKNOWN /api/payment

- **错误类型**: ERROR
- **发生次数**: 1
- **采样数量**: 1

#### 样本详情

##### 样本 `f9ec1f55e2a3d66a`

- **时间**: 2024-01-15T10:30:53.000Z
- **Trace ID**: `unknown`
- **原始行号**: L9
- **错误信息**: Payment gateway timeout occurred

### [401] DELETE /api/cart/items/{id}

- **错误类型**: UnauthorizedError
- **发生次数**: 1
- **采样数量**: 1

#### 样本详情

##### 样本 `ba700ce753eb9a7e`

- **时间**: 2024-01-15T10:30:55.000Z
- **Trace ID**: `auth-err-001`
- **原始行号**: L12
- **错误信息**: Invalid authorization token
- **响应时间**: 30ms
- **用户ID**: user-007

## ⚠️ 无法解析的条目

| 行号 | 错误原因 | 原始内容 |
|------|----------|----------|
| 10 | 未匹配到任何日志格式 | 这是一行无法解析的日志格式 |
| 11 | 未匹配到任何日志格式 | {"invalid-json": true, missing-end |
| 13 | 空行 |  |
