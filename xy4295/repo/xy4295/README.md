# 🌊 补剂配平助手

一个为海水缸维护师设计的本地科学计算工具，帮助精确计算KH、钙、镁等补剂的投加量，避免单位混淆和计算错误。

## 功能特性

- 📊 **智能计算**：基于历史检测数据自动计算参数消耗趋势
- 🎯 **目标区间**：按目标范围计算未来投加方案
- ⚠️ **安全检查**：自动检测数据缺失、单位不一致、超安全阈值
- 📝 **导出功能**：支持导出 Markdown 维护单和 CSV 投加计划
- 🧪 **多参数支持**：KH、钙、镁、盐度、蒸发补水

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据运行

项目包含完整的示例数据，可以直接运行测试：

```bash
# 基本用法
python main.py --params examples/tank_params.csv --readings examples/daily_readings.csv

# 指定输出目录
python main.py --params examples/tank_params.csv --readings examples/daily_readings.csv --output ./output

# 使用自定义补剂配置
python main.py --params examples/tank_params.csv --readings examples/daily_readings.csv --supplement examples/supplements.csv

# 详细输出模式
python main.py --params examples/tank_params.csv --readings examples/daily_readings.csv --verbose
```

### 命令行参数

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--params` | `-p` | 是 | 缸体参数CSV文件路径 |
| `--readings` | `-r` | 是 | 每日检测数据CSV文件路径 |
| `--supplement` | `-s` | 否 | 补剂配置CSV文件路径（默认使用内置配置） |
| `--output` | `-o` | 否 | 输出目录路径（默认当前目录） |
| `--days` | `-d` | 否 | 计算未来天数（默认7天） |
| `--verbose` | `-v` | 否 | 详细输出模式 |
| `--version` | | 否 | 显示版本号 |

## 数据格式说明

### 1. 缸体参数文件 (tank_params.csv)

包含缸体基本信息和目标参数范围。

**格式：**
```csv
parameter,value,unit
tank_name,示例海水缸,
total_volume,200,L
target_kh_min,7.0,dKH
target_kh_max,9.0,dKH
target_ca_min,400.0,ppm
target_ca_max,450.0,ppm
target_mg_min,1250.0,ppm
target_mg_max,1350.0,ppm
target_salinity_min,1.024,sg
target_salinity_max,1.026,sg
daily_evaporation_rate,5.0,L/day
```

**参数说明：**

| 参数名 | 说明 | 单位 |
|--------|------|------|
| tank_name | 缸体名称 | - |
| tank_id | 缸体ID（可选） | - |
| total_volume | 总水量 | L（升） |
| display_volume | 主缸水量（可选） | L（升） |
| sump_volume | 底缸水量（可选） | L（升） |
| target_kh_min | KH目标最小值 | dKH |
| target_kh_max | KH目标最大值 | dKH |
| target_ca_min | 钙目标最小值 | ppm |
| target_ca_max | 钙目标最大值 | ppm |
| target_mg_min | 镁目标最小值 | ppm |
| target_mg_max | 镁目标最大值 | ppm |
| target_salinity_min | 盐度目标最小值 | sg（比重） |
| target_salinity_max | 盐度目标最大值 | sg（比重） |
| daily_evaporation_rate | 每日蒸发率（可选） | L/day |

### 2. 每日检测数据文件 (daily_readings.csv)

包含每日的检测数据记录。

**格式：**
```csv
date,kh,ca,mg,salinity,evaporation,notes
2024-05-01,8.2,430,1320,1.025,4.8,初始检测
2024-05-02,7.9,425,1315,1.025,5.2,正常
2024-05-03,7.6,420,1310,1.024,4.9,KH略降
```

**参数说明：**

| 参数名 | 说明 | 单位 |
|--------|------|------|
| date | 检测日期 | YYYY-MM-DD |
| kh | KH值 | dKH |
| ca | 钙值 | ppm |
| mg | 镁值 | ppm |
| salinity | 盐度 | sg（比重） |
| evaporation | 当日蒸发量 | L（升） |
| notes | 备注 | 文本 |

**日期格式支持：**
- `YYYY-MM-DD` (推荐)
- `YYYY/MM/DD`
- `DD-MM-YYYY`
- `DD/MM/YYYY`
- `MM-DD-YYYY`
- `MM/DD/YYYY`

### 3. 补剂配置文件 (supplements.csv)

包含补剂的浓度和使用限制配置。

**格式：**
```csv
name,param,concentration,concentration_unit,max_daily_dosage,safety_threshold
KH提升液,kh,1.0,meq/mL,5.0,1.0
钙提升液,ca,100000.0,ppm/mL,5.0,20.0
镁提升液,mg,50000.0,ppm/mL,5.0,30.0
海盐,salt,35.0,ppt/kg,100.0,0.001
```

**参数说明：**

| 参数名 | 说明 |
|--------|------|
| name | 补剂名称 |
| param | 对应参数类型 |
| concentration | 补剂浓度 |
| concentration_unit | 浓度单位 |
| max_daily_dosage | 最大每日投加量 (mL/100L) |
| safety_threshold | 单次投加安全阈值 |

**参数类型 (param)：**
- `kh` - KH/碱度
- `ca` - 钙
- `mg` - 镁
- `salt` - 盐度

## 完整使用示例

### 步骤1：准备数据文件

假设我们有一个200L的海水缸，最近5天的检测数据显示参数在下降：

**缸体参数文件 `my_tank_params.csv`：**
```csv
parameter,value,unit
tank_name,我的珊瑚缸,
total_volume,200,L
display_volume,150,L
sump_volume,50,L
target_kh_min,7.5,dKH
target_kh_max,8.5,dKH
target_ca_min,420.0,ppm
target_ca_max,440.0,ppm
target_mg_min,1280.0,ppm
target_mg_max,1320.0,ppm
target_salinity_min,1.025,sg
target_salinity_max,1.026,sg
```

**检测数据文件 `my_readings.csv`：**
```csv
date,kh,ca,mg,salinity,evaporation,notes
2024-05-01,8.2,435,1310,1.0255,5.0,正常
2024-05-02,8.0,430,1305,1.0255,4.8,正常
2024-05-03,7.8,425,1300,1.025,5.2,参数略降
2024-05-04,7.6,420,1295,1.025,4.9,继续下降
2024-05-05,7.4,415,1290,1.0245,5.1,接近下限
```

### 步骤2：运行计算

```bash
python main.py --params my_tank_params.csv --readings my_readings.csv --output ./my_results --days 7
```

### 步骤3：查看输出

程序会在 `./my_results` 目录生成两个文件：
1. `我的珊瑚缸_维护单_YYYYMMDD_HHMMSS.md` - Markdown格式的维护单
2. `我的珊瑚缸_投加计划_YYYYMMDD_HHMMSS.csv` - CSV格式的投加计划

### 步骤4：执行投加

根据生成的维护单执行投加操作：
1. 仔细核对投加量和补剂浓度
2. 建议分多次投加，每次间隔1-2小时
3. 投加后24小时检测参数变化
4. 如有异常立即停止

## 警告说明

程序会在以下情况发出警告：

### 数据相关警告
- **数据缺失**：检测数据中缺少必要参数
- **单位不一致**：单位与标准单位不符
- **数值异常**：数值超出常规范围
- **日期格式错误**：无法解析的日期格式

### 投加相关警告
- **超安全阈值**：单次投加浓度变化超过安全限制
- **超每日最大量**：投加量超过每日最大限制
- **数据不足**：历史数据不足2天，无法计算消耗趋势

### 示例：测试警告场景

使用包含警告场景的示例数据：

```bash
python main.py --params examples/tank_params.csv --readings examples/daily_readings_with_warnings.csv --verbose
```

这个示例文件包含：
- 钙数据缺失
- 镁数据缺失
- 盐度数据缺失
- 异常低值（KH=5.0, 钙=350ppm, 镁=1100ppm, 盐度=1.019）
- 负蒸发量（-2.0L）

运行后会显示所有相关警告。

## 运行测试

项目包含完整的单元测试和集成测试：

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或使用unittest
python -m unittest discover tests
```

