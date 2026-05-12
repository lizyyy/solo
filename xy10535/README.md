# 场馆票务核销 API

一个完整的演出场馆入场核销系统，处理套票、转赠、退票、离线核销和重复入场等复杂业务场景。

---

## 一、本地启动

### 1. 环境要求
- Node.js v16+ (推荐 v18/v20)
- npm 或 yarn

### 2. 安装依赖
```bash
npm install
```

### 3. 启动服务
```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build && npm start
```

服务默认运行在 `http://localhost:8765`

### 4. 健康检查
```bash
curl http://localhost:8765/health
```

---

## 二、业务规则与状态机

### 1. 票券状态流转
```
CREATED (已创建)
    ↓
PAID (已支付) ←──────────────────────────────────────────┐
    ↓                                                     │
    ├─→ USED (已使用) ──┐                                 │
    │                   │                                 │
    ├─→ PARTIALLY_USED ─┘                                 │
    │                   （套票部分子票入场）                │
    ├─→ TRANSFERRED (已转赠)                              │
    │       ↓                                             │
    │   PAID (新持有人) ──────────────────────────────────┘
    │
    └─→ REFUNDED (已退票)
    └─→ CANCELLED (已取消)
    └─→ EXPIRED (已过期)
```

### 2. 核心业务规则

#### ✅ 已退票不能核销
- 票券状态为 `REFUNDED` 时，任何核销请求都会被拒绝
- 失败原因：`票券已退票`

#### ✅ 转赠后原持有人失效
- 票券持有人变更后，原持有人不再拥有该票券的权益
- 转赠过程：
  1. 原持有人发起转赠请求（状态：PENDING）
  2. 确认/完成转赠（状态：COMPLETED）
  3. 票券 holderId 自动更新为新持有人

#### ✅ 离线包过期处理
- 每个离线包有固定有效期（创建时指定 validHours）
- 补传时检测包是否过期
- 过期包的核销记录全部标记为失败，原因：`离线核销包已过期`

#### ✅ 多闸口重复核销检测
- 同一票券在任意闸口成功核销后
- 其他闸口的再次尝试都会被拒绝
- 记录重复核销的闸口、时间和操作者

#### ✅ 套票部分入场追踪
- 套票 = 1张父票(PACKAGE_PARENT) + N张子票(PACKAGE_CHILD)
- 子票分别入场，各自独立状态
- 父票状态追踪整体进度：
  - PAID → 未入场
  - PARTIALLY_USED → 部分入场
  - USED → 全部入场

---

## 三、幂等性设计

