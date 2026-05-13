# 🍰 烘焙预订单排产系统

一个偏 API 设计的全栈烘焙订单管理系统，包含完整的业务规则校验、改期流程、数据导出等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite3
- **前端**: 原生 HTML/JavaScript
- **Excel导出**: ExcelJS

## 功能特性

### 核心业务逻辑

1. **口味配方管理**
   - 配方的增删改查
   - 完整版本历史记录（保留修改前后值）
   - 操作日志记录

2. **烤炉容量校验**
   - 自动计算烤炉可用容量
   - 根据取货时间和订单数量进行校验
   - 烤炉信息版本管理

3. **原料库存检查**
   - 根据配方自动计算所需原料
   - 库存不足时拦截订单
   - 库存变更版本记录

4. **取货时间规则**
   - 不能早于当前时间
   - 需要提前至少2小时下单
   - 取货时间限定在 8:00-20:00

5. **生产班次统计**
   - 自动根据取货时间分配班次
   - 班次订单量统计

6. **改期申请流程**
   - 容量充足时自动批准
   - 容量不足时人工审核
   - 完整的改期时间线记录

### 四大内置场景

1. **正常完成 (normal_complete)**
   - 所有规则校验通过
   - 订单成功创建 / 改期自动批准

2. **被规则挡住 (rule_blocked)**
   - 取货时间不符合规则
   - 烤炉容量不足
   - 原料库存不足

3. **人工复核 (manual_review)**
   - 改期申请容量不足
   - 需要管理员审核批准/拒绝

4. **重复提交 (duplicate_submit)**
   - 防止同一用户同一日期同一产品重复下单

### 报告导出功能

1. **改期申请报告**
   - 支持按申请人筛选
   - 支持按审核人筛选
   - 支持按时间范围筛选
   - 支持按状态筛选
   - 导出 Excel 格式

2. **变更历史报告**
   - 支持按操作人筛选
   - 支持按时间范围筛选
   - 包含新旧值对比

## 项目结构

```
├── backend/
│   ├── src/
│   │   ├── app.js              # 主应用入口
│   │   ├── utils/
│   │   │   └── db.js           # 数据库工具
│   │   ├── routes/
│   │   │   ├── flavorRecipes.js    # 口味配方路由
│   │   │   ├── ovenCapacities.js   # 烤炉容量路由
│   │   │   ├── ingredientStocks.js # 原料库存路由
│   │   │   ├── orders.js           # 订单路由
│   │   │   └── reports.js          # 报告路由
│   │   └── scripts/
│   │       └── init-db.js      # 数据库初始化脚本
│   └── data/                    # SQLite 数据库文件
├── frontend/
│   └── index.html               # 前端页面
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动后端服务器

```bash
npm start
# 或开发模式
npm run dev
```

服务器运行在: http://localhost:3001

### 4. 打开前端页面

直接在浏览器打开: `frontend/index.html`

## API 端点

### 口味配方

- `GET /api/flavor-recipes` - 获取所有配方
- `GET /api/flavor-recipes/:id` - 获取单个配方及版本
- `POST /api/flavor-recipes` - 创建配方
- `PUT /api/flavor-recipes/:id` - 更新配方
- `DELETE /api/flavor-recipes/:id` - 删除配方

### 烤炉容量

- `GET /api/oven-capacities` - 获取所有烤炉
- `GET /api/oven-capacities/:id` - 获取单个烤炉及版本
- `POST /api/oven-capacities` - 创建烤炉
- `PUT /api/oven-capacities/:id` - 更新烤炉
- `DELETE /api/oven-capacities/:id` - 删除烤炉

### 原料库存

- `GET /api/ingredient-stocks` - 获取所有原料
- `GET /api/ingredient-stocks/:id` - 获取单个原料及版本
- `POST /api/ingredient-stocks` - 创建原料
- `PUT /api/ingredient-stocks/:id` - 更新原料
- `DELETE /api/ingredient-stocks/:id` - 删除原料

### 订单管理

- `GET /api/orders` - 获取所有订单
- `GET /api/orders/:id` - 获取单个订单及时间线
- `POST /api/orders` - 创建订单
- `POST /api/orders/:id/reschedule` - 申请改期
- `POST /api/orders/reschedule/:id/review` - 审核改期
- `GET /api/orders/:id/timeline` - 获取订单时间线
- `GET /api/orders/statistics/shifts` - 获取班次统计

### 报告导出

- `GET /api/reports/logs` - 获取操作日志
- `GET /api/reports/reschedule` - 获取改期申请
- `GET /api/reports/export/reschedule` - 导出改期报告
- `GET /api/reports/export/changes` - 导出变更历史

## 数据库表结构

1. `flavor_recipes` - 口味配方
2. `flavor_recipe_versions` - 配方版本历史
3. `oven_capacities` - 烤炉容量
4. `oven_capacity_versions` - 烤炉版本历史
5. `ingredient_stocks` - 原料库存
6. `ingredient_stock_versions` - 库存版本历史
7. `production_shifts` - 生产班次
8. `orders` - 订单
9. `reschedule_requests` - 改期申请
10. `operation_logs` - 操作日志
11. `order_timeline` - 订单时间线

## 内置测试数据

初始化数据库后会自动创建：

- 4 种口味配方（经典黄油曲奇、巧克力布朗尼、抹茶红豆蛋糕、芝士蛋糕）
- 3 个烤炉（不同容量和时间段）
- 8 种原料库存
- 3 个生产班次（早班、中班、晚班）

## 使用说明

### 创建订单场景测试

1. **正常场景**: 选择未来2小时后的时间，数量合理 → 成功
2. **时间错误**: 选择过去时间或不足2小时 → 被规则挡住
3. **容量过大**: 输入很大的数量 → 烤炉容量不足
4. **重复提交**: 同一客户同一日期同一产品重复提交 → 拦截

### 改期流程测试

1. 先创建一个订单
2. 点击查看详情，申请改期
3. 选择不同时间，观察是自动批准还是人工审核
4. 在"改期申请"页面审核待处理的申请

### 报告导出

1. 在"导出报告"页面设置筛选条件
2. 点击导出按钮下载 Excel 文件
3. 报告包含完整的改期信息或变更历史
