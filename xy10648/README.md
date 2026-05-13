# 社团经费票据报销系统

一个完整的社团经费管理全栈应用，支持预算管理、活动申请、采购明细、票据审核、补资料、支付进度等功能。

## 功能特性

### 核心模块
- **预算管理**: 创建、编辑、冻结社团预算，记录预算变更历史
- **活动申请**: 社团活动立项、审批、修改全过程管理
- **采购明细**: 活动采购物品记录，支持审核流程
- **票据审核**: 上传和审核报销票据
- **补资料管理**: 资料不全时发起补充请求
- **支付进度**: 跟踪支付状态，支持幂等性保证

### 特色功能
1. **四种业务路径**:
   - 正常路径: 预算→活动→采购→票据→支付
   - 拦截路径: 审核拒绝终止流程
   - 复核路径: 补资料后重新审核
   - 导出路径: 按责任人/时间筛选导出Excel

2. **数据持久化**: SQLite数据库存储，服务重启数据不丢失
3. **幂等性保证**: 重复支付请求不会造成重复支付
4. **修改历史追踪**: 预算、活动、采购修改前后值记录
5. **操作日志**: 完整记录所有操作，支持筛选和导出
6. **复核面板**: 统一查看待审核事项

## 技术栈

### 后端
- Node.js + Express
- SQLite3 (数据库)
- exceljs (Excel导出)
- uuid (唯一标识)

### 前端
- React 18
- Ant Design (UI组件库)
- React Router (路由)
- Axios (HTTP客户端)
- Moment.js (日期处理)

## 项目结构

```
club-expense-system/
├── server/
│   ├── database.js          # 数据库配置和表结构
│   ├── index.js             # 服务入口
│   ├── routes/
│   │   ├── budgets.js       # 预算管理API
│   │   ├── activities.js    # 活动管理API
│   │   ├── purchases.js     # 采购管理API
│   │   ├── invoices.js      # 票据审核API
│   │   ├── supplements.js   # 补资料API
│   │   ├── payments.js      # 支付管理API
│   │   └── logs.js          # 操作日志API
│   └── scripts/
│       └── initData.js      # 样例数据初始化
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js         # React入口
│       ├── App.js           # 主应用组件
│       └── pages/
│           ├── Dashboard.js    # 仪表盘
│           ├── Budgets.js      # 预算管理
│           ├── Activities.js   # 活动管理
│           ├── Purchases.js    # 采购明细
│           ├── Invoices.js     # 票据审核
│           ├── Payments.js     # 支付进度
│           ├── ReviewPanel.js  # 复核面板
│           └── Logs.js         # 操作日志
├── data/                       # 数据库文件目录
└── package.json               # 项目配置
```

## 安装和运行

### 前置要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装步骤

1. **安装后端依赖**
```bash
npm install
```

2. **初始化数据库和样例数据**
```bash
npm run init-db
```

3. **启动后端服务**
```bash
npm start
# 或使用nodemon开发模式
npm run server
```
后端服务将运行在 http://localhost:3001

4. **安装前端依赖**
```bash
cd client
npm install
```

5. **启动前端开发服务器**
```bash
cd client
npm start
```
前端将运行在 http://localhost:3000

### 同时运行前后端
```bash
npm run dev
```

## API接口文档

### 预算管理
- `GET /api/budgets` - 获取预算列表
- `GET /api/budgets/:id` - 获取单个预算
- `GET /api/budgets/:id/history` - 获取预算修改历史
- `POST /api/budgets` - 创建预算
- `PUT /api/budgets/:id` - 更新预算
- `PATCH /api/budgets/:id/status` - 修改预算状态

### 活动管理
- `GET /api/activities` - 获取活动列表
- `GET /api/activities/:id` - 获取单个活动
- `GET /api/activities/:id/history` - 获取活动修改历史
- `GET /api/activities/:id/purchases` - 获取活动关联采购
- `POST /api/activities` - 创建活动
- `PUT /api/activities/:id` - 更新活动
- `PATCH /api/activities/:id/status` - 修改活动状态

