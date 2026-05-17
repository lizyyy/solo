# 展柜租赁账期核算CLI工具

商场展柜短租按天结算工具，支持租期拆分、加柜计费、保证金抵扣、合同异常检查和报告导出。

## 功能特性

- **数据解析**: 支持CSV格式数据导入，自动识别并记录坏行
- **来源追踪**: 所有数据保留原始文件位置信息
- **租期拆分**: 按合同约定账期自动拆分租期
- **加柜计费**: 支持加柜记录的按天计费，支持费率覆盖
- **保证金抵扣**: 自动计算保证金余额并抵扣费用
- **合同验证**: 30+项数据完整性和业务规则校验
- **稳定输出**: 相同输入重复运行结果一致，排序不影响结果
- **报告导出**: 支持CSV和JSON格式报告输出

## 项目结构

```
.
├── showcase_rental/           # 核心模块
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── parser.py              # 数据解析器
│   ├── rules.py               # 规则引擎
│   ├── exceptions.py          # 异常检测模块
│   ├── reporter.py            # 报告生成器
│   └── cli.py                 # CLI命令行接口
├── showcase_calculator.py     # 主入口脚本
├── data/                      # 测试数据目录
└── output/                    # 输出报告目录
```

## 使用方法

### 命令行参数

```bash
python3 showcase_calculator.py [OPTIONS]

选项:
  --contracts PATH       合同数据CSV文件路径
  --showcases PATH       展柜数据CSV文件路径
  --lease PATH           租期数据CSV文件路径
  --add-cabinet PATH     加柜记录CSV文件路径
  --deposit PATH         保证金记录CSV文件路径
  --data-dir PATH        数据目录（自动查找标准文件名）
  --output PATH          输出目录 (默认: output)
  --prefix TEXT          输出文件名前缀
  --quiet                静默模式，不输出控制台摘要
  --help                 显示帮助信息
```

### 使用示例

#### 方式1: 分别指定各数据文件

```bash
python3 showcase_calculator.py \
  --contracts data/contracts.csv \
  --showcases data/showcases.csv \
  --lease data/lease.csv \
  --add-cabinet data/add_cabinet.csv \
  --deposit data/deposit.csv \
  --output ./output
```

#### 方式2: 指定数据目录（推荐）

```bash
# 目录下需包含: contracts.csv, showcases.csv, lease.csv, add_cabinet.csv, deposit.csv
python3 showcase_calculator.py --data-dir ./data --output ./output
```

## 数据文件格式

### contracts.csv (合同数据)

| 字段 | 必填 | 说明 |
|------|------|------|
| contract_id | 是 | 合同唯一标识 |
| merchant_name | 是 | 商户名称 |
| start_date | 是 | 合同开始日期 |
| end_date | 是 | 合同结束日期 |
| daily_rate | 是 | 基础日租金 |
| deposit_amount | 是 | 约定保证金金额 |
| showcase_count | 是 | 展柜数量 |
| allow_add_cabinet | 否 | 是否允许加柜 (True/False) |
| add_cabinet_daily_rate | 否 | 加柜日租金 |
| deposit_refund_days | 否 | 保证金退还天数 |
| billing_cycle_days | 否 | 账期天数 |

### showcases.csv (展柜数据)

| 字段 | 必填 | 说明 |
|------|------|------|
| showcase_id | 是 | 展柜唯一标识 |
| contract_id | 是 | 关联合同ID |
| location | 是 | 展柜位置 |
| is_active | 否 | 是否启用 |

### lease.csv (租期数据)

| 字段 | 必填 | 说明 |
|------|------|------|
| lease_id | 是 | 租期唯一标识 |
| contract_id | 是 | 关联合同ID |
| showcase_id | 是 | 关联展柜ID |
| start_date | 是 | 租期开始日期 |
| end_date | 否 | 约定结束日期 |
| actual_end_date | 否 | 实际结束日期 |

### add_cabinet.csv (加柜记录)

| 字段 | 必填 | 说明 |
|------|------|------|
| add_id | 是 | 加柜唯一标识 |
| contract_id | 是 | 关联合同ID |
| showcase_id | 是 | 关联展柜ID |
| add_date | 是 | 加柜日期 |
| remove_date | 否 | 撤柜日期 |
| daily_rate_override | 否 | 覆盖日租金 |

### deposit.csv (保证金记录)

| 字段 | 必填 | 说明 |
|------|------|------|
| deposit_id | 是 | 记录唯一标识 |
| contract_id | 是 | 关联合同ID |
| amount | 是 | 金额 |
| transaction_type | 是 | 交易类型 (DEPOSIT/REFUND/DEDUCTION) |
| transaction_date | 是 | 交易日期 |
| is_refunded | 否 | 是否已退款 |
| refund_date | 否 | 退款日期 |

## 输出报告

运行后会在输出目录生成以下文件:

1. **billing_report.csv** - 账期明细报告
2. **validation_errors.csv** - 验证错误清单
3. **bad_rows.csv** - 坏行记录（保留原始数据和错误信息）
4. **summary.json** - 汇总统计报告
5. **contract_details.csv** - 合同明细

## 验证规则

### 合同验证
- 合同ID重复检查
- 结束日期早于开始日期检查
- 日租金必须大于0
- 保证金不能为负数
- 展柜数量必须大于0

### 展柜验证
- 展柜ID重复检查
- 关联合同存在性检查
- 合同约定展柜数量与实际数量匹配检查

### 租期验证
- 租期ID重复检查
- 关联合同和展柜存在性检查
- 租期开始日期不早于合同开始日期
- 租期结束日期不晚于合同结束日期
- 实际结束日期与约定日期差异提醒

### 加柜验证
- 加柜ID重复检查
- 关联合同和展柜存在性检查
- 合同是否允许加柜检查
- 撤柜日期不早于加柜日期

### 保证金验证
- 保证金ID重复检查
- 关联合同存在性检查
- 金额不能为负数
- 交易类型有效性检查
- 保证金余额为负数警告
- 实际余额与合同约定不符提醒

## 稳定性保证

- 所有输出基于ID稳定排序
- JSON输出键值排序
- 相同输入重复运行产生完全相同的输出
- 坏行记录保留原始数据和来源位置

## 示例运行

```bash
$ python3 showcase_calculator.py --data-dir ./data

================================================================================
展柜租赁账期核算报告
================================================================================

数据验证结果:
  错误 (ERROR): 0
  警告 (WARNING): 0
  信息 (INFO): 1
  坏行记录: 0

数据统计:
  合同数量: 3
  展柜数量: 9
  租期记录: 9
  加柜记录: 3
  保证金记录: 4
  生成账期: 44

费用汇总:
  基础租赁天数: 576 天
  基础租赁金额: 871500.00
  加柜天数: 47 天
  加柜金额: 53700.00
  保证金抵扣: 924500.00
  应收总额: 700.00
```
