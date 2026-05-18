# 自助洗车场洗车优惠冻结 API

## 项目概述

本API提供自助洗车场优惠冻结的完整流程处理，包括设备状态检查、优惠券验证、异常处理和数据一致性保障。

## 核心特性

- **主流程处理**: 完整的优惠冻结申请、审核流程
- **异常样例内置**: 包含设备失败但优惠券被消费、数据不一致等异常场景
- **可解释错误消息**: 所有异常都有详细的错误说明和处理建议
- **真实业务字段**: 所有数据模型都包含自助洗车场的真实业务字段
- **待处理/驳回状态**: 异常自动进入可解释的待处理状态

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库并导入种子数据

```bash
npm run seed
```

种子数据包含:
- 3台洗车设备（1台在线、1台离线、1台故障）
- 4张优惠券（可用、已使用、已过期等状态）
- 3笔洗车订单（完成、失败、处理中）
- 1笔优惠冻结记录
- 2笔异常记录（设备故障异常、数据一致性异常）

### 3. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

## API 接口

### 健康检查
```bash
curl http://localhost:3000/health
```

### 1. 创建优惠冻结申请
```bash
curl -X POST http://localhost:3000/api/discount-freeze \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER001",
    "couponId": "COUPON001",
    "userId": "USER001",
    "deviceId": "DEV001",
    "stationId": "STATION001",
    "freezeAmount": 15.00,
    "freezeReason": "设备故障申请优惠冻结"
  }'
```

### 2. 获取优惠冻结列表
```bash
curl http://localhost:3000/api/discount-freeze
```

### 3. 获取异常列表
```bash
curl http://localhost:3000/api/discount-freeze/exceptions
```

### 4. 获取统计数据
```bash
curl http://localhost:3000/api/discount-freeze/stats
```

### 5. 审核优惠冻结
```bash
curl -X PUT http://localhost:3000/api/discount-freeze/FREEZE001/audit \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "operatorId": "OP001",
    "operatorName": "张管理员",
    "auditRemark": "情况属实，批准冻结"
  }'
```

### 6. 处理异常
```bash
curl -X PUT http://localhost:3000/api/discount-freeze/exceptions/EXCEPT001/handle \
  -H "Content-Type: application/json" \
  -d '{
    "handleStatus": "resolved",
    "handlerId": "CS001",
    "handlerName": "李客服",
    "handleRemark": "已为用户补发优惠券"
  }'
```

## 异常场景测试

### 场景1: 设备离线测试
```bash
curl -X POST http://localhost:3000/api/discount-freeze \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER001",
    "couponId": "COUPON001",
    "userId": "USER001",
    "deviceId": "DEV002",
    "stationId": "STATION001",
    "freezeAmount": 15.00,
    "freezeReason": "测试设备离线"
  }'
```

**预期响应**: 返回422状态码，错误消息说明设备离线，建议更换设备，并自动记录异常。

### 场景2: 设备失败但优惠券被消费
```bash
curl -X POST http://localhost:3000/api/discount-freeze \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER002",
    "couponId": "COUPON002",
    "userId": "USER002",
    "deviceId": "DEV001",
    "stationId": "STATION001",
    "freezeAmount": 10.00,
    "freezeReason": "设备失败优惠券已消费"
  }'
```

**预期响应**: 返回422状态码，错误消息说明设备执行失败但优惠券已被消费，建议前往服务台处理或提交申诉材料。

### 场景3: 优惠券已使用
```bash
curl -X POST http://localhost:3000/api/discount-freeze \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER001",
    "couponId": "COUPON002",
    "userId": "USER001",
    "deviceId": "DEV001",
    "stationId": "STATION001",
    "freezeAmount": 10.00,
    "freezeReason": "测试优惠券状态"
  }'
```

**预期响应**: 返回422状态码，错误消息说明优惠券状态异常，建议检查有效期。

### 场景4: 数据一致性检查
系统会自动检查订单、优惠券、冻结记录的状态一致性，发现不一致时自动记录异常并给出可解释的错误消息。

## 数据模型

