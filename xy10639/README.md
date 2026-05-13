# 企业班车候补加车管理系统

## 项目简介

企业班车候补加车管理系统是一个全栈Web应用，用于管理企业班车的线路站点、预约名额、候补转正、爽约信用、临时加车，并自动计算最终满载率。系统提供了数据看板、异常监控、搜索过滤和报表导出功能。

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React 18 + Ant Design 5
- **报表导出**：ExcelJS

## 功能特性

### 核心功能
1. **线路站点管理** - 线路增删改查、站点管理
2. **预约名额管理** - 预约记录查询、状态管理
3. **候补转正管理** - 候补列表、一键转正
4. **临时加车管理** - 临时加车申请、生效日期设置
5. **满载率计算** - 综合基础容量、临时容量、预约数、候补转正、爽约扣减
6. **异常看板** - 异常记录展示、人工修正（支持前后值对比）
7. **操作日志** - 所有修改操作记录、责任人追踪
8. **报表导出** - Excel格式导出，支持按责任人和处理时间筛选

### 数据字段覆盖
- 线路站点：线路代码、名称、方向、容量、站点顺序、到达时间
- 预约名额：用户ID、姓名、线路、站点、预约日期、时段、状态
- 候补转正：候补优先级、转正状态、转正时间
- 爽约信用：信用记录、积分变更、原因
- 临时加车：车牌号、容量、司机、生效日期、时段、原因
- 满载率：基础容量、临时容量、总容量、预约人数、候补转正数、爽约扣减数、最终满载率

## 项目结构

```
shuttle-bus-management/
├── server/
│   ├── config/
│   │   └── database.js      # 数据库配置
│   ├── database/            # SQLite数据库文件目录
│   ├── routes/
│   │   └── index.js         # API路由
│   ├── scripts/
│   │   └── initData.js      # 初始化数据脚本
│   └── index.js             # 服务入口
├── client/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js         # 前端入口
│   │   └── App.js           # 主应用组件
│   └── package.json
├── package.json
└── README.md
```

## 安装与启动

### 前置要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 或一键安装所有依赖
npm run install-all
```

### 2. 初始化数据

```bash
# 创建数据库并初始化测试数据
npm run init-data
```

### 3. 启动服务

#### 开发模式（同时启动前后端）
```bash
npm run dev
```

#### 生产模式
```bash
# 先构建前端
cd client && npm run build && cd ..

# 启动后端服务
npm start
```

### 4. 访问系统
- 前端地址：http://localhost:3000
- 后端API：http://localhost:5000

## 关键API接口

### 线路管理
- `GET /api/routes` - 获取所有线路
- `POST /api/routes` - 创建线路
- `PUT /api/routes/:id` - 更新线路

### 站点管理
- `GET /api/stations` - 获取站点列表
- `POST /api/stations` - 创建站点
- `PUT /api/stations/:id` - 更新站点

### 预约管理
- `GET /api/reservations` - 获取预约记录（支持按线路、日期、状态筛选）
- `PUT /api/reservations/:id` - 更新预约状态

### 候补管理
- `GET /api/waitlists` - 获取候补列表
- `POST /api/waitlists/:id/promote` - 候补转正

### 临时加车
- `GET /api/temp-buses` - 获取临时加车列表
- `POST /api/temp-buses` - 添加临时加车

### 异常管理
- `GET /api/exceptions` - 获取异常列表
- `PUT /api/exceptions/:id/handle` - 处理异常（记录前后值）

### 满载率
- `GET /api/load-rates` - 获取满载率统计
- `POST /api/load-rates/calculate` - 计算满载率

### 统计与报表
- `GET /api/statistics` - 获取首页统计数据
- `GET /api/operation-logs` - 获取操作日志
- `GET /api/reports/export` - 导出Excel报表
  - 参数：start_date、end_date、route_id、operator_id

## 满载率计算公式

```
最终满载率 = (预约人数 + 候补转正人数 - 爽约扣减人数) / (基础容量 + 临时容量) * 100%
```

## 操作日志说明

系统所有修改操作均会记录操作日志，包含：
- 操作模块（线路、站点、预约、候补、临时加车、异常）
- 操作类型
- 记录ID
- 修改前值（JSON格式）
- 修改后值（JSON格式）
- 操作人ID和姓名
- 操作时间

## 报表导出

报表导出为Excel格式，包含以下工作表：
1. 预约数据
2. 候补数据
3. 操作日志（包含修改前后值）
4. 满载率统计
5. 异常记录

支持筛选条件：
- 开始日期、结束日期
- 线路ID
- 操作人ID

## 数据库表说明

### routes - 线路表
- id, route_code, route_name, direction, capacity, status, created_at, updated_at

### stations - 站点表
- id, route_id, station_name, station_order, arrival_time, created_at, updated_at

### reservations - 预约表
- id, route_id, user_id, user_name, station_id, reservation_date, time_slot, status, created_at, updated_at

### waitlists - 候补表
- id, route_id, user_id, user_name, station_id, reservation_date, time_slot, priority, status, promoted_at, created_at, updated_at

### credit_records - 信用记录表
- id, user_id, user_name, type, points, reason, operator_id, operator_name, related_reservation_id, created_at

### temp_buses - 临时加车表
- id, route_id, bus_number, capacity, driver_name, effective_date, time_slot, reason, operator_id, operator_name, status, created_at, updated_at

### daily_load_rates - 每日满载率表
- id, route_id, stat_date, time_slot, base_capacity, temp_capacity, total_capacity, reserved_count, waitlist_promoted_count, no_show_deduction, final_load_rate, calculated_at

### operation_logs - 操作日志表
- id, module, operation_type, record_id, old_value, new_value, operator_id, operator_name, remark, created_at

### exceptions - 异常表
- id, route_id, exception_type, severity, description, reason, related_data, status, handler_id, handler_name, handled_at, old_value, new_value, created_at

## 注意事项

1. 数据库文件默认存储在 `server/database/` 目录下
2. 首次启动请先执行 `npm run init-data` 初始化数据库和测试数据
3. 测试数据包含示例线路、站点、预约、候补和异常记录
4. 操作日志保留所有修改的前后值，用于审计和追溯
5. 异常处理必须记录修正前后值，确保修改可追溯

## 许可证

ISC
