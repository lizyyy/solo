# 药房库存管理系统

社区药房疫苗和胰岛素台账管理系统，支持签收、隔离、复核、放行、退回全流程管理。

## 功能特性

- ✅ **五大操作**: 签收、隔离、复核、放行、退回
- ✅ **幂等性保证**: 重复提交不会产生副作用
- ✅ **数据校验**: 温度范围校验、状态流转校验
- ✅ **批量处理**: 支持批量操作，失败重试不影响成功记录
- ✅ **多条件查询**: 按负责人、时间、状态、异常类型筛选
- ✅ **报告导出**: 支持 CSV 和 JSON 格式导出
- ✅ **操作日志**: 完整的操作记录追踪

## 项目结构

```
pharmacy_inventory/
├── __init__.py
├── models.py          # 数据模型和数据库操作
├── service.py         # 核心业务逻辑
├── report.py          # 查询和报告生成
└── cli.py             # 命令行接口
tests/
└── test_inventory.py  # 单元测试
examples/
├── batch_receive.json # 批量签收示例
└── batch_operation.json # 批量操作示例
```

## 快速开始

### 运行测试

```bash
python -m pytest tests/test_inventory.py -v
```

### 命令行使用

#### 查看帮助

```bash
python -m pharmacy_inventory.cli --help
```

#### 签收产品

```bash
python -m pharmacy_inventory.cli receive \
  --batch-no VAC001 \
  --product-type vaccine \
  --product-name 新冠疫苗 \
  --quantity 100 \
  --temperature 5.0 \
  --receiver 张药师
```

#### 隔离产品

```bash
python -m pharmacy_inventory.cli isolate \
  --batch-no VAC001 \
  --product-type vaccine \
  --handler 王主管
```

#### 复核产品

```bash
python -m pharmacy_inventory.cli review \
  --batch-no VAC001 \
  --product-type vaccine \
  --handler 王主管
```

#### 放行产品

```bash
python -m pharmacy_inventory.cli release \
  --batch-no VAC001 \
  --product-type vaccine \
  --handler 王主管
```

#### 退回产品

```bash
python -m pharmacy_inventory.cli return \
  --batch-no VAC001 \
  --product-type vaccine \
  --handler 王主管 \
  --notes "厂家召回"
```

#### 批量签收

```bash
python -m pharmacy_inventory.cli batch-receive --file examples/batch_receive.json
```

#### 批量操作

```bash
python -m pharmacy_inventory.cli batch-operation \
  --operation review \
  --file examples/batch_operation.json \
  --handler 王主管
```

#### 查询记录

```bash
# 全部记录
python -m pharmacy_inventory.cli query

# 按签收人筛选
python -m pharmacy_inventory.cli query --receiver 张药师

# 按状态筛选
python -m pharmacy_inventory.cli query --status received

# JSON格式输出
python -m pharmacy_inventory.cli query --format json
```

#### 导出报告

```bash
# 导出CSV
python -m pharmacy_inventory.cli export --output report.csv --format csv

# 导出JSON
python -m pharmacy_inventory.cli export --output report.json --format json

# 按条件筛选导出
python -m pharmacy_inventory.cli export --receiver 张药师 --status received --output report.csv
```

#### 查看枚举值

```bash
python -m pharmacy_inventory.cli list-statuses
python -m pharmacy_inventory.cli list-product-types
python -m pharmacy_inventory.cli list-abnormal-types
```

## 数据模型

### 状态流转

```
received (已签收)
    ├──> isolated (已隔离)
    │       └──> reviewed (已复核)
    │               ├──> released (已放行)
    │               └──> returned (已退回)
    ├──> reviewed (已复核)
    │       ├──> isolated (已隔离)
    │       ├──> released (已放行)
    │       └──> returned (已退回)
    └──> returned (已退回)
```

### 产品类型

- `vaccine` - 疫苗
- `insulin` - 胰岛素

### 异常类型

- `normal` - 正常
- `temperature_abnormal` - 温度异常
- `package_damaged` - 包装破损
- `expired` - 过期
- `other` - 其他

### 温度要求

- 疫苗：2°C ~ 8°C
- 胰岛素：2°C ~ 8°C

## API 使用

```python
from pharmacy_inventory.service import InventoryService
from pharmacy_inventory.report import ReportGenerator

# 初始化服务
service = InventoryService()

# 签收
result = service.receive_product(
    batch_no="VAC001",
    product_type="vaccine",
    product_name="新冠疫苗",
    quantity=100,
    temperature=5.0,
    receiver="张药师"
)

# 复核
result = service.review_product(
    batch_no="VAC001",
    product_type="vaccine",
    handler="王主管"
)

# 查询和导出
report = ReportGenerator()
records = report.query_records(status="reviewed")
csv_content = report.export_to_csv(records)
```

## 幂等性说明

系统通过以下机制保证幂等性：

1. 每个操作自动生成幂等性键
2. 操作日志记录成功的操作
3. 重复操作直接返回成功，不执行实际操作
4. 批次号 + 产品类型唯一约束

## 注意事项

1. 数据库默认为 `pharmacy_inventory.db`（SQLite）
2. 温度异常的产品不能放行
3. 只有已复核的产品才能放行
4. 状态流转必须符合规定流程

## 许可证

MIT
