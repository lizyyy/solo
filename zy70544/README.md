# 账单重算申请 API

## 项目概述

本项目提供完整的账单重算申请管理REST API，支持申请创建、审批流程、状态管理、异常处理、人工修正和数据导出功能。

## 技术栈

- **运行时**: Node.js + TypeScript
- **Web框架**: Express
- **数据库**: SQLite（持久化存储，重启服务数据不丢失）
- **数据验证**: Joi
- **导出功能**: CSV

## 核心特性

### 1. 数据模型
- **重算申请主记录**: 包含账单月份、客户账号、重算原因、影响金额等
- **影响明细**: 记录每个费用项的原始金额、新金额、差异
- **审批历史**: 完整记录每次审批操作、审批人、意见
- **快照记录**: 保存原始输入、处理结果、最终结论

### 2. 关键规则
- **幂等性保证**: 通过idempotencyKey防止重复申请
- **状态流转验证**: 严格的状态机控制
- **影响金额自动计算**: 自动汇总明细差异
- **数据持久化**: SQLite数据库，重启不丢失数据

### 3. 状态流转
```
DRAFT → PENDING_APPROVAL → APPROVED → PROCESSING → COMPLETED
                                 ↓                    ↓
                              REJECTED            FAILED → NEEDS_MANUAL_CORRECTION
                                 ↓                    ↓
                              PENDING_APPROVAL    PENDING_APPROVAL
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/applications | 创建重算申请 |
| GET | /api/v1/applications | 查询申请列表 |
| GET | /api/v1/applications/:id | 查询申请详情 |
| PUT | /api/v1/applications/:id/status | 更新申请状态 |
| GET | /api/v1/applications/:id/approval-history | 查询审批历史 |
| GET | /api/v1/applications/:id/snapshots | 查询快照记录 |
| POST | /api/v1/applications/:id/fail | 标记处理失败 |
| POST | /api/v1/applications/:id/manual-correction | 人工修正 |
| POST | /api/v1/applications/:id/complete | 完成重算 |
| GET | /api/v1/export | 导出CSV报表 |

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 运行演示脚本
```bash
# 先启动服务器，然后运行
npx ts-node demo.ts
```

### 运行测试
```bash
npm test
```

### 编译生产版本
```bash
npm run build
npm start
```

## 请求示例

### 创建申请
```json
{
  "idempotencyKey": "RECALC-202405-001",
  "billingMonth": "2024-05",
  "customerAccount": "CUST202405001",
  "customerName": "北京科技有限公司",
  "reasonCategory": "PRICE_ADJUSTMENT",
  "reasonDetail": "由于2024年5月产品价格调整，客户享受新的折扣政策",
  "triggerSource": "财务月度对账-客户投诉",
  "impactDetails": [
    {
      "itemCode": "SVC-BASIC-001",
      "itemName": "云服务基础套餐",
      "originalAmount": 10000.00,
      "newAmount": 9500.00,
      "remarks": "原折扣10%，调整为15%折扣"
    }
  ],
  "createdBy": "财务-李明"
}
```

### 原因分类枚举
- `PRICE_ADJUSTMENT` - 价格调整
- `QUANTITY_CORRECTION` - 数量更正
- `DISCOUNT_APPLICATION` - 折扣应用
- `TAX_RECALCULATION` - 税费重算
- `SYSTEM_ERROR` - 系统错误
- `CUSTOMER_REQUEST` - 客户要求
- `OTHER` - 其他

## 项目结构

```
.
├── src/
│   ├── __tests__/          # 测试文件
│   ├── controllers/        # 控制器
│   ├── services/           # 业务服务
│   │   ├── databaseService.ts
│   │   ├── validationService.ts
│   │   └── exportService.ts
│   ├── types.ts            # 类型定义
│   ├── database.ts         # 数据库初始化
│   ├── routes.ts           # 路由配置
│   └── server.ts           # 服务器入口
├── data/
│   ├── billing.db          # SQLite数据库文件
│   └── exports/            # 导出的CSV文件
├── package.json
├── tsconfig.json
└── README.md
```

## 数据一致性保证

1. **主记录与历史记录一致**: 每次状态变更都记录审批历史，包含完整的操作人、时间、意见
2. **导出字段与主记录一致**: 导出CSV使用相同的字段定义和数据来源
3. **快照机制**: 保存原始输入、处理结果和最终结论，支持审计和追溯
4. **持久化存储**: SQLite数据库文件存储在本地，重启服务数据不丢失