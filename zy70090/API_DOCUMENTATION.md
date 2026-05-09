# 执法扣押物品台账管理 API 文档

## 概述

本 API 系统专门设计用于管理执法扣押物品的全生命周期，重点解决封存、移交、退还过程中数量和照片对不上的问题。系统提供完整的操作日志、错误处理和重试机制。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env` 并修改配置

### 3. 初始化数据库
```bash
npm run migrate
npm run seed
```

### 4. 启动服务
```bash
# 启动 API 服务
npm run dev

# 启动后台任务处理（另开终端）
npm run worker
```

### 5. 默认账号
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| operator | operator123 | 操作员 |
| supervisor | supervisor123 | 审批主管 |

## 认证

所有 API（除登录和健康检查）都需要 JWT Token。

### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "operator",
  "password": "operator123"
}
```

响应：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "operator": {
      "id": "uuid",
      "username": "operator",
      "real_name": "普通操作员",
      "department": "执法一大队",
      "role": "operator"
    }
  }
}
```

### 使用 Token
```
Authorization: Bearer <token>
```

## 核心业务流程

### 流程一：扣押清单管理

#### 1. 创建扣押清单
```
POST /api/seized-items
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: unique-request-key-001

{
  "case_number": "CASE-2024-001",
  "case_name": "涉嫌违法经营物品扣押",
  "seized_date": "2024-01-15T10:00:00Z",
  "item_name": "涉嫌违法商品",
  "item_description": "共计10箱，每箱20件",
  "quantity": 200,
  "unit": "件",
  "estimated_value": 50000.00,
  "seized_location": "XX市XX区XX街道",
  "seized_by": "张三",
  "seized_department": "执法一大队",
  "item_owner_name": "李四",
  "item_owner_id_card": "110101199001011234",
  "item_owner_phone": "13800138000",
  "item_owner_address": "XX市XX区XX路XX号",
  "photo_required": 5
}
```

**错误处理：**
- `MISSING_REQUIRED_FIELDS`: 缺少必要字段（提示具体缺失字段）
- `CASE_NUMBER_EXISTS`: 案件编号已存在
- `AUTH_TOKEN_MISSING`: 未提供认证令牌

**幂等性：** 使用 `X-Idempotency-Key` 头防止重复创建，相同 key 的请求只会执行一次，后续返回第一次的结果。

#### 2. 更新扣押清单
```
PUT /api/seized-items/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "quantity": 200,
  "item_description": "更新后的描述",
  "photo_required": 6
}
```

**限制：**
- 已退还的物品不能修改
- 已上传照片后不能减少数量（如需减少请先删除相关照片）

#### 3. 查询扣押清单
```
GET /api/seized-items?page=1&page_size=20&current_status=seized
Authorization: Bearer <token>
```

查询参数：
- `case_number`: 案件编号（模糊匹配）
- `case_name`: 案件名称（模糊匹配）
- `item_name`: 物品名称（模糊匹配）
- `current_status`: 状态（seized/sealed/transferred/returned_pending/returned）
- `seized_by`: 扣押人
- `item_owner_name`: 所有人姓名
- `start_date`: 开始日期
- `end_date`: 结束日期

#### 4. 获取完整详情
```
GET /api/seized-items/:id/details
Authorization: Bearer <token>
```

返回包括：物品基本信息、所有照片、封存记录、移交记录、退还审批、操作历史。

### 流程二：照片管理与校验

#### 1. 上传照片
```
POST /api/photos/upload/:seizedItemId
Content-Type: multipart/form-data
Authorization: Bearer <token>

photo: <文件>
photo_type: seized  # seized(扣押时)/sealed(封存时)/transferred(移交时)/returned(退还时)
```

**校验：**
- 文件类型：jpg/jpeg/png/gif
- 文件大小：最大 10MB
- 会自动更新物品的 `photo_uploaded` 计数

#### 2. 校验单张照片
```
POST /api/photos/verify/:photoId
Content-Type: application/json
Authorization: Bearer <token>

