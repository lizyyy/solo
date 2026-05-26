# 汽修连锁门店后端服务

一套完整的汽修连锁门店数据管理后端服务，支持套餐CSV、工单JSON、配件库存的导入、审核、追踪和导出。

## 功能特性

### 核心功能
- **数据导入**：支持套餐CSV、工单JSON、配件库存CSV的批量导入
- **批次管理**：新增批次、标记处理、退回修改、导出明细
- **审计追踪**：跨店核销、项目替换、库存扣减等操作全程留痕，记录原因、处理人和时间
- **历史查询**：重启服务后可按套餐权益、门店工单、配件批次查询历史记录
- **数据导出**：导出数量与查询结果一致，支持CSV格式

### 业务场景支持
- ✅ 套餐权益管理（含包含配件明细）
- ✅ 跨店核销处理（记录原门店和核销门店）
- ✅ 项目替换审批（套餐外增加项目需说明原因）
- ✅ 库存自动扣减（工单审核通过后自动扣减对应配件库存）
- ✅ 人工修正流程（信息不完整可退回修改）

## 技术栈
- Node.js + Express
- SQLite3（轻量级嵌入式数据库，无需额外安装）
- csv-parser + json2csv（CSV处理）
- multer（文件上传）

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm start
```
服务将在 `http://localhost:3000` 启动

### 3. 运行测试脚本（完整业务流程演示）
```bash
npm test
```

## API 接口文档

### 通用说明
- 所有接口返回格式：`{ success: boolean, data: any, error?: string }`
- 操作人通过 Header `x-operator` 传递，如 `x-operator: 店长-王经理`

### 1. 健康检查
```
GET /api/health
```

### 2. 批次管理

#### 2.1 获取批次列表
```
GET /api/batches?page=1&pageSize=20&status=pending&batchType=package&storeCode=ST001&keyword=BATCH
```
参数说明：
- `status`: pending/processing/completed/completed_with_issues/has_errors
- `batchType`: package/workorder/stock
- `storeCode`: 门店编码
- `keyword`: 批次号模糊搜索

#### 2.2 获取批次详情（批次项列表）
```
GET /api/batches/:id/items?status=pending
```
参数说明：
- `status`: pending/approved/rejected/returned

#### 2.3 导入套餐CSV
```
POST /api/batches/import/packages
Content-Type: multipart/form-data
Body: file=<CSV文件>, store_code=HQ001
```

#### 2.4 导入工单JSON
```
POST /api/batches/import/workorders
Content-Type: multipart/form-data
Body: file=<JSON文件>, store_code=HQ001
```

#### 2.5 导入库存CSV
```
POST /api/batches/import/stock
Content-Type: multipart/form-data
Body: file=<CSV文件>, store_code=HQ001
```

#### 2.6 处理批次项（审核通过/拒绝/退回）
```
POST /api/batches/items/:id/process
Content-Type: application/json
{
  "action": "approve",      // approve/reject/return
  "reason": "审核原因",      // 必填
  "itemType": "workorder",  // package/workorder/stock
  "updates": {              // 可选，修改数据
    "customer_name": "张三"
  }
}
```

#### 2.7 导出批次数据
```
POST /api/batches/:id/export
```

### 3. 数据查询

#### 3.1 查询套餐列表
```
GET /api/packages?page=1&pageSize=20&status=active&packageType=maintenance&keyword=保养
```

#### 3.2 查询套餐详情（含操作日志）
```
GET /api/packages/:code
```

#### 3.3 查询工单列表
```
GET /api/workorders?page=1&pageSize=20&status=completed&storeCode=ST001&packageCode=PKG001&keyword=张三
```

#### 3.4 查询工单详情（含操作日志和库存变动）
```
GET /api/workorders/:no
```

#### 3.5 查询配件库存
```
GET /api/parts?page=1&pageSize=20&partType=oil&storeCode=ST001&keyword=机油&lowStock=true
```
参数说明：
- `lowStock`: true（仅查询库存低于安全线的配件）

#### 3.6 查询配件详情（含操作日志和库存变动）
```
GET /api/parts/:code
```

#### 3.7 查询操作日志
```
GET /api/logs?page=1&pageSize=20&module=workorder&operationType=APPROVE_WORKORDER&operator=店长&relationCode=WO20260520001
```

### 4. 数据导出

