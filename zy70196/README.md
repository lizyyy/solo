# 到货短缺索赔 API CLI

一个偏后端的「到货短缺索赔 API」CLI，重点处理到货短缺时关联收货、质检和索赔单的业务流程。

## 核心特性

- **数据模型**：清晰体现收货差异、质检结论、索赔计算的关系
- **完整流程**：从收货 → 质检 → 索赔草稿 → 索赔提交 → 供应商确认 → 扣款回执 → 索赔报表
- **异常处理**：边界数据不会静默吞掉，会进入可查询的异常记录或待处理列表
- **可测试代码**：核心业务判断独立成函数，有完整单元测试覆盖

## 技术栈

- Node.js + Express
- Prisma + SQLite
- Jest（单元测试）
- Commander（CLI）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 生成 Prisma 客户端并执行迁移
npm run db:migrate
```

### 3. 造数（创建测试数据）

```bash
# 创建种子数据（包含正常流程和异常流程的示例数据）
npm run db:seed
```

### 4. 启动服务

```bash
npm start
```

服务会在 `http://localhost:3000` 启动

### 5. 运行测试

```bash
npm test
```

## 核心业务流程

### 主流程（正常索赔）

1. **创建收货单**：记录到货数量，自动计算差异（预期 - 实收）
2. **创建质检单**：对收到的货物进行质量检验，记录合格/缺陷数量
3. **生成索赔草稿**：根据收货差异和质检缺陷自动生成索赔草稿
4. **创建正式索赔单**：确认索赔明细，分配责任方
5. **提交索赔单**：索赔单状态从 DRAFT → SUBMITTED
6. **供应商确认**：供应商确认索赔，状态变为 SUPPLIER_CONFIRMED
7. **记录扣款回执**：录入扣款信息，索赔结算完成（SETTLED）
8. **生成索赔报表**：输出完整索赔报告

### 异常流程

当遇到以下情况时，数据会进入异常记录或待处理任务：

- 收货数量超过预期（多送货物）
- 质检数量超过收货数量
- 索赔数量超过实际短缺/缺陷数量
- 索赔金额为零
- 责任方未分配
- 状态流转不合法

## CLI 使用

```bash
# 查看帮助
npm run cli -- --help

# 检查系统状态
npm run cli -- health

# 列出数据
npm run cli -- list suppliers
npm run cli -- list products
npm run cli -- list deliveries
npm run cli -- list claims
npm run cli -- list exceptions
npm run cli -- list tasks

# 查看详情
npm run cli -- show delivery DN-2026-001
npm run cli -- show claim CLM-2026-001
npm run cli -- show claim-report CLM-2026-001

# 工作流演示
npm run cli -- workflow demo-normal    # 正常流程演示
npm run cli -- workflow demo-exception # 异常流程演示
```

## API 接口

### 供应商接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/suppliers | 创建供应商 |
| GET | /api/suppliers | 获取供应商列表 |
| GET | /api/suppliers/:id | 获取供应商详情 |

### 产品接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/products | 创建产品 |
| GET | /api/products | 获取产品列表 |
| GET | /api/products/:id | 获取产品详情 |

### 收货单接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/deliveries | 创建收货单 |
| GET | /api/deliveries | 获取收货单列表 |
| GET | /api/deliveries/:id | 获取收货单详情 |
| GET | /api/deliveries/no/:deliveryNo | 按单号获取收货单 |

### 质检单接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/inspections | 创建质检单 |
| GET | /api/inspections/:id | 获取质检单详情 |
| GET | /api/inspections/delivery/:deliveryId | 按收货单获取质检单 |

### 索赔单接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/claims/draft/:deliveryId | 生成索赔草稿 |
| POST | /api/claims | 创建索赔单 |
| GET | /api/claims | 获取索赔单列表 |
| GET | /api/claims/:id | 获取索赔单详情 |
| GET | /api/claims/no/:claimNo | 按单号获取索赔单 |
| POST | /api/claims/:id/submit | 提交索赔单 |
| POST | /api/claims/:id/supplier-confirm | 供应商确认 |
| POST | /api/claims/:id/supplier-reject | 供应商拒绝 |
| POST | /api/claims/:id/deduction-receipt | 记录扣款回执 |
| GET | /api/claims/:id/report | 生成索赔报表 |

### 异常和任务接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/exceptions | 获取异常记录列表 |
| POST | /api/exceptions/:id/resolve | 解决异常 |
| GET | /api/exceptions/tasks | 获取待处理任务列表 |
| POST | /api/exceptions/tasks/:id/complete | 完成任务 |

## 数据模型关系

