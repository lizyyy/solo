# 灭火器批次召回闭环台

一个为消防维保公司设计的本地后端API服务，用于管理灭火器批次召回、派工状态流转、逾期风险监控等业务流程。

## 功能特性

### 核心功能
- **数据导入**：支持导入器材台账CSV、巡检记录JSON、厂家召回清单（CSV/JSON）
- **召回匹配**：自动匹配召回批次与库存器材，避免漏通知
- **派工管理**：完整的派工状态流转机制
- **风险监控**：逾期风险自动计算和等级评估
- **报告导出**：支持Markdown和CSV格式报告导出

### 业务痛点解决
- ✅ **同一批次漏通知**：通过规则引擎自动检测漏通知情况
- ✅ **已报废器材派工**：创建派工单时自动检查器材状态
- ✅ **整改超期没人盯**：风险等级自动评估，高风险项目重点关注

## 技术栈

- **运行环境**: Node.js 16+
- **Web框架**: Express.js
- **数据库**: SQLite3（本地文件存储）
- **文件解析**: csv-parser, multer
- **数据校验**: Joi
- **日期处理**: dayjs
- **唯一ID**: uuid

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 创建必要目录

```bash
mkdir -p uploads exports
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 项目结构

```
xy4283/
├── src/
│   ├── index.js              # 项目入口文件
│   ├── models/               # 数据模型层
│   │   ├── database.js           # 数据库连接和初始化
│   │   ├── equipmentModel.js     # 器材台账模型
│   │   ├── inspectionModel.js    # 巡检记录模型
│   │   ├── recallModel.js        # 召回清单模型
│   │   ├── recallMatchModel.js   # 召回匹配模型
│   │   ├── workOrderModel.js     # 派工单模型
│   │   ├── statusHistoryModel.js # 状态历史模型
│   │   ├── overdueRiskModel.js   # 逾期风险模型
│   │   └── index.js              # 模型索引
│   ├── parsers/              # 解析器层
│   │   ├── csvParser.js          # CSV文件解析
│   │   ├── jsonParser.js         # JSON文件解析
│   │   └── index.js              # 解析器索引
│   ├── validators/           # 校验器层
│   │   ├── dataValidator.js      # 数据校验
│   │   └── index.js              # 校验器索引
│   ├── services/             # 服务层
│   │   ├── rulesEngine.js        # 规则引擎
│   │   ├── stateMachine.js       # 状态机
│   │   ├── riskCalculator.js     # 风险计算
│   │   ├── exporter.js           # 导出服务
│   │   └── index.js              # 服务索引
│   └── routes/               # API路由层
│       ├── index.js              # 主路由
│       ├── equipment.js          # 器材台账路由
│       ├── recall.js             # 召回清单路由
│       ├── workOrder.js          # 派工单路由
│       ├── import.js             # 数据导入路由
│       ├── risk.js               # 风险路由
│       ├── export.js             # 导出路由
│       └── rules.js              # 规则引擎路由
├── samples/                # 示例数据
│   ├── equipment_ledger.csv      # 器材台账示例
│   ├── inspection_records.json   # 巡检记录示例
│   ├── recall_list.csv           # 召回清单CSV示例
│   └── recall_list.json          # 召回清单JSON示例
├── package.json
└── README.md
```

## API接口文档

### 健康检查

- **GET** `/api/health`

获取服务状态信息

### 数据导入

所有导入接口使用 `multipart/form-data` 格式，文件字段名为 `file`。

#### 导入器材台账（CSV）
- **POST** `/api/import/equipment`

支持的列名：
- 器材编号 / equipment_code / EquipmentCode
- 器材名称 / equipment_name / EquipmentName
- 规格型号 / specification / Specification
- 生产厂家 / manufacturer / Manufacturer
- 批次号 / batch_number / BatchNumber
- 生产日期 / production_date / ProductionDate
- 有效期限 / expiration_date / ExpirationDate
- 放置位置 / location / Location
- 状态 / status / Status
- 是否报废 / is_scrapped / IsScrapped

#### 导入巡检记录（JSON）
- **POST** `/api/import/inspection`

支持的数据结构：
```json
{
  "inspections": [
    {
      "equipment_code": "器材编号",
      "inspection_date": "巡检日期",
      "inspector": "巡检人",
      "status": "状态",
      "notes": "备注"
    }
  ]
}
```

#### 导入召回清单
- **POST** `/api/import/recall`

支持CSV和JSON格式

#### 预览文件内容
- **POST** `/api/import/preview`

预览上传的文件内容，不保存到数据库

### 器材台账管理

- **GET** `/api/equipment` - 获取所有器材
- **GET** `/api/equipment/:id` - 根据ID获取器材
- **GET** `/api/equipment/code/:code` - 根据器材编号获取器材
- **GET** `/api/equipment/batch/:batchNumber` - 根据批次号获取器材
- **GET** `/api/equipment/scrapped` - 获取已报废器材
- **POST** `/api/equipment` - 创建器材
- **PUT** `/api/equipment/:id` - 更新器材
- **POST** `/api/equipment/:id/scrap` - 报废器材
- **GET** `/api/equipment/stats/summary` - 获取器材统计
- **GET** `/api/equipment/:id/inspections` - 获取器材巡检记录

### 召回清单管理

- **GET** `/api/recall` - 获取所有召回清单
- **GET** `/api/recall/:id` - 根据ID获取召回清单
- **GET** `/api/recall/code/:code` - 根据召回编号获取召回清单
- **POST** `/api/recall` - 创建召回清单
- **PUT** `/api/recall/:id` - 更新召回清单
- **POST** `/api/recall/:id/close` - 关闭召回清单
- **DELETE** `/api/recall/:id` - 删除召回清单
- **POST** `/api/recall/:id/match` - 执行召回匹配
- **GET** `/api/recall/:id/matches` - 获取召回匹配记录
- **GET** `/api/recall/stats/summary` - 获取召回统计

### 派工单管理

- **GET** `/api/work-order` - 获取所有派工单
- **GET** `/api/work-order/:id` - 根据ID获取派工单
- **GET** `/api/work-order/code/:code` - 根据派工单号获取派工单
- **POST** `/api/work-order` - 创建派工单
- **PUT** `/api/work-order/:id` - 更新派工单
- **POST** `/api/work-order/:id/assign` - 分配派工单
- **POST** `/api/work-order/:id/start` - 开始派工单
- **POST** `/api/work-order/:id/complete` - 完成派工单
- **POST** `/api/work-order/:id/cancel` - 取消派工单
- **GET** `/api/work-order/:id/history` - 获取派工单状态历史
- **GET** `/api/work-order/stats/summary` - 获取派工单统计

### 风险监控

- **POST** `/api/risk/scan` - 执行全面风险扫描
- **GET** `/api/risk` - 获取所有逾期风险
- **GET** `/api/risk/:id` - 根据ID获取风险记录
- **GET** `/api/risk/level/high` - 获取高风险项目
- **GET** `/api/risk/upcoming` - 获取即将逾期的项目
- **POST** `/api/risk/:id/resolve` - 标记风险已解决
- **GET** `/api/risk/stats/summary` - 获取风险统计
- **GET** `/api/risk/stats/distribution` - 获取风险等级分布

### 报告导出

- **GET** `/api/export/comprehensive` - 生成综合报告
- **GET** `/api/export/comprehensive/download` - 生成并下载综合报告
- **GET** `/api/export/recall/:recallId` - 生成召回详细报告
- **GET** `/api/export/recall/:recallId/download` - 生成并下载召回详细报告
- **GET** `/api/export/risk` - 生成风险报告
- **GET** `/api/export/risk/download` - 生成并下载风险报告
- **GET** `/api/export/equipment` - 生成器材台账报告
- **GET** `/api/export/equipment/download` - 生成并下载器材台账报告
- **GET** `/api/export/files` - 获取导出文件列表
- **DELETE** `/api/export/files` - 清空导出目录

### 规则引擎

- **POST** `/api/rules/check-all` - 执行所有规则检查
- **POST** `/api/rules/detect-missed-notifications` - 检测漏通知
- **POST** `/api/rules/detect-scrapped-equipment-issues` - 检测已报废器材派工
- **POST** `/api/rules/check-equipment-in-recall` - 检查器材是否在召回批次
- **POST** `/api/rules/match/:matchId/notify` - 标记召回匹配为已通知
- **POST** `/api/rules/notify-batch` - 批量标记已通知
- **GET** `/api/rules/health` - 获取规则引擎健康检查

## 数据模型

### 主要数据表

1. **equipment** - 器材台账
   - 器材编号、名称、规格型号、生产厂家、批次号、生产日期、有效期限、放置位置、状态、是否报废

2. **inspections** - 巡检记录
   - 器材ID、巡检日期、巡检人、状态、压力正常、铅封完好、喷嘴畅通、软管状况、有效期状态、备注

3. **recalls** - 厂家召回清单
   - 召回编号、生产厂家、召回原因、涉及批次、发布日期、整改期限、紧急程度、状态

4. **recall_matches** - 召回匹配
   - 召回ID、器材ID、批次号、状态、是否已通知、通知日期

5. **work_orders** - 派工单
   - 派工单号、器材ID、召回匹配ID、标题、描述、优先级、状态、分配人、开始时间、完成时间、完成备注、取消原因

6. **status_history** - 状态流转记录
   - 实体类型、实体ID、原状态、新状态、变更人、变更原因

7. **overdue_risks** - 逾期风险记录
   - 实体类型、实体ID、关联ID、截止日期、逾期天数、风险等级、状态、解决日期、解决备注

## 状态流转规则

### 派工单状态流转

```
created → assigned → in_progress → completed
                           ↓
                         cancelled
