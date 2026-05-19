# 团长运营后台系统

处理生鲜缺货后的对账和补偿管理系统。

## 功能特性

- ✅ **订单导入**：支持CSV批量导入订单
- ✅ **缺货识别**：自动识别异常订单，标记缺货商品
- ✅ **补偿管理**：支持退款、换货、优惠券三种补偿方式
- ✅ **幂等操作**：重复提交不会产生重复补偿
- ✅ **批量操作**：支持批量补偿，失败时清晰展示成功/失败条目
- ✅ **回滚机制**：支持补偿回滚
- ✅ **结算管理**：团长账单结算与导出
- ✅ **券过期处理**：自动标记过期优惠券
- ✅ **操作日志**：所有操作均有记录和原因

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
```

服务将在 `http://localhost:3000` 启动。

## API 接口文档

### 订单接口

#### 导入订单CSV
```
POST /api/orders/import
Content-Type: multipart/form-data

参数：
- file: CSV文件
- operator: 操作人

CSV字段（支持中英文）：
- order_no / 订单号
- group_leader_id / 团长ID
- group_leader_name / 团长姓名
- user_id / 用户ID
- user_name / 用户姓名
- total_amount / 订单金额
- product_id / 商品ID
- product_name / 商品名称
- sku_id / SKU_ID
- sku_name / SKU名称
- quantity / 数量
- unit_price / 单价
- subtotal / 小计
- is_out_of_stock / 是否缺货（true/false）
- created_at / 下单时间
```

#### 获取订单列表
```
GET /api/orders?has_exception=true&status=pending&group_leader_id=xxx
```

#### 获取订单详情
```
GET /api/orders/:id
```

#### 检测库存异常
```
POST /api/orders/:id/detect-stock
Content-Type: application/json

{
  "stockInfo": [
    {"product_id": "xxx", "sku_id": "xxx", "available_quantity": 5}
  ]
}
```

---

### 补偿接口

#### 创建补偿
```
POST /api/compensations
Content-Type: application/json

{
  "order_id": "订单ID",
  "order_item_id": "订单项ID（可选）",
  "type": "refund|exchange|coupon",
  "amount": 10.5,
  "reason": "缺货补偿",
  "operator": "操作人"
}
```

#### 批量补偿
```
POST /api/compensations/batch
Content-Type: application/json

{
  "order_ids": ["订单ID1", "订单ID2"],
  "type": "coupon",
  "amount": 10,
  "reason": "批量补偿",
  "operator": "操作人"
}
```

#### 确认补偿
```
POST /api/compensations/:id/confirm
Content-Type: application/json

{
  "operator": "操作人"
}
```

#### 回滚补偿
```
POST /api/compensations/:id/rollback
Content-Type: application/json

{
  "reason": "回滚原因",
  "operator": "操作人"
}
```

#### 获取补偿列表
```
GET /api/compensations?order_id=xxx&status=confirmed&type=refund
```

---

### 结算接口

#### 创建结算单
```
POST /api/settlements
Content-Type: application/json

{
  "group_leader_id": "团长ID",
  "start_date": "2024-01-01 00:00:00",
  "end_date": "2024-01-31 23:59:59",
  "operator": "操作人"
}
```

#### 确认结算单
```
POST /api/settlements/:id/confirm
Content-Type: application/json

{
  "operator": "操作人"
}
```

#### 导出结算单CSV
```
GET /api/settlements/:id/export
```

#### 获取结算单列表
```
GET /api/settlements?group_leader_id=xxx&status=draft
```

#### 获取结算单详情
```
GET /api/settlements/:id
```

---

### 优惠券接口

#### 获取优惠券列表
```
GET /api/coupons?user_id=xxx&status=active
```

#### 标记过期优惠券
```
POST /api/coupons/expire
```

---

### 批量操作接口

#### 获取批量操作列表
```
GET /api/batches?operation_type=import_order&status=completed
```

#### 获取批量操作结果
```
GET /api/batches/:id
```

#### 获取批量操作日志
```
GET /api/batches/:id/logs
```

## 数据库表结构

- **orders**: 订单主表
- **order_items**: 订单商品明细表
- **compensations**: 补偿记录表
- **coupons**: 优惠券表
- **operation_logs**: 操作日志表
- **settlements**: 结算单表
- **settlement_items**: 结算明细表
- **batch_operations**: 批量操作表
- **batch_operation_items**: 批量操作条目表

## 示例CSV数据

创建 `sample_orders.csv` 文件用于测试：

```csv
order_no,group_leader_id,group_leader_name,user_id,user_name,total_amount,product_id,product_name,sku_id,sku_name,quantity,unit_price,subtotal,is_out_of_stock,created_at
ORD001,GL001,张团长,U001,张三,99.9,P001,生鲜蔬菜,S001,500g,2,49.95,99.9,false,2024-01-15 10:30:00
ORD002,GL001,张团长,U002,李四,59.8,P002,新鲜水果,S002,1kg,1,59.8,59.8,true,2024-01-15 11:20:00
ORD003,GL002,李团长,U003,王五,120.0,P003,海鲜套餐,S003,组合装,1,120,120,false,2024-01-15 12:00:00
```

## 项目结构

```
.
├── src/
│   ├── index.js              # 入口文件
│   ├── database/
│   │   ├── index.js          # 数据库连接
│   │   └── init.js           # 数据库初始化
│   ├── services/
│   │   ├── orderService.js   # 订单服务
│   │   ├── compensationService.js  # 补偿服务
│   │   ├── settlementService.js    # 结算服务
│   │   ├── logService.js     # 日志服务
│   │   └── batchService.js   # 批量操作服务
│   └── routes/
│       ├── orders.js         # 订单路由
│       ├── compensations.js  # 补偿路由
│       ├── settlements.js    # 结算路由
│       ├── coupons.js        # 优惠券路由
│       └── batches.js        # 批量操作路由
├── data/                     # 数据库文件目录
├── package.json
└── README.md
```
