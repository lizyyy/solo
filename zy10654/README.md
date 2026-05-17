# 积分商城库存预占释放服务

## 项目概述

积分商城库存预占释放系统，支持库存预占、释放、兑换全流程管理，具备完整的操作审计追踪能力。

## 核心特性

- ✅ 完整的库存预占 -> 释放 -> 兑换流程
- ✅ 操作日志审计，每次修改都可追踪
- ✅ 支付失败场景支持，区分自动释放和人工处理
- ✅ 丰富的错误码，调用方知道该补数据还是转人工
- ✅ 列表、详情、历史、导出功能齐全
- ✅ 预占单状态：可兑换(10) / 预占中(20) / 已释放(30) / 已兑换(40) / 待人工处理(50)

## 技术栈

- Node.js + Express
- MySQL
- json2csv (数据导出)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，修改数据库配置：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=points_mall_stock
PORT=3000
```

### 3. 初始化数据库

```bash
npm run init-db
```

该命令会自动：
- 创建数据库
- 创建表结构
- 插入测试数据（商品、会员、释放原因）
- 插入验收测试数据

### 4. 启动服务

```bash
npm start
```

开发模式（自动重启）：

```bash
npm run dev
```

服务启动后访问：http://localhost:3000/health

## API 接口

### 1. 创建预占单

```bash
POST /api/stock-reservation/create
Content-Type: application/json

{
  "productCode": "P001",
  "memberNo": "M001",
  "quantity": 1
}
```

### 2. 预占库存

```bash
POST /api/stock-reservation/reserve
Content-Type: application/json

{
  "reservationNo": "RES202605180001"
}
```

### 3. 释放库存

```bash
POST /api/stock-reservation/release
Content-Type: application/json

{
  "reservationNo": "RES202605180002",
  "releaseReasonCode": "PAY_FAILED_NETWORK",
  "remark": "支付网关超时"
}
```

**重要说明**：
- 如果释放原因标记为 `need_manual=1`，则不会立即归还库存
- 预占单状态转为 `50-待人工处理`
- 响应中包含 `code=1010`、`message`、`action` 字段，告知调用方需要人工介入

### 4. 兑换库存

```bash
POST /api/stock-reservation/exchange
Content-Type: application/json

