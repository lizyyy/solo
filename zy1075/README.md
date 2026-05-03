# 共享工具借还预约服务

一个用于小区、办公室或社团共享工具（电钻、梯子、投影仪、露营桌等）借还预约的后端API服务。

## 功能特性

- **物品管理**：创建、查询、更新、删除物品信息
- **用户管理**：用户信息维护、余额管理
- **预约系统**：
  - 时间重叠校验
  - 库存数量校验
  - 维护状态校验
  - 押金冻结
- **借出/归还**：
  - 确认借出（库存锁定）
  - 归还结算（逾期费计算、押金扣减）
  - 损耗说明
- **候补队列**：
  - 取消预约时自动补位
  - 超时未取时自动补位
  - 候补用户排序管理
- **押金管理**：
  - 冻结、部分退还、扣除
  - 余额自动更新
- **争议处理**：
  - 创建争议
  - 解决争议（支持、驳回、协商）
  - 金额自动调整
- **报表功能**：
  - 物品时间线
  - 本周管理员对账摘要
  - 数据统计

## 技术栈

- **后端框架**：Node.js + Express
- **数据库**：SQLite（本地文件）
- **ORM**：Sequelize
- **日期处理**：moment.js
- **测试框架**：Jest

## 项目结构

```
.
├── data/                   # 数据库文件目录
├── src/
│   ├── config/            # 配置文件
│   │   └── database.js    # 数据库配置
│   ├── models/            # 数据模型
│   │   ├── index.js       # 模型索引
│   │   ├── User.js        # 用户模型
│   │   ├── Item.js        # 物品模型
│   │   ├── Reservation.js # 预约模型
│   │   ├── Loan.js        # 借出模型
│   │   ├── ReturnRecord.js # 归还记录模型
│   │   ├── Waitlist.js    # 候补模型
│   │   ├── Deposit.js     # 押金模型
│   │   └── Dispute.js     # 争议模型
│   ├── services/          # 业务逻辑服务
│   │   ├── ReservationService.js  # 预约服务
│   │   ├── LoanService.js         # 借出服务
│   │   ├── ReturnService.js       # 归还服务
│   │   ├── WaitlistService.js     # 候补服务
│   │   ├── TimelineService.js     # 时间线服务
│   │   └── ReportService.js       # 报表服务
│   ├── routes/            # API路由
│   │   ├── items.js       # 物品路由
│   │   ├── users.js       # 用户路由
│   │   ├── reservations.js # 预约路由
│   │   ├── loans.js       # 借出/归还路由
│   │   ├── waitlists.js   # 候补路由
│   │   └── reports.js     # 报表路由
│   ├── utils/             # 工具函数
│   │   ├── errors.js      # 自定义错误类
│   │   └── responseHandler.js # 统一响应处理器
│   └── app.js             # 应用入口
├── scripts/               # 脚本文件
│   ├── init-db.js         # 数据库初始化
│   └── seed.js            # 种子数据
├── tests/                 # 测试文件
│   ├── test.config.js     # 测试配置
│   ├── test.conflict.js   # 冲突预约测试
│   ├── test.waitlist.js   # 候补补位测试
│   ├── test.overdue.js    # 逾期/押金测试
│   └── test.dispute.js    # 争议处理测试
├── .env.example           # 环境变量示例
├── package.json           # 项目配置
└── README.md              # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/tools.db
# 超时取货时间（分钟）
CHECKOUT_TIMEOUT_MINUTES=30
# 默认逾期费率（元/小时）
OVERDUE_RATE_PER_HOUR=10
```

### 3. 初始化数据库并填充种子数据

```bash
npm run seed
```

这将：
- 重置数据库
- 创建 5 个示例用户
- 创建 6 个示例物品
- 创建 1 个示例预约

### 4. 启动服务

开发模式（自动重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

服务启动后访问：http://localhost:3000

### 5. 运行测试

运行所有测试：
```bash
npm test
```

运行特定测试：
```bash
# 冲突预约测试
npm run test:conflict

# 候补补位测试
npm run test:waitlist

# 逾期/押金测试
npm run test:overdue

# 争议处理测试
npm run test:dispute
```

## API 接口示例

### 基础信息

**服务地址**：http://localhost:3000

**健康检查**：
```bash
curl http://localhost:3000/health
```

**服务信息**：
```bash
curl http://localhost:3000/
```

### 物品管理

#### 创建物品

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "博世电钻",
    "description": "专业级充电式电钻，适用于木材、金属钻孔",
    "category": "工具",
    "total_quantity": 2,
    "deposit_amount": 200.00,
    "overdue_rate": 15.00,
    "max_loan_hours": 72
  }'
