# 容斥统计优惠叠加 (rxtj)

带完整审计追踪的容斥统计优惠叠加工具。每一步都有证据，追查时不断在半路。

## 核心原则

- **结论看着很满，追证据时不能断在半路**：每条数据的原始行号、人工改动、当前处理状态都保留
- **边界规则写在代码里**，不靠口头约定
- **重复导入不翻倍**，只记录差异
- **三步工作流**：导入批注 → 补看抽样 → 演示更新，中间遇到问题留待复核

## 边界规则

所有边界规则定义在 `rxtj/rules.py` 的 `BOUNDARY_RULES` 字典中，同时在此文档说明。

### 1. 分母为0却被填成空字符串

| 项目 | 规则 |
|------|------|
| **判** | `denominator_raw` 为空字符串 `""` 或纯空白 |
| **处** | 标记为 `flagged`，不自动归正常，留待数据复核人复核 |
| **改** | 复核人决定：手动填入正确值 → 状态变为 `pending`；或确认无效 → 状态变为 `rolled_back` |
| **回滚** | 若 `rollback_on_conflict=True`，整个批次回滚到上一一致状态 |
| **证据** | 必须保留原始行号、老师批注内容、抽样名单对应值 |

### 2. 分母为0且值为数值0

| 项目 | 规则 |
|------|------|
| **判** | `denominator_raw` 为 `"0"` 或 `"0.0"` |
| **处** | 视为0参与计算，自动修复，但仍记录原始值在审计日志 |
| **改** | 自动完成，复核人无需介入 |
| **回滚** | 不需要 |
| **证据** | 不强制，但审计日志中仍可见 |

### 3. 重复导入同一批老师批注

| 项目 | 规则 |
|------|------|
| **判** | `original_line_number` + `source` 匹中已有记录 |
| **处** | 逐字段比对，只记录有差异的字段；完全相同则计为 `unchanged`，不翻倍 |
| **改** | 只更新有变化的字段，历史中可看到改前改后 |
| **回滚** | 通过批次回滚功能恢复 |

### 4. 老师批注与抽样名单冲突

| 项目 | 规则 |
|------|------|
| **判** | 同一行号同一项目，批注值 ≠ 抽样值 |
| **处** | 标记为 `flagged`，不自动选谁对，留给数据复核人判断 |
| **改** | 复核人手动决定取批注还是抽样，或另填 |
| **回滚** | 可回滚整个批次 |

## 三步工作流

```
第一步：导入老师批注
  ↓ 遇到分母为0→空字符串？→ 标记 flagged，不归正常
第二步：竞赛教练补看抽样名单
  ↓ 批注与抽样冲突？→ 标记 flagged，留给复核人
第三步：课堂演示结果更新
  ↓ flagged 的不参与计算，但结果中列出证据
完成：可追查每条数据的完整历史
```

## 安装

```bash
pip install -r requirements.txt
```

## CLI 使用

```bash
# 查看边界规则
python -m rxtj.cli rules

# 导入老师批注
python -m rxtj.cli import annotations.json --source annotation --operator tanglaoshi

# 三步工作流
python -m rxtj.cli workflow 1 --file annotations.json --operator tanglaoshi
python -m rxtj.cli workflow 2 --file sampling.json --operator coach_tang
python -m rxtj.cli workflow 3 --json

# 查看审计追踪（原始行号、改动历史、当前状态）
python -m rxtj.cli audit <annotation_id>

# 列出批注
python -m rxtj.cli list --status flagged

# 回滚一个批次
python -m rxtj.cli rollback <batch_id>
```

## API 使用

```bash
# 启动
uvicorn rxtj.api:app --reload

# 导入
curl -X POST http://localhost:8000/import \
  -H "Content-Type: application/json" \
  -d '{"rows": [...], "source": "teacher_annotation"}'

# 三步工作流
curl -X POST http://localhost:8000/workflow/step1 -d '{"rows": [...]}'
curl -X POST http://localhost:8000/workflow/step2 -d '{"sampling_rows": [...]}'
curl -X POST http://localhost:8000/workflow/step3

# 审计追踪
curl http://localhost:8000/audit/<annotation_id>

# 边界规则
curl http://localhost:8000/rules
```

所有 API 返回都带 `evidence_summary` 字段，包含老师批注和抽样名单的证据摘要。

## 数据文件格式

JSON 示例：
```json
[
  {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
  {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"}
]
```

CSV 示例：
```
line_number,item_name,category,value,denominator,numerator
1,数学A,优惠,0.85,100,85
2,物理B,优惠,,,
```

## 审计追踪

每条批注保留：
- **原始行号** (`original_line_number`)
- **原始值** (`original_value`) — 首次导入时的值，不变
- **当前值** (`current_value`) — 可能被后续操作修改
- **所有变更历史** (`change_records`) — 每次修改的字段、改前改后值、操作人、原因
- **证据摘要** (`evidence`) — 批注内容、抽样名单值、冲突处理方式

数据复核人追问时，`audit` 命令或 `/audit/{id}` 接口可以回到完整证据链。