{
  "result": "passed",  // passed/failed
  "verification_type": "content",  // quantity/content/consistency
  "notes": "照片清晰，物品数量正确"
}
```

#### 3. 照片数量批量校验
```
POST /api/photos/verify-quantity/:seizedItemId
Content-Type: application/json
Authorization: Bearer <token>

{
  "expected_count": 5
}
```

响应：
```json
{
  "success": true,
  "data": {
    "success": true,
    "expected_count": 5,
    "actual_count": 5,
    "result": "passed",
    "message": "照片数量校验通过"
  }
}
```

#### 4. 删除照片
```
DELETE /api/photos/:photoId
Authorization: Bearer <token>
```

**限制：** 已校验的照片不能删除，如需修改请先记录人工改错。

### 流程三：封存管理

#### 1. 封存物品
```
POST /api/seals/seal/:seizedItemId
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: seal-unique-key-001

{
  "seal_number": "SEAL-2024-001",
  "seal_date": "2024-01-16T14:00:00Z",
  "seal_location": "XX仓库A区12号",
  "seal_quantity": 200,
  "photo_required": 3
}
```

**校验：**
- 物品状态必须是 `seized` 或 `unsealed`
- 封存数量不能超过物品总数
- 可以要求封存前必须上传指定数量的已校验照片

#### 2. 解封物品
```
POST /api/seals/unseal/:sealId
Content-Type: application/json
Authorization: Bearer <token>

{
  "unseal_reason": "需要移交到其他部门"
}
```

**限制：** 必须提供解封原因，操作会记录在日志中。

### 流程四：移交管理

#### 1. 创建移交
```
POST /api/transfers/create/:seizedItemId
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: transfer-unique-key-001

{
  "transfer_number": "TRANSFER-2024-001",
  "transfer_date": "2024-01-17T09:00:00Z",
  "transfer_quantity": 200,
  "to_department": "执法二大队",
  "transfer_reason": "跨区域案件移交",
  "photo_required": 2
}
```

#### 2. 确认移交
```
POST /api/transfers/confirm/:transferId
Authorization: Bearer <token>
```

#### 3. 取消移交
```
POST /api/transfers/cancel/:transferId
Content-Type: application/json
Authorization: Bearer <token>

{
  "cancel_reason": "移交条件不满足"
}
```

#### 4. 重试失败的移交
```
POST /api/transfers/retry/:transferId
Authorization: Bearer <token>
```

**适用场景：** 移交过程中半路失败，状态为 `failed` 时可以重试。

### 流程五：退还审批

#### 1. 申请退还
```
POST /api/return-approvals/apply/:seizedItemId
Content-Type: application/json
Authorization: Bearer <token>
X-Idempotency-Key: return-unique-key-001

{
  "approval_number": "RETURN-2024-001",
  "return_quantity": 200,
  "return_reason": "案件调查结束，物品无违法嫌疑",
  "recipient_name": "李四",
  "recipient_id_card": "110101199001011234",
  "recipient_phone": "13800138000",
  "photo_required": 2
}
```

**校验：**
- 物品不能处于 `sealed` 状态（必须先解封）
- 不能有其他待审批的退还申请

#### 2. 审批通过
```
POST /api/return-approvals/approve/:approvalId
Content-Type: application/json
Authorization: Bearer <token>

{
  "approval_notes": "同意退还，请做好交接记录"
}
```

**权限要求：** 需要 `supervisor` 或 `admin` 角色。

#### 3. 拒绝审批
```
POST /api/return-approvals/reject/:approvalId
Content-Type: application/json
Authorization: Bearer <token>

