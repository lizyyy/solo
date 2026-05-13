# 无人仓分拣异常复核系统

## 项目简介

这是一个本地可运行的全栈项目，用于无人仓分拣异常复核管理。

## 技术栈

- 后端: Node.js + Express + SQLite
- 前端: React + Ant Design
- 其他: Excel导出、时间线展示

## 功能特性

### 核心功能
1. 包裹面单管理 - 支持运单号查询、状态筛选
2. 扫码日志拦截 - 异常包裹扫码自动拦截
3. 人工复核留痕 - 记录复核人、复核结果、责任方
4. 重复回调不重复扣减 - 支持callback_id去重
5. 重新投线 - 支持异常包裹重新投线

### 前端功能
1. 包裹列表页 - 数据统计、搜索筛选
2. 详情页 - 时间线展示所有操作记录、状态按钮
3. 报告导出页 - 按责任人和时间筛选导出Excel

### 数据流示例
- 正常流: 待处理 → 扫码中 → 分拣中 → 称重中 → 已完成
- 问题流: 待处理 → 扫码中 → 分拣中 → 称重中 → 异常
- 复核流: 异常 → 复核中 → (通过/驳回) → 已完成/重新投线

## 项目结构

```
warehouse-review/
├── server/
│   ├── index.js              # 服务入口
│   ├── database/
│   │   └── db.js            # 数据库连接
│   ├── routes/
│   │   ├── packages.js      # 包裹路由
│   │   ├── reviews.js       # 复核路由
│   │   └── reports.js      # 报告路由
│   └── scripts/
│       ├── initDB.js        # 初始化数据库
│       └── seedData.js      # 插入样例数据
├── client/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── pages/
│           ├── PackageList.jsx
│           ├── PackageDetail.jsx
│           └── ReportPage.jsx
├── package.json
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
npm install
```

### 2. 初始化数据库并插入样例数据

```bash
npm run init-db
npm run seed
```

### 3. 安装前端依赖

```bash
cd client
npm install
cd ..
```

### 4. 启动项目

方式一：同时启动前后端（推荐）
```bash
npm run dev
```

方式二：单独启动
```bash
# 启动后端 (端口3001)
npm run server

# 启动前端 (端口3000，新终端)
npm run client
```

### 5. 访问系统

打开浏览器访问: http://localhost:3000

## API接口文档

### 包裹相关

- `GET /api/packages` - 获取包裹列表
- `GET /api/packages/:id` - 获取包裹详情
- `POST /api/packages/scan` - 扫码接口
- `POST /api/packages/:id/sorting` - 分拣接口
- `POST /api/packages/:id/weight` - 称重接口
- `POST /api/packages/:id/rethrow` - 重新投线
- `GET /api/packages/:id/timeline` - 获取操作时间线

### 复核相关

- `POST /api/reviews/:packageId` - 提交复核
- `GET /api/reviews/stats/summary` - 获取统计数据

### 报告相关

- `GET /api/reports/list` - 获取报告列表
- `GET /api/reports/export` - 导出Excel报告
- `GET /api/reports/responsibility` - 获取责任方统计

## 数据库表说明

| 表名 | 说明 |
|------|------|
| packages | 包裹面单表 |
| sorting_slots | 分拣格口表 |
| weight_records | 称重记录表 |
| scan_logs | 扫码日志表 |
| manual_reviews | 人工复核表 |
| rethrow_records | 重新投线表 |
| status_history | 状态历史表 |

所有业务数据表都保存了修改前后的值，便于追溯。

## 状态流转

```
pending (待处理)
    ↓
scanning (扫码中)
    ↓
sorting (分拣中)
    ↓
weighting (称重中)
    ↓
┌───────────────┐
│ 正常→completed│
└───────────────┘
    ↓
exception (异常)
    ↓
reviewing (复核中)
    ↓
┌───────────────┐   ┌───────────────┐
│通过→completed │   │驳回→rethrowing│
└───────────────┘   └───────────────┘
                        ↓
                    scanning (重新扫码)
```
