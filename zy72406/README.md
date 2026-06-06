# 版权授权地域核对系统

> 为录音师小段、音乐老师、店长打造的版权核对工具，保留完整证据链，支持复盘和重跑。

## 核心设计原则

1. **同一份结果，多处一致**：导出明细、页面展示、CLI输出、API返回，全部读取同一份数据
2. **证据链完整可追溯**：原始行号、人工改动、状态流转、每份证据的来源和内容全程保留
3. **同名冲突不自动消失**：现场名≠版权名时，留给音乐老师复核，不会因为补录合同就自动归为正常
4. **边界规则文档化**：所有判定逻辑写在代码和README中，不靠口头约定
5. **可复盘、可重跑**：最终交付的是一份完整记录，而非简单的功能清单

---

## 快速开始

### 一键演示完整三步流程

```bash
# 清理旧数据（可选）
rm -rf data

# 一键走通：接龙导入 → 小段补合同 → 老师复核 → 生成周报
python -m src.cli workflow --operator 演示用户 --output reports/demo_weekly.json
```

### 分步操作（实际工作流程）

#### 第一步：排练群接龙第一次导入

```bash
# 支持 JSON 或 CSV 格式
python -m src.cli import \
  --file examples/sample_group_chat.json \
  --operator 小助理
```

**保留的信息：**
- 每条记录的原始行号（original_row_number）
- 导入时间、操作人
- 自动检测同名冲突（现场名≠版权名），标记为 `name_conflict` 状态

#### 第二步：录音师小段补看合同页截图

```bash
# 先查看所有待补合同的记录
python -m src.cli list --status name_conflict

# 为某条记录添加合同证据
python -m src.cli add-contract \
  --record-id <记录ID> \
  --source "合同扫描页_第3页.png" \
  --content "合同第3页，授权地域：中国大陆，版权方签章齐全" \
  --operator 小段
```

**关键规则：**
- 补录合同证据后，同名冲突记录状态变为 `teacher_review`
- **不会自动归为正常**，必须留给音乐老师复核

#### 第三步：音乐老师复核 + 店长周报

```bash
# 查看待复核记录
python -m src.cli list --status teacher_review

# 审批通过（带备注）
python -m src.cli teacher-approve \
  --record-id <记录ID> \
  --note "版权名正确，现场名是演出时的别称" \
  --operator "音乐老师"

# 或驳回
python -m src.cli teacher-reject \
  --record-id <记录ID> \
  --reason "版权名与合同不符，需重新核对" \
  --operator "音乐老师"

# 生成店长周报
python -m src.cli report \
  --output reports/week_2026_06.json \
  --summary-only
```

---

## 边界规则（Boundary Rules）

所有规则定义在 [src/engine.py](src/engine.py) 的 `BoundaryRules` 类中。

### 1. NAME_CONFLICT_REQUIRES_TEACHER_REVIEW = True

**场景：** 同一首歌有现场名和版权名，且两者不一致。

**判定：**
- 导入时自动检测，标记为 `name_conflict` 状态
- 录音师补录合同证据后，状态变为 `teacher_review`
- **必须由音乐老师人工审批**，不能自动通过
- 审批时必须提供审批备注

**修改方式：** 修改 `BoundaryRules.NAME_CONFLICT_REQUIRES_TEACHER_REVIEW = False` 可关闭强制复核（不建议）

**回滚方式：**
```bash
python -m src.cli rollback --record-id <记录ID> --reason "误判，需要重新核对"
```

### 2. CONTRACT_EVIDENCE_OUTWEIGHS_GROUP_CHAT = True

**场景：** 排练群接龙与合同页截图内容矛盾。

**判定：**
- 合同页截图的证据优先级高于排练群接龙
- 当两者矛盾时，以合同证据为准
- **但接龙记录不会被删除**，保留在证据链中，便于回溯

**修改方式：** 人工修改歌曲名时系统会自动记录改动历史：
```bash
python -m src.cli update-name \
  --record-id <记录ID> \
  --field copyright_name \
  --value "正确的版权名" \
  --reason "根据合同页第5页修正" \
  --operator 小段
```

**回滚方式：** 回滚操作会恢复原始值，且保留修改记录。

### 3. ROLLBACK_PRESERVES_HISTORY = True

**场景：** 任何操作需要撤销。

**判定：**
- 回滚操作**不删除任何历史记录**
- 状态流转会增加一条 `rolled_back` 记录
- 原始状态、修改内容、证据都完整保留

**回滚命令：**
```bash
python -m src.cli rollback --record-id <记录ID> --reason "操作失误"
```

### 4. MIN_EVIDENCE_FOR_APPROVAL = 2

**场景：** 音乐老师审批时的证据要求。

