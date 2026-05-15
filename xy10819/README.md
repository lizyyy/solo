# API 冒烟巡检面板

一个面向技术团队的全栈 API 冒烟测试巡检系统，支持接口步骤编排、变量注入、响应断言、失败截图、批次对比和数据导出。

## 功能特性

### 后端功能
- ✅ **巡检集合管理** - 对接口进行分组管理
- ✅ **环境变量** - 支持多环境变量配置和注入
- ✅ **接口步骤编排** - 支持 GET/POST/PUT/DELETE 请求
- ✅ **响应断言** - 状态码、响应时间、JSON路径、包含判断
- ✅ **执行批次管理** - 记录每次执行的完整信息
- ✅ **失败截图** - Puppeteer 自动截图失败页面
- ✅ **手动重试** - 支持单步骤重试
- ✅ **数据导出** - CSV/JSON 格式导出
- ✅ **实时状态** - 轮询查看执行进度

### 前端功能
- ✅ **总览仪表盘** - 统计数据、执行历史、快速入口
- ✅ **集合详情** - 步骤管理、执行历史查看
- ✅ **批次详情** - 执行结果、断言详情、错误信息、截图
- ✅ **环境配置** - 可视化变量管理
- ✅ **手动补偿** - 失败步骤一键重试
- ✅ **数据导出** - 支持CSV和JSON格式

## 技术栈

### 后端
- Node.js + Express
- SQLite (数据持久化)
- Axios (HTTP请求)
- Puppeteer (页面截图)
- UUID (唯一标识)

### 前端
- React 18
- Ant Design 5
- React Router
- Day.js
- Axios

## 项目结构

```
xy10819/
├── backend/
│   ├── src/
│   │   ├── server.js          # 入口文件
│   │   ├── config/
│   │   │   └── database.js    # 数据库配置
│   │   ├── routes/            # API路由
│   │   ├── services/          # 业务逻辑
│   │   ├── utils/             # 工具函数
│   │   └── scripts/           # 初始化脚本
│   ├── data/                  # SQLite数据
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/        # 通用组件
    │   ├── pages/             # 页面组件
    │   ├── services/          # API服务
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 启动后端服务

```bash
cd backend
npm start
```

后端服务将在 http://localhost:3001 启动

### 3. 启动前端服务

```bash
cd frontend
npm start
```

前端服务将在 http://localhost:3000 启动

### 4. 初始化演示数据

在后端目录下执行：

```bash
node src/scripts/seed-data.js
```

这将创建：
- 一个生产环境配置
- 一个"核心接口冒烟测试"集合
- 5个示例步骤（包含健康检查、用户信息、订单创建等）
- 5个历史执行批次（含通过和失败案例）

## API 接口

### 巡检集合
- `GET /api/collections` - 获取集合列表
- `GET /api/collections/:id` - 获取集合详情
- `POST /api/collections` - 创建集合
- `PUT /api/collections/:id` - 更新集合
- `DELETE /api/collections/:id` - 删除集合

### 环境变量
- `GET /api/environments` - 获取环境列表
- `GET /api/environments/:id` - 获取环境详情
- `POST /api/environments` - 创建环境
- `PUT /api/environments/:id` - 更新环境
- `DELETE /api/environments/:id` - 删除环境

### 执行批次
- `GET /api/batches` - 获取批次列表
- `GET /api/batches/:id` - 获取批次详情
- `GET /api/batches/:id/results` - 获取批次执行结果

### 执行控制
- `POST /api/executions/collection/:collectionId` - 执行集合
- `POST /api/executions/retry/:resultId` - 重试单步骤
- `GET /api/executions/status/:batchId` - 获取执行状态

### 导出
- `GET /api/exports/batch/:batchId/csv` - 导出批次CSV
- `GET /api/exports/batch/:batchId/json` - 导出批次JSON
- `GET /api/exports/summary` - 获取汇总数据

## 数据模型

### collections (巡检集合)
- id: UUID
- name: 名称
- description: 描述
- environment_id: 关联环境ID
- status: 状态 (active/inactive)
- created_at/updated_at: 时间戳

### environments (环境)
- id: UUID
- name: 名称
- variables: JSON数组 (变量列表)
- created_at/updated_at: 时间戳

### steps (接口步骤)
- id: UUID
- collection_id: 集合ID
- name: 步骤名称
- method: HTTP方法
- url: 请求URL
- headers: 请求头 (JSON)
- body: 请求体 (JSON)
- assertions: 断言配置 (JSON)
- order_index: 排序

### batches (执行批次)
- id: UUID
- collection_id: 集合ID
- status: 状态 (pending/running/completed/failed)
- started_at: 开始时间
- completed_at: 完成时间
- total_steps: 总步骤数
- passed_steps: 通过数
- failed_steps: 失败数

### execution_results (执行结果)
- id: UUID
- batch_id: 批次ID
- step_id: 步骤ID
- status: 状态 (passed/failed)
- request_data: 请求数据 (JSON)
- response_data: 响应数据 (JSON)
- response_status: 响应状态码
- response_time: 响应时间(ms)
- assertions_result: 断言结果 (JSON)
- error_message: 错误信息
- screenshot_path: 截图路径
- executed_at: 执行时间

## 断言类型

1. **status_code** - 验证HTTP状态码
2. **response_time** - 验证响应时间（毫秒）
3. **json_path** - 验证JSON路径值
4. **contains** - 验证响应体包含字符串

## 使用说明

1. **创建环境** - 在"环境配置"页面添加变量，如 `baseUrl=https://api.example.com`
2. **创建巡检集合** - 在"巡检集合"页面创建新的测试集合
3. **添加步骤** - 在集合详情中添加接口测试步骤
4. **配置断言** - 为每个步骤添加响应验证规则
5. **执行巡检** - 点击"执行巡检"开始测试
6. **查看结果** - 在批次详情中查看执行结果、断言详情和失败截图
7. **导出数据** - 支持CSV和JSON格式导出

## 特色亮点

1. **数据持久化** - SQLite存储，重启服务数据不丢失
2. **失败自动截图** - Puppeteer自动捕获失败页面截图
3. **变量注入** - 支持 `{{variable}}` 语法在URL和Header中注入变量
4. **实时进度** - 执行过程中自动刷新状态
5. **历史对比** - 可查看所有历史执行批次
6. **手动补偿** - 支持单个失败步骤重试

## 注意事项

- Puppeteer首次运行会自动下载Chromium，可能需要一些时间
- 截图功能需要目标URL可访问
- 大文件响应可能会影响性能，建议设置超时
- 生产环境建议设置适当的权限控制

## 开发建议

- 添加用户认证和权限管理
- 支持定时任务自动巡检
- 添加Webhook通知（钉钉/企业微信）
- 支持更多断言类型
- 添加性能趋势图表
- 支持集合导入导出
- 集成CI/CD流水线
