# 养老目标基金调仓对账工具

## 放样例

把以下 CSV 文件放到同一目录（默认 `samples/`）：

| 文件名 | 内容 |
|---|---|
| `receipts.csv` | 收款流水（列：交易流水号、基金代码、金额、交易日期、对方账户、状态） |
| `refunds.csv` | 退款申请（列：退款申请号、关联交易流水号、基金代码、退款金额、退款原因、申请日期、状态） |
| `approvals.csv` | 审批邮件索引（列：审批编号、关联退款申请号、审批人、审批日期、审批结果、附件引用） |
| `notes.csv` | 手写备注（列：备注编号、关联交易流水号、备注内容、记录人、记录日期、来源） |

备注的"来源"字段写 `晚到附件` 会触发变更链追踪，不覆盖原判断。

## 重跑

```bash
# 用默认 samples/ 目录
python3 -m pension_rebalance.cli

# 指定数据目录和输出目录
python3 -m pension_rebalance.cli -d /path/to/data -o /path/to/output

# 对比上次结果，生成差异报告
python3 -m pension_rebalance.cli --prev output/reconcile_detail.csv
```

## 输出文件

| 文件 | 说明 |
|---|---|
| `output/reconcile_detail.csv` | 财务明细：每条交易的完整对账结果、判定、原始来源、处理时间 |
| `output/change_chain.csv` | 晚到附件变更链：原值→新值、变更人、变更时间、变更原因 |
| `output/diff_report.csv` | 差异报告：与上次对账结果的判定变化（需传 `--prev`） |

## 判定说明

- **正常** — 金额一致 + 审批通过
- **正常(无退款)** — 无退款申请，收款单边正常
- **待核查** — 存在金额不一致、字段缺失、边界值等异常
- **待复核** — 晚到附件补充后需人工复核
- **孤立备注** — 备注关联的交易流水号在收款/退款中均不存在
