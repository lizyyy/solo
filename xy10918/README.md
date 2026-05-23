# 农资赊销回款API

面向乡镇农资店的赊销管理后端API服务，解决退货、折扣、回款对账混乱的问题。

## 功能特性

- **客户管理**：客户信息建档、查询、更新
- **赊销单管理**：创建赊销订单、多商品批次、折扣处理
- **退货管理**：商品退货、自动抵扣欠款
- **回款管理**：分期回款、多种支付方式记录
- **欠款报告**：自动生成欠款汇总报告、支持Excel导出
- **幂等性保障**：重复入账自动识别，避免重复记账
- **异常日志**：异常请求自动记录，支持人工处理
- **人工修正**：支持人工调整欠款金额

## 数据模型

| 模型 | 说明 | 核心字段 |
|------|------|----------|
| Customer | 客户信息 | 姓名、电话、地址、身份证号 |
| CreditOrder | 赊销单 | 订单号、客户ID、总金额、折扣、已付、欠款、状态 |
| CreditOrderItem | 赊销商品明细 | 商品批次、名称、数量、单价、已退数量 |
| ReturnRecord | 退货记录 | 退货单号、订单ID、商品批次、数量、金额 |
| Payment | 回款流水 | 回款单号、订单ID、金额、支付方式 |
| DebtReport | 欠款报告 | 报告号、客户范围、应收总额、已收、欠款、订单数 |
| ExceptionLog | 异常日志 | 请求ID、端点、原始输入、错误信息、处理状态 |

## 核心业务规则

1. **欠款计算**：欠款金额 = 商品总金额 - 折扣金额 - 退货金额 - 已付金额
2. **退货抵扣**：退货自动更新订单欠款金额和商品可退数量
3. **分期回款**：支持多次回款，每次回款自动抵扣对应欠款
4. **幂等性**：通过`idempotency_key`保证重复请求不重复记账
5. **状态流转**：pending(待付款) → partial(部分付款) → paid(已结清)

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_sample_data.py
```

### 3. 启动API服务

方式一（推荐，需 `pip install -e .` 后）:
```bash
agri-credit-api
```

方式二:
```bash
python -m uvicorn app.main:app --reload
```

方式三:
```bash
python -m app.main
```

服务地址：http://localhost:8000

API文档：http://localhost:8000/docs

### 4. 运行自检测试

```bash
python test_api.py
```

测试覆盖：
- ✓ 正常业务流程（创建客户→赊销单→退货→回款→导出报告）
- ✓ 幂等性测试（重复请求不重复创建）
- ✓ 脏数据测试（异常场景处理）
- ✓ 导出内容一致性（Excel数据与API数据一致）
- ✓ 人工修正功能

## API接口说明

### 客户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/customers | 创建客户 |
| GET | /api/customers | 查询客户列表 |
| GET | /api/customers/{id} | 查询单个客户 |
| PUT | /api/customers/{id} | 更新客户信息 |

### 赊销单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/credit-orders | 创建赊销单（支持幂等） |
| GET | /api/credit-orders | 查询赊销单列表 |
| GET | /api/credit-orders/{id} | 查询单个赊销单 |

请求示例：
```json
{
  "customer_id": 1,
  "discount_amount": 20.0,
  "remark": "春耕化肥",
  "items": [
    {
      "product_batch": "HF2024001",
      "product_name": "尿素",
      "quantity": 10,
      "unit_price": 80.0,
      "unit": "袋",
      "specification": "50kg/袋"
    }
  ],
  "idempotency_key": "uuid-key-here"
}
```

### 退货管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/returns | 创建退货记录（支持幂等） |
| GET | /api/returns | 查询退货列表 |

### 回款管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/payments | 创建回款记录（支持幂等） |
| GET | /api/payments | 查询回款列表 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reports/generate | 生成欠款报告 |
| POST | /api/reports/{id}/export | 导出Excel报告 |
| GET | /api/reports/{id}/download | 下载报告文件 |
| GET | /api/reports | 查询报告列表 |

### 人工修正

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/corrections/manual | 人工修正欠款金额 |

请求示例：
```json
{
  "order_id": 1,
  "new_debt_amount": 300.0,
  "correction_reason": "抹零优惠",
  "corrected_by": "管理员"
}
```

### 异常日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/exceptions | 查询异常日志列表 |
| PUT | /api/exceptions/{id}/resolve | 标记异常已处理 |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI应用入口
│   ├── database.py      # 数据库连接配置
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic数据验证
│   └── services.py      # 业务逻辑服务层
├── exports/             # Excel报告导出目录
├── init_sample_data.py  # 样例数据初始化
├── test_api.py          # 自检测试脚本
├── requirements.txt     # 依赖清单
├── pyproject.toml       # 项目配置
└── agri_credit.db       # SQLite数据库文件
```

## 常见问题

### Q: 如何保证不会重复入账？
A: 每个创建接口都支持`idempotency_key`参数，使用相同的key重复请求不会重复创建记录。

### Q: 退货数量有限制吗？
A: 退货数量不能超过该商品批次的已赊销数量减去已退货数量。

### Q: 报告导出的文件在哪里？
A: 默认导出到`exports/`目录下，文件名为报告编号。

### Q: 异常请求会记录什么信息？
A: 会记录请求ID、请求端点、HTTP方法、原始请求内容、错误信息、错误类型等，便于后续排查和人工处理。
