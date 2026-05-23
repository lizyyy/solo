# 停车场月租扣费 API 服务

本地后端API服务，提供停车场月租扣费、道闸事件处理、补扣申请、对账导出等功能。

## 功能特性

- **车辆管理**: 车辆注册、充值、查询
- **套餐管理**: 月卡套餐创建、查询
- **订阅管理**: 套餐订阅、有效期校验
- **道闸事件**: 事件上报、去重处理、自动扣费
- **补扣申请**: 补扣申请、审核流程（待复核/已驳回/已补偿/已执行）
- **对账系统**: 对账摘要生成、CSV导出、人工调账
- **异常记录**: 所有异常路径保存原始输入和处理结论

## 技术栈

- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **日期处理**: Moment.js
- **CSV导出**: csv-writer

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 加载样例数据

```bash
node test/sampleData.js
```

### 3. 启动服务

```bash
npm start
# 开发模式
npm run dev
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 健康检查

```bash
GET /api/v1/health
```

### 车辆管理

```bash
# 创建车辆
POST /api/v1/vehicles
Body: { plate_number, owner_name, owner_phone }

# 查询车辆信息
GET /api/v1/vehicles/:plateNumber

# 充值
POST /api/v1/vehicles/recharge
Body: { plate_number, amount }

# 订阅套餐
POST /api/v1/vehicles/subscribe
Body: { plate_number, plan_id }

# 查询订阅记录
GET /api/v1/vehicles/:plateNumber/subscriptions
```

### 套餐管理

```bash
# 创建套餐
POST /api/v1/plans
Body: { plan_name, price, duration_days, description }

# 查询可用套餐
GET /api/v1/plans
```

### 道闸事件

```bash
# 上报道闸事件
POST /api/v1/gate-events
Body: { event_id, plate_number, event_type, event_time, gate_id, direction }

# 查询车辆事件
GET /api/v1/gate-events/plate/:plateNumber
```

### 扣费记录

```bash
# 查询车辆扣费记录
GET /api/v1/deductions/plate/:plateNumber

# 查询单条扣费记录
GET /api/v1/deductions/:deductionNo
```

### 补扣申请

```bash
# 创建补扣申请
POST /api/v1/supplementary
Body: { plate_number, original_event_id, amount, reason, applicant }

# 审核补扣申请
POST /api/v1/supplementary/:supplementaryNo/review
Body: { action, reviewer, review_remark }
# action可选值: approved/rejected/compensated

# 按状态查询申请
GET /api/v1/supplementary/status/:status

# 查询车辆补扣记录
GET /api/v1/supplementary/plate/:plateNumber

# 状态流转图
GET /api/v1/supplementary/flow
```

### 对账管理

```bash
# 生成对账摘要
POST /api/v1/reconciliation/summary
Body: { date }

# 查询某日对账摘要
GET /api/v1/reconciliation/summary/:date

# 查询日期范围对账记录
GET /api/v1/reconciliation/summary/list?start_date=&end_date=

# 导出对账CSV
POST /api/v1/reconciliation/export
Body: { start_date, end_date, export_path }

# 人工调账
POST /api/v1/reconciliation/correct
Body: { deduction_no, new_amount, reason, operator }
```

### 异常记录

```bash
# 查询异常日志
GET /api/v1/exceptions
```

## 核心业务规则

### 套餐有效期
- 套餐按天数计算
- 续费时自动从现有套餐结束日开始
- 支持月卡、季卡等不同时长

### 事件去重
- 同一事件ID自动去重
- 5分钟内同车辆重复事件自动标记去重

### 补扣状态机
```
pending -> approved -> deducted
        -> rejected
        -> compensated
```

### 余额重算
- 每次扣费实时更新余额
- 人工调账自动重算余额
- 所有操作留痕

## 目录结构

```
parking-monthly-api/
├── src/
│   ├── app.js              # 主入口文件
│   ├── config/
│   │   ├── database.js     # 数据库配置
│   │   └── initDb.js       # 表结构初始化
│   ├── models/             # 数据模型层
│   ├── services/           # 业务逻辑层
│   └── routes/             # 路由控制器层
├── test/
│   └── sampleData.js       # 样例数据脚本
├── data/                   # SQLite数据库文件
├── exports/                # CSV导出目录
├── package.json
└── README.md
```

## 数据持久化

- 使用SQLite本地数据库
- 服务重启数据不丢失
- 所有异常路径保存原始输入JSON
