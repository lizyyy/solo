# 跨境电商关务对账系统

这是一个基于Go + Gin + GORM + SQLite开发的跨境电商关务对账后端服务，用于自动化处理申报单、税则和退单回执的对账工作。

## 功能特性

### 1. 数据导入
- **申报单CSV导入**：批量导入海关申报单数据
- **税则JSON导入**：导入HS编码对应的税率信息
- **退单回执JSON导入**：导入海关退单调整信息

### 2. 自动比对引擎
- 币种自动换算（支持多种货币转人民币）
- 税款自动计算（基于HS编码匹配税率）
- 差异来源自动识别和说明
- 重复申报检测及补税计算

### 3. 差异类型
- `tax_rate`：税率差异
- `currency`：汇率/币种转换差异
- `amount`：金额差异
- `hs_code`：HS编码未找到
- `return`：海关退单调整
- `duplicate`：重复申报补税

### 4. 人工复核
- 支持单条明细人工调整
- 支持调整税率和最终税款
- 复核记录留痕和历史追溯
- 批量汇总数据自动更新

### 5. 全链路追踪
- 从订单明细到最终报告的完整链路
- 差异记录和复核记录完整保存
- 支持按订单号、批次号查询

### 6. 报告生成
- 支持CSV格式报告导出
- 支持JSON格式报告导出
- 包含完整的对账明细和差异说明

## 项目结构

```
customs-reconciliation/
├── cmd/
│   └── server/
│       └── main.go              # 程序入口
├── config/
│   └── config.go                # 数据库配置
├── internal/
│   ├── models/
│   │   └── models.go            # 数据模型
│   ├── repository/
│   │   └── repository.go        # 数据访问层
│   ├── services/
│   │   ├── import_service.go    # 数据导入服务
│   │   ├── reconciliation_service.go # 对账引擎
│   │   ├── review_service.go    # 复核服务
│   │   └── report_service.go    # 报告服务
│   └── controllers/
│       ├── batch_controller.go
│       ├── import_controller.go
│       ├── review_controller.go
│       └── report_controller.go
├── reports/                     # 报告输出目录
├── go.mod
├── go.sum
└── README.md
```

## 快速开始

### 1. 安装依赖
```bash
go mod download
```

### 2. 启动服务
```bash
go run cmd/server/main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 健康检查
```bash
curl http://localhost:8080/health
```

## API 接口文档

### 批次管理

#### 创建对账批次
```bash
POST /api/batches
Content-Type: application/json

{
  "name": "2024年1月对账批次"
}
```

#### 获取批次列表
```bash
GET /api/batches?page=1&pageSize=20
```

#### 获取单个批次详情
```bash
GET /api/batches/:id
```

#### 执行对账处理
```bash
POST /api/batches/:id/process
```

#### 获取批次明细
```bash
GET /api/batches/:id/items
```

#### 获取批次差异列表
```bash
GET /api/batches/:id/discrepancies
```

#### 获取品类汇总
```bash
GET /api/batches/:id/summary/category
```

#### 获取币种汇总
```bash
GET /api/batches/:id/summary/currency
```

### 数据导入

#### 导入申报单CSV
```bash
POST /api/batches/:batchId/import/declarations
Content-Type: multipart/form-data

file: <CSV文件>
```

CSV格式示例：
```csv
order_no,tracking_no,declarant,declare_date,hs_code,product_name,category,quantity,unit_price,total_amount,currency,declared_tax_amount
ORD001,TRK001,测试公司,2024-01-15,85171210,智能手机,电子产品,10,500.00,5000.00,USD,450.00
ORD002,TRK002,测试公司,2024-01-15,61091000,棉制T恤,纺织品,100,20.00,2000.00,USD,180.00
```

#### 导入税则JSON
```bash
POST /api/batches/:batchId/import/tariffs
Content-Type: multipart/form-data

file: <JSON文件>
```

JSON格式示例：
```json
[
  {
    "hs_code": "85171210",
    "product_name": "智能手机",
    "category": "电子产品",
    "tax_rate": 0.13,
    "vat_rate": 0.13,
    "effective_date": "2024-01-01",
    "is_active": true
  }
]
```

#### 导入退单回执JSON
```bash
POST /api/batches/:batchId/import/return-receipts
Content-Type: multipart/form-data

file: <JSON文件>
```

JSON格式示例：
```json
[
  {
    "receipt_no": "RTN001",
    "order_no": "ORD001",
    "return_date": "2024-01-20",
    "return_code": "TAX_ADJUST",
    "return_reason": "税率申报有误，需补缴",
    "adjusted_tax": 50.00,
    "require_supplement": true
  }
]
```

### 人工复核

#### 复核单条明细
```bash
POST /api/items/review
Content-Type: application/json

{
  "item_id": "uuid",
  "reviewer": "张三",
  "new_tax_rate": 0.15,
  "new_tax_amount": 500.00,
  "notes": "税率调整为15%",
  "resolve_discrepancies": true
}
```

#### 获取单条复核历史
```bash
GET /api/items/:id/review-history
```

#### 获取单条完整链路追踪
```bash
GET /api/items/:id/trace
```

#### 完成批次复核
```bash
POST /api/batches/:id/complete
Content-Type: application/json

{
  "reviewer": "张三"
}
```

### 报告管理

#### 生成报告
```bash
POST /api/reports
Content-Type: application/json

{
  "batch_id": "uuid",
  "report_type": "full",
  "format": "csv",
  "generated_by": "张三"
}
```

#### 获取批次报告列表
```bash
GET /api/reports/batch/:id
```

#### 下载报告
```bash
GET /api/reports/:id/download
```

## 数据模型说明

### ReconciliationItem（对账明细）
- 订单号、物流单号
- HS编码、商品名称、品类
- 申报金额、币种、人民币换算金额
- 适用税率、预期税款、申报税款
- 税款差异、退单调整税款、需补税款
- 最终税款、状态、复核信息

### Discrepancy（差异记录）
- 差异类型
- 字段名称
- 预期值、实际值、差异值
- 详细说明和来源
- 是否已解决

### ReviewRecord（复核记录）
- 操作人
- 调整前后税率和税款
- 调整备注
- 操作时间

## 典型工作流程

1. **创建批次** → 创建对账批次
2. **导入数据** → 导入申报单CSV、税则JSON、退单回执JSON
3. **执行对账** → 系统自动比对计算差异
4. **查看结果** → 查看对账明细和差异说明
5. **人工复核** → 对有差异的条目进行人工调整
6. **生成报告** → 导出CSV/JSON格式报告
7. **完成批次** → 标记批次为已完成

## 技术栈

- **语言**: Go 1.21+
- **Web框架**: Gin
- **ORM**: GORM
- **数据库**: SQLite (可轻松切换为MySQL/PostgreSQL)
- **高精度计算**: shopspring/decimal (避免浮点数精度问题)

## 注意事项

1. 所有金额计算使用 `decimal` 类型，避免浮点数精度丢失
2. 汇率数据需预先维护，或通过默认汇率处理
3. 税则数据需包含完整的HS编码和有效期限
4. 所有修改操作均有完整记录留痕

## 扩展建议

1. 接入实时汇率API
2. 添加用户权限管理
3. 支持更多文件格式导入（Excel）
4. 添加数据校验规则
5. 接入海关系统API自动获取退单数据
6. 添加数据可视化仪表盘
