# 学习路径推荐理由管理系统

用于将"学习路径推荐理由"从模型输出片段和人工改判表的临时拼接中解耦出来的管理系统。

## 核心特性

- ✅ 从模型输出片段 + 人工改判表结构化提取推荐理由
- ✅ 重复导入自动去重，数量不翻倍
- ✅ 完整版本历史，单条备注修改可看改前改后差异
- ✅ 手机号漏遮自动检测、标记、升级复核、回滚机制
- ✅ 三步工作流：导入 → 人工补看 → 脱敏导出
- ✅ 完整审计日志，可复盘可重放
- ✅ 边界规则代码化，不靠口头约定

---

## 目录结构

```
learning_path_recommender/
├── models/                  # 数据模型
│   ├── recommendation.py   # 推荐理由实体
│   ├── import_record.py    # 导入记录
│   ├── version_history.py  # 版本历史
│   └── masking_rule.py     # 脱敏规则
├── core/                    # 核心业务模块
│   ├── importer.py         # 导入与去重
│   ├── version_manager.py  # 版本管理与回滚
│   └── masking_engine.py   # 脱敏规则引擎
├── workflow/                # 工作流
│   └── three_step_flow.py  # 三步工作流
├── audit/                   # 审计日志
│   └── audit_logger.py     # 审计记录器
├── config/                  # 配置（边界规则）
│   └── boundary_rules.py   # 边界规则定义
├── cli/                     # 命令行工具
│   └── main.py             # CLI 入口
├── storage.py               # JSON 文件存储
tests/                       # 测试用例
examples/                    # 示例数据
data/                        # 运行时数据（自动创建）
```

---

## 边界规则（Boundary Rules）

所有边界规则定义在 [config/boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72513/learning_path_recommender/config/boundary_rules.py) 中。

### RULE_001: 手机号漏遮判定规则

**判定标准：**
- 内容中包含匹配正则 `1[3-9]\d{9}` 的字符串
- 该字符串未被替换为 `1*********`
- 该字段出现在导出的最终输出中

**怎么判：**
- 自动检测，严重性 high
- 不允许自动修复
- 必须人工复核
- 升级到算法团队

**怎么改：**
1. 自动标记 `has_unmasked_phone = True`
2. 自动设置 `masking_status = needs_review`
3. 导出时默认跳过（`include_unreviewed=False`）
4. 标记 `review_status = pending_algorithm_review` 留给算法同事

**怎么回滚：**
- 允许回滚，但必须留审计记录
- 回滚触发条件：
  - 误判：非手机号的数字组合
  - 已手动修正脱敏
  - 算法团队复核后确认放行

**可溯源：**
- 保留 `model_output_id` → 可回到模型输出片段
- 保留 `manual_review_id` → 可回到人工改判表

---

### RULE_002: 重复导入去重规则

**判定标准：**
- `model_output_id` 已存在
- 现有记录 `is_active = True`
- 内容哈希完全一致

**怎么处理：**
- 内容完全相同 → skip，不创建新记录，数量不翻倍
- 内容有差异 → update，版本号 +1，保留历史
- 更新为最新 `batch_id`

**回滚：** 去重是幂等操作，无需回滚

---

### RULE_003: 单条备注修改历史规则

**记录内容：**
- `field_name`：修改的字段名
- `old_value` / `new_value`：改前改后值
- `changed_by`：修改人
- `change_reason`：修改原因

**查询：**
- `history --diff` 查看改前改后差异
- `compare_versions()` 对比任意两个版本

---

### RULE_004: 3D/图表展示复核规则

**要求：**
- 选择 3D 或图表展示时，先服务复核
- 点击到手机号漏遮记录时，必须能跳回模型输出片段或人工改判表
- 禁止只展示漂亮画面，必须可溯源
- 点击时携带 `model_output_id` 或 `manual_review_id`

---

### RULE_005: 三步工作流边界规则

| 步骤 | 名称 | 动作 |
|------|------|------|
| 1 | 模型输出片段第一次导入 | 创建记录，标记来源，自动检测脱敏问题，手机号漏遮不自动归正常 |
| 2 | 小孟补看人工改判表 | 补全 source_manual_review，设为 reviewed，reviewer=xiaomeng，再次检测脱敏 |
| 3 | 脱敏导出更新 | 应用全部脱敏规则，有手机号漏遮的默认不导出，留给算法同事复核 |

**关键原则：** 手机号漏遮别急着归正常，留给算法同事复核。

---

### RULE_006: 审计与复盘规则

