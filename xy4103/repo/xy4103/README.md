# 流星雨 ZHR 复核器

一个给业余天文社整理流星雨观测记录用的本地 Python CLI 工具。

## 功能特性

- **数据校验**：自动校验坐标、时区、时间格式、单位等
- **时区转换**：自动将各观测点的本地时间转换为 UTC，便于统一分析
- **重复检测**：检测同一观测者重复提交的数据
- **时段重叠**：检测不同观测点的时段重叠
- **坏天气过滤**：自动识别高云量、低极限星等的不可靠数据
- **ZHR 计算**：计算每小时天顶流量（ZHR），包含云量校正和极限星等校正
- **置信区间**：基于泊松分布计算统计置信区间
- **观测权重**：根据观测时长、流星数量、天气条件计算各观测点权重
- **多格式报告**：导出 Markdown、CSV、JSON 格式报告
- **隔离区**：异常数据自动进入 `quarantine.json`，不影响正常分析

## 项目结构

```
zhr_validator/
├── __init__.py          # 包初始化
├── models.py            # 数据模型定义
├── astronomy.py         # 天文计算模块
├── validation.py        # 规则校验模块
├── storage.py           # 数据存储模块
├── reporter.py          # 报告生成模块
└── cli.py               # 命令行接口
examples/                # 示例数据
├── sample_good.csv           # 正常数据
├── sample_with_errors.csv    # 包含错误的数据
├── sample_bad_weather.csv    # 坏天气数据
└── sample_different_timezones.csv # 不同时区数据
tests/                   # 测试用例
├── __init__.py
├── test_models.py
├── test_astronomy.py
└── test_validation.py
```

## 安装

### 要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd xy4103

# 安装依赖（开发模式）
pip install -e .
```

或者使用虚拟环境：

```bash
# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # macOS/Linux
# 或 .venv\Scripts\activate  # Windows

# 安装
pip install -e .
```

## 使用方法

### 1. 初始化项目

在工作目录中初始化一个新项目：

```bash
# 使用默认配置
zhr init

# 自定义配置
zhr init --name "英仙座流星雨2024" --shower "英仙座流星雨" --date "2024-08-12" --pop-index 2.3 --confidence 0.95
```

**可用选项**：
- `--name`: 项目名称
- `--shower`: 流星雨名称
- `--date`: 观测日期 (YYYY-MM-DD)
- `--timezone`: 默认时区 (默认: Asia/Shanghai)
- `--pop-index`: 人口指数 r (默认: 2.0)
- `--confidence`: 置信水平 (默认: 0.68，即 1σ)

### 2. 导入观测记录

导入一份或多份 CSV 观测记录：

```bash
# 导入单个文件
zhr import observations.csv

# 导入多个文件
zhr import observer1.csv observer2.csv observer3.csv

# 导入示例数据
zhr import examples/sample_good.csv
```

**CSV 文件格式要求**：

| 字段名 | 说明 | 示例 |
|--------|------|------|
| observer_name | 观测者姓名 | 张三 |
| observation_date | 观测日期 | 2024-08-12 |
| start_time | 开始时间 | 20:00 |
| end_time | 结束时间 | 22:00 |
| timezone | 时区 (IANA格式) | Asia/Shanghai |
| latitude | 纬度 (北纬为正) | 40.0 |
| longitude | 经度 (东经为正) | 116.5 |
| elevation | 海拔(米) [可选] | 50 |
| cloud_cover | 云量 (0-1) | 0.1 |
| limiting_magnitude | 极限星等 | 6.5 |
| meteor_count | 观测到的流星数 | 25 |
| remarks | 备注 [可选] | 晴朗，观测条件佳 |

**注意**：
- 时区请使用 [IANA 时区数据库](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) 格式，如 `Asia/Shanghai`、`America/New_York`、`Europe/London`
- 云量表示为 0-1 的小数，0 表示完全晴朗，1 表示完全多云
- 结束时间早于开始时间会被自动识别为跨午夜观测

**导入时的校验**：
- 自动检测无效时区、无效坐标
- 检测高云量 (>75%)、低极限星等 (<4.5)
- 检测潜在重复提交（同一观测者+同一地点）
- 检测时段重叠（UTC 时间）

### 3. 校验已导入数据

对已导入的数据进行全面校验：

```bash
# 基本校验
zhr check

