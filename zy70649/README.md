# 房态日历连住区间锁房冲突检测CLI工具

民宿管家从不同平台导出房态日历，格式各不相同，手工合并后常把连住拆错。这个工具专门用于解析、合并多平台预订数据，检测锁房冲突。

## 功能特性

- ✅ **多格式支持**: 支持Airbnb/途家/美团等平台的CSV格式，支持ICS/iCalendar格式
- 🔄 **连住区间合并**: 智能识别同一客人的连续预订并合并，避免拆分错误
- 🔍 **冲突检测**: 
  - 重叠预订检测
  - 同日退房入住提醒
  - 空房缺口提示
- 📍 **来源追踪**: 每条数据保留原始文件位置，便于复查
- 📊 **报告输出**: 支持文本和JSON格式报告

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本用法

```bash
# 解析单个文件，在终端显示报告
python main.py airbnb.csv

# 解析多个文件，输出文本报告
python main.py airbnb.csv tujia.ics --output-text report.txt

# 解析多个文件，输出JSON报告
python main.py bookings/*.csv --output-json report.json

# 显示房间日历视图
python main.py calendar.ics --show-calendar
```

### 命令行参数

```
positional arguments:
  input_files           输入文件路径 (支持CSV和ICS格式)

optional arguments:
  -h, --help            show this help message and exit
  --output-text OUTPUT_TEXT, -t OUTPUT_TEXT
                        输出文本报告路径
  --output-json OUTPUT_JSON, -j OUTPUT_JSON
                        输出JSON报告路径
  --show-calendar, -c   显示房间日历视图
```

## CSV格式要求

工具会自动识别以下列名：
- 房源信息: `room_id`, `listing_id`, `房源编号`, `room_name`, `房源名称`, `房间名称`
- 日期信息: `checkin`, `check_in`, `入住日期`, `checkout`, `退房日期`
- 客人信息: `guest_name`, `客人姓名`, `宾客姓名`
- 订单状态: `status`, `状态`
- 订单ID: `booking_id`, `confirmation_code`, `订单号`

## 支持的日期格式

- `YYYY-MM-DD`
- `MM/DD/YYYY`
- `DD/MM/YYYY`
- `YYYY/MM/DD`
- `YYYY-MM-DD HH:MM:SS`
- `YYYYMMDD`

## 项目结构

```
.
├── models.py            # 核心数据模型（预订区间、冲突、解析错误等）
├── csv_parser.py        # CSV格式解析器（支持多平台格式）
├── ics_parser.py        # ICS/iCalendar格式解析器
├── interval_merger.py   # 连住区间合并算法
├── conflict_detector.py # 冲突检测引擎
├── report_generator.py  # 报告生成器
├── main.py              # CLI主程序
└── requirements.txt     # 依赖文件
```

## 退出码说明

- `0`: 成功，无冲突
- `1`: 有解析错误
- `2`: 有冲突发现

## 示例数据

查看 `examples/` 目录下的示例文件：

```bash
# 运行示例
python main.py examples/airbnb.csv examples/tujia.csv -t report.txt
```
