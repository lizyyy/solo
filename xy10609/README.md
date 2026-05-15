# 政务材料预审补正系统

## 项目概述

政务材料预审补正系统是一个全栈 Web 应用，用于处理办事事项和身份类型，**根据附件有效期、补正意见、窗口受理情况自动计算最终材料缺口**。

## 核心功能

✅ **预审补正计算引擎**
- 根据附件有效期（已过期/即将过期）自动检测
- 根据补正意见状态（待处理）自动检测
- 根据窗口受理结果（驳回/材料不全）自动检测
- 自动生成材料缺口记录和异常记录

✅ **数据管理模块**
- 办事事项管理
- 身份类型管理
- 附件管理（含有效期）
- 补正意见管理
- 窗口受理管理

✅ **结果展示模块**
- 材料缺口管理
- 异常看板（显示修改前后值对比）
- 变更历史记录
- 报表导出（支持按责任人和处理时间筛选）

## 技术栈

- **后端**: Node.js + Express + SQLite3
- **前端**: Vue 3 + Vue Router + Element Plus + Axios
- **报表导出**: xlsx

## 目录结构

```
.
├── backend/
│   ├── config/
│   │   ├── database.js      # 数据库配置
│   │   └── dbUtils.js       # 数据库工具类
│   ├── routes/
│   │   ├── preReview.js     # 核心：预审补正计算API
│   │   ├── correctionOpinions.js  # 补正意见API
│   │   ├── windowAcceptances.js   # 窗口受理API
│   │   ├── statistics.js    # 统计API
│   │   ├── matters.js       # 办事事项API
│   │   ├── identityTypes.js # 身份类型API
│   │   ├── attachments.js   # 附件API
│   │   ├── gaps.js          # 材料缺口API
│   │   ├── exceptions.js    # 异常API
│   │   ├── report.js        # 报表API
│   │   └── history.js       # 变更历史API
│   ├── scripts/
│   │   └── initDB.js        # 数据库初始化脚本
│   ├── data/                # SQLite数据库文件目录
│   ├── exports/             # 报表导出目录
│   ├── server.js            # 后端服务入口
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── PreReview.vue           # 核心：预审补正计算页面
│   │   │   ├── CorrectionOpinions.vue  # 补正意见管理
│   │   │   ├── WindowAcceptances.vue   # 窗口受理管理
│   │   │   ├── Dashboard.vue           # 数据概览
│   │   │   ├── Matters.vue             # 办事事项管理
│   │   │   ├── Identity.vue            # 身份类型管理
│   │   │   ├── Attachments.vue         # 附件管理
│   │   │   ├── Gaps.vue                # 材料缺口管理
│   │   │   ├── Exceptions.vue          # 异常看板
│   │   │   ├── Report.vue              # 报表导出
│   │   │   └── History.vue             # 变更历史
│   │   ├── router/         # 路由配置
│   │   ├── api/            # API封装
│   │   ├── App.vue         # 主应用组件
│   │   └── main.js         # 前端入口
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
cd backend && npm install && cd ..

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 2. 初始化数据库

```bash
# 在项目根目录执行
cd backend && node scripts/initDB.js && cd ..
```

该命令会创建数据库文件并初始化基础数据（办事事项、身份类型、附件、补正意见、窗口受理记录）。

### 3. 启动服务

#### 方式一：同时启动前后端（推荐）

```bash
# 在项目根目录执行（需要concurrently，根目录npm install已包含）
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
- 后端健康检查: http://localhost:3003/api/health

## 核心流程验证

### 步骤 1: 验证预审补正计算API

```bash
curl -X POST http://localhost:3003/api/pre-review/calculate \
  -H "Content-Type: application/json" \
  -d '{"auto_create": true, "handler": "admin"}'
```

预期结果：系统将根据附件有效期、补正意见状态、窗口受理结果自动计算材料缺口。

### 步骤 2: 验证补正意见管理