```
POST /api/export/packages   // 导出套餐
POST /api/export/workorders // 导出工单
POST /api/export/parts      // 导出配件
POST /api/export/logs       // 导出操作日志
```

## 数据格式说明

### 套餐CSV格式
```csv
package_code,package_name,package_type,original_price,sale_price,validity_start,validity_end,description,items
PKG001,小保养套餐,maintenance,599,399,2026-01-01,2026-12-31,包含机油更换、机滤、空滤检查,"[{""part_code"":""OIL001"",""quantity"":1}]"
```

### 工单JSON格式
```json
[
  {
    "order_no": "WO20260520001",
    "store_code": "ST001",
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "plate_number": "京A12345",
    "vehicle_model": "大众帕萨特 2023款",
    "package_code": "PKG001",
    "order_amount": 399,
    "actual_amount": 399,
    "order_status": "completed",
    "order_date": "2026-05-20",
    "items": [
      {"part_code": "OIL001", "part_name": "全合成机油 5W-30", "quantity": 1, "unit_price": 280}
    ],
    "remarks": "",
    "is_cross_store": false,
    "needs_review": false
  }
]
```

### 库存CSV格式
```csv
part_code,part_name,part_type,unit,unit_price,stock_quantity,safe_stock,supplier,store_code
OIL001,全合成机油 5W-30,oil,桶,280,150,20,嘉实多,ST001
```

## 样例数据

项目包含完整的样例数据，位于 `samples/` 目录：
- `packages.csv` - 5个套餐样例，包含小保养、大保养等
- `workorders.json` - 4条工单样例，包含：
  - 正常工单
  - 跨店核销工单
  - 项目替换工单
  - 需要人工修正的工单（信息不完整）
- `stock.csv` - 14条库存样例，覆盖两个门店

## 业务流程演示

运行 `npm test` 可看到完整的业务流程：

1. **健康检查** - 确认服务正常
2. **导入套餐CSV** - 创建套餐批次
3. **导入工单JSON** - 创建工单批次（含需要人工修正的记录）
4. **导入库存CSV** - 创建库存批次
5. **获取批次列表** - 查看所有批次状态
6. **处理批次项** - 自动识别并处理：
   - 正常记录 → 审核通过
   - 跨店核销 → 记录原因后通过
   - 项目替换 → 记录原因后通过
   - 信息不完整 → 退回修改，说明原因
7. **查询数据** - 查询套餐、工单、库存、操作日志
8. **工单详情追踪** - 查看单条工单的完整操作历史
9. **导出数据** - 导出工单CSV

## 审计追踪说明

每条数据的所有操作都会被记录，包括：
- 操作类型（CREATE/IMPORT/APPROVE/REJECT/RETURN/EXPORT等）
- 操作模块（package/workorder/stock/batch）
- 关联数据编码
- 操作人
- 操作原因（必填）
- 变更前后数据对比
- 操作时间
- IP地址

查询详情时可看到完整的操作历史，便于向他人解释"为什么这条记录被放行、退回或要求补材料"。

## 目录结构

```
├── server.js              # 服务入口
├── config.js              # 配置文件
├── models/
│   └── database.js        # 数据库模型和操作
├── routes/
│   ├── batches.js         # 批次管理接口
│   └── query.js           # 查询和导出接口
├── services/
│   ├── importService.js   # 导入和批次处理服务
│   └── queryService.js    # 查询和导出服务
├── middleware/
│   └── audit.js           # 审计日志中间件
├── samples/               # 样例数据
├── scripts/
│   └── test-api.js        # API测试脚本
├── data/                  # 数据库文件目录
├── uploads/               # 上传文件目录
└── exports/               # 导出文件目录
```

## 常见问题

**Q: 重启服务后数据会丢失吗？**
A: 不会。数据存储在 SQLite 数据库文件 `data/auto_repair.db` 中，重启服务后可正常查询所有历史数据。

**Q: 导出的数量和查询结果一致吗？**
A: 一致。导出功能使用与查询相同的筛选条件，确保导出数量与查询结果完全一致。

**Q: 库存扣减是自动的吗？**
A: 是的。工单审核通过时，系统会自动根据套餐包含的配件扣减对应门店的库存，并生成库存变动记录。

**Q: 如何查看一条记录的完整处理历史？**
A: 调用详情接口（如 `/api/workorders/WO20260520001`），返回数据中包含 `operation_logs` 字段，记录了该工单的所有操作历史。
