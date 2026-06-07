# 邮件自动回复风险管理系统

## 一、系统目标

解决运营复核人反复追问"为什么邮件自动回复风险前后不一致"的问题。系统的核心产出不是功能清单，而是：
1. **可复盘的记录**：每条风险判断都能追溯到原始行号、人工改动、处理状态
2. **可重新跑的命令**：每一步操作都有对应的命令行脚本，支持完全复现

---

## 二、边界规则（Boundary Rules）

> ⚠️ 以下规则已写入代码逻辑，不靠口头约定。代码实现在 [email_auto_reply_risk/core.py](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L3-L30)

### 规则1：重复导入检测

**场景**：重复导入同一批模型输出片段

**判定**：
- 同一 `batch_id` 重复导入 → 直接跳过，不增加任何计数
- 同一（模型版本、样本编号、原始行号） → 视为同一条记录，跳过

**代码位置**：[import_model_outputs](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L148-L277)

---

### 规则2：模型版本变更处理（重点！）

**场景**：模型版本换了但样本编号没变

**判定**：
1. ❌ 不自动将风险状态改为 `NORMAL`（正常）
2. ✅ 状态置为 `NEEDS_RECHECK`（待复核），**留给运营复核人判断**
3. ✅ 在变更日志中记录 `MODEL_VERSION_CHANGE` 类型
4. ✅ 保留旧版本的所有历史记录用于对比

**怎么改**：运营复核人确认后，通过 `update_status` 或人工改判接口更新状态

**怎么回滚**：通过变更日志中的 `ROLLBACK` 操作，支持回滚到任意历史状态

**代码位置**：
- 检测逻辑：[detect_model_version_change](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L70-L82)
- 状态设置：[import_model_outputs 第211-217行](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L211-L217)

---

### 规则3：人工改判规则

**场景**：标注负责人周姐补看人工改判表

**判定**：
- 只有标注负责人（如"周姐"）可以改判风险状态
- 每次改判必须记录：改前值、改后值、改判人、时间、备注
- 改判**不删除**原始模型输出，仅新增一条变更记录

**代码位置**：[apply_manual_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L280-L347)

---

### 规则4：汇总数一致性

**场景**：防止重复导入导致"邮件自动回复风险"数量翻倍

**判定**：
- 重复导入不会导致 `risk_count` 翻倍
- 只有首次导入或状态真实变更时才更新汇总表
- 汇总表按 `(sample_id, model_version)` 唯一键约束

**代码位置**：[update_summary](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/core.py#L112-L145)

---

### 规则5：回滚规则

**场景**：需要撤销某条记录

**判定**：
- 支持按变更ID回滚到任意历史状态
- 回滚本身也会生成一条 `ROLLBACK` 类型的变更记录
- 回滚后需要重新触发运营复核流程

---

## 三、完整三步工作流

### 步骤1：模型输出片段第一次导入

**输入**：模型输出CSV/JSON文件

**输出：
- 导入批次ID
- 初始风险记录
- 变更日志（包含原始行号）

**命令**：
```bash
python -m email_auto_reply_risk.cli import \
  --file data/model_output_v1.csv \
  --model-version v1.0 \
  --by 系统导入
```

**代码位置**：[step1_import_model_outputs](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L62-L95)

---

### 步骤2：标注负责人周姐补看人工改判表

**输入**：人工改判表JSON

**格式**：
```json
[
  {
    "fragment_id": 1,
    "reviewed_is_risk": false,
    "remark": "人工确认不是自动回复，是客户真实回复"
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

**输出**：
- 改判记录（改前改后清晰可见）
- 更新后的风险状态
- 变更日志

**代码位置**：[step2_manual_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L98-L136)

---

### 步骤3：产品复盘页更新

**输入**：`sample_id` 或 批次ID

**命令**：
```bash
# 按样本复盘
python -m email_auto_reply_risk.cli product-review \
  --sample-id S001 \
  --export data/review_S001.json

# 按批次复盘
python -m email_auto_reply_risk.cli product-review \
  --batch-id abc123 \
  --export data/review_batch.json
```

**输出**：
- 完整时间线（按时间排序的所有变更）
- 风险统计（汇总数）
- 可追溯的变更历史（每条都能看到改前改后）

**代码位置**：[step3_product_review](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/workflow.py#L139-L193)

---

## 四、运营复核人追问时怎么办？

### 场景：运营问"为什么S001样本的风险判断前后不一致？"

**第一步：查看单条片段的变更历史**
```bash
python -m email_auto_reply_risk.cli fragment-history --fragment-id 1
```

输出示例：
```
=== 片段 1 变更历史 ===

变更ID: 1
  类型: import
  操作人: 系统导入
  时间: 2024-01-15T10:30:00
  原始行号: 15
  风险标记: None → True
  状态: None → pending_import

变更ID: 2
  类型: model_version_change
  操作人: 系统导入
  时间: 2024-01-15T10:30:00
  原始行号: 15
  模型版本: None → v2.0
  风险标记: None → True
  状态: None → needs_recheck
  备注: 检测到模型版本变更：旧版本=['v1.0'], 新版本=v2.0，状态置为 NEEDS_RECHECK，待运营复核人确认

变更ID: 3
  类型: manual_edit
  操作人: 周姐
  时间: 2024-01-15T14:20:00
  原始行号: 15
  风险标记: True → False
  备注: 人工确认不是自动回复，是客户真实回复
```

**第二步：查看单样本完整时间线**
```bash
python -m email_auto_reply_risk.cli sample-timeline --sample-id S001
```

**第三步：生成可重放命令（如果需要复现）**
```bash
python -m email_auto_reply_risk.cli replay-commands --batch-id abc123
```

---

## 五、数据模型说明

所有表定义在 [models.py](file:///Users/lzy/pro/solo/workspaces/zy72525/email_auto_reply_risk/models.py)

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `model_output_fragments` | 模型输出片段原始记录 | sample_id, model_version, original_line_number, is_auto_reply_risk |
| `manual_reviews` | 人工改判记录 | fragment_id, reviewer, original_is_risk, reviewed_is_risk, remark |
| `risk_change_logs` | 风险变更历史日志 | fragment_id, change_type, changed_by, is_risk_before, is_risk_after |
| `risk_summaries` | 风险汇总表（按样本+模型版本） | sample_id, model_version, risk_count, normal_count |
| `import_batches` | 导入批次记录 | batch_id, model_version, new_records, duplicate_skipped |

---

## 六、快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 初始化数据库
```bash
python -m email_auto_reply_risk.cli init-db
```

### 运行完整示例
```bash
# 运行演示脚本
python examples/demo_full_workflow.py
```

---

## 七、目录结构

```
.
├── email_auto_reply_risk/
│   ├── __init__.py
│   ├── models.py          # 数据模型
│   ├── database.py        # 数据库连接
│   ├── core.py            # 核心业务逻辑（含边界规则）
│   ├── workflow.py       # 三步流程管理
│   └── cli.py             # 命令行工具
├── examples/
│   ├── demo_full_workflow.py    # 完整工作流演示
│   └── sample_data/           # 示例数据
├── data/                   # 数据库和导出数据
├── requirements.txt
└── README.md
```
