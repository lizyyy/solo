# 日志字段字典分析报告

**生成时间**: 2026-05-17 22:16:18

## 统计概览

| 指标 | 数值 |
|------|------|
| 总日志行数 | 7 |
| 发现字段数 | 9 |
| 涉及服务数 | 3 |
| 冲突字段数 | **4** |
| 坏记录数 | 1 |

## 涉及服务

- order-service
- payment-service
- user-service

## ⚠️ 冲突字段详情

### amount

| 类型 | 使用服务 |
|------|----------|
| float | order-service |
| string | order-service |

**各服务样本:**

- **order-service**: `float` - 示例值: `99.99`

### order_id

| 类型 | 使用服务 |
|------|----------|
| integer | order-service |
| string | order-service |

**各服务样本:**

- **order-service**: `integer` - 示例值: `99999`

### success

| 类型 | 使用服务 |
|------|----------|
| boolean | payment-service |
| string | payment-service |

**各服务样本:**

- **payment-service**: `boolean` - 示例值: `True`

### user_id

| 类型 | 使用服务 |
|------|----------|
| integer | order-service, payment-service, user-service |
| string | user-service |

**各服务样本:**

- **user-service**: `integer` - 示例值: `12345`
- **order-service**: `integer` - 示例值: `12345`
- **payment-service**: `integer` - 示例值: `12345`

## 完整字段字典

| 字段名 | 冲突? | 类型分布 | 使用服务 |
|--------|-------|----------|----------|
| amount | ⚠️ | float(1), string(1) | order-service |
| level | ✅ | string(1) | user-service |
| message | ✅ | string(1) | user-service |
| order_id | ⚠️ | integer(1), string(1) | order-service |
| payment_id | ✅ | string(1) | payment-service |
| service | ✅ | string(3) | order-service, payment-service, user-service |
| success | ⚠️ | boolean(1), string(1) | payment-service |
| timestamp | ✅ | timestamp(3) | order-service, payment-service, user-service |
| user_id | ⚠️ | integer(3), string(1) | order-service, payment-service, user-service |

## ❌ 坏记录

共 1 条坏记录，详情请查看 bad_records.json

---
*此报告由 log-field-dict CLI 自动生成*