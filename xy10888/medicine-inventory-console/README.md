# 药品库存接口台

一个专注于药房库存管理的全栈Web应用，解决HIS、仓库和配送系统之间的数据同步和差异问题。

## 功能特性

### 核心业务规则

- **多源同步**: 支持HIS系统、WMS仓库系统、配送系统等多源库存数据接入，提供同步执行接口和日志
- **批号管理**: 按药品批号精细化管理，支持批号占用和释放的完整闭环
- **临期拦截**: 自动识别临期药品，临界期禁止出库占用
- **配送对账**: 配送单确认时自动核对数量差异
- **差异处理**: 自动生成差异单，支持人工复核和处理

### 后端接口

- 创建接口: 药品、来源系统、库存批次、配送单
- 查询接口: 统计概览、列表查询、详情查询
- 状态推进: 批号占用/释放、配送确认、差异处理
- 同步接口: 多源同步执行、同步日志查询
- 异常处理: 参数校验、重复调用、错误返回
- 数据导出: CSV格式导出库存数据

### 前端功能

- 总览看板: 库存统计、临期预警、待办事项
- 库存批次: 列表查看、详情、占用操作、占用记录释放
- 配送管理: 创建配送单、确认收货
- 差异处理: 差异单列表、详情、处理操作
- 多源同步: 同步执行界面、同步日志查看

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- Joi 参数校验
- UUID 主键生成
- Moment.js 日期处理

### 前端
- React 18
- React Router 6
- Axios HTTP客户端
- Vite 构建工具

## 本地运行说明

### 前置要求
- Node.js >= 16
- npm 或 yarn

### 后端启动

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 导入测试数据（可选）
npm run seed-data

# 启动服务（端口 3001）
npm start

# 开发模式
npm run dev
```

### 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器（端口 3000）
npm run dev
```

### 访问地址
- 前端应用: http://localhost:3000
- 后端API: http://localhost:3001
- 健康检查: http://localhost:3001/api/health

## API 接口示例

### 基础信息

```bash
# 健康检查
curl http://localhost:3001/api/health

# 获取统计概览
curl http://localhost:3001/api/inventory/statistics
```

### 药品管理

```bash
# 获取药品列表
curl http://localhost:3001/api/inventory/medicines

# 创建药品
curl -X POST http://localhost:3001/api/inventory/medicines \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MED006",
    "name": "感冒灵颗粒",
    "specification": "10g*9袋",
    "manufacturer": "三九医药",
    "unit": "盒"
  }'
```

### 库存批次

```bash
# 获取批次列表
curl http://localhost:3001/api/inventory/batches

# 获取单个批次
curl http://localhost:3001/api/inventory/batches/{batch_id}

# 占用库存
curl -X POST http://localhost:3001/api/inventory/batches/occupy \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "xxx",
    "quantity": 10,
    "operator": "张三",
    "reason": "门诊发药"
  }'

# 导出库存
curl http://localhost:3001/api/inventory/export/batches -o inventory.csv

# 释放占用（完整闭环）
curl -X POST http://localhost:3001/api/inventory/occupancies/{occupancy_id}/release \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "管理员",
    "reason": "处方取消，释放库存"
  }'
```

### 多源同步

```bash
# 执行全量同步
curl -X POST http://localhost:3001/api/inventory/sync/execute \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "xxx",
    "sync_type": "full",
    "operator": "系统管理员"
  }'

# 执行增量同步
curl -X POST http://localhost:3001/api/inventory/sync/execute \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "xxx",
    "sync_type": "incremental",
    "operator": "系统管理员"
  }'

# 查询同步日志
curl http://localhost:3001/api/inventory/sync/logs

# 查看单个同步记录
curl http://localhost:3001/api/inventory/sync/logs/{sync_log_id}
```

### 配送管理

```bash
# 获取配送单列表
curl http://localhost:3001/api/inventory/deliveries

# 创建配送单
curl -X POST http://localhost:3001/api/inventory/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "xxx",
    "total_quantity": 100
  }'

# 确认配送收货
curl -X POST http://localhost:3001/api/inventory/deliveries/{delivery_id}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李四",
    "items": [
      {
        "medicine_id": "xxx",
        "batch_no": "B2024001",
        "planned_quantity": 50,
        "actual_quantity": 45,
        "expiry_date": "2025-01-01"
      }
    ]
  }'
```