**要求：**
- 所有操作写入 `data/audit_logs/audit.log.jsonl`
- 每条记录带 `timestamp`、`event_type`、`data`
- 可生成 replay 命令列表
- 可追溯每个 recommendation 的完整版本历史
- 可追溯每次导入的 item_count、new、updated、duplicates
- 可追溯脱敏检测的 violation_type 和 matched_texts
- 可追溯回滚操作的 from_version 和 to_version

---

## 快速开始

### 环境要求

- Python 3.8+

### 运行测试

```bash
cd /path/to/project
python3 -m unittest tests.test_core -v
```

### 运行完整示例

```bash
# 运行完整三步工作流
python3 -m learning_path_recommender.cli.main workflow \
  -m examples/model_outputs_sample.json \
  -r examples/manual_reviews_sample.json \
  -b BATCH_2025_001 \
  -o xiaomeng \
  -O export_result.json

# 查看批次汇总
python3 -m learning_path_recommender.cli.main summary -b BATCH_2025_001

# 查看脱敏规则列表
python3 -m learning_path_recommender.cli.main rules

# 查看审计日志
python3 -m learning_path_recommender.cli.main audit --limit 20

# 生成复盘重放命令
python3 -m learning_path_recommender.cli.main replay --limit 50
```

---

## CLI 命令参考

| 命令 | 说明 | 示例 |
|------|------|------|
| `import` | 导入模型输出片段 | `lpr import -i model.json -b B001 -o xiaomeng` |
| `review` | 应用人工改判表 | `lpr review -i reviews.json -b B001` |
| `export` | 脱敏导出 | `lpr export -b B001 -o out.json` |
| `workflow` | 运行完整三步工作流 | `lpr workflow -m model.json -r review.json -b B001` |
| `history` | 查看版本历史 | `lpr history --id <rec_id> --diff` |
| `rollback` | 回滚到指定版本 | `lpr rollback --id <rec_id> -v 1 -o admin` |
| `check` | 检查脱敏问题 | `lpr check --batch-id B001 --auto-fix` |
| `escalate` | 升级到算法同事复核 | `lpr escalate --id <rec_id> -c "手机号漏遮"` |
| `rules` | 查看边界规则 | `lpr rules --rule-id RULE_001` |
| `replay` | 生成复盘重放命令 | `lpr replay --limit 100` |
| `summary` | 查看批次汇总 | `lpr summary -b B001` |
| `audit` | 查看审计日志 | `lpr audit --limit 50` |

---

## 核心 API 示例

```python
from learning_path_recommender.storage import JSONStorage
from learning_path_recommender.workflow import ThreeStepWorkflow

# 初始化
storage = JSONStorage("data")
workflow = ThreeStepWorkflow(storage)

# 运行完整三步工作流
model_items = [
    {"id": "M001", "content": "推荐学习路径：Python → 数据分析"},
    {"id": "M002", "content": "联系电话 13812345678"},
]
manual_reviews = [
    {"model_output_id": "M001", "review_content": "建议先学基础"},
]

result = workflow.run_full_workflow(
    model_items=model_items,
    manual_reviews=manual_reviews,
    batch_id="B001",
    operator="xiaomeng",
)

print(result["summary"])
# 输出类似:
# {
#   "imported": 2,
#   "reviews_applied": 1,
#   "phone_issues": 1,
#   "exported": 1,
#   "skipped": 1
# }
```

---

## 数据存储结构

运行后在 `data/` 目录下自动创建：

```
data/
├── recommendations/      # 每个推荐理由一个 JSON 文件
├── import_records/       # 每次导入的记录
├── version_history/      # 每次修改的版本历史
├── masking_rules/        # 脱敏规则配置
└── audit_logs/
    └── audit.log.jsonl  # 审计日志（追加写入）
```

---

## 测试覆盖

15 个单元测试覆盖：

- ✅ 导入新条目 / 重复导入去重 / 内容更新
- ✅ 人工改判应用
- ✅ 手机号检测 / 脱敏 / 导出跳过
- ✅ 升级算法复核流程
- ✅ 版本历史记录 / 回滚
- ✅ 完整三步工作流
- ✅ 边界规则验证

---

## 设计原则

1. **不靠口头约定：** 所有边界规则写在代码里（`config/boundary_rules.py`）和 README 里
2. **可追溯：** 每一条推荐理由都能回到原始的模型输出片段和人工改判表
3. **可复盘：** 所有操作留痕，可生成重放命令
4. **幂等性：** 重复导入不翻倍，重复操作可安全执行
5. **分级处理：** 手机号漏遮是最高优先级，不急着自动处理，留待人工复核
