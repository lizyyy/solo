# 冷链中转权限追责台账 API

解决跨日签收、箱号改名导致的赔付计算错误问题，实现全流程可追溯的权限追责台账系统。

## 核心特性

- **多源建账**: 支持司机照片、WMS箱号表、温度记录仪片段建账
- **状态流转**: 草稿 → 提交 → 驳回/确认 → 审计的完整工作流
- **差异追踪**: 每一步变更都记录前后差异，支持完整审计回溯
- **扫码明细**: 支持追加扫码明细，数据来源可追溯
- **失败数据**: 坏数据不入汇总，但在失败列表保留完整原因
- **数据一致**: 详情、历史、导出使用同一数据源
- **敏感处理**: 手机号等敏感字段自动脱敏
- **角色视图**: 按角色展示不同数据权限

## 技术栈

- Node.js + TypeScript
- Express.js
- Prisma ORM + SQLite
- Jest + Supertest
- Zod 参数验证

## 快速开始

### 1. 空库启动

```bash
# 安装依赖
npm install

# 初始化数据库
npm run prisma:generate
npm run prisma:migrate --name init

# 启动开发服务
npm run dev
```

服务启动后访问: `http://localhost:3000/health`

### 2. 准备样例数据

```bash
# 播种样例数据（包含各种状态的台账）
npm run seed
```

样例数据包含:
- 5 条不同状态的台账记录（草稿、已提交、已确认、已审计、已驳回）
- 每条台账包含 2 条扫码明细
- 1 条失败记录（温度数据异常）
- 每条台账附带司机照片附件

### 3. 主流程演示

使用以下 curl 命令走一遍完整流程:

#### 步骤 1: 新建台账（草稿状态）

```bash
curl -X POST http://localhost:3000/api/ledgers \
  -H "Content-Type: application/json" \
  -d '{
    "boxNo": "BOX-DEMO-001",
    "batchNo": "BATCH-DEMO-001",
    "driverId": "DRV-DEMO-001",
    "driverName": "演示司机",
    "driverPhone": "13900139000",
    "receiveDate": "2024-01-20T00:00:00.000Z",
    "crossDaySign": true,
    "boxNameChange": false,
    "temperatureMin": -20,
    "temperatureMax": -15,
    "compensationAmount": 300,
    "source": "WMS_BOX",
    "createdBy": "warehouse_staff"
  }'
```

**返回**: 新建的台账记录，状态为 `DRAFT`

#### 步骤 2: 追加扫码明细

```bash
# 注意替换 LEDGER_ID 为上一步返回的 id
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/scan-details \
  -H "Content-Type: application/json" \
  -d '{
    "scanTime": "2024-01-20T08:30:00.000Z",
    "scanLocation": "中转仓A区",
    "operator": "scan_op_001",
    "temperature": -17,
    "boxCondition": "完好",
    "remark": "正常扫描"
  }'
```

#### 步骤 3: 提交审核

```bash
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "changedBy": "warehouse_staff",
    "changeReason": "数据录入完成，申请主管审核"
  }'
```

**返回**: 状态更新为 `SUBMITTED`

#### 步骤 4: 主管确认

```bash
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "changedBy": "supervisor_01",
    "changeReason": "数据核实无误，跨日签收情况属实"
  }'
```

**返回**: 状态更新为 `CONFIRMED`，记录确认人和确认时间

#### 步骤 5: 审计归档

```bash
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/audit \
  -H "Content-Type: application/json" \
  -d '{
    "changedBy": "auditor_01",
    "changeReason": "赔付计算正确，流程合规，审计通过"
  }'
```

**返回**: 状态更新为 `AUDITED`，进入只读状态

#### 步骤 6: 查看状态历史

```bash
curl http://localhost:3000/api/ledgers/{LEDGER_ID}/history
```

**返回**: 完整的状态变更历史，包含每次变更的前后数据差异

### 4. 制造异常场景

#### 场景 1: 非法状态转换

