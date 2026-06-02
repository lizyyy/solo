# 外汇远期交割排程系统

## 系统概述

本系统用于管理外汇远期交割排程的全生命周期，确保从导入到完成的每一步都有迹可循。重点解决**金额为0但备注写着已冲正**这类特殊记录的处理和追溯问题。

## 核心设计原则

1. **单一数据源**：导出明细、页面展示、API接口读取同一份数据
2. **全程留痕**：除权日截图原始行号、人工改动、处理状态全部保留
3. **边界明确**：所有判断规则写在代码中，不依赖口头约定
4. **交接友好**：风控同事打开结果即可清楚知道问题卡在哪一步

---

## 三步处理流程

```
第一步: 除权日截图导入
        ↓
第二步: 对账运营阿芬补看税费率备注
        ↓
第三步: 给负责人看的摘要更新
```

### 流程卡点说明

**金额为0但备注写着已冲正**的记录：
- 不会自动进入下一步
- 标记为 `pending_risk_review` 状态
- 在 `blocking` 列表中明确显示
- 必须经过风控同事复核才能继续

---

## 边界规则 (Boundary Rules)

### 1. 冲正记录判定

**代码位置**: [BoundaryRules.is_zero_amount_with_reversal](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L12-L20)

判定条件：
- 金额 ≈ 0 (绝对值 < 1e-9)
- 备注中包含关键词: `已冲正`, `冲正`, `reversed`, `reverse`

### 2. 证据优先级

**代码位置**: [BoundaryRules.EVIDENCE_PRIORITY](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L7-L10)

| 证据来源 | 优先级 | 说明 |
|---------|--------|------|
| 税费率备注 | 2 (高) | 人工补充的税费备注优先 |
| 除权日截图 | 1 (低) | 原始导入数据其次 |

冲突解决: [BoundaryRules.resolve_evidence_conflict](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L58-L76)

### 3. 风控触发条件

**代码位置**: [BoundaryRules.should_escalate_to_risk](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L22-L24)

触发条件:
- `has_zero_amount_with_reversal = True`

### 4. 税率编辑权限

**代码位置**: [BoundaryRules.can_edit_tax_rate](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L43-L48)

可编辑步骤:
- STEP_1_IMPORT (第一步: 导入后)
- STEP_2_TAX_REVIEW (第二步: 税率复核中)

### 5. 回滚规则

