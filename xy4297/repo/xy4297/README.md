# 疫苗冷链交接自动化工具

一个用于社区疫苗冷链点每日交接的本地自动化脚本工具，帮助你轻松管理温度记录仪数据、巡检照片和开门日志。

## 功能特性

- 📊 **智能解析**: 自动解析温度CSV文件、照片文件名中的时间信息、开门日志
- 🔍 **异常检测**: 识别超温、缺测、照片缺失、交接时间冲突、长时间开门等异常
- 📁 **自动归档**: 按日期和类型智能整理归档所有文件
- 📋 **报告生成**: 导出 Markdown 交接报告、CSV 异常清单、JSON 审计摘要
- ⚙️ **灵活配置**: 支持自定义温度阈值、班次时间、照片类型要求

## 项目结构

```
xy4297/
├── main.py                    # 主入口脚本
├── config.py                  # 配置文件
├── parsers/                   # 解析模块
│   ├── __init__.py
│   ├── csv_parser.py          # 温度CSV解析器
│   ├── photo_parser.py        # 照片文件名解析器
│   └── log_parser.py          # 开门日志解析器
├── rules/                     # 规则引擎
│   ├── __init__.py
│   └── engine.py              # 异常检测规则
├── archiver/                  # 归档模块
│   ├── __init__.py
│   └── archiver.py            # 文件归档器
├── reports/                   # 报告生成模块
│   ├── __init__.py
│   └── generator.py           # 报告生成器
└── data/
    ├── input/                 # 输入数据目录（示例数据）
    │   ├── temperature_20260501.csv
    │   ├── door_log_20260501.csv
    │   └── *.jpg              # 巡检照片
    ├── output/                # 输出报告目录
    └── archive/               # 归档目录
```

## 快速开始

### 环境要求

- Python 3.8+
- 无额外依赖（使用标准库）

### 一键运行

使用默认配置运行完整流程：

```bash
python main.py
```

或者指定自定义目录：

```bash
python main.py --input ./my_data --output ./reports --archive ./archived
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input` | 输入数据目录 | `./data/input` |
| `-o, --output` | 输出报告目录 | `./data/output` |
| `-a, --archive` | 归档目录 | `./data/archive` |
| `--no-archive` | 不执行文件归档 | - |
| `--move-files` | 归档时移动文件（默认是复制） | - |
| `--temp-min` | 温度下限阈值 | 2.0°C |
| `--temp-max` | 温度上限阈值 | 8.0°C |
| `--min-readings` | 每小时最小读数数量 | 4 |
| `--report-prefix` | 报告文件名前缀 | `cold_chain` |
| `-v, --verbose` | 显示详细输出 | - |
| `-h, --help` | 显示帮助信息 | - |

### 使用示例

```bash
# 使用示例数据测试
python main.py -v

# 自定义温度阈值
python main.py --temp-min 0 --temp-max 10

# 只生成报告不归档
python main.py --no-archive

# 归档时移动源文件（谨慎使用）
python main.py --move-files

# 完整参数示例
python main.py \
    --input /path/to/your/data \
    --output /path/to/reports \
    --archive /path/to/archive \
    --temp-min 2.0 \
    --temp-max 8.0 \
    --min-readings 4 \
    --report-prefix "冷链交接_202605" \
    --verbose
```

## 检测的异常类型

| 异常类型 | 告警级别 | 说明 |
|----------|----------|------|
| 温度超上限 | CRITICAL | 温度超过设定的最大值 |
| 温度超下限 | CRITICAL | 温度低于设定的最小值 |
| 缺测 | HIGH | 某小时温度读数数量不足 |
| 照片缺失 | HIGH | 某班次缺少要求的照片类型 |
| 交接时间冲突 | MEDIUM | 照片拍摄时间不在交接窗口内 |
| 长时间开门 | MEDIUM | 开门持续时间超过阈值 |
| 开门会话未完成 | MEDIUM | 有开门记录但无关门记录 |

## 支持的文件格式

### 温度CSV文件

支持以下列名（自动识别）：

- 时间列: `时间`, `Time`, `日期时间`, `DateTime`, `Timestamp`, `记录时间`
- 温度列: `温度`, `Temperature`, `温度(°C)`, `Temp`, `Value`, `读数`
- 传感器列: `传感器`, `Sensor`, `设备`, `Device`, `ID`, `编号`

示例：
```csv
时间,温度(°C),传感器ID
2026-05-01 08:00:00,5.2,冰箱1
2026-05-01 08:15:00,5.0,冰箱1
```

