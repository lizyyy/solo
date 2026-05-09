# 电子签合同撤回 API

一个完整的电子签合同管理系统，支持合同撤回、补签、拒签和重新发起，具备完整的状态机、版本控制、审计日志和回调机制。

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MongoDB
- **特色**: 状态机驱动、版本冻结、审计链路、回调补偿

## 核心特性

1. **签署状态机** - 8 个状态，严格的状态转换规则
2. **版本冻结** - 每次发起签署前自动冻结版本，不可篡改
3. **重复回调防护** - 基于 deduplicationKey 的去重机制
4. **回调失败重试** - 指数退避策略，最多 5 次重试
5. **审计日志** - 所有操作均有完整记录
6. **PDF 元数据** - 完整的 PDF 信息存储
7. **统计接口** - 多维度统计分析
8. **并发控制** - 分布式锁 + 乐观锁
9. **补偿机制** - 回调耗尽后的状态回滚

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/electronic_signature
NODE_ENV=development
```

### 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务启动后访问：
- 健康检查: http://localhost:3000/health
- API 根路径: http://localhost:3000/

---

## 签署状态机

### 状态列表

| 状态值 | 中文描述 | 说明 |
|--------|----------|------|
| `draft` | 草稿 | 合同已创建，可编辑 |
| `initiated` | 已发起 | 已发起签署流程，等待签署 |
| `in_signing` | 签署中 | 正在签署过程中 |
| `partially_signed` | 部分签署 | 部分签署方已签署 |
| `withdrawn` | 已撤回 | 合同被发起方撤回 |
| `rejected` | 已拒签 | 某签署方拒签 |
| `completed` | 已完成 | 所有签署方签署完成（终态） |
| `reinitiated` | 重新发起 | 已撤回/拒签后重新发起 |

### 状态转换图

```
                    ┌─────────────┐
                    │    draft    │
                    │   (草稿)    │
                    └──────┬──────┘
                           │ initiate
                           ▼
                    ┌─────────────┐
              ┌────▶│  initiated  │──────┐
              │     │  (已发起)   │      │
              │     └──────┬──────┘      │
              │            │             │
              │            │ sign        │ withdraw
              │            ▼             ▼
              │     ┌─────────────┐ ┌─────────────┐
              │     │ in_signing  │ │  withdrawn  │
              │     │  (签署中)   │ │  (已撤回)   │
              │     └──────┬──────┘ └──────┬──────┘
              │            │               │
   sign one   │            │ sign all      │ reinitiate
   party      │            │               │
              │            ▼               ▼
              │     ┌─────────────┐ ┌─────────────┐
              │     │partially_sg│ │ reinitiated │
              └─────│(部分签署)   │ │ (重新发起)  │
                    └──────┬──────┘ └──────┬──────┘
                           │               │
                           │ reject        │ sign
                           │               │
                           ▼               ▼
                    ┌─────────────┐ ┌─────────────┐
                    │  rejected   │ │  completed  │
                    │  (已拒签)   │ │  (已完成)   │
                    └─────────────┘ └─────────────┘
                                                  │
                                                  │ (终态，无法转换)
                                                  ▼
                                              [结束]
```

### 状态转换规则

| 当前状态 | 允许的操作 | 目标状态 |
|----------|------------|----------|
| `draft` | initiate | `initiated` |
| `initiated` | sign, withdraw | `in_signing`, `withdrawn` |
| `in_signing` | sign, reject, withdraw | `partially_signed`, `rejected`, `withdrawn`, `completed` |
| `partially_signed` | sign, reject, withdraw, supplement_sign | `completed`, `rejected`, `withdrawn`, `in_signing` |
| `withdrawn` | reinitiate | `reinitiated` |
| `rejected` | reinitiate | `reinitiated` |
| `completed` | 无 | 终态 |
| `reinitiated` | sign, withdraw | `in_signing`, `withdrawn` |

---

## 完整 API 调用顺序

### 场景 1: 正常签署流程

这是最常见的业务流程。

**步骤 1: 创建合同**

```bash
POST /api/contracts
Content-Type: application/json
X-User-Id: user_123
X-User-Name: 张三
X-User-Email: zhangsan@example.com

