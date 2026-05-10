# 咖啡豆烘焙曲线复盘 CLI

帮助咖啡烘焙师比较多次烘焙曲线、一爆时间和杯测分数来复盘配方的命令行工具。

## 核心业务闭环

1. **曲线导入** - 导入 CSV/JSON 格式的烘焙曲线数据
2. **一爆标记** - 自动检测或手动标记一爆时间点
3. **升温率计算** - 分析烘焙过程中的升温速率
4. **杯测关联** - 将杯测分数与烘焙批次关联
5. **批次对比** - 对比多个批次的关键参数
6. **复盘报告** - 生成包含表格、图表和建议的完整报告

## 快速开始

### 环境要求

- Python 3.9+

### 安装

```bash
# 安装依赖
pip install -e .

# 安装开发依赖（用于运行测试）
pip install -e ".[dev]"
```

### 启动命令

```bash
# 查看帮助
roast --help

# 查看子命令帮助
roast import --help
roast first-crack --help
roast cup-score --help
```

## 样例数据位置

项目提供了样例数据文件，位于 `samples/` 目录：

```
samples/
├── batch_001_ideal.json        # 理想烘焙批次（正常一爆）
├── batch_002_early_fc.json     # 过早一爆批次
├── batch_003_late_fc.json      # 过晚一爆批次
├── batch_004_no_fc.csv         # 无标记批次（CSV格式）
└── cup_scores_example.csv      # 杯测分数示例
```

## 主流程演示

### 1. 导入样例数据

```bash
# 导入单个 JSON 文件
roast import file samples/batch_001_ideal.json

# 导入整个目录的所有文件
roast import dir samples/
```

**预期输出：**
```
✓ batch_001_ideal: 埃塞俄比亚 耶加雪菲 水洗
✓ batch_002_early_fc: 埃塞俄比亚 耶加雪菲 水洗
✓ batch_003_late_fc: 埃塞俄比亚 耶加雪菲 水洗
✓ batch_004_no_fc: 哥伦比亚 苏普雷莫 水洗

共导入 4 个批次
```

### 2. 查看导入的批次

```bash
# 列表视图
roast list

# 详细信息
roast show batch_001_ideal
```

### 3. 标记一爆（如未标记）

```bash
# 自动检测一爆
roast first-crack detect batch_004_no_fc

# 或手动标记一爆
roast first-crack mark batch_004_no_fc --time 540 --temp 198

# 验证一爆标记
roast first-crack validate batch_001_ideal
```

**预期输出（自动检测）：**
```
✓ 自动检测到一爆:
  时间: 9:00 (540s)
  温度: 198°C
  类型: normal
  备注: 自动检测，置信度: XX%
```

### 4. 关联杯测分数

```bash
# 从文件导入杯测分数
roast cup-score import batch_004_no_fc samples/cup_scores_example.csv

# 或手动添加杯测分数
roast cup-score add batch_004_no_fc \
  --aroma 8.5 --flavor 8.2 --aftertaste 8.0 \
  --acidity 8.3 --body 8.5 --balance 8.0 \
  --uniformity 8.8 --overall 8.2
```

### 5. 分析升温率

```bash
# 分析单个批次升温率
roast analyze batch_001_ideal

# 分析所有批次
roast analyze --all
```

**预期输出：**
```
┌───────────────────────────┐
│       升温率剖面          │
└───────────────────────────┘
┏━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓
┃ 批次        ┃ 峰值升温率     ┃ 一爆前平均     ┃ 一爆后平均     ┃ 异常数   ┃
┡━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━┩
│ batch_001    │ 0.450          │ 0.280          │ 0.150          │ 0        │
└──────────────┴────────────────┴────────────────┴────────────────┴──────────┘
```

### 6. 对比多个批次

```bash
# 对比多个批次
roast compare batch_001_ideal batch_002_early_fc batch_003_late_fc
```

