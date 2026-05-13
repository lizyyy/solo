# 托育接送授权迟接管理系统

这是一个完整的全栈Web应用，用于管理托育机构的儿童接送、授权管理和迟接费用计算。

## 功能特性

### 异常看板
- 实时统计数据展示（在园儿童数、待处理异常数、今日迟接数、累计迟接费用）
- 待处理异常列表
- 快速导航到各功能模块

### 儿童档案管理
- 儿童信息录入与管理
- 授权接送人管理
- 按班级、状态筛选
- 搜索功能

### 接送记录
- 接送历史记录查询
- 迟接记录筛选
- 日期范围筛选
- 显示迟接分钟和费用

### 异常记录管理
- 异常处理流程（迟接、未授权接送等）
- 责任人分配与交接功能
- 按状态跟踪
- 导出Excel导出
- 按责任人、时间、状态筛选导出

### 临时授权管理
- 临时授权创建与编辑
- 授权修改历史记录（修改前后值对比）
- 授权状态管理

## 技术栈

### 后端
- Node.js + Express
- SQLite数据库（文件型数据库，重启数据不丢失
- better-sqlite3（数据库操作）
- moment.js（日期处理）
- xlsx（Excel导出）

### 前端
- React 18
- React Router 6
- Ant Design 5
- Axios
- Vite

## 快速开始

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
```

### 启动开发模式

```bash
# 启动后端服务（端口 3001）
npm start

# 启动前端开发服务（端口 3000）
cd client
npm run dev
```

### 初始化演示数据

启动应用后，点击页面右下角有"初始化演示数据"按钮，点击即可生成演示数据：
- 5个儿童档案
- 对应的授权接送人
- 临时授权记录
- 30天的接送记录（包含迟接记录）
- 异常记录

## 项目结构

```
daycare-pickup-auth/
├── server/
│   ├── index.js          # 后端入口文件
│   ├── database.js       # 数据库配置与初始化
│   └── routes.js         # API路由
├── client/
│   ├── src/
│   │   ├── main.jsx       # 前端入口
│   │   ├── App.jsx        # 主应用组件
│   │   ├── index.css      # 全局样式
│   │   └── pages/          # 页面组件
│   │       ├── Dashboard.jsx
│   │       ├── Children.jsx
│   │       ├── PickupRecords.jsx
│   │       ├── Exceptions.jsx
│   │       └── TempAuthorizations.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/                   # SQLite数据库文件目录
├── uploads/                # 上传文件目录
└── package.json
```

## 数据库设计

### 主要数据表

1. **children** - 儿童档案表
2. **authorized_persons** - 授权接送人表
3. **temp_authorizations** - 临时授权表
4. **temp_auth_changes** - 临时授权修改记录表
5. **pickup_records** - 接送记录表
6. **pickup_exceptions** - 异常记录表
7. **exception_handover** - 异常交接记录表
8. **manual_adjustments** - 人工调整记录表
9. **late_fee_rules** - 迟接计费规则表

## 迟接计费规则

- 宽限时间：15分钟
- 每分钟费用：2元
- 最高费用：100元

## API接口

### 儿童相关
- `GET /api/children` - 获取儿童列表
- `GET /api/children/:id` - 获取儿童详情
- `POST /api/children` - 创建儿童档案

### 授权人相关
- `GET /api/authorized-persons` - 获取授权人列表
- `POST /api/authorized-persons` - 添加授权人

### 临时授权相关
- `GET /api/temp-authorizations` - 获取临时授权列表
- `POST /api/temp-authorizations` - 创建临时授权
- `PUT /api/temp-authorizations/:id` - 更新临时授权
- `GET /api/temp-authorizations/:id/changes` - 获取修改记录

### 接送记录相关
- `GET /api/pickup-records` - 获取接送记录
- `POST /api/pickup-records` - 创建接送记录

### 异常记录相关
- `GET /api/pickup-exceptions` - 获取异常记录
- `PUT /api/pickup-exceptions/:id` - 处理异常
- `POST /api/exception-handover` - 异常交接
- `GET /api/export/exceptions` - 导出异常记录Excel

### 统计相关
- `GET /api/dashboard/stats` - 获取看板统计数据
- `POST /api/demo/init` - 初始化演示数据

## 生产部署

### 构建前端

```bash
cd client
npm run build
```

### 启动生产服务

```bash
npm start
```

服务将在 http://localhost:3001 启动，前端构建产物将被静态文件托管
