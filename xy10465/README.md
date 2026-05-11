# 应收催款分层 CLI

一个帮助销售助理管理应收账款和催款优先级的命令行工具。

## 功能

- 导入应收清单、客户等级、催款记录和承诺付款日期
- 按逾期天数、金额、争议状态自动分层
- 查看客户详情、记录催款、标记争议、更新回款
- 生成催款优先列表、承诺失约名单和回款周报

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
python -m ar_collector --help
```

### 命令示例

```bash
# 初始化数据目录
python -m ar_collector init

# 导入数据
python -m ar_collector import receivables sample_data/receivables.csv
python -m ar_collector import customers sample_data/customers.csv
python -m ar_collector import collection_logs sample_data/collection_logs.csv
python -m ar_collector import promises sample_data/promises.csv

# 查看客户详情
python -m ar_collector customer C001

# 记录催款
python -m ar_collector collect INV001 --date 2026-05-10 --status contacted --notes "客户承诺下周付款"

# 标记争议
python -m ar_collector dispute INV001 --reason "发票金额有误"

# 解除争议
python -m ar_collector resolve INV001 --notes "已重新开具发票"

# 更新回款
python -m ar_collector payment INV001 --amount 1000 --date 2026-05-10

# 查看催款优先列表
python -m ar_collector report priority

# 查看承诺失约名单
python -m ar_collector report missed

# 查看回款周报
python -m ar_collector report weekly
```
