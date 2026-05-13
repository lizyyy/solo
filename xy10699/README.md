# 云资源发布审批系统

一个完整的全栈Web应用，用于管理云资源发布审批流程。

## 功能特性

### 核心功能
- ✅ **统计卡片：总申请数、待审批、发布中、已完成、已回滚、发布异常
- ✅ **异常看板：展示发布失败的服务详情，包含修改前后值
- ✅ **发布申请管理：CRUD操作，支持搜索过滤
- ✅ **影响服务管理：记录每个发布影响的服务
- ✅ **审批意见管理：记录审批流程
- ✅ **灰度批次管理：支持多批次灰度发布
- ✅ **回滚动作管理：记录回滚原因和详情
- ✅ **发布报告：自动生成发布报告，支持Excel导出

### 数据覆盖
- 发布申请 (ReleaseRequest)
- 影响服务 (AffectedService)
- 审批意见 (ApprovalOpinion)
- 灰度批次 (GrayBatch)
- 回滚动作 (RollbackAction)
- 发布报告 (ReleaseReport)

### 关键特性
- 所有修改都记录变更历史（修改前后值）
- 异常看板明确展示失败原因
- 报告导出支持按责任人和处理时间筛选
- 支持Excel格式报告导出

## 技术架构

### 前端
- React 18 + TypeScript
- Ant Design 5.x
- Axios（HTTP请求）
- Recharts（图表）
- Day.js（日期处理）

### 后端
- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- ExcelJS（Excel导出）

## 快速开始

### 环境要求
- Node.js >= 16.x
- MongoDB >= 4.x
- npm >= 8.x

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 启动服务

#### 方式一：分别启动（推荐）

```bash
# 1. 启动MongoDB
mongod

# 2. 启动后端（新终端
cd backend
npm run dev

# 3. 启动前端（新终端）
cd frontend
npm start
```

#### 方式二：一键启动
```bash
# 在根目录执行
npm run dev
```

### 初始化数据

```bash
cd backend
npm run init:data
```

### 访问地址
- 前端：http://localhost:3000
- 后端API：http://localhost:5000

## 项目结构

```
.
├── backend/              # 后端服务
│   ├── src/
│   │   ├── models/      # 数据模型
│   │   ├── routes/      # 路由控制器
│   │   ├── scripts/     # 脚本文件
│   │   └── index.ts     # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/            # 前端应用
│   ├── src/
│   │   ├── api/         # API封装
│   │   ├── components/  # 通用组件
│   │   ├── pages/        # 页面组件
│   │   ├── types/     # 类型定义
│   │   └── App.tsx    # 主应用
│   ├── package.json
│   └── tsconfig.json
└── package.json         # 根配置
```

## 主要功能说明

### 1. 控制台
- 统计卡片展示关键指标
- 最近申请列表
- 异常看板展示发布失败服务
- 发布类型分布图表

### 2. 发布申请管理
- 列表展示所有申请
- 支持按状态、优先级、类型筛选
- 支持标题、描述搜索
- 新建、编辑、删除申请
- 查看详情（影响服务、审批意见、修改历史）

### 3. 发布报告管理
- 报告列表展示
- 按状态、责任人筛选
- 查看报告详情
- 导出Excel报告（包含所有发布详情）

## API接口

### 发布申请
- `GET /api/release-requests` - 获取列表
- `GET /api/release-requests/:id` - 获取详情
- `POST /api/release-requests` - 创建
- `PUT /api/release-requests/:id` - 更新
- `DELETE /api/release-requests/:id` - 删除

### 发布报告
- `GET /api/release-reports` - 获取报告列表
- `POST /api/release-reports/generate/:requestId` - 生成报告
- `GET /api/release-reports/export/:requestId` - 导出Excel

### 统计数据
- `GET /api/statistics/dashboard` - 获取控制台统计

## 报告导出说明

导出的Excel报告包含以下内容：
1. 报告基本信息（ID、申请ID、生成人、时间等）
2. 发布状态和统计数据
3. 审批摘要
4. 灰度批次摘要
5. 回滚摘要（如有）
6. 异常列表（包含修改前后值）

## 开发说明

### 添加新功能
1. 后端：在`backend/src/models`添加数据模型
2. 后端：在`backend/src/routes`添加路由
3. 前端：在`frontend/src/types`添加类型定义
4. 前端：在`frontend/src/api`添加API封装
5. 前端：在`frontend/src/pages`添加页面

### 修改数据模型
所有支持修改历史记录的模型都包含`changeHistory`字段，更新时自动记录变更。

## 许可证
MIT