```

#### 查询所有物品

```bash
curl "http://localhost:3000/api/items?page=1&pageSize=10"
```

#### 按分类筛选

```bash
curl "http://localhost:3000/api/items?category=工具"
```

#### 搜索物品

```bash
curl "http://localhost:3000/api/items?search=电钻"
```

#### 查看单个物品

```bash
curl http://localhost:3000/api/items/1
```

#### 检查物品可用性

```bash
curl -X POST http://localhost:3000/api/items/check-availability \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "start_time": "2024-06-15T09:00:00",
    "end_time": "2024-06-15T17:00:00",
    "quantity": 1
  }'
```

#### 查看物品时间线

```bash
curl "http://localhost:3000/api/items/1/timeline?startDate=2024-06-01&endDate=2024-06-30"
```

### 用户管理

#### 创建用户

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "phone": "13800138001",
    "email": "zhangsan@example.com",
    "role": "user",
    "balance": 500.00
  }'
```

#### 用户充值

```bash
curl -X POST http://localhost:3000/api/users/1/recharge \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 300.00
  }'
```

#### 查询用户信息

```bash
curl http://localhost:3000/api/users/1
```

### 预约管理

#### 发起预约

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "item_id": 1,
    "start_time": "2024-06-15T09:00:00",
    "end_time": "2024-06-15T17:00:00",
    "quantity": 1,
    "notes": "用于家里装修钻孔"
  }'
```

**返回示例（冲突时）：**
```json
{
  "success": false,
  "code": 409,
  "message": "预约时间冲突，该时间段内博世电钻已被预约",
  "suggestion": "建议选择其他时间段，或者加入候补队列等待空位",
  "data": {
    "conflictingReservations": [
      {
        "id": 1,
        "user_name": "李四",
        "start_time": "2024-06-15T09:00:00.000Z",
        "end_time": "2024-06-15T17:00:00.000Z",
        "quantity": 1
      }
    ]
  }
}
```

#### 查询预约列表

```bash
curl "http://localhost:3000/api/reservations?user_id=2&status=confirmed"
```

#### 查询单个预约

```bash
curl http://localhost:3000/api/reservations/1
```

#### 取消预约

```bash
curl -X POST http://localhost:3000/api/reservations/1/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "不需要了"
  }'
```

#### 确认借出（取货）

```bash
curl -X POST http://localhost:3000/api/reservations/1/checkout
```

#### 处理超时未取

```bash
curl -X POST http://localhost:3000/api/reservations/process-timeouts
```

### 借出/归还管理

#### 直接借出（无需预约）

```bash
curl -X POST http://localhost:3000/api/loans/direct-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "item_id": 1,
    "quantity": 1,
    "expected_return_time": "2024-06-16T17:00:00"
  }'
```

#### 归还结算

```bash
curl -X POST http://localhost:3000/api/loans/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "good",
    "damage_description": "",
    "damage_estimate": 0,
    "notes": "正常归还"
  }'
```

**损坏归还示例：**
```bash
curl -X POST http://localhost:3000/api/loans/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "condition": "damaged",
    "damage_description": "钻头断裂，外壳有明显划痕",
    "damage_estimate": 150.00,
    "notes": "归还时发现损坏"
  }'
```

#### 查询借出记录

```bash
curl "http://localhost:3000/api/loans?user_id=2&status=active"
```

#### 检查并更新逾期状态

```bash
curl -X POST http://localhost:3000/api/loans/check-overdue
```

### 候补管理

#### 加入候补队列

```bash
curl -X POST http://localhost:3000/api/waitlists \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "item_id": 1,
    "requested_start_time": "2024-06-15T09:00:00",
    "requested_end_time": "2024-06-15T17:00:00",
    "quantity": 1,
    "reservation_id": 1,
    "notes": "想借同一时间段"
  }'
```

#### 查看候补队列

```bash
curl "http://localhost:3000/api/waitlists?item_id=1&status=waiting"
```

#### 取消候补

```bash
curl -X POST http://localhost:3000/api/waitlists/1/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 3,
    "reason": "不需要了"
  }'
```

#### 检查候补过期

```bash
curl -X POST http://localhost:3000/api/waitlists/check-expiration
```

### 争议管理

#### 创建争议

```bash
curl -X POST http://localhost:3000/api/reports/disputes \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": 1,
    "type": "equipment_damage",
    "description": "用户否认是自己造成的损坏",
    "dispute_amount": 150.00,
    "reported_by": 2
  }'
