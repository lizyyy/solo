# 🏥 预约号源整合 API

> 医院多系统号源统一管理平台 - 解决不同科室号源来自多套系统，页面显示和真实可约数量不一致的问题

## ✨ 核心功能

### 后端核心规则
- **号源拉取** - 从多套外部系统统一拉取号源数据
- **临时锁号** - 支持15分钟临时锁号，防止超卖
- **超时释放** - 自动检测并释放超时锁号
- **冲突处理** - 自动检测重复锁号、数据不一致等冲突
- **凭证查询** - 预约凭证生成、签到、取消全流程管理

### 前端功能页面
- 📊 **仪表盘** - 数据概览和快捷操作
- 📋 **号源管理** - 号源列表筛选、详情查看、锁号操作
- 🔒 **锁号记录** - 锁号状态管理、超时检测、确认释放
- 📄 **预约凭证** - 凭证查询、签到、取消操作
- ⚠️ **冲突处理** - 冲突记录查看和处理
- 🔧 **外部系统** - 多系统配置管理
- 📦 **数据导入导出** - CSV批量导入和报表下载

## 🏗️ 技术架构

### 后端技术栈
- **Node.js + Express** - Web 服务框架
- **TypeScript** - 类型安全
- **SQLite3** - 轻量级数据库
- **uuid** - ID 生成
- **csv-writer/csv-parser** - CSV 导入导出
- **multer** - 文件上传处理
- **date-fns** - 日期处理

### 前端技术栈
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Axios** - HTTP 客户端
- **Zustand** - 状态管理
- **date-fns** - 日期处理

## 📁 数据模型

### 核心数据表
1. **external_systems** - 外部系统配置
2. **department_slots** - 科室号源
3. **lock_records** - 锁号记录
4. **release_events** - 释放事件记录
5. **conflict_records** - 冲突记录
6. **appointment_vouchers** - 预约凭证
7. **operation_logs** - 操作日志（审计）

## 🚀 快速开始

### 安装依赖
```bash
# 安装所有依赖（根目录 + 后端 + 前端）
npm run install:all

# 或者分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 开发模式
```bash
# 同时启动后端和前端
npm run dev

# 或者分别启动
npm run dev:backend  # 后端服务端口 3001
npm run dev:frontend # 前端服务端口 3000
```

### 初始化数据
```bash
cd backend
npm run seed
```

### 生产构建
```bash
npm run build
npm start
```

## 📡 API 接口

### 号源管理
- `GET /api/slots` - 获取号源列表（支持筛选）
- `GET /api/slots/:id` - 获取单个号源
- `GET /api/slots/:id/timeline` - 获取号源时间线
- `POST /api/slots` - 创建号源
- `POST /api/slots/pull` - 从外部系统拉取号源
- `POST /api/slots/:id/lock` - 锁号操作

### 锁号管理
- `GET /api/locks` - 获取锁号列表
- `GET /api/locks/:id` - 获取单个锁号
- `POST /api/locks/:id/release` - 释放锁号
- `POST /api/locks/:id/confirm` - 确认锁号并生成凭证
- `POST /api/locks/check-expired` - 检查并释放超时锁号

### 凭证管理
- `GET /api/vouchers` - 获取凭证列表
- `GET /api/vouchers/:id` - 获取单个凭证
- `GET /api/vouchers/code/:code` - 按凭证号查询
- `POST /api/vouchers/:id/checkin` - 签到
- `POST /api/vouchers/:id/cancel` - 取消预约

### 冲突处理
- `GET /api/conflicts` - 获取冲突列表
- `GET /api/conflicts/:id` - 获取单个冲突
- `POST /api/conflicts/:id/resolve` - 处理冲突

### 外部系统
- `GET /api/systems` - 获取系统列表
- `POST /api/systems` - 创建系统
- `PATCH /api/systems/:id/status` - 更新系统状态

### 数据导出
- `GET /api/export/slots` - 导出名源列表 CSV
- `GET /api/export/vouchers` - 导出凭证 CSV
- `GET /api/export/statistics` - 导出统计报表

### 数据导入
- `POST /api/import/slots` - 导入号源数据（CSV）

## 🔍 验收要点

### 页面功能验证
1. ✅ 列表筛选功能正常
2. ✅ 详情时间线展示完整
3. ✅ 批量导入功能正常
4. ✅ 报告下载功能正常

### 接口功能验证
1. ✅ 号源创建和查询
2. ✅ 锁号和超时释放
3. ✅ 凭证生成、签到、取消
4. ✅ 冲突检测和处理
5. ✅ 操作日志记录完整

### 稳定性验证
1. ✅ 重复锁号被拦截并记录冲突
2. ✅ 超时锁号自动释放
3. ✅ 失败原因可追溯到历史操作
4. ✅ 状态变更事务性保证

## 📝 开发说明

### 项目结构
```
.
├── backend/
│   ├── src/
│   │   ├── models/          # 数据模型定义
│   │   ├── services/        # 业务逻辑服务
│   │   ├── routes/          # API 路由
│   │   ├── scripts/         # 脚本（数据初始化等）
│   │   ├── database.ts      # 数据库配置
│   │   └── index.ts         # 入口文件
│   ├── data/                # SQLite 数据库文件
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── api.ts           # API 封装
│   │   ├── store.ts         # 状态管理
│   │   ├── App.tsx          # 主应用
│   │   ├── main.tsx         # 入口文件
│   │   └── index.css        # 全局样式
│   └── package.json
└── package.json
```

### 业务流程
1. 号源从外部系统拉取 → 统一存储
2. 用户锁号 → 15分钟有效期
3. 超时自动释放 OR 手动确认生成凭证
4. 凭证签到 / 取消 → 号源回收
5. 全程记录操作日志，支持审计追踪

## 📄 许可证

MIT
