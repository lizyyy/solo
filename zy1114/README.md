# Rehearsal Room API

小型排练房/录音棚预约管理 API 服务。用于管理房间预约、设备租赁、押金结算、损耗记录和班次交接。

## 功能特性

### 核心业务流程

1. **预约管理**
   - 创建、修改、取消预约
   - 状态流转：待确认 → 已付押金 → 已到店 → 使用中 → 待结算 → 已结清/已取消

2. **冲突检查**
   - 房间时间冲突检测
   - 设备占用冲突检测
   - 创建和修改预约时自动校验

3. **费用计算**
   - 按小时计费（最小单位 0.5 小时）
   - 超时费用（原价 1.5 倍）
   - 设备租赁费用
   - 设备损耗扣款

4. **押金管理**
   - 押金收取、退还、补收
   - 押金流水记录
   - 押金不足警告

5. **临时操作**
   - 加时（延长使用时间）
   - 换房（更换房间）
   - 加设备/减设备

6. **退场结算**
   - 结算预览
   - 超时费计算
   - 设备损坏扣款
   - 押金退还或补收
   - 扣款原因记录

7. **导出功能**
   - 班次交接清单（JSON / Markdown / CSV）
   - 日结对账单（JSON / Markdown / CSV）
   - 设备维修待办（JSON / Markdown / CSV）

### 数据模型

- **房间 (Rooms)**：排练室/录音棚信息，含费率
- **设备 (Devices)**：可租赁设备，含租金和押金
- **客户 (Customers)**：客户信息
- **预约 (Bookings)**：核心预约数据
- **预约设备 (BookingDevices)**：预约关联的设备
- **押金流水 (DepositTransactions)**：押金收支记录
- **损耗记录 (DamageRecords)**：设备/房间损坏记录
- **状态日志 (BookingStatusLogs)**：状态变更历史
- **班次 (Shifts)**：班次信息

## 技术栈

- **运行时**: Node.js 18+
- **Web 框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **日期处理**: date-fns
- **CSV 导出**: csv-writer
- **测试**: Node.js 内置测试框架

## 安装与运行

### 安装依赖

```bash
npm install
```

### 初始化种子数据

```bash
npm run seed
```

种子数据包含：
- 4 个房间（A房、B房、C房、录音棚）
- 13 台设备（话筒、效果器、键盘架等）
- 5 个示例客户

### 启动服务

```bash
# 生产模式
npm start

# 开发模式（自动重载）
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 运行测试

```bash
npm test
```

## API 文档

### 基础路径

```
http://localhost:3000/api
```

### 健康检查

```
GET /api/health
```

### 房间管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/rooms | 获取所有房间 |
| GET | /api/rooms/:id | 获取单个房间 |
| GET | /api/rooms/:id/availability | 查看房间可用性 |
| POST | /api/rooms | 创建房间 |
| PUT | /api/rooms/:id | 更新房间 |
| DELETE | /api/rooms/:id | 删除房间 |

### 设备管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/devices | 获取所有设备 |
| GET | /api/devices/:id | 获取单个设备 |
| GET | /api/devices/:id/availability | 查看设备可用性 |
| POST | /api/devices | 创建设备 |
| PUT | /api/devices/:id | 更新设备 |
| DELETE | /api/devices/:id | 删除设备 |

### 客户管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/customers | 获取所有客户 |
| GET | /api/customers/:id | 获取单个客户 |
| GET | /api/customers/:id/bookings | 获取客户预约记录 |
| POST | /api/customers | 创建客户 |
| PUT | /api/customers/:id | 更新客户 |
| DELETE | /api/customers/:id | 删除客户 |

### 预约管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/bookings | 获取所有预约 |
| GET | /api/bookings/:id | 获取预约详情 |
| POST | /api/bookings | 创建预约 |
| PUT | /api/bookings/:id | 更新预约 |
| POST | /api/bookings/:id/cancel | 取消预约 |
| POST | /api/bookings/:id/pay-deposit | 支付押金 |
| POST | /api/bookings/:id/check-in | 到店登记 |
| POST | /api/bookings/:id/start-use | 开始使用 |
| POST | /api/bookings/:id/add-devices | 添加设备 |
| POST | /api/bookings/:id/remove-devices | 移除设备 |
| POST | /api/bookings/:id/extend | 延长使用时间 |
| POST | /api/bookings/:id/change-room | 换房 |
| POST | /api/bookings/:id/damage | 记录损耗 |
| POST | /api/bookings/:id/settlement/preview | 预览结算 |
| POST | /api/bookings/:id/settlement/process | 完成结算 |
| GET | /api/bookings/:id/deposits | 获取押金流水 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/exports/shift-handover | 班次交接清单 |
| GET | /api/exports/daily-reconciliation | 日结对账单 |
| GET | /api/exports/repair-todo | 设备维修待办 |

**查询参数**：
- `date`: 日期（格式：YYYY-MM-DD），默认今天
- `format`: 导出格式（`json` / `markdown` / `csv`），默认 `json`

示例：
```bash
# JSON 格式
GET /api/exports/shift-handover?date=2024-01-15&format=json

