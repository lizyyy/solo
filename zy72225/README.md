# 票据池质押释放排程处理系统

## 项目概述

本系统用于处理票据池质押释放排程，重点解决**金额为0但备注写着已冲正**这类容易被忽略但风控高度关注的边界案例。系统提供完整的证据留存、变更追踪、和可复盘能力。

## 核心特性

### 1. 原始证据完整留存
- 除权日截图的**原始行号**永久留存
- 导入时的**原始数据快照**不可修改
- 所有**人工改动**记录变更前后对比
- **处理状态**全程可追溯

### 2. 边界规则引擎（非口头约定，代码即文档）
- 金额为0但备注含"冲正"字样 → 自动标记为**需风控复核**，不会被当成小备注跳过
- 支持规则回滚操作
- 所有规则在代码和文档中双重记录

### 3. 防重复导入
- 基于文件哈希校验，重复导入同一批除权日截图会被拦截
- 避免"票据池质押释放排程"数量翻倍问题

### 4. 历史变更可追溯
- 每条记录的每一次修改都有完整日志
- 支持查看改前改后的差别
- 操作人、时间、原因全部记录

### 5. 三步标准工作流
```
除权日截图第一次导入 → 风控值班老秦补看税费率备注 → 给负责人看的摘要更新
```

### 6. 可复盘可重跑
- 所有操作都有审计日志
- 支持生成可重新执行的命令序列
- 导出完整报告用于复盘

---

## 边界规则说明（代码与文档一致）

