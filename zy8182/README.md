# 侧扫声呐测线覆盖复核工具

一个用于复核水下侧扫声呐当天测线覆盖情况的 Python CLI 工具。

## 功能特性

- **数据导入**
  - 测线计划 CSV
  - 导航轨迹 JSONL
  - 声呐参数 YAML
  - 禁采区规则 YAML

- **覆盖计算**
  - 覆盖带计算
  - 漏扫缝隙检测
  - 重叠浪费分析

- **风险检测**
  - 速度突变检测
  - 轨迹乱序检测
  - 跨午夜时间处理

- **报告导出**
  - `issues.csv` - 问题列表
  - `coverage_report.md` - 详细报告
  - `coverage_preview.html` - 交互式地图预览

## 安装

```bash
pip install -e .
```

## 快速开始

### 使用示例数据

首先，生成示例数据：

```bash
sonar-check generate-sample -o sample_data
```

或者使用项目中的 `samples/` 目录下的预置数据。

### 运行复核

```bash
sonar-check check \
  -s samples/survey_lines.csv \
  -t samples/track.jsonl \
  -p samples/sonar_params.yaml \
  -z samples/exclusion_zones.yaml \
  -o output \
  -v
```

### 参数说明

| 参数 | 简写 | 说明 | 必填 |
|------|------|------|------|
| `--survey-lines` | `-s` | 测线计划 CSV 文件 | 是 |
| `--track` | `-t` | 导航轨迹 JSONL 文件 | 是 |
| `--sonar-params` | `-p` | 声呐参数 YAML 文件 | 是 |
| `--exclusion-zones` | `-z` | 禁采区规则 YAML 文件 | 否 |
| `--config` | `-c` | 配置文件 YAML | 否 |
| `--date` | `-d` | 基准日期 (YYYY-MM-DD)，用于跨午夜处理 | 否 |
| `--output-dir` | `-o` | 输出目录 (默认: 当前目录) | 否 |
| `--verbose` | `-v` | 显示详细输出 | 否 |

### 退出码

- `0`: 正常，无严重问题
- `1`: 存在 HIGH 级别问题或覆盖率 < 90%
- `2`: 存在 CRITICAL 级别问题或覆盖率 < 80%

## 数据格式

### 测线计划 CSV (`survey_lines.csv`)

```csv
line_id,start_lat,start_lon,end_lat,end_lon,swath_left,swath_right,swath_unit,planned_speed,speed_unit,notes
L001,30.500000,121.000000,30.500000,121.005000,100,100,meters,4,knots,主测线1
```

| 字段 | 说明 |
|------|------|
| `line_id` | 测线唯一标识 |
| `start_lat` / `start_lon` | 起点坐标 |
| `end_lat` / `end_lon` | 终点坐标 |
| `swath_left` / `swath_right` | 计划左右扫幅宽度 |
| `swath_unit` | 扫幅单位: `meters`, `nm` (海里) |
| `planned_speed` | 计划航速 |
| `speed_unit` | 航速单位: `knots`, `m/s`, `km/h` |
| `notes` | 备注 |

### 导航轨迹 JSONL (`track.jsonl`)

每行一个 JSON 对象：

```json
{
  "timestamp": "2026-05-03 10:00:00",
  "latitude": 30.500000,
  "longitude": 121.000000,
  "speed": 4.0,
  "heading": 90.0,
  "depth": 20.0
}
```

| 字段 | 说明 |
|------|------|
| `timestamp` | 时间戳，支持格式: `%H:%M:%S`, `%Y-%m-%d %H:%M:%S` |
| `latitude` / `longitude` | GPS 坐标 |
| `speed` | 航速 (默认单位: 节) |
| `heading` | 艏向 (度) |
| `depth` | 水深 (米) |

**跨午夜处理**: 当轨迹时间跨越午夜时，使用 `--date` 参数指定基准日期：

```bash
sonar-check check ... -d 2026-05-03
```

### 声呐参数 YAML (`sonar_params.yaml`)

```yaml
sonar:
  frequency: 100.0
  swath_left: 100
  swath_right: 100
  range_scale: 100
  tvg: 20
  gain: 0
  unit: meters
```

