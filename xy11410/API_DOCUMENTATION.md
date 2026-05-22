# 连锁茶饮原料异常回执状态机 API 文档

## 项目概述

这是一个完整的连锁茶饮原料异常回执状态管理系统，支持多数据源整合、状态机流转、差异审计、报表导出等核心功能。

## 技术栈

- **后端框架**: Express + TypeScript
- **ORM**: TypeORM
- **数据库**: SQLite (可扩展为 MySQL/PostgreSQL)
- **核心特性**: 状态机引擎、差异审计、数据校验、报表导出

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产构建
npm run build

# 生产运行
npm start
```

服务启动后访问: http://localhost:3000

健康检查: http://localhost:3000/health

---

## 核心模块

### 一、基础数据模块 (`/api/basic-data`)

#### 1. 加盟商管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/franchises` | 创建加盟商 |
| GET | `/franchises` | 获取加盟商列表 |

**创建加盟商请求示例**:
```json
{
  "code": "JM001",
  "name": "朝阳路店",
  "ownerName": "张三",
  "phone": "13800138000",
  "address": "北京市朝阳区朝阳路100号"
}
```

#### 2. 物料管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/materials` | 创建物料 |
| GET | `/materials` | 获取物料列表 |

**创建物料请求示例**:
```json
{
  "code": "MAT001",
  "name": "珍珠",
  "category": "原料",
  "unit": "kg",
  "specification": "1kg/袋"
}
```

#### 3. 订货单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/orders` | 导入订货单 |
| GET | `/orders` | 获取订货单列表 |

**导入订货单请求示例**:
```json
{
  "orderNo": "ORD20240101001",
  "franchiseId": "uuid-of-franchise",
  "orderDate": "2024-01-01",
  "totalAmount": 1500.00,
  "status": "completed",
  "items": [
    {
      "materialId": "uuid-of-material",
      "quantity": 10,
      "unitPrice": 15.00,
      "amount": 150.00,
      "batchNo": "BATCH20240101"
    }
  ]
}
```

#### 4. 损耗登记管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/loss-records` | 导入损耗记录 |
| GET | `/loss-records` | 获取损耗记录列表 |

**导入损耗记录请求示例**:
```json
{
  "recordNo": "LOSS20240101001",
  "franchiseId": "uuid-of-franchise",
  "materialId": "uuid-of-material",
  "lossDate": "2024-01-01",
  "quantity": 2.5,
  "unitPrice": 15.00,
  "lossAmount": 37.50,
  "batchNo": "BATCH20240101",
  "lossType": "expired",
  "reason": "过期报废"
}
```

#### 5. 总部价格表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/headquarters-prices` | 导入总部价格 |

**导入总部价格请求示例**:
```json
{
  "materialId": "uuid-of-material",
  "effectiveDate": "2024-01-01",
  "expiryDate": "2024-12-31",
  "unitPrice": 15.00,
  "isActive": true
}
```

#### 6. 退款流水管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/refund-records` | 导入退款记录 |
| GET | `/refund-records` | 获取退款记录列表 |

**导入退款记录请求示例**:
```json
{
  "refundNo": "REF20240101001",
  "franchiseId": "uuid-of-franchise",
  "refundDate": "2024-01-01",
  "refundAmount": 150.00,
  "relatedOrderNo": "ORD20240101001",
  "refundType": "quality_issue",
  "reason": "质量问题退款",
  "status": "completed"
}
```

#### 7. 失败记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/failed-records` | 获取失败记录列表 |
| POST | `/failed-records/:id/resolve` | 标记失败记录为已解决 |

**查询参数**:
- `sourceType`: 按来源类型筛选 (order/loss 等)
- `isResolved`: 是否已解决 (true/false)

---

### 二、回执管理模块 (`/api/receipts`)

#### 1. 回执CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建回执 |
| GET | `/:id` | 获取回执详情 |
| GET | `/` | 获取回执列表 |