### 规则1: 金额为0但备注写着已冲正
- **触发条件**: `金额 == 0` 且 `备注包含"冲正"|"已冲正"|"冲销"|"reverse"|"reversed"`
- **处理结果**: 标记为 `RISK_REVIEW_REQUIRED`（需风控复核）
- **设计意图**: 这种情况以前总被当成小备注跳过，现在必须留给风控同事复核
- **代码位置**: [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/boundary_rules.py#L33-L58)
- **支持回滚**: 是

### 规则2: 金额为负数
- **触发条件**: `金额 < 0`
- **处理结果**: 标记为 `RISK_REVIEW_REQUIRED`（需风控复核）
- **代码位置**: [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/boundary_rules.py#L81-L101)
- **支持回滚**: 是

---

## 处理状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待处理 |
| `boundary_case` | 边界案例 |
| `risk_review_required` | **需风控复核**（重点关注） |
| `normal` | 正常 |
| `reversed` | 已冲销/驳回 |
| `archived` | 已归档 |

---

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 标准三步流程

#### 步骤1: 导入除权日截图
```bash
python -m src.cli import -f ./data/除权日截图.xlsx -o 操作员姓名
```

**注意**: 如果该文件已导入过，系统会提示并拒绝重复导入。

#### 步骤2: 风控值班老秦补看税费率备注
```bash
# 先查看待复核列表
python -m src.cli list-risk-review

# 补录税费率（只改一条备注也会留下完整记录）
python -m src.cli risk-review -r <记录ID> -o 老秦 --tax-rate 0.06 --review-note "核对完税凭证后补录"
```

#### 步骤3: 生成给负责人看的摘要
```bash
python -m src.cli summary -o 汇总人
```

---

## 风控复核操作

### 查看待风控复核记录
```bash
python -m src.cli list-risk-review
```

### 复核通过
```bash
python -m src.cli approve -r <记录ID> -o 老秦 --note "确认已冲正，真实无误"
```

### 复核驳回
```bash
python -m src.cli reject -r <记录ID> -o 老秦 --reason "冲正凭证不符，退回重查"
```

---

## 边界规则回滚（判错或误触发时使用）

> 适用场景：规则误触发（如金额为 0 但备注里的"已冲正"其实是正常业务）、或风控复核时需要把记录**退回待处理状态**而不是 approve / reject。

### 命令格式
```bash
python -m src.cli rollback -r <记录ID> -o <操作人> --reason <回滚原因>
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `-r / --record-id` | ✅ | 要回滚的记录 ID（从 `list-risk-review` 或 `history` 中获取） |
| `-o / --operator` | ✅ | 执行回滚的操作人，记入审计日志 |
| `--reason` | ✅ | 回滚原因，将写入历史记录，用于向负责人解释"为什么回滚" |

### 回滚对象
对 record_id 对应记录**当前挂着的** `boundary_type` 执行回滚（根据该字段自动匹配对应的规则，无需手工指定规则名）。

### 回滚前后状态对比

| 字段 | 回滚前 | 回滚后 |
|------|--------|--------|
| `status` | `risk_review_required` | `pending`（重新回到待处理） |
| `boundary_type` | `zero_amount_with_reversal_note` / `negative_amount` | `null`（清除边界标记） |
| `boundary_note` | 规则自动写入的提示 | `null`（清除提示） |
| `change_history` | 追加 1 条 `change_type=ROLLBACK` 日志 + 1 条 `rollback_reason` 补充说明 | 不变 |

### 历史记录里会留下什么
`python -m src.cli history -r <记录ID>` 能看到：

1. **ROLLBACK 日志**：
   - `old_value.status = "risk_review_required"`
   - `new_value.status = "pending"`
   - `operator = 执行回滚的操作人`
   - `reason = "回滚边界规则：金额为0但备注写着已冲正"`（或对应的规则名）

2. **rollback_reason 补充说明**：
   - `field_name = "rollback_reason"`
   - `new_value = --reason 参数传入的解释文字`（向负责人解释时直接引用）

### 示例：回滚误触发的"金额为0且备注已冲正"
```bash
# 1) 查看待复核列表，找到被误标记的记录
python3 -m src.cli list-risk-review

# 2) 执行回滚
python3 -m src.cli rollback \
  -r f608676be31d9b1b \
  -o 风控老秦 \
  --reason "备注中'已冲正'是正常业务备注，并非异常，需撤销边界标记"

# 3) 回滚后待复核列表中这条记录应该消失
python3 -m src.cli list-risk-review

# 4) 查看历史确认回滚轨迹
python3 -m src.cli history -r f608676be31d9b1b

# 5) 重新生成负责人摘要，摘要计数会跟着回滚变化
python3 -m src.cli summary -o 汇总人
```

### 负责人摘要如何随回滚变化
- `risk_review_required_count`：回滚 1 条后 **-1**
- `pending_count`：回滚 1 条后 **+1**
- 每条 `records_summary` 中：`status`、`boundary_type`、`boundary_note` 都更新为回滚后的值
- `boundary_rules[].has_rollback` 中注明该规则是否支持回滚

---

## 复盘与审计

### 查看单条记录完整历史
```bash
python -m src.cli history -r <记录ID>
```

输出包含:
- 当前状态
- 原始快照（导入时的行号、原始数据）
- 每一次变更的前后对比
- 操作人和时间

### 导出完整报告（含可重跑命令）
```bash
python -m src.cli report -o full_report.json
```

### 生成可重新跑的命令
```bash
python -m src.cli replay
```

---

## 目录结构

```
.
├── src/
│   ├── __init__.py          # 模块导出
│   ├── models.py            # 数据模型（ReleaseRecord, ChangeLog等）
│   ├── boundary_rules.py    # 边界规则引擎（核心业务规则）
│   ├── importer.py          # Excel导入器（防重复）
│   ├── processor.py         # 三步流程处理器
│   └── cli.py               # 命令行工具
├── data/                    # 数据目录（记录、历史、汇总）
├── tests/                   # 测试用例
├── logs/                    # 日志目录
├── requirements.txt         # 依赖
└── README.md                # 本文档
```

---

## 关键代码位置

- **数据模型**: [models.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/models.py)
- **边界规则**: [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/boundary_rules.py)
- **导入去重**: [importer.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/importer.py)
- **三步流程**: [processor.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/processor.py)
- **命令行**: [cli.py](file:///Users/lzy/pro/solo/workspaces/zy72225/src/cli.py)

---

## 设计原则

1. **证据优先**: 风控追问时能回到证据，而不是只看一个汇总数
2. **规则固化**: 边界规则写在代码和README里，不靠口头约定
3. **操作留痕**: 哪怕只改一条备注，历史里也要能看出改前改后
4. **可复盘**: 最后给人的不是功能清单，而是一份能复盘的记录和可重新跑的命令

---

## 常见问题

### Q: 为什么金额为0但备注写着已冲正不能自动归正常？
A: 这是风控高风险点。以前总被跳过，现在必须人工复核确认，避免漏过异常交易。

### Q: 同一批除权日截图导入两次会怎样？
A: 系统基于文件哈希检测重复导入，默认会拦截。如需强制重导，可在代码中设置 `skip_duplicate_check=True`。

### Q: 怎么看老秦改了哪条备注？
A: 使用 `python -m src.cli history -r <记录ID>` 查看完整变更历史，每条修改都有前后对比。
