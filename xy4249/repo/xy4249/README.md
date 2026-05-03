# 野外踏勘风险计算员 (Field Risk Calculator)

地质野外队出发前路线复核的命令行工具，用于评估坡度过陡、涉水点超警戒、补给间隔太长或队员负重超限等风险。

## 功能特性

- **文件解析**：支持 GPX 路线、DEM 高程 CSV、队员负重表 CSV、天气预报 JSON
- **地形计算**：分段坡度、累计爬升、预计耗时、预计耗水
- **风险评估**：
  - 坡度风险（平缓/缓坡/中等/陡坡/极陡坡）
  - 涉水风险（警戒深度/危险深度）
  - 负重风险（超重检测、负重比例）
  - 补给风险（补给间隔过长）
  - 天气风险（大风、降雨、极端温度）
- **输出格式**：
  - Markdown 行程建议报告
  - CSV 风险点/撤返点/补给点列表
  - JSON 完整审计包

## 安装

### 环境要求

- Python 3.8+
- pip 包管理工具

### 安装步骤

```bash
# 克隆项目或下载代码
cd field-risk-calculator

# 安装依赖
pip install -r requirements.txt

# 安装命令行工具（可选）
pip install -e .
```

## 使用方法

### 命令行接口

安装后可使用 `field-risk-calc` 命令：

```bash
# 查看帮助
field-risk-calc --help
field-risk-calc assess --help
field-risk-calc validate --help
field-risk-calc examples --help
```

### 执行风险评估

```bash
field-risk-calc assess \
    --gpx route.gpx \
    --dem dem.csv \
    --weight weight.csv \
    --weather weather.json \
    --output my_route \
    --output-dir ./results \
    --verbose
```

**参数说明：**

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--gpx` | `-g` | GPX 路线文件路径 | **必需** |
| `--dem` | `-d` | DEM 高程 CSV 文件路径 | **必需** |
| `--weight` | `-w` | 队员负重表 CSV 文件路径 | **必需** |
| `--weather` | `-t` | 天气预报 JSON 文件路径 | **必需** |
| `--output` | `-o` | 输出文件前缀 | 基于当前时间 |
| `--output-dir` | - | 输出目录 | 当前目录 |
| `--max-slope` | - | 最大安全坡度百分比 | 20.0 |
| `--critical-slope` | - | 危险坡度百分比 | 30.0 |
| `--max-weight-ratio` | - | 最大负重比例百分比 | 30.0 |
| `--supply-interval` | - | 建议补给间隔公里数 | 5.0 |
| `--verbose` | `-v` | 显示详细输出 | 关闭 |
| `--dry-run` | - | 仅验证输入，不生成输出 | 关闭 |

### 验证输入文件

```bash
# 验证单个文件
field-risk-calc validate --gpx route.gpx
field-risk-calc validate --dem dem.csv

# 验证所有文件
field-risk-calc validate \
    --gpx route.gpx \
    --dem dem.csv \
    --weight weight.csv \
    --weather weather.json
```

### 查看数据格式说明

```bash
field-risk-calc examples
```

## 输入文件格式

### 1. GPX 路线文件

标准 GPX 1.1 格式，包含路线点（`rtept`）或轨迹（`trkseg/trkpt`）。

**必需字段：**
- 经纬度（`lat`, `lon`）
- 高程（`ele`）- 强烈建议包含

**示例结构：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>踏勘路线</name>
    <rtept lat="34.050000" lon="108.900000">
      <ele>1200.0</ele>
      <name>营地</name>
    </rtept>
    <rtept lat="34.052000" lon="108.901500">
      <ele>1250.0</ele>
    </rtept>
  </rte>
</gpx>
```

### 2. DEM 高程 CSV 文件

**必需列：**
- `lat` - 纬度（十进制）
- `lon` - 经度（十进制）
- `elevation` - 海拔高度（米）

**可选列：**
- `slope` - 坡度百分比
- `aspect` - 坡向（度）

**示例：**
```csv
lat,lon,elevation,slope,aspect
34.050000,108.900000,1200.0,2.5,90.0
34.051000,108.900500,1220.0,5.0,85.0
34.052000,108.901500,1250.0,8.0,80.0
```

### 3. 队员负重表 CSV 文件

**必需列：**
- `name` - 队员姓名
- `role` - 角色（队长/队员/记录员等）
- `body_weight` - 体重（kg）
- `pack_weight` - 背包负重（kg）
- `max_recommended_weight` - 建议最大负重（kg）

