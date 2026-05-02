# 轨迹净化和行程报告器 (Track Cleaner)

一个给徒步领队用的本地命令行工具，用于清洗队员发来的 GPX/KML 轨迹并生成专业的行程报告。

## 功能特点

- **轨迹清洗**：自动识别并移除 GPS 漂移、重复时间戳、时间倒序、海拔毛刺等异常
- **多格式支持**：支持 GPX、KML、CSV 格式的轨迹文件
- **行程摘要**：计算总距离、移动时间、累计爬升/下降、平均速度等核心指标
- **检查点追踪**：结合 CSV 检查点列表，标记哪些检查点实际经过
- **路线对比**：对比计划路线和实际路线，提示偏离区间、漏掉的检查点和异常停留
- **多种导出**：支持导出清洗后的 GPX、GeoJSON、Markdown 报告和 CSV 摘要
- **历史记录**：通过 SQLite 数据库追踪所有历史操作

## 安装

### 要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆项目或下载代码
cd track-cleaner

# 安装依赖
pip install -e .

# 或者安装开发依赖（用于测试）
pip install -e ".[dev]"
```

验证安装：

```bash
track-cleaner --version
track-cleaner --help
```

## 项目结构

```
track_cleaner/
├── cli/
│   └── main.py           # CLI 入口，包含所有命令
├── models/
│   ├── track.py          # TrackPoint, TrackSegment, Track 数据模型
│   └── checkpoint.py     # Checkpoint 检查点数据模型
├── config/
│   └── config.py         # AppConfig 配置管理
├── geo/
│   └── calculations.py   # 地理计算：距离、速度、海拔等
├── parsers/
│   ├── base.py           # 解析器基类
│   ├── gpx_parser.py     # GPX 解析器
│   ├── kml_parser.py     # KML 解析器
│   ├── csv_parser.py     # CSV 解析器
│   └── registry.py       # 解析器注册中心
├── rules/
│   ├── base.py           # 规则基类和枚举
│   ├── duplicate_timestamps.py    # 重复时间戳检测
│   ├── out_of_order.py           # 时间倒序检测
│   ├── speed_anomaly.py          # 速度异常检测
│   ├── breakpoint.py              # 断点检测
│   ├── elevation_spike.py         # 海拔尖峰检测
│   ├── missing_coords.py          # 坐标缺失检测
│   └── registry.py       # 规则注册中心
├── cleaning/
│   └── clean_plan.py     # 清洗计划生成与执行
├── storage/
│   ├── database.py       # SQLite 历史记录数据库
│   └── import_store.py   # 导入文件存储
├── reports/
│   ├── summary.py        # 行程摘要计算
│   ├── comparison.py     # 路线对比
│   └── exporter.py       # 多格式导出
├── __init__.py
examples/                  # 示例数据文件
├── sample_track.gpx      # 示例 GPX 轨迹（含各种异常）
├── sample_track.csv      # 示例 CSV 轨迹
├── checkpoints.csv       # 示例检查点
└── planned_route.gpx     # 示例计划路线
tests/                     # 单元测试
├── test_geo_calculations.py
└── test_rules.py
```

## 快速开始：使用临时目录验证完整流程

### 1. 创建临时工作目录

```bash
mkdir -p /tmp/track-demo
cd /tmp/track-demo
```

### 2. 初始化项目配置

```bash
track-cleaner init \
  --timezone "Asia/Shanghai" \
  --speed-threshold 15.0 \
  --breakpoint-threshold 300.0 \
  --elevation-spike 100.0 \
  --export-dir "./exports" \
  --data-dir "./data"
