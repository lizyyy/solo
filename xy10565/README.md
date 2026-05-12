# 售后换新库存 API

围绕售后换新流程，实现故障判定、原机回收、换新库存和保修期重算的完整闭环管理。

## 功能概述

- **换新申请管理**：创建、查询、取消换新申请
- **故障审核**：审核故障确认，判定是否需要换新
- **库存管理**：新机库存检查、分配、释放
- **发货管理**：新机发货、收货确认
- **原机回收**：回收启动、接收确认、逾期检测
- **保修重算**：继承原机保修或重新计算
- **状态追踪**：完整的状态历史记录
- **操作日志**：所有操作留痕，人工修正记录差异
- **幂等性保证**：重复调用不产生副作用
- **风险报告**：识别回收逾期、库存不足等风险

## 业务规则

### 核心规则
1. **故障未确认不能换新**：必须通过故障审核才能分配库存
2. **重复申请检测**：同一设备进行中的申请只能有一个
3. **库存不足处理**：无可用库存时标记为库存不足状态
4. **原机逾期回收**：超过预计回收日期自动标记为逾期
5. **保修规则**：优先继承原机剩余保修，否则重新计算
6. **幂等性**：关键操作支持幂等调用
7. **人工修正留痕**：所有人工操作记录前后差异和操作者

### 状态流转

```
APPLICATION_PENDING (申请待处理)
    ↓
FAULT_AUDITING (故障审核中)
    ↓ ─→ FAULT_APPROVED (审核通过) ─→ INVENTORY_CHECKING ─→ INVENTORY_ALLOCATED ─→ SHIPPING ─→ SHIPPED
    ↓                            ↓ (库存不足)                        ↓
    └→ FAULT_REJECTED (审核不通过) └→ INVENTORY_SHORTAGE            ↓
                                                                  ↓
                                                         WAITING_RECYCLE (等待回收)
                                                                  ↓
                                                         RECYCLING (回收中)
                                                                  ↓ ─→ RECYCLED (已回收) ─→ WARRANTY_CALCULATING
                                                                  ↓ (逾期)                          ↓
                                                         RECYCLE_OVERDUE (回收逾期)         WARRANTY_UPDATED
                                                                                                     ↓
                                                                                                COMPLETED (完成)
```

## 快速开始

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run init-db
```

### 创建样例数据

```bash
npm run seed
```

这会创建：
- 4个客户（张三、李四、王五、赵六）
- 2个产品（智能手机、平板）
- 8台设备（4台旧机 + 4台新机）

### 运行演示脚本

```bash
npm run demo
```

演示脚本会执行4个完整场景：
1. **正常换新**：张三 - 完整闭环流程
2. **库存不足**：李四 - 目标产品无库存
3. **原机逾期**：王五 - 回收逾期检测
4. **重复申请**：赵六 - 重复申请检测

### 启动 API 服务

```bash
npm start
```

服务运行在 http://localhost:3000

### 开发模式（自动重启）

```bash
npm run dev
```

## 主要演示路径

### 路径一：正常换新流程（张三）

**步骤 1：创建换新申请**
```bash
curl -X POST http://localhost:3000/api/replacements \
  -H "Content-Type: application/json" \
  -H "X-Operator: 客服小明" \
  -d '{
    "customer_id": "<张三的ID>",
    "original_device_id": "<原机ID>",
    "target_product_id": "<产品ID>",
    "replacement_reason": "屏幕碎裂",
    "application_source": "CUSTOMER"
  }'
```
响应状态：`APPLICATION_PENDING`

**步骤 2：提交故障审核（通过）**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/fault-audit \
  -H "Content-Type: application/json" \
  -H "X-Operator: 工程师老王" \
  -d '{
    "approved": true,
    "fault_description": "屏幕碎裂，触控失灵",
    "fault_type": "SCREEN_DAMAGE",
    "audit_notes": "确认为硬件故障"
  }'
```
响应状态：`FAULT_APPROVED`

**步骤 3：分配库存**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/inventory-allocate \
  -H "X-Operator: 仓库管理员小李"