**预期输出：**
```
┌─────────────────────────────────────────────────────────┐
│ 对比批次: batch_001_ideal, batch_002_early_fc, batch_003 │
└─────────────────────────────────────────────────────────┘
┏━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━┓
┃ 批次            ┃ 烘焙时间   ┃ 出炉温    ┃ 一爆时间   ┃ 一爆温  ┃ 一爆类型 ┃ 杯测分  ┃
┡━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━┩
│ batch_001_ideal │ 12:00      │ 214.0     │ 9:00       │ 198.0   │ normal   │ 71.3    │
│ batch_002_early │ 9:00       │ 214.0     │ 6:00       │ 192.0   │ early    │ 53.8    │
│ batch_003_late  │ 16:00      │ 218.0     │ 13:00      │ 202.0   │ late     │ 56.0    │
└─────────────────┴────────────┴───────────┴────────────┴─────────┴──────────┴─────────┘

[HIGH] batch_002_early_fc: 一爆发生过早 (时间比例: 66.7%)
[MEDIUM] batch_003_late_fc: 一爆发生过晚 (时间比例: 81.2%)

建议:
1. 最高分批次: batch_001_ideal (杯测分数: 71.3)，建议将其作为参考配方
2. 批次间一爆时间比例差异较大，建议稳定一爆出现时机
```

### 7. 生成复盘报告

```bash
# 生成包含图表的完整报告
roast report --all --report-id demo_report

# 生成 JSON 格式报告
roast report --all --format json

# 不生成图表
roast report --all --no-charts
```

**预期输出：**
```
正在生成报告 (共 4 个批次)...

✓ 报告已生成:
  文件: ./reports/demo_report.txt

图表文件:
  - ./reports/demo_report_temperature_curves.png
  - ./reports/demo_report_heating_rates.png
  - ./reports/demo_report_cup_scores.png

摘要:
  总批次数: 4
  有一爆标记: 4
  有杯测分数: 4

检测到 3 个异常
生成 5 条建议
```

### 8. 分析烘焙参数与杯测分数相关性

```bash
roast correlate --all
```

**预期输出：**
```
┌─────────────────────────────────────────┐
│ 相关性分析 (4 个批次)                   │
└─────────────────────────────────────────┘
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
┃ 因素              ┃ 相关系数       ┃ 解释       ┃
┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━┩
│ 一爆起始温度       │ 0.950          │ 强正相关    │
│ 一爆时间比例       │ 0.820          │ 强正相关    │
│ 出炉温度           │ 0.750          │ 中等正相关  │
│ 减重比例           │ -0.600         │ 中等负相关  │
└───────────────────┴────────────────┴────────────┘

洞察:
- 一爆起始温度与杯测分数呈正相关 (r=0.950)，建议优化此参数可能提升杯测质量
```

## 异常操作演示

### 异常操作 1: 导入不存在的文件

```bash
roast import file nonexistent.json
```

**输出（错误提示）：**
```
导入失败: 文件不存在: nonexistent.json
```

### 异常操作 2: 标记一爆温度超出范围

```bash
roast first-crack mark batch_001_ideal --time 540 --temp 100
```

**输出（错误提示）：**
```
标记失败: 一爆起始温度异常: 100.0°C。正常范围: 185.0-220.0°C
```

### 异常操作 3: 杯测分数超出范围

```bash
roast cup-score add batch_001_ideal \
  --aroma 11.0 --flavor 8.2 --aftertaste 8.0 \
  --acidity 8.3 --body 8.5 --balance 8.0 \
  --uniformity 8.8 --overall 8.2
```

**输出（错误提示）：**
```
添加失败: 杯测分数必须在 0-10 之间: 香气: 11.0
```

### 异常操作 4: 一爆结束时间早于开始时间

```bash
roast first-crack mark batch_001_ideal --time 600 --end-time 500 --temp 198
```

**输出（错误提示）：**
```
标记失败: 一爆结束时间必须晚于开始时间
```

### 异常操作 5: 不存在的批次操作

```bash
roast show nonexistent_batch
```

**输出（错误提示）：**
```
错误: 批次 'nonexistent_batch' 不存在
```

### 异常操作 6: 生成报告时无批次

```bash
roast report --all  # 先清除所有批次数据
```