{
  "rejection_reason": "需要补充更多证明材料"
}
```

#### 4. 执行退还
```
POST /api/return-approvals/execute/:approvalId
Authorization: Bearer <token>
```

**影响：** 
- 审批状态变为 `returned`
- 物品数量扣减退还数量
- 如果数量归零，物品状态变为 `returned`

### 流程六：台账导出

#### 1. 导出扣押台账
```
POST /api/exports/ledger
Content-Type: application/json
Authorization: Bearer <token>

{
  "export_format": "excel",  // csv/excel/xlsx
  "criteria": {
    "current_status": "seized",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }
}
```

响应：
```json
{
  "success": true,
  "data": {
    "export_id": "uuid",
    "status": "processing",
    "message": "导出任务已创建，正在后台处理中"
  }
}
```

#### 2. 导出照片汇总
```
POST /api/exports/photos
Content-Type: application/json
Authorization: Bearer <token>

{
  "export_format": "csv"
}
```

#### 3. 查询导出状态
```
GET /api/exports/status/:exportId
Authorization: Bearer <token>
```

#### 4. 下载导出文件
```
GET /api/exports/download/:exportId
Authorization: Bearer <token>
```

#### 5. 重试失败的导出
```
POST /api/exports/retry/:exportId
Authorization: Bearer <token>
```

## 状态流转图

```
seized (扣押中)
    │
    ├──► sealed (封存中) ──► unsealed → seized
    │         │
    │         └──► transferred (已移交)
    │
    ├──► transferred (已移交)
    │
    └──► returned_pending (待审批退还)
              │
              ├──► approved (已批准) ──► returned (已退还)
              │
              └──► rejected (已拒绝) ──► seized
