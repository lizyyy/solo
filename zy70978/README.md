# 设备租赁对账服务

一个后端服务，用于设备租赁业务的对账处理，整合导入、自动比对、人工复核、重新计算和报告下载全流程。

## 功能特性

### 1. 数据导入
- **租赁订单 CSV 导入**：批量导入租赁订单数据（设备序列号、租期、租金、押金等）
- **维修记录 JSON 导入**：导入维修记录，自动绑定设备序列号
- **押金规则配置**：支持不同设备类型的押金比例、逾期罚息规则配置

### 2. 自动比对引擎
- **逾期租金计算**：自动识别逾期归还，按日租金+罚息计算，支持宽限期
- **维修责任判定**：按设备序列号关联租期内维修记录，区分租客/业主/自然损耗责任
- **重复扣款检测**：自动识别相似维修记录（同设备、同日期、同金额、同内容）
- **差异来源追踪**：每条差异都标记来源记录和详细可读说明

### 3. 人工复核
- **状态流转**：待复核 → 通过 / 退回 / 待补充材料
- **维修责任调整**：可人工修改维修责任归属，修改后自动重新计算
- **维修记录绑定/解绑**：可将维修记录绑定或解绑到特定订单
- **复核历史追踪**：记录每次状态变更的操作人、时间、备注

### 4. 报告导出
- **详情报告**：包含订单信息、金额汇总、差异说明、租金明细、维修明细、扣款明细、复核历史
- **汇总报告**：所有订单对账状态统计、财务汇总
- **Excel 导出**：支持详情和汇总的多 Sheet Excel 导出
- **扣款依据报告**：专为租客争议设计，列明每笔扣款的依据和证据

### 5. 设计特点
- 所有金额计算都附带可读说明（如："逾期 17 天，宽限 3 天后计费 14 天"）
- 维修责任与设备序列号绑定，二手设备可追踪历史维修记录
- 复核改动后自动触发重新计算，详情、汇总、导出数字保持同步
- 每条差异都有 `typeExplanation` 字段，客服可直接向用户解释

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 生产运行

```bash
npm start
```

服务启动后访问 `http://localhost:3000/health` 可检查运行状态。

## API 接口

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/rental-orders` | 上传 CSV 导入租赁订单 |
| POST | `/api/import/repair-records` | 导入维修记录 JSON |
| POST | `/api/import/deposit-rules` | 配置押金规则 |

### 对账处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reconciliation/order/:orderNo` | 单个订单对账 |
| POST | `/api/reconciliation/all` | 全部订单对账 |
| GET | `/api/reconciliation/order/:orderNo` | 获取对账结果 |
| GET | `/api/reconciliation/all` | 获取所有对账结果 |
| GET | `/api/reconciliation/discrepancy-explanation/:type` | 获取差异类型说明 |

### 人工复核

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/review/approve/:orderNo` | 通过订单 |
| POST | `/api/review/reject/:orderNo` | 退回订单 |
| POST | `/api/review/request-more-info/:orderNo` | 要求补充材料 |
| POST | `/api/review/reset-pending/:orderNo` | 重置为待复核 |
| PATCH | `/api/review/repair-liability/:repairId` | 修改维修责任归属 |
| POST | `/api/review/bind-repair` | 绑定维修记录到订单 |
| POST | `/api/review/unbind-repair/:repairId` | 解绑维修记录 |
| GET | `/api/review/history/:orderNo` | 获取复核历史 |
| GET | `/api/review/status-explanation/:status` | 获取状态说明 |

### 报告导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/report/detailed/:orderNo` | 获取详情报告（JSON） |
| GET | `/api/report/summary` | 获取汇总报告（JSON） |
| GET | `/api/report/export/detailed/:orderNo` | 导出详情 Excel |
| GET | `/api/report/export/summary` | 导出汇总 Excel |
| GET | `/api/report/deduction-evidence/:orderNo` | 获取扣款依据报告 |

## 数据格式

### 租赁订单 CSV 格式

```csv
orderNo,tenantName,tenantId,equipmentSerialNo,equipmentName,startDate,endDate,actualReturnDate,monthlyRent,depositAmount,actualDepositPaid,status,notes
RENT001,张三,T001,EQ2024001,高空作业车,2024-01-15,2024-03-15,2024-03-20,5000,1500,1500,pending,逾期5天归还
```

### 维修记录 JSON 格式

```json
[
  {
    "repairNo": "REP001",
    "equipmentSerialNo": "EQ2024001",
    "reportDate": "2024-03-21",
    "repairDate": "2024-03-22",
    "repairContent": "更换液压油，检修升降系统",
    "repairCost": 800,
    "liability": "natural_wear",
    "reporter": "维修部-李工",
    "boundOrderNo": "RENT001",
    "notes": "正常损耗"
  }
]
```

### 押金规则格式

```json
{
  "rules": [
    {
      "ruleName": "工程机械设备通用规则",
      "equipmentType": "通用",
      "depositRate": 0.3,
      "minDeposit": 500,
      "maxDeposit": 20000,
      "isActive": true,
      "overduePenaltyRate": 0.005,
      "overdueGraceDays": 3
    }
  ]
}
```

## 示例数据

示例数据位于 `sample-data/` 目录：
- `rental-orders.csv` - 示例租赁订单
- `repair-records.json` - 示例维修记录
- `deposit-rules.json` - 示例押金规则

## 项目结构

```
src/
├── types/index.ts              # TypeScript 类型定义
├── store/dataStore.ts          # 内存数据存储
├── services/
│   ├── importService.ts        # 数据导入服务
│   ├── reconciliationEngine.ts # 对账引擎
│   ├── reviewService.ts        # 人工复核服务
│   └── reportService.ts        # 报告导出服务
├── controllers/                # API 控制器
├── routes/                     # API 路由
└── index.ts                    # 服务入口
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待复核 - 订单已导入，等待人工审核确认 |
| approved | 已通过 - 复核通过，可按计算结果进行结算 |
| rejected | 已退回 - 订单存在问题，需重新处理或取消 |
| need_more_info | 待补充 - 需要提供更多信息或材料后继续处理 |

## 差异类型说明

| 类型 | 说明 |
|------|------|
| overdue_rent | 租客未在约定时间内归还设备，需支付逾期租金及罚息 |
| repair_responsibility | 维修责任归属待确认，需核实后确定是否扣款 |
| duplicate_deduction | 系统检测到相似维修记录，可能存在重复扣款 |
| deposit_mismatch | 实际收取的押金与规则计算的预期金额不符 |
