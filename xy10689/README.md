# 会议室设备服务预约系统

## 项目简介

一个完整的会议室设备预约全栈Web应用，包含会议室预约、设备管理、茶水服务、故障工单、异常监控和利用率统计等功能。

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus + Axios + Day.js
- **后端**: Node.js + Express + SQLite
- **报表**: ExcelJS 导出Excel

## 功能特性

### 核心功能
- ✅ 统计卡片展示：平均利用率、预订总数、待处理故障、异常数
- ✅ 会议室日历预约管理
- ✅ 投影设备管理与状态监控
- ✅ 茶水服务订单处理
- ✅ 故障工单流程管理
- ✅ 异常看板与人工修正
- ✅ 搜索过滤功能
- ✅ Excel报表导出

### 数据覆盖
- 会议室日历预约
- 投影设备状态
- 茶水服务记录
- 故障工单处理
- 取消释放记录
- 利用率统计

### 特殊功能
- 保留修改前后值（会议室、设备、茶水服务）
- 异常记录明确原因
- 人工修正显示前后对比
- 报表按责任人和处理时间筛选

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..

# 安装前端依赖
cd client
npm install
cd ..
```

### 初始化数据库

```bash
# 方式1：在根目录执行
npm run init:db

# 方式2：在server目录执行
cd server
node scripts/initDB.js
```

初始化数据包含：
- 4个会议室（大会议室A、中会议室B、小会议室C、培训室D）
- 5个投影设备
- 20条预约记录（含取消状态）
- 12条茶水服务记录
- 2条故障工单
- 2条异常记录

### 启动开发环境

```bash
# 方式1：同时启动前后端（需要concurrently）
npm install -g concurrently
npm run dev

# 方式2：分别启动（推荐，新开两个终端）
# 终端1 - 启动后端（端口3001）
cd server
npm run dev

# 终端2 - 启动前端（端口3000）
cd client
npm run dev
```

访问地址：http://localhost:3000

### 生产环境部署

```bash
# 构建前端
cd client
npm run build

# 启动后端
cd ../server
npm start
```

## 关键接口文档

### 统计接口
- `GET /api/statistics` - 获取统计数据
  - 参数: `startDate`, `endDate` (可选，默认近7天)

### 会议室接口
- `GET /api/rooms` - 获取会议室列表
- `POST /api/rooms` - 新增会议室
- `PUT /api/rooms/:id` - 更新会议室（记录修改历史）

### 设备接口
- `GET /api/devices` - 获取设备列表
- `PUT /api/devices/:id` - 更新设备（记录修改历史）

### 预约接口
- `GET /api/bookings` - 获取预约列表
  - 参数: `roomId`, `startDate`, `endDate`, `status`
- `POST /api/bookings` - 新增预约
- `PUT /api/bookings/:id` - 更新预约（记录修改历史）
- `POST /api/bookings/:id/cancel` - 取消预约

### 茶水服务接口
- `GET /api/tea-services` - 获取茶水服务列表
  - 参数: `status`, `handler`
- `PUT /api/tea-services/:id` - 更新茶水服务（记录修改历史）

### 故障工单接口
- `GET /api/fault-tickets` - 获取故障工单列表
  - 参数: `status`, `handler`
- `PUT /api/fault-tickets/:id` - 更新故障工单

### 异常接口
- `GET /api/anomalies` - 获取异常列表
  - 参数: `status`
- `PUT /api/anomalies/:id/resolve` - 处理异常（记录修正前后值）

### 修改历史接口
- `GET /api/modification-history` - 获取修改历史
  - 参数: `entity_type`, `entity_id`

### 报表导出接口
- `GET /api/report/export` - 导出Excel报表
  - 参数: `startDate`, `endDate`, `handler`
  - 响应: Excel文件流

## 数据库结构

### 核心表
- `meeting_rooms` - 会议室表
- `projection_devices` - 投影设备表
- `bookings` - 预约表
- `tea_services` - 茶水服务表
- `fault_tickets` - 故障工单表
- `cancellations` - 取消记录表
- `modification_history` - 修改历史表
- `anomalies` - 异常表

## 项目结构

```
.
├── package.json
├── README.md
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── app.js          # 入口文件
│   │   ├── db.js           # 数据库连接
│   │   ├── routes.js       # 路由
│   │   └── utils/
│   │       └── utilization.js  # 利用率计算
│   ├── scripts/
│   │   ├── initDB.js       # 数据库初始化
│   │   └── initData.js     # 测试数据
│   └── data/               # SQLite数据库文件目录
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.js
        ├── App.vue
        ├── api/            # API封装
        ├── router/         # 路由配置
        └── views/          # 页面组件
            ├── Dashboard.vue    # 数据概览
            ├── Booking.vue      # 预约管理
            ├── Device.vue       # 设备管理
            ├── TeaService.vue   # 茶水服务
            ├── FaultTicket.vue  # 故障工单
            ├── Anomaly.vue      # 异常看板
            └── Report.vue       # 报表导出
```

## 利用率计算说明

利用率基于以下因素综合计算：
1. 会议室预订时长
2. 取消释放时长
3. 有效工作时长（每日8小时）

计算公式：
```
利用率 = 实际使用时长 / (可用天数 × 每日工作时长)
释放率 = 取消时长 / (预订时长 + 取消时长)
```

## 报表导出说明

导出的Excel包含3个工作表：
1. **利用率统计** - 各会议室的预订次数、使用时长、利用率
2. **茶水服务记录** - 服务类型、数量、状态、处理人、处理时间
3. **故障工单** - 设备信息、问题描述、处理状态、解决方案

支持按以下条件筛选导出：
- 时间范围（开始日期 - 结束日期）
- 处理人

## 注意事项

1. 数据库文件默认保存在 `server/data/meeting_room.db`
2. 开发环境下前端通过Vite代理访问后端API
3. 生产环境构建后前端文件会被后端服务静态托管
4. 修改操作都会记录历史，可通过修改历史接口查询
