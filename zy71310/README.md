# 光栅衍射测波长 - 实验分析工具

> 用于大学物理实验课的衍射波长反推与智能评阅工具

## 🚀 快速开始

### 1. 先跑什么 - 30秒上手

```bash
# 运行正常示例（看完整流程）
python main.py

# 运行含异常示例（演示错误检测）
python main.py --anomaly

# 运行测试套件
python test_grating_analyzer.py

# 查看帮助
python main.py --help
```

### 2. 再看哪里 - 输出目录结构

```
output/
├── charts/                     # 可视化图表
│   ├── fringe_positions.png    # 条纹位置分布图
│   ├── wavelength_comparison.png # 波长结果对比图（带误差棒）
│   ├── error_contribution.png  # 误差来源分析图
│   └── grating_diagram.png     # 光栅衍射原理图
└── reports/                    # 分析报告
    ├── report.html             # 网页版报告（首选！）
    ├── report.md               # Markdown版报告
    └── report.json             # 完整数据（可追溯）
```

**推荐先打开 `output/reports/report.html` 查看完整分析结果！**

## 🎯 核心功能

| 模块 | 功能 | 文件 |
|------|------|------|
| 数据模型 | 所有数据可追溯 | [models.py](models.py) |
| 衍射计算 | 光栅方程 + 波长反推 | [diffraction.py](diffraction.py) |
| 误差传播 | 不确定度计算 | [error_propagation.py](error_propagation.py) |
| 异常检测 | 智能错误定位 | [anomaly_detector.py](anomaly_detector.py) |
| 可视化 | 专业图表生成 | [visualization.py](visualization.py) |
| 报告生成 | 多格式报告输出 | [report_generator.py](report_generator.py) |

## 🔍 三大难点检测

工具会自动检测以下常见学生错误：

1. **级次混淆** - 条纹级数错（如k=1记成k=2）
2. **角度单位错** - 度/弧度/弧分混淆
3. **条纹缺失** - 漏测某级条纹、零级缺失

检测结果会在报告中高亮显示，并提供修正建议。

## 📝 代码调用示例

```python
from main import create_student_record_from_input, analyze_student_record

# 1. 准备学生数据
fringes = [
    (0, "center", 0.0, 0.0005),      # (级次, 侧别, 位置, 不确定度)
    (-1, "left", -0.245, 0.0005),
    (1, "right", 0.245, 0.0005),
    (-2, "left", -0.495, 0.0005),
    (2, "right", 0.495, 0.0005),
]

# 2. 创建学生记录
record = create_student_record_from_input(
    student_name="张三",
    student_id="2024001001",
    grating_constant=1.0/300*1e-3,  # 300线/mm光栅
    screen_distance=1.5,              # 屏距1.5m
    fringes_data=fringes,
    reference_wavelength=546.1e-9,    # 汞灯绿线参考值
)

# 3. 完整分析
report = analyze_student_record(record, output_dir="output")
```

## 🔗 数据可追溯性

**每一步输入和输出都能追到来源：**

- 所有数据对象都有唯一 `source_id`
- 包含 `parent_ids` 追溯计算链
- 报告中可展开每一步的详细追溯信息
- JSON报告包含完整溯源数据

## 📋 完整流程

```
学生输入数据
    ↓
[1] 衍射计算（光栅方程反推波长）
    ↓ 输出: 各级次波长结果
[2] 误差传播（不确定度合成）
    ↓ 输出: 带不确定度的最终波长
[3] 异常检测（智能查错）
    ↓ 输出: 异常列表 + 修正建议
[4] 可视化（4种图表）
    ↓ 输出: PNG图表文件
[5] 报告生成（3种格式）
    ↓
完整实验报告
```

## 🧪 测试

```bash
# 运行所有测试
python test_grating_analyzer.py -v
```

包含16个测试用例，覆盖所有核心模块。

---

*助教：先看HTML报告的异常检测部分，快速定位学生哪一步错了！*
