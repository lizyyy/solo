# 民宿保洁验收 API

一个完整的民宿保洁验收管理系统后端 API，提供 REST 接口、本地持久化存储和可重复调用的样例数据。

## 核心功能

### 数据模型
- **房源** - 民宿房源信息管理
- **保洁任务** - 保洁任务全生命周期管理
- **检查项** - 保洁验收标准配置
- **照片凭证** - 保洁过程照片留存
- **客诉记录** - 客户投诉跟踪处理
- **验收报告** - 验收报告生成与导出

### 核心规则
- **检查项打勾** - 逐项验收，每项可标记通过/不通过
- **照片留存** - 支持检查项关联照片凭证
- **返工状态机** - 完整的任务状态流转控制
- **重复验收拦截** - 防止同一任务重复验收
- **报告导出** - 支持 CSV 格式导出验收报告和客诉记录

## 快速开始

### 环境要求
- Node.js >= 16.x
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 初始化数据库和示例数据

```bash
npm run init-data
```

### 启动服务

```bash
npm start
```

开发模式（自动重启）：

```bash
npm run dev
```

服务启动后访问：http://localhost:3000/api

## API 接口文档

### 1. 房源管理 `/api/properties`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/properties` | 获取所有房源 |
| GET | `/api/properties/:id` | 获取单个房源详情 |
| POST | `/api/properties` | 创建新房源 |
| PUT | `/api/properties/:id` | 更新房源信息 |
| DELETE | `/api/properties/:id` | 禁用房源 |

**创建房源示例：**

```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "name": "海景公寓 A-101",
    "address": "海南省三亚市海棠湾路88号",
    "roomCount": 2,
    "status": "active"
  }'
```

### 2. 保洁任务管理 `/api/tasks`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 获取任务列表（支持筛选） |
| GET | `/api/tasks/:id` | 获取任务详情（含检查项） |
| POST | `/api/tasks` | 创建新保洁任务 |
| POST | `/api/tasks/:id/transition` | 推进任务状态 |
| PUT | `/api/tasks/check-items/:taskCheckItemId` | 更新检查项状态 |
| POST | `/api/tasks/:id/photos` | 添加照片凭证 |
| POST | `/api/tasks/:id/acceptance-report` | 创建验收报告 |
| POST | `/api/tasks/:id/manual-correct` | 人工修正任务状态 |
| GET | `/api/tasks/:id/rework-history` | 获取返工历史 |

**任务状态流转：**
- `pending` - 待分配
- `assigned` - 已分配
- `in_progress` - 进行中
- `completed` - 已完成
- `accepted` - 已验收通过
- `rejected` - 验收不通过
- `needs_rework` - 需要返工

**创建任务示例：**

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "taskDate": "2024-01-20",
    "cleanerName": "李阿姨",
    "notes": "退房清洁"
  }'
```

**状态推进示例：**

```bash
curl -X POST http://localhost:3000/api/tasks/1/transition \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "in_progress",
    "triggeredBy": "管理员",
    "reason": "开始保洁工作"
  }'
```

**更新检查项示例：**

```bash
curl -X PUT http://localhost:3000/api/tasks/check-items/1 \
  -H "Content-Type: application/json" \
  -d '{
    "isPassed": true,
    "checkedBy": "验收员小王",
    "notes": "床铺整洁，已更换床单"
  }'
```

**创建验收报告示例（触发重复验收拦截）：**

```bash
curl -X POST http://localhost:3000/api/tasks/1/acceptance-report \
  -H "Content-Type: application/json" \
  -d '{
    "inspectorName": "验收员小王"
  }'
```

**人工修正示例（跳过状态机限制）：**

```bash
curl -X POST http://localhost:3000/api/tasks/1/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "accepted",
    "correctedBy": "超级管理员",
    "reason": "紧急情况，直接通过"
  }'
```

### 3. 检查项管理 `/api/check-items`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/check-items` | 获取检查项列表 |
| GET | `/api/check-items/categories` | 获取检查项分类 |
| GET | `/api/check-items/:id` | 获取单个检查项 |
| POST | `/api/check-items` | 创建新检查项 |
| PUT | `/api/check-items/:id` | 更新检查项 |
| DELETE | `/api/check-items/:id` | 禁用检查项 |