**单位支持**:
- 距离: `meters` (米), `nm` (海里)
- 航速: `knots` (节), `m/s` (米/秒), `km/h` (公里/小时)

### 禁采区规则 YAML (`exclusion_zones.yaml`)

```yaml
exclusion_zones:
  - zone_id: Z001
    name: 养殖区A
    reason: 渔业养殖区，禁止进入
    priority: 1
    polygon:
      - lat: 30.5030
        lon: 121.0020
      - lat: 30.5030
        lon: 121.0035
      - lat: 30.5050
        lon: 121.0035
      - lat: 30.5050
        lon: 121.0020
```

## 输出文件说明

### issues.csv

所有检测到的问题列表：

| 列名 | 说明 |
|------|------|
| `issue_id` | 问题唯一标识 |
| `issue_type` | 问题类型: `gap`, `overlap`, `speed_spike`, `out_of_order` |
| `severity` | 严重程度: `critical`, `high`, `medium`, `low` |
| `description` | 问题描述 |
| `latitude` / `longitude` | 问题位置 |
| `start_time` / `end_time` | 问题时间范围 |
| `related_line` | 关联测线 |
| `track_indices` | 关联轨迹点索引 |
| `metrics` | 详细指标 |

### coverage_report.md

Markdown 格式的详细报告，包含：
- 摘要统计
- 速度统计
- 问题统计 (按类型、严重程度)
- 问题详情
- 各测线详细信息

### coverage_preview.html

交互式地图预览，使用 Leaflet + OpenStreetMap：
- 蓝色虚线: 计划测线
- 绿色实线: 实际轨迹
- 彩色圆点: 问题点 (颜色表示严重程度)

直接用浏览器打开即可查看。

## 问题类型

| 类型 | 说明 |
|------|------|
| `gap` | 漏扫缝隙 - 测线未被完全覆盖 |
| `overlap` | 重叠浪费 - 相邻测线重叠过多 |
| `speed_spike` | 速度突变 - 航速变化过大 |
| `out_of_order` | 轨迹乱序 - 时间戳逆序 |

## 严重程度分级

| 级别 | 说明 |
|------|------|
| `CRITICAL` | 严重: 完全漏扫 (>50m)、速度突变 (>10节) |
| `HIGH` | 高: 漏扫 (>20m)、速度突变 (>5节) |
| `MEDIUM` | 中: 漏扫 (>10m)、速度突变 (>3节) |
| `LOW` | 低: 小范围异常 |

## 配置文件示例

可以通过 `--config` 参数传入额外配置：

```yaml
coverage:
  snap_distance_m: 50.0
  min_gap_threshold_m: 2.0
  min_overlap_threshold_m: 5.0

risk:
  speed_spike_threshold_ratio: 2.0
  speed_spike_threshold_abs: 5.0
  min_time_gap_seconds: 1.0
```

## Demo 命令

完整的演示流程：

```bash
# 1. 查看版本
sonar-check --version

# 2. 生成示例数据
sonar-check generate-sample -o demo_data

# 3. 运行复核
sonar-check check \
  -s demo_data/survey_lines.csv \
  -t demo_data/track.jsonl \
  -p demo_data/sonar_params.yaml \
  -z demo_data/exclusion_zones.yaml \
  -o demo_output \
  -v

# 4. 查看输出
ls -la demo_output/

# 5. 打开地图预览
open demo_output/coverage_preview.html
```

## 项目结构

```
zy8182/
├── pyproject.toml          # 项目配置
├── README.md               # 本文档
├── sonar_coverage/
│   ├── __init__.py
│   ├── main.py             # CLI 入口
│   ├── models.py           # 数据模型
│   ├── geo.py              # 地理计算
│   ├── units.py            # 单位转换
│   ├── time_utils.py       # 时间处理 (跨午夜)
│   ├── loaders.py          # 数据加载器
│   ├── coverage.py         # 覆盖计算
│   ├── risk_detection.py   # 风险检测
│   └── reports.py          # 报告生成
└── samples/                # 示例数据
    ├── survey_lines.csv
    ├── track.jsonl
    ├── sonar_params.yaml
    └── exclusion_zones.yaml
```

## License

MIT
