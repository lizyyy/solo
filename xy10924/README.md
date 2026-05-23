# 家政阿姨试工 API

本地后端 API 服务，提供家政公司试工安排、客户评价、押金管理和转正结论的完整流程管理。

## 功能特性

- **客户管理**: 客户信息录入、查询和更新
- **阿姨档案**: 阿姨信息管理、技能标签、可用状态查询
- **试工排期**: 试工安排创建、状态管理、冲突检测
- **押金流水**: 押金收取、退还、状态跟踪
- **评价记录**: 客户评价、多维度评分、复核流程
- **转正结论**: 转正决策、薪资方案、合同导出
- **处理追溯**: 所有操作记录留存，异常路径完整追溯

## 核心规则

1. **排期冲突检测**: 同一阿姨同一时间段不能重复安排
2. **状态机管理**: 试工、押金、评价、结论都有完整的状态流转
3. **评价复核**: 客户评价需经过审核才能生效
4. **完整追溯**: 所有操作（成功或失败）都有处理记录

## 技术栈

- Node.js + Express
- SQLite 本地数据库
- RESTful API 设计

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入示例数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

## API 接口

### 客户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/customers | 创建客户 |
| GET | /api/customers | 查询客户列表 |
| GET | /api/customers/:id | 查询单个客户 |
| PUT | /api/customers/:id | 更新客户信息 |

### 阿姨管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/workers | 创建阿姨档案 |
| GET | /api/workers | 查询阿姨列表 |
| GET | /api/workers/available?date=YYYY-MM-DD | 查询某日可用阿姨 |
| GET | /api/workers/:id | 查询单个阿姨 |
| PUT | /api/workers/:id | 更新阿姨信息 |

### 试工排期

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/schedules | 创建试工安排（自动检测冲突） |
| GET | /api/schedules | 查询试工列表 |
| GET | /api/schedules/:id | 查询单个试工 |
| GET | /api/schedules/:id/details | 查询试工完整详情（含押金、评价、结论、处理记录） |
| PUT | /api/schedules/:id/status | 更新试工状态 |
| POST | /api/schedules/:id/correct | 人工修正试工信息 |

### 押金管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deposits | 创建押金记录 |
| GET | /api/deposits/schedule/:scheduleId | 查询试工的所有押金记录 |
| GET | /api/deposits/schedule/:scheduleId/summary | 查询押金汇总信息 |
| GET | /api/deposits/:id | 查询单个押金记录 |
| PUT | /api/deposits/:id/status | 更新押金状态 |

### 评价管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/evaluations | 创建客户评价 |
| GET | /api/evaluations/schedule/:scheduleId | 查询试工的评价 |
| GET | /api/evaluations/:id | 查询单个评价 |
| PUT | /api/evaluations/:id/review | 复核评价 |
| POST | /api/evaluations/:id/correct | 人工修正评价 |

### 转正结论

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/conclusions | 创建转正结论 |
| GET | /api/conclusions | 查询转正结论列表 |
| GET | /api/conclusions/schedule/:scheduleId | 查询试工的转正结论 |
| GET | /api/conclusions/:id | 查询单个转正结论 |
| GET | /api/conclusions/:id/export | 导出转正完整报告 |
| PUT | /api/conclusions/:id/status | 更新结论状态 |
| POST | /api/conclusions/:id/correct | 人工修正结论 |

### 处理记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/processing-records | 查询所有处理记录 |
| GET | /api/processing-records/:id | 查询单个处理记录 |
| GET | /api/processing-records/reference/:type/:id | 查询关联记录的所有处理历史 |

## 状态说明

### 试工状态
- pending: 待确认
- confirmed: 已确认
- in_progress: 进行中
- completed: 已完成
- cancelled: 已取消
- no_show: 爽约

### 押金状态
- pending: 待支付
- confirmed: 已确认
- failed: 支付失败
- refunded: 已退还

### 评价状态
- pending: 待复核
- approved: 已通过
- rejected: 已驳回

### 结论状态
- draft: 草稿
- reviewing: 审核中
- approved: 已批准
- rejected: 已拒绝
- completed: 已完成

## 数据追溯示例

调用 `GET /api/schedules/:id/details` 可获得完整的试工单详情，包括：
- 试工基本信息
- 客户信息
- 阿姨信息
- 所有押金交易记录
- 所有评价记录
- 转正结论
- 所有处理操作记录（包括失败操作的错误信息）

## 目录结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── config/
│   │   └── database.js    # 数据库配置
│   ├── routes/            # 路由层
│   └── services/          # 业务逻辑层
├── scripts/
│   ├── init-db.js         # 数据库初始化
│   └── seed-data.js       # 示例数据
├── data/                  # 数据库文件目录
├── package.json
└── README.md
```
