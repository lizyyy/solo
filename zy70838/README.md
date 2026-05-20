# 4S店试驾车对账服务

## 项目简介

这是一个专为4S店设计的试驾车对账后端服务，解决了钥匙借还、油卡管理和违章记录的手工登记问题，实现了全流程自动化对账和可追溯管理。

## 核心功能

### 1. 数据导入
- 钥匙借还记录CSV导入
- 车辆信息JSON导入
- 违章记录JSON导入

### 2. 自动比对引擎
- **超时未还检测**：检测超过预计归还时间的车辆
- **油卡余额异常**：检测油卡余额不合理变化和余额不足提醒
- **违章归属匹配**：自动匹配违章记录对应的借用人
- **里程异常检测**：检测单次试驾里程异常

### 3. 人工复核
- 支持确认、调整、忽略三种审核操作
- 可调整原始数据并记录变更历史
- 审核后自动重新计算差异

### 4. 报告系统
- 生成对账汇总报告
- 支持多维度数据统计
- 导出Excel（含5个工作表：对账汇总、差异明细、借还记录、车辆信息、违章记录）

### 5. 追溯链路
- 从单条借还记录追溯到最终对账报告
- 完整的审计日志记录
- 支持查看所有相关联的数据

## 项目结构

```
├── src/
│   ├── controllers/          # 控制器层
│   │   ├── ImportController.ts
│   │   ├── ReconciliationController.ts
│   │   └── ReportController.ts
│   ├── services/             # 业务逻辑层
│   │   ├── ImportService.ts
│   │   ├── ReconciliationEngine.ts
│   │   ├── ReviewService.ts
│   │   └── ReportService.ts
│   ├── models/               # 数据模型
│   │   └── Store.ts
│   ├── types/                # 类型定义
│   │   └── index.ts
│   ├── routes/               # 路由配置
│   │   └── index.ts
│   └── server.ts             # 服务入口
├── data/                     # 示例数据
│   ├── borrow_records.csv
│   ├── vehicles.json
│   └── violations.json
├── uploads/                  # 上传文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 验证服务

```bash
curl http://localhost:3000/api/health
```

## API接口说明

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/borrow-records | 导入借还记录CSV |
| POST | /api/import/vehicles | 导入车辆信息JSON |
| POST | /api/import/violations | 导入违章记录JSON |

### 对账管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconciliation/run | 执行对账 |
| GET | /api/reconciliation/discrepancies | 获取差异列表 |
| GET | /api/reconciliation/discrepancies/:id | 获取差异详情 |
| POST | /api/reconciliation/discrepancies/:id/review | 审核差异 |
| POST | /api/reconciliation/recalculate | 重新对账 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reconciliation/reports | 获取报告列表 |
| GET | /api/reconciliation/reports/:id | 获取报告详情 |
| POST | /api/reconciliation/reports/:id/finalize | 结报 |
| POST | /api/reports/:reportId/export/excel | 导出Excel |
| GET | /api/reports/:reportId/download/excel | 下载Excel |

### 追溯查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/traceability/:recordId | 获取追溯链路 |
| GET | /api/audit-log/:recordId | 获取审计日志 |
| GET | /api/borrow-records | 获取借还记录列表 |
| GET | /api/vehicles | 获取车辆列表 |
| GET | /api/violations | 获取违章列表 |

## 差异类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| overdue_return | 超时未还 | 高/中/低 |
| fuel_card_balance | 油卡余额异常 | 高/中/低 |
| violation_ownership | 违章归属问题 | 高 |
| mileage_abnormal | 里程异常 | 高/中 |

## 使用示例

### 1. 导入数据

```bash
# 导入借还记录
curl -X POST -F "file=@data/borrow_records.csv" http://localhost:3000/api/import/borrow-records

# 导入车辆信息
curl -X POST -F "file=@data/vehicles.json" http://localhost:3000/api/import/vehicles

# 导入违章记录
curl -X POST -F "file=@data/violations.json" http://localhost:3000/api/import/violations
```

### 2. 执行对账

```bash
curl -X POST http://localhost:3000/api/reconciliation/run \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2024-01-01",
    "periodEnd": "2024-01-31"
  }'
```

### 3. 审核差异

```bash
curl -X POST http://localhost:3000/api/reconciliation/discrepancies/{id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "action": "adjust",
    "reviewer": "张主管",
    "comments": "已确认并调整归还时间",
    "adjustments": [
      {
        "recordType": "borrow",
        "recordId": "...",
        "field": "actualReturnTime",
        "oldValue": "2024-01-16T17:00:00.000Z",
        "newValue": "2024-01-18T10:00:00.000Z"
      }
    ]
  }'
```

### 4. 导出报告

```bash
curl -X POST http://localhost:3000/api/reports/{reportId}/export/excel
```

### 5. 追溯查询

```bash
# 获取某条记录的完整追溯链路
curl http://localhost:3000/api/traceability/{recordId}

# 获取审计日志
curl http://localhost:3000/api/audit-log/{recordId}
```

## 审核操作说明

支持三种审核操作：

- **confirm**：确认差异，记录问题但不修改数据
- **adjust**：调整数据，允许修改原始记录并记录变更历史
- **dismiss**：忽略差异，标记为无需处理

## 技术栈

- Node.js + TypeScript
- Express.js (Web框架)
- CSV Parser (CSV解析)
- SheetJS/xlsx (Excel导出)
- Moment.js (日期处理)
- UUID (唯一ID生成)

## 数据安全

- 所有操作均有审计日志记录
- 支持完整的数据追溯链路
- 修改操作记录新旧值对比
- 支持从原始记录到最终报告的全程追踪

## 扩展说明

当前版本使用内存存储，生产环境建议：

1. 接入数据库（PostgreSQL/MySQL）
2. 添加用户认证和权限管理
3. 实现定时对账任务
4. 添加消息通知功能
5. 接入真实的交通违章API
