# 梁板应变漂移校准器

一款专为土木实验室设计的科学计算命令行工具，用于处理桥梁模型加载试验中的应变数据校准、时间对齐和结构分析。

## 功能特性

- **数据导入**: 支持多采集仪CSV导入，保留原始文件不覆盖
- **智能解析**: 自动识别时间列、应变片、位移计、温度传感器，支持多种时间格式
- **数据校验**: 检查字段缺失、时间倒序、重复时间戳、采样频率不一致等问题
- **零点校准**: 根据空载区间自动进行零点漂移校正
- **温度补偿**: 基于温度传感器数据进行应变温度补偿
- **时间对齐**: 多采集仪数据时间轴对齐，支持线性插值
- **结构分析**: 自动计算峰值应变、残余变形、曲率、中性轴位置和弯矩估算
- **风险识别**: 检测超限、滞回异常、卸载不回零、相邻测点变化突跳等风险
- **报告导出**: 生成Markdown试验报告、清洗后的CSV和JSON计算结果
- **历史追溯**: 记录所有导入、校准、分析操作，支持历史查询

## 安装方式

### 环境要求

- Python 3.9+
- pip 或 pipenv

### 安装步骤

```bash
# 克隆或下载项目到本地
cd xy4035

# 使用pip安装（开发模式）
pip install -e .

# 或者安装所有依赖（包括开发依赖）
pip install -e ".[dev]"
```

### 验证安装

```bash
strain-calibrator --version
```

## 项目目录结构

```
xy4035/
├── strain_calibrator/          # 主程序包
│   ├── __init__.py
│   ├── cli.py                  # CLI入口和所有命令
│   ├── models.py               # 配置模型（Pydantic）
│   ├── storage.py              # 存储层（文件系统、历史记录）
│   ├── quarantine.py           # 隔离区管理
│   ├── parser.py               # CSV解析、单位换算
│   ├── validator.py            # 数据校验
│   ├── calibration.py          # 校准和时间对齐
│   ├── analysis.py             # 结构计算
│   └── exporter.py             # 报告导出
├── examples/                   # 示例数据
│   ├── daq1_data.csv           # 采集仪1示例数据
│   ├── daq2_data.csv           # 采集仪2示例数据（时间偏移）
│   └── config_template.json    # 配置模板
├── tests/                      # 测试模块
│   ├── __init__.py
│   ├── conftest.py
│   └── test_models.py
├── pyproject.toml              # 项目配置
└── README.md
```

## 快速开始：完整流程示例

以下是使用临时目录验证所有核心命令的完整流程。

### 步骤1：创建临时目录并初始化项目

```bash
# 创建临时目录
mkdir -p /tmp/strain_test
cd /tmp/strain_test

# 初始化项目
strain-calibrator init \
    --name "桥梁模型加载试验" \
    --id "bridge_test_2024" \
    --description "钢梁四点弯曲加载试验" \
    --sampling-rate 10.0 \
    --section-width 0.15 \
    --section-height 0.3
```

这将创建以下目录结构：
```
/tmp/strain_test/
├── config.json          # 项目配置文件
├── data/               # 原始数据目录
├── output/             # 输出目录
├── quarantine/         # 隔离区
├── history/            # 历史记录
└── work/               # 工作区（中间数据）
```

### 步骤2：配置传感器

编辑 `config.json` 文件，添加传感器配置。或者直接复制示例配置：

```bash
# 复制示例配置模板（假设你在项目目录）
cp /path/to/project/examples/config_template.json /tmp/strain_test/config.json
```

示例配置包含：
- 5个应变片（SG1-SG5），分布在截面不同位置
- 2个温度传感器（T1, T2），用于温度补偿
- 2个位移计（D1, D2）
- 截面尺寸：150mm × 300mm
- 材料：Q235钢（弹性模量2.06e11 Pa）

### 步骤3：导入CSV数据

从示例目录导入两台采集仪的数据：

```bash
# 导入两台采集仪的数据
strain-calibrator import /path/to/project/examples/daq1_data.csv /path/to/project/examples/daq2_data.csv
```

**特点说明：**
- 原始文件不会被修改，会复制到 `data/` 目录
- 自动检测时间列（支持 "time", "timestamp", "时间", "日期时间" 等）
- 自动识别传感器类型（应变片、位移计、温度传感器）
- 支持不同采集仪的时间偏移（示例中 daq2 比 daq1 晚 50ms）

### 步骤4：校验数据质量

```bash
# 执行完整校验
strain-calibrator check

# 或指定特定检查类型
strain-calibrator check --checks time_order,sampling_rate,missing_values
```

**校验内容：**
- `time_order`: 时间倒序检查
- `sampling_rate`: 采样频率一致性检查
- `sensor_ids`: 传感器编号与配置匹配检查
- `missing_values`: 缺失值检查
- `value_range`: 值范围检查

**坏数据处理：**
- 校验发现的坏行会写入 `quarantine/quarantine.json`
- 每条记录包含：原始行号、原始数据、问题原因、严重程度

