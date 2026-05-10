# 社群课程返佣结算台

一个完整的社群课程返佣结算管理系统，支持订单管理、团长归属、退款处理、改价审批和月度结算。

## 功能特性

### 核心功能
- **订单管理**：支持订单导入、创建、查询、导出
- **团长管理**：团长信息维护、返佣比例设置
- **退款处理**：支持全额/部分退款，自动冲减佣金
- **改价审批**：订单价格调整审批流程
- **月度结算**：按账期自动生成结算，支持导出

### 业务规则
- **防止重复计佣**：已结算订单不会重复计入结算
- **退款冲减**：已结算订单的退款会自动扣减对应结算金额
- **跨月结算**：订单按付款时间归属到正确账期
- **改价生效**：审批通过后价格和佣金立即更新

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React + Ant Design + Axios
- **数据处理**：xlsx（Excel导入导出）

## 项目结构

```
.
├── backend/                 # 后端代码
│   ├── config/             # 配置文件
│   │   └── database.js     # 数据库配置
│   ├── utils/              # 工具函数
│   │   └── commission.js   # 佣金计算工具
│   ├── seeders/            # 数据填充
│   │   └── seed.js         # 测试数据生成
│   ├── test/               # 测试脚本
│   │   └── scenarios.js    # 场景测试
│   ├── server.js           # 主服务
│   └── package.json        # 后端依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   │   ├── Dashboard.jsx          # 仪表盘
│   │   │   ├── Orders.jsx             # 订单管理
│   │   │   ├── TeamLeaders.jsx        # 团长管理
│   │   │   ├── Settlements.jsx        # 结算管理
│   │   │   ├── Refunds.jsx            # 退款处理
│   │   │   └── PriceChangeRequests.jsx # 改价审批
│   │   ├── App.jsx         # 主应用
│   │   ├── main.jsx        # 入口文件
│   │   └── index.css       # 样式文件
│   ├── index.html          # HTML模板
│   ├── vite.config.js      # Vite配置
│   └── package.json        # 前端依赖
└── README.md               # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 启动服务

```bash
# 启动后端服务（端口 5000）
cd backend
npm start

# 另开终端，启动前端（端口 3000）
cd frontend
npm run dev
```

### 3. 访问应用

- 前端地址：http://localhost:3000
- 后端API：http://localhost:5000

### 4. 填充测试数据（可选）

```bash
cd backend
npm run seed
```

## API 接口

### 团长管理
- `GET /api/team-leaders` - 获取团长列表
- `POST /api/team-leaders` - 创建团长

### 订单管理
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单
- `POST /api/orders/import` - 批量导入订单
- `POST /api/orders/:id/refund` - 处理退款

### 改价审批
- `GET /api/price-change-requests` - 获取改价申请
- `POST /api/price-change-requests` - 创建改价申请
- `POST /api/price-change-requests/:id/approve` - 审批改价

### 结算管理
- `GET /api/settlements` - 获取结算列表
- `GET /api/settlements/:id` - 获取结算详情
- `POST /api/settlements/generate` - 生成月度结算

### 统计和导出
- `GET /api/stats/leaderboard` - 团长排行榜
- `GET /api/stats/abnormal-orders` - 异常订单
- `GET /api/export/settlements/:period` - 导出结算表
- `GET /api/export/orders` - 导出订单

## 场景测试

项目包含6个完整的业务场景测试，可以通过命令行交互式运行：

```bash
cd backend
node test/scenarios.js
```

### 测试场景

1. **正常订单流程**：创建团长→创建订单→生成结算→验证状态
2. **部分退款场景**：创建订单→部分退款→验证佣金扣减
3. **改价审批流程**：创建订单→创建改价申请→审批通过→验证佣金更新
4. **改价审批失败**：创建订单→创建改价申请→审批驳回→验证价格不变
5. **跨月结算场景**：创建1月和2月订单→分别生成结算→验证账期归属
6. **退款冲减已结算**：创建订单→生成结算→退款→验证结算金额冲减

## 导入导出说明

### 订单导入格式

支持 .xlsx, .xls, .csv 格式，必需列：
- 课程名称
- 学员姓名
- 原价
- 付款时间
- 团长ID
- 团长名称

可选列：
- 订单号（不填则自动生成）
- 学员电话
- 实付金额（默认等于原价）
- 返佣比例（默认20%）

### 结算导出格式

导出Excel包含两个Sheet：
- **结算汇总**：按团长汇总的结算数据
- **订单明细**：每个订单的详细信息

## 数据库表结构

- `team_leaders` - 团长表
- `courses` - 课程表
- `orders` - 订单表（含退款、结算状态）
- `settlements` - 结算表
- `price_change_requests` - 改价申请表
- `refunds` - 退款记录表

## 业务数据示例

系统预置了完整的测试数据场景，包括：

### 团长数据
- 张三（25%返佣）- 3个订单
- 李四（20%返佣）- 2个订单
- 王五（30%返佣）- 2个订单
- 赵六（20%返佣）- 2个订单
- 钱七（25%返佣）- 1个订单

### 订单数据
- 2024年1月：5个订单
- 2024年2月：5个订单

## 主要页面

1. **仪表盘**：数据概览、团长排行榜、异常订单
2. **订单管理**：订单列表、批量导入、导出
3. **团长管理**：团长信息、订单明细
4. **结算管理**：生成月度结算、查看详情、导出
5. **退款处理**：订单退款、佣金扣减展示
6. **改价审批**：创建申请、审批流程

## 注意事项

- 数据库文件默认保存在 `backend/database/commission.db`
- 导出文件保存在 `backend/exports/` 目录
- 每个账期只能生成一次结算
- 已结算订单不允许改价
- 退款金额不能超过实付金额
