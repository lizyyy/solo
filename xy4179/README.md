# 闸泵联排演算器

基层水务站值班员用的本地科学计算CLI工具，用于暴雨前闸泵联合调度安全演练。

## 功能特性

- **站点配置**: 初始化河道、水位阈值、泵闸参数等基础配置
- **数据导入**: 支持导入河道水位、降雨预报、泵站曲线、闸门开度限制
- **时序演算**: 按小时推演库容、水位、泵流量和闸门流量变化
- **风险检查**: 自动检测漫顶、倒灌、泵启停间隔、能耗超限等风险
- **报告导出**: 生成Markdown值班建议、CSV时序表、JSON审计包

## 安装

### 环境要求

- Python 3.10+
- pip 或其他包管理工具

### 安装方式

```bash
# 使用 pip 安装（开发模式）
pip install -e .

# 或使用 hatch
hatch shell
```

## 快速开始

以下是完整的临时目录验证流程示例：

### 1. 创建临时工作目录

```bash
mkdir -p /tmp/zha-beng-test
cd /tmp/zha-beng-test
```

### 2. 初始化站点配置

```bash
zha-beng init \
  --site-name "东郊站" \
  --site-id "DJ001" \
  --river-name "东郊河" \
  --channel-area 50000 \
  --capacity 200000 \
  --warning-level 3.0 \
  --critical-level 3.5 \
  --min-pump-cycle 2 \
  --daily-energy-limit 2000
```

参数说明：
- `--channel-area`: 内河河道水面面积（平方米）
- `--capacity`: 内河最大库容（立方米）
- `--warning-level`: 警戒水位（米）
- `--critical-level`: 保证水位/漫顶水位（米）
- `--min-pump-cycle`: 泵最小启停间隔（小时），默认2小时
- `--daily-energy-limit`: 每日能耗上限（千瓦时）

### 3. 准备数据文件

项目 `examples/` 目录下提供了完整的示例数据，可直接复制使用：

```bash
# 复制示例数据到当前目录
cp /path/to/repo/examples/*.csv .
```

或手动创建以下CSV文件：

#### 水位数据 (water_levels.csv)

```csv
timestamp,inner_level,outer_level
2026-05-02 00:00,2.5,3.2
2026-05-02 01:00,2.55,3.25
2026-05-02 02:00,2.6,3.3
2026-05-02 03:00,2.7,3.35
2026-05-02 04:00,2.9,3.4
2026-05-02 05:00,3.1,3.45
2026-05-02 06:00,3.3,3.5
2026-05-02 07:00,3.5,3.5
2026-05-02 08:00,3.6,3.45
2026-05-02 09:00,3.5,3.4
2026-05-02 10:00,3.4,3.35
2026-05-02 11:00,3.2,3.3
2026-05-02 12:00,3.0,3.25
```

#### 降雨预报 (rainfall.csv)

```csv
timestamp,rainfall_mm,duration_hours
2026-05-02 00:00,0,1
2026-05-02 01:00,2,1
2026-05-02 02:00,8,1
2026-05-02 03:00,15,1
2026-05-02 04:00,25,1
2026-05-02 05:00,30,1
2026-05-02 06:00,20,1
2026-05-02 07:00,12,1
2026-05-02 08:00,8,1
2026-05-02 09:00,5,1
2026-05-02 10:00,3,1
2026-05-02 11:00,1,1
2026-05-02 12:00,0,1
```

#### 泵站曲线 (pump_curves.csv)

```csv
pump_id,pump_name,head_m,flow_m3h,power_kw,rated_flow_m3h,rated_head_m,rated_power_kw,min_start_head_m,max_start_head_m
1,主泵1号,0,1200,75,1200,5,75,0,6
1,主泵1号,2,1100,78,1200,5,75,0,6
1,主泵1号,4,900,80,1200,5,75,0,6
1,主泵1号,5,800,82,1200,5,75,0,6
1,主泵1号,6,500,85,1200,5,75,0,6
2,主泵2号,0,1200,75,1200,5,75,0,6
2,主泵2号,2,1100,78,1200,5,75,0,6
2,主泵2号,4,900,80,1200,5,75,0,6
2,主泵2号,5,800,82,1200,5,75,0,6
2,主泵2号,6,500,85,1200,5,75,0,6
3,备用泵,0,800,50,800,4,50,0,5
3,备用泵,1,750,52,800,4,50,0,5
3,备用泵,2,650,54,800,4,50,0,5
3,备用泵,3,500,56,800,4,50,0,5
3,备用泵,4,300,58,800,4,50,0,5
```

