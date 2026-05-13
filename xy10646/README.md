# 水质采样送检管理系统

一个完整的水质采样送检全流程管理系统，包含采样点管理、样瓶管理、流转记录跟踪、业务规则校验等功能。

## 技术栈

- **前端**: React 18 + Vite + Ant Design
- **后端**: Node.js + Express + Sequelize
- **数据库**: SQLite
- **导出**: ExcelJS

## 项目结构

```
.
├── client/                 # 前端应用
│   ├── src/
│   │   ├── pages/        # 页面组件
│   │   │   ├── SampleList.jsx      # 样品列表页
│   │   │   ├── AnomalyDashboard.jsx # 异常看板页
│   │   │   └── ExportReport.jsx    # 导出报告页
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── models/        # 数据模型
│   │   ├── controllers/   # 控制器
│   │   ├── services/      # 业务规则服务
│   │   ├── routes/        # 路由
│   │   └── scripts/       # 初始化脚本
│   └── package.json
└── package.json
```

## 本地启动

### 前置条件

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 初始化数据库（包含样例数据）

```bash
cd server
npm run init-db
```

该命令会：
1. 创建数据库表结构
2. 插入 4 个采样点数据
3. 插入 5 个样瓶数据
4. 插入 3 个样品记录（包含 1 个超时接收的失败案例）
5. 插入 6 条检测项目数据
6. 插入 9 条流转记录

### 启动服务

```bash
# 方式一：同时启动前后端（根目录）
npm run dev

# 方式二：分别启动
# 启动后端服务（端口 3001）
cd server && npm run dev

# 启动前端服务（端口 3000）
cd client && npm run dev
```

访问地址: http://localhost:3000

## 功能说明

### 1. 样品列表页
- 搜索过滤：支持按样品编号、采样人关键字搜索
- 列表筛选：支持按状态、采样点、日期范围筛选
- 样品详情：查看基本信息、检测项目、流转记录
- 添加流转：记录样品的采样、运输、接收、检测等流程

### 2. 异常看板
- 统计展示：超时接收、检测异常、已拒收的数量
- 详细列表：展示各类异常记录的详细信息
- 实时更新：数据从后端实时获取

### 3. 导出报告
- 筛选条件：按日期范围、操作人、样品状态筛选
- Excel导出：生成包含完整信息的Excel报告
- 内容说明：样品编号、采样点、检测项目统计、最后操作信息

## API 接口演示

### 基础信息查询

```bash
# 获取所有采样点
GET http://localhost:3001/api/sampling-points

# 获取所有样瓶
GET http://localhost:3001/api/sample-bottles
```

### 样品管理

```bash
# 获取样品列表（支持分页和筛选）
GET http://localhost:3001/api/samples?page=1&pageSize=10&status=received

# 获取单个样品详情
GET http://localhost:3001/api/samples/1

# 创建样品记录
POST http://localhost:3001/api/samples
Content-Type: application/json

{
  "sampleCode": "SAMP20240115001",
  "samplingPointId": 1,
  "bottleId": 1,
  "preservative": "硝酸",
  "samplingTime": "2024-01-15T08:30:00.000Z",
  "sampler": "张三",
  "temperature": 15.5,
  "weather": "晴"
}
```

### 流转记录

```bash
# 添加流转记录
POST http://localhost:3001/api/flows
Content-Type: application/json

{
  "sampleRecordId": 1,
  "flowType": "receive",
  "operator": "李四",
  "operationTime": "2024-01-15T10:00:00.000Z",
  "fromLocation": "采样现场",
  "toLocation": "实验室",
  "remarks": "正常接收"
}
```

### 异常和导出

```bash
# 获取异常统计
GET http://localhost:3001/api/anomalies

# 导出Excel报告
GET http://localhost:3001/api/export?startDate=2024-01-01&endDate=2024-01-31&operator=张三&status=received
```

### 修改日志

```bash
# 获取审计日志
GET http://localhost:3001/api/audit-logs?entityType=sampleRecord
```

## 业务规则

### 1. 保存剂变更记录
- 修改样品的保存剂时，系统自动记录变更前后的值
- 审计日志记录：entityType='sampleRecord', entityId, fieldName='preservative'
- 可以通过 `/api/audit-logs` 接口查询所有变更历史

### 2. 运输交接拦截
- 同一类型的流转记录不能重复提交
- 已完成接收的样品不能再添加运输记录
- 系统自动拦截不符合流程的操作

### 3. 超时接收复核
- 采样后超过 24 小时接收会标记为超时
- 流转记录的 isTimeout 字段设为 true
- 自动记录超时原因："超过24小时接收时限"
- 超时记录会在异常看板中显示

### 4. 重复提交检测
- 每个样品的每种流转类型只能提交一次
- 重复提交会被业务规则拦截并返回错误

## 失败路径演示

### 案例 1：超时接收（已预置在样例数据中）

```
样品: SAMP20240115003
采样时间: 2024-01-14 14:00:00
实际接收时间: 2024-01-15 08:00:00
时间间隔: 18小时 ✗ 超过24小时限制

结果:
- 流转记录标记 isTimeout = true
- 超时原因自动记录
- 在异常看板的"超时接收"列表中显示
```

### 案例 2：重复提交流转记录

```bash
POST http://localhost:3001/api/flows
{
  "sampleRecordId": 1,
  "flowType": "receive",  // 该样品已存在receive类型记录
  "operator": "王五",
  "operationTime": "2024-01-15T12:00:00.000Z"
}

返回:
{
  "success": false,
  "message": "业务规则校验失败",
  "errors": ["该样品已存在receive类型的流转记录"]
}
```

### 案例 3：已接收样品添加运输记录（拦截）

```bash
POST http://localhost:3001/api/flows
{
  "sampleRecordId": 1,  // 该样品已完成接收
  "flowType": "transport",
  "operator": "王五",
  "operationTime": "2024-01-15T12:00:00.000Z"
}

返回:
{
  "success": false,
  "message": "业务规则校验失败",
  "errors": ["该样品已完成接收，不能重复运输"]
}
```

## 数据模型说明

### SamplingPoint (采样点)
- id, code, name, location, description, isActive

### SampleBottle (样瓶)
- id, bottleNumber, preservative, volume, material, status

### SampleRecord (样品记录)
- id, sampleCode, samplingPointId, bottleId, preservative, samplingTime, sampler, status, temperature, weather, remarks

### TestItem (检测项目)
- id, sampleRecordId, itemName, itemCode, expectedValue, actualValue, unit, tester, testTime, isAbnormal, remarks

### FlowRecord (流转记录)
- id, sampleRecordId, flowType, operator, operationTime, fromLocation, toLocation, isTimeout, timeoutReason, isIntercepted, interceptReason, remarks

### AuditLog (审计日志)
- id, entityType, entityId, fieldName, oldValue, newValue, operator, operationTime

## 开发说明

### 端口配置
- 前端: 3000
- 后端: 3001
- 前端通过 Vite 代理访问后端 API

### 数据库文件
- SQLite 数据库文件位置: `server/database.sqlite`
- 重新初始化: 删除数据库文件后运行 `npm run init-db`

### 环境变量
无需额外配置，使用默认配置即可运行。
