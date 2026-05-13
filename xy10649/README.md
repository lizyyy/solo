# 企业礼品客户发放管理系统

一个完整的企业礼品发放管理全栈应用，包含礼品库存管理、活动计划、客户名单、员工领用、快递单号、退回入库、异常看板和报表导出等功能。

## 功能特性

### 核心功能模块
1. **数据概览** - 统计卡片展示关键数据，待处理异常列表
2. **礼品库存** - 管理礼品信息，支持增删改查，记录修改历史
3. **活动计划** - 管理礼品发放活动，支持时间范围、预算等设置
4. **客户名单** - 管理接收礼品的客户信息，支持关联活动
5. **员工领用** - 记录员工领用礼品的信息，支持审批流程
6. **快递单号** - 管理快递信息，跟踪物流状态
7. **退回入库** - 记录退回的礼品，支持按原因分类
8. **异常看板** - 管理系统异常，记录修改前后值对比
9. **报表导出** - 导出Excel报表，支持按责任人和时间筛选

### 重要特性
- **修改历史追踪** - 礼品库存、活动计划、客户名单的所有修改都会记录历史，包含修改前后值
- **异常管理** - 支持记录和处理各类异常，明确显示修改前后对比
- **灵活筛选** - 各模块都支持搜索和筛选功能
- **报表导出** - 导出完整的Excel报表，支持按责任人和处理时间筛选
- **响应式设计** - 适配不同屏幕尺寸

## 技术栈

### 后端
- Node.js + Express - Web框架
- SQLite3 - 数据库
- ExcelJS - Excel报表生成
- CORS - 跨域支持
- Body-Parser - 请求解析

### 前端
- React 18 - UI框架
- Vite - 构建工具
- Ant Design 5 - UI组件库
- React Router - 路由管理
- Axios - HTTP客户端
- Moment.js - 日期处理

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 启动方式

#### 方式一：使用启动脚本（推荐）
```bash
# 给脚本添加执行权限
chmod +x start.sh

# 运行启动脚本
./start.sh
```

#### 方式二：手动启动
```bash
# 1. 启动后端服务
cd backend
npm install
node init-data.js  # 初始化数据（仅首次需要）
node server.js     # 后端运行在 http://localhost:3001

# 2. 新开终端，启动前端服务
cd frontend
npm install
npm run dev       # 前端运行在 http://localhost:3000
```

