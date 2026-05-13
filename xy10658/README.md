# 公寓租约续租押金管理系统

一个全栈公寓租约管理系统，包含房源合同管理、续租报价、押金账本、维修扣款、退租验收等功能模块。

## 功能特性

- **房源合同管理**：创建、编辑、查看租赁合同信息
- **续租报价**：发起续租申请，支持审核流程（通过/拒绝）
- **押金账本**：记录押金变动历史，支持多种交易类型
- **维修扣款**：记录维修项目并从押金中扣款，支持审核
- **退租验收**：退租时的房屋验收和押金清算流程
- **待确认合同**：待处理的合同请求，防止重复创建
- **操作日志**：完整记录所有数据变更的修改前后值
- **数据导出**：支持按责任人、时间筛选导出Excel报表

## 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- ExcelJS (Excel导出)
- UUID
- Moment.js

### 前端
- React 18
- Ant Design 5
- Axios
- React Scripts

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── server.js           # 服务器入口
│   ├── package.json        # 后端依赖
│   ├── routes/             # API路由
│   │   ├── leaseRoutes.js       # 房源合同
│   │   ├── renewalRoutes.js     # 续租报价
│   │   ├── depositRoutes.js     # 押金账本
│   │   ├── maintenanceRoutes.js # 维修扣款
│   │   ├── checkoutRoutes.js    # 退租验收
│   │   ├── pendingRoutes.js     # 待确认合同
│   │   ├── logRoutes.js         # 操作日志
│   │   ├── exportRoutes.js      # 数据导出
│   │   └── sampleDataRoutes.js  # 样例数据
│   ├── utils/              # 工具函数
│   │   └── db.js          # 数据库工具
│   ├── scripts/           # 脚本
│   │   └── initDB.js     # 数据库初始化
│   └── data/              # 数据库文件目录
└── frontend/              # 前端项目
    ├── package.json       # 前端依赖
    ├── public/            # 静态资源
    └── src/               # 源代码
        ├── App.js        # 主应用
        ├── index.js      # 入口文件
        ├── services/     # API服务
        └── components/   # 组件
```

## 快速开始

### 前置要求
- Node.js 16+
- npm

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 初始化数据库

```bash
cd backend
npm run init-db
```

### 启动服务

#### 方式1：分别启动

```bash
# 启动后端服务 (端口 3001)
cd backend
npm start

# 启动前端服务 (端口 3000)
cd ../frontend
npm start
```

#### 方式2：使用启动脚本

```bash
# 给脚本添加执行权限
chmod +x start.sh

# 运行脚本
./start.sh
```

### 访问应用

打开浏览器访问：http://localhost:3000

### 生成样例数据

登录后点击右上角的"生成样例数据"按钮，即可导入演示数据。

## API接口

### 房源合同
- `GET /api/leases` - 获取合同列表
- `POST /api/leases` - 创建合同
- `PUT /api/leases/:id` - 更新合同

### 续租报价
- `GET /api/renewals` - 获取续租列表
- `POST /api/renewals` - 创建续租申请
- `PUT /api/renewals/:id/review` - 审核续租

### 押金账本
- `GET /api/deposits` - 获取押金记录
- `POST /api/deposits` - 创建押金记录

### 维修扣款
- `GET /api/maintenance` - 获取维修记录
- `POST /api/maintenance` - 创建维修扣款
- `PUT /api/maintenance/:id/review` - 审核维修扣款

### 退租验收
- `GET /api/checkout` - 获取验收记录
- `POST /api/checkout` - 创建退租验收
- `PUT /api/checkout/:id/review` - 审核退租验收

### 待确认合同
- `GET /api/pending` - 获取待确认列表
- `POST /api/pending` - 创建待确认请求
- `PUT /api/pending/:id/process` - 处理待确认请求

### 操作日志
- `GET /api/logs` - 获取操作日志

### 数据导出
- `GET /api/export/report` - 导出Excel报表

### 样例数据
- `POST /api/sample/generate` - 生成样例数据

## 业务流程

### 正常流程
1. 创建房源合同
2. 租户入住，押金入账
3. 合同到期前发起续租报价
4. 审核通过后更新合同和押金
5. 退租时发起退租验收
6. 清算押金扣款后退还剩余部分

### 拦截流程
- 任何需要审核的操作都会进入待审核状态
- 审核人可选择通过或拒绝
- 拒绝的操作不会产生实际数据变更

### 复核流程
- 所有数据变更均记录操作日志
- 可查看每次修改的前后值对比
- 支持按模块、操作人筛选

### 导出流程
- 支持按类型、操作人、时间范围筛选
- 导出Excel格式，包含多个工作表

## 数据持久化

所有数据存储在SQLite数据库中，服务重启后数据不会丢失。
数据库文件位置：`backend/data/database.db`

## 开发说明

### 后端开发
```bash
cd backend
npm run dev  # 使用nodemon自动重启
```

### 前端开发
```bash
cd frontend
npm start  # 热重载开发模式
```

## 许可证

MIT