**代码位置**: [BoundaryRules.get_rollback_requirements](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/boundary_rules.py#L85-L96)

- 已冲正 (REVERSED) 的记录不可回滚
- 需要风控审批的记录需要 `risk` 角色审批
- 可恢复字段: `amount`, `status`, `current_step`, `is_reversed`

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 完整流程示例

```bash
# 1. 导入除权日截图数据
python cli.py import-excel examples/sample_data.xlsx --operator 阿芬

# 2. 查看所有记录
python cli.py list

# 3. 查看阻塞记录 (重点: 金额为0已冲正的记录)
python cli.py blocking

# 4. 阿芬补看税费率备注 (正常记录)
python cli.py update-tax <record_id> 0.06 "增值税率6%，取自税务报告2024-01" --operator 阿芬

# 5. 推进到下一步
python cli.py advance <record_id> --operator 阿芬

# 6. 风控复核 (冲正记录)
python cli.py risk-review <record_id> --approve --note "冲正记录已核实，原始单据齐全" --operator 风控老王

# 7. 更新负责人摘要
python cli.py update-summary <record_id> "2024年1月外汇交割汇总" --operator 张经理

# 8. 导出结果 (给负责人看)
python cli.py export output/settlement_report.xlsx

# 9. 查看审计日志 (复盘用)
python cli.py audit <record_id>
```

---

## 命令参考

| 命令 | 用途 | 对应角色 |
|------|------|---------|
| `import-excel` | 导入Excel数据 | 对账运营 |
| `list` | 列出所有记录 | 全部 |
| `show` | 查看单条记录详情 | 全部 |
| `advance` | 推进到下一步 | 对账运营 |
| `update-tax` | 更新税率和备注 | 对账运营 (阿芬) |
| `risk-review` | 风控复核 | 风控 |
| `update-summary` | 更新摘要 | 负责人 |
| `reverse` | 冲正记录 | 对账运营 |
| `rollback` | 回滚到某一步 | 管理员 |
| `export` | 导出Excel | 全部 |
| `audit` | 查看审计日志 | 全部 |
| `blocking` | 查看阻塞记录 | 风控 |

---

## 交接体验说明

### 风控同事如何快速定位问题

1. **第一步**: 运行 `python cli.py blocking`
   - 直接看到所有卡住的记录
   - 每条记录显示：阻塞原因、当前步骤、下一步操作

2. **第二步**: 点击记录ID查看详情
   - 原始行号: `original_row_number`
   - 证据来源: `source`
   - 除权日证据ID: `ex_date_evidence_id`
   - 税率备注: `tax_rate_remark`
   - 风控备注: `risk_review_note`

3. **第三步**: 查看审计历史
   - 运行 `python cli.py audit <record_id>`
   - 看到每一步操作人、时间、变更内容

### 关键字段说明

| 字段名 | 含义 | 交接重点 |
|--------|------|---------|
| `original_row_number` | 除权日截图原始行号 | 回溯原始数据的关键 |
| `has_zero_amount_with_reversal` | 金额为0且备注已冲正 | 风控重点关注标记 |
| `risk_review_required` | 是否需要风控复核 | 流程卡点标记 |
| `risk_review_note` | 风控复核意见 | 复核记录留存 |
| `tax_rate_remark` | 税费率备注 | 阿芬补充的人工判断 |
| `ex_date_evidence_id` | 除权日证据ID | 关联原始截图 |

---

## 数据一致性保证

三个出口使用同一转换函数 `_record_to_dict`:

- **导出明细**: `get_records_for_export()` → 调用 `_record_to_dict`
- **页面展示**: `get_records_for_display()` → 调用 `_record_to_dict`
- **API接口**: `get_record_for_api()` → 调用 `_record_to_dict`

**代码位置**: [SettlementRepository._record_to_dict](file:///Users/lzy/pro/solo/workspaces/zy72206/forex_settlement/repository.py#L63-L88)

---

## 复盘与重跑

### 复盘操作

```bash
# 查看某条记录的完整操作历史
python cli.py audit <record_id>

# 查看某段时间的所有变更
python cli.py audit | grep "2024-01-15"
```

### 重新跑流程

数据保存在 `./data/` 目录下:
- `settlement_records.json` - 交割记录
- `audit_logs.json` - 审计日志

如需重新开始:
```bash
rm -rf ./data/*
python cli.py import-excel examples/sample_data.xlsx --operator 阿芬
```

---

## 目录结构

```
.
├── forex_settlement/
│   ├── __init__.py          # 导出模块
│   ├── models.py            # 数据模型定义
│   ├── boundary_rules.py    # ⭐ 边界规则 (交接重点)
│   ├── state_machine.py     # 状态机逻辑
│   └── repository.py        # 数据持久化
├── cli.py                   # 命令行工具
├── examples/
│   └── sample_data.xlsx     # 示例数据
├── data/                    # 运行时数据 (git忽略)
└── README.md                # 本文档
```

---

## 常见问题

### Q: 为什么有些记录无法推进到下一步？
A: 运行 `python cli.py blocking` 查看阻塞原因。如果是金额为0且备注含"已冲正"的记录，需要风控同事执行 `risk-review` 后才能继续。

### Q: 除权日截图和税费率备注不一致时以哪个为准？
A: 以税费率备注为准。代码中定义了优先级: `税费率备注(2) > 除权日截图(1)`。

### Q: 冲正后的记录可以恢复吗？
A: 不可以。已冲正 (REVERSED) 状态的记录不可回滚，这是边界规则明确规定的。

### Q: 我怎么知道是谁在什么时候做了什么操作？
A: 运行 `python cli.py audit <record_id>` 查看完整审计日志。

---

## 版本历史

- v1.0.0: 初始版本，支持三步流程、冲正处理、风控复核、审计追踪