```
响应状态：`INVENTORY_ALLOCATED`

**步骤 4：发货**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/shipment \
  -H "Content-Type: application/json" \
  -H "X-Operator: 仓库管理员小李" \
  -d '{
    "tracking_no": "SF1234567890",
    "shipping_company": "顺丰速运",
    "shipping_address": "北京市朝阳区xxx"
  }'
```
响应状态：`SHIPPED`

**步骤 5：确认收货**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/shipment/delivered \
  -H "Content-Type: application/json" \
  -H "X-Operator: 客服小明" \
  -d '{
    "delivered_at": "2024-01-15T10:00:00Z"
  }'
```
响应状态：`WAITING_RECYCLE`

**步骤 6：启动原机回收**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/recycle/start \
  -H "Content-Type: application/json" \
  -H "X-Operator: 回收专员小陈" \
  -d '{
    "recycle_tracking_no": "YT9876543210",
    "recycle_company": "圆通速递",
    "expected_receive_date": "2024-01-22"
  }'
```
响应状态：`RECYCLING`

**步骤 7：确认收到原机**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/recycle/receive \
  -H "Content-Type: application/json" \
  -H "X-Operator: 质检师小周" \
  -d '{
    "actual_receive_date": "2024-01-20T15:00:00Z"
  }'
```
响应状态：`RECYCLED`

**步骤 8：完成原机检验**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/recycle/complete \
  -H "Content-Type: application/json" \
  -H "X-Operator: 质检师小周" \
  -d '{
    "inspection_notes": "外观磨损，功能正常，可翻新"
  }'
```

**步骤 9：重新计算保修期**
```bash
curl -X POST http://localhost:3000/api/replacements/<申请ID>/warranty \
  -H "Content-Type: application/json" \
  -H "X-Operator: 售后专员小吴" \
  -d '{
    "mode": "inherit",
    "notes": "继承原机剩余保修"
  }'
```
响应状态：`COMPLETED`

### 查看最终结果

**查看新旧机关系**
```bash
curl http://localhost:3000/api/replacements/<申请ID>/relation
```

**查看状态历史**
```bash
curl http://localhost:3000/api/replacements/<申请ID>/history
```

**查看操作日志**
```bash
curl http://localhost:3000/api/replacements/<申请ID>/logs
```

---

## 失败路径演示

### 失败路径一：故障未确认不能换新

**场景**：创建申请后，未通过故障审核就尝试分配库存

**预期结果**：状态校验失败，返回错误

```bash
# 1. 创建申请（状态：APPLICATION_PENDING）
curl -X POST http://localhost:3000/api/replacements ...

# 2. 直接尝试分配库存（不先审核）
curl -X POST http://localhost:3000/api/replacements/<申请ID>/inventory-allocate \
  -H "X-Operator: 仓库管理员"
```

**响应**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE",
    "message": "当前状态 APPLICATION_PENDING 不允许分配库存"
  }
}
```

**判断依据**：
- 接口返回明确的错误码 `INVALID_STATE`
- 申请单状态仍为 `APPLICATION_PENDING`
- 库存未被分配

---

### 失败路径二：库存不足

**场景**：故障审核通过后，目标产品无可用库存

**预期结果**：标记为库存不足，进入待补货状态

```bash
# 1. 创建申请（目标产品：平板，库存为0）
# 2. 故障审核通过
# 3. 尝试分配库存
curl -X POST http://localhost:3000/api/replacements/<申请ID>/inventory-allocate
```

**响应**：
```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_SHORTAGE",
    "message": "库存不足，无可用新机"
  },
  "data": {
    "inventory_shortage": true,
    "application": {
      "status": "INVENTORY_SHORTAGE"
    }
  }
}
```

**判断依据**：
- 接口返回 `INVENTORY_SHORTAGE` 错误码
- 申请单状态变为 `INVENTORY_SHORTAGE`
- 风险报告中会显示此条记录

---

### 失败路径三：原机逾期未回收

**场景**：新机已发货，原机超过预计回收日期仍未收到

**预期结果**：系统自动标记为回收逾期，出现在风险报告中

**模拟操作**：
```bash
# 1. 完整走完发货流程
# 2. 启动回收时设置过去日期
curl -X POST http://localhost:3000/api/replacements/<申请ID>/recycle/start \
  -H "Content-Type: application/json" \
  -d '{
    "expected_receive_date": "2020-01-01"
  }'