**创建回执请求示例**:
```json
{
  "receiptNo": "RCP20240101001",
  "batchId": "uuid-of-batch",
  "franchiseId": "uuid-of-franchise",
  "orderId": "uuid-of-order",
  "sourceType": "order",
  "sourceNo": "ORD20240101001",
  "materialCode": "MAT001",
  "materialName": "珍珠",
  "quantity": 10,
  "reportedQuantity": 8,
  "unitPrice": 15.00,
  "amount": 150.00,
  "reportedAmount": 120.00,
  "abnormalType": "quantity_diff",
  "abnormalReason": "实际到货数量与订单不符",
  "remark": "待核实"
}
```

**列表查询参数**:
- `franchiseId`: 加盟商ID
- `status`: 状态 (draft/pending_review/approved/rejected/frozen/settled/archived/cancelled)
- `recordStatus`: 处理状态 (unprocessed/corrected/needs_manual_confirm/processed)
- `batchId`: 批次ID
- `page`: 页码
- `pageSize`: 每页数量

#### 2. 核心状态流转

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/:id/submit` | 提交审核 |
| POST | `/:id/review` | 审核决策 |
| POST | `/:id/freeze` | 冻结结算 |
| POST | `/:id/unfreeze` | 解冻结算 |
| POST | `/:id/cancel` | 取消 |
| POST | `/:id/archive` | 归档 |
| PUT | `/:id/correct` | 人工修正 |

**提交审核请求示例**:
```json
{
  "operator": "admin"
}
```

**审核决策请求示例**:
```json
{
  "decision": "approve",
  "reason": "审核通过，数据无误",
  "operator": "auditor001"
}
```

**冻结结算请求示例**:
```json
{
  "reason": "数据异常，待核实后解冻",
  "operator": "admin"
}
```

**人工修正请求示例**:
```json
{
  "updateData": {
    "quantity": 9,
    "amount": 135.00
  },
  "reason": "核实后修正数量",
  "operator": "auditor001"
}
```

#### 3. 历史与审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/:id/history` | 获取状态流转历史 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fromStatus": "draft",
      "toStatus": "pending_review",
      "actionType": "create_batch",
      "diffData": [
        { "field": "status", "before": "draft", "after": "pending_review" }
      ],
      "reason": "提交审核",
      "operator": "admin",
      "operatedAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

#### 4. 附件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/:id/attachments` | 上传附件 |
| GET | `/:id/attachments` | 获取附件列表 |

**上传附件请求示例**:
```json
{
  "fileName": "异常照片.jpg",
  "filePath": "/uploads/xxx.jpg",
  "fileType": "image/jpeg",
  "fileSize": 102400,
  "uploadedBy": "admin",
  "description": "异常现场照片"
}
```

---

### 三、批次管理模块 (`/api/batches`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建批次 |
| GET | `/:id` | 获取批次详情 |
| GET | `/` | 获取批次列表 |
| POST | `/:id/receipts` | 添加回执到批次 |
| DELETE | `/:id/receipts` | 从批次移除回执 |
| DELETE | `/:id` | 删除批次 |

**创建批次请求示例**:
```json
{
  "batchNo": "BAT20240101001",
  "batchDate": "2024-01-01",
  "batchName": "1月第一批次异常处理",
  "description": "包含订货异常和损耗异常",
  "createdBy": "admin",
  "receiptIds": ["uuid1", "uuid2"]
}
```

**添加回执到批次请求示例**:
```json
{
  "receiptIds": ["uuid3", "uuid4"]
}
```

---

### 四、报表与导出模块 (`/api/reports`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/statistics` | 获取统计数据 |
| GET | `/franchise/:franchiseId` | 获取加盟商报告 |
| POST | `/export/csv` | 导出回执CSV |
| POST | `/export/franchise/:franchiseId/summary` | 导出加盟商汇总 |
| GET | `/download/:fileName` | 下载导出文件 |

#### 1. 统计数据接口

**查询参数**:
- `franchiseId`: 加盟商ID
- `batchId`: 批次ID
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "unprocessedCount": 20,
    "correctedCount": 15,
    "needsManualConfirmCount": 10,
    "processedCount": 55,
    "totalAmount": 50000.00,
    "frozenCount": 5,
    "frozenAmount": 2500.00
  }
}
```

#### 2. 导出CSV请求示例

```json
{
  "franchiseId": "uuid-of-franchise",
  "batchId": "uuid-of-batch",
  "status": "approved",
  "recordStatus": "unprocessed"
}
```

---

## 状态机流转规则

### 回执状态流转图

```
草稿(DRAFT)
    ↓
