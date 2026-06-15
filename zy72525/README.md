# 邮件自动回复风险管理系统

## 一、系统目标

解决运营复核人反复追问"为什么邮件自动回复风险前后不一致"的问题。

**核心产出不是功能清单，而是：**
1. **可复盘的记录**：每条风险判断都能追溯到原始行号、人工改动、处理状态
2. **可重新跑的命令**：每一步操作都有对应的命令行脚本，支持完全复现
3. **结果说明文字**：产品复盘页直接展示"为什么前后不一致"的解释

---

## 二、边界规则（Boundary Rules）

> ⚠️ 以下规则已写入代码逻辑，不靠口头约定。
> 代码实现在 [core.py 头部注释](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L3-L42)

### 规则1：重复导入检测

**场景**：重复导入同一批模型输出片段

**判定**：
- 同一 `batch_id` 重复导入 → 直接跳过，不增加任何计数
- 同一（模型版本、样本编号、原始行号） → 视为同一条记录，跳过

**代码位置**：[import_model_outputs](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L192-L338)

---

### 规则2：模型版本变更处理（重点！）

**场景**：模型版本换了但样本编号没变

**判定**：
1. ❌ 不自动将风险状态改为 `NORMAL`（正常）
2. ✅ 状态置为 `NEEDS_RECHECK`（待复核），**留给运营复核人判断**
3. ✅ 在变更日志中记录 `MODEL_VERSION_CHANGE` 类型
4. ✅ 保留旧版本的所有历史记录用于对比

**怎么改**：运营复核人确认后，通过 `update-status` 命令或人工改判更新状态

**怎么回滚**：通过变更日志可回溯任意历史状态

**代码位置**：
- 检测逻辑：[detect_model_version_change](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L81-L93)
- 状态设置：[import_model_outputs 第267-278行](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L267-L278)

---

### 规则3：人工改判规则

**场景**：标注负责人周姐补看人工改判表

**支持两种模式**：
1. **完整改判**：改风险标记 + 改状态 + 改备注
2. **只改备注**：不改风险标记，只改备注说明（周姐只改了一条备注的场景）

**判定**：
- 只有标注负责人（如"周姐"）可以改判风险状态
- 每次改判必须记录：改前值、改后值、改判人、时间、备注
- 改判**不删除**原始模型输出，仅新增一条变更记录
- `original_is_auto_reply_risk`（模型原始判断）永不改变

**代码位置**：[apply_manual_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L341-L429)

---

### 规则4：汇总数一致性

**场景**：防止重复导入导致"邮件自动回复风险"数量翻倍

**判定**：
- 重复导入不会导致 `risk_count` 翻倍
- 只有首次导入或状态真实变更时才更新汇总表
- 汇总表按 `(sample_id, model_version)` 唯一键约束
- 各状态数量从 `processing_status` 字段真实统计，不硬编码

**代码位置**：[update_summary](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L140-L189)

---

### 规则5：回滚规则

**场景**：需要撤销某条记录

**判定**：
- 支持按变更ID回滚到任意历史状态
- 回滚本身也会生成一条 `ROLLBACK` 类型的变更记录
- 回滚后需要重新触发运营复核流程

---

## 三、状态流转图

```
                     模型版本变更
   ┌───────────────────────────────────────────┐
   │                                           ↓
pending_import  ──导入──→  needs_recheck  ──运营复核──→  confirmed_risk / normal
       │                       ↑
       │                       │
       └───────────────────────┘
     （首次导入同一样本新版本时，状态直接置为 needs_recheck）

  needs_recheck / pending_import  ──人工改判──→  confirmed_risk / normal
```

状态说明：
| 状态 | 含义 | 下一状态 |
|------|------|----------|
| `pending_import` | 刚导入，待处理 | `needs_recheck`, `confirmed_risk`, `normal` |
| `needs_recheck` | 检测到模型版本变更，待运营复核 | `confirmed_risk`, `normal` |
| `confirmed_risk` | 人工确认是风险 | 终态 |
| `normal` | 人工确认正常 | 终态 |

---

## 四、完整三步工作流（含状态检查点）

### 步骤1：模型输出片段第一次导入

**输入**：模型输出CSV/JSON文件

**产出（不是功能，是可复盘的结果）**：
- 导入批次ID
- 每条片段的**当前处理状态**
- 变更日志（包含原始行号、模型版本）
- 可重跑命令
- 结果说明文字

**命令**：
```bash
python -m email_auto_reply_risk.cli import \
  --file data/model_output_v1.json \
  --model-version v1.0 \
  --by 系统导入 \
  --batch-id batch_v1_001
```

**停在处理状态看什么**：
- 各片段的 `processing_status` 是什么
- 是否检测到模型版本变更（状态为 `needs_recheck`）
- 原始行号、模型版本、风险标记都对不对

**代码位置**：[step1_import_model_outputs](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L66-L134)

---

### 步骤2：标注负责人周姐补看人工改判表

**输入**：人工改判表JSON

**支持两种改判记录**：
```json
[
  // 完整改判
  {
    "fragment_id": 1,
    "reviewed_is_risk": false,
    "remark": "人工确认不是自动回复"
  },
  // 只改备注（周姐只改了一条备注的场景）
  {
    "fragment_id": 2,
    "only_edit_remark": true,
    "remark": "存疑，待运营复核确认"
  }
]
```

**命令**：
```bash
python -m email_auto_reply_risk.cli review \
  --file data/manual_review_001.json \
  --reviewer 周姐 \
  --batch-id review_batch_001
```

**停在处理状态看什么**：
- 改前改后的风险标记对比
- 改前改后的处理状态对比
- 改前改后的备注对比
- 是否只改了备注、没改风险

**代码位置**：[step2_manual_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L171-L226)

