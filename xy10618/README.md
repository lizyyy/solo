# 私教课包消课退款管理系统

一个功能完整的私教课包消课退款管理全栈系统，包含会员课包管理、教练排班、请假扣课、转课分成、退款试算、余额账本等核心功能。

## 功能特性

### 核心功能
- **会员课包管理**：创建、查看会员课包信息
- **教练排班**：安排课程、消课处理
- **请假扣课**：申请请假、审批扣课
- **转课分成**：会员间转课、分成计算
- **退款试算**：退款金额试算、审批流程
- **余额账本**：完整的资金和课时流水记录
- **操作日志**：所有操作记录审计
- **数据导出**：支持按操作人、时间范围筛选导出Excel

### 关键特性
1. **幂等性保证**：重复请求不会导致账本数据重复
2. **数据持久化**：使用SQLite数据库，服务重启数据不丢失
3. **审批流程**：请假扣课、转课、退款都需要审批流程
4. **修改前后值**：保留所有修改的前后值，支持审计追溯
5. **四种路径**：
   - 正常流程：课包购买 → 排课 → 消课
   - 拦截流程：课时不足时拦截操作
   - 复核流程：审批机制
   - 导出流程：Excel数据导出

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- 幂等性中间件
- Excel导出 (exceljs)

### 前端
- React 18
- Ant Design 5
- Axios

## 快速开始

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 启动项目

#### 方式一：同时启动前后端（推荐）

```bash
# 需要先安装 concurrently
npm install -g concurrently
npm run dev
```

#### 方式二：分别启动

```bash
# 启动后端（端口 3001）
npm start

# 新开终端，启动前端（端口 3000）
cd client
npm start
```

### 访问应用

- 前端界面：http://localhost:3000
- 后端API：http://localhost:3001/api

## API 接口列表

### 会员课包
- `GET /api/packages` - 获取所有课包
- `GET /api/packages/:id` - 获取单个课包
- `POST /api/packages` - 创建课包
- `PUT /api/packages/:id` - 更新课包

### 教练排班
- `GET /api/schedules` - 获取所有排班
- `POST /api/schedules` - 创建排班
- `PUT /api/schedules/:id/status` - 更新排班状态

### 请假扣课
- `GET /api/leave` - 获取所有扣课申请
- `POST /api/leave` - 创建扣课申请
- `PUT /api/leave/:id/approve` - 批准扣课
- `PUT /api/leave/:id/reject` - 拒绝扣课

### 转课分成
- `GET /api/transfers` - 获取所有转课申请
- `POST /api/transfers` - 创建转课申请
- `PUT /api/transfers/:id/approve` - 批准转课
- `PUT /api/transfers/:id/reject` - 拒绝转课

### 退款管理
- `GET /api/refunds` - 获取所有退款申请
- `POST /api/refunds/calculate` - 试算退款金额
- `POST /api/refunds` - 创建退款申请
- `PUT /api/refunds/:id/approve` - 批准退款
- `PUT /api/refunds/:id/reject` - 拒绝退款

### 余额账本
- `GET /api/ledger` - 获取所有账本记录
- `GET /api/ledger/member/:memberId` - 获取会员账本

### 操作日志
- `GET /api/logs` - 获取所有操作日志
- `GET /api/logs/module/:moduleName` - 获取模块日志

### 数据导出
- `GET /api/export/all` - 导出操作日志Excel
- `GET /api/export/ledger` - 导出余额账本Excel

## 样例数据

系统启动时会自动初始化样例数据：
- 3个会员课包（张三、李四、王五）
- 2个教练排班
- 已批准的请假扣课记录
- 待审批的转课申请
- 待审批的退款申请
- 余额账本记录

## 项目结构

```
gym-management/
├── server/
│   ├── index.js              # 入口文件
│   ├── database.js           # 数据库初始化
│   ├── middleware/
│   │   └── idempotency.js    # 幂等性中间件
│   ├── routes/
│   │   ├── packages.js       # 课包路由
│   │   ├── schedules.js      # 排班路由
│   │   ├── leaveDeductions.js # 扣课路由
│   │   ├── transfers.js      # 转课路由
│   │   ├── refunds.js        # 退款路由
│   │   ├── ledger.js         # 账本路由
│   │   ├── logs.js           # 日志路由
│   │   └── export.js         # 导出路由
│   └── utils/
│       ├── logger.js         # 操作日志工具
│       └── sampleData.js     # 样例数据初始化
├── client/
│   ├── src/
│   │   ├── App.js            # 主应用组件
│   │   ├── index.js          # 入口文件
│   │   └── components/
│   │       ├── Packages.js   # 课包组件
│   │       ├── Schedules.js  # 排班组件
│   │       ├── LeaveDeductions.js # 扣课组件
│   │       ├── Transfers.js  # 转课组件
│   │       ├── Refunds.js    # 退款组件
│   │       ├── Ledger.js     # 账本组件
│   │       ├── Logs.js       # 日志组件
│   │       └── Export.js     # 导出组件
│   └── package.json
├── data/                      # SQLite数据库目录
├── package.json
└── README.md
```

## 数据库表结构

- member_packages - 会员课包表
- coach_schedules - 教练排班表
- leave_deductions - 请假扣课表
- transfer_commissions - 转课分成表
- refund_trials - 退款试算表
- balance_ledger - 余额账本表
- operation_logs - 操作日志表
- idempotency_keys - 幂等键表

## 使用说明

1. **创建课包**：在会员课包页面点击"新建课包"
2. **安排课程**：在教练排班页面创建排班
3. **消课处理**：点击排班记录的"完成消课"按钮
4. **请假扣课**：申请扣课并审批
5. **转课操作**：会员间转课并计算分成
6. **退款处理**：先试算再申请退款审批
7. **查看账本**：在余额账本页面查看所有流水
8. **导出数据**：在导出页面按条件筛选导出
