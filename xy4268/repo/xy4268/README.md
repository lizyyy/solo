# 潮窗靠泊推演器

小港口调度员专用本地Python CLI工具，用于根据潮汐表、船舶信息、泊位限制和拖轮可用时段，自动计算安全进出港潮窗，生成候选靠离泊计划。

## 功能特点

- 🌊 **潮汐插值计算**：使用三次样条插值算法，从离散潮汐记录计算任意时间点的潮高
- 🚢 **安全潮窗分析**：根据船舶吃水深度和安全余量，自动查找满足条件的安全潮窗
- 📋 **靠离泊计划生成**：为每艘船舶生成可行的靠离泊候选计划
- ⚠️ **冲突检测**：自动检测泊位冲突、拖轮冲突和时间重叠冲突
- 📄 **多格式导出**：支持导出Markdown格式调度单（供人工阅读）和JSON格式结果（供机器处理）
- 📁 **多种数据格式支持**：支持读取CSV（潮汐表）、JSON（船舶、拖轮）和YAML（泊位）格式的输入数据

## 安装要求

- Python 3.9 或更高版本
- pip 包管理器

## 安装步骤

1. 克隆或下载项目到本地：

```bash
cd /path/to/tide-window-scheduler
```

2. 安装项目依赖：

```bash
pip install -e .
```

或者使用开发模式安装：

```bash
pip install click pandas numpy pyyaml scipy
```

## 使用方法

### 基本命令

```bash
tide-scheduler generate [OPTIONS]
```

### 命令行选项

| 选项 | 简写 | 必填 | 说明 | 默认值 |
|------|------|------|------|--------|
| `--tide-csv` | `-t` | ✅ | 潮汐表CSV文件路径 | - |
| `--ships-json` | `-s` | ✅ | 船舶吃水/货重JSON文件路径 | - |
| `--berths-yaml` | `-b` | ✅ | 泊位限制YAML文件路径 | - |
| `--tugs-json` | `-g` | ✅ | 拖轮可用时段JSON文件路径 | - |
| `--start-date` | `-sd` | ❌ | 计划开始日期 (格式: YYYY-MM-DD) | 今天 |
| `--end-date` | `-ed` | ❌ | 计划结束日期 (格式: YYYY-MM-DD) | 开始日期后7天 |
| `--safety-margin` | `-m` | ❌ | 安全余量 (米) | 0.3米 |
| `--output-dir` | `-o` | ❌ | 输出目录路径 | 当前目录 |
| `--output-name` | `-n` | ❌ | 输出文件名前缀 | `schedule_YYYYMMDD_HHMMSS` |
| `--verbose` | `-v` | ❌ | 显示详细输出信息 | 关闭 |
| `--help` | `-h` | ❌ | 显示帮助信息 | - |

### 使用示例

使用示例数据运行：

```bash
# 使用示例数据生成计划
tide-scheduler generate \
    --tide-csv examples/tide_table.csv \
    --ships-json examples/ships.json \
    --berths-yaml examples/berths.yaml \
    --tugs-json examples/tugs.json \
    --start-date 2026-05-03 \
    --end-date 2026-05-05 \
    --safety-margin 0.3 \
    --output-dir output \
    --verbose
```

或者使用简写选项：

```bash
tide-scheduler generate \
    -t examples/tide_table.csv \
    -s examples/ships.json \
    -b examples/berths.yaml \
    -g examples/tugs.json \
    -sd 2026-05-03 \
    -ed 2026-05-05 \
    -m 0.3 \
    -o output \
    -v
```

## 输入数据格式

### 1. 潮汐表 CSV

**文件路径**: `examples/tide_table.csv`

**格式说明**:

```csv
time,height
2026-05-03 00:00,1.2
2026-05-03 06:00,3.5
2026-05-03 12:00,1.5
2026-05-03 18:00,4.2
```

**字段说明**:
- `time`: 潮汐记录时间，格式为 `YYYY-MM-DD HH:MM`
- `height`: 潮高，单位为米

### 2. 船舶数据 JSON

**文件路径**: `examples/ships.json`

**格式说明**:

```json
[
    {
        "name": "东方之星",
        "imo": "IMO1234567",
        "draft": 3.0,
        "cargo_weight": 15000,
        "length": 150,
        "width": 22,
        "required_berth_types": ["general", "container"],
        "required_tug_count": 1,
        "operation_duration": 240
    }
]
```

