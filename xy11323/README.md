# 农机合作社计费系统

## 项目简介

这是一个为农机合作社财务内部使用的后端工具，支持拖拉机按小时、亩数和油费混合计费。系统支持从作业单 CSV、油耗表 JSON、费率表导入数据，自动分流正常记录和错误记录，并保留完整的修改建议和操作历史。

## 技术栈

- **Node.js + Express** - Web 框架
- **SQLite** - 本地数据库（数据持久化）
- **csv-parser + json2csv** - CSV 处理
- **multer** - 文件上传

## 项目结构

```
├── src/
│   ├── app.js                    # 主应用入口
│   ├── routes.js                 # 路由配置
│   ├── config/
│   │   └── database.js           # 数据库配置
│   ├── scripts/
│   │   └── initDb.js             # 数据库初始化脚本
│   ├── models/                   # 数据模型
│   │   ├── batchModel.js
│   │   ├── workOrderModel.js
│   │   ├── fuelRecordModel.js
│   │   ├── rateConfigModel.js
│   │   ├── errorRecordModel.js
│   │   └── operationLogModel.js
│   ├── services/                 # 业务逻辑
│   │   └── importService.js      # 导入服务
│   ├── controllers/              # 控制器
│   │   ├── importController.js
│   │   └── recordController.js
│   └── utils/                    # 工具函数
│       └── validators.js         # 数据验证器
├── samples/                      # 样例数据
│   ├── work_orders.csv           # 作业单样例（含错误）
│   ├── fuel_records.json         # 油耗表样例（含错误）
│   └── rate_configs.csv          # 费率表样例
├── data/                         # SQLite 数据库文件
├── uploads/                      # 上传文件临时目录
└── package.json
```

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 验证服务

访问健康检查接口：
```bash
curl http://localhost:3000/api/health
```

查看 API 文档：
```bash
curl http://localhost:3000/api/docs
```

## 核心功能

### 1. 数据导入

#### 导入作业单 (CSV)

```bash
curl -X POST -F "file=@samples/work_orders.csv" http://localhost:3000/api/import/work-orders
```

**注意：作业单 CSV 中的异常记录会自动进入错误记录表，正常记录进入作业单表**

#### 导入油耗表 (JSON)

```bash
curl -X POST -F "file=@samples/fuel_records.json" http://localhost:3000/api/import/fuel-records
```

#### 导入费率表 (CSV)

```bash
curl -X POST -F "file=@samples/rate_configs.csv" http://localhost:3000/api/import/rate-configs
```

### 2. 查询数据

#### 查看所有导入批次

```bash
curl http://localhost:3000/api/batches
```

#### 查看正常记录

```bash
# 查看所有作业单
curl http://localhost:3000/api/work-orders

# 按批次查看作业单
curl "http://localhost:3000/api/work-orders?batch_id=1"

# 查看油耗记录
curl http://localhost:3000/api/fuel-records

# 查看费率配置
curl http://localhost:3000/api/rate-configs
```

#### 查看错误记录（重点功能）

```bash
# 查看所有错误记录
curl http://localhost:3000/api/error-records

# 查看未修复的错误记录
curl "http://localhost:3000/api/error-records?unfixed=1"

# 按批次查看错误记录
curl "http://localhost:3000/api/error-records?batch_id=1"
```

每条错误记录包含：
- `row_number`: 原始行号
- `original_data`: 原始数据
- `error_message`: 错误原因
- `suggestion`: 修改建议

### 3. 复核与修复

#### 复核通过作业单

```bash
curl -X POST http://localhost:3000/api/work-orders/1/approve \
  -H "Content-Type: application/json" \
  -d '{"operator": "财务人员A"}'
```

#### 修改作业单

```bash
curl -X PUT http://localhost:3000/api/work-orders/1 \
  -H "Content-Type: application/json" \
  -d '{"total_amount": 1250.0, "operator": "财务人员A"}'
```

#### 修复错误记录并转为正常记录（重点功能）

```bash
curl -X POST http://localhost:3000/api/error-records/1/fix \
  -H "Content-Type: application/json" \
  -d '{
    "corrected_data": {
      "order_no": "WO003",
      "machine_no": "T-003",
      "operator_name": "王五",
      "work_date": "2024-05-02",
      "work_type": "收割",
      "hours": 7.5,
      "acres": 45.0,
      "fuel_cost": 180.0,
      "total_amount": 1350.0
    },
    "operator": "财务人员A"
  }'
```

### 4. 导出数据

```bash
curl -O -J http://localhost:3000/api/work-orders/export
```

### 5. 查看操作历史

```bash
curl http://localhost:3000/api/operation-logs
```

## 数据持久化说明