```

查看生成的配置：

```bash
cat track-cleaner-config.json
```

### 3. 准备示例数据

从项目 examples 目录复制示例文件：

```bash
# 假设项目在 ~/track-cleaner
cp ~/track-cleaner/examples/*.gpx .
cp ~/track-cleaner/examples/*.csv .

ls -la
```

或者创建简单的测试数据：

```bash
# 创建一个简单的 GPX 文件
cat > test_trail.gpx << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <name>测试徒步</name>
    <trkseg>
      <trkpt lat="39.9945" lon="116.2080"><ele>100.0</ele><time>2024-10-15T08:00:00Z</time></trkpt>
      <trkpt lat="39.9955" lon="116.2090"><ele>150.0</ele><time>2024-10-15T08:02:30Z</time></trkpt>
      <trkpt lat="39.9955" lon="116.2090"><ele>150.0</ele><time>2024-10-15T08:02:30Z</time></trkpt>
      <trkpt lat="39.9965" lon="116.2100"><ele>200.0</ele><time>2024-10-15T08:05:00Z</time></trkpt>
      <trkpt lat="39.9975" lon="116.2110"><ele>500.0</ele><time>2024-10-15T08:07:30Z</time></trkpt>
      <trkpt lat="39.9985" lon="116.2120"><ele>250.0</ele><time>2024-10-15T08:10:00Z</time></trkpt>
      <trkpt lat="39.9995" lon="116.2130"><ele>300.0</ele><time>2024-10-15T08:12:30Z</time></trkpt>
      <trkpt lat="40.0005" lon="116.2140"><ele>350.0</ele><time>2024-10-15T09:00:00Z</time></trkpt>
      <trkpt lat="40.0015" lon="116.2150"><ele>400.0</ele><time>2024-10-15T09:02:30Z</time></trkpt>
      <trkpt lat="40.0025" lon="116.2160"><ele>450.0</ele><time>2024-10-15T09:05:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
EOF

# 创建检查点文件
cat > checkpoints.csv << 'EOF'
name,latitude,longitude,elevation,radius_meters
起点,39.9945,116.2080,100.0,30.0
第一个休息点,39.9975,116.2110,300.0,50.0
第二个休息点,40.0005,116.2140,450.0,50.0
终点,40.0025,116.2160,550.0,30.0
EOF
```

### 4. 导入轨迹文件

```bash
track-cleaner import test_trail.gpx --task-name "香山徒步测试"
```

### 5. 清洗轨迹 - Dry Run 模式

先查看清洗计划，不实际执行：

```bash
track-cleaner clean test_trail.gpx --dry-run
```

你应该能看到检测到的问题：
- 重复时间戳（第 2 点）
- 海拔尖峰（第 4 点，从 200m 跳到 500m 又跌回 250m）
- 断点（第 6 到 7 点之间有 47.5 分钟间隔）

### 6. 执行实际清洗

```bash
track-cleaner clean test_trail.gpx -o cleaned_trail.gpx
```

### 7. 计算行程摘要

```bash
# 基础摘要
track-cleaner summary cleaned_trail.gpx

# 结合检查点
track-cleaner summary test_trail.gpx -c checkpoints.csv
```

### 8. 路线对比

创建一个计划路线文件：

```bash
cat > planned.gpx << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
  <trk>
    <name>计划路线</name>
    <trkseg>
      <trkpt lat="39.9945" lon="116.2080"><ele>100.0</ele><time>2024-10-15T08:00:00Z</time></trkpt>
      <trkpt lat="39.9960" lon="116.2095"><ele>180.0</ele><time>2024-10-15T08:04:00Z</time></trkpt>
      <trkpt lat="39.9975" lon="116.2110"><ele>300.0</ele><time>2024-10-15T08:08:00Z</time></trkpt>
      <trkpt lat="39.9990" lon="116.2125"><ele>400.0</ele><time>2024-10-15T08:12:00Z</time></trkpt>
      <trkpt lat="40.0005" lon="116.2140"><ele>450.0</ele><time>2024-10-15T08:16:00Z</time></trkpt>
      <trkpt lat="40.0015" lon="116.2150"><ele>500.0</ele><time>2024-10-15T08:18:00Z</time></trkpt>
      <trkpt lat="40.0025" lon="116.2160"><ele>550.0</ele><time>2024-10-15T08:20:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
EOF
```

执行对比：

```bash
track-cleaner compare test_trail.gpx planned.gpx -c checkpoints.csv
```

### 9. 导出报告

```bash
# 导出所有格式
track-cleaner export test_trail.gpx \
  --format all \
  -c checkpoints.csv \
  --comparison planned.gpx \
  -o ./exports

# 查看导出结果
ls -la ./exports/
```

### 10. 查看历史记录

```bash
# 查看所有历史
track-cleaner history

# 查看特定任务类型
track-cleaner history --task-type clean

# 查看特定 ID 的详情
track-cleaner history --id 1
```

## 完整命令参考

### init - 初始化配置

```bash
track-cleaner init [OPTIONS]
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `--timezone` | Asia/Shanghai | 时区设置 |
| `--speed-threshold` | 15.0 | 速度阈值(km/h)，超过视为异常 |
| `--breakpoint-threshold` | 300.0 | 断点阈值(秒)，超过视为分段 |
| `--elevation-spike` | 100.0 | 海拔突变阈值(米) |
| `--export-dir` | ./exports | 默认导出目录 |
| `--data-dir` | ./data | 数据存储目录 |
| `--force` | - | 覆盖现有配置 |

### import - 导入轨迹

```bash
track-cleaner import FILE_PATH [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--task-name` | 任务名称，用于组织导入的文件 |
| `--copy-only` | 仅复制文件，不解析预览 |

### clean - 清洗轨迹

```bash
track-cleaner clean FILE_PATH [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--dry-run` | 仅显示清洗计划，不执行清洗 |
| `--output, -o` | 输出清洗后轨迹的文件路径 |
| `--skip-rules` | 跳过指定规则，逗号分隔，如: duplicate_timestamp,speed_anomaly |

### summary - 计算行程摘要

```bash
track-cleaner summary FILE_PATH [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--checkpoints, -c` | 检查点 CSV 文件 |
| `--min-speed` | 最小移动速度(km/h)，低于此视为停留，默认: 1 |

### compare - 路线对比

```bash
track-cleaner compare ACTUAL_TRACK PLANNED_TRACK [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--checkpoints, -c` | 检查点 CSV 文件 |
| `--deviation-threshold` | 偏离阈值(米)，默认: 50 |
| `--stop-threshold` | 停留阈值(分钟)，默认: 10 |

### export - 导出报告

```bash
track-cleaner export FILE_PATH [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--output-dir, -o` | 导出目录 |
| `--format, -f` | 导出格式: gpx, geojson, markdown, csv, all |
| `--base-name` | 导出文件名前缀 |
| `--comparison` | 计划路线文件，用于对比报告 |
| `--checkpoints, -c` | 检查点 CSV 文件 |
| `--cleaned` | 输入是已清洗的轨迹，跳过清洗步骤 |

### history - 查询历史记录

```bash
track-cleaner history [OPTIONS]
```

| 选项 | 说明 |
|------|------|
| `--task-type` | 筛选任务类型: import, clean, summary, compare, export, all |
| `--limit` | 显示最近的 N 条记录，默认: 20 |
| `--offset` | 偏移量，用于分页，默认: 0 |
| `--id` | 查看指定 ID 的详细记录 |

## 异常检测规则

| 规则名称 | 说明 | 默认动作 |
|----------|------|----------|
| duplicate_timestamp | 检测重复时间戳 | REMOVE |
| out_of_order_timestamp | 检测时间倒序的点 | REMOVE |
| speed_anomaly | 检测瞬时速度超过阈值的点 | REMOVE |
| breakpoint | 检测长时间断点（用于分段） | SPLIT |
| elevation_spike | 检测海拔尖峰（突然升高然后降低） | REMOVE |
| missing_coords | 检测坐标缺失的点 | REMOVE |

## 检查点 CSV 格式

```csv
name,latitude,longitude,elevation,radius_meters
起点,39.9945,116.2080,100.0,30.0
第一个休息点,39.9975,116.2110,300.0,50.0
```

- `radius_meters`: 检查点半径，轨迹点落在该半径内即视为经过

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/ -v

# 运行测试并显示覆盖率
pytest tests/ -v --cov=track_cleaner
```

## 数据文件说明

- `track-cleaner-config.json`: 项目配置文件，由 `init` 命令生成
- `data/track-cleaner-history.db`: SQLite 历史记录数据库
- `data/imports/`: 导入的原始文件存储目录
- `exports/`: 导出文件目录

## 许可证

MIT License