#### 闸门限制 (gate_limits.csv)

```csv
gate_id,gate_name,max_opening,min_opening,discharge_coefficient,width_m,sill_elevation
1,东闸,1.5,0.3,0.62,8.0,0.0
2,西闸,1.5,0.3,0.62,8.0,0.0
3,南闸,2.0,0.5,0.6,12.0,0.0
```

### 4. 导入数据

```bash
# 方式1：分别指定各数据文件
zha-beng import \
  --water-levels water_levels.csv \
  --rainfall rainfall.csv \
  --pump-curves pump_curves.csv \
  --gate-limits gate_limits.csv

# 方式2：自动导入当前目录所有支持的CSV文件
zha-beng import --all
```

### 5. 运行时序演算

```bash
# 使用默认参数（从导入数据推断时间范围）
zha-beng simulate

# 或指定时间范围
zha-beng simulate \
  --start-time "2026-05-02 00:00" \
  --end-time "2026-05-02 12:00" \
  --step-hours 1
```

### 6. 检查风险告警

```bash
# 查看告警摘要
zha-beng check

# 查看详细告警信息
zha-beng check --detail

# 只查看特定类型的告警
zha-beng check --type overtopping  # 漫顶风险
zha-beng check --type backflow     # 倒灌风险
zha-beng check --type energy_limit # 能耗超限
```

### 7. 导出报告

```bash
# 导出所有格式到当前目录
zha-beng report

# 或指定输出目录和格式
zha-beng report \
  --output-dir ./reports \
  --format markdown \
  --format csv \
  --format json \
  --name 暴雨演练_20260502
```

## 命令详解

### `zha-beng init` - 初始化站点配置

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--site-name, -n` | str | 是 | 站点名称 |
| `--site-id, -i` | str | 是 | 站点唯一标识 |
| `--river-name, -r` | str | 是 | 河道名称 |
| `--channel-area, -a` | float | 是 | 内河河道水面面积（平方米） |
| `--capacity, -c` | float | 是 | 内河最大库容（立方米） |
| `--warning-level, -w` | float | 是 | 内河警戒水位（米） |
| `--critical-level, -l` | float | 是 | 内河保证水位（米） |
| `--outer-river-name` | str | 否 | 外河名称 |
| `--outer-warning-level` | float | 否 | 外河警戒水位（米） |
| `--outer-critical-level` | float | 否 | 外河保证水位（米） |
| `--min-pump-cycle` | float | 否 | 泵最小启停间隔（小时），默认2 |
| `--daily-energy-limit` | float | 否 | 每日能耗上限（千瓦时） |

### `zha-beng import` - 导入数据

| 参数 | 类型 | 说明 |
|------|------|------|
| `--water-levels, -wl` | path | 河道水位CSV文件路径 |
| `--rainfall, -rf` | path | 降雨预报CSV文件路径 |
| `--pump-curves, -pc` | path | 泵站曲线CSV文件路径 |
| `--gate-limits, -gl` | path | 闸门开度限制CSV文件路径 |
| `--all, -a` | flag | 自动导入当前目录所有支持的CSV文件 |

### `zha-beng simulate` - 时序演算

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--start-time, -s` | datetime | 数据起始时间 | 演算开始时间 |
| `--end-time, -e` | datetime | 数据结束时间 | 演算结束时间 |
| `--step-hours, -t` | float | 1.0 | 演算时间步长（小时） |
| `--initial-inner-level` | float | 数据首值 | 初始内河水位（米） |
| `--initial-outer-level` | float | 数据首值 | 初始外河水位（米） |

### `zha-beng check` - 检查告警

| 参数 | 类型 | 说明 |
|------|------|------|
| `--detail, -d` | flag | 显示详细告警信息 |
| `--type, -t` | choice | 只显示指定类型的告警 |

告警类型：
- `overtopping` - 漫顶风险
- `backflow` - 倒灌风险
- `pump_cycle` - 泵启停间隔
- `energy_limit` - 能耗超限
- `data_gap` - 数据缺口

