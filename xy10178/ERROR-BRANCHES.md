# 赔付案件分摊 API - 错误分支与恢复指南

## 一、错误码汇总

| 错误码 | HTTP状态码 | 描述 | 触发场景 | 恢复方式 |
|--------|-----------|------|---------|---------|
| `MISSING_FIELDS` | 400 | 缺少必填字段 | 创建/更新操作未传必填参数 | 检查请求参数，补充缺失字段 |
| `INVALID_RATIO` | 400 | 责任比例不合法 | 商家+仓库+配送比例之和 ≠ 100% | 调整比例值，确保三者之和为 1.0 |
| `NO_RATIOS_SET` | 400 | 未设置责任比例 | 对未设置比例的案件执行分摊 | 先调用 `/ratios` 接口设置责任比例 |
| `INVALID_STATUS` | 400 | 当前状态不允许操作 | PAID/CANCELLED 状态下修改比例 | 确认案件状态，PAID/CANCELLED 案件不可修改 |
| `INVALID_STATUS_TRANSITION` | 400 | 非法状态转换 | 违反状态流转规则 | 检查当前状态是否允许目标状态 |
| `INVALID_TARGET_VERSION` | 400 | 目标版本无效 | 回滚到当前或未来版本 | 只能回滚到历史版本（< 当前版本） |
| `CASE_NUMBER_EXISTS` | 409 | 案件编号重复 | 创建案件时 caseNumber 已存在 | 使用唯一的案件编号 |
| `DUPLICATE_REQUEST` | 409 | 重复提交 | 同一案件使用相同 requestId 连续请求 | 等待上一个请求完成，或使用新的 requestId |
| `CLAIM_NOT_FOUND` | 404 | 案件不存在 | 查询/操作不存在的案件 ID | 确认案件 ID 是否正确 |
| `VERSION_NOT_FOUND` | 404 | 版本不存在 | 回滚到不存在的版本号 | 先查询版本历史确认目标版本 |
| `NOT_FOUND` | 404 | 接口不存在 | 访问了错误的 URL | 检查 API 路径 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 数据库连接错误、代码异常 | 联系技术支持，查看服务器日志 |

---

## 二、核心状态流转规则

```
PENDING (待处理)
    │
    ├──→ REVIEWING (审核中) ←──────┐
    │       │                      │
    │       ├──→ ALLOCATED (已分摊) ┤
    │       │       │              │
    │       │       ├──→ CONFIRMED (已确认)
    │       │       │       │
    │       │       │       └──→ PAID (已付款) [终态]
    │       │       │
    │       │       └──→ REVIEWING (重新审核)
    │       │
    │       └──→ PENDING (退回待处理)
    │
    └──→ CANCELLED (已取消) [终态]
```

**状态转换矩阵:**

| 当前状态 | 允许转换到 | 不允许 |
|---------|-----------|-------|
| PENDING | REVIEWING, CANCELLED | ALLOCATED, CONFIRMED, PAID |
| REVIEWING | ALLOCATED, PENDING, CANCELLED | PAID |
| ALLOCATED | CONFIRMED, REVIEWING, CANCELLED | PAID |
| CONFIRMED | PAID, CANCELLED | ALLOCATED, REVIEWING |
| PAID | 无 | 所有转换 |
| CANCELLED | 无 | 所有转换 |

---

## 三、常见错误场景与恢复

### 场景 1: 责任比例校验失败

**问题:**
```json
{
  "success": false,
  "code": "INVALID_RATIO",
  "message": "责任比例之和必须等于 100%（1.0）"
}
```

**原因:** 三个责任方比例之和不为 1.0

**示例（错误）:**
```bash
# 50% + 50% + 20% = 120%
curl -X POST /api/claims/{id}/ratios \
  -d '{"merchantRatio": 0.5, "warehouseRatio": 0.5, "deliveryRatio": 0.2, "operator": "user1"}'
```

**恢复方式:**
```bash
# 调整比例：40% + 40% + 20% = 100%
curl -X POST /api/claims/{id}/ratios \
  -d '{"merchantRatio": 0.4, "warehouseRatio": 0.4, "deliveryRatio": 0.2, "operator": "user1"}'
```

---

### 场景 2: 重复提交被拦截

**问题:**
```json
{
  "success": false,
  "code": "DUPLICATE_REQUEST",
  "message": "重复的请求，请检查 requestId"
}
```

**原因:** 对同一案件使用了相同的 requestId 发起请求

**恢复方式:**

**方式 A: 使用新的 requestId（推荐）**
```bash
curl -X POST /api/claims/{id}/ratios \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRatio": 0.5,
    "warehouseRatio": 0.3,
    "deliveryRatio": 0.2,
    "operator": "user1",
    "requestId": "req-002"
  }'
```

**方式 B: 不传递 requestId（允许重复提交，不推荐）**
```bash
curl -X POST /api/claims/{id}/ratios \
  -d '{"merchantRatio": 0.5, "warehouseRatio": 0.3, "deliveryRatio": 0.2, "operator": "user1"}'
```

