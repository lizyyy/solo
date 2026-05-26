# 区域财务对账系统

## 系统概述

本系统用于区域财务处理缴存CSV、销售JSON、备用金流水数据，生成可追踪的财务记录。支持异常检测、对账处理、人工审核、历史查询和数据导出等功能。

## 快速开始

### 1. 安装依赖

```bash
cd finance_service
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_sample_data.py
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心功能

### 1. 批次管理

- **创建批次**: `POST /api/batches`
  支持三种批次类型：`deposit`(缴存)、`sales`(销售)、`petty_cash`(备用金)

- **上传文件**: `POST /api/batches/{batch_id}/upload`
  - 缴存数据：CSV格式
  - 销售数据：JSON格式
  - 备用金数据：CSV格式

- **退回批次**: `POST /api/batches/{batch_id}/return`
  支持将整个批次退回，记录原因和处理人

### 2. 异常检测与对账

- **异常检测**: `POST /api/batches/{batch_id}/detect-anomalies`
  自动检测：
  - 重复缴存（相同缴存单号）
  - 节假日/周末缴存延迟

- **对账处理**: `POST /api/batches/{batch_id}/reconcile`
  自动比对缴存金额与销售现金金额，识别长短款

### 3. 记录处理

- **批量处理**: `POST /api/records/process`
  支持操作：
  - `approve`: 审核通过（标记为resolved）
  - `return`: 退回修改（标记为returned）
  - `pending`: 标记待处理

  每条处理记录都会保存：
  - 原因（reason）
  - 处理人（handled_by）
  - 处理时间（handled_at）
  - 处理类型（action_type）

### 4. 查询功能

- **批次查询**: `GET /api/batches`
  支持按门店编码、批次号、状态筛选

- **缴存记录查询**: `GET /api/deposit-records`
  支持按门店编码、批次号、状态、日期范围筛选

- **备用金查询**: `GET /api/petty-cash-records`
  支持按门店编码、账户号、状态、日期范围筛选

- **处理日志查询**: `GET /api/process-logs`
  可按批次或单条记录查询完整处理轨迹

### 5. 数据导出

- **导出缴存记录**: `GET /api/export/deposit-records`
- **导出备用金记录**: `GET /api/export/petty-cash-records`
- **导出批次明细**: `GET /api/export/batches/{batch_id}`

支持导出格式：`excel`、`csv`
导出数量与查询结果完全一致

## 数据格式说明

### 缴存CSV格式

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| store_code | 字符串 | 是 | 门店编码 |
| deposit_date | 日期 | 是 | 缴存日期 |
| deposit_amount | 数字 | 是 | 缴存金额 |
| deposit_bank | 字符串 | 否 | 缴存银行 |
| deposit_slip_no | 字符串 | 否 | 缴存单号 |
| cashier | 字符串 | 否 | 收银员 |
| remarks | 字符串 | 否 | 备注 |

### 销售JSON格式

```json
{
  "records": [
    {
      "store_code": "SH001",
      "sale_date": "2024-01-15T09:30:00",
      "sale_amount": 5000.00,
      "payment_method": "cash",
      "transaction_no": "TX20240115001",
      "cashier": "张三"
    }
  ]
}
```

### 备用金CSV格式

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| store_code | 字符串 | 是 | 门店编码 |
| account_no | 字符串 | 是 | 备用金账户号 |
| trans_date | 日期 | 是 | 交易日期 |
| trans_type | 字符串 | 是 | 交易类型（income/expense） |
| trans_amount | 数字 | 是 | 交易金额 |
| balance | 数字 | 否 | 账户余额 |
| purpose | 字符串 | 否 | 用途 |
| handler | 字符串 | 否 | 经手人 |
| voucher_no | 字符串 | 否 | 凭证号 |

## 状态说明

### 批次状态

- `pending`: 待处理
- `processing`: 处理中
- `completed`: 已完成
- `returned`: 已退回

### 缴存记录状态

- `pending`: 待核对
- `matched`: 已匹配
- `over`: 长款
- `short`: 短款
- `returned`: 已退回
- `resolved`: 已解决

## 处理类型

- `duplicate`: 重复缴存
- `overage`: 长款
- `shortage`: 短款
- `holiday_delay`: 节假日延迟
- `manual_correction`: 人工修正

## 典型业务流程

### 场景1：正常对账流程

1. 上传销售数据批次
2. 上传缴存数据批次
3. 执行异常检测
4. 执行对账（自动匹配缴存与销售）
5. 审核异常记录（标记approve/return）
6. 导出对账结果

### 场景2：处理短款

1. 对账后发现短款（status=short）
2. 财务人员核实原因
3. 调用处理接口，填写原因和处理人
4. 记录状态变更为resolved
5. 处理日志自动留存完整轨迹

### 场景3：退回补充材料

1. 发现批次数据不完整
2. 调用退回接口，说明退回原因
3. 门店补充后重新上传
4. 所有处理记录可追溯

## 运行测试

```bash
# 确保服务已启动
uvicorn app.main:app --reload

# 运行完整流程测试
python tests/test_full_flow.py
```

## 项目结构

```
finance_service/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI应用入口
│   ├── database.py       # 数据库配置
│   ├── models.py         # SQLAlchemy数据模型
│   ├── schemas.py        # Pydantic数据验证
│   ├── services.py       # 业务逻辑层
│   └── parser.py         # 文件解析与导出
├── data/
│   ├── sample_deposit.csv      # 缴存样例数据
│   ├── sample_sales.json       # 销售样例数据
│   └── sample_petty_cash.csv   # 备用金样例数据
├── tests/
│   └── test_full_flow.py       # 完整流程测试
├── init_sample_data.py         # 初始化样例数据
├── requirements.txt
└── README.md
```