# Markdown 格式（下载文件）
GET /api/exports/shift-handover?date=2024-01-15&format=markdown

# CSV 格式（下载文件）
GET /api/exports/shift-handover?date=2024-01-15&format=csv
```

## 预约状态流转

```
┌─────────────────────┐
│  待确认             │
│  pending_confirmation│
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌─────────┐
│已付押金 │  │ 已取消  │
│deposit_ │  │cancelled│
│ paid    │  └─────────┘
└────┬────┘
     │
     ▼
┌─────────┐
│ 已到店  │
│checked_in│
└────┬────┘
     │
     ▼
┌─────────┐
│ 使用中  │
│ in_use  │
└────┬────┘
     │
     ▼
┌─────────┐
│ 待结算  │
│pending_ │
│settlement│
└────┬────┘
     │
     ▼
┌─────────┐
│ 已结清  │
│ settled │
└─────────┘
```

## 典型使用场景

### 场景一：完整预约流程

1. **创建预约**
   ```bash
   POST /api/bookings
   {
     "customerId": 1,
     "roomId": 1,
     "startTime": "2024-01-15T14:00:00+08:00",
     "endTime": "2024-01-15T17:00:00+08:00",
     "deviceIds": [1, 2],
     "notes": "乐队排练"
   }
   ```

2. **支付押金**
   ```bash
   POST /api/bookings/:id/pay-deposit
   {
     "amount": 800,
     "paymentMethod": "微信"
   }
   ```

3. **到店登记**
   ```bash
   POST /api/bookings/:id/check-in
   ```

4. **开始使用**
   ```bash
   POST /api/bookings/:id/start-use
   ```

5. **临时加时**
   ```bash
   POST /api/bookings/:id/extend
   {
     "newEndTime": "2024-01-15T19:00:00+08:00"
   }
   ```

6. **记录设备损耗**
   ```bash
   POST /api/bookings/:id/damage
   {
     "deviceId": 1,
     "damageType": "scratch",
     "description": "话筒网罩有划痕",
     "estimatedCost": 50
   }
   ```

7. **预览结算**
   ```bash
   POST /api/bookings/:id/settlement/preview
   {
     "actualEndTime": "2024-01-15T19:30:00+08:00"
   }
   ```

8. **完成结算**
   ```bash
   POST /api/bookings/:id/settlement/process
   {
     "actualEndTime": "2024-01-15T19:30:00+08:00",
     "refundAmount": 100,
     "paymentMethod": "微信"
   }
   ```

### 场景二：换房

```bash
POST /api/bookings/:id/change-room
{
  "newRoomId": 2,
  "notes": "A房音响故障"
}
```

### 场景三：班次交接

```bash
# 导出班次交接清单（Markdown）
GET /api/exports/shift-handover?date=2024-01-15&format=markdown

# 导出日结对账单（CSV）
GET /api/exports/daily-reconciliation?date=2024-01-15&format=csv

# 导出设备维修待办（JSON）
GET /api/exports/repair-todo?date=2024-01-15&format=json
```

## 错误响应格式

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    ... 额外字段
  }
}
```

### 错误码说明

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| VALIDATION_ERROR | 验证错误 | 400 |
| CONFLICT_ERROR | 冲突错误（房间/设备占用） | 409 |
| STATE_TRANSITION_ERROR | 状态流转错误 | 400 |
| INSUFFICIENT_DEPOSIT | 押金不足 | 400 |
| NOT_FOUND | 资源不存在 | 404 |
| AMOUNT_ERROR | 金额错误 | 400 |
| INTERNAL_ERROR | 服务器内部错误 | 500 |

## 项目结构

```
.
├── data/                    # 数据库文件目录
├── docs/                    # 文档目录
│   └── curl-examples.md     # Curl 示例
├── scripts/                 # 脚本目录
│   └── seed.js              # 种子数据脚本
├── src/                     # 源代码
│   ├── config/              # 配置文件
│   │   ├── database.js      # 数据库配置
│   │   └── schema.js        # 数据库表结构
│   ├── controllers/         # 控制器
│   │   ├── bookingsController.js
│   │   ├── customersController.js
│   │   ├── devicesController.js
│   │   ├── exportController.js
│   │   ├── roomsController.js
│   │   └── settlementController.js
│   ├── routes/              # 路由
│   │   ├── bookings.js
│   │   ├── customers.js
│   │   ├── devices.js
│   │   ├── exports.js
│   │   └── rooms.js
│   ├── services/            # 业务服务
│   │   ├── bookingStateService.js
│   │   ├── conflictService.js
│   │   ├── exportService.js
│   │   └── pricingService.js
│   ├── utils/               # 工具函数
│   │   └── errors.js        # 错误处理
│   └── index.js             # 入口文件
├── tests/                   # 测试文件
│   └── basic.test.js
├── package.json
└── README.md
```

## 许可证

MIT