### `zha-beng report` - 导出报告

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--output-dir, -o` | path | . | 输出目录路径 |
| `--format, -f` | choice | all | 输出格式（可多次指定） |
| `--name, -n` | str | 自动生成 | 输出文件名前缀 |

输出格式：
- `markdown` - Markdown值班建议
- `csv` - CSV时序表
- `json` - JSON审计包
- `all` - 全部三种格式

### `zha-beng status` - 查看工作空间状态

显示当前工作空间的配置、数据导入、演算结果状态。

## 数据格式说明

### 水位数据格式

| 列名（英文） | 列名（中文） | 类型 | 必填 | 说明 |
|-------------|-------------|------|------|------|
| timestamp | 时间、时间戳 | datetime | 是 | 记录时间 |
| inner_level | 内水位、内河水位 | float | 是 | 内河水位（米） |
| outer_level | 外水位、外河水位 | float | 否 | 外河水位（米） |

### 降雨预报格式

| 列名（英文） | 列名（中文） | 类型 | 必填 | 说明 |
|-------------|-------------|------|------|------|
| timestamp | 时间、时间戳 | datetime | 是 | 预报时间 |
| rainfall_mm | 降雨量、降水 | float | 是 | 降雨量（毫米） |
| duration_hours | 时长 | float | 否 | 降雨时长（小时），默认1 |

### 泵站曲线格式

每台泵有多行数据，每行代表一个工作点（扬程-流量-功率）。

| 列名（英文） | 列名（中文） | 类型 | 必填 | 说明 |
|-------------|-------------|------|------|------|
| pump_id | 泵编号、泵ID | str | 是 | 泵唯一标识 |
| pump_name | 泵名称、名称 | str | 否 | 泵名称 |
| head_m | 扬程、扬程m | float | 是 | 扬程（米） |
| flow_m3h | 流量、流量m3h | float | 是 | 流量（立方米/小时） |
| power_kw | 功率、功率kw | float | 是 | 功率（千瓦） |
| rated_flow_m3h | 额定流量 | float | 是 | 额定流量 |
| rated_head_m | 额定扬程 | float | 是 | 额定扬程 |
| rated_power_kw | 额定功率 | float | 是 | 额定功率 |
| min_start_head_m | 最小启动扬程 | float | 否 | 允许启动的最小扬程 |
| max_start_head_m | 最大启动扬程 | float | 否 | 允许启动的最大扬程 |

### 闸门限制格式

| 列名（英文） | 列名（中文） | 类型 | 必填 | 说明 |
|-------------|-------------|------|------|------|
| gate_id | 闸门编号、闸门ID | str | 是 | 闸门唯一标识 |
| gate_name | 闸门名称、名称 | str | 否 | 闸门名称 |
| max_opening | 最大开度、开度上限 | float | 是 | 最大开度（米） |
| min_opening | 最小开度、开度下限 | float | 是 | 最小开度（米） |
| discharge_coefficient | 流量系数、cd | float | 否 | 流量系数，默认0.6 |
| width_m | 闸宽、宽度 | float | 是 | 闸门宽度（米） |
| sill_elevation | 堰顶高程、底槛高程 | float | 否 | 堰顶高程（米），默认0 |

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=zha_beng_yan_suan_qi

# 运行特定测试文件
pytest tests/test_hydraulics.py -v
```

## 工作目录结构

运行命令后会在当前目录创建 `.zha-beng-workspace/` 工作目录：

```
.zha-beng-workspace/
├── site_config.json        # 站点配置
├── imported_data.json      # 导入的数据
└── simulation_result.json  # 演算结果
```

## 调度规则说明

### 泵调度规则

1. **启动条件**: 内河水位 >= 警戒水位
2. **停止条件**: 内河水位 <= 警戒水位 * 0.8
3. **启停间隔**: 必须满足最小启停间隔限制（默认2小时）

### 闸门调度规则

1. **倒灌防护**: 外河水位 > 内河水位时，闸门完全关闭
2. **开度控制**:
   - 水位 >= 保证水位: 闸门全开
   - 警戒水位 <= 水位 < 保证水位: 线性插值开度
   - 内水位 - 外水位 > 0.5m: 闸门微开
   - 其他情况: 闸门关闭

## 告警等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| CRITICAL | 🔴 红色 | 严重风险，需要立即处理 |
| WARNING | 🟡 黄色 | 警告，需要密切关注 |
| INFO | 🔵 蓝色 | 提示信息 |

## 注意事项

1. **本地运行**: 所有计算均在本地完成，数据不会上传
2. **仅供参考**: 演算结果仅供参考，实际操作请结合现场情况判断
3. **数据质量**: 请确保导入的CSV数据格式正确、时间戳连续

## License

MIT License
