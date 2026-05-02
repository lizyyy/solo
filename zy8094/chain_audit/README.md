# Chain Audit Tool

反兴奋剂样本链路复核工具，面向赛事医务组赛后整理 A/B 瓶样本。

## 功能特性

- 重建采样、封签、交接、入库、送检状态
- 检测封签号不一致、交接缺签、时间倒挂、A/B 瓶拆分异常
- 支持跨时区比赛和同一运动员多次采样

## 输入文件

| 文件 | 描述 |
|------|------|
| athletes.csv | 运动员数据 |
| sample_events.jsonl | 样本事件数据 |
| handover_rules.yaml | 交接规则配置 |
| lab_receipts.csv | 实验室回执 |

## 输出文件

| 文件 | 描述 |
|------|------|
| chain_audit.md | 审计报告 (Markdown) |
| issues.csv | 问题列表 (CSV) |
| timeline.html | 可浏览时间线 |

## 安装依赖

```bash
pip install pyyaml
```

## Demo 命令

```bash
# 运行审计
python -m chain_audit \
  --athletes data/athletes.csv \
  --events data/sample_events.jsonl \
  --rules data/handover_rules.yaml \
  --receipts data/lab_receipts.csv \
  --output-dir output

# 查看输出
cat output/chain_audit.md
cat output/issues.csv
open output/timeline.html
```

## 模块结构

- `parse/` - 解析模块 (CSV, JSONL, YAML)
- `state_machine/` - 状态机模块
- `rules/` - 规则验证模块
- `report/` - 报告生成模块
- `cli/` - 命令行接口
