# 陪护人员病区排班系统

一个完整的陪护人员病区排班管理系统，包含后端API和前端管理界面。

## 功能特性

### 核心业务闭环
- **病区需求管理**：创建和管理各病区的陪护人员需求
- **陪护人员管理**：管理陪护人员信息、资质、技能等级
- **排班管理**：智能排班，自动校验资质和工时
- **请假管理**：请假申请和审批流程
- **替代人员**：请假时的人员替代安排
- **工时账本**：自动记录和统计工时

### 业务规则
- 资质校验：确保陪护人员资质满足病区需求
- 连续工时限制：防止过度加班
- 排班冲突检测：避免同一时间段重复排班
- 请假冲突检测：检查请假期间是否有排班

### 管理功能
- 批量导入病区需求
- 详情时间线：记录所有状态变更，保留修改前后值
- 报表导出：支持按责任人和时间筛选导出
- 审计日志：所有操作记录

## 技术栈

### 后端
- Node.js + Express
- SQLite 数据库
- RESTful API

### 前端
- React 18
- React Router
- Ant Design
- Axios

## 安装和运行

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 初始化数据库
npm run init-db

# 导入样例数据
npm run sample-data
```

### 2. 运行后端

```bash
cd backend
node server.js
```

后端服务运行在 http://localhost:3001

### 3. 安装前端依赖并运行

```bash
cd frontend
npm install
npm start
```

前端服务运行在 http://localhost:3000

## 项目结构

```
.
├── backend/
│   ├── config/          # 数据库配置
│   ├── routes/          # API路由
│   ├── services/        # 业务规则引擎
│   ├── utils/           # 工具函数
│   ├── scripts/         # 数据库脚本
│   └── server.js        # 入口文件
├── frontend/
│   ├── public/          # 静态资源
│   └── src/
│       └── pages/       # 页面组件
├── data/                # 数据库文件
└── package.json
```

## API 接口

### 病区管理
- `GET /api/wards` - 获取病区列表
- `POST /api/wards` - 创建病区
- `PUT /api/wards/:id` - 更新病区

### 陪护人员管理
- `GET /api/caregivers` - 获取陪护人员列表
- `POST /api/caregivers` - 创建陪护人员
- `PUT /api/caregivers/:id` - 更新陪护人员

### 病区需求管理
- `GET /api/ward-demands` - 获取需求列表
- `POST /api/ward-demands` - 创建需求
- `POST /api/ward-demands/batch` - 批量导入需求
- `PUT /api/ward-demands/:id` - 更新需求

### 排班管理
- `GET /api/schedules` - 获取排班列表
- `GET /api/schedules/:id` - 获取排班详情
- `POST /api/schedules` - 创建排班
- `PUT /api/schedules/:id/status` - 更新排班状态

### 请假管理
- `GET /api/leaves` - 获取请假列表
- `POST /api/leaves` - 申请请假
- `PUT /api/leaves/:id/approve` - 批准请假
- `PUT /api/leaves/:id/reject` - 驳回请假

### 替代人员管理
- `GET /api/substitutes` - 获取替代记录
- `POST /api/substitutes` - 创建替代记录
- `PUT /api/substitutes/:id/approve` - 批准替代

### 工时管理
- `GET /api/work-hours` - 获取工时记录
- `GET /api/work-hours/summary` - 获取工时汇总

### 时间线
- `GET /api/timelines/:relatedType/:relatedId` - 获取相关记录的时间线

### 报表导出
- `GET /api/reports/schedules` - 导出排班报表
- `GET /api/reports/work-hours` - 导出工时报表
- `GET /api/reports/audit-logs` - 导出审计日志
