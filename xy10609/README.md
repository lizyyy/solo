# 政务材料预审补正系统

## 项目概述

政务材料预审补正系统是一个全栈 Web 应用，用于处理办事事项和身份类型，根据附件有效期、补正意见、窗口受理情况计算最终材料缺口。

## 技术栈

- **后端**: Node.js + Express + SQLite (better-sqlite3)
- **前端**: Vue 3 + Vue Router + Element Plus + Axios
- **报表导出**: xlsx

## 目录结构

```
.
├── backend/
│   ├── config/
│   │   └── database.js     # 数据库配置
│   ├── routes/             # API 路由
│   ├── scripts/
│   │   └── initDB.js       # 数据库初始化脚本
│   ├── data/               # SQLite 数据库文件目录
│   ├── exports/            # 报表导出目录
│   ├── server.js           # 后端服务入口
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   ├── router/         # 路由配置
│   │   ├── api/            # API 封装
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 初始化数据库

```bash
# 在项目根目录执行
npm run init
```

该命令会创建数据库文件并初始化基础数据：
- 办事事项（营业执照办理、税务登记证办理等）
- 身份类型（企业法人、个体工商户等）
- 附件数据及有效期信息
- 材料缺口数据
- 异常记录数据

### 3. 启动服务

#### 方式一：同时启动前后端（推荐）

```bash
# 在项目根目录执行
npm run dev
```

#### 方式二：分别启动

```bash
# 启动后端服务（端口 3001）
npm run server

# 启动前端服务（端口 3000）
npm run client
```

### 4. 访问应用

- 前端地址: http://localhost:3000
- 后端健康检查: http://localhost:3001/api/health

## 功能模块

### 1. 数据概览
- 统计卡片展示关键指标
- 材料缺口类型分布
- 材料缺口严重程度分布

### 2. 办事事项管理
- 办事事项列表展示
- 新增、编辑事项
- 支持搜索和筛选

### 3. 身份类型管理
- 身份类型列表展示
- 新增、编辑类型
- 支持搜索和筛选

### 4. 附件管理
- 附件列表展示
- 新增、编辑附件
- 支持按状态筛选（有效/过期）

### 5. 材料缺口
- 缺口列表展示
- 标记缺口为已解决
- 支持按严重程度和状态筛选

### 6. 异常看板
- 异常列表展示
- 异常修复功能
- 记录修改前后值对比

### 7. 报表导出
- 支持按责任人和时间范围筛选
- 导出 Excel 报表
- 包含缺口、异常、变更历史等数据

### 8. 变更历史
- 记录所有数据修改操作
- 展示修改前后值
- 支持按表名和修改人筛选

## 关键 API 接口

### 统计接口
- `GET /api/statistics` - 获取统计数据

### 办事事项接口
- `GET /api/matters` - 获取事项列表
- `POST /api/matters` - 新增事项
- `PUT /api/matters/:id` - 更新事项

### 身份类型接口
- `GET /api/identity-types` - 获取类型列表
- `POST /api/identity-types` - 新增类型
- `PUT /api/identity-types/:id` - 更新类型

### 附件接口
- `GET /api/attachments` - 获取附件列表
- `POST /api/attachments` - 新增附件
- `PUT /api/attachments/:id` - 更新附件

### 材料缺口接口
- `GET /api/gaps` - 获取缺口列表
- `POST /api/gaps` - 新增缺口
- `PUT /api/gaps/:id/resolve` - 标记缺口为已解决

### 异常接口
- `GET /api/exceptions` - 获取异常列表
- `POST /api/exceptions` - 新增异常
- `PUT /api/exceptions/:id/fix` - 修复异常

### 报表接口
- `GET /api/report/export` - 导出报表
- `GET /api/report/summary` - 获取统计汇总

### 历史接口
- `GET /api/history` - 获取变更历史

## 报表导出说明

报表导出支持以下筛选条件：
1. **责任人**: 按处理人/修改人筛选
2. **开始时间**: 筛选该日期之后的数据
3. **结束时间**: 筛选该日期之前的数据

导出内容包含：
- 异常记录表
- 材料缺口表
- 变更历史表

## 变更追踪说明

系统会自动追踪以下数据表的修改：
- 办事事项（business_matters）
- 身份类型（identity_types）
- 附件（attachments）

每次修改都会记录：
- 修改前值（old_value）
- 修改后值（new_value）
- 修改人（changed_by）
- 修改时间（changed_at）

## 注意事项

1. 数据库文件位于 `backend/data/precheck.db`
2. 导出的报表文件位于 `backend/exports/` 目录
3. 前端通过 Vite 代理访问后端 API，无需配置跨域
4. 首次运行必须先执行 `npm run init` 初始化数据库
