# ETF申赎成分券差异校验工具

基金运营早盘核对ETF申赎清单时，券商回来的成分券差异自动校验工具。

## 功能特性

- ✅ **成分券校验**：对比申赎清单与券商回执的成分券数量差异
- 💰 **替代现金重算**：根据替代现金清单重算校验，防止重复计入
- 📋 **回执版本管理**：识别初步/最终/更正回执状态
- 🚨 **异常检测**：
  - 停牌证券仍按实物处理的风险
  - 替代现金重复计入问题
  - 回执晚到覆盖旧结论提醒
- 📊 **多重输出**：终端摘要、机器可读JSON、人读HTML报告、CSV对账导出

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 生成测试样例数据

```bash
etf-recon generate-samples
```

### 2. 运行校验

```bash
etf-recon reconcile \
  -r sample_data/redemption_list.csv \
  -b sample_data/broker_receipt.csv \
  -s sample_data/suspended.csv \
  -c sample_data/cash_substitution.csv
```

## 命令行选项

```
--redemption, -r    申赎清单文件 (CSV/Excel)
--receipt, -b       券商回执文件 (CSV/Excel)
--suspended, -s     停牌日历文件 (可选)
--cash-sub, -c      替代现金清单 (可选)
--output-dir, -o    输出目录 (默认: ./output)
--format, -f        输出格式: json/html/csv (可多选)
--no-terminal       不显示终端输出
```

## 输入文件格式

### 申赎清单
| 字段 | 说明 |
|------|------|
| ETF代码 | ETF代码 |
| ETF名称 | ETF名称 |
| 交易日期 | 申赎日期 |
| 最小申赎单位 | 申赎单位 |
| 证券代码 | 成分券代码 |
| 证券名称 | 成分券名称 |
| 数量 | 申赎数量 |
| 替代标志 | 允许/禁止/必须 |
| 替代金额 | 现金替代金额 |

### 券商回执
| 字段 | 说明 |
|------|------|
| 券商名称 | 券商名称 |
| 回执时间 | 回执接收时间 |
| 版本号 | 回执版本 |
| 回执状态 | 初步/最终/更正 |
| 实际数量 | 实际交收数量 |
| 实际替代金额 | 实际替代金额 |

## 输出文件

- `{ETF代码}_{日期}_{券商}.json` - 机器可读完整结果
- `{ETF代码}_{日期}_{券商}.html` - 人读可视化报告
- `{ETF代码}_{日期}_{券商}.csv` - 对账用差异明细

## 项目结构

```
etf_recon/
├── models.py      # 数据模型定义
├── reader.py      # 数据读取模块
├── reconciler.py  # 核心校验逻辑
├── reporter.py    # 结果输出模块
└── cli.py         # 命令行入口
```