```bash
# 尝试直接从草稿确认（跳过提交）
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "changedBy": "supervisor",
    "changeReason": "跳过提交直接确认"
  }'
```

**预期结果**: 400 错误，提示 "状态转换不允许"

#### 场景 2: 编辑只读状态数据

```bash
# 先审计归档
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/audit \
  -H "Content-Type: application/json" \
  -d '{"changedBy": "auditor", "changeReason": "审计"}'

# 尝试修改已审计数据
curl -X PUT http://localhost:3000/api/ledgers/{LEDGER_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "compensationAmount": 9999,
    "changeReason": "尝试修改审计后的数据"
  }'
```

**预期结果**: 400 错误，提示 "当前状态 AUDITED 不允许编辑"

#### 场景 3: 提交失败数据到失败列表

```bash
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/failed-records \
  -H "Content-Type: application/json" \
  -d '{
    "source": "TEMPERATURE_LOG",
    "rawData": {"temperature": 999, "unit": "invalid"},
    "errorMessage": "温度数据超出有效范围 (-30°C ~ 10°C)"
  }'
```

**验证失败记录**:
```bash
curl http://localhost:3000/api/ledgers/{LEDGER_ID}/failed-records
```

#### 场景 4: 驳回流程

```bash
# 新建台账 -> 提交
curl -X POST http://localhost:3000/api/ledgers \
  -H "Content-Type: application/json" \
  -d '{
    "boxNo": "BOX-REJECT-001",
    "batchNo": "BATCH-REJECT-001",
    "driverId": "DRV-001",
    "driverName": "测试",
    "driverPhone": "13800000000",
    "receiveDate": "2024-01-20T00:00:00.000Z",
    "source": "DRIVER_PHOTO",
    "createdBy": "staff"
  }'

# 提交
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/submit \
  -H "Content-Type: application/json" \
  -d '{"changedBy": "staff", "changeReason": "提交"}'

# 驳回
curl -X POST http://localhost:3000/api/ledgers/{LEDGER_ID}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "changedBy": "supervisor",
    "changeReason": "资料不完整",
    "rejectionReason": "缺少箱号变更原始凭证，请补充后重新提交"
  }'
```

**验证**: 状态变为 `REJECTED`，记录驳回原因

### 5. 查看导出和报表

#### 导出单条台账（脱敏）

```bash
# JSON 格式（默认脱敏）
curl http://localhost:3000/api/ledgers/{LEDGER_ID}/export

# CSV 格式，不脱敏
curl "http://localhost:3000/api/ledgers/{LEDGER_ID}/export?format=csv&maskSensitive=false"
```

#### 批量导出

```bash
# 导出全部，包含明细和历史
curl "http://localhost:3000/api/ledgers/export?includeDetails=true&includeHistory=true"

# 按批次导出 CSV
curl "http://localhost:3000/api/ledgers/export?format=csv&batchNo=BATCH-DEMO-001"
```

#### 查看报表汇总

```bash
curl http://localhost:3000/api/ledgers/report/summary
```

**返回字段说明**:
- `totalValidLedgers`: 有效台账数（已确认+已审计+已归档）
- `totalCompensation`: 赔付总金额（只统计有效数据）
- `crossDayCount`: 跨日签收数量
- `boxNameChangeCount`: 箱号改名数量
- `statusBreakdown`: 各状态分布

#### 导出失败记录

```bash
curl "http://localhost:3000/api/ledgers/export/failed-records?format=csv"
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ledgers` | 新建台账 |
| GET | `/api/ledgers` | 查询台账列表 |
| GET | `/api/ledgers/:id` | 获取单条台账详情 |
| PUT | `/api/ledgers/:id` | 编辑台账（仅草稿/驳回状态） |
| POST | `/api/ledgers/:id/submit` | 提交审核 |
| POST | `/api/ledgers/:id/reject` | 驳回 |
| POST | `/api/ledgers/:id/confirm` | 确认通过 |
| POST | `/api/ledgers/:id/audit` | 审计归档 |
| GET | `/api/ledgers/:id/history` | 状态历史 |
| POST | `/api/ledgers/:id/scan-details` | 追加扫码明细 |
| GET | `/api/ledgers/:id/failed-records` | 失败记录列表 |
| POST | `/api/ledgers/:id/failed-records` | 添加失败记录 |
| GET | `/api/ledgers/report/summary` | 报表汇总 |
| GET | `/api/ledgers/export` | 批量导出 |
| GET | `/api/ledgers/:id/export` | 单条导出 |
| GET | `/api/ledgers/export/failed-records` | 导出失败记录 |

