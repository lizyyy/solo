# 商场活动券退款返还系统

全栈 Web 应用，用于管理商场优惠券的核销、退款、异常处理和报表统计。

## 功能特性

### 1. 异常看板
- 实时统计待处理异常、拦截核销、今日退款、今日核销等数据
- 异常退款列表展示和处理功能
- 会员总数和可用券数统计

### 2. 会员管理
- 会员列表查询和筛选
- 会员等级修改
- 完整的审计日志记录

### 3. 活动券包
- 券包列表查询
- 券包使用统计（总券数、已用、剩余）
- 修改前后值记录

### 4. 核销记录
- 核销记录列表查询和筛选
- 门店核销校验和拦截功能
- 支持按门店、会员、时间范围筛选
- 导出 CSV 功能

### 5. 退款记录
- 退款记录查询和筛选
- 异常退款处理
- 支持按处理人、处理时间筛选
- 导出 CSV 功能

### 6. 批量导入
- 支持会员数据和核销记录批量导入
- 导入历史记录查看
- 成功/失败统计

### 7. 统计报表
- 核销汇总统计（按门店、会员等级）
- 退款汇总统计（按门店、状态）
- 支持按时间范围查询
- 数据合计展示

### 8. 审计日志
- 完整的操作记录
- 支持按目标类型、操作人、时间范围筛选
- 修改前后值对比

## 技术栈

### 后端
- Node.js + Express
- SQLite3 (文件数据库，重启不丢失数据)
- csv-parser + json2csv (导入导出)
- multer (文件上传)

### 前端
- React 18
- Ant Design 4
- React Router 6
- Axios
- Moment.js

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 2. 初始化数据库

```bash
# 创建数据库表
npm run init-db

# 插入演示数据
npm run seed-data
```

### 3. 启动服务

```bash
# 方式一：分别启动后端和前端
# 启动后端服务 (端口 3001)
npm start

# 启动前端服务 (端口 3000)
cd frontend
npm start

# 方式二：使用 concurrently 同时启动 (需要先全局安装 concurrently)
npm run dev
```

### 4. 访问系统

打开浏览器访问：http://localhost:3000

## 演示数据说明

系统预置了以下演示数据：

### 会员数据 (8人)
- 普通会员、银卡、金卡、铂金、钻石等不同等级
- 包含积分信息

### 门店数据 (5家)
- 朝阳门店、海淀店、西城店、东城店、丰台店

### 券包数据
- 五一黄金周活动券包
- 母亲节特惠券包
- 会员专享年中庆
- 钻石VIP尊享券包
- 新会员欢迎券包
- 618大促券包
- 端午粽香券包
- 父亲节感恩券包

### 核销记录 (17条)
- 包含正常核销、已退款、已拦截等状态

### 退款记录 (6条)
- 包含成功返券、异常待处理等状态
- 示例异常：券过期、疑似刷单等

## 数据库文件

SQLite 数据库文件位于：`data/mall_coupon.db`

该文件会持久化保存所有数据，重启服务后不会丢失。

## 项目结构

```
mall-coupon-refund/
├── backend/
│   ├── server.js          # 后端服务入口
│   ├── database/
│   │   └── db.js          # 数据库连接
│   └── scripts/
│       ├── initDB.js      # 数据库表初始化
│       └── seedData.js    # 演示数据插入
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.js         # 主应用组件
│       ├── index.js       # 入口文件
│       └── pages/         # 页面组件
│           ├── Dashboard.js
│           ├── Members.js
│           ├── CouponPackages.js
│           ├── Verifications.js
│           ├── Refunds.js
│           ├── Import.js
│           ├── Reports.js
│           └── AuditLogs.js
├── data/                  # 数据库文件目录
├── uploads/              # 上传文件临时目录
├── package.json          # 后端依赖配置
└── README.md
```

## API 接口

### 看板
- `GET /api/dashboard/stats` - 获取统计数据
- `GET /api/dashboard/exceptions` - 获取异常列表

### 会员
- `GET /api/members` - 获取会员列表
- `GET /api/members/:id` - 获取会员详情
- `PUT /api/members/:id` - 修改会员信息

### 券包
- `GET /api/coupon-packages` - 获取券包列表
- `GET /api/coupons` - 获取优惠券列表

### 核销
- `GET /api/verifications` - 获取核销列表
- `PUT /api/verifications/:id/block` - 拦截/解除拦截核销

### 退款
- `GET /api/refunds` - 获取退款列表
- `PUT /api/refunds/:id/handle` - 处理退款异常

### 门店
- `GET /api/stores` - 获取门店列表

### 导入导出
- `POST /api/import` - 批量导入数据
- `GET /api/export/verifications` - 导出来核销记录
- `GET /api/export/refunds` - 导出退款记录
- `GET /api/import-records` - 获取导入历史

### 报表
- `GET /api/reports/verification-summary` - 核销汇总报表
- `GET /api/reports/refund-summary` - 退款汇总报表

### 审计日志
- `GET /api/audit-logs` - 获取审计日志列表
