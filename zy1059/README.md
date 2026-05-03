# 日程合并清理工具 (Schedule Cleaner)

一个用于合并和清理来自多个来源的日程文件的本地工具。支持 .ics 和 CSV 格式的日程文件，能够处理时区差异、重复事件、跨天活动，并自动检测冲突。

## 功能特性

- **多格式支持**: 递归导入目录中的 .ics 和 CSV 日程文件
- **时区统一**: 将不同时区的事件自动转换到目标时区（默认亚洲/上海）
- **重复事件展开**: 支持展开 RRULE 重复规则，包括 DAILY/WEEKLY/MONTHLY/YEARLY 频率
- **全天事件处理**: 正确识别和规范化全天事件
- **跨天事件检测**: 识别跨越多天的事件并给出提示
- **智能去重**: 合并疑似重复的事件（同一天、标题相近、地点相同）
- **冲突检测**:
  - 时间重叠检测
  - 通勤缓冲不足检测
  - 地点互斥冲突（同一天无法同时出现在学校和公司）
  - 缺标题/缺结束时间/时区不明检测

## 项目结构

```
schedule-cleaner/
├── main.py                    # 命令行入口
├── requirements.txt           # Python 依赖
├── config/
│   └── csv_mapping.yaml       # CSV 字段映射配置
├── examples/                  # 示例文件
│   ├── school_schedule.ics    # 学校课程表示例
│   ├── parttime_schedule.csv  # 兼职排班示例
│   ├── fitness_schedule.csv   # 健身预约示例
│   └── friend_events.ics      # 朋友活动示例
├── output/                    # 输出目录
└── src/
    ├── __init__.py
    ├── models/
    │   ├── __init__.py
    │   └── event.py            # 事件数据模型
    ├── parsers/
    │   ├── __init__.py
    │   ├── ics_parser.py       # ICS 文件解析器
    │   └── csv_parser.py       # CSV 文件解析器
    ├── normalizer/
    │   ├── __init__.py
    │   └── normalizer.py       # 事件规范化（时区、重复事件展开）
    ├── deduplicator/
    │   ├── __init__.py
    │   └── merger.py           # 重复事件合并
    ├── conflict/
    │   ├── __init__.py
    │   └── detector.py         # 冲突检测
    ├── exporter/
    │   ├── __init__.py
    │   ├── ics_exporter.py     # ICS 导出
    │   ├── csv_exporter.py     # CSV 冲突报告导出
    │   └── report_exporter.py  # Markdown/HTML 报告导出
    └── utils/
        └── __init__.py
```

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 运行示例

```bash
# 处理 examples 目录下的所有日程文件
python main.py -i ./examples -o ./output

# 查看详细输出
python main.py -i ./examples -o ./output -v
```

### 命令行参数

```bash
usage: main.py [-h] -i INPUT [-o OUTPUT] [--no-recursive] [--timezone TIMEZONE]
               [--csv-profile CSV_PROFILE] [--csv-mapping CSV_MAPPING] [--no-merge]
               [--no-expand-recurrence] [--commute-buffer COMMUTE_BUFFER]
               [--title-similarity TITLE_SIMILARITY] [--recurrence-limit RECURRENCE_LIMIT]
               [--recurrence-months RECURRENCE_MONTHS] [-v]

日程合并清理工具 - 合并和清理来自多个来源的日程文件

可选参数:
  -h, --help            显示帮助信息
  -i INPUT, --input INPUT
                        输入目录或文件路径 (必需)
  -o OUTPUT, --output OUTPUT
                        输出目录路径 (默认: ./output)
  --no-recursive        不递归搜索子目录
  --timezone TIMEZONE   目标时区 (默认: Asia/Shanghai)
  --csv-profile CSV_PROFILE
                        CSV 解析配置文件 (default/school/parttime/fitness)
  --csv-mapping CSV_MAPPING
                        自定义 CSV 字段映射配置文件路径
  --no-merge            禁用重复事件合并
  --no-expand-recurrence
                        不展开重复事件
  --commute-buffer COMMUTE_BUFFER
                        通勤缓冲时间（分钟，默认: 30）
  --title-similarity TITLE_SIMILARITY
                        标题相似度阈值 (0.0-1.0，默认: 0.7)
  --recurrence-limit RECURRENCE_LIMIT
                        重复事件展开最大数量 (默认: 100)
  --recurrence-months RECURRENCE_MONTHS
                        重复事件展开最大月数 (默认: 12)
  -v, --verbose         显示详细输出
```

### 常用示例

```bash
# 处理单个文件
python main.py -i ./my_schedule.ics -o ./output

# 不递归搜索子目录
python main.py -i ./schedules --no-recursive

# 指定时区
python main.py -i ./examples --timezone "America/New_York"

# 禁用重复事件合并
python main.py -i ./examples --no-merge

# 自定义通勤缓冲时间为 45 分钟
python main.py -i ./examples --commute-buffer 45

# 调整标题相似度阈值为 0.8
python main.py -i ./examples --title-similarity 0.8
```

## 输出文件说明

运行工具后，输出目录会包含以下文件：

### 1. `clean.ics`

清理后的日程文件，可直接导入到日历应用（苹果日历、Google 日历、Outlook 等）。

### 2. `conflicts.csv`

冲突明细表格，包含以下列：
- 序号
- 冲突类型
- 严重程度
- 涉及事件数
- 事件标题
- 事件来源文件
- 事件时间
- 事件地点
- 冲突描述
- 建议处理方式

### 3. `parse_errors.csv`