## 测试

测试重点放在**状态变化**和**幂等性**验证。

```bash
# 运行全部测试
npm test

# 监听模式
npm run test:watch
```

测试覆盖:

1. **状态流转测试**
   - 正常流程: 草稿 → 提交 → 确认 → 审计
   - 驳回重提: 提交 → 驳回 → 修改 → 重提 → 确认
   - 非法转换: 验证状态机保护

2. **幂等性测试**
   - 重复创建相同数据
   - 重复执行同一状态转换
   - 查询接口结果一致性

3. **历史记录测试**
   - 每次变更都有历史记录
   - 字段差异正确记录

4. **数据完整性测试**
   - 扫码明细追加
   - 失败记录管理
   - 敏感字段脱敏
   - 报表数据正确性

## 状态机说明

```
DRAFT (草稿)
    ↓
SUBMITTED (已提交) ←───┐
    ↓                  │
CONFIRMED (已确认)     │  驳回后重新提交
    ↓                  │
AUDITED (已审计)       │
    ↓                  │
ARCHIVED (已归档)      │
                       │
REJECTED (已驳回) ─────┘
```

**状态权限**:
- DRAFT: 可编辑，可提交
- SUBMITTED: 只读，可确认/驳回
- REJECTED: 可编辑，可重新提交
- CONFIRMED: 只读，可审计/驳回
- AUDITED: 只读，不可修改

## 项目结构

```
.
├── prisma/
│   ├── schema.prisma      # 数据模型定义
│   └── seed.ts           # 样例数据
├── src/
│   ├── index.ts          # 应用入口
│   ├── lib/
│   │   └── prisma.ts     # 数据库客户端
│   ├── middleware/
│   │   └── errorHandler.ts  # 错误处理
│   ├── routes/
│   │   └── ledgerRoutes.ts  # API 路由
│   ├── services/
│   │   ├── ledgerService.ts  # 台账业务逻辑
│   │   ├── stateMachine.ts   # 状态机
│   │   ├── diffService.ts    # 差异对比
│   │   └── exportService.ts  # 导出服务
│   └── types/
│       └── index.ts       # 类型定义
├── tests/
│   ├── setup.ts          # 测试初始化
│   └── ledger.test.ts    # 测试用例
├── package.json
├── tsconfig.json
└── README.md
```

## 数据模型说明

### Ledger (台账主表)
- 箱号、批次、司机信息
- 跨日签收标记、箱号改名标记
- 赔付金额
- 状态流转时间戳和操作人

### StatusHistory (状态历史)
- 记录每次状态变更
- 保存变更前后完整数据快照
- 记录变更原因和操作人

### ScanDetail (扫码明细)
- 扫描时间、地点、操作员
- 温度、箱体状态
- 与台账关联

### FailedRecord (失败记录)
- 失败数据来源
- 原始数据保存
- 错误原因
- 支持标记已解决

## 常见问题

**Q: 为什么审计后的数据不能修改？**
A: 为了保证追责的严肃性和数据的可追溯性，审计通过后的数据进入只读状态，任何修改都会破坏审计链的完整性。

**Q: 失败数据为什么不直接删除？**
A: 失败数据也是审计的一部分，需要保留完整的处理过程，包括哪些数据因为什么原因被排除在统计之外。

**Q: 敏感字段脱敏可以关闭吗？**
A: 可以通过 `maskSensitive=false` 参数关闭，但建议只在授权场景下使用。默认脱敏是为了保护隐私。