# 3. 触发逾期检测
curl -X POST http://localhost:3000/api/recycle/check-overdue
```

**判断依据**：
- 申请单状态变为 `RECYCLE_OVERDUE`
- 风险报告中 `recycle_overdue` 计数增加
- 操作日志记录系统自动标记逾期

---

### 失败路径四：重复申请

**场景**：同一设备已有进行中的换新申请

**预期结果**：检测到重复，返回已有申请信息

```bash
# 1. 第一次创建申请（成功）
curl -X POST http://localhost:3000/api/replacements ...

# 2. 同一设备第二次申请
curl -X POST http://localhost:3000/api/replacements ...
```

**响应**：
```json
{
  "success": true,
  "data": {
    "isDuplicate": true,
    "application": {
      "application_no": "RH20240115XXXXXX",
      "status": "APPLICATION_PENDING"
    },
    "message": "该设备已有进行中的换新申请"
  }
}
```

**判断依据**：
- `isDuplicate` 字段为 `true`
- 返回的是已有申请单的信息
- 没有创建新的申请单

---

## API 接口汇总

### 换新申请

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements` | 创建换新申请 |
| GET | `/api/replacements` | 查询申请列表 |
| GET | `/api/replacements/:id` | 查询申请详情 |
| GET | `/api/replacements/:id/relation` | 查看新旧机关系 |
| DELETE | `/api/replacements/:id` | 取消申请 |
| GET | `/api/replacements/statistics` | 获取统计数据 |
| GET | `/api/replacements/risk-report` | 获取风险报告 |

### 故障审核

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements/:id/fault-audit/start` | 开始审核 |
| POST | `/api/replacements/:id/fault-audit` | 提交审核结果 |

### 库存管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements/:id/inventory-check` | 开始库存检查 |
| POST | `/api/replacements/:id/inventory-allocate` | 分配库存 |
| GET | `/api/inventory/check/:productId` | 检查产品库存 |
| GET | `/api/inventory/summary` | 库存汇总 |
| GET | `/api/inventory/devices` | 设备列表 |

### 发货管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements/:id/shipment/start` | 开始发货流程 |
| POST | `/api/replacements/:id/shipment` | 创建发货单 |
| POST | `/api/replacements/:id/shipment/delivered` | 确认收货 |

### 回收管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements/:id/recycle/start` | 启动回收 |
| POST | `/api/replacements/:id/recycle/receive` | 确认收到原机 |
| POST | `/api/replacements/:id/recycle/complete` | 完成检验 |
| POST | `/api/recycle/check-overdue` | 检测逾期回收 |
| GET | `/api/recycle/overdue` | 获取逾期列表 |

### 保修管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/replacements/:id/warranty/start` | 开始保修计算 |
| POST | `/api/replacements/:id/warranty` | 重新计算保修 |
| POST | `/api/replacements/:id/warranty/extend` | 人工延长保修 |

### 追踪与日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/replacements/:id/history` | 状态历史 |
| GET | `/api/replacements/:id/logs` | 操作日志 |
| POST | `/api/replacements/:id/correct` | 人工修正 |

### 基础数据

| 方法 | 路径 | 描述 |
|------|------|------|
| GET/POST | `/api/master/customers` | 客户管理 |
| GET/POST | `/api/master/products` | 产品管理 |
| GET/POST | `/api/master/devices` | 设备管理 |

---

## 如何判断业务闭环

### 查看新旧机关系报告

```bash
curl http://localhost:3000/api/replacements/<申请ID>/relation
```

**完整闭环的判断标准**：

| 字段 | 正常状态 | 风险状态 |
|------|---------|---------|
| `application_status` | `COMPLETED` | `RECYCLE_OVERDUE`/`INVENTORY_SHORTAGE`/`FAILED` |
| `completed` | `true` | `false` |
| `inventory_status.allocated` | `true` | `false`/`null` |
| `recycle_status.status` | `COMPLETED`/`RECEIVED` | `OVERDUE`/`IN_PROGRESS` |
| `warranty_status` | 有值 | `null` |

### 查看风险报告

```bash
curl http://localhost:3000/api/replacements/risk-report
```

