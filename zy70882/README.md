# 冷库园区对账服务

一个完整的后端对账服务，用于冷库园区的电费分摊计算、人工复核和报告生成。

## 功能特性

### 1. 数据导入
- **电表数据导入**：支持CSV格式的小时级电表读数导入
- **租户合同导入**：支持JSON格式的租户合同信息导入
- **温区配置**：支持冷冻/冷藏/常温等不同类型温区的倍率配置
- **倍率变更记录**：支持历史倍率变更记录导入

### 2. 自动计算分摊
- **基础电费计算**：根据用电量和电价计算基础电费
- **加班时段分摊**：加班时段用电量按加班倍率单独计算
- **温区分摊**：不同温区应用不同的用电倍率
- **空置期减免**：空置温区自动计算50%用电量减免
- **计算公式追溯**：每笔费用都保留详细计算步骤

### 3. 异常检测与解释
- **用电尖峰检测**：自动检测超出平均值2倍以上的用电尖峰
- **倍率变更标记**：记录账期内的倍率变更及其影响
- **空置期标记**：显示空置期的电费减免情况
- **可解释说明**：每项异常都包含详细解释和影响金额

### 4. 人工复核流程
- **审批通过**：确认账单无误，标记为已批准
- **审批驳回**：拒绝账单，填写驳回理由
- **要求补材料**：标记需要补充证明材料
- **修改记录**：支持人工修改账单数据，保留修改痕迹
- **复核历史**：完整记录所有审批操作和备注

### 5. 报告导出
- **Excel报告**：包含汇总表、账单明细、异常说明、计算明细
- **PDF报告**：适合打印和归档的PDF格式报告
- **HTML详情页**：单条账单的可视化详情页面

## 技术栈

- **运行环境**: Node.js 16+
- **框架**: Express.js
- **语言**: TypeScript
- **数据处理**: csv-parser, moment.js
- **Excel导出**: exceljs
- **PDF导出**: pdfkit
- **文件上传**: multer

## 项目结构

```
cold-storage-billing-service/
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   ├── index.ts          # 类型导出
│   │   ├── models.ts         # 数据模型定义
│   │   └── api.ts            # API类型定义
│   ├── store/
│   │   └── dataStore.ts      # 内存数据存储
│   ├── services/
│   │   ├── dataImportService.ts     # 数据导入服务
│   │   ├── billingCalculatorService.ts  # 账单计算服务
│   │   ├── reviewService.ts          # 复核流程服务
│   │   └── reportService.ts          # 报告生成服务
│   └── routes/
│       ├── importRoutes.ts   # 数据导入API
│       ├── billingRoutes.ts  # 账单管理API
│       ├── reviewRoutes.ts   # 复核流程API
│       └── reportRoutes.ts   # 报告导出API
├── sample-data/              # 示例数据文件
│   ├── meter-readings.csv    # 电表读数示例
│   ├── contract.json         # 租户合同示例
│   └── zones.json            # 温区配置示例
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 生产构建

```bash
npm run build
npm start
```

## API 接口文档

### 健康检查

```
GET /health
```

### 数据导入

#### 上传电表数据 (CSV)

```
POST /api/import/meter
Content-Type: multipart/form-data

Body:
- file: meter-readings.csv 文件
```

#### 上传租户合同 (JSON)

```
POST /api/import/contract
Content-Type: multipart/form-data

Body:
- file: contract.json 文件
```

#### 导入温区配置

```
POST /api/import/zones
Content-Type: application/json

Body:
[
  {
    "id": "Z001",
    "name": "冷冻库A区",
    "type": "frozen",
    "targetTemp": -18,
    "multiplier": 1.2,
    "isVacant": false
  }
]
```

#### 获取导入汇总

```
GET /api/import/summary?periodStart=2024-01-01&periodEnd=2024-01-31
```

### 账单管理

#### 计算账期账单

```
POST /api/billing/calculate
Content-Type: application/json

Body:
{
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-31"
}
```

#### 查询账单列表

```
GET /api/billing/records?periodStart=2024-01-01&periodEnd=2024-01-31&tenantId=T001&status=pending&page=1&pageSize=20
```

#### 查询单条账单详情

```
GET /api/billing/records/:id
```

#### 重新计算账单

```
POST /api/billing/records/:id/recalculate
```

### 复核流程

#### 审批通过

```
POST /api/review/records/:id/approve
Content-Type: application/json

Body:
{
  "userId": "admin001",
  "userName": "张会计",
  "comment": "数据核对无误，同意通过"
}
```

#### 审批驳回

```
POST /api/review/records/:id/reject
Content-Type: application/json

