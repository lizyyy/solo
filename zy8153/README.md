# GNSS Checker - GNSS 静态观测成果复核工具

一款本地 Python CLI 工具，用于测绘队在提交 GNSS 静态观测成果前进行离线复核。

## 功能特性

- **RINEX 解析**: 支持 RINEX 2.x 和 3.x 格式的观测文件
- **多维度验证**:
  - 观测时长统计
  - 采样间隔检测（支持混合采样率）
  - 缺历元统计
  - 周跳疑点检测
  - 坐标一致性验证
  - 天线高一致性验证
- **边界处理**:
  - 跨 UTC 日期处理
  - 缺少 END OF HEADER 标记处理
  - 不完整观测记录处理
- **报告输出**:
  - `issues.csv`: 问题列表（CSV 格式）
  - `rinex_report.md`: 详细报告（Markdown 格式）
  - `timeline.html`: 交互式时间线可视化

## 安装

### 环境要求

- Python 3.8+
- 依赖包：pyyaml, pandas, jinja2

### 安装步骤

```bash
# 克隆或下载项目到本地
cd zy8153

# 安装依赖
pip install -e .
```

或者手动安装依赖：

```bash
pip install pyyaml pandas jinja2
```

## 使用方法

### 命令行参数

```bash
gnss-checker --help
```

```
usage: gnss-checker [-h] --rinex RINEX [RINEX ...] [--stations STATIONS]
                    [--sessions SESSIONS] [--output OUTPUT] [--verbose]
                    [--version]

GNSS 静态观测成果离线复核工具

optional arguments:
  -h, --help            show this help message and exit
  --rinex RINEX [RINEX ...], -r RINEX [RINEX ...]
                        RINEX 观测文件路径（支持目录、通配符）
  --stations STATIONS, -s STATIONS
                        基站台账 CSV 文件路径
  --sessions SESSIONS, -p SESSIONS
                        测段计划 YAML 文件路径
  --output OUTPUT, -o OUTPUT
                        输出目录（默认: 当前目录）
  --verbose, -v         显示详细信息
  --version             show program's version number and exit
```

### 快速开始（Demo）

项目包含一组可运行的样例数据，位于 `demo/` 目录下。

#### 运行完整演示

```bash
# 使用样例数据运行完整复核流程
gnss-checker \
  --rinex demo/obs/ \
  --stations demo/stations.csv \
  --sessions demo/sessions.yaml \
  --output demo/reports/ \
  --verbose
```

#### 简化演示（仅检查 RINEX 文件）

```bash
# 仅检查 RINEX 文件质量，不比对台账和计划
gnss-checker --rinex demo/obs/ --output demo/reports/
```

#### 使用通配符

```bash
# 使用通配符指定 RINEX 文件
gnss-checker --rinex demo/obs/*.??O --output demo/reports/
```

## 输入文件格式

### 1. 基站台账 CSV

```csv
station_name,marker_number,x,y,z,antenna_height,antenna_type,receiver_type,notes
BJFS,10001,-2172845.8673,4495235.3291,3893559.2015,1.4500,TRM59800.00,TRIMBLE NETR9,北京房山站
SHAO,10002,-2834796.9941,4669981.0889,3268037.1865,1.5420,TRM59800.00,TRIMBLE NETR8,上海佘山站
```

**字段说明：**

| 字段 | 说明 | 示例 |
|------|------|------|
| station_name | 基站名（必填） | BJFS |
| marker_number | 点号 | 10001 |
| x, y, z | ITRF 坐标（米） | -2172845.8673 |
| antenna_height | 天线高（米） | 1.4500 |
| antenna_type | 天线类型 | TRM59800.00 |
| receiver_type | 接收机类型 | TRIMBLE NETR9 |
| notes | 备注 | 北京房山站 |

**注意：** 支持中文字段名别名：
- `站名` = `station_name`
- `点号` = `marker_number`
- `X坐标`/`X` = `x`
- `Y坐标`/`Y` = `y`
- `Z坐标`/`Z` = `z`
- `天线高`/`ant_h` = `antenna_height`

### 2. 测段计划 YAML

```yaml
# 测段计划配置
sessions:
  - session_name: "BJFS_2024_001"
    station_name: "BJFS"
    start_time: "2024-01-01 00:00:00"
    end_time: "2024-01-01 06:00:00"
    interval: 30.0
    antenna_height: 1.4500
    notes: "6小时静态观测"

  - session_name: "SHAO_2024_001"
    station_name: "SHAO"
    start_time: "2024-01-01 00:00:00"
    end_time: "2024-01-01 08:00:00"
    duration_hours: 8.0
    interval: 30.0
    notes: "8小时静态观测"
```

