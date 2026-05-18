# 供应链金融后台应收账款解锁 API

## 项目简介

实现应收账款解锁流程的完整生命周期管理，包括状态流转、历史追踪、操作审计和数据导出。

## 核心功能

- **状态管理**: 已锁定 / 解锁申请 / 已解锁 / 被拒绝
- **历史记录**: 记录每次操作的来源、操作者、时间、变更内容
- **融资单关联**: 解锁后关联融资单仍保持冻结状态
- **数据导入导出**: 支持批量导入（含坏行记录）和 CSV 导出
- **冲突处理**: 记录审核拒绝等异常流程

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 造数（初始化测试数据）

```bash
npm run seed
```

造数后会生成以下测试数据：
- **完整流转记录**: REC2024010001 (已锁定 -> 解锁申请 -> 已解锁)
- **冲突记录**: REC2024010002 (已锁定 -> 解锁申请 -> 被拒绝)
- **导入坏行**: 第2行数据校验失败，保存在导入日志中

### 3. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务运行在: http://localhost:3000

### 4. 运行测试

```bash
npm test
```

## API 接口

### 健康检查

```bash
curl http://localhost:3000/health
```

### 应收账款管理

#### 创建应收账款

```bash
curl -X POST http://localhost:3000/api/receivables \
  -H "Content-Type: application/json" \
  -d '{
    "receivableNo": "REC2024010001",
    "customerId": "cust001",
    "customerName": "测试客户",
    "amount": 100000,
    "dueDate": "2024-06-30",
    "lockReason": "逾期未回款",
    "financeOrderNo": "FIN001",
    "financeFrozen": true,
    "operationSource": "WEB",
    "operator": "张三",
    "operatorId": "op001"
  }'
```

#### 申请解锁

```bash
curl -X POST http://localhost:3000/api/receivables/{id}/apply-unlock \
  -H "Content-Type: application/json" \
  -d '{
    "operationSource": "WEB",
    "operator": "李四",
    "operatorId": "op002",
    "unlockMaterials": {
      "paymentProof": "PAY001"
    },
    "remark": "已回款，申请解锁"
  }'
```

#### 审核通过

```bash
curl -X POST http://localhost:3000/api/receivables/{id}/approve-unlock \
  -H "Content-Type: application/json" \
  -d '{
    "operationSource": "WEB",
    "operator": "王五",
    "operatorId": "op003",
    "remark": "审核通过"
  }'
```

#### 审核拒绝

```bash
curl -X POST http://localhost:3000/api/receivables/{id}/reject-unlock \
  -H "Content-Type: application/json" \
  -d '{
    "operationSource": "WEB",
    "operator": "王五",
    "operatorId": "op003",
    "rejectReason": "材料不齐全",
    "remark": "审核拒绝"
  }'
```

#### 获取详情（含历史记录）

```bash
curl http://localhost:3000/api/receivables/{id}
```

#### 获取列表

```bash
curl "http://localhost:3000/api/receivables?page=1&pageSize=10&status=UNLOCKED"
```

查询参数:
- `page`: 页码，默认 1
- `pageSize`: 每页数量，默认 20
- `receivableNo`: 账款编号（模糊）
- `customerName`: 客户名称（模糊）
- `status`: 状态: LOCKED / UNLOCK_APPLY / UNLOCKED / REJECTED
- `startDate`, `endDate`: 创建时间范围

### 历史记录

```bash
curl http://localhost:3000/api/receivables/{receivableId}/histories
```

### 导出功能

#### 导出 CSV（含历史和融资冻结状态）

```bash
curl -o receivables.csv http://localhost:3000/api/receivables/export/csv
```

导出字段包含：
- 账款编号、客户信息、金额、到期日、状态
- 锁定原因、融资单信息、融资单是否冻结
- 操作来源、当前处理人
- 历史记录数、历史操作记录（操作者、操作类型、时间、融资冻结状态）

### 导入功能

#### 批量导入（含坏行记录）