### 采购管理
- `GET /api/purchases` - 获取采购列表
- `GET /api/purchases/:id` - 获取单个采购
- `GET /api/purchases/:id/history` - 获取采购修改历史
- `POST /api/purchases` - 创建采购
- `PUT /api/purchases/:id` - 更新采购
- `PATCH /api/purchases/:id/status` - 修改采购状态

### 票据审核
- `GET /api/invoices` - 获取票据列表
- `GET /api/invoices/:id` - 获取单个票据
- `POST /api/invoices` - 上传票据
- `PATCH /api/invoices/:id/status` - 审核票据
- `GET /api/invoices/:id/supplements` - 获取补资料请求

### 补资料管理
- `GET /api/supplements` - 获取补资料列表
- `POST /api/supplements` - 发起补资料请求
- `PATCH /api/supplements/:id/respond` - 回复补资料

### 支付管理
- `GET /api/payments` - 获取支付列表
- `POST /api/payments` - 发起支付（幂等，request_id重复返回原有记录）
- `PATCH /api/payments/:id/status` - 修改支付状态

### 操作日志
- `GET /api/logs` - 获取操作日志（支持按operator、target_type筛选）
- `GET /api/logs/export` - 导出Excel报表
  - 参数: `responsible_person` (责任人), `start_date`, `end_date`

## 数据库设计

### 主要数据表
1. `club_budgets` - 社团预算表
2. `budget_history` - 预算修改历史
3. `activity_applications` - 活动申请表
4. `activity_history` - 活动修改历史
5. `purchase_items` - 采购明细表
6. `purchase_history` - 采购修改历史
7. `invoice_reviews` - 票据审核表
8. `supplement_requests` - 补资料请求表
9. `payment_progress` - 支付进度表
10. `operation_logs` - 操作日志表

## 样例数据

执行 `npm run init-db` 将初始化以下样例数据:

### 预算示例
- 计算机协会 2024年度预算: 50,000元
- 文艺社团 2024年度预算: 30,000元

### 活动示例
- 编程大赛 (已批准)
- 技术分享会 (审核中)
- 迎新晚会 (已拒绝)
- 舞蹈培训 (待提交)

### 采购示例
- 奖杯奖牌 (已批准)
- 打印资料 (已批准)
- 小礼品 (待审核)

### 票据和支付
- 票据INV-2024-001 (已批准)
- 票据INV-2024-002 (待审核)
- 支付PAY-REQ-001 (已完成)

## 使用说明

1. **正常报销流程**
   - 创建预算 → 提交活动申请 → 添加采购明细 → 上传票据 → 审核通过 → 发起支付 → 支付完成

2. **审核拒绝处理**
   - 票据审核不通过 → 发起补资料请求 → 补充资料 → 重新审核

3. **数据导出**
   - 进入操作日志页面 → 筛选责任人/日期范围 → 点击"导出Excel"

4. **查看修改历史**
   - 在预算/活动/采购页面点击"历史"按钮 → 查看修改前后对比

## 关键特性验证

### 幂等性验证
```javascript
// 两次请求相同request_id，只产生一笔支付
POST /api/payments
{
  "activity_id": "...",
  "request_id": "PAY-TEST-001",
  "amount": 1000,
  ...
}
// 第二次请求将返回原有支付记录
```

### 数据持久化验证
- 重启服务后数据不丢失: `npm start` → 创建数据 → 重启服务 → 数据仍在

### 修改历史验证
- 修改预算/活动/采购后 → 点击"历史" → 查看before_data和after_data

## 开发说明

### 添加新的API接口
1. 在 `server/routes/` 下创建新路由文件
2. 在 `server/index.js` 中注册路由

### 添加新页面
1. 在 `client/src/pages/` 下创建页面组件
2. 在 `client/src/App.js` 中添加路由和菜单

### 数据库修改
- 修改 `server/database.js` 添加新表
- 在 `server/scripts/initData.js` 添加初始化数据

## 许可证

MIT