---

### 步骤3：产品复盘页更新

**输入**：`sample_id` 或 批次ID

**核心产出（不是功能清单）**：
1. **当前处理状态一览** — 每个片段的状态是什么
2. **结果说明文字** — 直接解释"为什么前后不一致"
3. **完整变更历史** — 按时间线的所有操作
4. **可重跑命令列表** — 完全复现本次结果的命令

**命令**：
```bash
# 按样本复盘
python -m email_auto_reply_risk.cli product-review \
  --sample-id S001 \
  --export data/review_S001.json

# 按批次复盘
python -m email_auto_reply_risk.cli product-review \
  --batch-id batch_v2_001 \
  --export data/review_batch.json
```

**停在处理状态看什么**：
- 当前各状态分布（pending / needs_recheck / confirmed / normal）
- 哪些片段还在 `needs_recheck` 等着运营复核
- 结果说明里有没有解释清楚版本变更的原因
- 可重跑命令能不能完整复现

**代码位置**：[step3_product_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L257-L337)

---

## 五、运营复核人追问时怎么办？

### 场景：运营问"为什么S001样本的风险判断前后不一致？"

**第一步：看产品复盘页的结果说明**
```bash
python -m email_auto_reply_risk.cli product-review --sample-id S001
```
输出里有一段 `result_explanation`，直接解释：
- 涉及几个模型版本
- 哪些是版本变更导致的 `needs_recheck`
- 哪些是人工改判过的

**第二步：查看单条片段的完整变更历史**
```bash
python -m email_auto_reply_risk.cli fragment-history --fragment-id 1
```

输出示例：
```
片段 1 - 当前状态
  样本: S001
  模型版本: v2.0
  原始行号: 15
  模型原始判断: False
  当前风险标记: False
  当前处理状态: needs_recheck
  当前备注: 检测到模型版本变更...

片段 1 - 变更历史（共 3 条）

[1] model_version_change  by 系统导入
    原始行号: 15
    模型版本: None → v2.0
    风险标记: None → False
    处理状态: None → needs_recheck
    备注: 检测到模型版本变更：旧版本=['v1.0'], ...

[2] import  by 系统导入
    ...

[3] remark_edit  by 周姐
    风险标记: False → False  （没变）
    备注: ... → 周姐备注：存疑，待运营确认
```

**第三步：需要复现？跑可重放命令**
```bash
python -m email_auto_reply_risk.cli replay-commands --batch-id batch_v2_001
```

---

## 六、数据模型说明

所有表定义在 [models.py](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/models.py)

### 核心表：model_output_fragments（模型输出片段）

> 产品复盘的"当前处理状态"直接读这张表，不用从日志倒推

| 字段 | 说明 |
|------|------|
| `sample_id` | 样本编号 |
| `model_version` | 模型版本 |
| `original_line_number` | 原始行号（运营追问时回溯用） |
| `original_is_auto_reply_risk` | 模型原始判断，**永不改变** |
| `is_auto_reply_risk` | 当前生效的风险判断（可能被人工改判覆盖） |
| `processing_status` | **当前处理状态**（产品复盘直接读这个） |
| `current_remark` | 当前备注 |
| `import_batch_id` | 导入批次ID |
| `last_updated_by` | 最后更新人 |

### 其他表

| 表名 | 用途 |
|------|------|
| `manual_reviews` | 人工改判记录（改前改后完整留痕） |
| `risk_change_logs` | 所有变更的历史日志（按时间线） |
| `risk_summaries` | 风险汇总表（按样本+模型版本维度） |
| `import_batches` | 导入批次记录（防重复） |

---

## 七、快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 初始化数据库
```bash
python -m email_auto_reply_risk.cli init-db
```

### 运行完整演示（出问题样例）
```bash
python examples/demo_full_workflow.py
```
演示内容：
- 导入v1.0 → 看状态
- 重复导入验证 → 不翻倍
- 导入v2.0（同一样本）→ 触发版本变更，状态变 needs_recheck
- 周姐改判（一条完整改判 + 一条只改备注）→ 看状态变化
- 产品复盘 → 看结果说明 + 可重跑命令

---

## 八、常用命令速查

```bash
# 初始化
python -m email_auto_reply_risk.cli init-db

# 步骤1：导入
python -m email_auto_reply_risk.cli import --file xxx.json --model-version v1.0 --by 系统导入

# 步骤2：人工改判
python -m email_auto_reply_risk.cli review --file review.json --reviewer 周姐

# 步骤3：产品复盘
python -m email_auto_reply_risk.cli product-review --sample-id S001
python -m email_auto_reply_risk.cli product-review --batch-id batch_001 --export out.json

# 运营追问：看单条片段历史
python -m email_auto_reply_risk.cli fragment-history --fragment-id 1

# 看单样本时间线
python -m email_auto_reply_risk.cli sample-timeline --sample-id S001

# 生成可重跑命令
python -m email_auto_reply_risk.cli replay-commands --batch-id batch_001

# 运营复核：更新状态
python -m email_auto_reply_risk.cli update-status --fragment-id 1 --new-status normal --by 运营张姐
```

---

## 九、目录结构

```
.
├── email_auto_reply_risk/
│   ├── __init__.py
│   ├── models.py          # 数据模型（含状态字段定义）
│   ├── database.py        # 数据库连接
│   ├── core.py            # 核心业务逻辑（含5条边界规则）
│   ├── workflow.py        # 三步流程管理（每步都有状态检查点）
│   └── cli.py             # 命令行工具
├── examples/
│   ├── demo_full_workflow.py   # 出问题样例的完整演示
│   └── sample_data/            # 示例数据（v1.0、v2.0、改判表）
├── data/                   # 数据库和导出数据
├── requirements.txt
└── README.md
```