```bash
curl -X POST http://localhost:3000/api/receivables/import/batch \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "导入管理员",
    "rows": [
      {
        "receivableNo": "REC202401003",
        "customerId": "cust003",
        "customerName": "客户3",
        "amount": 150000,
        "dueDate": "2024-08-01",
        "lockReason": "合同纠纷"
      },
      {
        "receivableNo": "",
        "customerId": "",
        "customerName": "",
        "amount": -100,
        "dueDate": "invalid-date",
        "lockReason": ""
      }
    ]
  }'
```

#### 获取导入日志

```bash
curl http://localhost:3000/api/receivables/import/logs
```

#### 获取导入坏行

```bash
curl http://localhost:3000/api/receivables/import/bad-rows/{batchNo}
```

## 数据模型

### 应收账款 (Receivable)

| 字段 | 说明 |
|------|------|
| id | UUID |
| receivableNo | 账款编号 |
| customerId | 客户ID |
| customerName | 客户名称 |
| amount | 账款金额 |
| dueDate | 到期日 |
| status | 状态: LOCKED/UNLOCK_APPLY/UNLOCKED/REJECTED |
| lockReason | 锁定原因 |
| unlockMaterials | 解锁材料(JSON) |
| financeOrderId | 融资单ID |
| financeOrderNo | 融资单编号 |
| financeFrozen | 融资单是否冻结 |
| operationSource | 操作来源 |
| currentOperator | 当前处理人 |
| rejectReason | 拒绝原因 |

### 历史记录 (ReceivableHistory)

| 字段 | 说明 |
|------|------|
| id | UUID |
| receivableId | 账款ID |
| receivableNo | 账款编号 |
| operationType | 操作类型: 创建/申请解锁/审核通过/审核拒绝 |
| operationSource | 操作来源: WEB/API/导入 |
| operator | 操作者 |
| operatorId | 操作者ID |
| oldStatus | 原状态 |
| newStatus | 新状态 |
| oldData | 变更前数据(JSON) |
| newData | 变更后数据(JSON) |
| remark | 备注 |
| financeFrozen | 融资单冻结状态 |
| createdAt | 操作时间 |

## 验收要点

### 1. 完整流转验证

1. 查看列表：确认 REC2024010001 状态为 `UNLOCKED`（已解锁）
2. 查看详情：确认有3条历史记录（创建、申请解锁、审核通过）
3. 查看导出：确认历史记录和融资冻结状态都在导出文件中

### 2. 冲突记录验证

1. 查看列表：确认 REC2024010002 状态为 `REJECTED`（被拒绝）
2. 查看详情：确认拒绝原因和历史记录完整
3. 确认 `financeFrozen` 仍为 `true`（解锁后融资单仍冻结）

### 3. 导入坏行验证

1. 执行批量导入：包含至少一行坏数据
2. 查看导入日志：确认成功/失败计数正确
3. 查看坏行详情：确认错误原因准确记录
4. 验证好行已正常创建，坏行未入库但记录在日志

### 4. 互相对应验证

- 列表状态 ↔ 详情状态 ↔ 历史最终状态 → 一致
- 操作者信息 ↔ 历史记录中的操作者 → 一致
- 融资单冻结状态 ↔ 历史记录中的 financeFrozen → 一致
- 导出数据中的历史记录数 ↔ 详情中的历史记录数 → 一致

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/                # 数据模型
│   │   ├── index.js
│   │   ├── Receivable.js
│   │   ├── ReceivableHistory.js
│   │   ├── FinanceOrder.js
│   │   └── ImportLog.js
│   ├── services/              # 业务逻辑
│   │   ├── receivableService.js
│   │   ├── historyService.js
│   │   ├── importService.js
│   │   └── exportService.js
│   ├── controllers/           # 控制器
│   │   └── receivableController.js
│   └── routes/                # 路由
│       └── receivableRoutes.js
├── scripts/
│   ├── seed.js                # 造数脚本
│   └── test.js                # 测试脚本
├── package.json
└── README.md
```

## 技术栈

- Node.js + Express
- Sequelize ORM + SQLite
- json2csv (CSV 导出)
- moment (日期处理)
- uuid (唯一标识)