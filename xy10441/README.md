# 售前方案版本台

一个用于管理售前方案版本、报价、范围变更和客户确认的全栈应用系统。

## 功能特性

### 核心功能
- ✅ **客户项目管理** - 创建和管理客户项目
- ✅ **方案版本管理** - 支持创建、编辑、复制方案版本
- ✅ **报价明细管理** - 详细的报价项录入和自动计算
- ✅ **范围变更记录** - 记录每次变更的内容和原因
- ✅ **客户确认管理** - 记录客户确认信息，支持多种确认方式
- ✅ **版本作废机制** - 支持作废无效版本

### 关键业务规则
- 🔒 **已确认版本保护** - 已确认的方案版本不允许直接修改
- 📊 **报价一致性校验** - 报价总额与明细必须一致
- 🚫 **作废版本保护** - 已作废的版本不能被引用或确认
- ⚡ **单有效版本** - 同一项目只能有一个已确认的有效版本

### 界面功能
- 🔍 **版本对比** - 对比两个版本的差异（报价、范围等）
- 📋 **确认历史** - 查看客户确认记录
- ⚠️ **待补附件提醒** - 提醒必需附件未上传
- 📥 **导出功能** - 导出有效方案清单给销售主管
- ⭐ **有效版本标记** - 醒目的绿色标记区分有效版本

## 技术栈

- **后端**: Node.js + Express + PostgreSQL
- **前端**: React + Ant Design
- **认证**: JWT Token
- **导出**: Excel (xlsx)

## 快速开始

### 1. 数据库准备

确保已安装 PostgreSQL，并创建数据库：

```sql
CREATE DATABASE pre_sales_db;
```

### 2. 配置环境变量

复制后端的环境变量模板：

```bash
cp server/.env.example server/.env
```

编辑 `server/.env` 文件，填入你的数据库连接信息：

```
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pre_sales_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### 3. 初始化数据库

```bash
cd server
npm run init-db
```

### 4. 导入样例数据（可选）

```bash
npm run seed-data
```

样例数据包含：
- 3 个默认用户账号
- 3 个示例客户
- 3 个完整项目（ERP系统升级、CRM系统、培训平台）
- 包含软件实施、运维服务、培训套餐三种类型的方案

### 5. 启动后端服务

```bash
cd server
npm run dev
```

### 6. 启动前端服务

新开一个终端窗口：

```bash
cd client
npm start
```

### 7. 访问系统

打开浏览器访问：http://localhost:3000

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | password123 | 管理员 |
| zhangsan | password123 | 销售人员 |
| lisi | password123 | 销售主管 |

## 项目结构

```
pre-sales-version-platform/
├── server/                 # 后端项目
│   ├── config/            # 配置文件
│   │   └── database.js    # 数据库连接配置
│   ├── controllers/       # 控制器
│   │   ├── authController.js
│   │   ├── customerController.js
│   │   ├── projectController.js
│   │   └── proposalController.js
│   ├── middleware/        # 中间件
│   │   └── auth.js        # 认证中间件
│   ├── routes/            # 路由
│   │   ├── authRoutes.js
│   │   ├── customerRoutes.js
│   │   ├── projectRoutes.js
│   │   └── proposalRoutes.js
│   ├── scripts/           # 脚本
│   │   ├── initDb.js      # 数据库初始化
│   │   └── seedData.js    # 样例数据
│   ├── package.json
│   ├── index.js           # 入口文件
│   └── .env.example
├── client/                # 前端项目
│   ├── public/
│   ├── src/
│   │   ├── components/    # 组件
│   │   │   └── Layout.js  # 布局组件
│   │   ├── context/       # 上下文
│   │   │   └── AuthContext.js
│   │   ├── pages/         # 页面
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── Projects.js
│   │   │   ├── ProjectDetail.js
│   │   │   ├── VersionCompare.js
│   │   │   └── ConfirmedProposals.js
│   │   ├── utils/         # 工具
│   │   │   └── api.js     # API封装
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── package.json           # 根package.json
```

## API 接口

### 认证接口
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 客户接口
- `GET /api/customers` - 获取客户列表
- `GET /api/customers/:id` - 获取客户详情
- `POST /api/customers` - 创建客户
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户

### 项目接口
- `GET /api/projects` - 获取项目列表
- `GET /api/projects/:id` - 获取项目详情（含版本列表）
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### 方案版本接口
- `GET /api/proposals/versions/:id` - 获取版本详情
- `POST /api/proposals/versions` - 创建版本
- `PUT /api/proposals/versions/:id` - 更新版本
- `POST /api/proposals/versions/:id/confirm` - 确认版本
- `POST /api/proposals/versions/:id/void` - 作废版本
- `GET /api/proposals/versions/compare` - 版本对比
- `GET /api/proposals/pending-attachments` - 待补附件列表
- `GET /api/proposals/confirmed-proposals` - 有效方案清单

## 样例数据说明

系统包含三个典型样例项目：

### 1. ERP系统升级项目（软件实施）
- 版本 1.0：标准版方案
- 报价：¥850,000
- 包含：需求调研、架构设计、数据迁移、核心模块开发、系统集成、测试部署、培训、技术支持

### 2. 客户关系管理系统（运维服务）
- 版本 2.0：确认版方案 ⭐
- 报价：¥1,150,000（原价 ¥1,200,000，折扣 ¥50,000）
- 包含：系统部署、7x24支持、系统巡检、性能优化、数据备份、灾备方案、安全防护、安全审计、版本升级、业务咨询、培训、云服务
- 已包含确认记录和范围变更记录

### 3. 员工培训系统建设（培训套餐）
- 版本 1.0：企业培训平台及服务套餐
- 报价：¥680,000
- 包含：在线培训平台、移动端APP、课程开发、讲师服务、咨询服务、技术支持

## 关键业务规则详解

### 1. 已确认版本保护
- 任何已确认 (`is_confirmed = true`) 的版本都不允许修改
- 修改请求会返回 400 错误："已确认的方案版本不能直接修改"
- 如需修改，必须创建新版本

### 2. 报价一致性校验
- 确认版本时自动校验：
  - 报价总额 (`total_amount`) 必须等于所有报价项金额之和
  - 最终金额 (`final_amount`) 必须等于总额减去折扣
- 不一致会拒绝确认

### 3. 作废版本保护
- 创建新版本时如果引用其他版本，会检查源版本是否已作废
- 已作废版本 (`is_voided = true`) 不能被引用
- 已作废版本不能被确认

### 4. 单有效版本规则
- 确认版本时检查同一项目下是否已有其他已确认版本
- 同一项目只能有一个已确认的有效版本
- 确保签约时不会混淆

## 使用流程

1. **创建项目** → 新建客户和项目
2. **录入方案** → 创建方案版本，录入报价和范围
3. **版本迭代** → 如需修改，复制现有版本创建新版本
4. **客户确认** → 确认方案，标记为有效版本
5. **查看管理** → 通过有效方案清单查看和导出
6. **版本对比** → 对比不同版本的差异

## 开发说明

### 启动开发模式
```bash
# 方式一：分别启动
cd server && npm run dev
cd client && npm start

# 方式二：使用 concurrently（需安装根依赖）
npm run install-all
npm run dev
```

### 数据库表结构
- `users` - 用户表
- `customers` - 客户表
- `projects` - 项目表
- `proposal_versions` - 方案版本表（核心表）
- `quotation_items` - 报价项表
- `scope_changes` - 范围变更记录表
- `confirmations` - 客户确认记录表
- `attachments` - 附件表
- `version_reference` - 版本引用关系表

## 许可证

MIT License
