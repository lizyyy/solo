# 错题等价判分系统

一个用于数学老师和助教进行错题等价判分的轻量工具，支持本地运行。

## 核心特性

- **空集边界检测**：专门处理标准答案或学生答案为空的边界情况
- **争议点标记**：自动标记可疑记录（空集边界、阈值附近、关键词冲突）
- **完整复核流程**：支持人工复核、修正、历史追溯
- **导出一致性**：讲评稿和争议点文件均包含完整追溯信息
- **交接班友好**：记录ID可追溯，无需翻聊天记录

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 命令行使用

```bash
# 导入数据（使用示例数据）
python cli.py import-data

# 执行等价判分
python cli.py score

# 查看统计
python cli.py stats

# 列出争议记录
python cli.py list-records --controversial

# 复核记录
python cli.py review <记录ID> <复核人> <是否等价(True/False)> <最终分数> --reason "复核原因"

# 查看复核历史
python cli.py history <记录ID>

# 导出所有数据（讲评稿、争议点、CSV、JSON）
python cli.py export-all --prefix "高三1班月考"

# 测试单条判分
python cli.py test-score "x = 2" "x=2"
```

### Python API 使用

```python
from equivalent_scoring import ScoringManager, ExportManager

# 初始化
manager = ScoringManager()

# 导入数据
questions = [
    {
        "question_id": "Q001",
        "standard_answer": "x = 2",
        "student_answer": "x=2",
        "student_id": "S001"
    }
]
manager.import_questions(questions)

# 执行判分
total, controversial = manager.run_scoring()

# 查看争议记录详情
controversial_details = manager.get_controversial_details()

# 复核记录
manager.review_record(
    record_id=1,
    reviewer="张老师",
    is_equivalent=True,
    final_score=5.0,
    reason="表述不同但结果正确"
)

# 导出
exporter = ExportManager()
files = exporter.export_all(manager, prefix="月考")
```

## 项目结构

```
.
├── equivalent_scoring/       # 核心模块
│   ├── __init__.py
│   ├── config.py            # 配置
│   ├── models.py            # 数据模型（SQLite）
│   ├── scoring.py           # 等价判分算法
│   ├── manager.py           # 业务管理器
│   └── export.py            # 导出和讲评稿生成
├── data/                    # 数据目录
│   └── sample_questions.json
├── exports/                 # 导出文件目录
├── history/                 # 历史记录目录
├── cli.py                   # 命令行入口
├── test_workflow.py         # 工作流测试脚本
└── requirements.txt
```

## 争议点检测规则

系统自动标记以下情况为争议记录：

1. **空集边界**：标准答案或学生答案为空
2. **灰色区域**：相似度在阈值±10%范围内
3. **关键词冲突**：整体相似度达标但关键词重合度低

## 导出文件说明

执行 `export-all` 后会生成以下文件：

| 文件类型 | 说明 |
|---------|------|
| CSV | 完整判分记录表格 |
| JSON | 结构化数据备份 |
| 讲评稿.txt | 复核讲评稿，含统计、争议点明细、待复核清单、历史追溯 |
| 争议复核.txt | 争议点专用复核表，可打印签字确认 |

## 判分算法

采用多特征融合的轻量算法：

- 结构相似度（40%）：关键数字匹配
- 数学表达式相似度（35%）：公式、符号匹配
- Token相似度（25%）：词汇重合度
- 编辑距离：文本相似度补充

## 配置

可在 `equivalent_scoring/config.py` 中调整：

- `THRESHOLD`：等价判定阈值（默认0.85）
- `EMPTY_SET_THRESHOLD`：空集判定阈值
