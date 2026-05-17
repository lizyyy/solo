# 缺货补偿库存回写结算一致性排查CLI

一个用于团长处理团购缺货订单的自动化工具，支持退款、换货和积分补偿三种方式，提供完整的数据一致性检查和来源追踪功能。

## 项目结构

```
out_of_stock_cli/
├── models/              # 数据模型定义
│   ├── enums.py         # 枚举类型（补偿类型、状态等）
│   └── schemas.py       # 数据类（批次、订单、补偿方案等）
├── parsers/             # 数据解析模块
│   ├── base_parser.py   # 解析器基类
│   ├── batch_parser.py  # 批次解析器
│   ├── order_parser.py  # 订单解析器
│   ├── out_of_stock_parser.py  # 缺货解析器
│   ├── compensation_parser.py  # 补偿方案解析器
│   └── confirmation_parser.py  # 用户确认解析器
├── engines/             # 核心规则引擎
│   ├── allocation_engine.py    # 缺货分摊算法
│   ├── state_machine.py        # 补偿状态机
│   └── idempotency_engine.py   # 幂等性检查引擎
├── tracker/             # 追踪模块
│   ├── inventory_tracker.py    # 库存回写追踪
│   └── source_tracker.py       # 数据来源追踪
├── reports/             # 报告模块
│   ├── settlement_report.py    # 结算报告生成
│   └── consistency_checker.py  # 一致性检查器
├── utils/               # 工具函数
│   ├── validators.py    # 数据验证器
│   ├── normalizers.py   # 数据归一化工具
│   └── hash_utils.py    # 稳定哈希函数
├── examples/            # 示例数据文件
└── cli.py               # 命令行入口
```

## 安装

```bash
pip install -e .
```

或

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 运行完整流程

```bash
oos-cli run \
  --batch-file out_of_stock_cli/examples/batches.csv \
  --order-file out_of_stock_cli/examples/orders.csv \
  --oos-file out_of_stock_cli/examples/out_of_stock.csv \
  --conf-file out_of_stock_cli/examples/confirmations.csv \
  --output-dir ./output \
  --default-type refund
```

### 2. 仅验证数据

```bash
oos-cli validate \
  --batch-file batches.csv \
  --order-file orders.csv \
  --oos-file out_of_stock.csv
```

### 命令参数说明

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| --batch-file | -b | 是 | 批次数据文件 (CSV/Excel) |
| --order-file | -o | 是 | 订单数据文件 (CSV/Excel) |
| --oos-file | -s | 是 | 缺货数据文件 (CSV/Excel) |
| --conf-file | -c | 否 | 用户确认文件 (CSV/Excel) |
| --plan-file | -p | 否 | 已有补偿方案文件 |
| --default-type | -t | 否 | 默认补偿类型 (refund/points/exchange) |
| --output-dir | -d | 否 | 输出目录，默认 ./output |
| --output-name | -n | 否 | 输出文件名（不含扩展名） |

## 输入文件格式

### 1. 批次文件 (batches.csv)

| 列名 | 说明 |
|------|------|
| 批次ID | 批次唯一标识 |
| 批次名称 | 批次名称 |
| 开始时间 | 开始时间 |
| 结束时间 | 结束时间 |
| 状态 | 批次状态 |

### 2. 订单文件 (orders.csv)

| 列名 | 说明 |
|------|------|
| 订单ID | 订单唯一标识 |
| SKU_ID | 商品SKU |
| 商品名称 | 商品名称 |
| 数量 | 购买数量 |
| 单价 | 单价 |
| 总金额 | 总金额 |
| 用户ID | 用户ID |
| 用户名称 | 用户名称 |
| 下单时间 | 下单时间 |
| 订单状态 | 订单状态 (paid/shipped/cancelled等) |
| 批次ID | 所属批次ID |

### 3. 缺货文件 (out_of_stock.csv)

| 列名 | 说明 |
|------|------|
| 批次ID | 批次ID |
| SKU_ID | 商品SKU |
| 商品名称 | 商品名称 |
| 总订购量 | 该批次该商品总订购量 |
| 可用库存 | 实际可用库存 |
| 缺货数量 | 缺货数量 |

### 4. 用户确认文件 (confirmations.csv)

| 列名 | 说明 |
|------|------|
| 确认ID | 确认记录唯一标识 |
| 订单ID | 订单ID |
| SKU_ID | 商品SKU |
| 用户ID | 用户ID |
| 补偿类型 | refund/points/exchange |
| 确认时间 | 用户确认时间 |
| 是否确认 | 是/否 |

## 核心功能

### 1. 数据解析

- 支持CSV和Excel格式
- 坏行记录和保留原文件位置
- 自动类型转换和格式校验

### 2. 缺货分摊算法

- 按订单比例分摊缺货数量
- 保证结果稳定性（排序不影响结果）
- 支持三种补偿类型：退款、换货、积分

### 3. 补偿状态机

```
pending → confirmed → processed
   ↓           ↓
cancelled  failed
```

### 4. 幂等性检查

- 基于内容的稳定哈希
- 自动检测重复记录
- 防止重复处理

### 5. 库存回写

- 自动计算应回写库存数量
- 按批次和SKU汇总
- 生成库存变更记录

### 6. 来源追踪

- 每条记录追溯到原始文件和行号
- 完整的数据流转路径记录
- 支持审计和问题排查

### 7. 一致性检查

- 批次引用检查
- 订单引用检查
- 缺货数量一致性检查
- 状态一致性检查

### 8. 报告导出

- 结算记录
- 补偿方案明细
- 来源追踪记录
- 错误记录

## 输出报告说明

生成的Excel报告包含以下工作表：

1. **结算记录** - 最终结算结果
2. **补偿方案** - 所有补偿方案明细
3. **来源追踪** - 每条记录的来源信息
4. **错误记录** - 解析过程中发现的坏行

## 注意事项

1. 所有输入文件编码建议使用 UTF-8
2. 日期时间格式支持多种常见格式
3. 重复运行同一批材料结果稳定
4. 坏行会保留原文件位置信息
5. 建议先运行 validate 命令检查数据

## 技术栈

- Python 3.9+
- Click - 命令行框架
- pandas - 数据处理
- openpyxl - Excel读写

## 许可证

MIT License