### 差异处理

```bash
# 获取差异单列表
curl http://localhost:3001/api/inventory/discrepancies

# 处理差异单
curl -X POST http://localhost:3001/api/inventory/discrepancies/{discrepancy_id}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolver": "王五",
    "resolution": "供应商补发",
    "remarks": "已联系供应商，3日内补发"
  }'
```

## 故意失败的路径演示

### 1. 占用临期药品（临界期拦截）

```bash
# 选择一个15天内过期的批次（测试数据中B2024001、B2024004）
curl -X POST http://localhost:3001/api/inventory/batches/occupy \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "{critical_batch_id}",
    "quantity": 10,
    "operator": "测试人员",
    "reason": "测试"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "该药品已临期，剩余有效期: 15天，禁止占用" }
```

**业务规则说明**: 根据临期规则，剩余有效期小于等于critical_days（默认30天）的药品禁止占用。

### 2. 库存不足

```bash
# 占用数量超过可用库存
curl -X POST http://localhost:3001/api/inventory/batches/occupy \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "{batch_id}",
    "quantity": 99999,
    "operator": "测试人员"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "库存不足，可用数量: xxx" }
```

### 3. 参数校验失败

```bash
# 缺少必填字段
curl -X POST http://localhost:3001/api/inventory/medicines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试药品"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "参数验证失败", "details": [...] }
```

### 4. 重复处理差异单

```bash
# 对已处理的差异单再次调用处理接口
curl -X POST http://localhost:3001/api/inventory/discrepancies/{resolved_id}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolver": "测试",
    "resolution": "再次处理"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "差异单已处理" }
```

### 5. 确认已完成的配送单

```bash
# 对已完成的配送单再次确认
curl -X POST http://localhost:3001/api/inventory/deliveries/{completed_id}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "测试",
    "items": []
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "配送单状态不正确" }
```

### 6. 重复释放已释放的占用记录

```bash
# 对已释放的占用记录再次调用释放接口
curl -X POST http://localhost:3001/api/inventory/occupancies/{released_id}/release \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "测试"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "占用记录状态不正确，当前状态: released" }
```

### 7. 同步已停用的来源系统

```bash
# 先停用一个来源系统，然后调用同步接口
curl -X POST http://localhost:3001/api/inventory/sync/execute \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "{disabled_source_id}",
    "sync_type": "full",
    "operator": "测试"
  }'

# 返回: 400 Bad Request
# { "success": false, "error": "来源系统已停用" }
```

## 数据库设计

核心表结构：

- `medicines`: 药品基础信息
- `inventory_sources`: 库存来源系统
- `inventory_batches`: 库存批次（核心）
- `occupancy_records`: 占用记录
- `expiry_rules`: 临期规则
- `delivery_receipts`: 配送回执
- `delivery_items`: 配送明细
- `discrepancy_orders`: 差异单
- `sync_logs`: 同步日志
- `audit_logs`: 审计日志

## 项目结构

```
medicine-inventory-console/
├── backend/
│   ├── src/
│   │   ├── server.js          # 入口文件
│   │   ├── routes/
│   │   │   └── inventory.js   # API路由（占用释放、同步等新增接口）
│   │   ├── services/
│   │   │   └── inventoryService.js  # 业务逻辑（新增释放、同步）
│   │   ├── middleware/        # 中间件
│   │   └── utils/             # 工具函数
│   ├── scripts/               # 数据库脚本
│   ├── data/                  # SQLite数据库文件
│   ├── package.json
│   └── package-lock.json     # 锁定依赖版本
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # 入口文件
│   │   ├── App.jsx            # 主应用（新增同步路由）
│   │   ├── pages/             # 页面组件（BatchDetail新增释放、新增Sync页面）
│   │   └── services/          # API服务（新增释放、同步接口）
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```
