# 快递驿站异常件赔付 API

## 功能特性

- ✅ 包裹入库（重复入库校验）
- ✅ 包裹取件（异常件拦领取件）
- ✅ 异常上报
- ✅ 责任确认
- ✅ 赔付（重复赔付校验）
- ✅ 关闭异常（责任未确认不能关闭）
- ✅ 操作历史记录追踪
- ✅ 日报统计
- ✅ 详细的错误信息返回

## 技术栈

- Node.js + Express
- SQLite3 数据库
- Joi 参数校验

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
# 开发模式
npm run dev
```

服务启动后访问: http://localhost:3000

## API 接口文档

### 包裹管理

#### 包裹入库
```
POST /api/packages/in-stock
Content-Type: application/json

{
  "waybill_no": "SF1234567890",
  "receiver_name": "张三",
  "receiver_phone": "13800138000",
  "operator": "操作员"
}
```

#### 包裹取件
```
POST /api/packages/pickup
Content-Type: application/json

{
  "waybill_no": "SF1234567890",
  "operator": "操作员"
}
```

#### 查询包裹历史记录
```
GET /api/packages/:waybill_no/history
```

### 异常管理

#### 异常上报
```
POST /api/exceptions/report
Content-Type: application/json

{
  "waybill_no": "SF1234567890",
  "exception_type": "damaged",
  "exception_desc": "包裹外包装破损",
  "operator": "操作员"
}
```

异常类型: `damaged`(破损), `lost`(丢失), `wrong_pickup`(错取), `other`(其他)

#### 责任确认
```
POST /api/exceptions/confirm-responsibility
Content-Type: application/json

{
  "exception_id": 1,
  "responsible_party": "courier",
  "operator": "操作员"
}
```

责任方: `courier`(快递员), `station`(驿站), `receiver`(收件人), `other`(其他)

#### 赔付
```
POST /api/exceptions/compensate
Content-Type: application/json

{
  "exception_id": 1,
  "amount": 50.00,
  "compensation_reason": "包裹破损赔偿",
  "operator": "操作员"
}
```

#### 关闭异常
```
POST /api/exceptions/close
Content-Type: application/json

{
  "exception_id": 1,
  "operator": "操作员"
}
```

#### 查询异常列表
```
GET /api/exceptions?status=pending
```

状态: `pending`(待处理), `confirmed`(已确认), `compensated`(已赔付), `closed`(已关闭)

### 报表统计

#### 日报统计
```
POST /api/reports/daily
Content-Type: application/json

{
  "date": "2024-01-15"
}
```

#### 操作历史记录
```
GET /api/reports/history?start_date=2024-01-01&end_date=2024-01-15&operation_type=in_stock
```

## 业务规则

1. **重复入库**: 同一运单号不能重复入库
2. **异常件取件**: 存在未处理异常的包裹不能取件
3. **责任确认**: 异常必须先确认责任才能赔付或关闭
4. **重复赔付**: 同一异常不能重复赔付
5. **状态流转**: pending -> confirmed -> compensated -> closed

## 运行测试

```bash
node test-api.js
```

## 数据库表结构

### packages (包裹表)
- id, waybill_no, receiver_name, receiver_phone, status, in_stock_time, pickup_time

### exception_packages (异常表)
- id, package_id, waybill_no, exception_type, exception_desc, status, reported_by, confirmed_by, responsible_party, closed_by

### operation_history (操作历史表)
- id, package_id, waybill_no, operation_type, operator, operation_desc, operation_time

### compensations (赔付表)
- id, exception_id, package_id, waybill_no, amount, compensation_reason, paid_by, paid_time