**字段说明：**

| 字段 | 说明 | 示例 |
|------|------|------|
| session_name | 测段名称 | BJFS_2024_001 |
| station_name | 基站名（必填） | BJFS |
| start_time | 开始时间 | 2024-01-01 00:00:00 |
| end_time | 结束时间 | 2024-01-01 06:00:00 |
| duration_hours | 期望时长（小时，可选） | 6.0 |
| interval | 采样间隔（秒） | 30.0 |
| antenna_height | 天线高（米） | 1.4500 |
| notes | 备注 | 6小时静态观测 |

### 3. RINEX 观测文件

支持标准 RINEX 2.x 和 3.x 格式的观测文件，常见扩展名：
- `.??O` (如 `.24O`, `.23O`)
- `.obs`
- `.*O`

## 输出文件说明

### 1. issues.csv

问题列表文件，包含所有检测到的问题。

**字段：**

| 字段 | 说明 |
|------|------|
| 问题编号 | 唯一标识符（如 ISS0001） |
| 基站名 | 相关基站名称 |
| 测段名 | 相关测段名称（如有） |
| 问题类型 | 问题分类 |
| 严重程度 | error/warning/info |
| 问题描述 | 详细描述 |
| RINEX文件 | 相关文件路径 |
| 时间戳 | 问题发生时间（如有） |
| 详细信息 | JSON 格式的额外信息 |

### 2. rinex_report.md

详细的 Markdown 格式报告，包含：

- **执行摘要**: 数据统计概览
- **问题详情**: 按基站分类的问题列表
- **基站信息详情**: 所有基站的台账信息
- **RINEX 文件统计**: 每个文件的详细统计
- **图例**: 问题类型和严重程度说明

### 3. timeline.html

交互式时间线可视化页面，使用浏览器打开查看。

**功能：**

- 观测时段可视化（实际 vs 计划）
- 问题点标记（红色=错误，黄色=警告）
- 鼠标悬停显示详细信息
- 问题列表表格

## 问题类型说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| header_error | warning | 文件缺少 END OF HEADER 标记 |
| interval_mixed | warning | 检测到混合采样率 |
| missing_epochs | warning | 检测到缺历元 |
| cycle_slips | warning | 检测到周跳疑点 |
| cycle_slip | warning | 周跳疑点详情 |
| short_duration | warning | 观测时长较短（<1小时） |
| high_missing_rate | warning/error | 缺历元率过高 (>5%) |
| coordinate_mismatch | warning/error | 坐标与台账不一致 (>1米) |
| antenna_height_mismatch | warning/error | 天线高与台账不一致 (>1mm) |
| station_not_found | warning | 基站名未在台账中找到 |
| duration_shortfall | warning/error | 观测时长不足（与计划比对） |
| missing_data | error | 计划测段缺少观测数据 |
| file_missing | error | 输入文件不存在 |
| file_error | error | 文件读取错误 |
| parse_error | error | RINEX 解析失败 |

## 样例数据说明

`demo/` 目录下的样例数据包含故意设置的问题，用于演示工具的检测能力：

| 文件 | 预设问题 |
|------|----------|
| BJFS0010.24O | 正常文件（有少量缺历元） |
| SHAO0010.24O | 天线高不一致（台账1.5420m vs RINEX 1.6000m）+ 缺历元 |
| WUHN0010.24O | 缺少 END OF HEADER 标记 + 混合采样率（15s/30s） |

运行 demo 后，工具将检测到这些问题并在报告中列出。

## 项目结构

```
zy8153/
├── gnss_checker/
│   ├── __init__.py      # 包初始化
│   ├── main.py          # CLI 主入口
│   ├── rinex_parser.py  # RINEX 文件解析
│   ├── validator.py     # 数据验证逻辑
│   └── reporter.py      # 报告生成
├── demo/
│   ├── stations.csv     # 样例基站台账
│   ├── sessions.yaml    # 样例测段计划
│   └── obs/             # 样例 RINEX 文件
│       ├── BJFS0010.24O
│       ├── SHAO0010.24O
│       └── WUHN0010.24O
├── setup.py             # 安装配置
└── README.md            # 本文档
```

## 注意事项

1. **离线使用**: 本工具完全离线运行，无需网络连接
2. **数据隐私**: 所有数据仅在本地处理，不会上传
3. **RINEX 支持**: 主要支持 RINEX 2.x 格式，3.x 格式为基础支持
4. **边界情况**: 工具会处理常见的异常情况，但极端格式错误可能导致解析失败

## License

MIT License

## 技术支持

如遇到问题，请检查：
1. Python 版本是否 >= 3.8
2. 依赖包是否正确安装
3. 输入文件格式是否符合要求
