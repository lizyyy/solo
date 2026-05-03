# Flight Precheck - 电力巡检航线合规预检 CLI

离线航线合规预检工具，专为电力巡检班组设计。

## 功能特性

- **多源数据解析**：支持航点 CSV、禁飞/限高区 GeoJSON、机型能力 YAML 和天气 CSV
- **几何计算**：航段距离、方位角、点在多边形内、线段相交检测
- **合规检查**：
  - 禁飞区相交检测
  - 高度限制检查
  - 天气限制验证（风速、温度、能见度、降水）
  - 逆风续航余量计算
  - 返航点风险评估
- **报告导出**：
  - `risk_events.csv` - 风险事件明细
  - `flight_brief.md` - 飞行简报
  - `map_preview.html` - 交互式地图预览（可直接在浏览器打开）

## 边界情况处理

- **跨午夜天气窗口**：正确处理 `23:00-02:00` 这类跨越午夜的时间范围
- **航点缺少返航点**：当没有显式返航点时，自动使用起飞机场作为返航点备选

## 安装

```bash
# 进入项目目录
cd flight_precheck

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

## 快速开始

### 使用内置示例数据运行

```bash
# 使用内置示例数据运行预检
flight-precheck check --use-sample --output-dir ./output
```

或者使用简写：

```bash
flight-precheck check -s -o ./output
```

### 使用自定义数据

```bash
# 提取示例输入文件到当前目录
flight-precheck samples -o my_inputs

# 使用自定义文件运行
flight-precheck check \
  --waypoints my_inputs/waypoints.csv \
  --zones my_inputs/restricted_zones.geojson \
  --aircraft my_inputs/aircraft.yaml \
  --weather my_inputs/weather.csv \
  --output-dir ./my_output \
  --flight-name "110kV 北线巡检"
```

## 输入文件格式

### 1. 航点 CSV (waypoints.csv)

```csv
id,latitude,longitude,altitude,is_home,is_return_point,sequence
HOME,39.9042,116.4074,50,true,false,1
WP001,39.9055,116.4085,80,false,false,2
WP002,39.9068,116.4096,80,false,false,3
```

字段说明：
- `id`: 航点标识
- `latitude`, `longitude`: 经纬度坐标（WGS84）
- `altitude`: 飞行高度（米）
- `is_home`: 是否为起飞机场（true/false）
- `is_return_point`: 是否为返航点（true/false）
- `sequence`: 飞行顺序

### 2. 禁飞/限高区 GeoJSON (restricted_zones.geojson)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "NFZ001",
        "name": "机场禁飞区",
        "zone_type": "no_fly"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [...]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "id": "HRZ001",
        "name": "电厂限高区",
        "zone_type": "restricted_height",
        "max_altitude": 60
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [...]
      }
    }
  ]
}
```

支持的区域类型：
- `no_fly`: 禁飞区（完全禁止进入）
- `restricted_height`: 限高区（有最大高度限制）
- `warning`: 警告区（需要注意）

### 3. 机型能力 YAML (aircraft.yaml)

```yaml
aircraft:
  model: "DJI Matrice 300 RTK"
  
  performance:
    max_speed: 23.0
    cruise_speed: 15.0
    max_altitude: 120.0
    max_flight_time: 40.0
    range: 15000.0
  
  limits:
    weather_limits:
      max_wind_speed: 12.0
      max_crosswind: 8.0
      max_gust: 15.0
      min_temperature: -20.0
      max_temperature: 40.0
      min_visibility: 1000.0
      max_precipitation: 0.0
```

### 4. 天气 CSV (weather.csv)

```csv
start_time,end_time,wind_direction,wind_speed,temperature,visibility,precipitation
06:00,09:00,270,5,18,5000,0
09:00,12:00,280,8,22,8000,0
23:00,02:00,330,2,15,2000,0
```

字段说明：
- `start_time`, `end_time`: 时间窗口（HH:MM 格式，支持跨午夜如 23:00-02:00）
- `wind_direction`: 风向（度，0-360，风从哪个方向来）
- `wind_speed`: 风速（m/s）
- `temperature`: 温度（摄氏度）
- `visibility`: 能见度（米）
- `precipitation`: 降水量（mm/hr）

## 输出文件说明

### 1. risk_events.csv