{
  "title": "2024年度服务合作协议",
  "description": "甲乙双方关于技术服务的合作协议",
  "parties": [
    {
      "id": "party_001",
      "name": "甲方公司",
      "email": "contact@company-a.com",
      "phone": "13800138001"
    },
    {
      "id": "party_002",
      "name": "乙方公司",
      "email": "contact@company-b.com",
      "phone": "13900139002"
    }
  ],
  "pdfMetadata": {
    "fileId": "pdf_abc123",
    "fileName": "服务合作协议.pdf",
    "fileSize": 2048576,
    "md5Hash": "d41d8cd98f00b204e9800998ecf8427e",
    "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "pageCount": 5,
    "pdfVersion": "1.4",
    "author": "法务部",
    "subject": "技术服务合作"
  },
  "callbackUrl": "https://your-domain.com/webhooks/contract",
  "effectiveDate": "2024-01-01",
  "expirationDate": "2024-12-31",
  "metadata": {
    "department": "法务部",
    "contractType": "service"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "_id": "CTR-XXXXXXXX",
    "contractNo": "CTR-20240115-ABC123",
    "status": "draft",
    "currentVersion": 1,
    "parties": [...],
    ...
  },
  "message": "合同创建成功"
}
```

**关键点**:
- 合同初始状态为 `draft`
- 自动创建 v1 版本（未冻结）
- 记录创建审计日志
- 如果配置了 callbackUrl，会发送 `contract_created` 回调

---

**步骤 2: （可选）查看当前状态和允许的操作**

```bash
GET /api/contracts/{contractId}/allowed-transitions
```

**响应**:
```json
{
  "success": true,
  "data": {
    "currentStatus": "draft",
    "currentStatusDescription": "草稿",
    "allowedTransitions": ["initiated"],
    "allowedOperations": [
      {
        "operation": "initiate",
        "description": "发起签署",
        "targetState": "initiated"
      }
    ]
  }
}
```

---

**步骤 3: 发起签署流程**

```bash
POST /api/contracts/{contractId}/initiate
X-User-Id: user_123
X-User-Name: 张三
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "initiated",
    "previousStatus": "draft",
    "currentVersion": 1,
    "lastOperationId": "OP-XXXXXXXX-1705324800000"
  },
  "message": "签署流程已发起"
}
```

**关键系统操作**:
1. **状态校验**: 确认当前状态为 `draft`
2. **版本冻结**: 自动冻结 v1 版本（不可逆）
3. **状态变更**: `draft` → `initiated`
4. **审计日志**: 记录 `initiate_signing` 操作
5. **回调触发**: 发送 `signing_initiated` 事件
6. **版本记录**: 创建冻结版本快照

**查询冻结版本**:
```bash
GET /api/history/contract/{contractId}/versions/frozen
```

---

**步骤 4: 签署方 A 签署**

```bash
POST /api/contracts/{contractId}/sign
Content-Type: application/json
X-User-Id: user_456
X-User-Name: 甲方代表

{
  "partyId": "party_001",
  "signature": "base64_encoded_signature_image_or_hash"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "contract": {
      "status": "partially_signed",
      "previousStatus": "initiated",
      "parties": [
        {
          "id": "party_001",
          "status": "signed",
          "signedAt": "2024-01-15T10:30:00.000Z",
          ...
        },
        {
          "id": "party_002",
          "status": "pending",
          ...
        }
      ]
    },
    "party": { ... }
  },
  "message": "签署成功"
}
```

**关键系统操作**:
1. **状态校验**: 确认可以执行 `sign` 操作
2. **签署方校验**: 检查签署方状态（pending → signed）
3. **状态变更**: `initiated` → `partially_signed`（因为还有一方未签）
4. **审计日志**: 记录 `sign` 操作
5. **回调触发**: 发送 `party_signed` 事件

---

**步骤 5: 签署方 B 签署**

```bash
POST /api/contracts/{contractId}/sign
Content-Type: application/json
X-User-Id: user_789
X-User-Name: 乙方代表

