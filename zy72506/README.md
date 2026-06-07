# 工单摘要事实校验系统

## 系统目标

解决 AI 产品经理阿宁的核心痛点：**模型版本换了但样本编号没变时，不用再回头找模型输出片段和人工改判表谁更可信**。所有明细、页面展示、接口返回读同一份结果。

---

## 一、核心边界规则（写在代码里，不靠口头约定）

### 1.1 冲突检测规则：模型版本换了但样本编号没变

**触发条件**（代码见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/engine.py#L11-L27) 的 `detect_conflict` 函数）：
- 同一个 `sample_id` 历史上导入过
- 历史记录的 `model_version` ≠ 当前导入的 `model_version`

**判罚逻辑**：
- 自动标记冲突类型为 `model_version_changed_same_sample`（模型版本变更但样本编号不变）
- 状态设为 `model_version_conflict`（模型版本冲突）
- **绝对不会自动归为正常**，必须走人工复核流程
- 同时保留 `previous_model_version` 和 `current_model_version` 便于对比

### 1.2 三步流程状态机

```
第一步：模型输出导入
    ↓
IMPORTED ────冲突检测─────→ MODEL_VERSION_CONFLICT (版本冲突，等待AI PM)
    ↓                           ↓
    └───────────────────────────┘
                                ↓
第二步：AI产品经理阿宁补看人工改判表
    ↓
PENDING_AI_PM_REVIEW ──AI PM 批准──→ PENDING_OPERATION_REVIEW (提交运营复核)
    ↓                                      ↓
AI_PM_REVIEWED                    OPERATION_APPROVED / OPERATION_REJECTED
    ↓                                      ↓
    └───────────────┬──────────────────────┘
                    ↓
第三步：产品复盘页更新
                    ↓
               COMPLETED
```

**关键设计**：
- 版本冲突的记录，AI PM 批准后**必须再经过运营复核人**，不能直接跳过
- 非冲突记录，AI PM 复核后可直接进入第三步
- 每一步状态流转都有操作日志和状态历史，可完整复盘

### 1.3 回滚规则

任何状态的记录都可以回滚（代码见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/engine.py#L212-L234) 的 `rollback_record`）：
- 回滚后状态变为 `ROLLBACKED`
- 保留完整的状态历史，不会删除任何证据
- 回滚操作必须填写原因，记录到操作日志

---

## 二、数据一致性保证

**所有入口读同一份数据**：