**字段说明**:
- `name`: 船舶名称（必填）
- `imo`: IMO编号（可选）
- `draft`: 吃水深度，单位为米（必填）
- `cargo_weight`: 货重，单位为吨（可选）
- `length`: 船长，单位为米（可选）
- `width`: 船宽，单位为米（可选）
- `required_berth_types`: 需要的泊位类型列表（可选）
- `required_tug_count`: 需要的拖轮数量（可选，默认0）
- `operation_duration`: 作业时长，单位为分钟（可选，默认240分钟）

### 3. 泊位限制 YAML

**文件路径**: `examples/berths.yaml`

**格式说明**:

```yaml
berths:
  - id: "B1"
    name: "1号泊位"
    type: "general"
    max_draft: 4.5
    max_length: 200
    max_width: 30
    available_time_slots:
      - start: "00:00"
        end: "24:00"
    restrictions: []
```

**字段说明**:
- `id`: 泊位ID（必填）
- `name`: 泊位名称（必填）
- `type`: 泊位类型（必填，如 `general`, `container`, `liquid` 等）
- `max_draft`: 最大允许吃水，单位为米（必填）
- `max_length`: 最大允许船长，单位为米（必填）
- `max_width`: 最大允许船宽，单位为米（必填）
- `available_time_slots`: 可用时间段列表（可选）
  - `start`: 开始时间，格式为 `HH:MM`
  - `end`: 结束时间，格式为 `HH:MM`（支持 `24:00`）
- `restrictions`: 限制条件列表（可选）

### 4. 拖轮数据 JSON

**文件路径**: `examples/tugs.json`

**格式说明**:

```json
[
    {
        "id": "T1",
        "name": "拖轮1号",
        "capacity": 3000,
        "available_time_slots": [
            {
                "start": "00:00",
                "end": "24:00"
            }
        ]
    }
]
```

**字段说明**:
- `id`: 拖轮ID（必填）
- `name`: 拖轮名称（必填）
- `capacity`: 拖力，单位为吨（可选）
- `available_time_slots`: 可用时间段列表（可选）
  - `start`: 开始时间，格式为 `HH:MM`
  - `end`: 结束时间，格式为 `HH:MM`（支持 `24:00`）

## 输出结果说明

工具会生成两个输出文件：

### 1. Markdown 调度单

**文件名**: `schedule_YYYYMMDD_HHMMSS.md`

**内容结构**:
1. **执行摘要**：统计信息（总计划数、可行计划、不可行计划、冲突数量）
2. **可行靠离泊计划**：每艘船的详细计划，包括：
   - 基本信息（船舶名称、吃水、货重、尺寸、拖轮需求）
   - 靠离泊计划（泊位名称、预计靠泊/离泊时间、作业时长）
   - 潮窗信息（潮窗时间段、最小/最大潮高、所需水深）
   - 注意事项（如果有冲突）
3. **不可行计划及原因分析**：列出不可行的计划及其原因
4. **冲突详情**：按严重程度分组展示所有冲突
5. **输入数据参考**：潮汐表、船舶信息、泊位信息、拖轮信息的表格

### 2. JSON 机器可读结果

**文件名**: `schedule_YYYYMMDD_HHMMSS.json`

**内容结构**:
```json
{
    "metadata": {
        "generated_at": "2026-05-03T10:00:00",
        "version": "0.1.0",
        "start_date": "2026-05-03",
        "end_date": "2026-05-05",
        "safety_margin": 0.3
    },
    "ships": [...],
    "berths": [...],
    "tugs": [...],
    "tidal_records": [...],
    "schedules": [...],
    "conflicts": [...],
    "summary": {
        "schedules": {
            "total": 10,
            "feasible": 6,
            "infeasible": 4
        },
        "conflicts": {
            "total": 5,
            "by_severity": {
                "critical": 2,
                "high": 2,
                "medium": 1,
                "low": 0
            },
            "by_type": {
                "berth_conflict": 2,
                "tug_conflict": 1,
                "ship_time_conflict": 2
            }
        }
    }
}
```

## 冲突类型说明