**可选列：**
- `gear_list` - 装备列表（分号分隔）

**示例：**
```csv
name,role,body_weight,pack_weight,max_recommended_weight,gear_list
张三,队长,70,22,25,GPS;地图;指南针;急救包
李四,队员,65,20,22,地质锤;放大镜;样本袋
王五,队员,60,18,20,罗盘;放大镜;样本瓶
```

### 4. 天气预报 JSON 文件

包含 `forecasts`（预报数组）和 `water_crossings`（涉水点数组）。

**预报字段：**
- `date` - 日期（YYYY-MM-DD）
- `hour` - 小时（可选）
- `temperature` - 气温（°C）
- `humidity` - 湿度（%）
- `wind_speed` - 风速（m/s）
- `wind_direction` - 风向
- `precipitation_probability` - 降水概率（%）
- `precipitation_amount` - 降水量（mm）
- `condition` - 天气状况
- `visibility` - 能见度（m）
- `uv_index` - 紫外线指数

**涉水点字段：**
- `name` - 涉水点名称
- `lat` - 纬度
- `lon` - 经度
- `current_depth` - 当前水深（m）
- `warning_depth` - 警戒深度（m）
- `danger_depth` - 危险深度（m）
- `flow_rate` - 流速（m/s）

**示例：**
```json
{
  "forecasts": [
    {
      "date": "2026-05-03",
      "hour": 8,
      "temperature": 18,
      "humidity": 55,
      "wind_speed": 3,
      "wind_direction": "东北",
      "precipitation_probability": 5,
      "precipitation_amount": 0,
      "condition": "晴朗",
      "visibility": 15000,
      "uv_index": 6
    }
  ],
  "water_crossings": [
    {
      "name": "东河涉水点",
      "lat": 34.056000,
      "lon": 108.903500,
      "current_depth": 0.45,
      "warning_depth": 0.5,
      "danger_depth": 0.8,
      "flow_rate": 0.8
    }
  ]
}
```

## 输出文件说明

执行评估后将生成以下文件：

### 1. Markdown 报告 (`*_report.md`)

完整的行程建议报告，包含：

- 总体风险等级
- 风险统计（按等级/类别）
- 路线统计（距离、爬升、预计耗时/耗水）
- 队员负重情况
- 风险点详情（分等级展示）
- 撤返点列表
- 补给点列表
- 路线分段详情
- 综合建议

### 2. CSV 文件

- `*_risk_points.csv` - 风险点列表
- `*_retreat_points.csv` - 撤返点列表
- `*_supply_points.csv` - 补给点列表

### 3. JSON 审计包 (`*_audit.json`)

完整的评估数据，包含所有计算中间结果，可用于存档或后续分析。

## 风险等级说明

| 等级 | 图标 | 含义 | 行动建议 |
|------|------|------|----------|
| 低风险 | 🟢 | 条件良好 | 可以正常出发 |
| 中风险 | 🟡 | 存在一定风险 | 注意安全，做好准备 |
| 高风险 | 🟠 | 风险较高 | 谨慎对待，考虑调整 |
| 极高风险 | 🔴 | 风险极高 | 强烈建议重新评估行程 |

## 风险规则配置

可通过命令行参数调整风险阈值：

```bash
field-risk-calc assess \
    --gpx route.gpx \
    --dem dem.csv \
    --weight weight.csv \
    --weather weather.json \
    --max-slope 15.0 \
    --critical-slope 25.0 \
    --max-weight-ratio 25.0 \
    --supply-interval 4.0
```

**默认阈值：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大安全坡度 | 20.0% | 超过此值为高风险 |
| 危险坡度 | 30.0% | 超过此值为极高风险 |
| 最大负重比例 | 30.0% | 负重/体重比例 |
| 建议补给间隔 | 5.0km | 超过此值需评估 |

## 验证流程

### 快速验证（使用示例数据）

```bash
# 1. 进入项目目录
cd field-risk-calculator

# 2. 安装依赖
pip install -r requirements.txt

# 3. 查看示例数据格式
python -m field_risk_calculator examples

# 4. 使用示例数据执行评估
python -m field_risk_calculator assess \
    --gpx field_risk_calculator/examples/route.gpx \
    --dem field_risk_calculator/examples/dem.csv \
    --weight field_risk_calculator/examples/weight.csv \
    --weather field_risk_calculator/examples/weather.json \
    --output test_assessment \
    --verbose

# 5. 检查输出文件
ls -la test_assessment_*
```

### 运行单元测试

