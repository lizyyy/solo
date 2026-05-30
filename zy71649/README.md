# 房贷提前还款规划 CLI

专业的房贷提前还款规划工具，帮助理财顾问为客户提供科学的提前还款方案分析。

## 功能特性

- **精准计算**：等额本息还款计算、剩余本金测算
- **违约金分析**：支持多种违约金规则（固定金额、比例、罚息期数）
- **现金流压力测试**：分析提前还款对家庭现金流的影响
- **情景对比**：多方案对比（缩短期限/减少月供/部分提前）
- **智能导入**：支持重复导入时的跳过、更新、冲突处理
- **异常分类**：区分数据问题、规则问题、材料缺失三类异常
- **报告导出**：支持 Excel/Markdown 格式导出，附带专业解释
- **审计追踪**：记录修改历史、确认状态

## 快速开始

```bash
# 安装依赖
pip install -e .

# 查看帮助
mortgage --help

# 按样例流程跑通（新人交接推荐）
mortgage demo run
```

## 典型工作流程

1. `mortgage import loan` - 导入贷款合同
2. `mortgage import repayment` - 导入还款流水
3. `mortgage import budget` - 导入收入预算
4. `mortgage import penalty` - 导入违约金规则
5. `mortgage import goal` - 导入客户目标
6. `mortgage plan simulate` - 模拟还款方案
7. `mortgage plan compare` - 多情景对比
8. `mortgage plan report` - 生成规划报告
