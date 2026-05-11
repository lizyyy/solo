# 环卫车辆油耗异常分析CLI

一个用于分析环卫车辆油耗数据、检测异常并生成报告的命令行工具。

## 功能特性

- **数据质量校验**：自动检测重复数据、缺失字段、异常负值
- **油耗智能分析**：结合路线里程、载重、怠速时间计算期望油耗
- **多维度异常检测**：
  - 重复数据识别
  - 缺失字段检测
  - 人工改错识别
  - 油耗-里程不匹配
  - 油耗-载重不匹配
  - 油耗-怠速不匹配
- **多格式报告生成**：控制台表格、Excel报表、CSV文件
- **详细计算口径说明**：报告中包含完整的计算公式和参数说明

## 快速开始

### 1. 环境准备

首先确保你的电脑已安装 Python 3.9 或更高版本。

**步骤 1：打开终端**
- Mac用户：按 `Cmd + 空格`，输入 "Terminal" 后回车
- Windows用户：按 `Win + R`，输入 "cmd" 后回车

**步骤 2：进入项目目录**
```bash
cd /Users/lzy/pro/solo/workspaces/zy70278
```

**步骤 3：安装依赖**
```bash
pip install -r requirements.txt
```

或者使用 Python 模块方式直接运行（无需安装）。

### 2. 一键演示（推荐）

运行完整演示流程，自动生成样例数据并执行分析：

```bash
python -m fuel_analyzer.cli demo
```

执行后你将看到：
- ✅ 生成5种样例数据（正常数据、重复数据、缺失字段、人工改错、综合异常）
- ✅ 执行完整的数据分析流程
- ✅ 在控制台显示详细的分析报告
- ✅ 在 `reports/` 目录生成 Excel 和 CSV 报告

### 3. 逐步操作指南

#### 3.1 查看工具信息

```bash
python -m fuel_analyzer.cli info
```

显示功能特性、计算口径和异常阈值说明。

#### 3.2 生成样例数据

**生成正常数据：**
```bash
python -m fuel_analyzer.cli generate --type normal
```

**生成含重复数据的样例：**
```bash
python -m fuel_analyzer.cli generate --type duplicates
```

**生成含缺失字段的样例：**
```bash
python -m fuel_analyzer.cli generate --type missing
```

**生成含人工改错的样例：**
```bash
python -m fuel_analyzer.cli generate --type manual
```

**生成所有类型的样例：**
```bash
python -m fuel_analyzer.cli generate-all
```

#### 3.3 分析数据

**分析综合异常样例：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_all_anomalies.csv
```

**仅生成控制台报告：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_duplicates.csv --format console
```

**生成Excel报告：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_missing_fields.csv --format excel
```

**指定输出目录：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_normal.csv -o ./my_reports
```

### 4. 命令参数说明

| 命令 | 功能 | 参数说明 |
|------|------|----------|
| `analyze` | 分析油耗数据 | `input_file` - 输入文件路径<br>`-o, --output-dir` - 输出目录<br>`-f, --format` - 报告格式（console/excel/csv/all） |
| `generate` | 生成单类型样例 | `-t, --type` - 样例类型<br>`-o, --output` - 输出目录<br>`-d, --days` - 生成天数 |
| `generate-all` | 生成所有类型样例 | `-o, --output` - 输出目录<br>`-d, --days` - 生成天数 |
| `demo` | 完整演示流程 | 无参数 |
| `info` | 显示工具信息 | 无参数 |

## 样例数据说明

项目自带5种样例数据，位于 `samples/` 目录：

| 文件名 | 说明 | 包含异常 |
|--------|------|----------|
| `sample_normal.csv` | 正常数据 | 无 |
| `sample_duplicates.csv` | 含重复数据 | 5条重复记录 |
| `sample_missing_fields.csv` | 含缺失字段 | 油耗、里程、载重、怠速等字段缺失 |
| `sample_manual_errors.csv` | 含人工改错 | 油耗放大5倍、缩小5倍、里程缩小10倍、载重放大3倍等 |
| `sample_all_anomalies.csv` | 综合异常数据 | 包含所有类型异常 |

## 计算口径

### 核心公式

**百公里油耗** = 实际油耗(L) ÷ 路线里程(km) × 100

**期望油耗** = 基础油耗 + 载重影响 + 怠速影响

**基础油耗** = 路线里程 × 车型基准油耗系数

**载重影响** = (载重 ÷ 1000) × 载重敏感系数 × 路线里程

**怠速影响** = 怠速时间 × 怠速油耗系数

**油耗偏差** = (实际油耗 - 期望油耗) ÷ 期望油耗 × 100%

### 车型基准参数

| 车型 | 基准油耗 | 基准载重 | 基准怠速 | 载重敏感系数 | 怠速油耗系数 |
|------|----------|----------|----------|--------------|--------------|
| 垃圾清运车 | 0.55 L/km | 6,000 kg | 45 min | 0.08 | 0.12 L/min |
| 道路清扫车 | 0.58 L/km | 3,500 kg | 60 min | 0.05 | 0.15 L/min |
| 洒水车 | 1.10 L/km | 9,000 kg | 30 min | 0.10 | 0.10 L/min |

