# 加药泵周校准科学计算工具

一个用于水处理实验室加药泵周校准的科学计算工具，支持数据解析、曲线拟合、异常检测和报告生成。

## 功能特性

- **数据解析**: 自动识别CSV列名，支持中英文混合
- **单位换算**: 流量、浓度、体积、时间等多种单位转换
- **曲线拟合**: 线性、二次、幂函数、指数函数多种模型
- **异常检测**: 残差Z-score、Cook距离、杠杆值、IQR、Grubbs检验
- **推荐泵速计算**: 置信区间、超限风险评估
- **报告导出**: Markdown校准报告、CSV参数表、异常报告

## 项目结构

```
xy4316/
├── main.py                    # 主程序入口
├── data_parser.py             # 数据解析模块
├── units.py                   # 单位换算模块
├── fitting.py                 # 曲线拟合模块
├── anomaly_detection.py       # 异常检测模块
├── report.py                  # 报告导出模块
├── pyproject.toml             # 项目配置
├── data/                      # 示例数据
│   ├── flowmeter.csv          # 流量计数据示例
│   ├── concentration.txt      # 浓度记录示例
│   └── titration.csv          # 滴定结果示例
├── tests/                     # 测试文件
│   ├── test_data_parser.py
│   ├── test_units.py
│   ├── test_fitting.py
│   ├── test_anomaly_detection.py
│   └── test_integration.py
└── output/                    # 输出目录（运行时生成）
```

## 快速开始

### 环境要求

- Python 3.9+
- pip

### 安装依赖

```bash
# 进入项目目录
cd /path/to/xy4316

# 创建虚拟环境（可选但推荐）
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .
```

### 验证安装

运行示例数据测试：

```bash
# 使用示例数据运行演示
python main.py --example

# 使用示例数据运行并显示详细输出
python main.py --example -v
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_integration.py -v

# 查看测试覆盖率
pytest --cov=.
```

## 使用方法

### 命令行参数

```bash
python main.py [选项]

选项：
  --flowmeter FILE       流量计CSV数据文件路径
  --concentration FILE   浓度记录文件路径 (CSV或TXT)
  --titration FILE       滴定结果CSV文件路径
  --target-conc VALUE    目标浓度 (mg/L)，用于计算推荐泵速
  --target-flow VALUE    目标流量 (L/h)，直接指定目标流量
  --model TYPE           拟合模型类型：linear, quadratic, power, exponential (默认: linear)
  --confidence VALUE     置信水平 (默认: 0.95)
  --auto-select-model    自动选择最优拟合模型
  --output DIR           输出目录路径 (默认: ./output)
  --prefix STR           输出文件前缀
  --pump-id STR          泵编号
  --pump-name STR        泵名称
  --operator STR         操作人员
  --example              使用示例数据运行演示
  --verbose, -v          显示详细输出
  --no-report            不生成报告文件
  --no-csv               不导出CSV参数表
```

### 使用示例数据

```bash
# 基本演示
python main.py --example

# 详细输出
python main.py --example -v

# 自定义输出目录
python main.py --example --output ./my_output

# 添加泵信息
python main.py --example --pump-id PUMP-001 --pump-name "PAC加药泵" --operator "张三"
```

### 使用真实数据

```bash
# 使用真实数据文件
python main.py \
  --flowmeter ./data/flowmeter.csv \
  --concentration ./data/concentration.txt \
  --titration ./data/titration.csv \
  --target-conc 5.0 \
  --pump-id PUMP-001 \
  --pump-name "PAC加药泵" \
  -v

# 自动选择最优模型
python main.py \
  --flowmeter ./data/flowmeter.csv \
  --concentration ./data/concentration.txt \
  --auto-select-model \
  -v

# 使用二次曲线模型
python main.py \
  --flowmeter ./data/flowmeter.csv \
  --concentration ./data/concentration.txt \
  --model quadratic \
  -v
```

## 数据文件格式

### 流量计CSV (`flowmeter.csv`)

支持的列名（不区分大小写）：
- 泵速列: 泵速, pump_speed, frequency, 转速, 频率, speed, rpm
- 流量列: 流量, flow_rate, flux, Q
- 时间列: 时间, timestamp, time, 日期 (可选)

示例：
```csv
泵速(Hz),流量(L/h),备注
10.0,1.72,正常
15.0,2.28,正常
20.0,2.91,正常
25.0,4.30,
30.0,4.12,
```

### 浓度记录 (`concentration.txt` 或 `.csv`)

支持的格式：
```text
母液浓度: 10000 mg/L
目标浓度: 5.0 mg/L
流量单位: L/h
溶液体积: 1.0 L
```

或：
```text
母液浓度=10000 mg/L
目标浓度=5.0 mg/L
```