| 入口 | 读取层 | 代码位置 |
|------|--------|----------|
| CLI 列表/详情 | SQLite 数据库 → `storage.py` → `engine.get_record_for_review()` | [storage.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/storage.py) |
| Excel 导出 | 同一个 SQLite 数据库 → `result_reader.get_batch_results()` | [result_reader.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/result_reader.py#L10-L25) |
| 页面展示（未来接入） | 同样调用 `engine.get_record_for_review()` | [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/engine.py#L237-L291) |
| API 接口（未来接入） | 同样调用 `engine.get_record_for_review()` | 同上 |

**保证**：版本冲突的记录，不会在一个地方显示异常、另一个地方消失。

---

## 三、保留的证据字段（运营复核人追问时能回到证据）

每条校验记录保留以下证据（见 [models.py](file:///Users/lzy/pro/solo/workspaces/zy72506/src/models.py)）：

### 模型输出片段侧
- `original_row_number`：原始 Excel 行号（从第2行开始算）
- `model_version`：模型版本
- `previous_model_version`：上一个模型版本（冲突时）
- `model_output`：模型输出原文
- `expected_summary`：标准答案
- `fact_check_result`：事实校验结果
- `raw_data`：导入时的整行原始数据（保留所有列）

### 人工改判侧
- `judge_row_number`：人工改判表的行号
- `is_correct`：人工判罚是否正确
- `corrected_summary`：人工修正后的摘要
- `judge_comment`：改判说明
- `judged_by`：改判人

### 处理状态侧
- `status`：当前状态
- `conflict_type`：冲突类型
- `status_history`：完整的状态流转历史（谁、什么时候、从什么状态改到什么状态、备注）
- `ai_pm_review_*`：AI产品经理复核意见、操作人、时间
- `operation_review_*`：运营复核意见、操作人、时间

---

## 四、运营复核人交接体验（不用问阿宁，也能知道卡在哪）

运营复核人打开单条记录时（`python cli.py show <record_id>`），会直接看到：

```
┌──── 当前进度（运营复核人无需追问即可了解） ────┐
│ 卡在哪一步: 第二步后：运营复核                       │
│ 阻塞原因: AI产品经理已确认模型版本变更（v1 → v2），  │
│          等待运营复核人确认                         │
└────────────────────────────────────────────────────┘
```

可能的阻塞点说明：

| 状态 | 卡在哪一步 | 阻塞原因 |
|------|-----------|----------|
| `model_version_conflict` | 第一步：模型输出导入 | 模型版本从 X 变更为 Y，但样本编号未变，等待AI产品经理确认 |
| `pending_ai_pm_review` | 第二步：AI产品经理补看人工改判表 | 已导入人工改判表，等待AI产品经理阿宁复核 |
| `pending_operation_review` | 第二步后：运营复核 | AI产品经理已确认版本变更，等待运营复核人确认 |
| `ai_pm_reviewed` / `operation_approved` / `operation_rejected` | 第三步：产品复盘页更新 | 复核已完成，等待产品复盘页更新 |
| `completed` | - | 全部流程已完成 |

---

## 五、安装与快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 生成示例数据（用于演示）
python cli.py create-example

# 完整演示流程（见 create-example 输出的命令）
```

---

## 六、可复跑命令清单

### 第一步：导入模型输出片段

```bash
# 导入模型v1输出
python cli.py import-model ./examples/model_output_v1.xlsx \
    --name "测试批次v1" \
    --model-version v1 \
    --operator 阿宁

# 导入模型v2输出（前10条样本编号不变，会触发版本冲突）
python cli.py import-model ./examples/model_output_v2.xlsx \
    --name "测试批次v2" \
    --model-version v2 \
    --operator 阿宁
```

导入后会输出 `batch_id`，后续命令都需要用到。

### 第二步前：导入人工改判表

```bash
python cli.py import-judgements ./examples/manual_judgements.xlsx \
    --batch-id <batch_id>
```

### 查看待处理列表

```bash
# 查看所有记录
python cli.py list --batch-id <batch_id>

# 只看版本冲突的记录
python cli.py list --batch-id <batch_id> --conflict model_version_changed_same_sample

# 只看待AI产品经理复核的
python cli.py list --batch-id <batch_id> --status pending_ai_pm_review

# 只看待运营复核的
python cli.py list --batch-id <batch_id> --status pending_operation_review
```

### 第二步：AI产品经理阿宁复核

```bash
# 批准（冲突记录会进入待运营复核，非冲突记录直接进入第三步）
python cli.py ai-review <record_id> --approve --comment "确认版本变更有效" --operator 阿宁

# 驳回（无需运营复核，直接进入第三步）
python cli.py ai-review <record_id> --reject --comment "版本变更无效，按原版本处理" --operator 阿宁
```

### 第二步后：运营复核人复核（仅冲突记录需要）

```bash
# 通过
python cli.py operation-review <record_id> --approve --comment "确认通过" --operator 运营李四

# 驳回
python cli.py operation-review <record_id> --reject --comment "需要重新核对" --operator 运营李四
```

### 第三步：标记产品复盘页已更新

```bash
python cli.py mark-page-updated <record_id> --comment "已更新到产品复盘页第3版"
```

### 查看单条记录详情（运营复核人视图）

```bash
python cli.py show <record_id>
```

### 导出明细（与页面、接口同一份数据）

```bash
# 导出全部
python cli.py export --batch-id <batch_id> --output ./output/校验明细.xlsx

# 只导出版本冲突的
python cli.py export --batch-id <batch_id> --output ./output/版本冲突明细.xlsx \
    --conflict model_version_changed_same_sample
```

### 回滚操作

```bash
python cli.py rollback <record_id> --reason "操作有误，需要重新处理" --operator 阿宁
```

### 查看批次汇总

```bash
python cli.py summary --batch-id <batch_id>
```

### 查看操作日志（可复盘）

```bash
python cli.py logs --batch-id <batch_id> --limit 100
```

---

## 七、代码结构

```
.
├── cli.py                    # 命令行入口（所有操作的统一入口）
├── requirements.txt          # 依赖
├── README.md                 # 本文档（边界规则、操作手册）
├── data/
│   └── verification.db       # SQLite 数据库（所有数据的唯一真相来源）
├── src/
│   ├── models.py             # 数据模型定义（实体、状态枚举）
│   ├── storage.py            # 数据存储层（SQLite 读写）
│   ├── engine.py             # 核心校验引擎（状态机、冲突检测、复核逻辑）
│   ├── importer.py           # 数据导入模块（模型输出、人工改判表）
│   └── result_reader.py      # 统一结果读取层（导出、汇总、日志视图）
└── examples/                 # 示例数据（create-example 生成）
```

---

## 八、冲突处理决策树（运营复核人速查）

```
发现模型版本换了但样本编号没变？
    │
    ├─→ 第一步：自动标记为「模型版本冲突」，不自动判正常
    │
    ├─→ 第二步：AI产品经理阿宁核对
    │       ├─ 批准 → 进入运营复核
    │       └─ 驳回 → 无需运营，直接进第三步
    │
    └─→ 第二步后（如有）：运营复核人确认
            ├─ 通过 → 进入第三步
            └─ 驳回 → 进入第三步，记录驳回意见
                │
                └─→ 第三步：产品复盘页更新 → 完成
```

---

## 九、关键设计决策说明

### 9.1 为什么版本冲突的记录必须走运营复核？

因为阿宁提到"真正耗时间的是模型版本换了但样本编号没变出现后，还要回头找模型输出片段和人工改判表谁更可信"。这种场景涉及数据可信度，需要多一层交叉验证，避免单点失误。

### 9.2 为什么保留原始行号和 raw_data？

运营复核人追问时，能直接定位到原始 Excel 的第几行，不用再翻文件找。`raw_data` 保留了导入时的所有列，后续新增字段也能追溯。

### 9.3 为什么所有入口走同一份数据？

避免"导出说异常、页面说正常"的不一致问题。无论是 CLI 查看、Excel 导出、还是未来的页面/API，都从同一个 SQLite 库、同一个 `get_record_for_review()` 函数读取。
