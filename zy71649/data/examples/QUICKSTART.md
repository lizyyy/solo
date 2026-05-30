# 房贷提前还款规划 CLI - 快速开始指南

## 🏠 欢迎使用

本指南将帮助您在5分钟内完成从数据导入到报告生成的完整流程。

---

## 🚀 三步快速开始

### 第1步：初始化（自动创建样例数据）

```bash
# 初始化工作目录并创建样例数据
mortgage init

# 或者强制重置（会覆盖现有数据）
mortgage init --force
```

### 第2步：查看数据

```bash
# 查看所有已导入的数据
mortgage list

# 查看系统状态和材料完整性
mortgage status --contract-no LOAN001
```

### 第3步：运行模拟并生成报告

```bash
# 运行模拟分析（自动生成多个情景对比）
mortgage simulate --contract-no LOAN001

# 指定金额和策略
mortgage simulate --contract-no LOAN001 --amount 20万 --strategy shorten_term

# 生成分析报告
mortgage report --contract-no LOAN001 --format markdown
mortgage report --contract-no LOAN001 --format excel
```

---

## 📋 完整工作流程（8步标准流程）

```
1. 初始化 → 2. 导入贷款合同 → 3. 导入还款流水 → 4. 导入收入预算
    ↓
8. 生成报告 ← 7. 约束检查 ← 6. 情景对比 ← 5. 导入客户目标
```

### 详细步骤

#### 1️⃣ 初始化工作目录
```bash
mortgage init
```

#### 2️⃣ 导入数据（支持多种格式）

```bash
# 导入贷款合同（JSON格式）
mortgage import data/examples/loan_contract.json --type loan --conflict update

# 导入贷款合同（CSV格式，支持中文字段）
mortgage import data/examples/loan_contract.csv --type loan --conflict update

# 导入还款流水
mortgage import data/examples/repayment_records.json --type repayment --conflict update

# 导入收入预算
mortgage import data/examples/budget.json --type budget --conflict update

# 导入违约金规则
mortgage import data/examples/penalty_rule.json --type penalty --conflict update

# 导入客户目标
mortgage import data/examples/client_goal.json --type goal --conflict update
```

#### 3️⃣ 检查系统状态
```bash
# 查看所有数据
mortgage list

# 检查特定合同的材料完整性
mortgage status --contract-no LOAN001
```

#### 4️⃣ 确认数据（可选，但推荐）
```bash
# 批量确认所有待确认数据
mortgage confirm-all --operator 张三

# 或单独确认
mortgage confirm --type loan --id <记录ID> --operator 张三
```

#### 5️⃣ 运行模拟分析
```bash
# 自动生成多情景对比
mortgage simulate --contract-no LOAN001

# 指定参数
mortgage simulate --contract-no LOAN001 \
  --amount 20万 \
  --strategy shorten_term \
  --level detailed
```

#### 6️⃣ 生成分析报告
```bash
# Markdown格式（适合邮件发送、文档归档）
mortgage report --contract-no LOAN001 \
  --format markdown \
  --level standard

# Excel格式（适合客户查看、进一步编辑）
mortgage report --contract-no LOAN001 \
  --format excel \
  --level detailed
```

#### 7️⃣ 管理数据
```bash
# 更新备注
mortgage notes --type loan --id <记录ID> --text "客户已确认方案" --operator 张三

# 解决冲突
mortgage resolve --type loan --id <冲突记录ID> --action update --operator 张三

# 导出所有数据
mortgage export --output-dir export
```

---

## 📊 重复导入处理策略

导入数据时遇到重复记录，可以指定 `--conflict` 参数：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `skip` | 跳过重复数据，保留原有数据 | 批量导入，忽略已存在的记录 |
| `update` | 用新数据更新已有记录 | 数据修正、信息补全 |
| `ask` | 标记为冲突，待人工处理 | 首次导入、不确定如何处理 |
| `error` | 报错终止 | 严格模式，不允许重复 |

**示例：**
```bash
# 安全导入，发现重复时标记为冲突
mortgage import new_data.json --type loan --conflict ask

# 查看冲突
mortgage status

# 解决冲突
mortgage resolve --type loan --id <冲突ID> --action update
```

---

## 🚨 异常分类说明

系统会自动识别三类异常，方便您快速定位问题：

| 类别 | 图标 | 说明 | 示例 |
|------|------|------|------|
| 📊 数据问题 | 黄色 | 输入数据格式错误或不合理 | 利率输入4.2%写成42% |
| ⚙️ 规则问题 | 橙色 | 违反贷款规则或约束条件 | 提前还款时间太早、金额太小 |
| 📋 材料缺失 | 蓝色 | 缺少必要的材料或数据 | 还款流水未导入、预算未设置 |
| 🔧 系统问题 | 红色 | 系统内部错误 | 数据文件损坏、网络异常 |

---

## 🔍 解释深度级别

报告和模拟结果支持4种解释深度：

| 级别 | 适用人群 | 内容特点 |
|------|----------|----------|
| `simple` | 客户 | 简单易懂，只讲结论和建议 |
| `standard` | 理财顾问 | 标准深度，包含关键数据和分析 |
| `detailed` | 资深顾问 | 详细分析，包含所有计算过程 |
| `expert` | 技术/审计 | 专业级别，包含完整公式和假设 |

---

## 💡 常用命令速查

```bash
# 查看帮助
mortgage --help
mortgage simulate --help

# 运行完整演示（交互式）
mortgage demo

# 查看样例数据目录
ls data/examples/
```

---

## 📝 支持的数据格式

- ✅ **JSON** - 结构化数据，推荐使用
- ✅ **YAML** - 易读的配置格式
- ✅ **CSV** - 表格数据，支持中文字段
- ✅ **Excel** (.xlsx, .xls) - 银行导出的原始数据

---

## 🏆 核心功能特性

1. ✅ **等额本息计算** - 精确计算月供、利息、剩余本金
2. ✅ **违约金计算** - 支持固定金额、比例、利息倍数、阶梯定价
3. ✅ **现金流分析** - 36个月现金流预测和风险评估
4. ✅ **情景对比** - 自动生成多方案对比，推荐最优方案
5. ✅ **约束检查** - 7维度风险评估，确保方案可行
6. ✅ **异常分类** - 数据/规则/材料三类异常清晰区分
7. ✅ **版本追踪** - 完整的修改历史和确认状态
8. ✅ **报告导出** - 专业的Markdown和Excel报告

---

## ❓ 常见问题

**Q: 数据存在哪里？可以备份吗？**
A: 所有数据存储在 `data/` 目录下的JSON文件中，可以直接复制备份。

**Q: 可以同时处理多个客户吗？**
A: 可以，每个客户使用不同的 `customer_id`，每份贷款使用不同的 `contract_no`。

**Q: 二次导入会覆盖数据吗？**
A: 默认会询问，您可以通过 `--conflict` 参数指定处理策略。

**Q: 支持哪些提前还款策略？**
A: 支持缩短期限（shorten_term）、减少月供（reduce_payment）、混合方式（mixed）。

---

## 🎯 下一步

- 运行 `mortgage demo` 体验完整流程
- 查看 `data/examples/` 目录下的样例数据格式
- 尝试导入您自己的真实数据

祝您使用愉快！🎉
