# 内容审核申诉系统

一个偏技术方向的全栈Web/API应用，用于处理内容审核拦截后的申诉流程。

## 项目结构

```
.
├── backend/          # 后端API服务
│   ├── src/
│   │   ├── server.js      # 服务入口
│   │   ├── config/         # 配置文件
│   │   ├── models/          # 数据模型
│   │   ├── services/        # 业务服务
│   │   └── routes/          # API路由
│   ├── scripts/             # 脚本文件
│   ├── tests/              # 测试脚本
│   └── package.json
└── frontend/         # 前端Web应用
    ├── src/
    │   ├── pages/           # 页面组件
    │   └── main.jsx         # 应用入口
    └── package.json
```

## 核心功能

### 数据模型
- **内容项 (content_items): 被拦截的内容
- **审核标签 (audit_tags): 模型打标结果
- **模型原因 (model_reasons): 拦截原因详情
- **申诉 (appeals): 申诉申请记录
- **审核轨迹 (audit_trail): 操作历史记录
- **审核员 (reviewers): 审核人员信息

### 业务规则
1. **审核结果同步**: 支持批量同步模型审核标签和原因
2. **申诉状态机**: pending → reviewing → approved/rejected/escalated
3. **复审分派**: 自动分派或手动指定审核员
4. **结果回写**: 申诉结果自动同步到内容状态
5. **处置导出**: 支持CSV格式导出申诉数据

### API接口
- `POST /api/appeals` - 提交申诉
- `GET /api/appeals` - 查询申诉列表
- `GET /api/appeals/:id` - 查询申诉详情
- `POST /api/appeals/:id/assign` - 分派审核员
- `POST /api/appeals/:id/approve` - 通过申诉
- `POST /api/appeals/:id/reject` - 驳回申诉
- `POST /api/appeals/:id/escalate` - 升级处理
- `GET /api/appeals/export/csv` - 导出CSV
- `GET /api/appeals/report/generate` - 生成报告

### 前端页面
1. **申诉列表**: 支持状态筛选、申诉人搜索
2. **申诉详情**: 内容信息、模型原因、审核时间线、操作按钮
3. **批量导入**: 手动添加、CSV批量导入
4. **报告下载**: 数据统计、通过率分析、导出功能

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
npm install

# 初始化数据库
npm run init-db

# 导入演示数据
node scripts/seed-data.js

# 启动服务
npm run start
```

后端服务运行在: http://localhost:3001

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端应用运行在: http://localhost:3000

### 运行自检

```bash
cd backend
npm run test
```

## 状态流转

```
待处理 (pending)
    ↓
[分派]
    ↓
审核中 (reviewing)
    ↓
┌─────┼─────┐
↓     ↓     ↓
通过  驳回   升级
```

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Ant Design + Vite
- **数据验证**: 服务端状态机校验
- **审计追踪**: 完整的操作历史记录
