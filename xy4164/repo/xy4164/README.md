# 补光配方预演器 (Lighting Previewer)

植物工厂值班农艺师专用的本地科学计算工具，用于换季时预测补光方案的DLI（日光积分）、能耗、成本和风险。

## 功能特性

### 📊 核心计算
- **DLI计算**: 计算各分区的自然光照积分和人工补光积分
- **光谱配比**: 分析LED灯谱的蓝红比（B:R）及各波段比例
- **能耗成本**: 根据电价时段计算预计能耗和成本

### ⚠️ 数据校验
- **传感器缺测**: 检测传感器数据缺口和异常值
- **功率冲突**: 校验灯具功率配置合理性
- **阈值越界**: 检查DLI是否超出作物生长阈值（不足/过量）
- **预算超限**: 监控预计成本是否超出预算限制

### 🎯 优化建议
- **谷电优先**: 自动优先选择谷电时段补光以降低成本
- **可调整方案**: 生成可手动调整的补光时段方案
- **风险提示**: 高亮显示DLI不足、过量（烧苗风险）等问题

### 💾 数据管理
- **会话存储**: 保存/加载复盘会话，支持历史方案对比
- **多格式导出**: 
  - Markdown方案报告
  - CSV风险清单
  - JSON计算包

## 项目结构

```
lighting-previewer/
├── lighting_previewer/          # 主包
│   ├── __init__.py
│   ├── cli.py                    # 命令行入口
│   ├── models/                   # 数据模型
│   │   ├── __init__.py
│   │   ├── crop_zone.py          # 作物分区模型
│   │   ├── led_spectrum.py       # LED灯谱模型
│   │   ├── sensor_data.py        # 传感器数据模型
│   │   ├── electricity_price.py  # 电价模型
│   │   ├── light_plan.py         # 补光方案模型
│   │   ├── calculation_result.py # 计算结果模型
│   │   └── validation_result.py  # 校验结果模型
│   ├── validators/               # 解析校验模块
│   │   ├── __init__.py
│   │   ├── csv_parser.py         # CSV数据解析
│   │   └── data_validator.py     # 数据校验器
│   ├── calculators/              # 光照计算模块
│   │   ├── __init__.py
│   │   └── dli_calculator.py     # DLI/能耗/光谱计算
│   ├── optimizer/                # 优化建议模块
│   │   ├── __init__.py
│   │   └── light_plan_optimizer.py # 补光方案优化器
│   ├── session/                  # 会话存储模块
│   │   ├── __init__.py
│   │   └── session_manager.py    # 会话管理
│   └── exporters/                # 导入导出模块
│       ├── __init__.py
│       ├── markdown_exporter.py  # Markdown导出
│       ├── csv_exporter.py       # CSV导出
│       └── json_exporter.py      # JSON导出
├── examples/                     # 示例数据
│   ├── __init__.py
│   ├── crop_zones.csv            # 作物分区配置
│   ├── led_spectra.csv           # LED灯谱配置
│   ├── sensor_data.csv           # 传感器照度数据
│   └── electricity_price.csv     # 电价时段配置
├── tests/                        # 测试用例
│   ├── __init__.py
│   ├── test_models.py            # 模型测试
│   └── test_calculators.py       # 计算测试
├── output/                       # 输出目录
│   └── __init__.py
├── pyproject.toml                # 项目配置
├── requirements.txt              # 依赖
└── README.md                     # 本文档
```

## 安装

### 环境要求
- Python 3.8+

### 安装步骤

```bash
# 克隆或下载项目
cd xy4164

# 以可编辑模式安装
pip install -e .
```

## 快速开始

### 方式一：使用示例数据运行（推荐新手）

```bash
# 使用示例数据运行，预算限制100元
lighting-previewer example --budget 100 --output ./output
```

### 方式二：使用自定义数据运行

```bash
lighting-previewer run \
  --zones ./my_data/crop_zones.csv \
  --spectra ./my_data/led_spectra.csv \
  --sensor ./my_data/sensor_data.csv \
  --price ./my_data/electricity_price.csv \
  --budget 200 \
  --date 2024-05-01 \
  --output ./output \
  --session-name "2024春季换季方案"
```

### 临时目录验证流程

按照以下步骤在临时目录快速验证工具功能：

