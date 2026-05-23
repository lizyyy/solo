# 维修工单备件预占 API 服务

本服务用于解决售后工程师接单后发现备件被他人领走的问题，通过备件预占机制确保工单分配时备件可用。

## 功能特性

- ✅ 备件预占：工单分配时自动预占所需备件，4小时有效期
- ✅ 超时释放：自动释放超时未使用的预占记录
- ✅ 工单改派：改派工单时自动释放原预占，新工程师可重新预占
- ✅ 重复扣减拦截：防止同一工单重复预占同一备件
- ✅ 履约报告：工单完成时自动扣减库存并生成履约记录
- ✅ 异常日志：所有异常路径保存原始输入和处理结论
- ✅ 数据导出：支持CSV格式导出预占记录
- ✅ 人工修正：支持对异常预占记录进行人工修正

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（包含样例数据）

```bash
npm run init-db
```

此命令会创建以下样例数据：
- 4名工程师（张工、李工、王工、赵工）
- 6种备件（空调压缩机、遥控器、洗衣机电机等）
- 3条维修工单
- 工程师排班数据
- 预占释放原因配置

### 3. 启动服务

```bash
npm start
```

服务启动后访问：`http://localhost:3000/api/health`

## API 接口示例

### 1. 创建工单

```bash
curl -X POST http://localhost:3000/api/workorders \
  -H "Content-Type: application/json" \
  -d '{
    "workorderNo": "WO20240520001",
    "customerName": "张三",
    "customerPhone": "13800138000",
    "address": "北京市朝阳区XX小区",
    "productModel": "格力KFR-35GW",
    "faultDescription": "空调不制冷"
  }'
```

### 2. 备件预占（核心功能）

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "workorderId": 2,
    "engineerId": 1,
    "parts": [
      { "partId": 1, "quantity": 1 },
      { "partId": 2, "quantity": 2 }
    ]
  }'
```

### 3. 查询预占记录

```bash
# 查询所有预占记录
curl http://localhost:3000/api/reservations

# 按工单查询
curl "http://localhost:3000/api/reservations?workorderId=1"

# 按状态查询
curl "http://localhost:3000/api/reservations?status=已预占"
```

### 4. 查询工单列表

```bash
# 查询所有工单
curl http://localhost:3000/api/workorders

# 查询待分配工单
curl "http://localhost:3000/api/workorders?status=待分配"

# 查询指定工程师的工单
curl "http://localhost:3000/api/workorders?engineerId=1"
```

### 5. 工单改派

```bash
curl -X PUT http://localhost:3000/api/workorders/1/reassign \
  -H "Content-Type: application/json" \
  -d '{
    "newEngineerId": 2
  }'
```

### 6. 工单履约完成

```bash
curl -X POST http://localhost:3000/api/workorders/1/fulfill \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": 1,
    "partsUsed": [
      { "partId": 1, "quantity": 1, "partName": "空调压缩机" }
    ],
    "actualStartTime": "2024-05-20T10:00:00.000Z",
    "actualEndTime": "2024-05-20T11:30:00.000Z",
    "status": "已完成",
    "remarks": "维修顺利，客户满意"
  }'
```

### 7. 人工修正预占记录

```bash
curl -X PUT http://localhost:3000/api/reservations/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "status": "已人工释放"
  }'
```

### 8. 释放超时预占

```bash
curl -X POST http://localhost:3000/api/reservations/release-expired
```

### 9. 查询备件库存（含已预占数量）

```bash
# 查询所有备件
curl http://localhost:3000/api/spare-parts

# 查询低库存备件
curl "http://localhost:3000/api/spare-parts?lowStock=true"

# 按类别查询
curl "http://localhost:3000/api/spare-parts?category=空调配件"
```

### 10. 查询工程师列表及排班

```bash
# 查询工程师列表
curl http://localhost:3000/api/engineers

# 查询指定工程师排班
curl "http://localhost:3000/api/engineers/1/schedule?date=2024-05-20"
```

### 11. 查询履约摘要

```bash
curl http://localhost:3000/api/fulfillment-summaries
```

### 12. 导出预占记录（CSV）

```bash
curl -o reservations.csv http://localhost:3000/api/export/reservations
```

### 13. 查询异常日志

```bash
curl http://localhost:3000/api/exception-logs
```

## 异常路径测试（坏数据）

### 1. 重复预占同一备件（会被拦截）

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "workorderId": 1,
    "engineerId": 1,
    "parts": [
      { "partId": 1, "quantity": 1 }
    ]
  }'
```

### 2. 预占库存不足的备件

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "workorderId": 2,
    "engineerId": 1,
    "parts": [
      { "partId": 1, "quantity": 999 }
    ]
  }'
```

### 3. 预占不存在的备件

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "workorderId": 2,
    "engineerId": 1,
    "parts": [
      { "partId": 9999, "quantity": 1 }
    ]
  }'
```

### 4. 缺少必填参数

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "workorderId": 2
  }'
```

## 核心业务规则

1. **预占有效期**：4小时，超时自动释放
2. **库存计算**：可用库存 = 实际库存 - 已预占数量
3. **改派释放**：工单改派时自动释放原工程师的预占
4. **履约扣减**：工单完成时从实际库存中扣减预占数量
5. **异常记录**：所有API错误都会记录请求体、错误信息和处理结果

## 数据模型

### 主要数据表

1. **repair_workorders** - 维修工单表
2. **spare_parts** - 备件库存表
3. **engineers** - 工程师表
4. **engineer_schedules** - 工程师排班表
5. **reservation_records** - 预占记录表
6. **release_reasons** - 释放原因表
7. **fulfillment_summaries** - 履约摘要表
8. **exception_logs** - 异常日志表

## 项目结构

```
.
├── package.json
├── README.md
├── data/                  # SQLite数据库文件目录
└── src/
    ├── server.js         # 服务入口
    ├── config/
    │   └── database.js   # 数据库配置
    ├── routes/
    │   └── reservationRoutes.js  # API路由
    ├── services/
    │   └── reservationService.js # 业务逻辑
    ├── middleware/
    │   └── errorHandler.js       # 异常处理中间件
    └── scripts/
        └── initDB.js     # 数据库初始化脚本
```

## 技术栈

- Node.js + Express.js
- SQLite3（本地持久化）
- moment.js（日期处理）
- json2csv（数据导出）