测试覆盖以下模块：
- `models` - 数据模型验证
- `csv_reader` - CSV文件读取
- `calculator` - 投加计算
- `exporter` - 结果导出
- 完整工作流程集成测试

## 计算原理

### 消耗速率计算

程序基于历史检测数据计算各参数的每日消耗速率：

```
每日消耗速率 = (前一天值 - 当天值) / 天数差
```

### 投加量计算

**KH投加量计算：**
```
理论投加量(mL) = (需要提升的dKH × 2 × 总体积) / 补剂浓度(meq/mL)
```

**钙/镁投加量计算：**
```
理论投加量(mL) = (需要提升的ppm × 总体积) / 补剂浓度(ppm/mL)
```

**实际投加量限制：**
- 不超过每日最大投加量
- 不超过安全阈值限制

### 蒸发补水计算

程序会计算每日蒸发量，并根据当前盐度决定：
- 盐度正常：补充纯水
- 盐度过高：建议低盐度水补充
- 盐度过低：建议盐水补充

## 项目结构

```
xy4295/
├── main.py                    # 主入口文件
├── requirements.txt           # 依赖包列表
├── README.md                  # 本文档
├── reef_dosing_helper/        # 核心包
│   ├── __init__.py           # 包初始化
│   ├── models.py             # 数据模型定义
│   ├── csv_reader.py         # CSV文件读取器
│   ├── calculator.py         # 投加计算器
│   ├── exporter.py           # 结果导出器
│   └── cli.py                # 命令行界面
├── examples/                  # 示例数据
│   ├── tank_params.csv              # 缸体参数示例
│   ├── daily_readings.csv           # 检测数据示例
│   ├── daily_readings_with_warnings.csv  # 警告场景示例
│   └── supplements.csv               # 补剂配置示例
└── tests/                     # 测试文件
    ├── __init__.py
    └── test_calculator.py    # 单元测试
```