### 1. 幂等键使用
在请求 Header 中添加 `X-Idempotency-Key`：
```bash
curl -X POST http://localhost:8765/api/validations/validate \
  -H "X-Idempotency-Key: unique-key-12345" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

### 2. 幂等性保证
- 同一幂等键 + 相同请求体 → 返回相同响应
- 不同幂等键 → 独立处理
- 幂等记录默认保留 24 小时

---

## 四、审计日志系统

### 1. 记录内容
所有变更操作都记录：
- 操作类型（TICKET_CREATED, STATUS_UPDATED, VALIDATION_SUCCESS, TRANSFER_COMPLETED 等）
- 操作者 ID 和 名称
- **变更前状态 (beforeState)**
- **变更后状态 (afterState)**
- **差异摘要 (diff)**
- 操作原因
- 时间戳

### 2. 示例：票券核销后的审计记录
```json
{
  "action": "STATUS_UPDATED",
  "operatorName": "闸口工作人员",
  "beforeState": { "status": "PAID" },
  "afterState": { "status": "USED" },
  "diff": ["status: \"PAID\" -> \"USED\""],
  "reason": "核销通过，票券已使用",
  "timestamp": 1778567278990
}
```

---

## 五、API 接口概览

### 票券管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tickets | 创建普通票券 |
| POST | /api/tickets/package | 创建套票 |
| GET | /api/tickets | 查询票券列表 |
| GET | /api/tickets/code/:ticketCode | 通过票码查询 |
| GET | /api/tickets/:id | 查询票券详情 |
| GET | /api/tickets/:id/detail | 票券完整报告（含历史） |
| GET | /api/tickets/package/:packageId | 查询套票所有子票 |
| PATCH | /api/tickets/:id/status | 更新票券状态 |
| POST | /api/tickets/:id/correct | 人工修正（带审计） |

### 转赠管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/transfers | 发起转赠 |
| GET | /api/transfers | 查询转赠列表 |
| POST | /api/transfers/:id/complete | 完成转赠 |
| POST | /api/transfers/:id/cancel | 取消转赠 |

### 退票管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/refunds | 申请退票 |
| GET | /api/refunds | 查询退票列表 |
| POST | /api/refunds/:id/approve | 审批通过 |
| POST | /api/refunds/:id/reject | 审批拒绝 |

### 核销管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/validations/validate | 在线核销 |
| GET | /api/validations | 查询核销记录 |
| POST | /api/validations/offline-package | 创建离线核销包 |
| POST | /api/validations/offline-package/upload | 上传离线核销包并补传 |
| GET | /api/validations/offline-package | 查询离线包列表 |
| GET | /api/validations/stats/event/:eventId | 活动核销统计 |

### 报告导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/ticket/:ticketId | 票券详情报告 |
| GET | /api/reports/ticket/:ticketId/csv | 票券审计 CSV |
| GET | /api/reports/event/:eventId | 活动汇总报告 |
| GET | /api/reports/event/:eventId/csv | 活动汇总 CSV |
| GET | /api/reports/event/:eventId/tickets/csv | 活动票券 CSV |
| GET | /api/reports/event/:eventId/validations/csv | 活动核销 CSV |
| GET | /api/reports/audit | 审计日志列表 |
| GET | /api/reports/audit/operator/:operatorId | 操作者审计日志 |

---

## 六、内置样例与演示路径

### 1. 运行完整样例流程
```bash
npm run seed
```

此脚本会自动演示以下场景：

#### 场景 1：正常核销（成功路径）
```
创建票券 → 支付 → 核销成功
状态: CREATED → PAID → USED
```

#### 场景 2：转赠后核销
```
创建票券(A持有) → 支付 → 发起转赠(A→B) → 完成转赠
→ B 核销成功
验证点：A 不再持有此票
```

#### 场景 3：套票部分入场
```
创建套票(3张子票) → 支付 → 子票1入场
→ 子票2入场
验证点：
- 父票状态: PARTIALLY_USED
- 子票1、2状态: USED
- 子票3状态: PAID
```

#### 场景 4：离线补传
```
创建离线包(8小时有效) → 模拟离线核销2张票
→ 网络恢复后上传补传
→ 服务端批量处理
```

#### 场景 5：重复核销（失败路径）
```
票券1已成功入场 → 再次尝试同一票券
→ 失败，原因: 票券已使用
```

#### 场景 6：退票拦截（失败路径）
```
创建票券 → 支付 → 申请退票 → 审批退票(状态: REFUNDED)
→ 尝试核销 → 失败，原因: 票券已退票
```

---

## 七、手动演示路径

### 演示 1：正常核销（成功）

**步骤 1：创建票券**
```bash
curl -X POST http://localhost:8765/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "DEMO_2024",
    "eventName": "演示演唱会",
    "holderId": "USER_001",
    "holderName": "张三",
    "price": 580,
    "operatorId": "OP_ADMIN",
    "operatorName": "系统管理员"
  }'
```
记录返回的 `id` 和 `ticketCode`

**步骤 2：支付（更新状态为 PAID）**
```bash
curl -X PATCH http://localhost:8765/api/tickets/{ticketId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PAID",
    "operatorId": "OP_ADMIN",
    "operatorName": "系统管理员",
    "reason": "支付完成"
  }'