```bash
# 1. 创建临时工作目录
mkdir -p /tmp/lighting_test && cd /tmp/lighting_test

# 2. 确认示例数据文件位置（根据实际安装路径调整）
# 如果已安装，可以查看包内的examples目录
python -c "import lighting_previewer; import os; print(os.path.dirname(lighting_previewer.__file__))"

# 3. 运行示例
lighting-previewer example --budget 100 --output ./results

# 4. 查看输出文件
ls -la ./results/

# 5. 查看生成的Markdown报告（使用cat或其他文本阅读器）
cat ./results/*.md

# 6. （可选）运行单元测试
python -m pytest /path/to/xy4164/tests/ -v
```

## 命令行详解

### 运行完整计算流程 (`run`)

```bash
lighting-previewer run \
  --zones <分区CSV路径> \
  --spectra <灯谱CSV路径> \
  --sensor <传感器CSV路径> \
  --price <电价CSV路径> \
  [--budget <预算限制>] \
  [--date <基准日期>] \
  [--output <输出目录>] \
  [--session-name <会话名称>] \
  [--no-save]
```

**参数说明：**
- `--zones`: 作物分区配置CSV（必填）
- `--spectra`: LED灯谱配置CSV（必填）
- `--sensor`: 传感器照度数据CSV（必填）
- `--price`: 电价时段配置CSV（必填）
- `--budget`: 预算限制（元），用于预算超限检查
- `--date`: 基准日期，用于记录
- `--output`: 输出目录，默认为 `./output`
- `--session-name`: 会话名称，用于保存会话
- `--no-save`: 不保存会话到本地

### 仅校验数据 (`validate`)

```bash
lighting-previewer validate \
  --zones <分区CSV路径> \
  --spectra <灯谱CSV路径> \
  --sensor <传感器CSV路径> \
  --price <电价CSV路径> \
  [--budget <预算限制>]
```

### 会话管理 (`session`)

```bash
# 列出所有会话
lighting-previewer session list [--sessions-dir <目录>]

# 加载并导出会话
lighting-previewer session load <会话文件路径> [--output <输出目录>]

# 从CSV保存新会话
lighting-previewer session save \
  --zones <分区CSV> \
  --spectra <灯谱CSV> \
  --sensor <传感器CSV> \
  --price <电价CSV> \
  --session-name <名称>
```

### 导出数据 (`export`)

```bash
# 导出所有格式（默认）
lighting-previewer export <会话文件路径> --format all --output ./output

# 仅导出Markdown
lighting-previewer export <会话文件路径> --format markdown

# 仅导出CSV
lighting-previewer export <会话文件路径> --format csv

# 仅导出JSON
lighting-previewer export <会话文件路径> --format json
```

### 使用示例数据 (`example`)

```bash
lighting-previewer example \
  --budget 100 \
  --output ./output \
  --session-name "示例方案"
```

## 数据格式说明

### 1. 作物分区配置 (crop_zones.csv)

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| zone_id | 字符串 | 分区ID | Z001 |
| zone_name | 字符串 | 分区名称 | 叶菜区A |
| crop_type | 字符串 | 作物类型 | leafy_lettuce |
| shelf_count | 整数 | 货架数量 | 5 |
| shelf_height | 浮点数 | 货架高度(m) | 0.5 |
| shelf_width | 浮点数 | 货架宽度(m) | 1.2 |
| led_spectrum_id | 字符串 | 引用的灯谱ID | SPEC001 |
| sensor_id | 字符串 | 引用的传感器ID | S001 |
| min_dli | 浮点数 | 最小DLI阈值 | 10 |
| max_dli | 浮点数 | 最大DLI阈值(超量) | 20 |
| target_dli | 浮点数 | 目标DLI | 15 |
| installed_power | 浮点数 | 安装功率(W) | 800 |
| photoperiod_start | 时间 | 光周期开始时间 | 06:00 |
| photoperiod_end | 时间 | 光周期结束时间 | 22:00 |
| notes | 字符串 | 备注 | 玻璃温室北侧 |

### 2. LED灯谱配置 (led_spectra.csv)

一个灯谱配置包含多行，第一行是灯谱元数据，后续行是各光谱通道。

**灯谱元数据行：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| spectrum_id | 字符串 | 灯谱ID |
| spectrum_name | 字符串 | 灯谱名称 |
| manufacturer | 字符串 | 厂商 |
| model | 字符串 | 型号 |
| total_power | 浮点数 | 总功率(W) |
| photon_flux_density | 浮点数 | 光子通量密度(μmol/m²/s) |

