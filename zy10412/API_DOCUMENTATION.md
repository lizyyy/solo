# 权益用量对账API 文档

## 概述

企业客户权益扣减对账系统，提供完整的权益生命周期管理，包括扣减记录、修正审批、余额重算和对账导出。所有数据持久化存储，支持历史追溯。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python equity_reconciliation.py
```

服务将在 `http://localhost:5000` 启动，数据库自动初始化。

### 3. 运行测试脚本（可选）

```bash
python test_equity_api.py
```

## 数据模型

### 扣减状态 (DeductionStatus)

| 状态 | 说明 |
|------|------|
| `success` | 扣减成功 |
| `pending_review` | 待人工复核 |
| `blocked` | 被拦截（重复请求等） |
| `compensated` | 已补偿 |

### 修正申请状态 (CorrectionStatus)

| 状态 | 说明 |
|------|------|
| `pending` | 待审批 |
| `approved` | 已通过 |
| `rejected` | 已拒绝 |

## API 接口

### 1. 客户账号管理

#### 创建客户账号

```http
POST /api/accounts
Content-Type: application/json

{
  "customer_name": "某某科技有限公司"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "account_id": "acc_xxx",
    "customer_name": "某某科技有限公司",
    "created_at": "2024-01-01T10:00:00",
    "is_active": true
  }
}
```

#### 查询客户账号

```http
GET /api/accounts/{account_id}
```

---

### 2. 权益包管理

#### 创建权益包

```http
POST /api/packages
Content-Type: application/json

{
  "account_id": "acc_xxx",
  "package_type": "API调用套餐-企业版",
  "total_quota": 1000,
  "valid_from": "2024-01-01T00:00:00",
  "valid_to": "2025-01-01T00:00:00"
}
```

#### 查询权益包

```http
GET /api/packages/{package_id}
```

#### 查询账号下的所有权益包

```http
GET /api/accounts/{account_id}/packages
```

---

### 3. 权益扣减

#### 执行扣减

```http
POST /api/deductions
Content-Type: application/json

{
  "account_id": "acc_xxx",
  "package_id": "pkg_xxx",
  "request_id": "req_001",
  "api_name": "text_generation",
  "deducted_amount": 10,
  "deducted_reason": "文本生成API调用 - 生成产品描述文案",
  "request_body": "{\"prompt\": \"产品描述\"}",
  "operator": "system"
}
```

**重要字段说明：**
- `request_id`: 用于幂等性检查，相同 request_id 的请求会被拦截
- `deducted_reason`: 客服可见的扣减理由，务必详细填写
- `request_body`: 原始请求体（异常追溯用）
- `operator`: 操作人标识

**响应状态说明：**
- `success: true, status: success` - 扣减成功
- `success: false, status: pending_review` - 额度不足，待人工复核
- `success: false, status: blocked` - 被拦截（重复请求等）

#### 查询扣减明细列表

```http
GET /api/deductions?account_id=xxx&package_id=xxx&status=success&limit=100
```

**查询参数：**
- `account_id` (可选): 按账号过滤
- `package_id` (可选): 按权益包过滤
- `status` (可选): 按状态过滤 (success/pending_review/blocked/compensated)
- `limit` (可选): 返回数量限制，默认100

#### 查询单个扣减明细

```http
GET /api/deductions/{detail_id}
```

**响应包含：**
- 扣减时间、金额、原因
- 处理状态、处理结果
- 原始请求体（异常排查用）
- 操作人

---

### 4. 修正申请管理

#### 创建修正申请

```http
POST /api/corrections
Content-Type: application/json

{
  "account_id": "acc_xxx",
  "package_id": "pkg_xxx",
  "detail_id": "dtl_xxx",
  "requested_by": "customer_service_001",
  "correction_type": "refund",
  "correction_amount": 10,
  "reason": "客户反馈扣减错误：该次API调用实际处理失败"
}
```

**修正类型 (correction_type):**
- `refund`: 退还（补偿客户权益）
- `additional_deduct`: 补扣

#### 审批修正申请

```http
POST /api/corrections/{correction_id}/review
Content-Type: application/json

{
  "reviewed_by": "manager_001",
  "approve": true,
  "review_comment": "经核实，该次调用确实失败，同意退还权益"
}
```

