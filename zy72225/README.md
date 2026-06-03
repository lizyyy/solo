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
- **支持回滚**: 否

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
