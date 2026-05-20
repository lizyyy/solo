# 公交失物招领对账服务

这是一个用于公交失物招领的后端对账服务，支持乘客报失记录、司机上交记录和仓库入库记录的自动匹配和人工复核。

## 功能特性

- **数据导入**：支持CSV格式导入乘客报失、司机上交和仓库入库数据，支持JSON格式导入线路班次数据
- **自动匹配**：基于模糊匹配算法自动匹配三方数据，支持物品名称、描述、类别、颜色、品牌、线路等多维度匹配
- **差异检测**：自动识别同名物品、逾期未领、敏感信息、时间不匹配、地点不匹配等差异情况
- **人工复核**：支持审批通过、驳回、人工匹配、解除匹配等复核操作，完整记录复核历史
- **重新计算**：支持在数据变更后重新计算匹配结果，自动更新汇总统计
- **报告生成**：支持多种格式报告导出（JSON、CSV、Excel、纯文本），包含汇总统计、明细数据、差异分析
- **审计追踪**：支持单条匹配记录的完整审计报告，包含关联的所有来源数据和复核历史
- **隐私保护**：导出报告时自动脱敏敏感信息（如手机号）

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- Fuse.js (模糊搜索)
- json2csv (CSV导出)
- xlsx (Excel导出)
- multer (文件上传)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 编译生产版本

```bash
npm run build
npm start
```

## API 接口

### 1. 创建对账批次

```
POST /api/batches
Content-Type: multipart/form-data

请求参数:
- passengerCsv: 乘客报失CSV文件
- driverCsv: 司机上交CSV文件
- warehouseCsv: 仓库入库CSV文件
- routeJson: 线路班次JSON文件
- batchName: 批次名称
- createdBy: 创建人
```

**示例**（使用curl）：

```bash
curl -X POST http://localhost:3000/api/batches \
  -F "passengerCsv=@sample-data/passenger-lost-items.csv" \
  -F "driverCsv=@sample-data/driver-turned-in-items.csv" \
  -F "warehouseCsv=@sample-data/warehouse-items.csv" \
  -F "routeJson=@sample-data/route-schedules.json" \
  -F "batchName=2024年1月对账批次" \
  -F "createdBy=管理员"
```

### 2. 获取所有批次列表

```
GET /api/batches
```

### 3. 获取批次详情

```
GET /api/batches/:batchId
```

### 4. 获取匹配列表（支持筛选）

```
GET /api/batches/:batchId/matches

查询参数:
- status: 按状态筛选 (matched, unmatched, reviewing, approved, rejected)
- hasDifference: 按差异类型筛选 (same_name, overdue, sensitive_info, etc.)
- isOverdue: 是否逾期 (true/false)
```

### 5. 获取匹配详情

```
GET /api/batches/:batchId/matches/:matchId
```

### 6. 审批通过

```
POST /api/batches/:batchId/matches/:matchId/approve
Content-Type: application/json

{
  "reviewer": "审核人姓名",
  "reason": "审批通过原因"
}
```

### 7. 审批驳回

```
POST /api/batches/:batchId/matches/:matchId/reject
Content-Type: application/json

{
  "reviewer": "审核人姓名",
  "reason": "驳回原因"
}
```

### 8. 人工匹配

```
POST /api/batches/:batchId/matches/:matchId/manual-match
Content-Type: application/json

{
  "reviewer": "审核人姓名",
  "reason": "人工匹配原因",
  "passengerItemId": "乘客记录ID",
  "driverItemId": "司机记录ID",
  "warehouseItemId": "仓库记录ID"
}
```

### 9. 解除匹配

```
POST /api/batches/:batchId/matches/:matchId/unmatch
Content-Type: application/json

{
  "reviewer": "审核人姓名",
  "reason": "解除匹配原因"
}
```

### 10. 重新计算匹配

```
POST /api/batches/:batchId/recalculate
```

### 11. 完成对账批次

```
POST /api/batches/:batchId/complete
```

### 12. 下载对账报告

```
GET /api/batches/:batchId/report

查询参数:
- format: 报告格式 (json, csv, excel, text) - 默认为text
```

示例：
```bash
# 下载Excel报告
curl -o report.xlsx "http://localhost:3000/api/batches/{batchId}/report?format=excel"

# 下载CSV报告
curl -o report.csv "http://localhost:3000/api/batches/{batchId}/report?format=csv"
```

### 13. 下载单条记录审计报告

```
GET /api/batches/:batchId/matches/:matchId/audit-report
```

### 14. 健康检查

```
GET /health
```

## 数据格式说明

### 乘客报失CSV字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| reportDate | string | 是 | 报失日期 (YYYY-MM-DD) |
| reportTime | string | 否 | 报失时间 |
| passengerName | string | 是 | 乘客姓名 |
| passengerPhone | string | 是 | 乘客电话 |
| itemName | string | 是 | 物品名称 |
| itemDescription | string | 是 | 物品描述 |
| itemCategory | string | 是 | 物品类别 |
| itemColor | string | 否 | 物品颜色 |
| itemBrand | string | 否 | 物品品牌 |
| routeNumber | string | 是 | 线路号 |
| busNumber | string | 否 | 车牌号 |
| lostDate | string | 是 | 丢失日期 |
| lostTime | string | 否 | 丢失时间 |
| lostLocation | string | 是 | 丢失地点 |
| destination | string | 否 | 目的地 |
| seatLocation | string | 否 | 座位位置 |
| remarks | string | 否 | 备注 |