# 显示详细信息
zhr check --show-details

# 显示隔离区内容
zhr check --show-quarantine

# 不显示细节
zhr check --no-show-details
```

校验内容包括：
- 坐标有效性
- 时区有效性
- 云量和极限星等
- 潜在重复提交
- 时段重叠

### 4. 计算 ZHR

计算每小时天顶流量（ZHR）：

```bash
# 使用默认配置计算
zhr calc

# 自定义参数
zhr calc --shower "英仙座流星雨" --pop-index 2.3 --confidence 0.95

# 包含坏天气数据（默认排除）
zhr calc --include-bad-weather
```

**ZHR 计算公式**：

```
原始 ZHR = 流星数 / 观测时长(小时)

云量校正因子 = 1 / (1 - 云量)
极限星等校正因子 = r ^ (6.5 - LM)
    其中 r 为人口指数，LM 为极限星等

校正后 ZHR = 原始 ZHR × 云量校正因子 × 极限星等校正因子
```

**置信区间计算**：
基于泊松分布的统计误差，默认使用 68% 置信水平（1σ）。

**观测权重计算**：
权重基于以下因素综合计算（各占一定比例）：
- 观测时长（最多 2 小时）
- 流星数量（最多 20 颗）
- 云量情况
- 极限星等

**可靠数据标准**：
- 非坏天气（云量 ≤ 75% 且 LM ≥ 4.5）
- 流星数 ≥ 5
- 观测时长 ≥ 15 分钟

### 5. 导出报告

生成并导出报告：

```bash
# 导出所有格式（md, csv, json）
zhr report

# 只导出 Markdown
zhr report -f md

# 导出多种格式
zhr report -f md -f csv

# 自定义输出文件名
zhr report -o perseids_2024

# 包含隔离区报告
zhr report --include-quarantine
```

**输出格式**：

- **Markdown**: 美观的表格和说明，适合分享
- **CSV**: 便于后续分析和导入 Excel
- **JSON**: 便于程序处理

### 6. 其他命令

```bash
# 查看项目状态
zhr status

# 清空隔离区
zhr clear

# 带确认清空
zhr clear -y

# 查看帮助
zhr --help
zhr init --help
zhr import --help
```

## 临时目录验证全流程

按照以下步骤在临时目录中验证完整工作流：

```bash
# 1. 创建临时目录
mkdir -p /tmp/zhr_test
cd /tmp/zhr_test

# 2. 初始化项目
zhr init --name "测试项目" --shower "英仙座流星雨" --confidence 0.68

# 3. 查看项目结构
ls -la
# 你应该看到：
# - zhr_config.json (配置文件)
# - data/ (数据目录)
# - output/ (输出目录)

# 4. 复制示例数据（假设原项目在 xy4103 目录）
# 或者手动创建测试 CSV

# 手动创建测试数据
cat > test_data.csv << 'EOF'
observer_name,observation_date,start_time,end_time,timezone,latitude,longitude,elevation,cloud_cover,limiting_magnitude,meteor_count,remarks
张三,2024-08-12,20:00,22:00,Asia/Shanghai,40.0,116.5,50,0.1,6.5,25,晴朗
李四,2024-08-12,21:00,23:30,Asia/Shanghai,39.9,116.4,40,0.15,6.2,30,略有薄云
王五,2024-08-12,22:00,00:30,Asia/Shanghai,40.1,116.6,60,0.05,6.8,40,完美夜空
赵六,2024-08-12,23:00,01:30,Asia/Shanghai,39.8,116.3,35,0.2,6.0,20,城市边缘
钱七,2024-08-12,00:00,02:30,Asia/Shanghai,40.2,116.7,70,0.8,4.0,5,坏天气数据
EOF

# 5. 导入数据
zhr import test_data.csv

# 观察输出：
# - 应显示共 5 条记录
# - 钱七的数据因坏天气会有警告
# - 检查隔离区是否有异常记录

# 6. 查看隔离区
ls output/
# 检查是否有 quarantine.json

# 7. 校验数据
zhr check

# 8. 计算 ZHR
zhr calc

# 观察输出：
# - 加权平均 ZHR
# - 可靠/不可靠记录数
# - 置信区间
# - 详细的各观测者 ZHR