### 步骤5：零点漂移校准和温度补偿

```bash
# 自动检测空载区间（默认使用前30秒）
strain-calibrator calibrate

# 或指定空载区间
strain-calibrator calibrate --zero-start "2024-05-01 09:00:00" --zero-duration 2.0
```

**校准过程：**
1. 计算空载区间内各传感器的平均值作为零点
2. 所有后续数据减去该零点进行漂移校正
3. 根据温度传感器计算温度补偿系数
4. 应用温度补偿消除温度对应变的影响

### 步骤6：时间轴对齐

```bash
# 使用默认采样率对齐
strain-calibrator align

# 或指定目标采样率和插值方法
strain-calibrator align --target-rate 10.0 --method linear
```

**对齐功能：**
- 处理多采集仪的时间偏移（示例中 daq2 偏移 50ms）
- 将所有数据插值到统一的时间步长
- 支持线性插值、时间加权插值等方法

### 步骤7：结构分析

```bash
# 执行完整分析
strain-calibrator analyze

# 或指定荷载传感器（如果有）
strain-calibrator analyze --load-sensor "load"
```

**分析内容：**

1. **加载级检测**
   - 自动识别加载、持载、卸载阶段
   - 基于应变变化或荷载传感器数据

2. **峰值应变计算**
   - 每个加载级的峰值应变
   - 峰值出现时间

3. **残余变形分析**
   - 卸载后残留的应变/位移
   - 判断是否超过允许阈值

4. **曲率计算**
   - 基于顶部和底部应变差计算截面曲率
   - 曲率 = (ε_top - ε_bottom) / h

5. **中性轴位置**
   - 通过多点应变线性回归计算
   - 监测中性轴移动（损伤标识）

6. **弯矩估算**
   - M = E × I × κ
   - 基于材料力学梁理论

7. **风险识别**
   - **超限告警**: 应变/位移超过阈值
   - **突变检测**: 相邻测点变化突跳
   - **残余超限**: 卸载后残留过大
   - **无响应**: 传感器疑似故障

### 步骤8：导出报告

```bash
# 导出所有文件到默认output目录
strain-calibrator export

# 或指定输出目录和文件名前缀
strain-calibrator export --output-dir ./my_output --prefix "test_001"
```

**导出文件：**

1. **Markdown试验报告** (`*_report_*.md`)
   - 项目概述和传感器配置
   - 数据校验结果
   - 校准信息（零点偏移、温度补偿系数）
   - 分析结果（加载级、峰值应变、残余变形、中性轴位置、弯矩）
   - 风险告警汇总

2. **清洗后CSV** (`*_cleaned_*.csv`)
   - 对齐后的时间轴
   - 校准后的传感器数据

3. **分析结果JSON** (`*_analysis_*.json`)
   - 完整的分析数据
   - 时间序列数据
   - 告警详情

### 步骤9：查询历史记录

```bash
# 查看所有历史记录
strain-calibrator history

# 查看特定类型的记录
strain-calibrator history --type import
strain-calibrator history --type calibration
strain-calibrator history --type alignment
strain-calibrator history --type analysis

# 限制显示条数
strain-calibrator history --limit 5
```

## 命令参考

### init - 初始化项目

```bash
strain-calibrator init [OPTIONS]

选项：
  -n, --name TEXT           项目名称 [必填]
  -i, --id TEXT             项目唯一标识（默认自动生成）
  -d, --description TEXT    项目描述
  -sr, --sampling-rate FLOAT  默认采样率 (Hz) [默认: 10.0]
  -sw, --section-width FLOAT  截面宽度 (m)
  -sh, --section-height FLOAT  截面高度 (m)
  -em, --elastic-modulus FLOAT  弹性模量 (Pa) [默认: 2.06e11]
```

### import - 导入数据

```bash
strain-calibrator import [OPTIONS] FILES...

选项：
  -e, --encoding TEXT       文件编码 [默认: utf-8]
  -s, --skip-rows INTEGER   跳过的行数 [默认: 0]
```

### check - 数据校验

```bash
strain-calibrator check [OPTIONS]

选项：
  -c, --checks TEXT         检查类型（逗号分隔）
                            可选: time_order, sampling_rate, sensor_ids,
                                  missing_values, value_range
```

### calibrate - 校准

```bash
strain-calibrator calibrate [OPTIONS]

选项：
  -zs, --zero-start TEXT    空载区间开始时间 (格式: 'YYYY-MM-DD HH:MM:SS')
  -zd, --zero-duration FLOAT  空载区间时长 (秒)
```

### align - 时间对齐

```bash
strain-calibrator align [OPTIONS]

选项：
  -tr, --target-rate FLOAT  目标采样率 (Hz)
  -m, --method TEXT         插值方法: linear, time [默认: linear]
```

### analyze - 结构分析

```bash
strain-calibrator analyze [OPTIONS]

选项：
  -ls, --load-sensor TEXT   荷载传感器编号
```

### export - 导出报告