报告包含三类风险：
1. **回收逾期** (`recycle_overdue`) - 新机已发，原机未按时回收
2. **库存不足** (`inventory_shortage`) - 审核通过但无货可发
3. **等待回收** (`awaiting_recycle`) - 新机已送达，待回收原机

### 操作日志验证

人工修正操作会记录：
- 操作者（`operator`）
- 操作前后数据（`before_data` / `after_data`）
- 差异摘要（`diff_summary`）
- 原因说明（`reason`）

---

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── index.js           # 配置文件
│   ├── db/
│   │   └── database.js        # 数据库连接
│   ├── middleware/
│   │   └── errorHandler.js    # 错误处理中间件
│   ├── models/
│   │   ├── BaseModel.js       # 基础模型
│   │   ├── Customer.js
│   │   ├── Product.js
│   │   ├── Device.js
│   │   ├── ReplacementApplication.js
│   │   ├── FaultAudit.js
│   │   ├── InventoryAllocation.js
│   │   ├── Shipment.js
│   │   ├── RecycleRecord.js
│   │   ├── WarrantyRecord.js
│   │   ├── StatusHistory.js
│   │   ├── OperationLog.js
│   │   └── IdempotencyRecord.js
│   ├── routes/
│   │   ├── replacement.routes.js   # 换新申请路由
│   │   ├── inventory.routes.js     # 库存路由
│   │   ├── recycle.routes.js       # 回收路由
│   │   └── master.routes.js        # 基础数据路由
│   ├── services/
│   │   ├── ReplacementService.js   # 换新申请服务
│   │   ├── FaultAuditService.js    # 故障审核服务
│   │   ├── InventoryService.js     # 库存服务
│   │   ├── ShipmentService.js      # 发货服务
│   │   ├── RecycleService.js       # 回收服务
│   │   ├── WarrantyService.js      # 保修服务
│   │   ├── StatusHistoryService.js # 状态历史服务
│   │   ├── OperationLogService.js  # 操作日志服务
│   │   └── IdempotencyService.js   # 幂等性服务
│   └── scripts/
│       ├── init-db.js         # 数据库初始化
│       ├── seed.js            # 样例数据脚本
│       └── demo.js            # 完整演示脚本
├── package.json
├── README.md
└── .gitignore
```

---

## 数据模型

### 核心实体关系

```
customers (客户)
    └── devices (设备，current_owner_id)
              └── replacement_applications (原机换新申请)
                        ├── fault_audits (故障审核)
                        ├── inventory_allocations (库存分配) ── devices (新机)
                        ├── shipments (发货)
                        ├── recycle_records (原机回收)
                        └── warranty_records (保修记录)

status_history (状态历史) ── replacement_applications
operation_logs (操作日志) ── replacement_applications
idempotency_records (幂等记录)
```

---

## 状态说明

### 申请单状态

| 状态码 | 说明 |
|--------|------|
| APPLICATION_PENDING | 申请待处理 |
| FAULT_AUDITING | 故障审核中 |
| FAULT_APPROVED | 故障审核通过 |
| FAULT_REJECTED | 故障审核不通过 |
| INVENTORY_CHECKING | 库存检查中 |
| INVENTORY_ALLOCATED | 库存已分配 |
| INVENTORY_SHORTAGE | 库存不足 |
| SHIPPING | 发货中 |
| SHIPPED | 已发货 |
| WAITING_RECYCLE | 等待原机回收 |
| RECYCLING | 原机回收中 |
| RECYCLED | 原机已回收 |
| RECYCLE_OVERDUE | 原机回收逾期 |
| WARRANTY_CALCULATING | 保修期计算中 |
| WARRANTY_UPDATED | 保修期已更新 |
| COMPLETED | 流程完成 |
| CANCELLED | 已取消 |
| FAILED | 失败 |
| NEED_MANUAL_CORRECTION | 需要人工修正 |

---

## 幂等性说明

以下操作支持幂等调用：
- 创建换新申请
- 提交故障审核
- 分配库存
- 创建发货单
- 启动回收
- 计算保修期

幂等实现方式：
- 使用 SHA256 哈希生成请求键
- 记录操作类型和参数
- 重复调用返回首次执行结果

请求头 `X-Idempotency-Key` 可用于自定义幂等键。

---

## 许可证

MIT