**审批效果：**
- 审批通过时自动更新权益包余额
- 扣减明细状态同步更新为 `compensated`
- 保留完整审批记录（审批人、时间、意见）

#### 查询修正申请列表

```http
GET /api/corrections?account_id=xxx&status=pending&limit=100
```

---

### 5. 余额重算

#### 重算权益包余额

用于数据不一致时的修复，基于扣减记录和已批准的修正申请重新计算余额。

```http
POST /api/packages/{package_id}/recalculate
```

**响应示例：**
```json
{
  "success": true,
  "package_id": "pkg_xxx",
  "total_quota": 1000,
  "recalculated_used": 20,
  "recalculated_remaining": 980,
  "previous_used": 30,
  "previous_remaining": 970
}
```

---

### 6. 对账管理

#### 生成对账报告

```http
POST /api/reconciliations
Content-Type: application/json

{
  "account_id": "acc_xxx",
  "package_id": "pkg_xxx",
  "start_time": "2024-01-01T00:00:00",
  "end_time": "2024-01-31T23:59:59",
  "generated_by": "auditor_001"
}
```

**对账报告包含：**
- 时间范围内的总调用次数
- 总扣减金额
- 预期剩余权益
- 实际剩余权益
- 差异金额（如有）
- 对账状态 (normal/discrepancy)

#### 查询对账报告列表

```http
GET /api/reconciliations?account_id=xxx&package_id=xxx&limit=100
```

#### 导出对账报告

```http
GET /api/reconciliations/{reconciliation_id}/export
```

**导出内容：**
- 对账报告基本信息
- 关联的客户账号信息
- 关联的权益包信息
- 该时间范围内的所有扣减明细
- 可直接下载为 JSON 文件

---

### 7. 健康检查

```http
GET /api/health
```

---

## 核心业务规则

### 1. 事件去重
- 基于 `request_id` 实现幂等性
- 相同 `request_id` 的第二次请求会被直接拦截
- 拦截状态永久保留，客服可见

### 2. 扣减规则
- 余额充足时：扣减成功，状态 = `success`
- 余额不足时：记录扣减但不扣余额，状态 = `pending_review`
- 每次扣减记录都保留完整的扣减理由

### 3. 修正审批
- 修正申请需要人工审批
- 审批通过后自动调整权益包余额
- 审批记录永久保留（审批人、时间、意见）
- 相关扣减明细状态更新为 `compensated`

### 4. 余额重算
- 基于所有成功的扣减记录求和
- 减去已批准的补偿金额
- 与当前余额比较并修正
- 返回修正前后对比

### 5. 对账校验
- 计算时间范围内预期剩余权益
- 与实际剩余权益对比
- 标记差异状态，便于审计追踪

## 客服常见问题解决方案

### Q: 客户说被扣错了，怎么查证？
1. 调用 `GET /api/deductions`，输入客户账号，按时间筛选
2. 找到相关的扣减记录，查看 `deducted_reason` 了解扣减原因
3. 查看 `raw_request` 查看原始请求体，判断是否正常调用
4. 如确认扣错，调用 `POST /api/corrections` 创建修正申请
5. 让审批人员调用审批接口处理

### Q: 如何查询某个客户的所有扣减记录？
```
GET /api/deductions?account_id={客户账号ID}
```

### Q: 如何查询所有待复核的异常扣减？
```
GET /api/deductions?status=pending_review
```

### Q: 如何查询所有已补偿的记录？
```
GET /api/deductions?status=compensated
```

### Q: 余额不对怎么办？
1. 调用 `POST /api/packages/{package_id}/recalculate` 执行重算
2. 系统会基于所有扣减和补偿记录重新计算正确余额

## 数据库说明

数据存储在本地 SQLite 数据库文件 `equity_reconciliation.db`，包含以下表：

- `customer_accounts` - 客户账号表
- `equity_packages` - 权益包表
- `call_events` - 调用事件表（用于去重）
- `deduction_details` - 扣减明细表
- `correction_requests` - 修正申请表
- `reconciliation_results` - 对账结果表

**注意：** 数据库文件与主程序在同一目录，删除文件会丢失所有数据。
