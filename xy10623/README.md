# 短租清洁派单返工管理系统

## 项目简介

这是一个完整的短租公寓清洁派单和返工管理系统，帮助业务人员无需翻聊天记录即可查看房源日历、退房事件和返工投诉。

## 功能特性

### 异常看板
- 待处理派单统计
- 待处理返工统计
- 进行中返工统计
- 物料异常预警
- 近期投诉列表
- 即将到来的派单

### 核心功能
- **房源日历**: 查看入住/退房事件，支持按房源和日期筛选
- **退房事件**: 记录退房时间、房间状况、损坏备注
- **保洁派单**: 派单分配、状态跟踪、质量评分
- **返工记录**: 投诉记录、责任人追踪、返工处理、按责任人和时间筛选导出
- **物料管理**: 库存管理、消耗记录、异常预警
- **绩效评分**: 保洁员绩效统计、人工调整、修改留痕
- **操作日志**: 记录所有数据修改，包含修改前后值

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: HTML + Bootstrap 5 + 原生 JavaScript
- **数据持久化**: SQLite 数据库文件

## 安装运行

### 后端安装
```bash
cd backend
npm install
npm run init-db
npm start
```

后端服务运行在: http://localhost:3001

### 前端访问
直接用浏览器打开 `frontend/index.html`

## 项目结构

```
.
├── backend/
│   ├── server.js          # 后端服务主文件
│   ├── init-db.js       # 数据库初始化
│   ├── seed-data.js   # 演示数据生成
│   ├── package.json    # 依赖配置
│   └── cleaning.db     # SQLite 数据库文件（运行后生成）
└── frontend/
    ├── index.html     # 主页面
    └── app.js        # 前端逻辑
```

## API 接口

### 看板
- `GET /api/dashboard` - 获取看板统计数据

### 房源和保洁员
- `GET /api/properties` - 获取房源列表
- `GET /api/cleaners` - 获取保洁员列表

### 日历和退房
- `GET /api/calendar` - 获取日历事件
- `GET /api/checkout-events` - 获取退房事件

### 保洁派单
- `GET /api/cleaning-assignments` - 获取派单列表
- `PUT /api/cleaning-assignments/:id` - 更新派单

### 返工记录
- `GET /api/rework-records` - 获取返工记录
- `POST /api/rework-records` - 创建返工记录
- `PUT /api/rework-records/:id` - 更新返工记录

### 物料管理
- `GET /api/materials` - 获取物料列表
- `GET /api/material-consumption` - 获取物料消耗记录

### 绩效评分
- `GET /api/performance` - 获取绩效数据
- `POST /api/performance/:id/adjust` - 调整绩效

### 导入导出
- `POST /api/import` - 批量导入CSV
- `GET /api/export/rework` - 导出返工记录
- `GET /api/export/cleaning` - 导出派单记录

### 操作日志
- `GET /api/audit-logs` - 获取操作日志

## 演示数据

系统初始化时会自动生成演示数据，包括：
- 5套房源
- 4位保洁员
- 5种物料
- 多个日历事件
- 退房记录
- 保洁派单
- 返工记录
- 物料消耗记录

## 数据库设计

系统会自动保存所有数据到 `backend/cleaning.db` 文件，重启服务后数据不丢失。