待审核(PENDING_REVIEW)
    ↓     ↖
  通过    驳回
    ↓     ↓
已通过(APPROVED) ←→ 已冻结(FROZEN)
    ↓                  ↓
  已结算(SETTLED)     已结算
    ↓
已归档(ARCHIVED)

已驳回(REJECTED) → 草稿 / 归档
已取消(CANCELLED) → 草稿
```

### 允许的状态转换

| 当前状态 | 可转换到 |
|----------|----------|
| DRAFT | PENDING_REVIEW, CANCELLED |
| PENDING_REVIEW | APPROVED, REJECTED, DRAFT |
| APPROVED | FROZEN, SETTLED, ARCHIVED |
| REJECTED | DRAFT, ARCHIVED |
| FROZEN | APPROVED, SETTLED |
| SETTLED | ARCHIVED |
| ARCHIVED | - |
| CANCELLED | DRAFT |

---

## 记录状态说明

| 状态 | 说明 |
|------|------|
| unprocessed | 未处理 - 系统自动导入，尚未处理 |
| corrected | 已修正 - 人工修正过数据 |
| needs_manual_confirm | 需人工确认 - 系统检测到异常，需人工审核 |
| processed | 已处理 - 处理完成 |

---

## 数据一致性保障

1. **单一数据源原则**: 所有接口操作同一数据库，确保列表、详情、历史、导出数据一致

2. **审计追踪**: 每次状态变更都记录:
   - 变更前后完整数据快照
   - 具体字段差异 (diff)
   - 操作人、时间、原因

3. **冻结保护**: 冻结时保存当前状态快照，解冻时可回滚或对比

4. **坏数据隔离**: 校验失败的数据存入 `failed_records` 表，不影响正常统计

---

## 加盟商老板关注重点

1. **冻结前后状态对比**: 详情接口返回 `beforeFreezeData` 字段
2. **人工处理理由**: `manualReason`、`reviewReason`、`freezeReason` 字段
3. **导出汇总**:
   - 未处理记录数
   - 已修正记录数
   - 需人工确认记录数
   - 冻结记录数及金额
4. **明细追溯**: 每条记录可追踪来源单号、来源类型

---

## 项目目录结构

```
src/
├── constants/          # 常量定义
│   └── ReceiptStatus.ts
├── entities/           # 数据库实体
│   ├── BaseEntity.ts
│   ├── Franchise.ts
│   ├── Material.ts
│   ├── Order.ts
│   ├── OrderItem.ts
│   ├── LossRecord.ts
│   ├── HeadquartersPrice.ts
│   ├── RefundRecord.ts
│   ├── Batch.ts
│   ├── MaterialReceipt.ts
│   ├── StatusTransition.ts
│   ├── Attachment.ts
│   └── FailedRecord.ts
├── services/           # 业务服务
│   ├── StateMachineService.ts
│   ├── ReceiptService.ts
│   ├── BatchService.ts
│   ├── BasicDataService.ts
│   ├── ReportService.ts
│   └── ValidationService.ts
├── routes/             # API路由
│   ├── receiptRoutes.ts
│   ├── batchRoutes.ts
│   ├── basicDataRoutes.ts
│   └── reportRoutes.ts
├── utils/              # 工具函数
│   └── diffUtils.ts
├── data-source.ts      # 数据库配置
└── index.ts            # 应用入口
```

---

## 常见问题

**Q: 如何确保报表、详情、历史数据一致？**
A: 所有接口都从同一数据库查询，状态变更时同步写入审计表，不存在多份数据副本。

**Q: 坏数据如何处理？**
A: 导入时校验失败的数据存入 `failed_records` 表，可通过 `/api/basic-data/failed-records` 查看和处理。

**Q: 冻结后可以修改数据吗？**
A: 冻结状态不允许直接修改，需先解冻。冻结时会保存状态快照。

**Q: 如何查看某条记录的完整修改历史？**
A: 调用 GET `/api/receipts/:id/history` 可查看完整状态流转和字段差异。
