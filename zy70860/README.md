# 供水抢修物资领用管理系统

后端服务，用于管理供水抢修队的物资领用、车辆信息、仓库库存，生成可追踪记录。

## 功能特性

- **数据导入**：支持领料CSV、车辆JSON、库存CSV导入
- **记录管理**：新增批次、标记处理、审核通过/拒绝、退回修改、完成
- **异常处理**：紧急领用、归还差异、库存负数时记录原因、处理人、时间
- **历史查询**：按抢修单号、车组、备件批次查询
- **导出功能**：导出明细CSV、导出完整报告
- **审计追踪**：完整的操作日志，支持从单条明细到最终报告的链路追踪
- **放行说明**：处理完成后可说明记录放行、退回或要求补材料的原因

## 技术栈

- Node.js + Express
- MongoDB + Mongoose
- CSV解析：csv-parser, json2csv
- 文件上传：multer

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── models/                # 数据模型
│   │   ├── MaterialRecord.js  # 物资领用记录
│   │   ├── Vehicle.js         # 车辆信息
│   │   ├── Inventory.js       # 库存记录
│   │   ├── RepairOrder.js     # 抢修单
│   │   ├── ExceptionLog.js    # 异常日志
│   │   └── AuditLog.js        # 审计日志
│   ├── services/              # 业务逻辑
│   │   ├── materialService.js # 物资记录服务
│   │   ├── importService.js   # 导入服务
│   │   ├── queryService.js    # 查询服务
│   │   └── exportService.js   # 导出服务
│   ├── controllers/           # 控制器
│   │   └── materialController.js
│   ├── routes/                # 路由
│   │   └── materialRoutes.js
│   └── utils/                 # 工具
│       └── idGenerator.js
├── uploads/                   # 上传文件目录
├── .env                       # 环境变量
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env` 文件并配置：

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/water_supply_repair
NODE_ENV=development
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 启动

## API 接口文档

### 基础路径

所有API接口都以 `/api` 为前缀

### 记录管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/records` | 创建单条记录 |
| POST | `/api/records/batch` | 批量创建记录 |
| PUT | `/api/records/:recordId/processing` | 标记处理中 |
| PUT | `/api/records/:recordId/approve` | 审核通过（放行） |
| PUT | `/api/records/:recordId/reject` | 审核拒绝 |
| PUT | `/api/records/:recordId/return` | 退回修改 |
| PUT | `/api/records/:recordId/complete` | 标记完成 |
| PUT | `/api/records/:recordId/process-return` | 处理归还 |

### 查询接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/records` | 查询记录列表（支持筛选和分页） |
| GET | `/api/records/:recordId` | 获取单条记录详情 |
| GET | `/api/records/:recordId/audit-trail` | 获取记录审计追踪 |
| GET | `/api/records/:recordId/report` | 获取完整报告 |
| GET | `/api/orders/:orderNumber/records` | 按抢修单号查询 |
| GET | `/api/teams/:teamName/records` | 按班组/车组查询 |
| GET | `/api/batches/:batchNumber/records` | 按备件批次查询 |

### 导出接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/csv` | 导出记录为CSV（支持筛选） |
| GET | `/api/export/report/:recordId` | 导出单条记录完整报告 |

### 导入接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/import/vehicles` | 导入车辆JSON |
| POST | `/api/import/inventory` | 导入库存CSV |
| POST | `/api/import/records` | 导入领料记录CSV |

### 其他接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/exceptions` | 查询异常日志 |
| GET | `/api/statistics` | 获取统计信息 |
| GET | `/health` | 健康检查 |

## 状态流转

```
pending (待处理)
    ↓
processing (处理中)
    ↓
    ├──→ approved (已通过/放行)
    │       ↓
    │     completed (已完成)
    ├──→ rejected (已拒绝)
    └──→ returned (退回修改)
            ↓
         pending (重新处理)
```

## 异常类型

1. **emergency_usage** - 紧急领用：紧急情况下的物资领用
2. **return_difference** - 归还差异：实际归还数量与预期不符
3. **negative_stock** - 库存负数：库存数量不足导致负数

## 查询参数说明

查询记录列表时支持以下参数：

| 参数 | 类型 | 描述 |
|------|------|------|
| orderNumber | string | 抢修单号 |
| teamName | string | 班组/车组名称 |
| batchNumber | string | 批次号 |
| materialCode | string | 物料编码 |
| status | string | 状态：pending/processing/approved/rejected/returned/completed |
| recordType | string | 记录类型：normal/emergency/return |
| hasException | boolean | 是否有异常 |
| startDate | string | 开始日期 (YYYY-MM-DD) |
| endDate | string | 结束日期 (YYYY-MM-DD) |
| page | number | 页码（默认1） |
| pageSize | number | 每页数量（默认50） |
| sortBy | string | 排序字段 |
| sortOrder | string | 排序方向：asc/desc |

## 请求示例

### 创建记录

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "QXD20240520001",
    "teamName": "抢修一班",
    "vehicleId": "VH001",
    "materialCode": "PIPE001",
    "materialName": "DN100镀锌钢管",
    "specification": "DN100",
    "unit": "米",
    "requestedQuantity": 10,
    "batchNumber": "BATCH20240501",
    "warehouse": "一号仓库",
    "recordType": "normal",
    "applicant": "张三",
    "reason": "人民路管道维修",
    "remarks": "急需"
  }'
```

### 审核通过（放行）

```bash
curl -X PUT http://localhost:3000/api/records/REC20240520XXXX \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "李四",
    "reason": "材料齐全，符合领用标准，予以放行",
    "actualQuantity": 10
  }'
```

### 导出报告

```bash
curl -O http://localhost:3000/api/export/report/REC20240520XXXX
```

## 报告内容说明

导出的完整报告包含：

1. **基本信息**：记录ID、抢修单号、物料信息、数量、申请人、处理人等
2. **抢修单信息**：抢修类型、地点、描述、优先级、负责人等
3. **车辆信息**：车辆ID、车牌号、班组、驾驶员、随车人员
4. **库存信息**：当前库存状态、批次信息
5. **审计追踪**：完整的操作历史，包括每次状态变更的操作人、时间、原因
6. **异常记录**：所有异常情况的详细记录和处理结果
7. **放行说明**：最终处理状态的详细说明，可用于向他人解释放行、退回或补材料的原因

## 数据一致性保证

- 导出的CSV文件数量与查询结果完全一致
- 库存变更与领用、归还操作联动
- 异常日志与领用记录关联
- 审计日志完整记录所有操作

## 许可证

ISC
