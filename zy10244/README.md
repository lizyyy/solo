# 供应商发票抵扣 API

一个完整的供应商发票管理与抵扣核对系统，提供采购单、入库、退货、发票、预付款和抵扣结果的创建与核对接口。

## 功能特性

- ✅ **采购单管理** - 创建和查询采购单
- ✅ **入库管理** - 记录商品入库
- ✅ **退货管理** - 处理退货记录
- ✅ **发票管理** - 发票导入和状态跟踪
- ✅ **预付款管理** - 记录预付款
- ✅ **智能抵扣** - 自动计算可抵扣金额
- ✅ **异常检测** - 处理各种异常场景
- ✅ **历史记录** - 完整的抵扣历史追踪

## 业务规则校验

1. **发票金额超额** - 发票金额不能超过可抵扣金额
2. **税率不一致** - 检测采购单与发票税率差异
3. **退货未冲抵** - 退货金额自动从可抵扣金额中扣除
4. **重复核销** - 已全额抵扣的发票不能再次抵扣
5. **重复导入** - 同一发票号不能重复导入

## 技术栈

- Node.js + Express
- SQLite 数据库
- RESTful API

## 安装与启动

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式（nodemon）
npm run dev
```

服务启动后访问: http://localhost:3000

## API 接口列表

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 健康检查 |

### 采购单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/purchase-orders | 创建采购单 |
| GET | /api/purchase-orders | 查询所有采购单 |
| GET | /api/purchase-orders/:id | 查询单个采购单 |

### 入库管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/receipts | 创建入库单 |

### 退货管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/returns | 创建退货单 |

### 发票管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/invoices | 创建发票 |
| GET | /api/invoices | 查询所有发票 |
| GET | /api/invoices/:id | 查询单个发票 |

### 预付款管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/prepayments | 创建预付款 |

### 抵扣管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/deductions | 创建抵扣 |
| POST | /api/deductions/validate | 验证抵扣 |
| GET | /api/deductions | 查询所有抵扣记录 |
| GET | /api/deductions/invoice/:id/history | 查询发票抵扣历史 |
| GET | /api/deductions/differences | 查询差异原因 |
| GET | /api/deductible/:poId/:supplierId | 查询可抵扣余额 |

## 使用示例

### 1. 完整流程演示

运行测试脚本：

```bash
npm test
```

### 2. 手动调用示例

#### 创建采购单
```bash
curl -X POST http://localhost:3000/api/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{
    "poNumber": "PO-2024-001",
    "supplierId": "SUP001",
    "supplierName": "测试供应商",
    "totalAmount": 10000,
    "taxRate": 0.13,
    "items": [
      {
        "productId": "P001",
        "productName": "商品A",
        "quantity": 100,
        "unitPrice": 100
      }
    ]
  }'
```

#### 创建入库单
```bash
curl -X POST http://localhost:3000/api/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "receiptNumber": "RCP-2024-001",
    "poId": "<采购单ID>",
    "supplierId": "SUP001",
    "totalAmount": 10000,
    "taxAmount": 1300
  }'
```

#### 创建退货单
```bash
curl -X POST http://localhost:3000/api/returns \
  -H "Content-Type: application/json" \
  -d '{
    "returnNumber": "RET-2024-001",
    "poId": "<采购单ID>",
    "receiptId": "<入库单ID>",
    "supplierId": "SUP001",
    "totalAmount": 5000,
    "taxAmount": 650
  }'
```

#### 创建发票
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "INV-2024-001",
    "supplierId": "SUP001",
    "supplierName": "测试供应商",
    "poId": "<采购单ID>",
    "invoiceDate": "2024-01-15",
    "totalAmount": 10000,
    "taxAmount": 1300,
    "taxRate": 0.13
  }'
```

#### 查询可抵扣余额
```bash
curl http://localhost:3000/api/deductible/<采购单ID>/SUP001
```

#### 验证发票抵扣
```bash
curl -X POST http://localhost:3000/api/deductions/validate \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "<发票ID>",
    "poId": "<采购单ID>",
    "supplierId": "SUP001"
  }'
```

#### 创建抵扣
```bash
curl -X POST http://localhost:3000/api/deductions \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "<发票ID>",
    "poId": "<采购单ID>",
    "supplierId": "SUP001",
    "amount": 5000,
    "tax": 650,
    "operator": "财务张三"
  }'
```

#### 查询差异原因
```bash
curl "http://localhost:3000/api/deductions/differences?invoiceId=<发票ID>&poId=<采购单ID>&supplierId=SUP001"
```

#### 查询抵扣历史
```bash
curl http://localhost:3000/api/deductions/invoice/<发票ID>/history
```

## 异常场景测试

### 场景1: 发票金额超过可抵扣金额
- 创建10000元采购单，全部入库
- 退货5000元，可抵扣余额剩余5000元
- 导入10000元发票
- 尝试抵扣时系统提示超额

### 场景2: 税率不一致
- 创建13%税率的采购单
- 导入9%税率的发票
- 系统给出警告但允许操作

### 场景3: 重复核销
- 发票全额抵扣后
- 再次尝试抵扣
- 系统拒绝并提示已全额抵扣

### 场景4: 重复导入发票
- 导入同一发票号两次
- 第二次导入被拒绝

## 数据结构

### 发票状态
- `pending` - 待抵扣
- `partially_deducted` - 部分抵扣
- `fully_deducted` - 全额抵扣
- `void` - 作废

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── database.js        # 数据库配置
│   ├── routes/
│   │   └── deduction.js   # API路由
│   └── services/
│       └── deductionService.js  # 业务逻辑
├── test/
│   └── demo.js            # 测试脚本
├── data/                  # 数据库文件
├── package.json
└── README.md
```

## 许可证

MIT
