# HydroCalc - 水培营养液配方计算 CLI

HydroCalc 是一个为小型水培种植社群设计的本地营养液配方计算工具。

## 功能特性

- **check** - 检查 CSV 数据完整性（字段缺失、单位非法、重复原料、元素名拼写、上下限冲突）
- **calc** - 根据目标配方生成可执行称量方案，贴近目标区间，提示无法满足的元素，库存不扣负
- **apply** - 确认使用方案后扣减库存并写入账本
- **undo** - 安全撤销最近一次扣减
- **report** - 导出 Markdown 和 CSV 格式报告

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 准备数据文件

创建 `inventory.csv`（原料库存）：
```csv
名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,98.0,"N:0.1186,Ca:0.1697",500,0.015
硝酸钾,99.0,"N:0.1385,K:0.3867",300,0.020
磷酸二氢钾,98.0,"P:0.2276,K:0.2873",200,0.025
硫酸镁,99.0,"Mg:0.0986,S:0.1301",400,0.012
```

创建 `recipe.csv`（目标配方）：
```csv
目标体积(L),元素,ppm下限,ppm上限,禁用原料,备注
10,N,150,180,"",叶菜生长期
10,P,40,60,"",
10,K,200,250,"",
10,Ca,150,180,"",
10,Mg,40,50,"",
```

### 2. 检查数据

```bash
hydrocalc check --inventory inventory.csv --recipe recipe.csv
```

### 3. 计算配方

```bash
hydrocalc calc --inventory inventory.csv --recipe recipe.csv --output plan.json
```

### 4. 应用配方（扣减库存）

```bash
hydrocalc apply --plan plan.json --inventory inventory.csv
```

### 5. 撤销操作

```bash
hydrocalc undo --inventory inventory.csv
```

### 6. 生成报告

```bash
hydrocalc report --inventory inventory.csv --ledger ledger.json --format md
hydrocalc report --inventory inventory.csv --ledger ledger.json --format csv
```

## 项目结构

```
hydrocalc/
├── __init__.py
├── cli.py          # CLI 入口
├── models.py       # 数据模型（元素、原料、配方）
├── csv_parser.py   # CSV 解析器
├── solver.py       # 配方求解器
├── ledger.py       # 库存账本管理
└── reporter.py     # 报告生成器
```

## 测试

```bash
pip install pytest
pytest tests/
```