```bash
# 获取所有补正意见
curl http://localhost:3003/api/correction-opinions

# 创建补正意见
curl -X POST http://localhost:3003/api/correction-opinions \
  -H "Content-Type: application/json" \
  -d '{"matter_id": 1, "attachment_id": 1, "opinion": "附件缺少公章", "handler": "审核员A", "status": "pending"}'
```

### 步骤 3: 验证窗口受理管理

```bash
# 获取所有窗口受理记录
curl http://localhost:3003/api/window-acceptances

# 创建窗口受理记录
curl -X POST http://localhost:3003/api/window-acceptances \
  -H "Content-Type: application/json" \
  -d '{"matter_id": 2, "window_no": "A01", "acceptor": "窗口张", "material_check_result": "incomplete", "remarks": "缺少身份证复印件"}'
```

### 步骤 4: 在前端验证完整流程

1. 访问 http://localhost:3000
2. 点击左侧菜单 "预审补正计算"
3. 点击 "开始计算" 按钮
4. 系统将显示自动计算出的材料缺口汇总和详情
5. 查看 "补正意见"、"窗口受理" 页面管理基础数据
6. 查看 "材料缺口"、"异常看板" 页面查看计算结果

## 核心预审补正规则说明

系统根据以下规则自动计算材料缺口：

| 规则类型 | 检测条件 | 严重程度 |
|---------|---------|---------|
| 附件已过期 | expire_date < 当前日期 | high |
| 附件即将过期 | 剩余有效期 ≤ 30天 | medium |
| 补正意见待处理 | status = 'pending' | high |
| 窗口受理驳回 | material_check_result = 'rejected' | high |
| 窗口受理材料不全 | material_check_result = 'incomplete' | medium |
| 事项无附件 | 附件数量 = 0 | high |

每次计算时，系统会：
1. 检测所有附件的有效期状态
2. 检查所有待处理的补正意见
3. 检查所有窗口受理的驳回/不全记录
4. 自动生成 material_gaps（材料缺口）记录
5. 自动生成 exceptions（异常）记录

## 关键 API 接口列表

### 核心计算接口
- `POST /api/pre-review/calculate` - 执行预审补正计算
- `GET /api/pre-review/summary` - 获取计算汇总

### 基础数据管理接口
- `GET/POST/PUT/DELETE /api/correction-opinions` - 补正意见管理
- `GET/POST/PUT/DELETE /api/window-acceptances` - 窗口受理管理
- `GET/POST/PUT /api/matters` - 办事事项管理
- `GET/POST/PUT /api/identity-types` - 身份类型管理
- `GET/POST/PUT /api/attachments` - 附件管理

### 结果查询接口
- `GET/PUT /api/gaps` - 材料缺口管理
- `GET/PUT /api/exceptions` - 异常管理
- `GET /api/history` - 变更历史
- `GET /api/statistics` - 统计数据

### 报表接口
- `GET /api/report/export?handler=xxx&startTime=xxx&endTime=xxx` - 导出报表
- `GET /api/report/summary` - 报表汇总

## 报表导出说明

报表导出支持以下筛选条件：
1. **责任人(handler)**: 按处理人/修改人筛选
2. **开始时间(startTime)**: 筛选该日期之后的数据
3. **结束时间(endTime)**: 筛选该日期之前的数据

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

1. 数据库文件位于 `backend/data/precheck.db`，可使用 SQLite 工具查看
2. 导出的报表文件位于 `backend/exports/` 目录
3. 前端通过 Vite 代理访问后端 API，无需配置跨域
4. 首次运行必须先执行数据库初始化脚本

## 常见问题

### Q: 如何重新初始化数据库？
```bash
cd backend && rm -f data/precheck.db && node scripts/initDB.js
```

### Q: 如何添加自定义预审规则？
编辑 `backend/routes/preReview.js` 中的 `calculateGaps` 函数。

### Q: 如何修改附件有效期预警天数？
编辑 `backend/routes/preReview.js` 中的阈值配置（默认30天）。
