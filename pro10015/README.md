# 信用卡争议款冻结预警

## 快速开始

### 1. 启动

```bash
# 先看内置样例（推荐，不用准备数据）
python3 main.py sample

# 看指定样例
python3 main.py sample 0   # 正常路径
python3 main.py sample 1   # 多账号+金额不匹配
python3 main.py sample 2   # 估值冲突+流水多余
```

### 2. 导入自己的数据

```bash
python3 main.py run <客户经理备注文件> <柜台流水文件> [估值记录文件]
```

支持 `.xlsx` 和 `.csv` 格式。

**导入文件格式要求：**

| 文件类型 | 列名 |
|---------|------|
| 客户经理备注 | customer_id, customer_name, account_no, dispute_amount, note, manager, record_time, frozen |
| 柜台流水 | trans_id, customer_id, customer_name, account_no, trans_amount, trans_type, trans_time, operator |
| 估值记录（可选） | valuation_id, customer_id, account_no, dispute_amount, valuation_amount, version, manual_note, valuator, valuation_time |

### 3. 怎么看异常

- **绿色（正常）**：三方数据一致，无问题
- **黄色（待确认）**：1-2项不一致，需人工核实
- **红色（冲突）**：3项以上不一致，重点关注

异常项会列出具体问题，包含：
- 客户经理备注原始行号
- 金额不匹配的具体数值
- 涉及的所有账号（同一客户多账号会展示影响范围）
- 估值版本的人工备注（不会被清洗）
- 冲突项标记为待确认
