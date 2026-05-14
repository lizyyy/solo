# 接口限流配额账本系统

一个完整的全栈API配额管理系统，提供限流、突增检测、复核流程、计费明细等功能。

## 功能特性

### 核心状态机
- ✅ **调用计数** - 实时配额消耗追踪
- ✅ **突增检测** - 基于时间窗口的流量突增识别
- ✅ **幂等处理** - 支持幂等接口防重复调用
- ✅ **重试限制** - 可配置的最大重试次数

### 状态区分
- ✅ **成功 (success)** - 正常调用计入配额
- ⏳ **待复核 (pending_review)** - 触发突增或超额，需人工审核
- 🚫 **已拦截 (blocked)** - 复核拒绝或超限拦截
- 🔄 **可重试 (retryable)** - 临时错误可重试

### 复核流程
- ✅ **通过** - 计入配额并标记已复核
- ✅ **拒绝** - 不计入配额并标记已拦截
- ✅ **修正** - 特殊情况处理，计入配额并记录修正原因供审计

### 管理面板
- 📊 **仪表盘** - 统计卡片 + 趋势图表
- 📈 **统计分析** - 多维度数据分析 + 饼图/柱状图
- 👥 **客户管理** - 客户信息 + 套餐分配
- 📦 **套餐管理** - 配额配置 + 突增阈值
- 🎯 **接口管理** - API路径 + 成本配置 + 重新计算
- 📋 **调用记录** - 完整调用日志 + 筛选查询
- ✅ **复核管理** - 待处理列表 + 审核操作
- 💰 **计费明细** - 按客户/时间段导出CSV

## 技术栈

### 后端
- **框架**: Node.js + Express
- **数据库**: SQLite (可扩展至MySQL/PostgreSQL)
- **ORM**: Sequelize
- **特性**: 事务处理、幂等、JSON序列化

### 前端
- **框架**: React 18
- **UI组件**: Ant Design 5
- **图表**: Recharts
- **路由**: React Router v6
- **HTTP客户端**: Axios

## 快速开始

### 环境要求
- Node.js >= 16.x
- npm 或 yarn

### 后端启动

```bash
cd backend

# 安装依赖
npm install

# 启动服务 (端口3001)
npm start
# 或
node app.js
```

后端启动后会自动:
- 创建数据库表结构
- 初始化演示数据
  - 演示客户 (API Key: demo-api-key-12345)
  - 3种套餐 (基础版/专业版/企业版)
  - 多个示例API端点

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口3000)
npm start
```

访问 http://localhost:3000 即可进入管理面板。

## API文档

### 核心接口

#### 处理API调用
```http
POST /api/quota/call
Content-Type: application/json

{
  "apiKey": "demo-api-key-12345",
  "path": "/api/v1/users",
  "method": "GET",
  "idempotencyKey": "optional-unique-key"
}
```

响应示例:
```json
{
  "success": true,
  "status": "success",
  "requestId": "uuid-xxx",
  "message": "Call processed successfully",
  "remainingQuota": 99850
}
```

#### 复核调用记录
```http
POST /api/quota/review
Content-Type: application/json

{
  "callRecordId": 1,
  "action": "approve|reject|correct",
  "reason": "复核原因说明",
  "reviewer": "admin"
}
```

#### 重新计算记录 (接口路径变更)
```http
POST /api/quota/recalculate
Content-Type: application/json

{
  "oldPath": "/api/v1/old-path",
  "newPath": "/api/v1/new-path",
  "method": "GET"
}
```

#### 获取统计数据
```http
GET /api/quota/statistics?customerId=1&startDate=2024-01-01&endDate=2024-12-31
```

#### 导出计费明细
```http
GET /api/quota/billing/export?customerId=1&startDate=...&endDate=...&format=json|csv
```

### 管理接口

- `GET /api/quota/customers` - 获取客户列表
- `POST /api/quota/customers` - 创建客户
- `GET /api/quota/packages` - 获取套餐列表
- `POST /api/quota/packages` - 创建套餐
- `GET /api/quota/endpoints` - 获取接口列表
- `POST /api/quota/endpoints` - 创建接口
- `GET /api/quota/calls` - 查询调用记录
- `GET /api/quota/calls/:id` - 获取调用详情
- `GET /api/quota/reviews` - 获取复核记录
- `GET /api/quota/trend/daily` - 获取每日趋势数据

## 数据模型

### Customer (客户)
- id, name, email, apiKey, status, createdAt

### Package (套餐)
- id, name, description, monthlyQuota, burstThreshold, burstWindowMinutes, maxRetries, pricePerCall, status

### ApiEndpoint (接口)
- id, path, method, description, costPerCall, isIdempotent, status

### CallRecord (调用记录)
- id, CustomerId, ApiEndpointId, requestId, idempotencyKey, status, retryCount, burstDetected, overQuota, cost, responseTime, errorMessage, reviewed, corrected, correctionReason, createdAt

### ReviewRecord (复核记录)
- id, CallRecordId, CustomerId, reviewer, action, reason, previousStatus, newStatus, createdAt

### CustomerPackage (客户套餐关联)
- id, CustomerId, PackageId, startDate, endDate, usedQuota, overQuota, status

## 配置说明

### 套餐配置示例
- **月度配额**: 100000次
- **突增阈值**: 200次/5分钟
- **最大重试**: 5次
- **单价**: ¥0.005/次

### 突增检测逻辑
- 时间窗口: 可配置 (默认5分钟)
- 阈值触发: 窗口内调用数 >= 阈值
- 处理动作: 调用标记为pending_review，需人工复核

## 开发说明

### 后端目录结构
```
backend/
├── app.js              # 入口文件
├── config/
│   └── database.js     # 数据库配置
├── models/             # 数据模型
├── controllers/        # 控制器
├── routes/             # 路由
└── services/           # 业务逻辑 (QuotaService)
```

### 前端目录结构
```
frontend/
├── src/
│   ├── App.js          # 主应用
│   ├── index.js        # 入口
│   ├── services/       # API服务
│   └── pages/          # 页面组件
```

## 测试API调用

使用curl测试:

```bash
# 测试正常调用
curl -X POST http://localhost:3001/api/quota/call \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"demo-api-key-12345","path":"/api/v1/users","method":"GET"}'

# 批量调用触发突增 (执行多次)
for i in {1..210}; do
  curl -X POST http://localhost:3001/api/quota/call \
    -H "Content-Type: application/json" \
    -d '{"apiKey":"demo-api-key-12345","path":"/api/v1/users","method":"GET"}'
done
```

## 注意事项

1. **接口路径变更**: 使用recalculate接口重新计算历史记录配额
2. **幂等性**: 仅对标记为isIdempotent的接口生效，需传入idempotencyKey
3. **事务处理**: 所有配额操作在数据库事务中执行，确保数据一致性
4. **审计追踪**: 所有复核操作均记录ReviewRecord，可追溯操作人、时间、原因