| 冲突类型 | 严重程度 | 说明 |
|----------|----------|------|
| `berth_incompatible` | critical | 没有找到兼容的泊位（泊位类型不匹配或尺寸限制） |
| `tidal_window_unavailable` | critical | 没有找到满足吃水要求的潮窗 |
| `operation_duration_exceeds_window` | high | 作业时长超过潮窗时长 |
| `tug_unavailable` | high | 所需拖轮数量超过可用数量 |
| `berth_conflict` | critical | 多艘船舶在同一时间段使用同一泊位 |
| `tug_conflict` | high | 多艘船舶在同一时间段的拖轮需求冲突 |
| `ship_time_conflict` | high | 同一船舶的多个计划时间重叠 |

## 算法说明

### 潮汐插值

使用 `scipy.interpolate.interp1d` 进行三次样条插值，可以从离散的潮汐记录计算任意时间点的潮高。

### 安全潮窗计算

1. 根据船舶吃水深度 + 安全余量，计算所需最小水深
2. 以1分钟为间隔采样整个时间段的潮高
3. 找出潮高 >= 所需最小水深的连续时间段
4. 过滤掉时长少于30分钟的窗口

### 计划生成

1. 为每艘船舶查找兼容的泊位（检查类型、吃水、长度、宽度）
2. 为每个兼容泊位查找可行的潮窗
3. 根据作业时长，计算可行的靠泊时间和离泊时间
4. 检查拖轮可用性
5. 生成候选计划

### 冲突检测

1. **泊位冲突检测**：检查同一泊位在同一时间段是否被多艘船舶使用
2. **拖轮冲突检测**：检查同一时间段内拖轮需求是否超过可用数量
3. **时间重叠检测**：检查同一船舶的多个计划是否时间重叠

## 项目结构

```
tide_window_scheduler/
├── __init__.py              # 包初始化
├── cli.py                   # CLI主程序入口
├── models/                  # 数据模型模块
│   ├── __init__.py
│   ├── base.py             # 基础模型（TimeSlot, TidalRecord）
│   ├── ship.py             # 船舶模型
│   ├── berth.py            # 泊位模型
│   └── tug.py              # 拖轮模型
├── data/                    # 数据读取模块
│   ├── __init__.py
│   ├── tide_reader.py      # 潮汐表CSV读取器
│   ├── ship_reader.py      # 船舶JSON读取器
│   ├── berth_reader.py     # 泊位YAML读取器
│   └── tug_reader.py       # 拖轮JSON读取器
├── core/                    # 核心算法模块
│   ├── __init__.py
│   ├── tide_interpolation.py  # 潮汐插值和潮窗计算
│   ├── schedule_generator.py  # 靠离泊计划生成
│   └── conflict_detector.py   # 冲突检测
└── output/                  # 结果导出模块
    ├── __init__.py
    ├── json_exporter.py    # JSON结果导出器
    └── markdown_exporter.py # Markdown调度单导出器

examples/                    # 示例数据
├── tide_table.csv          # 潮汐表示例
├── ships.json              # 船舶数据示例
├── berths.yaml             # 泊位数据示例
└── tugs.json               # 拖轮数据示例

pyproject.toml              # 项目配置文件
README.md                   # 本文档
```

## 常见问题

### Q: 为什么有些船舶没有可行计划？

可能的原因：
1. **泊位不兼容**：船舶需要的泊位类型在港口不存在，或者船舶尺寸超过泊位限制
2. **潮高不足**：在计划时间段内，潮高始终低于船舶吃水 + 安全余量
3. **拖轮不足**：作业时间段内可用拖轮数量不足

### Q: 如何调整安全余量？

使用 `--safety-margin` 或 `-m` 选项调整安全余量（单位：米）。默认值为0.3米。

```bash
tide-scheduler generate ... -m 0.5  # 使用0.5米的安全余量
```

### Q: 如何查看详细的执行过程？

使用 `--verbose` 或 `-v` 选项显示详细输出信息：

```bash
tide-scheduler generate ... -v
```

### Q: 支持哪些时间格式？

- **日期格式**：`YYYY-MM-DD`（如 `2026-05-03`）
- **时间格式**：`HH:MM`（如 `14:30`），支持 `24:00` 表示当天结束
- **日期时间格式**：`YYYY-MM-DD HH:MM` 或 `YYYY/MM/DD HH:MM`

## 技术栈

- **Python 3.9+**：主要编程语言
- **Click**：命令行界面构建
- **Pandas**：数据处理
- **NumPy**：数值计算
- **PyYAML**：YAML文件解析
- **SciPy**：科学计算（三次样条插值）

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发者。
