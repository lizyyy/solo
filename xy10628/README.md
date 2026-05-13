# 充电桩订单报修退款系统

一个完整的充电桩管理系统，包含设备监控、订单管理、远程维护、工单处理、退款审核等功能。

## 项目结构

```
.
├── backend/           # 后端服务
│   ├── src/
│   │   ├── server.js     # 主服务器
│   │   ├── database.js   # 数据库操作
│   │   ├── sampleData.js # 样例数据
│   │   └── routes/       # API路由
│   ├── data/             # SQLite数据库文件
│   └── package.json
├── frontend/          # 前端应用
│   └── public/
│       ├── index.html    # 主页面
│       └── app.js        # 前端逻辑
└── package.json
```

## 核心功能

### 1. 设备心跳监控
- 实时监控设备在线状态
- 记录电压、电流、温度等参数
- **保留修改前后值**：更新时自动记录 previous_status

### 2. 充电订单管理
- 订单状态追踪（充电中、已完成）
- 支付状态管理（已支付、支付失败）
- **保留修改前后值**：记录 previous_status 和 previous_amount

### 3. 远程重启
- 发起设备远程重启请求
- 记录操作人、重启原因
- **保留修改前后值**：状态变更历史

### 4. 维修工单
- 工单创建、分配、处理
- 优先级管理（高、中、低）
- 支持按责任人筛选

### 5. 扣费失败处理
- 失败记录追踪
- 重试机制
- 失败原因记录

### 6. 退款进度管理
- **幂等性控制**：使用 idempotency_key 防止重复退款
- 退款审核流程
- 复核人记录

### 7. 操作日志
- 全模块操作记录
- 操作人、动作、详情追踪
- 支持按模块筛选

### 8. 复核面板
- 待复核工单列表
- 待退款审核列表
- 统一审核处理

### 9. 报表导出
- **支持按责任人筛选**：assignee 参数
- **支持按时间范围筛选**：start_date / end_date
- 导出 CSV 格式
- 包含工单、订单、退款关联数据

## 四种业务路径展示

### ✅ 正常路径
充电正常 → 支付成功 → 订单完成
- 示例数据：ORD202401001（已完成）

### ❌ 拦截路径
支付失败 → 扣费失败记录 → 重试/拦截
- 示例数据：ORD202401002（支付失败）、扣费失败记录

### ⚠️ 复核路径
工单创建 → 分配处理 → 复核退款
- 示例数据：TK202401003（待复核）

### 📊 导出路径
筛选条件 → 生成报表 → CSV导出
- 支持按责任人、时间范围筛选

## 启动方式

### 方式一：分别启动
```bash
# 后端 (端口 3001)
cd backend
npm install
npm start

# 前端 (端口 3000 或自动分配)
cd frontend
npm install
npm run dev
```

### 方式二：根目录统一启动
```bash
npm run install-all  # 安装所有依赖
npm run dev          # 同时启动前后端
```

## API 接口

### 设备心跳
- `GET /api/heartbeats` - 获取心跳列表
- `GET /api/heartbeats/:id` - 获取单条心跳
- `POST /api/heartbeats` - 创建心跳记录
- `PUT /api/heartbeats/:id` - 更新心跳（保留历史值）

### 充电订单
- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id` - 更新订单（保留历史值）

### 远程重启
- `GET /api/restarts` - 获取重启记录
- `POST /api/restarts` - 发起重启
- `PUT /api/restarts/:id` - 更新重启状态（保留历史值）

### 维修工单
- `GET /api/tickets` - 获取工单列表
- `POST /api/tickets` - 创建工单
- `PUT /api/tickets/:id` - 更新工单状态

### 扣费失败
- `GET /api/payment-failures` - 获取失败记录
- `POST /api/payment-failures` - 记录失败
- `PUT /api/payment-failures/:id/retry` - 重试支付

### 退款进度
- `GET /api/refunds` - 获取退款列表
- `POST /api/refunds` - 申请退款（支持幂等键）
- `PUT /api/refunds/:id/review` - 审核退款

### 操作日志
- `GET /api/logs` - 获取操作日志（支持 module、operator 筛选）

### 报表导出
- `GET /api/reports/export` - 导出 CSV 报表
  - 参数：`assignee`（责任人）、`start_date`、`end_date`
- `GET /api/reports/statistics` - 获取统计数据

## 数据持久化

使用 SQLite 数据库，数据文件存储在 `backend/data/database.db`
- 服务重启后数据保留
- 首次启动自动初始化样例数据

## 幂等性说明

退款接口支持幂等性：
```javascript
// 使用相同 idempotency_key 多次提交，只会创建一条记录
POST /api/refunds
{
  "refund_no": "RF001",
  "order_id": "...",
  "amount": 100,
  "idempotency_key": "unique_key_123"  // 关键！
}
```