**输出（错误提示）：**
```
没有找到任何批次
```

## 计算口径说明

### 一爆检测
- **温度范围**: 185-220°C
- **时间比例判断**:
  - 过早 (early): 一爆时间 < 总时间的 50%
  - 正常 (normal): 一爆时间占总时间的 55-75%
  - 过晚 (late): 一爆时间 > 总时间的 80%

### 升温率计算
- **计算方法**: 30秒滑动窗口，单位 °C/s
- **阈值判断**:
  - 升温过快: > 1.5°C/s
  - 正常范围: 0.05-1.0°C/s
  - 停滞/降温: < -0.1°C/s

### 杯测评分
- **标准**: 简化版 SCAA 杯测标准（8 维度）
- **维度**: 香气、风味、余韵、酸质、醇厚度、平衡、一致性、整体（各 0-10 分）
- **总分**: 各维度分数之和 - 缺陷分（满分 80 分）
- **等级划分**:
  - Excellent: 72+ (90%+ of 80)
  - Very Good: 68-71.99 (85%+)
  - Good: 64-67.99 (80%+)
  - Average: 56-63.99 (70%+)
  - Below Average: < 56

### 减重比例
- **公式**: (1 - 熟豆重 / 生豆重) × 100%
- **正常范围**: 10-18%

### 相关性分析
- **方法**: Pearson 相关系数
- **解释**:
  - 强相关: |r| >= 0.8
  - 中等相关: 0.5 <= |r| < 0.8
  - 弱相关: 0.3 <= |r| < 0.5
  - 几乎无相关: |r| < 0.3

## 数据文件格式

### JSON 格式

```json
{
  "batch_id": "batch_001",
  "coffee_name": "埃塞俄比亚 耶加雪菲",
  "origin": "Ethiopia, Yirgacheffe",
  "process_method": "水洗",
  "green_weight_g": 300,
  "roasted_weight_g": 255,
  "roast_date": "2026-05-01T10:00:00",
  "first_crack": {
    "start_time_seconds": 540,
    "start_temp": 198,
    "end_time_seconds": 590,
    "end_temp": 205,
    "intensity": "medium"
  },
  "cup_score": {
    "aroma": 9.0,
    "flavor": 9.2,
    "aftertaste": 8.8,
    "acidity": 8.5,
    "body": 8.3,
    "balance": 9.0,
    "uniformity": 9.5,
    "overall": 9.0,
    "defects": 0.0
  },
  "curve_points": [
    {"time_seconds": 0, "bean_temp": 25},
    {"time_seconds": 30, "bean_temp": 85},
    {"time_seconds": 60, "bean_temp": 110}
  ]
}
```

### CSV 格式

```csv
batch_id,batch_004
coffee_name,哥伦比亚 苏普雷莫
origin,Colombia
process_method,水洗
green_weight_g,300
roasted_weight_g,245

时间(秒),豆温(°C),排气温(°C)
0,25,25
30,75,90
60,105,125
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=roast_review

# 运行特定测试文件
pytest tests/test_models.py
```

## 项目结构

```
roast_review/
├── __init__.py           # 包初始化
├── models.py             # 数据模型定义
├── cli.py                # CLI 入口
├── curve_importer.py     # 曲线导入
├── first_cracker.py      # 一爆标记
├── heating_rate.py       # 升温率计算
├── cupping_analyzer.py   # 杯测分析
├── batch_comparator.py   # 批次对比
└── report_generator.py   # 报告生成

tests/                    # 测试文件
samples/                  # 样例数据
reports/                  # 报告输出目录
```

## 核心辨识度

本工具的核心价值在于将 **咖啡烘焙的三个关键要素关联起来**:

1. **烘焙曲线** - 温度随时间变化的数据
2. **一爆时间点** - 咖啡豆内部化学反应的关键转折点
3. **杯测分数** - 最终产品的感官评价

通过分析这三者之间的关系，帮助烘焙师：
- 发现最佳烘焙参数组合
- 识别异常批次的根本原因
- 建立可重复的优质配方