### 访问地址
- 前端应用: http://localhost:3000
- 后端API: http://localhost:3001

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── server.js           # 服务器入口
│   ├── database.js         # 数据库配置和初始化
│   ├── init-data.js        # 初始化数据脚本
│   ├── package.json        # 依赖配置
│   ├── routes/             # API路由
│   │   ├── index.js        # 路由入口
│   │   ├── inventory.js    # 库存管理
│   │   ├── plans.js        # 活动计划
│   │   ├── customers.js    # 客户名单
│   │   ├── claims.js       # 员工领用
│   │   ├── express.js      # 快递单号
│   │   ├── returns.js      # 退回入库
│   │   ├── exceptions.js   # 异常管理
│   │   ├── reports.js      # 报表导出
│   │   └── stats.js        # 统计数据
│   ├── data/               # SQLite数据库文件（自动生成）
│   └── exports/            # 导出的报表文件（自动生成）
├── frontend/               # 前端项目
│   ├── index.html          # HTML入口
│   ├── package.json        # 依赖配置
│   ├── vite.config.js      # Vite配置
│   └── src/
│       ├── main.jsx        # 应用入口
│       ├── App.jsx         # 主应用组件
│       ├── index.css       # 全局样式
│       ├── services/       # API服务
│       │   └── api.js      # API封装
│       ├── components/     # 公共组件
│       │   └── Layout.jsx  # 布局组件
│       └── pages/          # 页面组件
│           ├── Dashboard.jsx    # 数据概览
│           ├── Inventory.jsx    # 礼品库存
│           ├── Plans.jsx        # 活动计划
│           ├── Customers.jsx    # 客户名单
│           ├── Claims.jsx       # 员工领用
│           ├── Express.jsx      # 快递单号
│           ├── Returns.jsx      # 退回入库
│           ├── Exceptions.jsx   # 异常看板
│           └── Reports.jsx      # 报表导出
├── start.sh                # 启动脚本
└── README.md               # 项目文档
```

## 数据库设计

### 主要表结构
1. `gift_inventory` - 礼品库存表
2. `gift_inventory_history` - 库存修改历史表
3. `activity_plans` - 活动计划表
4. `activity_plans_history` - 活动计划修改历史表
5. `customer_lists` - 客户名单表
6. `customer_lists_history` - 客户名单修改历史表
7. `employee_claims` - 员工领用表
8. `express_orders` - 快递单表
9. `return_inventory` - 退回入库表
10. `exception_records` - 异常记录表

## API接口文档

### 库存管理
- `GET /api/inventory` - 获取库存列表（支持筛选）
- `GET /api/inventory/:id` - 获取单个库存信息
- `GET /api/inventory/:id/history` - 获取修改历史
- `POST /api/inventory` - 新增库存
- `PUT /api/inventory/:id` - 更新库存
- `DELETE /api/inventory/:id` - 删除库存

### 活动计划
- `GET /api/plans` - 获取计划列表（支持筛选）
- `GET /api/plans/:id` - 获取单个计划
- `GET /api/plans/:id/history` - 获取修改历史
- `POST /api/plans` - 新增计划
- `PUT /api/plans/:id` - 更新计划
- `DELETE /api/plans/:id` - 删除计划

### 客户名单
- `GET /api/customers` - 获取客户列表（支持筛选）
- `GET /api/customers/:id` - 获取单个客户
- `GET /api/customers/:id/history` - 获取修改历史
- `POST /api/customers` - 新增客户
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户

### 员工领用
- `GET /api/claims` - 获取领用列表（支持筛选）
- `GET /api/claims/:id` - 获取单个领用
- `POST /api/claims` - 新增领用
- `PUT /api/claims/:id` - 更新领用
- `DELETE /api/claims/:id` - 删除领用

### 快递单号
- `GET /api/express` - 获取快递列表（支持筛选）
- `GET /api/express/:id` - 获取单个快递
- `POST /api/express` - 新增快递
- `PUT /api/express/:id` - 更新快递
- `DELETE /api/express/:id` - 删除快递

### 退回入库
- `GET /api/returns` - 获取退回列表（支持筛选）
- `GET /api/returns/:id` - 获取单个退回
- `POST /api/returns` - 新增退回
- `PUT /api/returns/:id` - 更新退回
- `DELETE /api/returns/:id` - 删除退回

### 异常管理
- `GET /api/exceptions` - 获取异常列表（支持筛选）
- `GET /api/exceptions/:id` - 获取单个异常
- `POST /api/exceptions` - 新增异常
- `PUT /api/exceptions/:id` - 更新异常
- `DELETE /api/exceptions/:id` - 删除异常

### 报表导出
- `GET /api/reports/export` - 导出Excel报表
  - 参数: `responsible_person`（责任人）, `start_date`, `end_date`（时间范围）
- `GET /api/reports/summary` - 获取汇总数据

### 统计数据
- `GET /api/stats` - 获取首页统计数据

## 报表导出说明

### 导出内容
报表导出包含以下所有模块的完整数据：
1. 礼品库存
2. 活动计划
3. 客户名单
4. 员工领用
5. 快递单号
6. 退回入库
7. 异常记录

### 筛选条件
- **责任人**: 按处理人/责任人筛选相关数据
- **处理时间范围**: 按时间范围筛选数据

### 文件格式
- 格式: Excel (.xlsx)
- 每个模块对应一个工作表
- 包含完整的字段信息

## 初始化数据

首次运行时，`init-data.js`脚本会自动生成测试数据，包括：
- 10条礼品库存记录
- 5条活动计划记录
- 20条客户名单记录
- 15条员工领用记录
- 15条快递单号记录
- 8条退回入库记录
- 6条异常记录

## 开发说明

### 后端开发
```bash
cd backend
npm run dev  # 使用nodemon自动重载（需先安装nodemon）
```

### 前端开发
```bash
cd frontend
npm run dev  # 启动开发服务器，支持热重载
```

### 构建生产版本
```bash
cd frontend
npm run build
```

## 注意事项

1. 数据库文件位于 `backend/data/gift_management.db`，首次运行自动创建
2. 导出的报表文件位于 `backend/exports/` 目录
3. 所有修改操作都会记录历史，支持追溯变更
4. 异常记录会保存修改前后的值，便于对比分析
5. 报表导出支持按责任人和时间范围筛选

## 许可证

MIT
