# 文印订单设备排队系统

一个完整的文印订单设备排队管理系统，包含前后端，支持订单管理、筛选、导出、批量导入以及完整的业务规则和演示路径。

## 系统特性

- ✅ 订单管理（创建、查询、详情查看）
- ✅ 多维度筛选（状态、设备队列、纸张规格、订单号）
- ✅ 批量导入订单
- ✅ CSV格式导出订单
- ✅ 操作时间线（重启后数据持久化）
- ✅ 业务规则：装订方式变更、设备队列异常、取件承诺复核、重复操作幂等、失败原因记录
- ✅ 四条内置演示路径：成功、拦截、人工修正、重复提交

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库（文件型数据库，重启后数据不丢失）
- RESTful API 设计

### 前端
- React 18 + Vite
- Ant Design 5 组件库
- Axios HTTP 客户端

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 `http://localhost:3001` 启动

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

### 3. 访问系统

打开浏览器访问：`http://localhost:3000`

## 演示数据生成（造数）

系统提供四种演示路径，可以通过以下方式生成：

### 方式一：前端界面操作
1. 点击页面顶部的「演示路径」按钮
2. 选择对应的演示路径：
   - **成功路径**：创建订单 → 开始处理 → 处理成功
   - **拦截路径**：创建订单 → 开始处理 → 触发内容审核拦截
   - **人工修正路径**：创建订单 → 开始处理 → 触发人工调整
   - **重复提交路径**：演示使用相同幂等键提交订单，只创建一次

### 方式二：API 调用

```bash
# 运行所有演示路径
curl -X POST http://localhost:3001/api/orders/demo/all

# 单独运行某条路径
curl -X POST http://localhost:3001/api/orders/demo/success
curl -X POST http://localhost:3001/api/orders/demo/blocked
curl -X POST http://localhost:3001/api/orders/demo/manual-correction
curl -X POST http://localhost:3001/api/orders/demo/duplicate
```

## API 接口文档

### 基础信息
- Base URL: `http://localhost:3001/api`
- Content-Type: `application/json`

### 1. 健康检查

```http
GET /health

Response:
{
  "status": "ok",
  "message": "文印订单设备排队系统运行正常"
}
```

### 2. 获取常量配置

```http
GET /orders/constants

Response:
{
  "paper_sizes": ["A3", "A4", "A5", "B5"],
  "binding_types": ["无线胶装", "骑马钉", "环装", "精装"],
  "device_queues": ["HP-M1", "HP-M2", "Canon-C1", "Canon-C2", "Xerox-X1"],
  "statuses": ["pending", "processing", "success", "blocked", "manual_correction", "failed", "completed"]
}
```

### 3. 获取订单列表

```http
GET /orders

Query Parameters:
- status: 状态（可选）
- device_queue: 设备队列（可选）
- paper_size: 纸张规格（可选）
- binding_type: 装订方式（可选）
- order_no: 订单号（模糊搜索，可选）

Response:
[
  {
    "id": "uuid",
    "order_no": "PO20240115120000001",
    "file_name": "年度报告.pdf",
    "page_count": 45,
    "paper_size": "A4",
    "binding_type": "无线胶装",
    "device_queue": "HP-M1",
    "pickup_promise": "2024-01-15 18:00:00",
    "status": "success",
    "rework_reason": null,
    "created_at": "2024-01-15T12:00:00.000Z",
    "updated_at": "2024-01-15T12:05:00.000Z"
  }
]
```

### 4. 创建订单

```http
POST /orders

Headers:
- X-Idempotency-Key: 幂等键（可选，用于防止重复提交）

Body:
{
  "file_name": "年度报告.pdf",
  "page_count": 45,
  "paper_size": "A4",
  "binding_type": "无线胶装",
  "device_queue": "HP-M1",
  "pickup_promise": "2024-01-15 18:00:00"
}

Response:
{
  "order": { ...订单对象... },
  "isDuplicate": false  // 如果是重复提交则为 true
}
```

### 5. 获取订单详情

```http
GET /orders/:id

Response:
{
  "id": "uuid",
  "order_no": "PO20240115120000001",
  ... 其他订单字段 ...
}
```

### 6. 获取订单时间线

```http
GET /orders/:id/timeline

Response:
[
  {
    "id": 1,
    "order_id": "uuid",
    "action": "CREATE",
    "status": "pending",
    "description": "订单创建成功",
    "operator": "system",
    "created_at": "2024-01-15T12:00:00.000Z"
  }
]
```

### 7. 更新订单状态

```http
PUT /orders/:id/status

Body:
{
  "status": "processing",
  "reason": "开始打印",
  "operator": "admin"
}

Response:
{
  ... 最新的订单对象 ...
}
```

### 8. 变更装订方式

```http
PUT /orders/:id/binding

Body:
{
  "binding_type": "精装",
  "operator": "admin"
}

Response:
{
  ... 最新的订单对象 ...
}
```

### 9. 变更设备队列

```http
PUT /orders/:id/device-queue

Body:
{
  "device_queue": "Canon-C2",
  "reason": "HP-M1 设备故障",
  "operator": "admin"
}

Response:
{
  ... 最新的订单对象 ...
}
```