**光谱通道行（spectrum_id为空表示延续上一个灯谱）：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| wavelength_range | 字符串 | 波长范围名称 |
| wavelength_nm | 浮点数 | 中心波长(nm) |
| intensity_ratio | 浮点数 | 强度比例(0-1) |
| photon_efficiency | 浮点数 | 光子效率 |

### 3. 传感器数据 (sensor_data.csv)

| 字段名 | 类型 | 说明 |
|--------|------|------|
| sensor_id | 字符串 | 传感器ID |
| sensor_name | 字符串 | 传感器名称 |
| location | 字符串 | 安装位置 |
| timestamp | 日期时间 | 时间戳 |
| ppfd | 浮点数 | 光合光子通量密度(μmol/m²/s) |
| temp | 浮点数(可选) | 温度(℃) |
| humidity | 浮点数(可选) | 湿度(%) |
| co2 | 浮点数(可选) | CO2浓度(ppm) |

### 4. 电价配置 (electricity_price.csv)

一个电价方案包含多行时段配置。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| price_id | 字符串 | 电价方案ID |
| price_name | 字符串 | 电价方案名称 |
| region | 字符串 | 地区 |
| effective_date | 日期 | 生效日期 |
| tier_name | 字符串 | 时段名称(峰/平/谷) |
| start_time | 时间 | 时段开始时间 |
| end_time | 时间 | 时段结束时间 |
| price_per_kwh | 浮点数 | 电价(元/kWh) |
| notes | 字符串 | 备注 |

## 输出文件说明

运行完整计算后，输出目录将包含以下文件：

### 1. Markdown方案报告 (`*.md`)
完整的补光方案报告，包含：
- 执行摘要（光照指标、能耗成本、风险评估）
- 分区详细分析（DLI、光谱、能耗、风险）
- 补光时段安排表
- 数据校验结果
- 操作建议

### 2. CSV风险清单 (`*_risks.csv`)
所有校验问题和计算风险的清单，包含：
- 问题类型
- 严重程度
- 影响分区/传感器
- 问题描述
- 建议操作

### 3. CSV分区汇总 (`*_zones.csv`)
各分区的关键指标汇总：
- DLI指标（自然/补光/总计/目标）
- 蓝红比
- 能耗成本
- 风险等级

### 4. CSV补光方案 (`*_plan.csv`)
详细的补光时段安排：
- 分区
- 时段
- 功率百分比
- 预计PPFD和DLI贡献
- 能耗和成本

### 5. JSON计算包 (`*_package.json`)
包含所有输入数据和计算结果的完整JSON文件，适合程序进一步处理。

## 风险等级说明

### DLI状态
| 状态 | 说明 | 建议 |
|------|------|------|
| deficient | DLI不足 | 增加补光时长或提高功率 |
| excessive | DLI过量 | 减少补光（烧苗风险！） |
| optimal | 最优 | DLI接近目标值 |
| acceptable | 可接受 | DLI在阈值范围内 |

### 风险等级
| 等级 | 说明 |
|------|------|
| 🔴 高风险 | 存在严重问题，需要立即处理 |
| 🟡 中风险 | 需要关注，建议优化 |
| 🟢 低风险 | 各项指标正常 |

## 常见问题

### Q1: 什么是DLI？
DLI (Daily Light Integral) 是日光积分，衡量一天内植物接收到的光合有效辐射总量，单位为 mol/m²/day。不同作物有不同的DLI需求。

### Q2: 为什么优先使用谷电时段补光？
谷电时段电价通常是峰电的1/3-1/4，优先在谷电时段补光可以显著降低运营成本。

### Q3: 什么是蓝红比（B:R）？
蓝红比是蓝光与红光的强度比例，对植物形态建成有重要影响：
- 较高的蓝红比：抑制徒长，促进叶片展开
- 较低的蓝红比：促进茎伸长，适合育苗

### Q4: 如何处理传感器数据缺口？
工具会自动检测数据缺口，建议：
1. 检查传感器连接和数据采集程序
2. 使用线性插值填补小缺口
3. 使用历史同期数据填补大缺口

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试文件
python -m pytest tests/test_models.py -v

# 运行特定测试类
python -m pytest tests/test_calculators.py::TestDLICalculator -v
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。