包含所有检测到的风险事件，字段包括：
- `risk_id`: 风险编号
- `category`: 风险类别（no_fly_zone, height_restriction, weather_limit, headwind_range, return_point, aircraft_limit）
- `level`: 风险级别（critical, high, medium, low, info）
- `description`: 风险描述
- `location_lat/location_lon`: 位置坐标
- `waypoint_id`: 相关航点ID
- `segment_index`: 相关航段索引
- `details`: 详细信息

### 2. flight_brief.md

Markdown 格式的飞行简报，包含：
- 执行摘要（是否建议飞行）
- 风险汇总（按级别和类别统计）
- 详细风险事件（非 INFO 级别优先）
- 飞行计划（航点和航段详情）
- 飞机能力参数

### 3. map_preview.html

交互式地图预览，可以直接在浏览器中打开。使用 Leaflet.js 和 OpenStreetMap 底图，显示：
- 飞行航线（蓝色线条）
- 航点标记（蓝色圆圈，HOME为绿色）
- 禁飞区（红色半透明多边形）
- 限高区（橙色半透明多边形）
- 风险事件标记（按级别不同颜色）

点击地图元素可查看详细信息。

## 命令行参考

### check 命令

```bash
flight-precheck check [OPTIONS]

选项：
  -w, --waypoints PATH    航点 CSV 文件路径
  -z, --zones PATH        禁飞区 GeoJSON 文件路径
  -a, --aircraft PATH     机型 YAML 文件路径
  -wth, --weather PATH    天气 CSV 文件路径
  -o, --output-dir PATH   输出目录（默认：当前目录）
  -n, --flight-name TEXT  飞行名称（用于报告）
  -s, --use-sample        使用内置示例数据
  -v, --verbose           显示详细输出
  --help                  显示帮助信息
```

### samples 命令

```bash
flight-precheck samples [OPTIONS]

选项：
  -o, --output-dir PATH   输出目录（默认：sample_inputs）
  --help                  显示帮助信息
```

## 项目结构

```
flight_precheck/
├── __init__.py
├── cli.py                    # CLI 入口
├── parsers/
│   ├── __init__.py
│   ├── csv_parser.py         # 航点和天气 CSV 解析
│   ├── geojson_parser.py     # 禁飞区 GeoJSON 解析
│   └── yaml_parser.py        # 机型 YAML 解析
├── calculators/
│   ├── __init__.py
│   ├── geometry.py           # 几何计算（距离、相交检测等）
│   └── rules.py              # 合规规则计算
├── exporters/
│   ├── __init__.py
│   ├── csv_exporter.py       # CSV 报告导出
│   ├── md_exporter.py        # Markdown 简报导出
│   └── html_exporter.py      # HTML 地图预览导出
└── sample_data/              # 内置示例数据
    ├── __init__.py
    ├── waypoints.csv
    ├── restricted_zones.geojson
    ├── aircraft.yaml
    └── weather.csv
```

## 依赖项

- Python >= 3.8
- click >= 8.0.0
- pyyaml >= 6.0
- geojson >= 3.0.0
- jinja2 >= 3.0.0

## Demo 命令（可复现）

完整的演示流程：

```bash
# 1. 安装
pip install -e .

# 2. 运行示例（使用内置数据）
flight-precheck check --use-sample --output-dir ./demo_output --verbose

# 3. 查看输出
ls -la ./demo_output/

# 4. 在浏览器中打开地图预览
# macOS: open ./demo_output/map_preview.html
# Windows: start ./demo_output/map_preview.html
# Linux: xdg-open ./demo_output/map_preview.html

# 5. 查看飞行简报
cat ./demo_output/flight_brief.md

# 6. 查看风险事件
cat ./demo_output/risk_events.csv
```

预期输出示例：

```
📋 Flight Precheck v0.1.0
==================================================
Calculating flight segments...
Running compliance checks...
  - Critical risks: 1
  - High risks: 2
  - Medium risks: 3
⚠️  CRITICAL risks detected! Flight NOT recommended.
Generating reports...
  - demo_output/risk_events.csv
  - demo_output/flight_brief.md
  - demo_output/map_preview.html
==================================================
✅ Pre-check complete!
   Reports saved to: /path/to/demo_output
   Open map_preview.html in a browser to view the map.
```