### 10. 复核取件承诺时间

```http
PUT /orders/:id/pickup-promise

Body:
{
  "pickup_promise": "2024-01-15 20:00:00",
  "operator": "admin"
}

Response:
{
  ... 最新的订单对象 ...
}
```

### 11. 批量导入订单

```http
POST /orders/bulk-import

Body:
{
  "orders": [
    {
      "file_name": "文件1.pdf",
      "page_count": 20,
      "paper_size": "A4",
      "binding_type": "骑马钉",
      "device_queue": "HP-M1",
      "pickup_promise": "2024-01-15 17:00:00"
    },
    {
      "file_name": "文件2.pdf",
      "page_count": 30,
      "paper_size": "A3",
      "binding_type": "环装",
      "device_queue": "Canon-C1",
      "pickup_promise": "2024-01-15 18:00:00"
    }
  ],
  "operator": "admin"
}

Response:
{
  "success": [ ...成功的订单列表... ],
  "failed": [
    {
      "data": { ...失败的订单数据... },
      "error": "错误原因"
    }
  ],
  "total": 2
}
```

### 12. 导出订单 CSV

```http
GET /orders/export/csv

Query Parameters:
- 与订单列表筛选参数相同

Response:
- CSV 文件下载
- 包含 BOM 头，支持 Excel 正确显示中文
```

## 报告查看

### 订单列表报告

1. 在前端页面可以查看所有订单
2. 使用筛选条件过滤需要的订单
3. 点击「导出CSV」按钮下载完整的订单报告

### 时间线报告

1. 点击订单列表中的「详情」按钮
2. 查看订单的完整操作时间线
3. 包括：操作类型、状态变更、描述、操作人、操作时间

### 状态说明

| 状态 | 中文说明 | 颜色标识 |
|------|----------|----------|
| pending | 待处理 | 灰色 |
| processing | 处理中 | 蓝色 |
| success | 成功 | 绿色 |
| blocked | 已拦截 | 红色 |
| manual_correction | 人工修正 | 橙色 |
| failed | 失败 | 红色 |
| completed | 已完成 | 紫色 |

## 业务规则说明

### 1. 装订方式变更
- 支持在订单处理过程中变更装订方式
- 变更记录会保存在时间线中
- 记录变更前后的装订方式和操作人

### 2. 设备队列异常处理
- 支持变更设备队列
- 必须提供变更原因
- 变更记录保存到时间线

### 3. 取件承诺复核
- 支持调整取件承诺时间
- 复核记录保存到时间线
- 支持查看历史变更记录

### 4. 重复操作幂等性
- 创建订单时支持传递 `X-Idempotency-Key` 请求头
- 使用相同幂等键多次提交，只会创建一个订单
- 重复提交会返回已创建的订单，`isDuplicate` 字段为 true

### 5. 失败原因记录
- 订单状态变更为 `failed` 时，可以记录失败原因
- 失败原因会保存在订单的 `rework_reason` 字段
- 时间线中也会记录失败原因

## 数据库结构

### orders 表
- id: UUID 主键
- order_no: 订单号（唯一）
- file_name: 文件名
- page_count: 页数
- paper_size: 纸张规格
- binding_type: 装订方式
- device_queue: 设备队列
- pickup_promise: 取件承诺时间
- status: 状态
- rework_reason: 返工/失败原因
- created_at: 创建时间
- updated_at: 更新时间

### timeline 表
- id: 自增主键
- order_id: 订单ID（外键）
- action: 操作类型
- status: 订单状态
- description: 操作描述
- operator: 操作人
- created_at: 操作时间

### idempotency_keys 表
- key: 幂等键（主键）
- order_id: 关联的订单ID
- created_at: 创建时间

## 项目目录结构

```
xy10670/
├── backend/
│   ├── server.js          # 后端入口文件
│   ├── database.js        # 数据库初始化
│   ├── routes/
│   │   └── orders.js      # 订单路由
│   ├── services/
│   │   ├── orderService.js    # 订单业务逻辑
│   │   ├── demoService.js     # 演示路径服务
│   │   └── exportService.js   # 导出服务
│   ├── package.json
│   └── print_queue.db    # SQLite 数据库文件（运行后生成）
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   ├── main.jsx       # 入口文件
│   │   └── index.css      # 样式文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 注意事项

1. **数据持久化**：使用 SQLite 文件型数据库，重启服务后数据不会丢失
2. **幂等性**：重要操作建议使用幂等键，防止重复提交
3. **时间线**：所有状态变更和关键操作都会记录时间线，便于追溯
4. **导出编码**：CSV 导出包含 UTF-8 BOM，确保 Excel 正确显示中文

## 常见问题

### Q: 如何重置所有数据？
A: 删除 `backend/print_queue.db` 文件，重启后端服务即可

### Q: 如何添加新的设备队列？
A: 编辑 `backend/services/orderService.js` 中的 `DEVICE_QUEUES` 常量

### Q: 前端请求跨域怎么办？
A: Vite 已配置代理，`/api` 请求会自动转发到后端，无需额外配置
