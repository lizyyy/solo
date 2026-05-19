# 内容审核申诉系统

一个偏技术方向的全栈Web/API应用，用于处理内容审核拦截后的申诉流程。

## 修复说明

### 问题1：数据库初始化时序问题
**问题描述**：原代码中`backend/src/server.js`先加载路由，路由进一步加载`backend/src/config/database.js`打开数据库，但创建`backend/data`目录的逻辑在路由加载之后才执行，导致在空目录下直接运行会失败。

**修复方案**：
- 在所有打开数据库的文件中（`database.js`, `init-db.js`, `seed-data.js`），都先检查并创建`data`目录
- `server.js`中在加载任何路由之前先确保目录存在

### 问题2：CSV批量导入功能不完整
**问题描述**：原CSV上传只是提示成功，没有真正解析数据和创建申诉记录。

**修复方案**：
- 新增后端API：`POST /api/import/csv` - 解析CSV并批量导入
- 新增后端API：`GET /api/import/template` - 下载导入模板
- 新增后端服务：`ImportService` - 处理CSV解析和批量导入逻辑
- 前端实现完整的批量导入流程：模板下载、文件上传、结果展示

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
- **内容项 (content_items)**: 被拦截的内容
- **审核标签 (audit_tags)**: 模型打标结果
- **模型原因 (model_reasons)**: 拦截原因详情
- **申诉 (appeals)**: 申诉申请记录
- **审核轨迹 (audit_trail)**: 操作历史记录
- **审核员 (reviewers)**: 审核人员信息

### 业务规则
1. **审核结果同步**: 支持批量同步模型审核标签和原因
2. **申诉状态机**: pending → reviewing → approved/rejected/escalated
3. **复审分派**: 自动分派或手动指定审核员
4. **结果回写**: 申诉结果自动同步到内容状态
5. **处置导出**: 支持CSV格式导出申诉数据
6. **批量导入**: 支持CSV批量导入申诉内容

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
- `POST /api/import/csv` - CSV批量导入
- `GET /api/import/template` - 下载导入模板

### 前端页面
1. **申诉列表**: 支持状态筛选、申诉人搜索
2. **申诉详情**: 内容信息、模型原因、审核时间线、操作按钮
3. **批量导入**: 手动添加、CSV批量导入（模板下载、文件上传、结果展示）
4. **报告下载**: 数据统计、通过率分析、导出功能

## 快速开始

### 环境要求
- Node.js 16+
- npm 8+

### 后端启动

```bash
cd backend

# 安装依赖（必须，首次运行需要）
npm install

# 初始化数据库（已包含默认审核员数据，自检可正常运行）
npm run init-db

# 导入完整演示数据（可选：包含示例内容、申诉、审核轨迹）
node scripts/seed-data.js

# 启动服务
npm run start
```

后端服务运行在: http://localhost:3001

### 前端启动

```bash
cd frontend

# 安装依赖（必须，首次运行需要，包含 vite 等构建工具）
npm install

# 启动开发服务
npm run dev
```

前端应用运行在: http://localhost:3000

### 运行自检

**注意**：运行自检前请确保：
1. 后端依赖已安装（`npm install`）
2. 数据库已初始化（`npm run init-db`）
3. 后端服务正在运行（`npm run start`）

```bash
cd backend
npm run test
```

自检程序会验证完整的申诉状态流转链路：提交申诉 → 分派审核 → 通过/驳回申诉。

## CSV批量导入使用说明

### 步骤
1. 进入"批量导入"页面
2. 点击"下载导入模板"获取CSV模板
3. 按模板格式填写申诉数据
4. 拖拽或点击上传CSV文件
5. 查看导入结果统计（成功/失败数量及详情）

### CSV字段说明
| 字段名 | 必填 | 说明 |
|--------|------|------|
| 内容类型 | 否 | post/comment/image/video，默认post |
| 内容摘要 | 否 | 被拦截的内容描述 |
| 作者 | 否 | 内容作者名称 |
| 作者ID | 否 | 内容作者标识 |
| 拦截时间 | 否 | ISO格式时间，默认当前时间 |
| 标签代码 | 否 | 审核标签代码 |
| 标签名称 | 否 | 审核标签名称 |
| 置信度 | 否 | 0-1之间的数字，默认0.8 |
| 原因代码 | 否 | 模型原因代码 |
| 原因详情 | 否 | 模型原因描述 |
| 风险等级 | 否 | high/medium/low，默认medium |
| 模型版本 | 否 | 模型版本号，默认v1.0 |
| 申诉人 | 否 | 申诉提交人名称，默认"导入申诉人" |
| 申诉人ID | 否 | 申诉提交人标识 |
| 联系方式 | 否 | 申诉人联系信息 |
| 申诉理由 | 否 | 申诉详细理由 |
| 证据材料 | 否 | 相关证据说明 |

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
- **文件处理**: csv-parser (CSV解析), json2csv (CSV导出)