**requestId 设计建议:**
- 格式: `{功能前缀}-{时间戳}-{随机数}`
- 示例: `ratio-update-20260509-103045-abc123`
- 同一业务操作（如重试）使用相同 requestId，不同操作使用不同 ID

---

### 场景 3: 状态转换被拒绝

**问题:**
```json
{
  "success": false,
  "code": "INVALID_STATUS_TRANSITION",
  "message": "无法从 PENDING 转换到 CONFIRMED"
}
```

**原因:** 跳过中间状态，直接从 PENDING 到 CONFIRMED

**正确的完整流程:**
```bash
# 1. 创建 (PENDING)
curl -X POST /api/claims -d '{"caseNumber": "C1", "totalAmount": 10000, "operator": "user1"}'

# 2. 设置比例 (自动进入 REVIEWING)
curl -X POST /api/claims/{id}/ratios \
  -d '{"merchantRatio": 0.5, "warehouseRatio": 0.3, "deliveryRatio": 0.2, "operator": "user1"}'

# 3. 分摊确认 (ALLOCATED)
curl -X POST /api/claims/{id}/allocate -d '{"operator": "manager1"}'

# 4. 最终确认 (CONFIRMED)
curl -X POST /api/claims/{id}/confirm -d '{"operator": "manager2"}'

# 5. 标记付款 (PAID)
curl -X POST /api/claims/{id}/pay -d '{"operator": "finance1"}'
```

---

### 场景 4: 已付款/已取消案件无法修改

**问题:**
```json
{
  "success": false,
  "code": "INVALID_STATUS",
  "message": "当前状态 PAID 不允许修改责任比例"
}
```

**原因:** PAID 和 CANCELLED 是终态，不可回退

**恢复方式:**
- **PAID 状态**: 案件已完成，无法修改。如需调整，需创建新案件或走特殊审批流程
- **CANCELLED 状态**: 案件已取消，无法恢复。如需重新处理，创建新案件

**建议:** 在确认支付前，先使用 `rollback` 回滚到正确版本

---

### 场景 5: 回滚失败

**问题 1:**
```json
{
  "success": false,
  "code": "VERSION_NOT_FOUND",
  "message": "版本 999 不存在"
}
```

**问题 2:**
```json
{
  "success": false,
  "code": "INVALID_TARGET_VERSION",
  "message": "只能回滚到历史版本"
}
```

**恢复步骤:**

1. 先查询版本历史
```bash
curl /api/claims/{id}/versions
```

2. 查看返回的版本列表，选择一个存在且小于当前版本的目标

3. 执行回滚
```bash
curl -X POST /api/claims/{id}/rollback \
  -d '{"targetVersion": 2, "operator": "manager1"}'
```

---

## 四、失败恢复机制

### 4.1 通过审计日志追踪问题

每个操作都会记录审计日志，包含：
- 操作人 (`operator`)
- 操作类型 (`action`: CREATE, UPDATE_RATIO, ALLOCATE, CONFIRM, PAY, CANCEL, ROLLBACK)
- 操作前状态 (`previousStatus`)
- 操作后状态 (`newStatus`)
- 操作前数据快照 (`previousData`)
- 操作后数据快照 (`newData`)
- 是否成功 (`success`)
- 错误信息 (`errorMessage`)

**查询审计日志:**
```bash
curl /api/claims/{id}/audit-logs
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "action": "UPDATE_RATIO",
      "operator": "user_li",
      "success": true,
      "previousStatus": "PENDING",
      "newStatus": "REVIEWING",
      "previousData": {
        "ratios": {"merchant": 0, "warehouse": 0, "delivery": 0}
      },
      "newData": {
        "version": 2,
        "ratios": {"merchant": 0.5, "warehouse": 0.3, "delivery": 0.2}
      },
      "createdAt": "2026-05-09T10:30:00.000Z"
    }
  ]
}
```

### 4.2 通过版本历史恢复

如果操作失败或需要撤销，可以通过版本历史恢复：

1. 查看所有版本
```bash
curl /api/claims/{id}/versions
```

2. 选择正确的版本号
3. 执行回滚（会创建新版本，保留历史可追溯）
```bash
curl -X POST /api/claims/{id}/rollback \
  -d '{"targetVersion": 2, "operator": "manager1"}'
```

**注意:** 回滚不是删除历史，而是基于目标版本创建新版本

---

## 五、事务一致性保证

所有修改操作都使用数据库事务，保证：
- 案件主表更新
- 版本历史表新增
- 审计日志记录

三个操作要么全部成功，要么全部回滚，不会出现数据不一致的情况。

**需要人工介入的场景:**
- 数据库连接中断
- 磁盘空间不足
- 系统崩溃

**检查方式:**
1. 查询案件详情，确认状态
2. 查看审计日志，确认最后一次成功操作
3. 如果存在问题，使用回滚功能恢复到已知正确版本