{
  "partyId": "party_002",
  "signature": "base64_encoded_signature_image_or_hash"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "contract": {
      "status": "completed",
      "previousStatus": "partially_signed",
      "parties": [
        {
          "id": "party_001",
          "status": "signed",
          ...
        },
        {
          "id": "party_002",
          "status": "signed",
          ...
        }
      ]
    }
  },
  "message": "签署成功"
}
```

**关键系统操作**:
1. **状态校验**: 确认可以执行 `sign` 操作
2. **签署方校验**: 检查签署方状态
3. **完成检测**: 所有签署方均已签署
4. **状态变更**: `partially_signed` → `completed`（终态）
5. **审计日志**: 记录 `sign` 和 `complete` 操作
6. **回调触发**: 发送 `contract_completed` 事件

---

### 场景 2: 发起后撤回流程

合同发起后，发起人可以选择撤回。

**步骤 1-3**: 同场景 1（创建 → 发起）

**步骤 4: 撤回合同**

```bash
POST /api/contracts/{contractId}/withdraw
Content-Type: application/json
X-User-Id: user_123
X-User-Name: 张三

{
  "reason": "合同条款需要调整，先撤回修改"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "withdrawn",
    "previousStatus": "initiated",
    "lastOperationId": "OP-XXXXXXXX-1705324800000"
  },
  "message": "合同已撤回"
}
```

**关键系统操作**:
1. **状态校验**: 确认可以执行 `withdraw` 操作
2. **状态变更**: `initiated` → `withdrawn`
3. **审计日志**: 记录 `withdraw` 操作，包含撤回原因
4. **回调触发**: 发送 `contract_withdrawn` 事件

---

**步骤 5: 修改后重新发起**

```bash
POST /api/contracts/{contractId}/reinitiate
Content-Type: application/json
X-User-Id: user_123
X-User-Name: 张三

{
  "title": "2024年度服务合作协议（修订版）",
  "description": "根据双方协商调整了付款条款",
  "pdfMetadata": {
    "fileId": "pdf_abc123_v2",
    "fileName": "服务合作协议_修订版.pdf",
    "fileSize": 2148576,
    "md5Hash": "a1b2c3d4e5f6..."
  },
  "metadata": {
    "revision": 2,
    "changes": "调整了第3条付款条款"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "reinitiated",
    "previousStatus": "withdrawn",
    "currentVersion": 2,
    "lastOperationId": "OP-XXXXXXXX-1705325000000"
  },
  "message": "合同已重新发起"
}
```

**关键系统操作**:
1. **状态校验**: 确认可以执行 `reinitiate` 操作
2. **版本递增**: v1 → v2
3. **版本冻结**: 自动冻结 v2 版本
4. **状态变更**: `withdrawn` → `reinitiated`
5. **审计日志**: 记录 `reinitiate` 操作
6. **回调触发**: 发送 `contract_reinitiated` 事件

---

### 场景 3: 签署方拒签流程

**步骤 1-4**: 同场景 1（创建 → 发起 → A签署）

**步骤 5: 签署方 B 拒签**

```bash
POST /api/contracts/{contractId}/reject
Content-Type: application/json
X-User-Id: user_789
X-User-Name: 乙方代表

{
  "partyId": "party_002",
  "reason": "第5条违约责任条款过于苛刻，无法接受"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "contract": {
      "status": "rejected",
      "previousStatus": "partially_signed",
      "parties": [
        {
          "id": "party_001",
          "status": "signed",
          ...
        },
        {
          "id": "party_002",
          "status": "rejected",
          ...
        }
      ]
    },
    "party": { ... }
  },
  "message": "拒签成功"
}
```

**关键系统操作**:
1. **状态校验**: 确认可以执行 `reject` 操作
2. **签署方校验**: 检查签署方状态（pending → rejected）
3. **状态变更**: `partially_signed` → `rejected`
4. **审计日志**: 记录 `reject` 操作，包含拒签原因
5. **回调触发**: 发送 `party_rejected` 事件

---

**步骤 6: 协商后重新发起**

```bash
POST /api/contracts/{contractId}/reinitiate
Content-Type: application/json
X-User-Id: user_123
X-User-Name: 张三