```
Supplier (1) ──→ (N) Delivery (1) ──→ (1) Inspection (1) ──→ (1) Claim
                    │                  │                    │
                    ↓                  ↓                    ↓
             DeliveryItem (N) ─→ InspectionItem (N) ─→ ClaimItem (N)
```

### 关键关联字段

- **ClaimItem.deliveryItemId**：关联收货明细，获取短缺数量
- **ClaimItem.inspectionItemId**：关联质检明细，获取缺陷数量
- **ClaimItem.responsibility**：责任方（SUPPLIER/LOGISTICS/INTERNAL/UNDEFINED）
- **ClaimItem.claimAmount**：索赔金额 = (短缺数量 + 缺陷数量) × 单价

## 核心判断逻辑（可测试）

### Delivery Service

- `validateDeliveryItem()`：验证收货明细字段合法性
- `calculateDeliveryItem()`：计算差异数量和金额
- `determineDeliveryStatus()`：根据差异判断收货状态

### Inspection Service

- `validateInspectionItem()`：验证质检明细字段合法性
- `determineInspectionItemResult()`：判断质检结果（PASS/PARTIAL_PASS/FAIL）
- `determineOverallInspectionResult()`：判断整体质检结果
- `validateInspectionQuantity()`：验证质检数量不超过收货数量

### Claim Service

- `validateClaimItem()`：验证索赔明细字段合法性
- `calculateClaimAmount()`：计算索赔金额
- `determineResponsibility()`：自动判断责任方
- `validateClaimQuantities()`：验证索赔数量不超过实际短缺/缺陷
- `calculateClaimSummary()`：计算索赔汇总
- `hasClaimableItems()`：判断是否有可索赔项
- `checkForMissingResponsibilities()`：检查是否有未分配责任的项目

## 触发异常的示例

### 1. 多送货物（触发异常记录）

```bash
# 执行异常流程演示
npm run cli -- workflow demo-exception
```

或使用 API：

```bash
curl -X POST http://localhost:3000/api/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryNo": "DN-TEST-001",
    "supplierId": "<supplier-id>",
    "deliveryDate": "2026-05-10",
    "items": [{
      "productId": "<product-id>",
      "expectedQty": 100,
      "receivedQty": 105,
      "unitPrice": 50
    }]
  }'
```

然后查看异常记录：

```bash
npm run cli -- list exceptions
```

### 2. 索赔数量超过实际短缺

```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "claimNo": "CLM-TEST-001",
    "deliveryId": "<delivery-id>",
    "supplierId": "<supplier-id>",
    "items": [{
      "deliveryItemId": "<delivery-item-id>",
      "productId": "<product-id>",
      "responsibility": "SUPPLIER",
      "shortageQty": 100,
      "defectQty": 0,
      "unitPrice": 50
    }]
  }'
```

## 项目结构

```
.
├── prisma/
│   └── schema.prisma          # 数据模型
├── src/
│   ├── index.js               # Express 服务入口
│   ├── lib/
│   │   └── prisma.js          # Prisma 客户端
│   ├── routes/                # API 路由
│   │   ├── suppliers.js
│   │   ├── products.js
│   │   ├── deliveries.js
│   │   ├── inspections.js
│   │   ├── claims.js
│   │   └── exceptions.js
│   ├── services/              # 业务逻辑层
│   │   ├── deliveryService.js
│   │   ├── inspectionService.js
│   │   ├── claimService.js
│   │   └── exceptionService.js
│   ├── cli/
│   │   └── index.js           # CLI 工具
│   └── seeders/               # 数据种子
│       ├── index.js
│       └── reset.js
├── tests/                     # 单元测试
│   ├── deliveryService.test.js
│   ├── inspectionService.test.js
│   └── claimService.test.js
├── package.json
├── jest.config.js
└── README.md
```

## 单元测试

核心业务逻辑的测试覆盖率：

- **Delivery Service**：8 个测试用例
  - validateDeliveryItem（字段验证）
  - calculateDeliveryItem（差异计算）
  - determineDeliveryStatus（状态判断）

- **Inspection Service**：9 个测试用例
  - validateInspectionItem（字段验证）
  - determineInspectionItemResult（质检结果判断）
  - determineOverallInspectionResult（整体结果判断）
  - validateInspectionQuantity（数量验证）

- **Claim Service**：16 个测试用例
  - validateClaimItem（字段验证）
  - calculateClaimAmount（金额计算）
  - determineResponsibility（责任判断）
  - validateClaimQuantities（数量验证）
  - calculateClaimSummary（汇总计算）
  - hasClaimableItems（可索赔判断）
  - checkForMissingResponsibilities（责任检查）

运行测试：

```bash
npm test
```

## 重置数据库

```bash
npm run db:reset
npm run db:seed
```