```

- **created**: 派工单已创建，等待分配
- **assigned**: 已分配给处理人
- **in_progress**: 正在处理中
- **completed**: 处理完成
- **cancelled**: 已取消

### 召回匹配状态

```
pending → notified
   ↓
completed
```

- **pending**: 待通知
- **notified**: 已通知
- **completed**: 已完成整改

## 风险等级定义

| 等级 | 逾期天数 | 说明 |
|------|---------|------|
| low | 0-2天 | 低风险，即将逾期 |
| medium | 3-7天 | 中风险，已逾期但仍在合理范围内 |
| high | 8-14天 | 高风险，需要重点关注 |
| critical | ≥15天 | 严重风险，需要立即处理 |

## 使用示例

### 1. 导入器材台账

```bash
curl -X POST http://localhost:3000/api/import/equipment \
  -F "file=@samples/equipment_ledger.csv"
```

### 2. 导入召回清单

```bash
curl -X POST http://localhost:3000/api/import/recall \
  -F "file=@samples/recall_list.csv"
```

### 3. 执行召回匹配

```bash
curl -X POST http://localhost:3000/api/recall/1/match
```

### 4. 执行规则检查

```bash
curl -X POST http://localhost:3000/api/rules/check-all
```

### 5. 生成综合报告

```bash
curl http://localhost:3000/api/export/comprehensive
```

## 常见问题

### Q: 支持哪些文件格式？
A: 支持CSV和JSON格式。器材台账推荐使用CSV，巡检记录推荐使用JSON，召回清单支持两种格式。

### Q: 数据库存储在哪里？
A: 默认存储在项目根目录的 `fire-extinguisher.db` SQLite数据库文件中。

### Q: 如何修改服务端口？
A: 可以通过设置环境变量 `PORT` 来修改端口：
```bash
PORT=8080 npm start
```

### Q: 导出的文件保存在哪里？
A: 导出的文件默认保存在项目根目录的 `exports` 文件夹中。

## 许可证

MIT License