支持的关键字：
- 母液浓度: 母液浓度, stock_concentration, 原液浓度
- 目标浓度: 目标浓度, target_concentration, 设定浓度
- 浓度单位: mg/L, ppm, %, ug/L, g/L 等

### 滴定结果CSV (`titration.csv`)

支持的列名：
- 泵速列: 泵速, pump_speed
- 浓度列: 实测浓度, measured_concentration, 滴定浓度
- 体积列: 取样体积, measured_volume, 滴定液体积, titrant_volume

示例：
```csv
泵速(Hz),实测浓度(mg/L),取样体积(mL),滴定液体积(mL)
20.0,4.8,100.0,12.5
30.0,7.2,100.0,18.8
40.0,9.5,100.0,24.8
```

## 输出文件说明

运行程序后，输出目录会包含以下文件：

### 1. Markdown校准报告 (`{prefix}_calibration_report.md`)

包含内容：
- 基本信息（泵编号、名称、操作人员）
- 数据概览（流量计数据、浓度记录、滴定结果）
- 曲线拟合结果（模型参数、R²、RMSE等）
- 异常检测结果（异常点详情、严重程度）
- 推荐泵速计算（置信区间、超限风险）
- 结论与建议

### 2. CSV参数表 (`{prefix}_calibration_params.csv`)

包含内容：
- 模型参数
- 拟合质量指标
- 数据范围
- 推荐参数（如有）
- 浓度参数

### 3. 异常报告 (`{prefix}_anomalies.csv`)

当检测到异常点时生成，包含：
- 异常检测汇总
- 异常点详情
- 正常点索引

## 模块说明

### data_parser.py - 数据解析

- `DataParser`: 数据解析器类
- `FlowmeterData`: 流量计数据容器
- `ConcentrationRecord`: 浓度记录容器
- `TitrationResult`: 滴定结果容器
- `CalibrationDataset`: 完整校准数据集

### units.py - 单位换算

- `UnitConverter`: 单位转换器
  - 流量: L/h, mL/min, m³/h, GPM 等
  - 浓度: mg/L, ppm, %, ug/L 等
  - 体积: L, mL, m³, 加仑 等
  - 时间: 小时, 分钟, 秒, 天 等

- `DosageCalculator`: 投加量计算器
  - 计算所需流量
  - 计算实际投加量
  - 计算误差

### fitting.py - 曲线拟合

- `PumpFlowModel`: 泵速-流量模型
  - 线性模型: Q = k*S + b
  - 二次模型: Q = a*S² + b*S + c
  - 幂函数模型: Q = a*S^b
  - 指数模型: Q = a*e^(b*S) + c

- `CurveFitter`: 曲线拟合器
  - 模型参数估计
  - 推荐泵速计算
  - 置信区间估计
  - 模型比较与选择

### anomaly_detection.py - 异常检测

- `AnomalyDetector`: 异常检测器
  - 残差Z-score检验
  - Cook距离检验
  - 杠杆值检验
  - IQR方法
  - Grubbs检验

- `AnomalyReport`: 异常报告
- `AnomalyDiagnosis`: 异常诊断

### report.py - 报告导出

- `ReportExporter`: 报告导出器
  - Markdown报告生成
  - CSV参数表导出
  - 异常报告导出
  - 校准摘要生成

## 验证命令清单

```bash
# 1. 安装依赖
pip install -e .

# 2. 运行示例数据演示（快速验证）
python main.py --example

# 3. 运行示例数据演示（详细输出）
python main.py --example -v

# 4. 使用示例数据文件运行
python main.py \
  --flowmeter data/flowmeter.csv \
  --concentration data/concentration.txt \
  --titration data/titration.csv \
  -v

# 5. 运行所有单元测试
pytest

# 6. 运行测试并显示详细信息
pytest -v

# 7. 运行集成测试
pytest tests/test_integration.py -v

# 8. 查看测试覆盖率
pytest --cov=.

# 9. 查看命令行帮助
python main.py --help
```

## 常见问题

### Q: 数据文件无法读取？

A: 确保文件编码为 UTF-8 或 GBK。程序会自动尝试两种编码。

### Q: 列名不识别？

A: 程序支持多种中英文别名。如果仍然无法识别，可使用默认列名：
- 第一列: 泵速
- 第二列: 流量

### Q: 拟合质量差怎么办？

A: 
1. 检查异常点，查看是否需要排除高优先级异常
2. 尝试不同的模型类型 (`--model quadratic`)
3. 使用自动模型选择 (`--auto-select-model`)
4. 增加校准点数量

### Q: 如何确定推荐泵速？

A: 推荐泵速基于以下计算：
1. 根据目标浓度和母液浓度计算所需流量
2. 使用拟合曲线反推泵速
3. 计算置信区间和超限概率

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。