```bash
# 运行所有测试
pytest field_risk_calculator/tests/ -v

# 运行特定模块测试
pytest field_risk_calculator/tests/test_parsers.py -v
pytest field_risk_calculator/tests/test_terrain.py -v
pytest field_risk_calculator/tests/test_risk.py -v
pytest field_risk_calculator/tests/test_exporters.py -v
```

### 分步验证

1. **验证输入文件格式**
   ```bash
   python -m field_risk_calculator validate --all \
       --gpx your_route.gpx \
       --dem your_dem.csv \
       --weight your_weight.csv \
       --weather your_weather.json
   ```

2. **演练模式（不生成输出）**
   ```bash
   python -m field_risk_calculator assess \
       --gpx your_route.gpx \
       --dem your_dem.csv \
       --weight your_weight.csv \
       --weather your_weather.json \
       --dry-run --verbose
   ```

3. **完整评估**
   ```bash
   python -m field_risk_calculator assess \
       --gpx your_route.gpx \
       --dem your_dem.csv \
       --weight your_weight.csv \
       --weather your_weather.json \
       --output my_assessment \
       --verbose
   ```

## 项目结构

```
field-risk-calculator/
├── field_risk_calculator/
│   ├── __init__.py
│   ├── __main__.py              # 模块入口
│   ├── cli.py                   # 命令行接口
│   ├── parsers/                 # 文件解析模块
│   │   ├── __init__.py
│   │   ├── gpx_parser.py        # GPX 解析
│   │   ├── dem_parser.py        # DEM CSV 解析
│   │   ├── weight_parser.py     # 负重表解析
│   │   └── weather_parser.py    # 天气预报解析
│   ├── terrain/                 # 地形计算模块
│   │   ├── __init__.py
│   │   └── calculator.py        # 坡度/爬升/耗水计算
│   ├── risk/                    # 风险规则模块
│   │   ├── __init__.py
│   │   ├── models.py            # 数据模型
│   │   └── rules.py             # 风险评估引擎
│   ├── exporters/               # 导出模块
│   │   ├── __init__.py
│   │   ├── markdown_exporter.py # Markdown 报告
│   │   ├── csv_exporter.py      # CSV 导出
│   │   └── json_exporter.py     # JSON 审计包
│   ├── examples/                # 示例数据
│   │   ├── __init__.py
│   │   ├── route.gpx
│   │   ├── dem.csv
│   │   ├── weight.csv
│   │   └── weather.json
│   └── tests/                   # 测试用例
│       ├── __init__.py
│       ├── test_parsers.py
│       ├── test_terrain.py
│       ├── test_risk.py
│       └── test_exporters.py
├── README.md
├── requirements.txt
└── setup.py
```

## 依赖库

- `click` - 命令行参数解析
- `gpxpy` - GPX 文件解析
- `pandas` - 数据处理
- `pytest` - 单元测试
- `pydantic` - 数据验证

## 常见问题

### Q: 我没有 DEM 数据怎么办？
A: DEM（数字高程模型）数据可从以下来源获取：
- 公开数据源：NASA SRTM、ASTER GDEM
- 地图软件导出（如 Google Earth、奥维互动地图）
- 如果 GPX 文件已包含高程信息，也可直接使用

### Q: 涉水点如何定义？
A: 涉水点在天气预报 JSON 文件的 `water_crossings` 数组中定义，需要提供：
- 经纬度位置
- 当前水深
- 警戒深度（建议不超过）
- 危险深度（禁止通过）

### Q: 如何自定义风险阈值？
A: 使用命令行参数调整：
```bash
field-risk-calc assess \
    --gpx route.gpx \
    --dem dem.csv \
    --weight weight.csv \
    --weather weather.json \
    --max-slope 15.0 \
    --critical-slope 25.0
```

### Q: 输出文件可以用什么程序打开？
- Markdown 文件：VS Code、Typora、Markdown 编辑器或任何文本编辑器
- CSV 文件：Excel、WPS、Numbers 或任何文本编辑器
- JSON 文件：VS Code、在线 JSON 查看器或任何文本编辑器

## 更新日志

### v1.0.0 (2026-05-03)
- 初始版本发布
- 实现 GPX、DEM、负重表、天气预报解析
- 实现地形计算（坡度、爬升、耗水）
- 实现风险评估引擎
- 实现 Markdown、CSV、JSON 导出
- 提供命令行接口
- 提供示例数据和完整测试

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**重要提示**：本工具仅用于辅助决策，实际野外踏勘仍需根据现场情况做出判断。任何情况下，安全第一。
