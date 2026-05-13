# 景区讲解器租借赔付管理系统

一个完整的全栈 Web 应用，用于统一管理景区讲解器的租借、归还、赔付和维修流程。

## 功能特性

### 前端功能
- **设备管理**：查看、添加、编辑讲解器设备，支持按编号、语言包、状态筛选
- **订单管理**：新建租借、归还设备，管理押金订单
- **异常看板**：实时展示待处理异常，统计异常数据
- **异常管理**：查看和处理所有异常记录
- **流转记录**：查看所有设备的流转历史，记录变更前后值
- **维修记录**：管理维修工单，记录维修进度
- **报告导出**：按责任人和时间范围筛选导出Excel报表

### 后端功能
- **押金订单变更**：完整记录押金金额修改的审计日志
- **电量检测拦截**：租借时自动检测电量，电量低于20%禁止租借
- **归还验收复核**：归还时记录验收结果，发现损坏自动创建异常和维修记录
- **防重复提交**：短时间内相同操作自动拦截
- **数据审计**：保存所有字段的修改前后值
- **流转记录**：每次操作都记录完整的流转信息

## 技术栈

### 前端
- React 18
- Vite
- Ant Design 5
- Axios
- React Router

### 后端
- Node.js
- Express
- SQLite3
- ExcelJS (导出Excel)
- UUID

## 本地启动

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 2. 初始化数据库

```bash
# 初始化数据库表
npm run init-db

# 导入样例数据（可选）
npm run seed
```

### 3. 启动服务

```bash
# 同时启动前后端（开发模式）
npm run dev

# 或单独启动
# 启动后端（端口3001）
npm run server

# 启动前端（端口3000）
cd client && npm run dev
```

访问 http://localhost:3000 即可使用系统。

## API 接口演示

### 设备管理

**获取设备列表**
```bash
GET /api/devices
# 可选参数: device_number, language_pack, status
```

**创建设备**
```bash
POST /api/devices
{
  "device_number": "DEV001",
  "language_pack": "中文",
  "operator": "管理员"
}
```

### 订单管理

**创建租借订单**
```bash
POST /api/orders/rent
{
  "device_id": "uuid",
  "customer_name": "张三",
  "customer_phone": "13800138000",
  "deposit_amount": 200,
  "operator": "管理员"
}
```

**归还设备**
```bash
POST /api/orders/return
{
  "order_id": "uuid",
  "battery_level": 80,
  "inspection_result": "pass",  // pass 或 fail
  "damage_description": "",
  "operator": "管理员"
}
```

### 流转记录

**获取流转记录**
```bash
GET /api/flow
# 可选参数: device_number, flow_type, start_date, end_date
```

### 异常管理

**获取异常列表**
```bash
GET /api/exceptions
# 可选参数: status, exception_type, responsible_person
```

**获取异常统计**
```bash
GET /api/exceptions/stats
```

### 报告导出

**导出Excel报表**
```bash
GET /api/reports/export
# 可选参数: responsible_person, start_date, end_date
```

## 失败路径演示

### 1. 电量过低租借失败

租借电量低于20%的设备时：

```bash
POST /api/orders/rent
{
  "device_id": "low-battery-device-id",
  "customer_name": "测试用户",
  "customer_phone": "13800000000",
  "deposit_amount": 200,
  "operator": "管理员"
}

# 返回
400 Bad Request
{
  "error": "设备电量过低，请先充电"
}
```

### 2. 重复提交操作失败

1分钟内重复提交同设备的相同操作：

```bash
# 第一次租借成功
POST /api/orders/rent { ... }

# 1分钟内再次租借同一设备
POST /api/orders/rent { ... }

# 返回
400 Bad Request
{
  "error": "操作过于频繁，请稍后再试"
}
```

### 3. 设备不可租借失败

租借已出租或维修中设备：

```bash
POST /api/orders/rent
{
  "device_id": "rented-device-id",
  ...
}

# 返回
400 Bad Request
{
  "error": "设备不可用，当前状态: rented"
}
```

### 4. 归还已完成订单失败

归还已完成的订单：

```bash
POST /api/orders/return
{
  "order_id": "already-completed-order-id",
  ...
}

# 返回
400 Bad Request
{
  "error": "订单已归还或已取消"
}
```

## 样例数据说明

执行 `npm run seed` 后会创建以下样例数据：

### 设备 (8个)
- DEV001 (中文，可用，95%)
- DEV002 (英文，已租借，60%)
- DEV003 (日语，维修中，30%)
- DEV004 (韩语，可用，85%)
- DEV005 (中文，已租借，45%)
- DEV006 (法语，可用，100%)
- DEV007 (德语，维修中，15%)
- DEV008 (中文，可用，70%)

### 订单 (3个)
- 2个进行中订单
- 1个已完成订单

### 维修记录 (2个)
- DEV003 耳机接口损坏（待处理）
- DEV007 电池不充电（处理中）

### 异常记录 (1个)
- DEV002 租借时电量低于50%警告

## 数据库结构

主要数据表：
- `devices` - 设备信息
- `rental_orders` - 租借订单
- `flow_records` - 流转记录（保存变更前后值）
- `audit_logs` - 审计日志（字段级别变更）
- `repair_records` - 维修记录
- `exceptions` - 异常记录

## 项目结构

```
├── server/                 # 后端代码
│   ├── config/           # 配置文件
│   ├── routes/           # 路由
│   ├── middleware/       # 中间件
│   ├── utils/            # 工具函数
│   └── index.js          # 入口文件
├── client/               # 前端代码
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   └── main.jsx     # 入口文件
│   └── vite.config.js
├── database.db           # SQLite数据库（自动创建）
└── package.json
```