### 异常判定阈值

| 异常类型 | 判定条件 |
|----------|----------|
| 油耗异常 | 油耗偏差 > ±30% |
| 百公里油耗异常 | > 0.9 L/km 或 < 0.2 L/km |
| 路线里程异常 | 里程系数 < 0.6 或 > 1.4 |
| 载重异常 | 载重系数 < 0.3 或 > 2.0 |
| 怠速异常 | 怠速系数 < 0.2 或 > 3.0 |

## 报告内容说明

### Excel报告结构

生成的Excel报告包含以下工作表：

| 工作表名 | 内容 |
|----------|------|
| 概览 | 数据总览、统计指标 |
| 数据质量问题 | 重复数据、缺失字段列表 |
| 油耗分析详情 | 每条记录的油耗分析结果 |
| 异常记录 | 检测到的所有异常及建议 |
| 计算口径 | 计算公式、车型参数 |
| 原始数据 | 完整的原始数据 |

### 控制台报告内容

控制台显示的报告包含：

1. **数据概览** - 总记录数、有效记录数、异常数
2. **数据质量问题** - 重复、缺失、负值统计
3. **油耗分析统计** - 平均偏差、百公里油耗等
4. **异常类型分布** - 各类异常数量统计
5. **异常严重程度** - 严重程度分布
6. **异常详情** - 前10条异常的详细信息
7. **计算口径说明** - 完整的计算公式

## 业务验收步骤

### 验收场景1：正常数据分析

**操作命令：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_normal.csv
```

**预期结果：**
- ✅ 无重复数据
- ✅ 无缺失字段
- ✅ 无人工编辑标记
- ✅ 油耗偏差在合理范围
- ✅ 异常率为0%或极低

### 验收场景2：重复数据检测

**操作命令：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_duplicates.csv --format console
```

**预期结果：**
- ✅ 检测到5条重复数据
- ✅ 显示原始记录ID和重复记录ID
- ✅ 建议删除重复记录

### 验收场景3：缺失字段检测

**操作命令：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_missing_fields.csv
```

**预期结果：**
- ✅ 检测到缺失字段
- ✅ 区分关键字段缺失（严重）和普通字段缺失（中等）
- ✅ 提示需要补充哪些字段

### 验收场景4：人工改错识别

**操作命令：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_manual_errors.csv
```

**预期结果：**
- ✅ 检测到6条人工编辑记录
- ✅ 识别可疑关键词（异常、放大、缩小、清零等）
- ✅ 油耗偏差明显超出正常范围
- ✅ 建议核实人工修改原因

### 验收场景5：综合异常分析

**操作命令：**
```bash
python -m fuel_analyzer.cli analyze samples/sample_all_anomalies.csv -f excel
```

**预期结果：**
- ✅ 同时检测到重复、缺失、人工编辑、油耗异常
- ✅ 生成完整的Excel报告
- ✅ 按严重程度分级显示
- ✅ 提供具体的处理建议

## 项目结构

```
.
├── fuel_analyzer/          # 主代码目录
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── data_loader.py     # 数据加载和样例生成
│   ├── validator.py       # 数据校验器
│   ├── analyzer.py        # 油耗分析引擎
│   ├── anomaly_detector.py # 异常检测器
│   ├── reporter.py        # 报告生成器
│   └── cli.py             # CLI命令入口
├── samples/               # 样例数据目录
│   ├── sample_normal.csv
│   ├── sample_duplicates.csv
│   ├── sample_missing_fields.csv
│   ├── sample_manual_errors.csv
│   └── sample_all_anomalies.csv
├── reports/               # 报告输出目录
├── requirements.txt       # 依赖列表
└── pyproject.toml         # 项目配置
```

## 常见问题

**Q: 如何安装Python？**
- Mac用户：推荐使用 Homebrew 安装 `brew install python`
- 或从官网下载：https://www.python.org/downloads/

**Q: pip命令找不到怎么办？**
- 尝试使用 `python3 -m pip` 替代 `pip`
- 或 `pip3`

**Q: 生成的Excel报告在哪里？**
- 默认在 `reports/` 目录
- 文件名格式：`fuel_analysis_report_YYYYMMDD_HHMMSS.xlsx`

**Q: 如何查看生成的CSV报告？**
- 可用Excel打开CSV文件
- 或用文本编辑器（如记事本、VS Code）查看

**Q: 如何调整异常检测的阈值？**
- 修改 `fuel_analyzer/analyzer.py` 中的 `anomaly_thresholds`
- 或联系技术支持定制参数

## 技术支持

如遇问题，请检查：
1. Python版本是否 ≥ 3.9
2. 所有依赖是否正确安装
3. 输入文件格式是否为CSV或Excel
4. 输入文件是否包含必要字段

必要字段列表：
`record_id, vehicle_id, vehicle_type, plate_number, date, fuel_consumption, route_mileage, load_weight, idle_time, driver_name, route_name`