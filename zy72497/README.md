# 街巷消防通道清障 - 证据整合与追溯系统

## 核心设计原则

1. **单一数据源**：导出明细、页面展示、接口返回读同一份结果，杜绝"一处显示异常、一处消失"
2. **证据可追溯**：居民投诉编号的原始行号、人工改动、处理状态全程留痕
3. **边界规则代码化**：不靠口头约定，所有判定逻辑写在 `src/engine.py` 的 `BoundaryRules` 类中
4. **流程可复现**：输出的不是功能清单，而是可复盘的记录和可重新跑的命令

---

## 三步核心流程

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  第一步: 导入投诉    │───▶│  第二步: 补看照片    │───▶│  第三步: 复核确认    │
│  居民投诉编号主流程  │    │  路口照片现场说法    │    │  点位清单更新        │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
   原始行号留痕                自动检测异常                 三段追溯审计
   人工改动记录                施工改道暂扣待复核             居民代表签字确认
```

---

## 边界规则（已写入代码）

### 1. 施工临时改道未同步地图 - 判定规则

**代码位置**：[engine.py](file:///Users/lzy/pro/solo/workspaces/zy72497/src/engine.py#L17-L63) 的 `BoundaryRules.detect_temporary_detour_issue()`

**触发关键词**（投诉内容或照片描述中出现任意一个）：
- 施工临时改道 / 临时改道
- 道路施工 / 改道 / 绕行
- 地图未更新 / 地图不对 / 导航错误

**处理动作**：
- 自动标记为 `PENDING_REVIEW`（待复核）
- 异常类型设为 `TEMPORARY_DETOUR_NOT_SYNCED`
- **不归为正常，留给居民代表复核**
- 备注："需居民代表复核，暂不归为正常"

### 2. 回滚规则

**代码位置**：[engine.py](file:///Users/lzy/pro/solo/workspaces/zy72497/src/engine.py#L57-L63) 的 `BoundaryRules.get_rollback_eligibility()`

**可回滚的状态**：
- `CONFIRMED_NORMAL`（已确认正常）
- `CONFIRMED_ABNORMAL`（已确认异常）
- `UPDATED`（已更新）

**不可回滚的状态**：
- `IMPORTED`（刚导入）
- `PHOTO_REVIEWED`（照片已审核）
- `PENDING_REVIEW`（待复核）

**回滚动作**：回到上一步的状态，全程留痕

### 3. 异常分类规则

| 异常类型 | 判定条件 |
|---------|---------|
| `temporary_detour_not_synced` | 施工临时改道相关关键词 |
| `obstruction_found` | 堵、占用、障碍等关键词 |
| `other` | 其他未分类情况 |

---

## 三段追溯机制

居民代表复查时，不用翻聊天记录，直接按以下三段追：

### 第一段：居民投诉编号来源
- 原始行号（Excel/表格导入时的第几行）
- 原始数据（导入时的完整 raw_data）
- 导入人、导入时间
- 所有人工改动记录（字段、旧值、新值、操作人、时间）

### 第二段：路口照片补录
- 每张照片的审核人、审核时间
- 现场说法（scene_description）
- 照片原始数据

### 第三段：人工确认
- 每次确认/修改/回滚的操作人、时间
- 具体动作和详情
- 完整审计日志链

**使用命令**：
```bash
python -m src.cli show COMP-2024-002
```

---

## 快速开始

### 环境要求
- Python 3.8+

### 运行 Demo 工作流
```bash
# 1. 先清空旧数据
rm -f data/clearance_records.json

# 2. 执行完整 Demo 工作流（包含施工临时改道场景）
python -m src.cli run-workflow data/demo_workflow.json

# 3. 查看汇总
python -m src.cli summary

# 4. 查看单条记录的三段追溯（看施工临时改道那条）
python -m src.cli show COMP-2024-002

# 5. 导出数据（CSV/JSON，与页面展示同一份数据源）
python -m src.cli export --format csv --output data/export.csv
python -m src.cli export --format json --output data/export.json