```

**步骤 3：核销入场**
```bash
curl -X POST http://localhost:8765/api/validations/validate \
  -H "Content-Type: application/json" \
  -d '{
    "ticketCode": "{ticketCode}",
    "gateId": "GATE_A1",
    "gateName": "A1号入口",
    "operatorId": "OP_GATE",
    "operatorName": "闸口工作人员"
  }'
```
预期结果：`success: true`, `status: "SUCCESS"`

**步骤 4：查看完整报告**
```bash
curl http://localhost:8765/api/tickets/{ticketId}/detail
```
可以看到：
- 当前状态：USED
- 核销记录：1 条成功
- 审计日志：CREATED → STATUS_UPDATED → VALIDATION_SUCCESS → STATUS_UPDATED

---

### 演示 2：退票拦截（失败路径）

**步骤 1：创建并支付票券（同上步骤 1-2）**

**步骤 2：申请退票**
```bash
curl -X POST http://localhost:8765/api/refunds \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "{ticketId}",
    "holderId": "USER_001",
    "reason": "行程变更无法参加",
    "operatorId": "OP_ADMIN",
    "operatorName": "系统管理员"
  }'
```

**步骤 3：审批退票**
```bash
curl -X POST http://localhost:8765/api/refunds/{refundId}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "OP_ADMIN",
    "operatorName": "系统管理员"
  }'
```
查看票券状态，应该是 `REFUNDED`

**步骤 4：尝试核销（应该失败）**
```bash
curl -X POST http://localhost:8765/api/validations/validate \
  -H "Content-Type: application/json" \
  -d '{
    "ticketCode": "{ticketCode}",
    "gateId": "GATE_A1",
    "gateName": "A1号入口",
    "operatorId": "OP_GATE",
    "operatorName": "闸口工作人员"
  }'
```
预期结果：
- `success: false`
- `status: "FAILED"`
- `failureReason: "票券已退票"`

---

## 八、数据结构说明

### 1. 票券 (Ticket)
```typescript
{
  id: string;                    // 票券 ID
  ticketCode: string;            // 票码（核销时使用）
  eventId: string;               // 活动 ID
  eventName: string;             // 活动名称
  holderId: string;              // 当前持有人 ID
  holderName: string;            // 当前持有人姓名
  originalHolderId: string;      // 原始购买人 ID
  originalHolderName: string;    // 原始购买人姓名
  ticketType: 'SINGLE' | 'PACKAGE_PARENT' | 'PACKAGE_CHILD';
  price: number;                 // 票价
  status: TicketStatus;          // 当前状态
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  validFrom: number;             // 生效时间
  validUntil: number;            // 失效时间
}
```

### 2. 核销记录 (ValidationRecord)
```typescript
{
  id: string;
  ticketCode: string;
  source: 'ONLINE' | 'OFFLINE';  // 核销来源
  gateId: string;                // 闸口 ID
  gateName: string;              // 闸口名称
  validationTime: number;        // 核销时间（设备端）
  serverTime: number;            // 服务端时间
  status: 'SUCCESS' | 'FAILED' | 'DUPLICATE';
  failureReason: string | null;  // 失败原因
}
```

---

## 九、如何判断业务闭环？

不看源码，通过 API 返回结果判断：

### 1. 票券状态正确
```
查询 GET /api/tickets/:id
检查：
- status 是否为预期值（PAID/USED/REFUNDED 等）
- holderId/holderName 是否正确
- validFrom/validUntil 是否合理
```

### 2. 转赠历史清晰
```
查询 GET /api/tickets/:id/transfers
检查：
- 转赠记录是否存在
- status 是否为 COMPLETED
- fromHolderId/toHolderId 是否正确
- 完成时间是否有记录
```

### 3. 核销来源可追溯
```
查询 GET /api/tickets/:id/validations
检查：
- source: ONLINE 或 OFFLINE
- gateId/gateName 哪一个闸口
- validationTime 什么时间
- status 是否有重复（DUPLICATE）
- failureReason 失败原因
```

### 4. 入场统计准确
```
查询 GET /api/validations/stats/event/:eventId
检查：
- totalTickets: 活动总票数
- validatedTickets: 已入场票数（去重）
- successValidations: 成功核销次数
- duplicateValidations: 重复核销拦截次数
- onlineValidations: 在线核销数
- offlineValidations: 离线核销数
```

### 5. 审计日志完整
```
查询 GET /api/tickets/:id/audit
检查每一条记录：
- action: 操作类型
- operatorName: 谁操作的
- beforeState/afterState: 变了什么
- diff: 差异摘要
- reason: 为什么变
- timestamp: 什么时候
```

---

## 十、常见错误码

| 错误码 | 场景 |
|--------|------|
| MISSING_FIELDS | 缺少必填字段 |
| MISSING_OPERATOR | 缺少操作者信息 |
| NOT_FOUND | 记录不存在 |
| CREATE_FAILED | 创建失败 |
| VALIDATION_FAILED | 核销业务规则校验失败 |
| DUPLICATE_ATTEMPT | 重复核销尝试 |
| TICKET_REFUNDED | 票券已退票 |
| TICKET_EXPIRED | 票券已过期 |
| TICKET_USED | 票券已使用 |
| OFFLINE_PACKAGE_EXPIRED | 离线核销包已过期 |

---

## 十一、技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer (Express)                │
│  routes/tickets.ts | routes/transfers.ts | ...          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
│  TicketService | TransferService | RefundService        │
│  ValidationService | ReportService | AuditService       │
│  IdempotentService                                       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Store Layer (Memory)                  │
│  Map<id, Ticket> | Map<id, ValidationRecord>           │
│  各种索引映射（ticketCode→id, packageId→tickets 等）   │
└─────────────────────────────────────────────────────────┘
```