- 所有数据存储在 `data/database.db` SQLite 数据库文件中
- 重启服务后所有数据（包括批次、正常记录、错误记录、操作日志）都能正常访问
- 第二次运行可以查看到之前所有处理结果

## API 接口列表

### 导入接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/work-orders | 导入作业单 CSV |
| POST | /api/import/fuel-records | 导入油耗表 JSON |
| POST | /api/import/rate-configs | 导入费率表 CSV |

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/batches | 获取所有导入批次 |
| GET | /api/work-orders | 获取所有作业单（?batch_id=1 过滤） |
| GET | /api/fuel-records | 获取所有油耗记录 |
| GET | /api/rate-configs | 获取所有费率配置 |
| GET | /api/error-records | 获取错误记录（?unfixed=1 未修复） |
| GET | /api/operation-logs | 获取操作日志 |

### 复核和修改接口

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | /api/work-orders/:id | 修改作业单 |
| POST | /api/work-orders/:id/approve | 复核通过作业单 |
| POST | /api/error-records/:id/fix | 修复错误记录并转为正常记录 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/work-orders/export | 导出作业单为 CSV |

## 样例数据说明

### samples/work_orders.csv（7条记录，含5个错误）

| 行号 | 记录 | 问题 | 错误原因 |
|------|------|------|----------|
| 1 | WO001 | 正常 | - |
| 2 | WO002 | 正常 | - |
| 3 | (空单号) | order_no 为空 | 缺少作业单号 |
| 4 | WO004 | 日期格式为 2024/05/02 | 作业日期格式错误 |
| 5 | WO005 | work_type 为空 | 缺少作业类型 |
| 6 | WO006 | hours 为 "abc" | 作业小时数格式错误 |
| 7 | WO007 | acres 为空 | （不影响，允许亩数为空） |

### samples/fuel_records.json（5条记录，含3个错误）

| 记录 | 问题 | 错误原因 |
|------|------|----------|
| FUEL001 | 正常 | - |
| FUEL002 | 正常 | - |
| (第3条) | record_no 为空 | 缺少加油记录单号 |
| FUEL004 | fuel_type 为空 | 缺少油品类型 |
| FUEL005 | liters 为 -5.0 | 加油升数无效 |

## 完整测试流程

```bash
# 1. 安装依赖
npm install

# 2. 启动服务（新开终端）
npm start

# 3. 导入作业单（查看错误分流效果）
curl -X POST -F "file=@samples/work_orders.csv" http://localhost:3000/api/import/work-orders

# 4. 查看导入批次（确认 total/success/errors 数量）
curl http://localhost:3000/api/batches

# 5. 查看正常记录
curl http://localhost:3000/api/work-orders

# 6. 查看错误记录（重点！验证错误分流）
curl http://localhost:3000/api/error-records

# 7. 导入油耗表
curl -X POST -F "file=@samples/fuel_records.json" http://localhost:3000/api/import/fuel-records

# 8. 查看错误记录中的修改建议
curl "http://localhost:3000/api/error-records?unfixed=1"

# 9. 重启服务验证数据持久化
# 先停止服务(Ctrl+C)，再启动 npm start
# 重新查询数据，确认数据还在

# 10. 修复一条错误记录
curl -X POST http://localhost:3000/api/error-records/1/fix \
  -H "Content-Type: application/json" \
  -d '{
    "corrected_data": {
      "order_no": "WO003_CORRECTED",
      "machine_no": "T-003",
      "operator_name": "王五",
      "work_date": "2024-05-02",
      "work_type": "收割",
      "hours": 7.5,
      "acres": 45.0,
      "fuel_cost": 180.0,
      "total_amount": 1350.0
    },
    "operator": "财务人员A"
  }'

# 11. 查看操作历史
curl http://localhost:3000/api/operation-logs

# 12. 复核通过一条记录
curl -X POST http://localhost:3000/api/work-orders/1/approve \
  -H "Content-Type: application/json" \
  -d '{"operator": "财务人员A"}'
```

## 数据库表说明

1. **import_batches** - 导入批次表（记录每次导入的统计信息）
2. **work_orders** - 作业单表（正常记录）
3. **fuel_records** - 油耗记录表（正常记录）
4. **rate_configs** - 费率配置表
5. **error_records** - 错误记录表（坏数据分流到此，含原始位置、错误原因、修改建议）
6. **operation_logs** - 操作日志表（完整审计历史）

## 注意事项

- 数据库文件存储在 `data/database.db`，请勿随意删除
- 样例数据中故意包含了多种常见错误，用于测试错误处理逻辑
- 所有修改操作都会记录操作日志，包含操作人、修改前后数据对比
- 重启服务后所有历史数据都能正常访问