```

## 错误处理

所有错误响应格式：
```json
{
  "success": false,
  "message": "错误描述",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### 常见错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `AUTH_TOKEN_MISSING` | 缺少认证令牌 | 检查 Authorization 头 |
| `AUTH_TOKEN_EXPIRED` | 令牌过期 | 重新登录获取新 token |
| `AUTH_PERMISSION_DENIED` | 权限不足 | 联系管理员分配权限 |
| `MISSING_REQUIRED_FIELDS` | 缺少必要字段 | 检查请求体中的必填项 |
| `CASE_NUMBER_EXISTS` | 案件编号已存在 | 使用不同的案件编号 |
| `ITEM_NOT_FOUND` | 扣押清单不存在 | 检查 ID 是否正确 |
| `ITEM_ALREADY_RETURNED` | 物品已退还 | 无法修改已退还的物品 |
| `INVALID_STATUS_FOR_SEAL` | 状态不允许封存 | 检查当前状态 |
| `PHOTO_VERIFICATION_FAILED` | 照片校验未通过 | 上传并校验足够的照片 |
| `QUANTITY_CANNOT_REDUCE` | 数量不能减少 | 如需减少请先删除照片 |
| `REQUEST_IN_PROGRESS` | 请求处理中 | 使用相同的幂等键稍后重试 |
| `DUPLICATE_ENTRY` | 数据重复 | 检查唯一约束字段 |

## 日志和历史记录

### 1. 查看操作日志
```
GET /api/logs/operations?page=1&page_size=20
Authorization: Bearer <token>
```

### 2. 查看单个物品的完整历史
```
GET /api/logs/operations/history/seized_item/:itemId
Authorization: Bearer <token>
```

### 3. 查看后台任务
```
GET /api/logs/jobs?status=failed
Authorization: Bearer <token>
```

### 4. 后台任务统计
```
GET /api/logs/jobs/stats
Authorization: Bearer <token>
```

响应：
```json
{
  "pending": 0,
  "running": 1,
  "completed": 15,
  "failed": 2,
  "cancelled": 0
}
```

## 重跑和失败处理

### 场景一：操作中途失败

**表现：** 网络中断、服务器重启等导致操作中断。

**处理方式：**

1. **使用幂等键重试**
   - 创建类操作（POST）使用 `X-Idempotency-Key`
   - 相同的请求再次发送会直接返回第一次的结果

2. **查询状态确认**
   ```
   GET /api/seized-items/:id/details
   ```
   检查当前状态和操作历史，确定失败点。

3. **人工干预**
   - 查看操作日志：`GET /api/logs/operations/history/seized_item/:itemId`
   - 确定失败原因后，从正确的步骤继续

### 场景二：移交过程失败

**表现：** 移交记录状态为 `in_progress` 或 `failed`。

**处理方式：**

1. **确认当前状态**
   ```
   GET /api/transfers/:id
   ```

2. **如果是 failed 状态**
   ```
   POST /api/transfers/retry/:transferId
   ```

3. **如果需要取消**
   ```
   POST /api/transfers/cancel/:transferId
   {
     "cancel_reason": "网络中断后重新发起"
   }
   ```

### 场景三：导出任务失败

**表现：** 导出状态为 `failed`。

**处理方式：**

1. **查看失败原因**
   ```
   GET /api/exports/status/:exportId
   ```

2. **单个重试**
   ```
   POST /api/exports/retry/:exportId
   ```

3. **批量重试所有失败任务**
   ```
   POST /api/logs/jobs/retry-all
   {
     "job_type": "export"
   }
   ```

### 场景四：人工改错

**当发现数据错误需要人工修正时：**

1. **记录错误原因**
   - 记录在操作日志备注中

2. **执行修正操作**
   - 更新扣押清单：`PUT /api/seized-items/:id`
   - 删除未校验的照片后重新上传

3. **追踪修改历史**
   ```
   GET /api/logs/operations/history/seized_item/:itemId
   ```
   所有修改都会记录 `old_value` 和 `new_value`。

## 后台任务说明

### 任务类型

| 类型 | 说明 | 失败表现 | 重试方式 |
|------|------|----------|----------|
| `export` | 台账/照片导出 | 导出记录状态为 `failed` | `POST /api/exports/retry/:id` 或 `POST /api/logs/jobs/retry-all` |

### 任务状态

| 状态 | 说明 | 可操作 |
|------|------|--------|
| `pending` | 等待执行 | 自动执行 |
| `running` | 执行中 | 等待完成 |
| `completed` | 成功完成 | 无 |
| `failed` | 执行失败 | 可重试 |
| `cancelled` | 已取消 | 无 |

### 自动重试机制

- 失败任务会自动重试最多 5 次
- 重试间隔采用指数退避：1s, 2s, 4s, 8s, 16s
- 超过最大重试次数后需要人工介入

### 启动后台任务处理

```bash
# 开发环境
npm run worker

# 生产环境（推荐使用 PM2）
pm2 start src/worker.js --name ledger-worker
```

## 日志文件位置

- 错误日志：`./logs/error.log`
- 综合日志：`./logs/combined.log`

日志轮转：
- 单文件最大 5MB
- 最多保留 10 个历史文件

## 幂等性使用指南

对于需要防止重复提交的操作，在请求头中添加：
```
X-Idempotency-Key: your-unique-key-here
```

建议的 key 格式：
- 创建扣押：`seized-{case_number}-{timestamp}`
- 封存：`seal-{case_number}-{timestamp}`
- 移交：`transfer-{case_number}-{timestamp}`
- 退还：`return-{case_number}-{timestamp}`

## 数据一致性保证

1. **所有写操作都在事务中执行**
2. **操作前后状态有日志记录**
3. **关键字段有数据库约束**
4. **照片数量和物品数量联动校验**
5. **状态流转有严格校验**

## 性能建议

1. **查询数据时使用分页**
2. **大数据量导出使用异步导出**
3. **合理设置照片数量要求**
4. **定期清理过期的幂等请求记录**

## 安全建议

1. 生产环境修改默认密码
2. 使用 HTTPS 加密传输
3. 定期更换 JWT 密钥
4. 限制敏感操作的 IP 访问
5. 定期审计操作日志