### 为什么用内存存储？
1. 演示环境，数据不需要持久化
2. 启动快速，无需额外数据库
3. 方便重置（重启服务即清空）
4. 实际生产可替换为 SQLite/PostgreSQL/Redis 等

---

## 十二、项目结构

```
src/
├── index.ts                 # 应用入口
├── types/
│   └── index.ts             # 类型定义
├── store/
│   └── index.ts             # 内存数据存储
├── services/
│   ├── ticketService.ts     # 票券服务
│   ├── transferService.ts   # 转赠服务
│   ├── refundService.ts     # 退票服务
│   ├── validationService.ts # 核销服务（核心业务）
│   ├── reportService.ts     # 报告服务
│   ├── auditService.ts      # 审计服务
│   └── idempotentService.ts # 幂等性服务
├── routes/
│   ├── tickets.ts           # 票券路由
│   ├── transfers.ts         # 转赠路由
│   ├── refunds.ts           # 退票路由
│   ├── validations.ts       # 核销路由
│   └── reports.ts           # 报告路由
├── middleware/
│   └── response.ts          # 响应中间件
├── utils/
│   └── index.ts             # 工具函数
└── scripts/
    └── seed.ts              # 样例数据初始化
```

---

## 十三、下一步建议

1. **添加持久化**：将内存存储替换为 SQLite 或 PostgreSQL
2. **添加认证**：JWT 或 API Key 保护接口
3. **添加限流**：防止恶意核销请求
4. **添加 WebSocket**：实时推送核销状态到前端
5. **添加单元测试**：使用 Jest 编写测试用例
6. **添加 OpenAPI 文档**：Swagger/OpenAPI 规范

---

**完成！** 这个项目完整覆盖了所有业务场景：
- ✅ 套票处理（父票 + 子票，部分入场）
- ✅ 转赠（原持有人失效，新持有人生效）
- ✅ 退票（已退票不能核销）
- ✅ 离线核销（创建离线包 → 离线核销 → 补传处理）
- ✅ 重复入场（多闸口检测，记录重复核销）
- ✅ 幂等性（X-Idempotency-Key 支持）
- ✅ 审计日志（beforeState, afterState, diff, operator）
- ✅ 报告导出（CSV 格式）
- ✅ 内置样例（5 个核心场景）
- ✅ 说明文档（启动、演示、失败路径）
