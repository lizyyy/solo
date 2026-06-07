# 舆情分类人工改判系统

## 概述

本系统用于舆情分类的人工改判流程，重点关注**脱敏规则备注**的保留与冲突检测。系统不会将备注洗成一行干净数据，而是完整保留原始备注信息，并在工单与备注发生冲突时，列出冲突证据供标注负责人周姐确认或驳回。

## 核心特性

- ✅ **脱敏规则备注完整保留**：备注原样保存，不做清洗，保留原始上下文
- ✅ **冲突证据化展示**：检测到冲突时列出详细证据，不自动替业务拍板
- ✅ **三步核心流程**：导入工单 → 周姐补看备注 → 更新冲突样本表
- ✅ **链接404特殊处理**：引用链接404但工单已通过的，不归为正常，留产品经理复核
- ✅ **基本自检覆盖**：重复导入、链接404检测、补录重算、导出一致性
- ✅ **历史记录完整**：所有操作均可追溯，冲突样本表与历史记录对得上

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 2. 一键运行演示（新人首选）

```bash
python run_demo.py
```

该脚本会自动执行以下完整流程：
1. 导入正常材料、错口径材料、补录材料
2. 周姐审阅脱敏规则备注
3. 检测并生成冲突样本表
4. 演示周姐确认/驳回冲突
5. 运行自检模块
6. 导出所有数据和报告

### 3. 查看输出

运行完成后，查看以下目录：

- `output/` - 导出的业务数据
  - `work_orders.json` - 工单数据
  - `desensitization_remarks.json` - 脱敏规则备注（完整保留）
  - `conflict_samples.json` / `conflict_samples.csv` - 冲突样本表
  - `workflow_summary.json` - 流程汇总
  - `all_history.json` - 完整历史记录

- `reports/` - 自检报告
  - `self_check_report.json` / `self_check_report.csv` - 自检结果

## 三步核心流程详解

### 第一步：导入线上反馈工单

支持三种导入类型：

| 类型 | 说明 | 示例文件 |
|------|------|----------|
| 正常材料 | 常规线上反馈工单 | `data/samples/normal_work_orders.json` |
| 错口径材料 | 分类口径错误的工单 | `data/samples/wrong_caliber_work_orders.json` |
| 补录材料 | 后续补充录入的工单 | `data/samples/supplementary_work_orders.json` |

**关键点**：
- 重复导入会被自动检测并跳过（补录除外）
- 原始数据完整保存在 `original_raw_data` 字段中，不丢失

### 第二步：标注负责人周姐补看脱敏规则备注

导入备注文件：`data/samples/desensitization_remarks.json`

**关键点**：
- 备注内容**原样保存**，不会被清洗或格式化
- 标记为重要（`is_important=true`）的备注会触发更严格的冲突检测
- 审阅人默认是"周姐"

### 第三步：冲突样本表更新

系统自动检测以下冲突类型：

| 冲突类型 | 触发条件 | 处理人 |
|----------|----------|--------|
| 分类不符 | 备注中提到"分类错误/分类不符" | 周姐确认/驳回 |
| 脱敏规则冲突 | 重要备注要求谨慎处理，但工单已标记完成 | 周姐确认/驳回 |
| 引用链接404 | 工单引用了无效链接但已标记通过 | **产品经理复核** |

**关键点**：
- 冲突检测后状态为 `pending_confirm`（待确认）
- 系统只列证据，不自动确认，必须由周姐人工确认或驳回
- 链接404冲突状态为 `need_product_review`，不归入正常流程

## 冲突处理流程

### 查看待确认冲突

```python
from core import WorkflowEngine

engine = WorkflowEngine()
# ... 导入数据后 ...
pending = engine.list_pending_conflicts()
for conflict in pending:
    print(f"冲突ID: {conflict['conflict_id']}")
    print(f"证据: {conflict['evidence']}")
```

### 周姐确认冲突

```python
engine.confirm_conflict(
    conflict_id="CONF_xxx",
    operator="周姐",
    notes="经核实，分类确实错误"
)
```

### 周姐驳回冲突

```python
engine.reject_conflict(
    conflict_id="CONF_xxx",
    operator="周姐",
    notes="经核实，分类正确，备注描述有误"
)
```

## 自检模块

系统内置5项自检，覆盖最容易出错的点：

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| 重复导入检测 | 检查是否有重复导入的工单 | error |
| 引用链接404仍被判通过 | 检查已完成工单是否引用了无效链接 | warning |
| 补录后重算检测 | 检查补录工单是否触发了重算逻辑 | warning |
| 导出一致性检测 | 检查备注、冲突是否都有关联的工单 | error |
| 冲突样本表与历史记录一致性 | 检查工单状态与冲突状态是否匹配 | warning |

运行自检：

```python
report = engine.run_self_check()
print(f"通过: {report['summary']['passed']}/{report['summary']['total']}")
```

## 数据格式说明

### 工单数据格式 (JSON/CSV)

```json
{
  "id": "WO_001",
  "title": "工单标题",
  "content": "工单内容",
  "category": "分类",
  "source": "来源",
  "feedback_time": "2026-06-01T10:30:00",
  "reference_links": "url1|url2",
  "original_note": "原始备注，会完整保留"
}
```

### 脱敏规则备注格式

```json
{
  "id": "DR_001",
  "work_order_id": "WO_001",
  "remark_content": "完整的备注内容，不会被清洗",
  "owner": "周姐",
  "create_time": "2026-06-01T15:00:00",
  "tags": "隐私|敏感数据",
  "is_important": "true",
  "related_rules": "R001|R003"
}
```

## 项目结构

```
.
├── models/                 # 数据模型
│   ├── work_order.py      # 工单模型
│   ├── desensitization_remark.py  # 脱敏规则备注模型
│   ├── conflict_sample.py # 冲突样本模型
│   └── history_record.py  # 历史记录模型
├── core/                   # 核心业务逻辑
│   ├── importer.py        # 数据导入模块
│   ├── conflict_detector.py  # 冲突检测
│   ├── conflict_resolver.py  # 冲突处理
│   ├── workflow.py        # 三步流程引擎
│   └── self_check.py      # 自检模块
├── utils/                  # 工具函数
│   ├── file_utils.py      # 文件读写
│   ├── link_checker.py    # 链接有效性检测
│   └── id_generator.py    # ID生成
├── data/
│   └── samples/           # 样例数据
├── output/                # 导出数据（运行后生成）
├── reports/               # 自检报告（运行后生成）
├── run_demo.py            # 一键演示脚本
├── requirements.txt       # 依赖
└── README.md              # 本文档
```

## 常见问题

### Q: 脱敏规则备注会被清洗吗？
不会。系统会完整保留备注的原始内容，存储在 `remark_content` 字段中，不会做任何格式化或提取。

### Q: 系统会自动处理冲突吗？
不会。所有冲突都会列出详细证据，由周姐确认或驳回。特别是链接404的冲突，会标记为 `need_product_review` 留给产品经理复核，系统不会自动归为正常。

### Q: 历史记录和冲突样本表能对上吗？
能。所有操作（导入、检测、确认、驳回）都会生成历史记录，自检模块也会验证两者的一致性。

### Q: 补录材料怎么处理？
补录导入会更新已存在的工单，同时保留原始导入时间，并触发重算检测。