# 9. 导出报告
zhr report

# 10. 查看输出文件
ls output/
# 你应该看到：
# - zhr_report_*.md (Markdown 报告)
# - zhr_report_*.csv (CSV 报告)
# - zhr_report_*.json (JSON 报告)
# - quarantine.json (隔离区数据)

# 11. 查看 Markdown 报告
cat output/zhr_report_*.md

# 12. 查看项目状态
zhr status
```

## 测试示例数据

项目提供了多份示例数据用于测试：

```bash
# 正常数据测试
zhr import examples/sample_good.csv

# 包含错误的数据（会有部分进入隔离区）
zhr import examples/sample_with_errors.csv

# 坏天气数据（会有警告）
zhr import examples/sample_bad_weather.csv

# 不同时区数据（测试时区转换）
zhr import examples/sample_different_timezones.csv
```

## 隔离区说明

当数据存在错误时，会被自动移入隔离区 `output/quarantine.json`。

**会导致隔离的问题**：
- 无效时区格式
- 无效坐标（纬度 ±90° 外，经度 ±180° 外）
- 无效云量（<0 或 >1）
- 无效极限星等（<0 或 >8）
- 负流星数
- 缺少必填字段

**仅警告但不隔离的问题**：
- 高云量 (>75%) - 标记为坏天气
- 低极限星等 (<4.5) - 标记为坏天气
- 流星数少 (<5) - 统计误差大
- 时段重叠 - 可能是同一时段的不同观测
- 潜在重复 - 需要人工确认

## 配置文件说明

`zhr_config.json` 中的配置项：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| project_name | 项目名称 | "流星雨 ZHR 复核项目" |
| shower_name | 流星雨名称 | "未指定流星雨" |
| observation_date | 观测日期 | null |
| default_timezone | 默认时区 | "Asia/Shanghai" |
| population_index | 人口指数 r | 2.0 |
| confidence_level | 置信水平 | 0.68 |
| bad_weather_cloud_threshold | 坏天气云量阈值 | 0.75 |
| bad_weather_lm_threshold | 坏天气 LM 阈值 | 4.5 |
| min_meteor_count_for_reliable | 可靠数据最小流星数 | 5 |
| min_duration_hours_for_reliable | 可靠数据最小时长 | 0.25 (15分钟) |

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_models.py
pytest tests/test_astronomy.py
pytest tests/test_validation.py

# 带覆盖率的测试
pytest --cov=zhr_validator
```

## 常见问题

### Q: 什么是 ZHR？

**ZHR**（Zenithal Hourly Rate，每小时天顶流量）是指在理想观测条件下（辐射点在天顶，极限星等 6.5，无云），观测者每小时能看到的流星数。

### Q: 为什么需要校正？

实际观测条件很少是理想的：
- **云量校正**：云层遮挡了部分天空，可见流星数减少
- **极限星等校正**：光污染或月光会让暗流星不可见

### Q: 人口指数 r 是什么？

人口指数描述流星的亮度分布：
- r = 2.0: 每暗一个星等，流星数增加约 2 倍（典型值）
- r 值越大，暗流星比例越高
- 不同流星雨的 r 值不同，通常在 2.0-3.0 之间

### Q: 什么是隔离区？

隔离区是存放有错误数据的地方。这些数据不会参与 ZHR 计算，但会被保存以便人工审核和修正。

### Q: 如何处理跨午夜观测？

系统会自动识别结束时间早于开始时间的情况，将其视为跨午夜观测。例如：
- 开始 23:00，结束 01:30 → 自动计算为 2.5 小时

### Q: 不同时区的观测如何统一？

系统会将所有观测时间转换为 UTC（协调世界时），便于比较不同时区的观测数据。

## 开发说明

### 代码结构

```
zhr_validator/
├── models.py      # 数据模型 (Pydantic)
├── astronomy.py   # 天文计算
├── validation.py  # 数据校验
├── storage.py     # 数据持久化
├── reporter.py    # 报告生成
└── cli.py         # CLI 入口
```

### 添加新的校验规则

在 `validation.py` 中添加新的校验函数，并在 `validate_single_record` 或 `validate_batch_records` 中调用。

### 自定义报告模板

修改 `reporter.py` 中的 `generate_zhr_markdown` 等方法来自定义报告格式。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