```bash
strain-calibrator export [OPTIONS]

选项：
  -o, --output-dir PATH     输出目录
  -p, --prefix TEXT         文件名前缀 [默认: result]
```

### history - 历史记录

```bash
strain-calibrator history [OPTIONS]

选项：
  -t, --type TEXT           记录类型: import, calibration, alignment, analysis
  -n, --limit INTEGER       显示条数 [默认: 20]
```

## 配置说明

### 传感器配置

编辑 `config.json` 中的 `sensors` 数组：

```json
{
  "sensor_id": "SG1",
  "type": "strain_gauge",
  "name": "上缘应变片",
  "unit": "microstrain",
  "location_y": 0.25,
  "temperature_compensation_sensor": "T1",
  "gain": 1.0,
  "offset": 0.0
}
```

**字段说明：**
- `sensor_id`: 传感器唯一编号（用于匹配CSV列名）
- `type`: 类型：`strain_gauge`（应变片）、`displacement_meter`（位移计）、`temperature_sensor`（温度传感器）
- `unit`: 单位：`microstrain`（微应变）、`mm`（毫米）、`celsius`（摄氏度）等
- `location_y`: 相对于截面底部的位置（m），用于曲率和中性轴计算
- `temperature_compensation_sensor`: 关联的温度补偿传感器编号
- `gain/offset`: 增益和偏置系数（用于单位换算）

### 阈值配置

```json
{
  "thresholds": {
    "max_strain": 2000.0,
    "max_displacement": 100.0,
    "residual_strain_ratio": 0.1,
    "strain_jump_threshold": 100.0
  }
}
```

**参数说明：**
- `max_strain`: 最大允许应变（microstrain）
- `max_displacement`: 最大允许位移（mm）
- `residual_strain_ratio`: 残余应变与峰值应变的比值阈值
- `strain_jump_threshold`: 应变突变检测阈值（microstrain）

## CSV格式支持

### 支持的时间列名

- `time`, `timestamp`, `datetime`
- `时间`, `日期时间`, `日期时间`
- （大小写不敏感）

### 支持的时间格式

```
2024-05-01 09:00:00
2024-05-01 09:00:00.123
2024/05/01 09:00:00
05/01/2024 09:00:00
2024-05-01T09:00:00
```

### 支持的传感器列名模式

**应变片：**
- `strain*`, `应变*`, `SG_*`, `ε*`

**位移计：**
- `disp*`, `位移*`, `LVDT*`, `D_*`

**温度传感器：**
- `temp*`, `温度*`, `T_*`

### 示例CSV格式

**采集仪1（英文列名）：**
```csv
time,SG1,SG2,SG3,T1,D1
2024-05-01 09:00:00,12.5,8.3,9.1,22.5,0.02
2024-05-01 09:00:00.1,12.4,8.2,9.0,22.5,0.03
```

**采集仪2（中文列名，时间偏移）：**
```csv
时间,应变4,应变5,温度2,位移2
2024-05-01 09:00:00.05,6.2,-15.8,22.4,0.01
2024-05-01 09:00:00.15,6.1,-15.7,22.5,0.02
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=strain_calibrator

# 运行特定测试
pytest tests/test_models.py
```

## 开发说明

### 代码架构

```
CLI入口 (cli.py)
    │
    ├── 配置管理 (models.py) - Pydantic模型
    │
    ├── 存储层 (storage.py) - 文件系统、历史记录
    │
    ├── 隔离区 (quarantine.py) - 坏数据管理
    │
    ├── 数据解析 (parser.py) - CSV解析、单位转换
    │
    ├── 数据校验 (validator.py) - 质量检查
    │
    ├── 校准对齐 (calibration.py) - 零点校正、温度补偿、时间对齐
    │
    ├── 结构分析 (analysis.py) - 弯矩、中性轴、风险检测
    │
    └── 报告导出 (exporter.py) - Markdown/CSV/JSON
```

### 添加新功能

1. 在对应的模块中实现功能
2. 在 `cli.py` 中添加命令（如需要）
3. 添加单元测试
4. 更新README文档

## 常见问题

### Q: 找不到时间列？

A: 确保CSV中存在以下列名之一：`time`, `timestamp`, `时间`, `datetime`。或者在导入后手动编辑 `config.json` 调整。

### Q: 传感器编号不匹配？

A: 程序会自动从列名中提取数字作为传感器ID。例如 `SG1` → `1`，`应变4` → `4`。确保 `config.json` 中的 `sensor_id` 与提取结果一致。

### Q: 时间对齐后数据点变少？

A: 时间对齐使用线性插值。如果原始数据有缺失或时间间隔不均匀，插值后可能产生 NaN。可以通过 `check` 命令检查原始数据质量。

### Q: 如何指定不同采集仪的字段映射？

A: 目前程序使用自动检测模式。对于特殊格式，可以：
1. 预处理CSV文件，统一列名格式
2. 或修改 `parser.py` 中的 `ColumnDetector` 类添加更多模式

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