如果解析过程中遇到错误或警告，会生成此文件，包含：
- 序号
- 错误类型
- 严重程度
- 源文件
- 行号
- 事件标题
- 错误信息

### 4. `report.md` 和 `report.html`

完整的处理报告，包含：
- 概览统计
- 来源文件统计
- 已合并的事件详情
- 冲突检测结果（按严重程度分类）
- 解析错误详情
- 导出文件说明

## 配置说明

### CSV 字段映射

工具支持多种 CSV 格式，通过 `config/csv_mapping.yaml` 配置字段映射。

#### 默认支持的字段名

**标题字段**: 标题、主题、事件、活动、name、title、summary、subject、event

**开始时间**: 开始时间、开始日期、日期、start、start_time、start_date、dtstart、begin、date

**结束时间**: 结束时间、结束日期、end、end_time、end_date、dtend、finish

**地点**: 地点、位置、location、place、venue、地址、address

**描述**: 描述、详情、说明、备注、description、notes、detail、comment

#### 预设配置文件

- `default`: 默认配置，适用于通用 CSV 格式
- `school`: 学校课程表格式
- `parttime`: 兼职排班格式
- `fitness`: 健身预约格式

#### 自定义映射

复制 `config/csv_mapping.yaml` 并修改，然后使用 `--csv-mapping` 参数指定：

```bash
python main.py -i ./my_data --csv-mapping ./my_mapping.yaml
```

### 时区

默认目标时区是 `Asia/Shanghai`（北京时间）。可以通过 `--timezone` 参数修改：

```bash
# 常用时区
--timezone "Asia/Shanghai"   # 北京/上海
--timezone "Asia/Tokyo"       # 东京
--timezone "America/New_York" # 纽约
--timezone "Europe/London"    # 伦敦
--timezone "Europe/Paris"     # 巴黎
```

查看所有可用时区：
```python
import pytz
for tz in pytz.all_timezones:
    print(tz)
```

## 冲突类型说明

### 🔴 严重错误

| 类型 | 说明 |
|------|------|
| 时间重叠 | 两个事件时间重叠超过 30 分钟 |
| 结束时间无效 | 结束时间早于或等于开始时间 |
| 缺少标题 | 事件没有标题 |
| 持续时间无效 | 持续时间为零或负数 |

### 🟡 警告

| 类型 | 说明 |
|------|------|
| 时间重叠 | 两个事件时间重叠少于 30 分钟 |
| 通勤缓冲不足 | 两个不同地点的事件之间间隔小于设置的缓冲时间（默认 30 分钟） |
| 地点互斥冲突 | 同一天出现位于互斥地点组的事件（如学校和公司） |
| 缺少地点 | 事件没有地点信息（影响通勤缓冲检测） |

### ℹ️ 提示信息

| 类型 | 说明 |
|------|------|
| 跨天事件 | 事件跨越多天 |
| 未展开重复事件 | 事件是重复事件但未展开 |

## 示例数据说明

`examples/` 目录包含了多种场景的示例文件：

### school_schedule.ics
- 每周重复的课程（高等数学、大学物理、程序设计）
- 全天事件（期中考试周）
- 单次活动（社团活动）

### parttime_schedule.csv
- 中文表头格式
- 兼职排班数据
- 包含时长字段

### fitness_schedule.csv
- 使用"预约时间"作为开始时间字段
- 健身课程预约
- 不同场馆的课程

### friend_events.ics
- 不同时区的事件（纽约时区的视频会议）
- 跨天事件（生日派对 20:00 - 次日 02:00）
- 与 school_schedule.ics 重复的"高等数学"事件（测试合并功能）
- 缺少描述的事件（午餐）

## 验证异常输入

工具能够优雅处理以下异常情况：

### 缺字段
- 缺少标题：记录错误并使用"未命名事件"
- 缺少结束时间：记录警告并默认使用开始时间 + 1 小时
- 缺少地点：记录提示信息

### 时间格式错误
- 无法解析的时间格式：记录错误，包含具体文件和行号
- 结束时间早于开始时间：记录错误

### 时区问题
- 无时区信息（naive datetime）：记录警告，使用默认时区
- 无效时区名称：记录警告，使用默认时区
- 不同时区的事件：自动转换到目标时区

### 文件问题
- 文件不存在：记录错误
- 空文件：记录错误
- 编码问题：尝试 UTF-8 和 GBK 编码
- 解析错误：记录具体错误信息和位置

## 开发说明

### 模块职责

| 模块 | 职责 |
|------|------|
| `src/models/event.py` | 事件数据模型定义 |
| `src/parsers/ics_parser.py` | 解析 .ics 文件 |
| `src/parsers/csv_parser.py` | 解析 CSV 文件，支持字段映射 |
| `src/normalizer/normalizer.py` | 时区统一、重复事件展开 |
| `src/deduplicator/merger.py` | 检测并合并重复事件 |
| `src/conflict/detector.py` | 检测各类冲突 |
| `src/exporter/` | 导出 ICS、CSV 报告、Markdown/HTML 报告 |

### 添加新的冲突检测规则

在 `src/conflict/detector.py` 中的 `ConflictDetector` 类添加新方法，然后在 `detect_all` 方法中调用：

```python
def detect_my_new_rule(self, events: List[Event]) -> List[Conflict]:
    conflicts = []
    # 实现检测逻辑
    return conflicts
```

### 扩展 CSV 字段映射

编辑 `config/csv_mapping.yaml`，在对应配置项下添加新的字段名：

```yaml
default:
  title:
    - "标题"
    - "我的自定义字段名"  # 添加新字段
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
