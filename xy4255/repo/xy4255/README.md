# titration-tool - 酸碱滴定数据处理工具

一个用于高校化学教学实验室的酸碱滴定数据处理CLI工具，支持多组CSV曲线的等当点识别、坏数据剔除和缓冲液配方自动计算。

## 功能特性

- **init**: 创建实验配置文件，定义分析参数和可用母液
- **import**: 批量导入多组滴定CSV，校验数据完整性和有效性
- **fit**: 空白校正、数据平滑、等当点自动识别、离群点标记
- **buffer**: 根据目标pH、体积和可用母液反算缓冲液配方，容量风险提示
- **report**: 导出Markdown报告、CSV结果表和JSON审计包

## 安装

```bash
pip install -e .
```

## 快速开始 - 临时目录验证全流程

### 1. 准备工作目录

```bash
mkdir -p /tmp/titration_demo && cd /tmp/titration_demo
```

### 2. 初始化实验配置

```bash
titration init
```

这会在当前目录创建 `experiment_config.yaml`，包含默认的分析参数和常用母液配置。

查看配置：
```bash
cat experiment_config.yaml
```

### 3. 准备示例数据

工具自带示例滴定数据，复制到工作目录：

```bash
# 查看示例数据位置（安装后可通过以下命令查看）
python -c "import titration_tool.examples; print(titration_tool.examples.__file__)"
```

或者直接创建示例CSV文件：

**sample_001.csv - 强酸滴定强碱（正常数据
```csv
样品编号,S001
温度(°C),25.0
体积(mL),pH
0.00,13.00
1.00,12.89
2.00,12.76
3.00,12.60
4.00,12.40
5.00,12.15
6.00,11.83
7.00,11.40
8.00,10.80
9.00,9.90
9.50,9.10
9.80,8.30
9.90,7.90
9.95,7.40
10.00,7.00
10.05,6.60
10.10,6.10
10.20,5.70
10.50,5.10
11.00,4.60
12.00,4.10
13.00,3.80
14.00,3.60
15.00,3.45
```

**sample_002.csv - 弱酸滴定（含一个离群点）
```csv
样品编号,S002
温度(°C),24.8
体积(mL),pH
0.00,4.75
1.00,4.82
2.00,4.90
3.00,5.00
4.00,5.15
5.00,5.35
6.00,5.60
7.00,5.90
8.00,6.30
9.00,6.90
9.50,7.50
9.80,8.20
9.90,8.70
9.95,3.00
10.00,9.50
10.05,9.90
10.10,10.20
10.20,10.45
10.50,10.70
11.00,10.90
12.00,11.10
13.00,11.25
14.00,11.35
15.00,11.45
```

**sample_003.csv - 空白滴定
```csv
样品编号,BLANK
温度(°C),25.1
体积(mL),pH
0.00,7.00
1.00,6.95
2.00,6.90
3.00,6.85
4.00,6.80
5.00,6.75
6.00,6.70
7.00,6.65
8.00,6.60
9.00,6.55
10.00,6.50
11.00,6.45
12.00,6.40
13.00,6.35
14.00,6.30
15.00,6.25
```

将这些内容保存为CSV文件，或者直接使用工具自带的示例：

```bash
python -c "
from titration_tool.examples import copy_examples_to
copy_examples_to('/tmp/titration_demo')
"
```

### 4. 导入数据

```bash
titration import *.csv
```

查看导入结果：
```bash
cat import_results.json
```

### 5. 拟合分析

```bash
titration fit --blank BLANK --output fitted_results.json
```

查看拟合结果：
```bash
cat fitted_results.json
```

### 6. 缓冲液配方计算

示例：配置500mL pH=7.4的磷酸盐缓冲液

```bash
titration buffer --ph 7.4 --volume 500 --output buffer_formula.json
```

或者查看所有可用缓冲体系：
```bash
titration buffer --list-systems
```

### 7. 生成报告

```bash
titration report --fitted fitted_results.json --buffer buffer_formula.json --output ./report
```

查看生成的文件：
```bash
ls -la report/
cat report/experiment_report.md
```

## 完整命令参考

### init - 初始化实验配置

```bash
titration init [--output <config.yaml>]
```

创建包含以下配置的YAML文件：
- 分析参数（平滑窗口、等当点检测阈值等）
- 可用母液清单（浓度、pKa值等）
- 缓冲体系定义

### import - 导入滴定数据

```bash
titration import <file1.csv> <file2.csv> ... [--output <results.json>]
```

校验内容：
- 必需列：体积(mL)、pH
- 可选列：样品编号、温度(°C)
- 数据类型校验
- 异常值检测

### fit - 拟合分析

```bash
titration fit [--data <imported.json>] [--blank <样品名>] [--output <fitted.json>]
```

处理步骤：
1. 空白校正（如提供空白样品）
2. Savitzky-Golay平滑
3. 一阶/二阶导数法找等当点
4. IQR离群点检测
5. 结果统计

### buffer - 缓冲液配方

```bash
titration buffer --ph <目标pH> --volume <体积mL> [--system <体系名>] [--output <配方.json>]
```

功能：
- Henderson-Hasselbalch方程计算
- 考虑温度校正
- 缓冲容量评估
- 超出容量风险提示

### report - 生成报告

```bash
titration report --fitted <fitted.json> [--buffer <配方.json>] --output <目录>
```

输出：
- `experiment_report.md` - Markdown格式报告
- `results_summary.csv` - 结果汇总表
- `audit_trail.json` - JSON审计包
- 可选：滴定曲线图

## 数据格式要求

CSV文件格式示例：
```csv
样品编号,S001
温度(°C),25.0
体积(mL),pH
0.00,13.00
1.00,12.89
...
```

或标准表格格式：
```csv
体积(mL),pH,样品编号,温度(°C)
0.00,13.00,S001,25.0
1.00,12.89,S001,25.0
...
```

## 依赖

- Python >= 3.8
- numpy >= 1.20.0
- scipy >= 1.7.0
- pandas >= 1.3.0
- matplotlib >= 3.4.0

## 开发

运行测试：
```bash
python -m pytest tests/ -v
```

## 许可证

MIT License