### 洗车设备 (car_wash_devices)
- device_id: 设备ID
- device_name: 设备名称
- station_id: 场站ID
- station_name: 场站名称
- device_type: 设备类型
- status: 状态 (online/offline/fault)
- last_heartbeat_at: 最后心跳时间
- location: 位置

### 优惠券 (coupons)
- coupon_id: 优惠券ID
- coupon_code: 优惠券编码
- coupon_type: 优惠券类型
- discount_amount: 优惠金额
- min_consumption: 最低消费
- user_id: 用户ID
- user_phone: 用户手机号
- status: 状态 (available/used/expired/frozen)
- valid_start_at: 生效时间
- valid_end_at: 失效时间
- used_at: 使用时间
- used_device_id: 使用设备ID

### 洗车订单 (car_wash_orders)
- order_id: 订单ID
- user_id: 用户ID
- user_phone: 用户手机号
- device_id: 设备ID
- station_id: 场站ID
- station_name: 场站名称
- car_plate: 车牌号
- wash_type: 洗车类型
- original_amount: 原始金额
- discount_amount: 优惠金额
- actual_amount: 实付金额
- coupon_id: 优惠券ID
- status: 状态 (completed/failed/processing)
- start_time: 开始时间
- end_time: 结束时间

### 优惠冻结 (discount_freezes)
- freeze_id: 冻结ID
- order_id: 订单ID
- coupon_id: 优惠券ID
- user_id: 用户ID
- device_id: 设备ID
- station_id: 场站ID
- freeze_amount: 冻结金额
- freeze_reason: 冻结原因
- status: 状态 (pending/approved/rejected)
- operator_id: 操作人ID
- operator_name: 操作人姓名
- audit_remark: 审核备注
- audit_time: 审核时间

### 异常记录 (discount_exceptions)
- exception_id: 异常ID
- order_id: 订单ID
- coupon_id: 优惠券ID
- user_id: 用户ID
- device_id: 设备ID
- station_id: 场站ID
- exception_type: 异常类型
- exception_code: 异常代码
- exception_message: 异常消息
- coupon_consumed: 优惠券是否已消费
- device_failed: 设备是否失败
- consistency_status: 一致性状态
- handle_status: 处理状态 (pending/resolved/rejected)
- handler_id: 处理人ID
- handler_name: 处理人姓名
- handle_remark: 处理备注
- handle_time: 处理时间

## 错误代码说明

| 错误代码 | 说明 | 处理建议 |
|---------|------|---------|
| DEVICE_FAILED_COUPON_CONSUMED | 设备执行失败但优惠券已被消费 | 前往服务台或提交申诉 |
| DATA_INCONSISTENCY | 数据一致性异常 | 联系客服进行数据核对 |
| COUPON_NOT_AVAILABLE | 优惠券状态异常 | 检查优惠券有效期或更换 |
| DEVICE_OFFLINE | 设备已离线 | 更换其他在线设备 |
| ORDER_NOT_EXISTS | 订单不存在 | 确认订单编号 |

## 测试命令

### 运行完整测试套件
```bash
npm test
```

### 逐个测试场景
```bash
# 测试健康检查
curl http://localhost:3000/health

# 测试正常流程
curl -X POST http://localhost:3000/api/discount-freeze \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORDER001","couponId":"COUPON001","userId":"USER001","deviceId":"DEV001","stationId":"STATION001","freezeAmount":15.00,"freezeReason":"正常申请"}'

# 查看异常列表
curl http://localhost:3000/api/discount-freeze/exceptions
```

## 项目结构

```
.
├── src/
│   ├── app.js                      # 主应用入口
│   ├── config/
│   │   └── database.js             # 数据库配置
│   ├── models/
│   │   └── init.js                 # 数据库初始化
│   ├── services/
│   │   └── discountFreezeService.js # 业务逻辑
│   ├── controllers/
│   │   └── discountFreezeController.js # 控制器
│   ├── routes/
│   │   └── discountFreezeRoutes.js # 路由
│   └── scripts/
│       ├── seed.js                 # 种子数据
│       └── test-all.js             # 测试脚本
├── data/                           # 数据库文件目录
├── package.json
└── README.md
```