# 6. 生成可复现的工作流文件
python -m src.cli replayable --output data/replay_workflow.json
```

### 分步操作（手动走三步）
```bash
# 第一步：导入居民投诉编号
python -m src.cli import data/sample_complaints.json --operator 数据录入员

# 第二步：城更项目经理阿宁补看路口照片
python -m src.cli review-photo COMP-2024-001 data/sample_photo_001.json --operator 阿宁
python -m src.cli review-photo COMP-2024-002 data/sample_photo_002.json --operator 阿宁

# 查看当前状态（注意 COMP-2024-002 会是 pending_review）
python -m src.cli list

# 第三步：居民代表复核确认
python -m src.cli confirm COMP-2024-001 --operator 居民代表陈阿姨 --abnormal --note "确认杂物堆积"
# COMP-2024-002 因是施工临时改道，建议先看追溯再决定
python -m src.cli show COMP-2024-002
```

---

## 数据一致性保证

**代码位置**：[consistency.py](file:///Users/lzy/pro/solo/workspaces/zy72497/src/consistency.py)

所有输出都走 `SingleSourceOfTruth` 类，确保：
- API 接口调用 → `for_api()`
- 页面展示 → `for_page_display()`
- CSV 导出 → `for_export_csv()`
- JSON 导出 → `for_export_json()`
- 汇总统计 → `for_summary()`
- 追溯查询 → `for_audit_trace()`

**全部从同一份内存数据读取**，修改后立即持久化到 `data/clearance_records.json`。

---

## 项目结构

```
.
├── src/
│   ├── __init__.py          # 包导出
│   ├── models.py            # 数据模型（投诉、照片、审计日志、清障记录）
│   ├── engine.py            # 核心引擎 + 边界规则
│   ├── consistency.py       # 单一数据源层
│   └── cli.py               # 命令行工具
├── data/
│   ├── sample_complaints.json   # 示例投诉数据
│   ├── sample_photo_001.json    # 示例照片1
│   ├── sample_photo_002.json    # 示例照片2（含施工改道）
│   ├── demo_workflow.json       # 完整演示工作流
│   └── clearance_records.json   # 运行时数据（自动生成）
├── tests/
│   └── test_engine.py       # 单元测试
└── README.md                # 本文档
```

---

## 可复现工作流

系统支持两种可复现方式：

### 方式一：从现有数据生成
```bash
python -m src.cli replayable --output data/my_workflow.json
```
生成的 JSON 文件包含所有操作步骤，可以在另一台机器上完整复现。

### 方式二：编写工作流并执行
参考 `data/demo_workflow.json` 格式，支持的 action：
- `import` - 导入投诉
- `review_photo` - 补录照片
- `confirm` - 确认正常/异常
- `rollback` - 回滚
- `manual_edit` - 人工修改字段

执行：
```bash
python -m src.cli run-workflow data/my_workflow.json
```

---

## 运行测试

```bash
pip install pytest
pytest tests/ -v
```

---

## 状态机说明

```
IMPORTED (已导入)
    │
    ▼
PHOTO_REVIEWED (照片已审核) ──┐
    │                         │
    │ 检测到施工改道等边界情况  │
    ▼                         │
PENDING_REVIEW (待复核)        │
    │                         │
    └───────────┬─────────────┘
                │
       居民代表确认
        ┌──────┴──────┐
        ▼             ▼
CONFIRMED_NORMAL  CONFIRMED_ABNORMAL
   (确认正常)        (确认异常)
        │             │
        └──────┬──────┘
               │
               ▼
            UPDATED (已更新点位)
               │
               ▼
        ROLLED_BACK (可回滚)
```

---

## 关键承诺清单

✅ 居民投诉编号原始行号全程保留  
✅ 人工改动全程留痕  
✅ 处理状态全程可追溯  
✅ 施工临时改道自动识别并暂扣待复核  
✅ 导出/页面/接口同一份数据源  
✅ 边界规则写在代码里不靠口头  
✅ 输出可复盘记录和可重跑命令  
✅ 支持三段追溯（投诉来源/照片补录/人工确认）