**判定：**
- 审批通过至少需要 2 份证据
- 通常是：1 份排练群接龙 + 1 份合同页截图
- 证据不足时，审批自动失败，状态变为 `awaiting_contract`

---

## 状态流转图

```
  imported ──> name_conflict ──> teacher_review ──> approved
     │              │                  │               │
     │              │                  └──> rejected   │
     │              │                                  │
     └──> awaiting_contract ──> contract_verified ─────┘
                                                           
  任何状态都可回滚(rolled_back)，所有历史保留
```

状态说明：
| 状态 | 说明 |
|------|------|
| `imported` | 已从接龙导入，等待补录合同 |
| `name_conflict` | 现场名与版权名不一致，待处理 |
| `awaiting_contract` | 缺少合同证据 |
| `contract_verified` | 合同已补录，无同名冲突 |
| `teacher_review` | 待音乐老师复核（有同名冲突） |
| `approved` | 审批通过 |
| `rejected` | 审批驳回 |
| `rolled_back` | 已回滚 |

---

## 证据链说明

每条记录的完整证据链可通过以下命令查看：

```bash
python -m src.cli show <记录ID>
```

输出包含：
1. **基础信息**：显示名、现场名、版权名、授权地域、原始行号
2. **证据明细**：
   - 排练群接龙证据（group_chat）
   - 合同页截图证据（contract_screenshot）
   - 人工备注（manual_note）
3. **人工改动**：每次修改的字段、旧值、新值、操作人、原因
4. **状态历史**：每次状态变更的时间、操作人
5. **边界规则应用**：当前记录触发了哪些规则

---

## 数据结构

数据文件默认位置：`data/copyright_check.json`

```json
{
  "records": [
    {
      "record_id": "uuid",
      "live_name": "七里香live",
      "copyright_name": "七里香",
      "region": "中国大陆",
      "status": "teacher_review",
      "import_source": "group_chat_import",
      "original_row_number": 2,
      "import_time": "2026-06-06T...",
      "evidences": [
        {
          "evidence_id": "uuid",
          "evidence_type": "contract_screenshot",
          "source": "合同扫描页_2.png",
          "content": "...",
          "recorded_at": "2026-06-06T...",
          "operator": "小段"
        }
      ],
      "manual_changes": [],
      "status_history": [
        ["imported", "2026-06-06T...", "小助理"],
        ["name_conflict", "2026-06-06T...", "小助理"],
        ["teacher_review", "2026-06-06T...", "小段"]
      ]
    }
  ],
  "audit_log": [...],
  "boundary_rules": {...}
}
```

---

## 常用命令清单

```bash
# 查看帮助
python -m src.cli --help

# 查看边界规则
python -m src.cli rules

# 列出所有记录
python -m src.cli list

# 只看同名冲突
python -m src.cli list --conflict true

# 只看待复核
python -m src.cli list --status teacher_review

# 查看单条记录详情（证据链）
python -m src.cli show <记录ID>

# 重新生成周报（可重跑）
python -m src.cli report --output reports/week1.json

# 回滚某条记录
python -m src.cli rollback --record-id <记录ID> --reason "原因"
```

---

## API 集成说明

如果需要做成 API 服务，返回格式与 CLI 输出完全一致：

```python
from src.engine import CopyrightCheckEngine

engine = CopyrightCheckEngine()

# 获取记录列表（带证据摘要）
records = engine.list_records()
result = [r.get_evidence_summary() for r in records]

# 获取单条记录详情（含完整证据链）
details = engine.get_record_details(record_id)

# 生成周报
report = engine.generate_report()
report_dict = report.to_dict()
```

API 返回的 `evidence_summary` 包含：
- 排练群接龙证据数量
- 合同页截图证据数量
- 人工改动次数
- 原始行号
- 状态历史

---

## 如何修改边界规则

1. 编辑 [src/engine.py](src/engine.py) 中的 `BoundaryRules` 类
2. 修改对应常量的值
3. 保存后重新运行即可生效

**注意：** 修改规则后，已有的记录状态不会自动变更，只会对新操作生效。

---

## 项目文件结构

```
.
├── src/
│   ├── __init__.py
│   ├── models.py        # 数据模型：SongRecord, Evidence, ManualChange 等
│   ├── engine.py        # 核心引擎：CopyrightCheckEngine, BoundaryRules
│   └── cli.py           # 命令行接口
├── examples/
│   ├── sample_group_chat.json  # 示例接龙数据（JSON）
│   └── sample_group_chat.csv   # 示例接龙数据（CSV）
├── data/                # 运行时数据（自动生成）
│   └── copyright_check.json
└── reports/             # 导出的周报（自动生成）
    └── *.json
```