Body:
{
  "userId": "admin001",
  "userName": "张会计",
  "comment": "用电量数据异常，请重新核实"
}
```

#### 要求补充材料

```
POST /api/review/records/:id/request-info
Content-Type: application/json

Body:
{
  "userId": "admin001",
  "userName": "张会计",
  "comment": "请提供该时段的加班申请单"
}
```

#### 修改账单数据

```
POST /api/review/records/:id/modify
Content-Type: application/json

Body:
{
  "userId": "admin001",
  "userName": "张会计",
  "comment": "根据实际情况调整基础电费",
  "modifications": {
    "electricityCost": 8500
  }
}
```

#### 添加备注

```
POST /api/review/records/:id/comment
Content-Type: application/json

Body:
{
  "userId": "admin001",
  "userName": "张会计",
  "comment": "已与租户确认用电量无误"
}
```

#### 查询复核历史

```
GET /api/review/records/:id/history
```

#### 查询待审批账单

```
GET /api/review/pending
```

#### 获取复核统计

```
GET /api/review/statistics
```

### 报告导出

#### 下载Excel报告

```
GET /api/report/excel?periodStart=2024-01-01&periodEnd=2024-01-31&includeDetails=true
```

#### 下载PDF报告

```
GET /api/report/pdf?periodStart=2024-01-01&periodEnd=2024-01-31&includeDetails=true
```

#### 查看账单详情HTML页面

```
GET /api/report/records/:id/html
```

## 数据模型说明

### 电表读数 (MeterReading)

| 字段 | 类型 | 说明 |
|------|------|------|
| meterId | string | 电表编号 |
| zoneId | string | 所属温区ID |
| timestamp | Date | 读数时间 |
| reading | number | 电表读数 |
| consumption | number | 时段用电量(kWh) |
| isPeak | boolean | 是否峰时段 |

### 租户合同 (TenantContract)

| 字段 | 类型 | 说明 |
|------|------|------|
| tenantId | string | 租户ID |
| tenantName | string | 租户名称 |
| zoneIds | string[] | 租用的温区列表 |
| startDate / endDate | Date | 合同起止日期 |
| baseMultiplier | number | 基础用电倍率 |
| overtimeMultiplier | number | 加班用电倍率 |
| ratePerKwh | number | 电价(元/kWh) |
| baseRent | number | 基础租金(元/账期) |
| overtimeHours | array | 加班时段记录 |

### 温区 (TemperatureZone)

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 温区名称 |
| type | enum | 类型: frozen/chilled/ambient |
| targetTemp | number | 目标温度(℃) |
| multiplier | number | 温区用电倍率 |
| isVacant | boolean | 是否空置 |
| vacantStartDate | Date | 空置开始日期 |

### 账单记录 (BillingRecord)

| 字段 | 类型 | 说明 |
|------|------|------|
| tenantId / zoneId | string | 租户和温区标识 |
| baseConsumption | number | 基础用电量 |
| overtimeConsumption | number | 加班用电量 |
| appliedMultiplier | number | 实际应用倍率 |
| electricityCost | number | 电费(元) |
| baseRent | number | 基础租金(元) |
| overtimeSurcharge | number | 加班附加费(元) |
| totalAmount | number | 总费用(元) |
| anomalies | array | 异常记录列表 |
| reviewStatus | enum | 审批状态 |
| reviewNotes | array | 复核历史记录 |
| calculationDetails | array | 计算步骤明细 |

### 异常类型 (Anomaly)

- **multiplier_change**: 倍率变更，记录变更时间和影响
- **vacant_period**: 空置期，记录空置减免金额
- **spike**: 用电尖峰，记录超出平均用量的异常
- **overtime**: 加班用电，记录加班时段和附加费用

### 审批状态 (ReviewStatus)

- **pending**: 待审批
- **approved**: 已通过
- **rejected**: 已驳回
- **needs_more_info**: 需补充材料

## 计算流程说明

1. **数据收集**：汇总账期内各温区的小时级电表读数
2. **时段分类**：区分正常时段和加班时段用电量
3. **倍率应用**：基础用电量 × (合同倍率 × 温区倍率)
4. **空置调整**：空置时段用电量 × 50% 减免
5. **电费计算**：调整后用电量 × 电价
6. **加班附加**：加班用电量 × (加班倍率 - 1) × 电价
7. **总费用**：电费 + 基础租金 + 加班附加费

## 注意事项

1. 当前版本使用内存存储，服务重启后数据会丢失，生产环境应接入数据库
2. 示例数据仅包含2024年1月1日的电表读数，用于演示用途
3. 建议在生产环境中添加用户认证和权限控制
4. 大文件导入建议添加异步处理和进度提示