### 4. 客诉记录管理 `/api/complaints`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/complaints` | 获取客诉列表 |
| GET | `/api/complaints/:id` | 获取客诉详情 |
| POST | `/api/complaints` | 创建客诉记录 |
| PUT | `/api/complaints/:id/handle` | 处理客诉 |
| DELETE | `/api/complaints/:id` | 关闭客诉 |

**创建客诉示例：**

```bash
curl -X POST http://localhost:3000/api/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": 1,
    "taskId": 1,
    "complaintDate": "2024-01-20",
    "complainant": "张先生",
    "category": "清洁",
    "description": "卫生间有异味，地漏堵塞",
    "relatedCheckItems": "马桶清洁,地漏疏通"
  }'
```

### 5. 数据导出 `/api/exports`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/exports/reports/:reportId` | 导出验收报告为 CSV |
| GET | `/api/exports/reports/:reportId/download` | 下载报告文件 |
| POST | `/api/exports/complaints` | 导出租客诉记录 |
| GET | `/api/exports/list` | 列出所有导出文件 |

**导出验收报告示例：**

```bash
curl -X POST http://localhost:3000/api/exports/reports/1
```

### 6. 错误日志管理 `/api/error-logs`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/error-logs` | 获取错误日志列表 |
| GET | `/api/error-logs/:id` | 获取错误详情 |
| PUT | `/api/error-logs/:id/handle` | 标记错误处理结果 |
| DELETE | `/api/error-logs/:id` | 删除错误日志 |

## 异常处理机制

所有 API 请求异常都会被自动捕获并记录到 `error_logs` 表中，包含：
- 请求端点和方法
- 原始输入参数
- 错误消息和堆栈
- 创建时间

可以通过错误日志管理接口查看和处理异常。

**异常路径测试示例（故意传错误参数）：**

```bash
# 测试参数验证失败
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "不是数字",
    "taskDate": "",
    "cleanerName": ""
  }'

# 然后查看错误日志
curl http://localhost:3000/api/error-logs
```

## 目录结构

```
.
├── src/
│   ├── app.js                    # 主应用入口
│   ├── models/
│   │   ├── TaskService.js        # 任务服务（状态机、验收逻辑）
│   │   └── ExportService.js      # 导出服务
│   ├── routes/
│   │   ├── tasks.js              # 任务路由
│   │   ├── properties.js         # 房源路由
│   │   ├── checkItems.js         # 检查项路由
│   │   ├── complaints.js         # 客诉路由
│   │   ├── exports.js            # 导出路由
│   │   └── errorLogs.js          # 错误日志路由
│   ├── middleware/
│   │   └── errorHandler.js       # 错误处理中间件
│   └── utils/
│       ├── database.js           # 数据库连接
│       └── initDB.js             # 数据库初始化
├── scripts/
│   └── initData.js               # 示例数据初始化
├── data/                         # SQLite 数据库文件目录
├── photos/                       # 照片存储目录
├── exports/                      # 导出文件目录
├── package.json
└── README.md
```

## 技术栈

- **Web 框架**: Express.js
- **数据库**: SQLite3 (better-sqlite3)
- **数据验证**: Joi
- **日志**: Morgan
- **导出**: JSON2CSV
- **UUID 生成**: uuid

## 核心业务逻辑说明

### 状态机（State Machine）

任务状态必须按照预定义的流转路径推进，不允许跳步。例如：
- pending → assigned → in_progress → completed → accepted
- completed → needs_rework → in_progress （返工流程）

### 重复验收拦截

当任务已存在验收报告时，再次创建报告会抛出错误，防止重复验收。

### 人工修正机制

提供 `manual-correct` 接口允许管理员直接修改任务状态，跳过状态机限制，所有操作都会记录到返工历史中。

### 异常路径保存

所有 API 异常都会记录原始输入，便于排查问题和追溯。
