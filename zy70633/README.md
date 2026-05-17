# 器材配件归还复核押金扣款排查CLI

一个用于影棚器材借还管理的命令行工具，支持配件核对、归还复核、扣款审批、逾期计费和报告导出。

## 安装

```bash
pip3 install -e .
```

如果 `equipment-cli` 命令不在 PATH 中，可以使用完整路径：
```bash
/Users/lzy/Library/Python/3.9/bin/equipment-cli --help
```

## 命令说明

### 1. 执行完整归还复核 (verify)

```bash
equipment-cli verify \
  -e sample_data/equipment.csv \
  -o sample_data/orders.csv \
  -i sample_data/inspections.csv \
  -d sample_data/deductions.csv \
  -out ./reports \
  -f all
```

参数说明：
- `-e, --equipment`: 器材CSV文件路径（必需）
- `-o, --orders`: 借用单CSV文件路径（必需）
- `-i, --inspections`: 归还检查CSV文件路径（必需）
- `-d, --deductions`: 押金扣款CSV文件路径（必需）
- `-out, --output`: 报告输出目录（默认: ./reports）
- `-f, --format`: 输出格式（text/csv/all，默认: all）

### 2. 仅检查数据文件 (check-data)

```bash
equipment-cli check-data \
  -e sample_data/equipment.csv \
  -o sample_data/orders.csv \
  -i sample_data/inspections.csv \
  -d sample_data/deductions.csv
```

### 3. 显示数据文件格式说明 (show-example)

```bash
equipment-cli show-example
```

## 数据文件格式

### 1. 器材数据 (equipment.csv)
```
器材ID,器材名称,分类,型号,序列号,购买日期,日租金,押金金额
E001,佳能EOS R5,相机,EOS R5,SER12345,2023-01-15,200,5000
```

### 2. 借用单数据 (orders.csv)
```
借用单ID,器材ID,借用人,部门,借用日期,预计归还日期,实际归还日期,配件清单,已付押金
O001,E001,张三,摄影部,2024-01-10,2024-01-15,2024-01-16,A001:电池:2:300;A002:充电器:1:200,5000
```

**配件清单格式**: `配件ID:名称:数量:单价;配件ID:名称:数量:单价`

### 3. 归还检查数据 (inspections.csv)
```
检查单ID,借用单ID,检查人,检查日期,器材状态,备注,归还配件
I001,O001,检查员A,2024-01-16,轻微划痕,机身有轻微划痕,A001:电池:1:300;A002:充电器:1:200
```

**器材状态**: 无损坏 / 轻微划痕 / 中度损坏 / 严重损坏

### 4. 押金扣款数据 (deductions.csv)
```
扣款单ID,借用单ID,扣款类型,扣款金额,扣款原因,申请人,审批状态,审批人,审批日期
D001,O001,配件丢失,300,缺少一块电池,管理员A,已批准,主管A,2024-01-17
```

**审批状态**: 待审批 / 已批准 / 已拒绝

## 输出报告

执行 `verify` 命令后，报告目录会包含以下文件：

1. **full_report.txt**: 完整的文本报告，包含所有订单的详细复核结果
2. **summary.csv**: 汇总数据统计
3. **verification_results.csv**: 各订单的复核结果表格
4. **bad_records.csv**: 数据错误记录（如有的话）

## 核心功能

- **配件核对**: 自动比对借出和归还的配件数量差异
- **归还复核**: 检查器材损坏状况并记录
- **扣款审批**: 区分已批准和待审批的扣款记录
- **逾期计费**: 自动计算逾期天数和逾期费用
- **来源追踪**: 坏行会记录原文件位置和行号
- **结果稳定**: 相同输入产生相同输出，不受排序影响

## 项目结构

```
equipment_rental_cli/
├── __init__.py
├── main.py                 # CLI主程序
├── models/                 # 数据模型
│   ├── __init__.py
│   └── models.py
├── parsers/                # 数据解析模块
│   ├── __init__.py
│   └── csv_parser.py
├── engine/                 # 规则引擎
│   ├── __init__.py
│   └── rules.py
├── reports/                # 报告生成
│   ├── __init__.py
│   └── generator.py
└── utils/                  # 工具函数
    ├── __init__.py
    └── tracking.py
```