{
  "reservationNo": "RES202605180001"
}
```

### 5. 查询列表

```bash
GET /api/stock-reservation/list?page=1&pageSize=20&status=20
```

参数：
- page: 页码
- pageSize: 每页条数
- status: 状态筛选
- memberNo: 会员编号筛选
- productCode: 商品编码筛选
- startDate, endDate: 创建时间范围

### 6. 查询详情

```bash
GET /api/stock-reservation/detail/RES202605180001
```

### 7. 查询历史记录

```bash
GET /api/stock-reservation/history/RES202605180001
```

### 8. 导出数据

```bash
GET /api/stock-reservation/export?status=50
```

导出为 CSV 文件。

## 释放原因说明

| 原因编码 | 原因名称 | 类型 | 需要人工处理 | 说明 |
|---------|---------|-----|-------------|------|
| USER_CANCEL | 用户主动取消 | 用户操作 | 否 | 用户取消预约 |
| PAY_TIMEOUT | 支付超时 | 系统 | 否 | 规定时间内未支付 |
| PAY_FAILED_INSUFFICIENT | 支付失败-积分不足 | 支付 | 否 | 会员积分不足 |
| PAY_FAILED_NETWORK | 支付失败-网络异常 | 支付 | 是 | 网络异常，状态不确定 |
| PAY_FAILED_SYSTEM | 支付失败-系统错误 | 支付 | 是 | 支付系统内部错误 |
| EXPIRED_AUTO | 过期自动释放 | 系统 | 否 | 超过有效期自动释放 |
| MANUAL_RELEASE | 人工释放 | 人工 | 否 | 客服手动释放 |
| INVENTORY_DISPUTE | 库存争议 | 人工 | 是 | 库存不一致 |
| DUPLICATE_RESERVATION | 重复预占 | 系统 | 是 | 检测到重复预占 |

## 数据库表结构

### 核心表

1. **products** - 商品表
2. **members** - 会员表
3. **release_reasons** - 释放原因字典表
4. **stock_reservations** - 预占单表（核心）
5. **stock_reservation_logs** - 操作日志表（审计）
6. **exchange_orders** - 兑换订单表

## 验收指南

### 场景1：完整流转

**验证点**：
1. 列表查询找到 `RES202605180001`，状态为 40-已兑换
2. 查看详情，确认商品信息、会员信息、兑换时间
3. 查看历史记录，确认有 3 条记录：
   - CREATE - 创建预占单
   - RESERVE - 库存预占成功
   - EXCHANGE - 兑换成功
4. 查看每条历史的 `before_stock` 和 `after_stock`，确认库存变化正确
5. 导出数据，该记录应在导出结果中

### 场景2：冲突记录（支付失败网络异常）

**验证点**：
1. 列表查询找到 `RES202605180002`，状态为 50-待人工处理
2. 查看详情，确认：
   - 释放原因：支付失败-网络异常
   - 释放备注：支付网关超时，扣款状态未知
3. 查看历史记录，确认：
   - 最后一条操作类型为 RELEASE
   - `before_stock` 和 `after_stock` 相同（库存未归还）
   - `after_status` = 50
4. 此记录应保留在待人工处理队列，等待运营人员核实

### 场景3：导入坏行（重复预占）

**验证点**：
1. 列表查询找到 `RES202605180003` 和 `RES202605180004`
2. `RES202605180003` 状态为 20-预占中（正常）
3. `RES202605180004` 状态为 50-待人工处理（重复预占）
4. 查看 `RES202605180004` 的历史记录：
   - CREATE - 创建
   - RESERVE - 预占成功（此时库存已扣减）
   - RELEASE - 重复预占检测（转入待人工）
5. 商品 P003 的库存：available=48, reserved=2（多扣了一件）
6. 人工处理时需确认用户真实意愿后调整库存

### 场景4：已释放记录

**验证点**：
1. 列表查询找到 `RES202605180005`，状态为 30-已释放
2. 查看历史记录，确认库存已归还

## 错误码说明

| 错误码 | 说明 | 处理建议 |
|-------|------|---------|
| 0 | 成功 | |
| 400 | 参数错误 | 检查请求参数 |
| 1001 | 库存不足 | 更换商品或等待补货 |
| 1002 | 商品不存在 | 检查商品编码 |
| 1003 | 会员不存在 | 检查会员编号 |
| 1004 | 预占单不存在 | 检查预占单号 |
| 1005 | 预占单状态异常 | 当前状态不允许此操作 |
| 1006 | 积分不足 | 提示用户充值积分 |
| 1007 | 支付失败 | 重新发起支付 |
| 1008 | 支付超时 | 重新发起支付 |
| 1009 | 检测到重复预占 | 需人工核实 |
| 1010 | 需要人工处理 | 请联系管理员核实交易状态 |
| 500 | 系统错误 | 联系技术支持 |

## 目录结构

```
.
├── database/
│   ├── schema.sql          # 数据库表结构
│   ├── data.sql            # 初始化数据
│   └── acceptance_data.sql # 验收测试数据
├── src/
│   ├── config/
│   │   └── database.js     # 数据库连接配置
│   ├── constants/
│   │   └── status.js       # 状态常量、错误码
│   ├── services/
│   │   ├── stockReservationService.js  # 核心业务逻辑
│   │   └── operationLogService.js      # 操作日志服务
│   ├── routes/
│   │   └── stockReservation.js         # API 路由
│   └── app.js              # 应用入口
├── scripts/
│   └── init-db.js          # 数据库初始化脚本
├── .env                    # 环境变量配置
├── package.json
└── README.md
```
