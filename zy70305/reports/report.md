# OpenAPI 契约漂移检测报告

生成时间: 2026-05-12T14:06:58.417Z

## 概览

| 指标 | 数值 |
|------|------|
| 服务数 | 3 |
| 接口数 | 9 |
| 差异总数 | 15 |
| 🔴 阻断级别 | 7 |
| 🟡 警告级别 | 3 |
| 🔵 信息级别 | 5 |
| ❗ 调用方必须修改 | 7 |
| ⚠️ 仅需关注 | 3 |
| ✅ 可忽略 | 5 |
| 样本分析 | 7 个样本, 4 个问题 |
| 异常情况 | 0 个 |
| 豁免记录 | 0 个 |
| 已确认 | 0 个 |

⚠️ **存在阻断级别的变更，建议暂停发布并修复**

## ❗ 调用方必须修改

这些变更会影响现有调用方，必须在调用方适配后才能发布。

### 服务: member-service

#### /members

- 🔴 [POST] 请求体字段变必填: phone

### 服务: inventory-service

#### /inventory

- 🔴 [GET] 参数变必填: query.productId
- 🔴 [GET] 响应字段已删除: warehouse (200)

#### /inventory/{productId}

- 🔴 [GET] 枚举值收窄: status 移除了 [pre_order] (200)
- 🔴 [GET] 响应字段已删除: warehouse (200)
- 🔴 [GET] 响应字段已删除: lastUpdated (200)

#### /inventory/{productId}/adjust

- 🔴 [POST] 接口已删除: POST /inventory/{productId}/adjust


## ⚠️ 仅需关注

这些变更可能影响调用方，建议关注并评估影响。

### 服务: member-service

#### /members

- 🟡 [GET] 枚举值扩展: items[].level 新增 [diamond] (200)
- 🟡 [POST] 枚举值扩展: level 新增 [diamond] (201)

#### /members/{memberId}

- 🟡 [GET] 枚举值扩展: level 新增 [diamond] (200)


## ✅ 可忽略

这些变更是向后兼容的，可以安全发布。

### 服务: order-service

#### /orders

- 🔵 [GET] 新增响应字段: items[].updatedAt (200)
- 🔵 [POST] 新增响应字段: updatedAt (201)
- 🔵 [POST] 新增响应状态码: 400

#### /orders/{orderId}

- 🔵 [GET] 新增响应字段: updatedAt (200)

### 服务: inventory-service

#### /inventory/{productId}

- 🔵 [GET] 新增响应字段: available (200)


## 🔍 调用样本问题

以下调用样本使用了已删除的字段或枚举值：

### 样本: /Users/lzy/pro/solo/workspaces/zy70305/examples/samples/inventory-samples.yaml#1

- 服务: inventory-service
- 接口: getInventory

**问题:**
- 样本使用了已删除的响应字段: warehouse

### 样本: /Users/lzy/pro/solo/workspaces/zy70305/examples/samples/inventory-samples.yaml#2

- 服务: inventory-service
- 接口: getInventoryByProduct

**问题:**
- 样本使用了已删除的响应字段: warehouse
- 样本使用了已删除的响应字段: lastUpdated
- 样本使用了已移除的枚举值: status = [pre_order]
