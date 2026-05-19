# Mock 合约回放器

一个用于接口联调环境不稳定时，按真实接口合约回放各种响应的全栈 Web 应用。

## 功能特性

- **合约管理**: 定义接口路径、方法及描述
- **响应场景**: 为同一合约配置多个不同的响应场景
- **请求匹配**: 基于 Header、Query、Body、Path 进行场景匹配
- **延迟注入**: 配置固定或随机延迟，模拟网络情况
- **异常模板**: 预定义各种异常情况响应
- **回放审计**: 记录所有回放请求，支持人工补偿
- **可视化控制台**: 运营和研发共同使用的管理界面

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite + TypeORM
- Joi 参数校验

### 前端
- React 18
- React Router
- Ant Design
- Axios
- Day.js

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 初始化数据

```bash
cd backend
npm run seed
```

这将创建以下样例数据：

**合约**:
- 获取用户信息 (GET /api/user)
- 创建订单 (POST /api/order)
- 支付接口 (POST /api/payment)

**场景**:
- 成功响应、未授权、重复提交、余额不足、超时等 8 种场景

**异常模板**:
- 系统维护中 (503)
- 限流触发 (429)
- 数据库错误 (500)

### 3. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 4. 启动前端服务

```bash
cd frontend
npm start
```

前端服务将在 http://localhost:3000 启动

## API 接口文档

### 回放接口

请求任意路径，系统会按合约配置返回对应响应：

```
GET /api/replay/{path}
POST /api/replay/{path}
PUT /api/replay/{path}
DELETE /api/replay/{path}
```

### 管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/contracts | 获取合约列表 |
| POST | /api/contracts | 创建合约 |
| PUT | /api/contracts/:id | 更新合约 |
| DELETE | /api/contracts/:id | 删除合约 |
| POST | /api/contracts/import | 批量导入合约 |
| GET | /api/scenes | 获取场景列表 |
| POST | /api/scenes | 创建场景 |
| PATCH | /api/scenes/:id/toggle | 切换场景启用状态 |
| PATCH | /api/scenes/:id/set-default | 设为默认场景 |
| GET | /api/history | 获取回放历史 |
| GET | /api/history/statistics | 获取统计数据 |
| POST | /api/history/:id/compensate | 人工补偿单条记录 |
| POST | /api/history/batch-compensate | 批量人工补偿 |
| GET | /api/history/export | 导出历史数据 |
| GET | /api/exceptions | 获取异常模板 |
| POST | /api/exceptions | 创建异常模板 |

## 使用示例

### 测试成功场景

```bash
curl http://localhost:3001/api/replay/api/user
```

响应：
```json
{
  "success": true,
  "data": {
    "id": 1001,
    "username": "test_user",
    "email": "user@example.com"
  }
}
```

### 测试未授权场景

```bash
curl -H "Authorization:" http://localhost:3001/api/replay/api/user
```

响应：
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "请先登录"
}
```

### 测试重复提交

```bash
curl -X POST -H "X-Idempotency-Key: duplicate" http://localhost:3001/api/replay/api/order
```

响应：
```json
{
  "success": false,
  "error": "DuplicateRequest",
  "message": "订单正在处理中，请勿重复提交"
}
```

### 测试支付超时（5秒延迟）

```bash
curl -X POST -H "Content-Type: application/json" -d '{"timeout": "true"}' http://localhost:3001/api/replay/api/payment
```

## 控制台功能

### 总览页面
- 统计卡片：总请求数、成功请求、失败请求、平均响应延迟
- 最近 10 条回放记录列表
- 实时刷新功能

### 合约管理
- 合约列表展示
- 新建、编辑、删除合约
- 场景管理：查看、启用/禁用、设为默认场景
- 匹配规则可视化展示

### 回放历史
- 分页展示所有回放记录
- 按状态筛选（成功/失败/无匹配/已补偿）
- 查看请求详情（路径、方法、头、体、响应）
- 人工补偿功能
- 导出功能（JSON/CSV）

### 系统设置
- 快速测试：一键测试各种场景
- 异常模板管理：创建和维护异常响应模板

## 数据模型

### Contract (合约)
- id: UUID
- name: 合约名称
- path: 请求路径
- method: HTTP 方法
- description: 描述
- isActive: 是否启用
- environment: 环境
- createdAt: 创建时间
- updatedAt: 更新时间

### ResponseScene (响应场景)
- id: UUID
- name: 场景名称
- contractId: 所属合约 ID
- matchRules: 匹配规则数组
- responseBody: 响应体 JSON
- statusCode: HTTP 状态码
- headers: 响应头
- isDefault: 是否默认场景
- isEnabled: 是否启用
- delayConfig: 延迟配置
- createdAt: 创建时间

### ReplayHistory (回放历史)
- id: UUID
- requestMethod: 请求方法
- requestPath: 请求路径
- requestHeaders: 请求头
- requestQuery: 查询参数
- requestBody: 请求体
- status: 状态 (success/failed/no_match/compensated)
- responseStatusCode: 响应状态码
- responseBody: 响应体
- responseDelay: 响应延迟(ms)
- matchedSceneName: 匹配的场景名
- failureReason: 失败原因
- isCompensated: 是否已补偿
- compensatedBy: 补偿人
- compensatedAt: 补偿时间
- createdAt: 创建时间

### ExceptionTemplate (异常模板)
- id: UUID
- name: 模板名称
- type: 类型
- responseBody: 响应体
- statusCode: HTTP 状态码
- description: 描述
- isActive: 是否启用
- createdAt: 创建时间

## 匹配规则说明

匹配规则支持以下类型：
- `header`: 匹配请求头
- `query`: 匹配查询参数
- `body`: 匹配请求体字段（支持嵌套，如 `user.name`）
- `path`: 匹配路径

操作符：
- `equals`: 精确相等
- `contains`: 包含
- `regex`: 正则匹配
- `exists`: 存在即可

## 延迟配置

```json
{
  "enabled": true,
  "strategy": "fixed",  // fixed, random, linear
  "fixedDelay": 1000,   // 固定延迟(ms)
  "minDelay": 200,      // 最小延迟(ms)
  "maxDelay": 2000      // 最大延迟(ms)
}
```

## 项目结构

```
.
├── backend/
│   ├── src/
│   │   ├── entities/          # 数据模型
│   │   ├── config/            # 配置文件
│   │   ├── routes/            # API 路由
│   │   ├── services/          # 业务服务
│   │   └── index.ts           # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 公共组件
│   │   ├── App.js             # 应用入口
│   │   └── index.js           # 渲染入口
│   └── package.json
└── README.md
```

## 开发说明

### 新增合约场景
1. 在后端数据库中创建 Contract
2. 创建对应的 ResponseScene，配置 matchRules
3. 通过 POST /api/replay/{path} 测试

### 人工补偿流程
1. 在历史记录中找到需要补偿的请求
2. 点击"补偿"按钮
3. 修改 HTTP 状态码和响应体
4. 提交后状态变为"已补偿"，并记录补偿信息

## License

MIT
