# 社区药房库存管理系统

疫苗和胰岛素冷链管理后端服务

## 功能特性

### 核心功能
1. **CSV批量导入** - 支持送货单CSV文件批量导入
2. **规则校验引擎** - 自动校验每条记录的合规性
3. **敏感字段脱敏** - API返回、导出、日志中的敏感字段自动脱敏
4. **复核管理** - 支持单条或批量复核，通过后自动入库
5. **库存管理** - 完整的库存管理和出入库记录
6. **操作日志** - 所有操作都有完整的审计日志
7. **批量操作跟踪** - 记录批量操作的成功/失败明细

### 校验规则
- **温度越界校验** - 检查温度是否在产品规定范围内（疫苗/胰岛素通常2-8°C）
- **批号重复校验** - 防止同一批号重复入库
- **破损照片校验** - 有破损记录时必须上传照片
- **有效期校验** - 检查产品是否过期或有效期不足
- **签收人信息校验** - 确保签收人信息完整

## 快速开始

### 环境要求
- Node.js 14+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 初始化数据库
```bash
npm run init-db
```

### 启动服务
```bash
npm start
```

服务将运行在 http://localhost:3000

## API 文档

### 健康检查
```
GET /api/health
```

### 送货单管理

#### 导入送货单（CSV）
```
POST /api/delivery/import
Content-Type: multipart/form-data

参数:
- file: CSV文件
- order_no: 订单号（必填）
- supplier: 供应商
- delivery_date: 送货日期
- created_by: 创建人
```

CSV文件格式示例（详见 `examples/sample_delivery.csv`）：
```csv
product_code,product_name,batch_no,quantity,unit,temperature,receiver_name,receiver_phone,has_damage,damage_description,production_date,expiry_date
VAC001,新冠疫苗,B202405001,100,支,2.5,张三,13800138000,0,,2024-01-01,2025-01-01
```

#### 获取送货单列表
```
GET /api/delivery?page=1&pageSize=20&status=pending
```

#### 获取送货单详情
```
GET /api/delivery/{id}
```

#### 获取送货单明细
```
GET /api/delivery/{id}/items?is_valid=true
```

#### 复核送货单（批量）
```
POST /api/delivery/{id}/review
Content-Type: application/json

{
  "reviewed_by": "操作员姓名",
  "approved_item_ids": [1, 2, 3]
}
```

#### 复核单条明细
```
POST /api/delivery/items/{itemId}/review
Content-Type: application/json

{
  "reviewed_by": "操作员姓名",
  "approved": true,
  "remark": "复核备注"
}
```

#### 重新校验送货单
```
POST /api/delivery/{id}/revalidate
```

#### 删除送货单
```
DELETE /api/delivery/{id}
```

#### 导出货单明细
```
GET /api/delivery/{id}/export?format=csv|json
```

#### 获取送货单统计
```
GET /api/delivery/statistics
```

### 库存管理

#### 获取库存列表
```
GET /api/inventory?product_code=VAC001&batch_no=B202405001
```

#### 获取库存流水
```
GET /api/inventory/transactions?product_code=VAC001&batch_no=B202405001&limit=100
```

#### 获取库存汇总
```
GET /api/inventory/summary
```

#### 导出库存
```
GET /api/inventory/export?format=csv|json
```

### 日志查询

#### 操作日志
```
GET /api/logs/operations?page=1&pageSize=20&operation_type=delivery_import
```

#### 批量操作历史
```
GET /api/logs/batches?limit=20
```

#### 批量操作详情
```
GET /api/logs/batches/{batchNo}
```

## 数据脱敏说明

系统会自动对以下敏感字段进行脱敏处理：

| 字段 | 原始值 | 脱敏后 |
|------|--------|--------|
| 姓名 | 张三 | 张* |
| 手机号 | 13800138000 | 138****8000 |
| 身份证 | 110101199001011234 | 110101********1234 |
| 邮箱 | zhangsan@example.com | z*******@example.com |
| 地址 | 北京市朝阳区某某街道123号 | 北京市****123号 |

脱敏发生在以下场景：
1. API接口返回数据
2. CSV/JSON导出文件
3. 数据库操作日志
4. 服务器日志文件

## 数据库设计

### 核心表结构
- `products` - 产品信息表（含温度范围）
- `delivery_orders` - 送货单主表
- `delivery_items` - 送货单明细表（含温度、签收人、破损等信息）
- `inventory` - 库存表
- `inventory_transactions` - 库存流水表
- `operation_logs` - 操作日志表
- `validation_rules` - 校验规则表
- `batch_operations` - 批量操作表
- `batch_operation_items` - 批量操作明细表

## 项目结构

```
├── src/
│   ├── app.js                 # 主应用入口
│   ├── database/
│   │   ├── index.js           # 数据库连接
│   │   ├── init.js            # 初始化脚本
│   │   └── schema.sql         # 数据库schema
│   ├── services/
│   │   ├── csvService.js      # CSV导入导出服务
│   │   ├── deliveryService.js # 送货单服务
│   │   ├── inventoryService.js # 库存服务
│   │   ├── validationService.js # 规则校验服务
│   │   └── batchService.js    # 批量操作服务
│   ├── utils/
│   │   ├── dataMasking.js     # 数据脱敏工具
│   │   └── logger.js          # 日志工具
│   └── routes/
│       ├── delivery.js        # 送货单路由
│       ├── inventory.js       # 库存路由
│       └── logs.js            # 日志路由
├── data/                       # 数据库文件目录
├── logs/                       # 日志文件目录
├── uploads/                    # 上传文件目录
├── examples/                   # 示例文件
│   └── sample_delivery.csv    # 示例送货单CSV
└── package.json
```

## 测试命令

```bash
# 健康检查
curl http://localhost:3000/api/health

# 导入送货单
curl -X POST \
  -F "file=@examples/sample_delivery.csv" \
  -F "order_no=ORDER001" \
  -F "supplier=测试供应商" \
  -F "delivery_date=2024-05-19" \
  http://localhost:3000/api/delivery/import

# 获取送货单详情
curl http://localhost:3000/api/delivery/1

# 获取库存
curl http://localhost:3000/api/inventory
```

## 注意事项

1. 所有敏感字段都会自动脱敏，无需额外处理
2. 复核通过的商品会自动增加到库存
3. 温度范围是根据产品信息动态判断的
4. 批量操作会详细记录每条的成功/失败状态
5. 操作日志不可删除，用于审计追踪

## License

MIT
