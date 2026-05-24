# DBT 模型新鲜度诊断报告

**生成时间**: 2026-05-24 21:00:49

## 总体状态: ❌ ERROR

### 统计概览

| 状态 | 数量 |
|------|------|
| 正常 | 3 |
| 警告 | 1 |
| 严重 | 2 |
| 错误 | 1 |
| 跳过 | 0 |
| 缺失 | 0 |
| **总计** | **7** |

### 问题类型汇总

- **模型过时**: 3 个
- **下游受影响**: 3 个
- **上游迟到**: 3 个
- **模型跳过**: 1 个

### ⚠️ 迟到/问题模型

| 严重程度 | 模型名称 | 资源类型 | 状态 | 迟到(分钟) | 问题类型 | 说明 |
|----------|----------|----------|------|------------|----------|------|
| ❌ ERROR | `stg_orders` | model | error | - | 模型过时, 下游受影响, 上游迟到 | Model 'model.staging.stg_orders' failed during execution |
| 🔴 CRITICAL | `orders` | source | skipped | 301.6 | 模型过时 | Source data is stale by 301.6 minutes |
| 🔴 CRITICAL | `fct_orders` | model | success | 241.6 | 模型过时, 下游受影响, 上游迟到 | Model data is stale by 241.6 minutes |
| ⚠️ WARNING | `report_daily_sales` | model | skipped | - | 模型跳过, 下游受影响, 上游迟到 | Model 'model.analytics.report_daily_sales' was skipped in the run |

### 模型详细信息

#### ❌ stg_orders

- **唯一ID**: `model.staging.stg_orders`
- **资源类型**: model
- **运行状态**: error
- **新鲜度状态**: unknown
- **严重程度**: ERROR
- **上次成功时间**: 2026-05-24 12:21:13
- **数据更新时间**: 2026-05-24 12:21:13
- **说明**: Model 'model.staging.stg_orders' failed during execution
- **问题类型**: 模型过时, 下游受影响, 上游迟到
- **上游依赖** (1):
  - `source.raw.orders`
- **下游引用** (1):
  - `model.analytics.fct_orders`

#### 🔴 orders

- **唯一ID**: `source.raw.orders`
- **资源类型**: source
- **运行状态**: skipped
- **新鲜度状态**: error
- **严重程度**: CRITICAL
- **迟到时间**: 301.6 分钟
- **数据更新时间**: 2026-05-24 07:59:13
- **说明**: Source data is stale by 301.6 minutes
- **问题类型**: 模型过时
- **下游引用** (1):
  - `model.staging.stg_orders`

#### 🔴 fct_orders

- **唯一ID**: `model.analytics.fct_orders`
- **资源类型**: model
- **运行状态**: success
- **新鲜度状态**: unknown
- **严重程度**: CRITICAL
- **迟到时间**: 241.6 分钟
- **上次成功时间**: 2026-05-24 08:59:13
- **数据更新时间**: 2026-05-24 08:59:13
- **说明**: Model data is stale by 241.6 minutes
- **问题类型**: 模型过时, 下游受影响, 上游迟到
- **上游依赖** (2):
  - `model.staging.stg_orders`
  - `model.staging.stg_users`
- **下游引用** (1):
  - `model.analytics.report_daily_sales`

#### ⚠️ report_daily_sales

- **唯一ID**: `model.analytics.report_daily_sales`
- **资源类型**: model
- **运行状态**: skipped
- **新鲜度状态**: unknown
- **严重程度**: WARNING
- **说明**: Model 'model.analytics.report_daily_sales' was skipped in the run
- **问题类型**: 模型跳过, 下游受影响, 上游迟到
- **上游依赖** (1):
  - `model.analytics.fct_orders`

### 📊 报表影响分析

| 状态 | 报表表名 | 影响模型数 | 受影响 |
|------|----------|------------|--------|
| 🔴 CRITICAL | `每日销售报表` | 4 | ✅ |
| 🔴 CRITICAL | `订单事实表` | 3 | ✅ |
| ✅ OK | `用户维度表` | 0 | ❌ |

#### 🔴 每日销售报表

- **唯一ID**: `model.analytics.report_daily_sales`
- **状态**: CRITICAL
- **影响的模型**:
  - `model.analytics.report_daily_sales`
  - `source.raw.orders`
  - `model.analytics.fct_orders`
  - `model.staging.stg_orders`

#### 🔴 订单事实表

- **唯一ID**: `model.analytics.fct_orders`
- **状态**: CRITICAL
- **影响的模型**:
  - `model.analytics.fct_orders`
  - `source.raw.orders`
  - `model.staging.stg_orders`

---
*此报告由 DBT 模型新鲜度 CLI 工具自动生成*