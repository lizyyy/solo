# OpenTelemetry 属性规范化报告

**生成时间**: 2026/5/17 23:15:21

## 📊 概览

| 指标 | 数值 |
|------|------|
| 服务总数 | 6 |
| 属性总数 | 22 |
| 命名冲突 | 2 |
| 命名违规 | 1 |
| 解析错误 | 1 |
| 有效Span | 6 |

## ⚠️  命名冲突

| 标准化名称 | 严重程度 | 属性变体 | 涉及服务 |
|------------|----------|----------|----------|
| `tenant.id` | 🔴 严重 | `tenant_id`, `tenantId`, `tenant.no`, `TenantID`, `tenant.id` | api-gateway, user-service, auth-service, order-service, payment-service, notification-service |
| `user.id` | 🔴 严重 | `user-id`, `user.id`, `user_id`, `UserID` | api-gateway, user-service, auth-service, order-service, payment-service |

## 📋 服务详情

### api-gateway

- **Span数量**: 1
- **属性数量**: 7

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `tenant_id` | 1 | string | `T001` |
| `user-id` | 1 | string | `U001` |
| `http.method` | 1 | string | `GET` |
| `http.status_code` | 1 | number | `200` |
| `name` | 1 | string | `GET /api/users` |
| `traceId` | 1 | string | `trace-001` |
| `spanId` | 1 | string | `span-001` |

### user-service

- **Span数量**: 1
- **属性数量**: 7

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `tenantId` | 1 | string | `T001` |
| `user.id` | 1 | string | `U001` |
| `db.system` | 1 | string | `mysql` |
| `db.statement` | 1 | string | `SELECT * FROM users` |
| `name` | 1 | string | `getUser` |
| `traceId` | 1 | string | `trace-001` |
| `spanId` | 1 | string | `span-002` |

### auth-service

- **Span数量**: 1
- **属性数量**: 6

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `tenant.no` | 1 | string | `T001` |
| `user_id` | 1 | string | `U001` |
| `auth.method` | 1 | string | `jwt` |
| `name` | 1 | string | `validate` |
| `traceId` | 1 | string | `trace-001` |
| `spanId` | 1 | string | `span-003` |

### order-service

- **Span数量**: 1
- **属性数量**: 7

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `TenantID` | 1 | string | `T002` |
| `UserID` | 1 | string | `U002` |
| `order.amount` | 1 | number | `99.99` |
| `BadAttributeName__WithDoubleUnderscore` | 1 | string | `bad` |
| `name` | 1 | string | `order/create` |
| `traceId` | 1 | string | `trace-002` |
| `spanId` | 1 | string | `span-004` |

### payment-service

- **Span数量**: 1
- **属性数量**: 6

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `tenant.id` | 1 | string | `T002` |
| `user.id` | 1 | string | `U002` |
| `payment.method` | 1 | string | `credit_card` |
| `name` | 1 | string | `payment` |
| `traceId` | 1 | string | `trace-002` |
| `spanId` | 1 | string | `span-005` |

### notification-service

- **Span数量**: 1
- **属性数量**: 6

| 属性名 | 出现次数 | 值类型 | 样本值 |
|--------|----------|--------|--------|
| `tenant_id` | 1 | string | `T003` |
| `notification.channel` | 1 | string | `email` |
| `notification.type` | 1 | string | `order_confirm` |
| `name` | 1 | string | `notify` |
| `traceId` | 1 | string | `trace-003` |
| `spanId` | 1 | string | `span-006` |

## ❌ 解析错误

| 行号 | 错误信息 | 原始内容 |
|------|----------|----------|
| 5 | JSON parse error: Expected property name or '}' in JSON at position 2 (line 1 column 3) | `{ invalid json line - this should be recorded a...` |

## 📝 建议

1. **统一命名规范**: 使用 `snake_case` 或点分隔的小写命名
2. **标准化业务属性**: 租户ID统一使用 `tenant.id`，用户ID统一使用 `user.id`
3. **遵循语义约定**: 参考 OpenTelemetry 官方语义约定命名属性
4. **定期检查**: 建议每月运行此检查，确保属性命名一致性
