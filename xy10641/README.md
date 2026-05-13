# 农资赊销授信回款管理系统

一个完整的农资赊销授信回款全栈管理系统，支持农户授信、赊销订单、季节还款、逾期分级、展期审批、催收清单等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React 18 + Vite + React Router
- **Excel导出**: exceljs

## 系统特性

### 核心功能
1. **农户授信管理**
   - 授信申请、审批、拒绝
   - 授信额度管理、已用额度追踪
   - 变更记录留痕

2. **赊销订单管理**
   - 创建订单、确认订单
   - 关联授信额度扣减
   - 商品明细记录

3. **季节还款管理**
   - 自动生成还款计划
   - 部分还款、全额还款
   - 还款记录追踪

4. **逾期分级拦截**
   - M1: 1-30天逾期
   - M2: 31-60天逾期
   - M3: 61-90天逾期（需催收后才能还款）
   - M4: 90天以上逾期（需催收后才能还款）

5. **展期审批**
   - 展期申请
   - 审批流程
   - 自动更新还款到期日

6. **催收清单**
   - 自动生成催收任务
   - 催收记录追踪
   - 催收状态管理

7. **责任节点报告**
   - 完整操作时间线
   - 按责任人筛选
   - 按时间范围筛选
   - Excel导出功能

### 关键特性
- **修改前后值记录**: 授信、订单、还款的所有字段变更均记录旧值和新值
- **重复回调不重复扣减**: 还款时传入callback_id自动去重
- **操作时间线**: 所有操作完整记录，支持追溯
- **状态流管理**: 各业务节点状态自动推进

## 项目结构

```
├── backend/                 # 后端服务
│   ├── package.json
│   ├── server.js           # 入口文件
│   ├── database.js         # 数据库配置
│   └── routes.js           # API路由
├── frontend/               # 前端应用
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── pages/          # 页面组件
│           ├── Credits.jsx
│           ├── CreditDetail.jsx
│           ├── Orders.jsx
│           ├── Repayments.jsx
│           ├── Extensions.jsx
│           ├── Collections.jsx
│           ├── Report.jsx
│           └── SampleData.jsx
└── README.md
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 http://localhost:3001 启动

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

### 3. 访问应用

打开浏览器访问: http://localhost:3000

## 功能演示

进入"样例演示"页面，可以创建三种测试流程：

1. **正常流程**: 完整的业务流程演示
2. **问题流程**: 逾期分级和催收功能演示
3. **复核流程**: 审批留痕功能演示

## API接口

### 农户接口
- `GET /api/farmers` - 获取农户列表
- `POST /api/farmers` - 创建农户

### 授信接口
- `GET /api/credits` - 获取授信列表
- `GET /api/credits/:id` - 获取授信详情
- `POST /api/credits` - 创建授信申请
- `POST /api/credits/:id/approve` - 审批通过
- `POST /api/credits/:id/reject` - 拒绝审批

### 订单接口
- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 创建订单
- `POST /api/orders/:id/confirm` - 确认订单

### 还款接口
- `GET /api/repayments` - 获取还款列表
- `POST /api/repayments/:id/pay` - 还款
- `POST /api/repayments/check-overdue` - 检查逾期

### 展期接口
- `GET /api/extensions` - 获取展期列表
- `POST /api/extensions` - 申请展期
- `POST /api/extensions/:id/approve` - 审批通过
- `POST /api/extensions/:id/reject` - 拒绝审批

### 催收接口
- `GET /api/collections` - 获取催收清单
- `POST /api/collections/:id/collect` - 执行催收
- `POST /api/collections/:id/complete` - 完成催收

### 报告接口
- `GET /api/report` - 获取责任节点报告
- `GET /api/report/export` - 导出Excel报告

## 数据库表说明

- `farmers` - 农户信息表
- `credit_applications` - 授信申请表
- `credit_audit_logs` - 授信变更日志
- `sales_orders` - 赊销订单表
- `order_audit_logs` - 订单变更日志
- `seasonal_repayments` - 季节还款表
- `repayment_audit_logs` - 还款变更日志
- `repayment_records` - 还款记录表
- `extension_applications` - 展期申请表
- `collection_lists` - 催收清单表
- `operation_timelines` - 操作时间线表

## 注意事项

- 数据库使用SQLite，数据文件自动生成在backend目录下
- 前端使用Vite开发服务器，生产环境需要构建
- 所有操作都会记录操作人和操作时间，支持责任追溯
