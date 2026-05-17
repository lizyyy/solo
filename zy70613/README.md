# 租赁押金审计CLI工具

摄影器材租赁店的押金冻结、损坏扣款和逾期续租审计工具。

## 功能特性

- **押金冻结审计**: 检查押金冻结金额是否正确，冻结时间是否及时
- **逾期计费审计**: 计算逾期天数，验证逾期费用是否合理
- **损坏扣款审计**: 验证损坏记录完整性，检查扣款金额一致性
- **续租幂等检查**: 防止重复续租申请，确保续租时间线连续
- **多格式支持**: 支持 CSV、JSON、JSONL 格式输入文件
- **来源追踪**: 记录每条数据的原始文件位置，坏行保留原始信息
- **稳定输出**: 重复运行同一批数据结果稳定，排序一致

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 生成示例数据

```bash
rental-audit generate-samples sample_data
```

### 2. 验证数据文件

```bash
rental-audit validate --file-type orders sample_data/orders.csv
rental-audit validate --file-type transactions sample_data/transactions.csv
rental-audit validate --file-type damages sample_data/damages.csv
rental-audit validate --file-type renewals sample_data/renewals.csv
```

### 3. 执行完整审计

```bash
rental-audit audit \
  --orders sample_data/orders.csv \
  --transactions sample_data/transactions.csv \
  --damages sample_data/damages.csv \
  --renewals sample_data/renewals.csv \
  --output-dir audit_output
```

### 4. 审计单个订单

```bash
rental-audit audit-order \
  --order-id ORD001 \
  --orders sample_data/orders.csv \
  --transactions sample_data/transactions.csv \
  --damages sample_data/damages.csv \
  --renewals sample_data/renewals.csv
```

## 数据格式说明

### 租赁订单 (orders.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| order_id | 订单ID | ORD001 |
| customer_id | 客户ID | CUST001 |
| customer_name | 客户姓名 | 张三 |
| equipment_id | 设备ID | CAM001 |
| equipment_name | 设备名称 | 佳能 EOS R5 套机 |
| rental_start_date | 租赁开始日期 | 2024-01-15 |
| rental_end_date | 租赁结束日期 | 2024-01-20 |
| daily_rate | 日租金 | 300 |
| deposit_amount | 押金金额 | 5000 |
| status | 订单状态 | pending/active/returned/overdue/settled |
| actual_return_date | 实际归还日期 | 2024-01-20 |
| created_at | 订单创建时间 | 2024-01-15T10:00:00 |

### 押金交易记录 (transactions.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| transaction_id | 交易ID | TRX001 |
| order_id | 订单ID | ORD001 |
| transaction_type | 交易类型 | deposit_freeze |
| amount | 金额 | 5000 |
| currency | 货币 | CNY |
| transaction_date | 交易时间 | 2024-01-15T10:30:00 |
| status | 状态 | frozen/released/partial_deducted/fully_deducted |
| payment_method | 支付方式 | credit_card |
| reference_no | 参考号 | REF001 |

### 损坏记录 (damages.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| damage_id | 损坏ID | DMG001 |
| order_id | 订单ID | ORD001 |
| equipment_id | 设备ID | CAM001 |
| damage_description | 损坏描述 | 镜头轻微划痕 |
| severity | 严重程度 | minor/moderate/severe/total_loss |
| repair_cost | 维修费用 | 200 |
| reported_date | 报告时间 | 2024-01-20T16:30:00 |
| reported_by | 报告人 | staff001 |
| photos_attached | 附件照片 | photo1.jpg;photo2.jpg |
| is_verified | 是否已验证 | true |

### 续租申请 (renewals.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| renewal_id | 续租ID | REN001 |
| order_id | 订单ID | ORD001 |
| original_end_date | 原结束日期 | 2024-01-20 |
| new_end_date | 新结束日期 | 2024-01-25 |
| renewal_days | 续租天数 | 5 |
| renewal_fee | 续租费用 | 1500 |
| application_date | 申请时间 | 2024-01-19T10:00:00 |
| approved | 是否批准 | true |
| approved_by | 批准人 | staff002 |
| approved_date | 批准时间 | 2024-01-19T10:30:00 |
| idempotency_key | 幂等键 | IDEMP_ORD001_001 |

## 输出文件说明

审计完成后，输出目录会生成以下文件：

- `audit_report_*.json`: 完整审计报告（JSON格式）
- `audit_report_*.csv`: 审计结果汇总（CSV格式）
- `audit_report_*_bad_rows.csv`: 解析错误的原始数据记录
- `audit_*.txt`: 单个订单详细审计报告

## 审计规则说明

### 押金冻结检查
- 验证冻结金额是否等于订单押金金额
- 检查冻结时间是否在订单创建后合理时间内（默认1天）
- 检查扣款和退款金额是否与预期一致

### 逾期计费检查
- 计算实际逾期天数（考虑已批准的续租）
- 验证逾期订单状态是否正确
- 检查续租时间线是否连续

### 损坏扣款检查
- 验证损坏记录是否完整（设备匹配、有照片、已验证）
- 检查损坏扣款金额是否与维修费用一致
- 确保损坏报告时间在租赁期内

### 续租幂等检查
- 检测同一幂等键下的重复申请
- 检查已批准续租的内容是否一致
- 验证续租时间线是否连续无重叠

## 命令行参数

### audit 命令
```
--orders, -o        租赁订单文件路径 (必填)
--transactions, -t  押金交易记录文件路径 (必填)
--damages, -d       损坏记录文件路径 (可选)
--renewals, -r      续租申请文件路径 (可选)
--output-dir, -O    输出目录路径 (默认: audit_output)
--report-name       报告名称 (不包含扩展名)
--verbose, -v       显示详细日志
```

### audit-order 命令
```
--order-id, -i      要审计的订单ID (必填)
--orders, -o        租赁订单文件路径 (必填)
--transactions, -t  押金交易记录文件路径 (必填)
--damages, -d       损坏记录文件路径 (可选)
--renewals, -r      续租申请文件路径 (可选)
--output-dir, -O    输出目录路径 (默认: audit_output)
```

### validate 命令
```
--file-type, -t     文件类型: orders/transactions/damages/renewals (必填)
--output-dir, -O    输出目录路径 (默认: audit_output)
```

### generate-samples 命令
```
output_dir          输出目录路径 (默认: sample_data)
```

## 项目结构

```
rental-audit/
├── pyproject.toml           # 项目配置
├── README.md                # 说明文档
└── src/rental_audit/
    ├── __init__.py
    ├── models.py            # 数据模型定义
    ├── parser.py            # 文件解析器
    ├── rules.py             # 审计规则引擎
    ├── reporter.py          # 报告生成器
    └── cli.py               # 命令行入口
```

## 依赖

- Python >= 3.10
- click >= 8.0
- pydantic >= 2.0
- pandas >= 2.0
- python-dateutil >= 2.8
- jinja2 >= 3.0