```

#### 解决争议

```bash
curl -X POST http://localhost:3000/api/reports/disputes/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "sustained",
    "resolution_notes": "经核实，损坏确实为用户使用期间造成",
    "resolved_by": 1
  }'
```

**争议驳回示例（退还扣款）：**
```bash
curl -X POST http://localhost:3000/api/reports/disputes/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "dismissed",
    "resolution_notes": "经核实，划痕为借用前已存在的旧伤，非用户造成",
    "resolved_by": 1
  }'
```

**协商示例：**
```bash
curl -X POST http://localhost:3000/api/reports/disputes/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "negotiated",
    "resolution_notes": "双方协商一致，最终赔偿金额为80元",
    "resolved_by": 1,
    "negotiated_amount": 80.00
  }'
```

### 报表功能

#### 本周管理员对账摘要

```bash
curl http://localhost:3000/api/reports/weekly-summary
```

**返回示例：**
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2024-06-10",
      "end_date": "2024-06-16",
      "week_number": 24
    },
    "summary": {
      "total_reservations": 15,
      "total_loans": 12,
      "total_returns": 10,
      "overdue_count": 2,
      "dispute_count": 1
    },
    "financial": {
      "total_overdue_fees": 180.00,
      "total_damage_fees": 150.00,
      "total_fees": 330.00,
      "total_deposits_held": 2000.00,
      "total_deposits_refunded": 1800.00
    },
    "top_items": [
      { "name": "博世电钻", "loan_count": 5 },
      { "name": "EPSON投影仪", "loan_count": 3 }
    ]
  }
}
```

#### 查询用户时间线

```bash
curl "http://localhost:3000/api/reports/user-timeline/2?startDate=2024-06-01&endDate=2024-06-30"
```

## 数据模型

### 用户 (User)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 姓名 |
| phone | String | 手机号（唯一） |
| email | String | 邮箱 |
| role | Enum | 角色：user/admin |
| balance | Decimal | 账户余额 |
| status | Enum | 状态：active/inactive |

### 物品 (Item)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| name | String | 物品名称 |
| description | Text | 描述 |
| category | String | 分类 |
| total_quantity | Integer | 总库存 |
| available_quantity | Integer | 可用库存 |
| status | Enum | 状态：available/maintenance/unavailable |
| deposit_amount | Decimal | 押金金额 |
| overdue_rate | Decimal | 逾期费率（元/小时） |
| max_loan_hours | Integer | 最大借出时长（小时） |

### 预约 (Reservation)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 用户ID |
| item_id | Integer | 物品ID |
| start_time | DateTime | 预约开始时间 |
| end_time | DateTime | 预约结束时间 |
| quantity | Integer | 数量 |
| status | Enum | 状态：confirmed/checkout/cancelled/timeout |
| deposit_held | Decimal | 冻结押金 |
| cancel_reason | String | 取消原因 |

### 借出 (Loan)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 用户ID |
| item_id | Integer | 物品ID |
| reservation_id | Integer | 关联预约ID |
| checkout_time | DateTime | 取货时间 |
| expected_return_time | DateTime | 预计归还时间 |
| actual_return_time | DateTime | 实际归还时间 |
| quantity | Integer | 数量 |
| status | Enum | 状态：active/overdue/returned/lost |
| deposit_amount | Decimal | 押金金额 |

### 归还记录 (ReturnRecord)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| loan_id | Integer | 借出ID |
| user_id | Integer | 用户ID |
| item_id | Integer | 物品ID |
| return_time | DateTime | 归还时间 |
| condition | Enum | 物品状态：good/poor/damaged/lost |
| damage_description | Text | 损坏描述 |
| damage_estimate | Decimal | 损坏估价 |
| overdue_hours | Decimal | 逾期小时数 |
| overdue_fee | Decimal | 逾期费用 |
| damage_fee | Decimal | 损坏费用 |
| total_fee | Decimal | 总费用 |
| deposit_refunded | Decimal | 押金退还金额 |

### 候补 (Waitlist)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 用户ID |
| item_id | Integer | 物品ID |
| reservation_id | Integer | 关联预约ID（可选） |
| position | Integer | 候补位置 |
| requested_start_time | DateTime | 请求开始时间 |
| requested_end_time | DateTime | 请求结束时间 |
| quantity | Integer | 数量 |
| status | Enum | 状态：waiting/converted/cancelled/expired |
| converted_reservation_id | Integer | 转换后的预约ID |
| convert_reason | String | 转换原因 |

