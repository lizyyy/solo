# 最大匹配志愿录取系统

## 项目概述

本系统实现最大匹配志愿录取算法，**特别注重数据完整性和可追溯性**。抽样名单的备注信息完整保留，不进行数据清洗。所有边界规则在代码和文档中明确规定，不靠口头约定。

---

## 核心设计原则

### 1. 备注信息完整保留
- **绝不**把备注材料洗成一行干净数据
- `raw_score` 字段保存原始分数字符串（包括负数、非数字等）
- `remark` 字段完整保存抽样名单备注
- 老师批注支持多版本历史追踪

### 2. 重复导入不翻倍
- 同一批老师批注重复导入时，创建新版本，不重复计数
- 版本号自动递增，`is_latest` 标记最新版本
- 修改单条备注时，历史记录能看出改前改后差别

### 3. 数据追溯不中断
- 点击任何录取记录，都能追溯到：
  - 原始抽样名单
  - 所有历史版本的老师批注
  - 边界案例处理记录
  - 录取版本变更历史

---

## 边界规则（Border Rules）

### BR001: 负数分数处理

**场景**: 旧表中负数分数被当成缺失值

**判断规则**（代码位置：[border_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72324/src/utils/border_rules.py#L47-L70)）:
```python
if score < 0:
    标记为边界样本
```

**处理方式**:
1. ✅ **不**自动转为正数
2. ✅ **不**参与自动匹配
3. ✅ 标记 `is_negative = True`
4. ✅ 标记 `needs_review = True`
5. ✅ 自动分配给 `student_assistant` 复核

**如何改**（代码位置：[border_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72324/src/utils/border_rules.py#L148-L189)）:

| 决议方式 | 说明 | 最终分数 |
|---------|------|---------|
| `keep_negative` | 保留负数（如缺考标记） | 原负数 |
| `convert_positive` | 转为正数 | 取绝对值 |
| `mark_missing` | 标记为缺失 | None |
| `custom_value` | 人工指定值 | 自定义 |

**如何回滚**:
- 调用 `BorderlineReviewManager.rollback_case()`
- 恢复为 `pending` 状态
- 分数重置为 `None`

---

### BR002: 缺失分数处理

**场景**: 分数为空或非数字

**判断规则**:
```python
if pd.isna(score) or score == "" or cannot_convert_to_float:
    标记为缺失
```

**处理方式**:
1. ✅ `is_missing = True`
2. ✅ 不参与自动匹配
3. ✅ 保留原始字符串用于追溯

---

### BR003: 排名异常处理

**场景**: 排名为 0、负数或超出合理范围

**判断规则**:
```python
if rank <= 0 or rank > total_samples * 1.5:
    标记为边界样本
```

**处理方式**:
1. ✅ 标记为边界案例
2. ✅ 需人工确认

---

### BR004: 重复学生处理

**场景**: 同一学号重复出现

**处理方式**（代码位置：[data_importer.py](file:///Users/lzy/pro/solo/workspaces/zy72324/src/utils/data_importer.py#L122-L140)）:
1. ✅ 保留最新版本数据
2. ✅ 不创建重复记录
3. ✅ `duplicate_records` 计数 + 1

---

### BR005: 备注冲突处理

**场景**: 同一学生备注不一致

**处理方式**:
1. ✅ 保留所有历史版本
2. ✅ 标记冲突
3. ✅ 需人工确认

---

## 三步工作流

### 步骤 1: 老师批注第一次导入

**执行者**: 老师

**操作**:
1. 导入包含老师批注的 Excel/CSV 文件
2. 系统自动检测重复批注
3. 相同内容 → 标记为重复，不创建新版本
4. 内容不同 → 版本号 + 1，保留历史

**代码入口**: `DataImporter.import_teacher_comments()`

---

### 步骤 2: 运营规划阿岚补看抽样名单

**执行者**: 运营规划（阿岚）

**关注点**:
1. 查看抽样名单完整备注信息
2. 检查边界案例（负数分数、缺失值等）
3. **不**急于将负数归为正常
4. 留给学生助教复核

**代码入口**: `ThreeStepWorkflow.complete_step(2, operator="alan")`

---

### 步骤 3: 边界样本报告更新

**执行者**: 学生助教

**操作流程**:
1. 查看分配给自己的待复核案例
2. 查看该学生的所有老师批注
3. 查看原始抽样名单备注
4. 选择处理决议（见 BR001）
5. 提交处理结果

**代码入口**: `BorderlineReviewManager.resolve_case()`

---

## 数据模型

### 核心表结构

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `sample_list` | 抽样名单 | `raw_score`, `remark`, `is_negative` |
| `teacher_comment` | 老师批注 | `version`, `is_latest`, `previous_version_id` |
| `admission_record` | 录取记录 | `matched_volunteer`, `batch_id` |
| `admission_version` | 录取历史 | 每次变更完整记录 |
| `borderline_case` | 边界案例 | `status`, `assigned_to`, `resolution` |
| `import_batch` | 导入批次 | 去重统计 |
| `workflow_step` | 工作流步骤 | 三步流程追踪 |

完整模型定义：[database.py](file:///Users/lzy/pro/solo/workspaces/zy72324/src/models/database.py)

---

## 匹配算法

### 最大匹配志愿录取流程

1. **排序**: 按分数从高到低排序
2. **过滤**: 边界样本（负数、缺失、待复核）自动跳过
3. **匹配**: 按志愿 1 → 志愿 2 → 志愿 3 顺序匹配
4. **名额**: 专业名额满则下一志愿
5. **版本**: 重新匹配时保留历史版本

**代码入口**: `VolunteerMatchingEngine.run_matching()`

---

## 数据追溯 API

```python
from src.utils.matching_engine import get_admission_traceability

trace = get_admission_traceability(db, sample_id=123)

# 返回完整追溯链
{
    "student": {"raw_score": "-5", "remark": "..."},
    "borderline_flags": {"is_negative": True},
    "admission": {"matched_major": "计算机科学"},
    "version_history": [...],
    "teacher_comments": [...],
    "borderline_cases": [...],
    "trace_source": {"sample_source": "...", "import_batch": "..."}
}
```

---

## 界面设计原则

### 3D / 图表展示时

1. ✅ **先服务复核**，再追求美观
2. ✅ 点击任意图表数据点 → 能钻取到原始数据
3. ✅ 负数样本点击 → 能回到老师批注或抽样名单
4. ✅ **不**只剩漂亮画面

### 界面简单但证据链完整

> "我不介意界面简单，怕的是结论看着很满，追证据时断在半路。"

- 每个数据点都有 "查看来源" 链接
- 每个录取结果都能看到完整匹配过程
- 每个边界案例都能看到处理历史

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
cp .env.example .env
```

### 初始化数据库

```python
from src.models.database import init_db
init_db()
```

### 导入数据

```python
from src.models.database import SessionLocal
from src.utils.data_importer import DataImporter

db = SessionLocal()
importer = DataImporter(db)

# 导入抽样名单
batch_id, stats = importer.import_sample_list(
    "data/imports/samples.xlsx",
    imported_by="admin",
    import_note="第一批抽样名单"
)

# 导入老师批注
batch_id, stats = importer.import_teacher_comments(
    "data/imports/comments.xlsx",
    imported_by="teacher_wang"
)
```

### 运行匹配

```python
from src.utils.matching_engine import VolunteerMatchingEngine

engine = VolunteerMatchingEngine(db, major_quota={
    "计算机科学": 50,
    "软件工程": 30
})
result = engine.run_matching()
```

### 三步工作流

```python
from src.utils.workflow import ThreeStepWorkflow

workflow = ThreeStepWorkflow(db, batch_id="sample_20240101")
workflow.start_step(1, operator="teacher_wang")
workflow.complete_step(1, operator="teacher_wang")
```

---

## 项目结构

```
.
├── src/
│   ├── models/
│   │   └── database.py      # 数据模型定义
│   ├── utils/
│   │   ├── border_rules.py  # 边界规则定义
│   │   ├── data_importer.py # 数据导入（去重+版本）
│   │   ├── matching_engine.py # 匹配算法
│   │   └── workflow.py      # 三步工作流
│   └── web/
├── data/
│   ├── imports/
│   └── exports/
├── logs/
├── requirements.txt
└── README.md
```

---

## 边界规则验证清单

- [ ] 负数分数自动标记待复核
- [ ] 负数分数不参与自动匹配
- [ ] 重复导入批注不翻倍计数
- [ ] 修改备注能看到版本差异
- [ ] 点击图表数据能追溯原始来源
- [ ] 三步工作流按顺序执行
- [ ] 边界案例能回滚
- [ ] 所有规则在代码和文档中一致

---

**最后更新**: 2024年  
**维护者**: 运营规划 阿岚