{
  "title": "2024年度服务合作协议（修订版）",
  "description": "根据乙方意见调整了违约责任条款",
  "parties": [
    {
      "id": "party_001",
      "name": "甲方公司",
      "email": "contact@company-a.com"
    },
    {
      "id": "party_002",
      "name": "乙方公司",
      "email": "contact@company-b.com"
    }
  ],
  "pdfMetadata": {
    "fileId": "pdf_abc123_v2",
    "fileName": "服务合作协议_修订版.pdf"
  }
}
```

**注意**: 重新发起时，所有签署方状态重置为 `pending`，需要重新签署。

---

### 场景 4: 部分签署后补签流程

**步骤 1-4**: 同场景 1（创建 → 发起 → A签署）

当前状态: `partially_signed`（A已签，B待签）

**步骤 5: 添加补签方 C**

```bash
POST /api/contracts/{contractId}/supplement-sign
Content-Type: application/json
X-User-Id: user_123
X-User-Name: 张三

{
  "parties": [
    {
      "id": "party_003",
      "name": "丙方公司",
      "email": "contact@company-c.com",
      "phone": "13700137003"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "in_signing",
    "previousStatus": "partially_signed",
    "currentVersion": 2,
    "parties": [
      { "id": "party_001", "status": "signed", ... },
      { "id": "party_002", "status": "pending", ... },
      { "id": "party_003", "status": "pending", ... }
    ]
  },
  "message": "补签流程已启动"
}
```

**关键系统操作**:
1. **状态校验**: 确认当前状态为 `partially_signed`
2. **版本递增**: v1 → v2
3. **版本冻结**: 自动冻结 v2 版本
4. **添加签署方**: 新增 party_003
5. **状态变更**: `partially_signed` → `in_signing`
6. **审计日志**: 记录 `supplement_sign` 操作

---

**步骤 6-7: B和C签署完成**

B签署后状态变为 `partially_signed`，C签署后变为 `completed`。

---

## 历史记录查询

### 查询合同完整历史

```bash
GET /api/history/contract/{contractId}/full
```

**响应**:
```json
{
  "success": true,
  "data": {
    "contract": { ... },
    "timeline": [
      {
        "type": "version",
        "timestamp": "2024-01-15T10:00:00.000Z",
        "version": 1,
        "data": { ... }
      },
      {
        "type": "audit",
        "timestamp": "2024-01-15T10:05:00.000Z",
        "operationId": "OP-XXXXXXXX",
        "action": "initiate_signing",
        "data": { ... }
      },
      {
        "type": "callback",
        "timestamp": "2024-01-15T10:05:05.000Z",
        "callbackId": "CBK-XXXXXXXX",
        "event": "signing_initiated",
        "status": "success",
        "data": { ... }
      }
    ],
    "summary": {
      "totalVersions": 2,
      "totalAuditLogs": 5,
      "totalCallbacks": 3,
      "totalEvents": 10
    }
  }
}
```

### 查询状态转换历史

```bash
GET /api/history/contract/{contractId}/state-transitions
```

### 查询版本时间线

```bash
GET /api/history/contract/{contractId}/version-timeline
```

### 对比两个版本

```bash
GET /api/history/contract/{contractId}/versions/compare/1/2
```

### 查询审计日志

```bash
GET /api/audits/contract/{contractId}?page=1&limit=50
```

### 通过操作ID查询

```bash
GET /api/audits/operation/{operationId}
```

---

## 回调机制详解

### 回调事件类型

| 事件 | 触发时机 |
|------|----------|
| `contract_created` | 合同创建成功 |
| `signing_initiated` | 签署流程发起 |
| `party_signed` | 某签署方签署 |
| `party_rejected` | 某签署方拒签 |
| `contract_withdrawn` | 合同被撤回 |
| `contract_completed` | 合同签署完成 |
| `contract_reinitiated` | 合同重新发起 |
| `version_frozen` | 版本被冻结 |

### 回调去重机制

系统使用 `deduplicationKey` 防止重复处理同一回调：

```
deduplicationKey = contractId + event + payloadHash(base64前20位)
```

如果已存在成功的回调记录，新回调会被标记为 duplicate。

### 重试策略

- **默认策略**: 指数退避
- **最大重试次数**: 5次
- **重试间隔**: 1min → 2min → 4min → 8min → 16min → 60min（封顶）
- **重试条件**: 5xx 错误或网络超时
- **不重试**: 4xx 错误（客户端错误）

### 补偿机制

当回调耗尽所有重试次数（状态为 `exhausted`），可以手动触发补偿：

```bash
POST /api/callbacks/{callbackId}/compensate
X-User-Id: admin_123
```

**补偿操作**:
1. 将合同状态回滚到上一个状态
2. 记录补偿审计日志
3. 将回调状态标记为 `compensated`

---

## 统计接口

### 仪表盘统计

```bash
GET /api/stats/dashboard?startDate=2024-01-01&endDate=2024-01-31
```

**响应**:
```json
{
  "success": true,
  "data": {
    "contracts": {
      "total": 150,
      "byStatus": {
        "draft": 20,
        "initiated": 15,
        "in_signing": 30,
        "partially_signed": 25,
        "withdrawn": 10,
        "rejected": 5,
        "completed": 45,
        "reinitiated": 0
      }
    },
    "summary": {
      "total": 150,
      "createdToday": 5,
      "completedToday": 3,
      "frozenVersions": 200
    },
    "actions": {
      "total": 500,
      "breakdown": {
        "create_contract": 150,
        "initiate_signing": 130,
        "sign": 200,
        "withdraw": 10,
        "reject": 5,
        ...
      }
    }
  }
}
```

### 月度趋势

```bash
GET /api/stats/monthly-trend?months=6
```

### 发起人统计

```bash
GET /api/stats/initiators?limit=10
```

### 处理时间统计

```bash
GET /api/stats/processing-time
```

### 完整统计

```bash
GET /api/stats/full
```

---

## 并发控制

### 分布式锁

系统使用内存锁管理器防止并发操作同一合同：

- **锁超时**: 30秒（自动释放）
- **获取锁重试**: 最多5次
- **锁键格式**: `lock:{contractId}:{operation}`

### 乐观锁

MongoDB 文档版本号（`docVersion`）用于乐观并发控制：

```javascript
// 原子更新示例
const result = await atomicUpdate(
  Contract,
  { _id: contractId, docVersion: currentVersion },
  { $set: { status: 'completed' } }
);
```

如果版本不匹配，会自动重试（最多3次）。

---

## API 参考

### 合同管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/contracts` | 创建合同 |
| GET | `/api/contracts` | 查询合同列表 |
| GET | `/api/contracts/:contractId` | 查询单个合同 |
| PUT | `/api/contracts/:contractId` | 更新合同（仅草稿状态） |
| DELETE | `/api/contracts/:contractId` | 删除合同（仅草稿状态） |
| POST | `/api/contracts/:contractId/initiate` | 发起签署 |
| POST | `/api/contracts/:contractId/sign` | 签署 |
| POST | `/api/contracts/:contractId/reject` | 拒签 |
| POST | `/api/contracts/:contractId/withdraw` | 撤回 |
| POST | `/api/contracts/:contractId/reinitiate` | 重新发起 |
| POST | `/api/contracts/:contractId/supplement-sign` | 补签 |
| GET | `/api/contracts/:contractId/allowed-transitions` | 查询允许的操作 |
| GET | `/api/contracts/state-info` | 获取状态机信息 |

### 回调管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/callbacks/stats` | 回调统计 |
| GET | `/api/callbacks/exhausted` | 查询耗尽的回调 |
| POST | `/api/callbacks/retry` | 批量重试失败回调 |
| GET | `/api/callbacks/contract/:contractId` | 查询合同的回调历史 |
| GET | `/api/callbacks/:callbackId` | 查询回调状态 |
| POST | `/api/callbacks/:callbackId/retry` | 手动重试回调 |
| POST | `/api/callbacks/:callbackId/compensate` | 触发补偿 |

### 审计日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/audits/actions` | 获取所有审计操作类型 |
| GET | `/api/audits/contract/:contractId` | 查询合同审计轨迹 |
| GET | `/api/audits/operation/:operationId` | 通过操作ID查询 |

### 历史记录

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/history/contract/:contractId/full` | 完整历史 |
| GET | `/api/history/contract/:contractId/versions` | 所有版本 |
| GET | `/api/history/contract/:contractId/versions/frozen` | 已冻结版本 |
| GET | `/api/history/contract/:contractId/versions/:version` | 版本详情 |
| GET | `/api/history/contract/:contractId/versions/compare/:v1/:v2` | 版本对比 |
| GET | `/api/history/contract/:contractId/version-timeline` | 版本时间线 |
| GET | `/api/history/contract/:contractId/state-transitions` | 状态转换历史 |
| GET | `/api/history/contract/:contractId/callbacks` | 回调历史 |
| GET | `/api/history/contract/:contractId/party/:partyId` | 签署方历史 |
| GET | `/api/history/contract/:contractId/compensations` | 补偿历史 |

### 统计

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/stats/full` | 完整统计 |
| GET | `/api/stats/contracts` | 合同统计 |
| GET | `/api/stats/dashboard` | 仪表盘统计 |
| GET | `/api/stats/monthly-trend` | 月度趋势 |
| GET | `/api/stats/initiators` | 发起人统计 |
| GET | `/api/stats/processing-time` | 处理时间统计 |

---

## 请求头说明

| Header | 类型 | 必填 | 描述 |
|--------|------|------|------|
| `Content-Type` | string | 是 | `application/json` |
| `X-User-Id` | string | 否 | 操作人ID（用于审计） |
| `X-User-Name` | string | 否 | 操作人姓名 |
| `X-User-Email` | string | 否 | 操作人邮箱 |
| `X-Request-Id` | string | 否 | 请求追踪ID |

---

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "STATE_ERROR",
    "message": "当前状态 initiated 不允许执行 withdraw. 允许的起始状态: draft, initiated, in_signing, partially_signed",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### 错误码

| 错误码 | 描述 |
|--------|------|
| `VALIDATION_ERROR` | 参数校验失败 |
| `INVALID_ID` | ID格式错误 |
| `NOT_FOUND` | 资源不存在 |
| `DUPLICATE_KEY` | 数据重复 |
| `STATE_ERROR` | 状态转换不允许 |
| `CALLBACK_ERROR` | 回调相关错误 |
| `INTERNAL_ERROR` | 服务器内部错误 |

---

## 数据库模型

### Contract（合同主表）

- `_id`: 合同ID（格式: CTR-XXXXXXXX）
- `contractNo`: 合同编号（唯一）
- `status`: 当前状态
- `currentVersion`: 当前版本号
- `parties`: 签署方列表
- `pdfMetadata`: PDF元数据
- `versionHistory`: 版本历史记录

### ContractVersion（版本表）

- `contractId`: 关联合同ID
- `version`: 版本号
- `isFrozen`: 是否冻结
- `frozenAt`: 冻结时间
- `freezeReason`: 冻结原因

### AuditLog（审计日志）

- `operationId`: 操作ID（唯一）
- `contractId`: 关联合同ID
- `action`: 操作类型
- `previousState`: 操作前状态
- `currentState`: 操作后状态
- `operator`: 操作人信息
- `compensationStatus`: 补偿状态

### CallbackRecord（回调记录）

- `callbackId`: 回调ID（唯一）
- `eventId`: 事件ID
- `event`: 回调事件类型
- `status`: 回调状态
- `attemptCount`: 尝试次数
- `nextRetryAt`: 下次重试时间
- `deduplicationKey`: 去重键

---

## 项目结构

```
.
├── src/
│   ├── controllers/       # 控制器层
│   │   ├── auditController.js
│   │   ├── callbackController.js
│   │   ├── contractController.js
│   │   ├── historyController.js
│   │   └── statsController.js
│   ├── middleware/        # 中间件
│   │   └── errorHandler.js
│   ├── models/            # 数据模型
│   │   ├── AuditLog.js
│   │   ├── CallbackRecord.js
│   │   ├── Contract.js
│   │   └── ContractVersion.js
│   ├── routes/            # 路由
│   │   ├── auditRoutes.js
│   │   ├── callbackRoutes.js
│   │   ├── contractRoutes.js
│   │   ├── historyRoutes.js
│   │   └── statsRoutes.js
│   ├── services/          # 业务服务层
│   │   ├── auditService.js
│   │   ├── callbackService.js
│   │   ├── concurrencyService.js
│   │   ├── contractService.js
│   │   ├── historyService.js
│   │   ├── stateMachineService.js
│   │   ├── statsService.js
│   │   └── versionService.js
│   ├── app.js             # Express应用
│   └── server.js          # 服务器入口
├── .env.example           # 环境变量示例
├── package.json
└── README.md
```

---

## 许可证

MIT License
