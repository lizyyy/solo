# 研究生院招生对账服务

一个偏后端的招生对账服务，用于处理导师CSV、志愿JSON、调剂记录的自动比对、人工复核、差异溯源和报告导出。

## 核心功能

### 1. 数据导入
- 导师信息：CSV格式（工号、姓名、学院、专业、职称、名额等）
- 学生信息：CSV格式（考生编号、姓名、专业、成绩等）
- 志愿信息：JSON格式
- 调剂记录：JSON/CSV格式

### 2. 自动比对与冲突检测
- **名额占用检测**：检查导师分配名额是否超出剩余名额
- **跨专业限制检测**：识别跨专业申请的学生
- **重复录取检测**：发现同一学生被多次录取的情况
- **专业不匹配检测**：检查学生报考专业与导师招生专业是否一致

### 3. 人工复核
- 支持5种状态：待审核、已放行、已退回、需补材料、存在冲突
- 单个记录审核和批量审核
- 审核历史记录追踪
- 复核后自动重新计算统计数据

### 4. 差异溯源与决策说明
- 追踪每条录取记录的来源（志愿填报/调剂批次）
- 调剂来源可追溯到原导师和调剂原因
- 生成完整的决策说明，包含：基本信息、来源溯源、冲突分析、审核决策

### 5. 报告导出
- 汇总报告（JSON格式）：包含整体统计、导师配额使用情况、批次分布
- 详细记录（CSV格式）：包含所有对账明细
- 冲突报告（CSV格式）：按冲突类型分类展示问题记录

## 项目结构

```
.
├── models.py                          # 数据模型定义
├── data_importer.py                   # 数据导入模块
├── reconciliation_engine.py           # 对账核心引擎
├── review_manager.py                  # 复核管理模块
├── report_generator.py                # 报告生成模块
├── admission_reconciliation_service.py # 服务API层
├── demo.py                            # 演示脚本
├── sample_data/                       # 示例数据
│   ├── supervisors.csv
│   ├── students.csv
│   ├── choices.json
│   └── adjustments.json
└── output/                            # 报告输出目录
```

## 快速开始

### 运行演示

```bash
python3 demo.py
```

演示程序将展示完整的对账流程：
1. 创建对账会话
2. 导入各类数据
3. 运行自动对账
4. 查看汇总统计和冲突记录
5. 查看单条记录的决策说明
6. 执行人工审核（放行/退回）
7. 追踪学生调剂来源
8. 导出各类报告

### API使用示例

```python
from admission_reconciliation_service import AdmissionReconciliationService
from models import AdmissionStatus

# 初始化服务
service = AdmissionReconciliationService()

# 创建对账会话
session_id = service.create_session(
    name="2024年硕士研究生招生对账",
    created_by="研究生院-张秘书"
)

# 导入数据
service.import_supervisors(session_id, "sample_data/supervisors.csv")
service.import_students(session_id, "sample_data/students.csv")
service.import_choices(session_id, "sample_data/choices.json")
service.import_adjustments(session_id, "sample_data/adjustments.json")

# 运行自动对账
service.run_reconciliation(session_id)

# 查看汇总
summary = service.get_summary(session_id)
print(f"总记录数: {summary['statistics']['total_records']}")
print(f"冲突记录: {summary['statistics']['conflict_count']}")

# 人工审核
conflict_items = service.get_items_by_status(session_id, AdmissionStatus.CONFLICT)
if conflict_items:
    service.review_item(
        session_id,
        conflict_items[0]['id'],
        "张秘书",
        AdmissionStatus.APPROVED,
        "经核查，该生符合录取条件，同意放行"
    )

# 导出报告
files = service.export_reports(session_id, "./output")
```

## 数据格式说明

### 导师CSV字段
- 导师工号、导师姓名、所属学院、招生专业、职称、总名额、已用名额

### 学生CSV字段
- 考生编号、考生姓名、身份证号、本科专业、本科院校、报考专业、总分、初试成绩、复试成绩

### 志愿JSON字段
```json
{
  "student_id": "S001",
  "supervisor_id": "T001",
  "preference_order": 1,
  "is_cross_major": false
}
```

### 调剂记录JSON字段
```json
{
  "student_id": "S005",
  "from_supervisor_id": null,
  "to_supervisor_id": "T003",
  "adjustment_batch": "ADJUSTMENT_BATCH_1",
  "adjustment_time": "2024-04-15T10:30:00",
  "operator": "研究生院-李老师",
  "reason": "第一志愿未录取，调剂至电子信息学院",
  "source_batch": "第一批调剂"
}
```

## 对账状态说明

| 状态 | 说明 |
|------|------|
| 待审核 | 初始状态，等待人工审核 |
| 已放行 | 审核通过，同意录取 |
| 已退回 | 审核不通过，不予录取 |
| 需补材料 | 需要补充材料后重新审核 |
| 存在冲突 | 自动检测发现问题，需人工确认 |

## 冲突类型说明

| 冲突类型 | 说明 |
|----------|------|
| 导师名额超额 | 分配给导师的学生数超出剩余名额 |
| 跨专业限制 | 学生本科专业与报考专业不一致 |
| 重复录取 | 同一学生有多条录取记录 |
| 专业不匹配 | 学生报考专业与导师招生专业不一致 |