### 司机上交CSV字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| turnInDate | string | 是 | 上交日期 |
| turnInTime | string | 否 | 上交时间 |
| driverName | string | 是 | 司机姓名 |
| driverId | string | 是 | 司机ID |
| routeNumber | string | 是 | 线路号 |
| busNumber | string | 是 | 车牌号 |
| itemName | string | 是 | 物品名称 |
| itemDescription | string | 是 | 物品描述 |
| itemCategory | string | 是 | 物品类别 |
| itemColor | string | 否 | 物品颜色 |
| itemBrand | string | 否 | 物品品牌 |
| foundDate | string | 是 | 捡到日期 |
| foundTime | string | 否 | 捡到时间 |
| foundLocation | string | 是 | 捡到地点 |
| bagNumber | string | 否 | 编号 |
| remarks | string | 否 | 备注 |
| imageIds | string | 否 | 图片ID，逗号分隔 |

### 仓库入库CSV字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| receiptDate | string | 是 | 入库日期 |
| receiptTime | string | 否 | 入库时间 |
| warehouseStaff | string | 是 | 仓库管理员 |
| itemName | string | 是 | 物品名称 |
| itemDescription | string | 是 | 物品描述 |
| itemCategory | string | 是 | 物品类别 |
| itemColor | string | 否 | 物品颜色 |
| itemBrand | string | 否 | 物品品牌 |
| storageLocation | string | 是 | 存放位置 |
| shelfNumber | string | 否 | 货架编号 |
| bagNumber | string | 否 | 编号 |
| driverTurnInId | string | 否 | 司机上交记录ID |
| remarks | string | 否 | 备注 |
| imageIds | string | 否 | 图片ID，逗号分隔 |

### 线路班次JSON字段

```json
[
  {
    "routeNumber": "1路",
    "busNumber": "京A12345",
    "driverName": "刘师傅",
    "driverId": "D001",
    "date": "2024-01-15",
    "startTime": "06:00",
    "endTime": "14:00",
    "stops": ["前门站", "天安门东站"]
  }
]
```

## 差异类型说明

系统自动识别以下差异类型，并在报告中清晰说明：

- **same_name**: 同名物品 - 物品名称相同但描述存在差异，需要人工核对
- **overdue**: 逾期未领 - 物品超过90天无人认领
- **sensitive_info**: 敏感信息 - 物品描述包含身份证、银行卡、钱包等敏感信息，处理时注意隐私
- **description_mismatch**: 描述不匹配 - 物品描述存在明显差异
- **time_mismatch**: 时间不匹配 - 丢失/捡到时间不匹配或超出合理范围
- **location_mismatch**: 地点不匹配 - 丢失/捡到地点或线路不匹配
- **duplicate**: 重复记录 - 可能存在重复录入的记录

## 项目结构

```
.
├── src/
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── importers/          # 数据导入模块
│   │   ├── csvImporter.ts
│   │   └── jsonImporter.ts
│   ├── matching/           # 匹配引擎
│   │   └── matchingEngine.ts
│   ├── review/             # 复核服务
│   │   └── reviewService.ts
│   ├── reconciliation/     # 对账服务
│   │   └── reconciliationService.ts
│   ├── report/             # 报告生成
│   │   └── reportGenerator.ts
│   ├── api/                # API服务
│   │   └── server.ts
│   └── index.ts            # 服务入口
├── sample-data/            # 示例数据
│   ├── passenger-lost-items.csv
│   ├── driver-turned-in-items.csv
│   ├── warehouse-items.csv
│   └── route-schedules.json
├── package.json
├── tsconfig.json
└── README.md
```

## 核心模块说明

### 匹配引擎 (MatchingEngine)

基于Fuse.js实现模糊搜索，支持多维度匹配权重配置：
- 物品名称: 权重 0.3
- 物品描述: 权重 0.2
- 物品类别: 权重 0.15
- 物品颜色: 权重 0.1
- 物品品牌: 权重 0.1
- 线路号: 权重 0.1
- 丢失地点: 权重 0.05

自动过滤低于阈值（0.6）的匹配结果，确保匹配质量。

### 对账服务 (ReconciliationService)

负责整个对账流程的编排，包括：
- 批次管理（创建、查询、完成）
- 匹配结果存储和查询
- 复核操作协调
- 统计数据实时更新
- 报告数据生成

### 报告生成器 (ReportGenerator)

支持多种格式报告导出：
- JSON: 完整结构化数据，便于程序处理
- CSV: 可直接在Excel中打开和编辑
- Excel: 包含多个工作表的完整报告（汇总+明细）
- 纯文本: 人类可读的格式化报告，包含审计追踪

## 隐私保护

系统在导出报告时自动进行数据脱敏：
- 乘客手机号: 中间4位替换为**** (如 138****8001)
- 敏感物品: 在差异说明中特别标注，提醒处理人员注意隐私

## 注意事项

1. 服务使用内存存储数据，重启后数据会丢失，生产环境请接入数据库
2. 文件上传大小限制为默认值，大文件需要调整multer配置
3. 逾期判断阈值默认为90天，可在MatchingEngine中调整
4. 匹配阈值默认为0.6，可根据实际业务需求调整

## 许可证

MIT
