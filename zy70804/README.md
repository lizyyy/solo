# 跨境电商关务系统

## 功能概述

- **数据导入**：支持申报单CSV导入、税则JSON导入、退单回执录入
- **业务处理**：币种换算、品类归并、重复补税处理
- **状态管理**：新增批次、标记处理、退回修改
- **数据追踪**：操作日志记录、补税凭证溯源
- **数据导出**：Excel格式导出申报明细

## 技术栈

- FastAPI: Web框架
- SQLAlchemy: ORM
- SQLite: 数据库
- Pandas: 数据处理
- openpyxl: Excel导出

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库连接配置
│   ├── models.py        # 数据模型定义
│   ├── schemas.py       # Pydantic schema定义
│   ├── services.py      # 业务逻辑实现
│   └── routers.py       # API路由定义
├── test_data/           # 测试数据
│   ├── hs_codes.json
│   └── declaration.csv
├── main.py              # 应用入口
├── test_customs.py      # 测试文件
├── requirements.txt     # 依赖包
└── README.md
```

## 安装运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py

# 访问API文档
http://localhost:8000/docs
```

## API接口

### 数据导入
- `POST /api/hs-codes/import` - 导入税则编码JSON
- `POST /api/batches/import` - 导入申报单CSV
- `POST /api/rejection-notices` - 创建退单通知

### 业务处理
- `POST /api/items/{item_id}/convert-currency` - 币种换算
- `POST /api/items/merge-category` - 品类归并
- `POST /api/items/{item_id}/supplement-tax` - 补税处理

### 状态管理
- `PUT /api/items/{item_id}/status` - 更新状态
- `PUT /api/items/{item_id}/return` - 退回修改

### 查询导出
- `GET /api/items/export` - 导出明细Excel
- `GET /api/batches/{batch_no}` - 查询批次详情
- `GET /api/tax-certificates/{certificate_no}/trace` - 补税凭证溯源
- `GET /api/operation-logs` - 查询操作日志

## 运行测试

```bash
pytest test_customs.py -v
```

## 数据模型

### DeclarationBatch (申报批次)
- batch_no: 批次号
- declaration_port: 申报口岸
- status: 状态 (pending/processing/processed/returned/supplement_tax)
- total_items: 总项数
- total_amount: 总金额
- total_tax: 总税额

### DeclarationItem (申报明细)
- item_no: 项号
- sku: SKU
- product_name: 商品名称
- hs_code: HS编码
- quantity: 数量
- total_price: 总价
- currency: 币制
- total_price_cny: 人民币总价
- tax_rate: 税率
- tax_amount_cny: 人民币税额
- status: 状态 (pending/approved/rejected/needs_correction/supplement_tax)
- is_supplement_tax: 是否补税
- supplement_tax_count: 补税次数

### TaxCertificate (补税凭证)
- certificate_no: 凭证号
- tax_amount: 税额
- reason: 原因
- handler: 处理人
- source_type/source_id: 来源追踪

### OperationLog (操作日志)
- operation_type: 操作类型
- operator: 操作人
- reason: 原因
- before_data: 变更前数据
- after_data: 变更后数据
