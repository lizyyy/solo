# 农场采摘预售改期管理系统

一个完整的全栈Web应用，用于管理农场采摘预约的改期流程，包含果园批次管理、天气延期处理、预约核销、产量限额预警、改期通知和退款规则等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design
- **数据持久化**: SQLite（文件存储，重启后数据保留）

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

### 2. 创建数据目录

```bash
mkdir -p data
```

### 3. 初始化数据（可选）

```bash
npm run init-data
```

### 4. 启动开发服务器

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：单独启动后端
npm run server

# 方式三：单独启动前端
cd client && npm start
```

- 后端服务运行在: http://localhost:3001
- 前端服务运行在: http://localhost:3000

## 功能模块

### 1. 预约管理
- 列表展示所有预约记录
- 按客户姓名、状态、批次筛选
- 批量导入CSV文件
- 导出预约数据为CSV
- 发起改期申请

### 2. 改期记录
- 查看所有改期申请记录
- 待审核的申请可以进行审核操作
- 支持通过/拒绝改期申请

### 3. 产量预警
- 展示所有产量超限预警记录
- 显示批次阈值和当前预约量
- 支持预警级别标识

### 4. 天气延期
- 管理因天气原因导致的批次延期
- 记录延期原因、原日期和新日期
- 按影响级别分类

### 5. 系统演示
内置四条演示路径：
- **成功路径**: 演示正常改期并审核通过的完整流程
- **拦截路径**: 演示产量超限时的自动拦截机制
- **人工修正**: 演示管理员对预约数据的人工修正
- **重复提交**: 演示基于幂等Key的重复提交处理机制

## API接口文档

### 果园批次
- `GET /api/batches` - 获取批次列表
- `POST /api/batches` - 创建新批次

### 预约管理
- `GET /api/appointments` - 获取预约列表
- `POST /api/appointments` - 创建预约
- `POST /api/appointments/import` - 批量导入预约
- `GET /api/appointments/export` - 导出预约数据

### 改期管理
- `GET /api/reschedules` - 获取改期记录
- `POST /api/reschedules` - 提交改期申请
- `POST /api/reschedules/:id/review` - 审核改期申请

### 其他接口
- `GET /api/yield-limits` - 获取产量预警
- `GET /api/weather-delays` - 获取天气延期
- `GET /api/refund-rules` - 获取退款规则
- `GET /api/timeline` - 获取操作时间线

### 演示接口
- `GET /api/demo/success` - 运行成功路径演示
- `GET /api/demo/blocked` - 运行拦截路径演示
- `GET /api/demo/manual` - 运行人工修正演示
- `GET /api/demo/duplicate` - 运行重复提交演示

## 业务规则说明

### 1. 预约核销变更
- 改期申请需要管理员审核
- 改期成功后自动更新预约状态
- 所有操作记录到时间线

### 2. 产量限额异常
- 创建预约时自动检查剩余产量
- 超限后自动生成产量预警记录
- 改期申请时同样进行产量校验

### 3. 改期通知复核
- 改期申请提交后状态为待审核
- 管理员可以通过/拒绝
- 审核结果记录到操作日志

### 4. 重复提交幂等
- 支持传入idempotencyKey参数
- 相同key的请求只处理一次
- 重复请求直接返回已有结果

### 5. 失败原因记录
- 改期失败时记录具体原因
- 可在改期记录中查看失败详情

## 退款规则
- 提前7天以上取消: 全额退款
- 提前3-7天取消: 退款80%
- 提前1-3天取消: 退款50%
- 提前1天内取消: 不退款

## 数据持久化
系统使用SQLite数据库，数据文件位于 `data/farm.db`，重启服务器后所有数据仍然保留。

## 目录结构
```
.
├── server/                 # 后端代码
│   ├── index.js           # 入口文件
│   ├── database.js        # 数据库操作
│   ├── rulesEngine.js     # 业务规则引擎
│   ├── routes.js          # API路由
│   └── scripts/           # 脚本文件
│       └── initData.js    # 初始化数据
├── client/                 # 前端代码
│   ├── public/
│   └── src/
│       ├── index.js       # 入口文件
│       └── App.js         # 主应用组件
├── data/                   # 数据库文件目录
└── package.json
```