### 照片文件命名

照片文件名需要包含时间信息（支持多种格式）：

- `YYYYMMDD_HHMMSS_班次_类型.jpg`
- `IMG_YYYYMMDD_HHMMSS.jpg`
- `YYYY-MM-DD_HH-MM-SS_类型.jpg`

班次关键词: `早班`, `上午`, `白班`, `晚班`, `下午`, `夜班`, `morning`, `evening`

照片类型关键词:
- `温度1`, `冰箱1`, `temp1`, `fridge1`
- `温度2`, `冰箱2`, `temp2`, `fridge2`
- `门检查`, `开门`, `door`, `open`
- `库存`, `盘点`, `inventory`, `stock`

### 开门日志文件

支持 CSV、TXT、LOG 格式：

CSV格式示例：
```csv
时间,事件,门编号,持续时间(秒)
2026-05-01 08:05:00,开门,冰箱1,
2026-05-01 08:06:30,关门,冰箱1,90
```

文本格式示例：
```
2026-05-01 08:05:00 冰箱1 开门
2026-05-01 08:06:30 冰箱1 关门 (90秒)
```

## 配置说明

可以通过修改 `config.py` 或设置环境变量来自定义配置：

```python
# 温度阈值（默认 2°C - 8°C）
TEMP_THRESHOLD_MIN = 2.0
TEMP_THRESHOLD_MAX = 8.0

# 每小时最小读数数量
MIN_READINGS_PER_HOUR = 4

# 开门时长阈值（秒）
DOOR_OPEN_THRESHOLD_SECONDS = 120

# 交接时间容忍度（分钟）
HANDOVER_TIME_TOLERANCE_MINUTES = 30

# 班次配置
SHIFT_TIMES = {
    "morning": {
        "start": "08:00",
        "end": "16:00",
        "handover_window": ("07:30", "08:30"),
    },
    "evening": {
        "start": "16:00",
        "end": "23:59",
        "handover_window": ("15:30", "16:30"),
    },
}

# 各班次要求的照片类型
REQUIRED_PHOTOS_PER_SHIFT = {
    "morning": ["temperature_1", "temperature_2", "door_check"],
    "evening": ["temperature_1", "temperature_2", "door_check", "inventory"],
}
```

## 输出说明

### Markdown 交接报告

包含以下章节：
1. **概览**: 数据统计摘要
2. **异常汇总**: 按级别分类的异常列表
3. **温度监控详情**: 温度统计和传感器信息
4. **巡检照片状态**: 照片数量和类型统计
5. **开门日志记录**: 开门次数和时长统计
6. **详细异常列表**: 完整的异常详情表格

### CSV 异常清单

包含以下列：
- 序号、告警级别、异常类型
- 日期、时间、班次
- 传感器ID、描述、详细信息

### JSON 审计摘要

完整的结构化数据，适合程序处理：
- 生成时间、版本信息
- 数据解析统计
- 异常汇总和详情列表
- 配置参数记录

## 归档结构

文件按以下结构归档：

```
archive/
└── 2026-05/                    # 年月目录
    └── 2026-05-01/            # 日期目录
        ├── temperature/        # 温度数据
        ├── photos_morning/     # 早班照片
        │   ├── temperature_1/
        │   ├── temperature_2/
        │   └── door_check/
        ├── photos_evening/     # 晚班照片
        ├── door_logs/          # 开门日志
        └── others/             # 其他文件
```

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功，无异常 |
| 1 | 成功，但检测到异常 |
| 2 | 处理过程中发生错误 |

## 常见问题

**Q: 照片文件名一定要包含时间吗？**

A: 是的，时间信息用于识别拍摄时间和判断是否在交接窗口内。如果文件名中没有时间，程序会尝试使用文件的修改时间。

**Q: 温度CSV没有传感器列怎么办？**

A: 程序仍然可以正常工作，只是无法按传感器分组统计。

**Q: 如何处理多个日期的数据？**

A: 程序会自动识别所有日期的数据，按日期分别统计和归档。

**Q: 报告中的时间是本地时间吗？**

A: 是的，所有时间都使用解析时的本地时区。

## 许可证

MIT License

## 更新日志

### v1.0.0 (2026-05-03)
- 初始版本发布
- 支持温度CSV解析
- 支持照片文件名解析
- 支持开门日志解析
- 支持7种异常检测
- 支持文件归档
- 支持Markdown/CSV/JSON报告输出