## 常见问题

### Q1: 程序无法识别我的日期格式？

程序支持多种日期格式，包括：
- `2024-05-01` (推荐)
- `2024/05/01`
- `01-05-2024`
- `01/05/2024`
- `2024-05-01 14:30:00`

如果您的日期格式不被支持，请使用 `YYYY-MM-DD` 格式。

### Q2: 补剂浓度单位有哪些？

默认支持的单位：
- **KH**: `meq/mL` (毫当量/毫升)
- **钙/镁**: `ppm/mL` (每毫升提升ppm数)
- **盐度**: `ppt/kg` (每千克海盐提升ppt数)

### Q3: 如何确定安全阈值？

安全阈值是指单次投加允许的最大浓度变化，建议值：
- KH: 不超过 1.0 dKH/次
- 钙: 不超过 20 ppm/次
- 镁: 不超过 30 ppm/次
- 盐度: 不超过 0.001 sg/次

### Q4: 程序计算结果与我手动计算有差异？

请检查以下几点：
1. 缸体总水量是否正确（主缸+底缸+管道）
2. 补剂浓度单位是否匹配
3. 目标范围设置是否合理
4. 历史数据是否完整

程序会基于最近的消耗趋势进行预测，与静态计算可能有差异。

## 更新日志

### v1.0.0 (2024-05-03)
- 初始版本发布
- 支持KH、钙、镁、盐度参数计算
- 支持CSV数据读取
- 支持Markdown和CSV导出
- 完整的单元测试和集成测试

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**⚠️ 免责声明：本工具仅供参考，请在执行前仔细核对所有计算结果。海水缸参数调整可能对生物造成影响，请谨慎操作。**