### 押金 (Deposit)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| user_id | Integer | 用户ID |
| reservation_id | Integer | 预约ID |
| loan_id | Integer | 借出ID |
| amount | Decimal | 押金金额 |
| status | Enum | 状态：held/refunded/partially_refunded/deducted |
| refunded_amount | Decimal | 已退还金额 |
| deducted_amount | Decimal | 已扣除金额 |
| deduction_reason | String | 扣除原因 |

### 争议 (Dispute)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| loan_id | Integer | 借出ID |
| return_record_id | Integer | 归还记录ID |
| user_id | Integer | 用户ID |
| type | Enum | 类型：equipment_damage/overdue_charge/deposit_deduction |
| description | Text | 争议描述 |
| dispute_amount | Decimal | 争议金额 |
| status | Enum | 状态：pending/resolved/withdrawn |
| resolution | Enum | 处理结果：sustained/dismissed/negotiated |
| resolution_notes | Text | 处理说明 |
| negotiated_amount | Decimal | 协商金额 |
| reported_by | Integer | 报告人ID |
| resolved_by | Integer | 处理人ID |

## 业务规则

### 预约校验规则

1. **时间重叠校验**：新预约时间段与已有有效预约（confirmed/checkout）不能重叠
2. **库存校验**：预约数量不能超过当前可用库存（总库存 - 已预约数量）
3. **维护状态校验**：维护中物品不能预约
4. **押金校验**：用户余额需 ≥ 押金金额
5. **时长校验**：预约时长不能超过物品设置的最大借出时长

### 时间重叠判定

两个时间段 [A_start, A_end] 和 [B_start, B_end] 重叠的条件是：

```
NOT (B_end < A_start OR B_start > A_end)
```

边界情况（不视为重叠）：
- B_end == A_start
- B_start == A_end

### 候补自动补位触发条件

1. **预约取消**：用户主动取消预约
2. **超时未取**：超过设定时间（默认30分钟）未取货

补位逻辑：
1. 按候补位置顺序遍历
2. 检查候补用户余额是否足够
3. 检查候补时间段是否已过
4. 第一个符合条件的候补用户自动转换为预约
5. 冻结押金，更新用户余额
6. 记录转换原因
7. 若当前候补不符合条件，标记为过期，继续下一个

### 逾期费用计算

```
逾期小时数 = 实际归还时间 - 预计归还时间（向上取整）
逾期费用 = 逾期小时数 × 物品逾期费率
```

### 归还结算流程

1. 计算逾期小时数和逾期费用
2. 根据物品状态确定损坏费用
3. 计算总费用 = 逾期费用 + 损坏费用
4. 押金扣除：
   - 若押金 ≥ 总费用：退还 押金 - 总费用
   - 若押金 < 总费用：退还 0，从余额扣除（或挂账）
5. 更新用户余额
6. 更新押金状态
7. 恢复物品库存
8. 生成归还记录

### 争议处理流程

1. **创建争议**：用户或管理员针对借出/归还记录创建争议
2. **处理争议**：管理员选择处理方式
   - **支持 (sustained)**：维持原处理
   - **驳回 (dismissed)**：退还已扣除的金额
   - **协商 (negotiated)**：按协商金额处理
3. **自动调整**：根据处理结果自动更新押金和用户余额

## 错误响应示例

所有错误响应遵循统一格式：

```json
{
  "success": false,
  "code": 409,
  "message": "预约时间冲突，该时间段内博世电钻已被预约",
  "suggestion": "建议选择其他时间段，或者加入候补队列等待空位",
  "data": {
    "conflictingReservations": [...]
  }
}
```

常见错误码：

| 错误码 | 说明 |
|--------|------|
| 400 | 参数错误 |
| 404 | 资源不存在 |
| 409 | 冲突（时间冲突、库存不足等） |
| 422 | 数据验证失败 |
| 500 | 服务器内部错误 |

## 开发指南

### 添加新物品类型

无需修改代码，直接通过 API 创建物品，物品信息存储在数据库中。

### 修改默认参数

编辑 `.env` 文件：

```env
# 超时取货时间（分钟）
CHECKOUT_TIMEOUT_MINUTES=30
# 默认逾期费率（元/小时）
OVERDUE_RATE_PER_HOUR=10
```

### 定时任务建议

建议设置以下定时任务：

1. **处理超时未取预约**：每小时执行一次
   ```
   curl -X POST http://localhost:3000/api/reservations/process-timeouts
   ```

2. **检查逾期借出**：每天凌晨执行一次
   ```
   curl -X POST http://localhost:3000/api/loans/check-overdue
   ```

3. **检查候补过期**：每天凌晨执行一次
   ```
   curl -X POST http://localhost:3000/api/waitlists/check-expiration
   ```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
