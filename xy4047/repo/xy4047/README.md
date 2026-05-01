# ROV 放缆张力校核器

海工检测队专用的本地科学计算命令行工具，用于分析 ROV 水下作业时脐带缆的张力、弯曲半径和潜在风险。

## 功能特性

- **项目配置管理** - 统一管理缆线规格、允许张力、最小弯曲半径、ROV 参数、海流层配置
- **多源数据导入** - 支持导入母船航迹、ROV 遥测、海流剖面三类 CSV 数据
- **数据校验** - 自动校验单位、时间倒序、重复时间戳、坐标缺失、深度符号混乱等问题
- **时间线对齐** - 按时间线对齐多源数据，支持线性插值
- **悬链与张力计算** - 基于悬链线近似模型估算缆线形态、顶端张力、ROV 端张力
- **弯曲半径分析** - 计算最小弯曲半径及安全裕度
- **风险识别** - 自动识别张力超限、放缆不足、角度突变、海流突变、擦碰风险
- **场景推演** - 支持修改海流或放缆长度进行假设分析
- **报告导出** - 导出 Markdown 作业复盘、CSV 风险清单、JSON 计算审计包
- **历史查询** - 按作业日期或管线编号查询历史分析

## 项目结构

```
rov_tension_checker/
├── cli/                          # CLI 入口和命令
│   ├── main.py                   # 主入口
│   └── commands/
│       ├── init_cmd.py           # init 命令
│       ├── import_cmd.py         # import 命令
│       ├── analyze_cmd.py        # analyze 命令
│       ├── scenario_cmd.py       # scenario 命令
│       ├── report_cmd.py         # report 命令
│       └── history_cmd.py        # history 命令
├── config/                       # 配置模块
│   ├── models.py                 # 配置数据模型
│   └── manager.py                # 配置管理器
├── data_import/                  # 数据导入模块
│   ├── parsers.py                # CSV 解析器
│   ├── validators.py             # 数据校验器
│   └── unit_converters.py        # 单位换算器
├── analysis/                     # 分析模块
│   ├── alignment.py              # 时间线对齐
│   ├── catenary.py               # 悬链线计算
│   ├── tension.py                # 张力计算
│   ├── bending.py                # 弯曲半径计算
│   └── risk_engine.py            # 风险规则引擎
├── scenario/                     # 场景推演模块
│   └── simulator.py              # 场景模拟器
├── storage/                      # 存储模块
│   ├── models.py                 # 数据模型
│   └── repository.py             # 数据仓库
├── report/                       # 报告模块
│   ├── markdown.py               # Markdown 报告导出
│   ├── csv_exporter.py           # CSV 导出
│   └── json_auditor.py           # JSON 审计导出
└── utils/                        # 工具模块
    └── __init__.py

examples/                         # 示例数据
├── track.csv                     # 航迹示例
├── rov_telemetry.csv             # ROV 遥测示例
├── current_profile.csv           # 海流剖面示例
└── bad_data.csv                  # 包含坏行的测试数据

tests/                            # 测试文件
├── test_import.py                # 导入模块测试
└── test_analysis.py              # 分析模块测试
```

## 安装

### 系统要求

- Python 3.9 或更高版本
- pip 包管理器

### 安装步骤

1. 克隆或下载项目代码

2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 以可编辑模式安装项目：

```bash
pip install -e .
```

4. 验证安装：

```bash
rov-tension --version
rov-tension --help
```

## 快速开始

以下是一个完整的示例流程，使用示例数据验证所有核心功能。

### 1. 创建临时工作目录

```bash
mkdir -p /tmp/rov_test_project
cd /tmp/rov_test_project
```

### 2. 初始化项目

```bash
rov-tension init --name "东海管线检查" --pipeline "PL-2024-001"
```

这将创建：
- `rov_config.json` - 项目配置文件
- `data/` - 数据目录
- `output/` - 输出目录
- `quarantine/` - 隔离目录

查看生成的配置：

```bash
cat rov_config.json
```

### 3. 导入航迹数据

使用项目中的示例数据：

```bash
# 假设项目在 /path/to/project
PROJECT_DIR="/Users/mac/pro/solocoder/pro/xy4047/repo/xy4047"

rov-tension import --type track "$PROJECT_DIR/examples/track.csv"
```

输出示例：
```
正在导入 track 数据: /path/to/examples/track.csv
--------------------------------------------------
总行数: 10
有效行数: 10
无效行数: 0

✓ 有效数据已保存: data/track_20240615_143000.json
```

### 4. 导入 ROV 遥测数据

```bash
rov-tension import --type rov_telemetry "$PROJECT_DIR/examples/rov_telemetry.csv"
```

### 5. 导入海流剖面数据

```bash
rov-tension import --type current_profile "$PROJECT_DIR/examples/current_profile.csv"
```

### 6. 验证坏行隔离

使用包含错误的测试数据验证数据校验功能：

```bash
rov-tension import --type rov_telemetry "$PROJECT_DIR/examples/bad_data.csv"
```

输出将显示检测到的错误：
```
正在导入 rov_telemetry 数据: /path/to/examples/bad_data.csv
--------------------------------------------------
总行数: 10
有效行数: 4
无效行数: 6

发现的错误:
  行 2: [missing_timestamp] 时间戳缺失
  行 3: [depth_sign_confusion] 深度为负值，可能符号混乱: -5.0
  行 4: [negative_cable_length] 放缆长度为负值: -10.0
  ...

⚠️  隔离文件已保存: quarantine/quarantine_rov_telemetry_20240615_143200.json
```

查看隔离文件中的详细错误信息：

```bash
cat quarantine/quarantine_rov_telemetry_*.json
```

### 7. 运行分析

```bash
rov-tension analyze
```

输出示例：
```
正在加载数据...
  航迹数据: 10 条
  ROV遥测: 10 条
  海流剖面: 4 层

正在对齐时间线...
  对齐后采样点: 10 个

正在计算张力和弯曲半径...
计算进度 |████████████████████████████| 10/10 [100%] in 0.1s

分析完成！
--------------------------------------------------
顶端张力:
  最大: 15234.5 N
  最小: 8520.1 N
  平均: 11877.3 N

弯曲半径:
  最小: 1.2345 m
  规范要求: >= 0.285 m

风险统计:
  ✅ 未检测到风险

正在保存分析结果...
✓ 分析结果已保存，ID: abc123def456
```

### 8. 场景推演

假设海流速度增加 0.3 m/s，分析张力变化：

```bash
rov-tension scenario -m current_speed:+0.3 --name "海流增加场景"
```

输出示例：
```
使用分析: abc123def456
项目: 东海管线检查
管线: PL-2024-001

场景修改:
  - current_speed: +0.3

正在执行场景推演...

场景推演结果:
--------------------------------------------------
场景名称: 海流增加场景

张力变化:
  原始平均张力: 11877.3 N
  场景平均张力: 14234.5 N
  变化: +19.8%

风险变化:
  原始关键风险: 0
  场景关键风险: 0
  原始预警风险: 0
  场景预警风险: 2

✓ 场景结果已保存，ID: xyz789abc012
```

其他场景示例：

```bash
# 减少放缆长度 20 米
rov-tension scenario -m cable_length:-20 --name "放缆减少场景"

# 设置固定放缆长度 180 米
rov-tension scenario -m cable_length:180 --name "固定放缆长度"

# 组合多个修改
rov-tension scenario -m current_speed:1.0 -m cable_length:-10 --name "恶劣海流+短缆"
```

### 9. 导出报告

```bash
rov-tension report
```

输出示例：
```
使用分析: abc123def456
项目: 东海管线检查
管线: PL-2024-001

导出格式: markdown, csv, json
输出目录: output

正在导出 Markdown 报告...
  ✓ output/report_PL-2024-001_20240615_143500.md
正在导出 CSV 文件...
  ✓ 风险清单: output/report_PL-2024-001_20240615_143500_risks.csv
  ✓ 时间序列: output/report_PL-2024-001_20240615_143500_timeseries.csv
正在导出 JSON 审计包...
  ✓ 完整审计: output/report_PL-2024-001_20240615_143500_audit.json
  ✓ 摘要: output/report_PL-2024-001_20240615_143500_summary.json

✓ 报告导出完成！
```

查看生成的报告：

```bash
# Markdown 报告
cat output/report_*.md

# CSV 风险清单
cat output/report_*_risks.csv

# 时间序列数据
cat output/report_*_timeseries.csv
```

### 10. 查询历史记录

```bash
# 查看所有历史
rov-tension history

# 按管线筛选
rov-tension history --pipeline "PL-2024-001"

# 按日期范围筛选
rov-tension history --date-from 2024-06-01 --date-to 2024-06-30

# 只显示有关键风险的记录
rov-tension history --critical

# 显示详细信息
rov-tension history --detail

# 显示更多记录
rov-tension history --limit 50
```

## 详细使用说明

### init 命令

初始化项目配置。

```bash
rov-tension init --name <项目名> --pipeline <管线编号> [--working-dir <目录>]
```

参数：
- `--name, -n`: 项目名称（必需）
- `--pipeline, -p`: 管线编号（必需）
- `--working-dir, -w`: 工作目录（默认为当前目录）

生成的配置文件 `rov_config.json` 包含：
- 缆线规格（直径、重量、最大张力、最小弯曲半径）
- ROV 规格（重量、浮力、推力）
- 海流层配置
- 管线保护架配置
- 风险阈值
- 目录配置

### import 命令

导入三类数据文件。

```bash
rov-tension import --type <类型> <文件路径> [--encoding <编码>]
```

参数：
- `--type, -t`: 数据类型，可选值：
  - `track`: 母船航迹数据
  - `rov_telemetry`: ROV 遥测数据
  - `current_profile`: 海流剖面数据
- `--encoding, -e`: 文件编码（默认 utf-8）

**支持的数据格式：**

1. **航迹数据 (track.csv)**

```csv
timestamp,latitude,longitude,x,y,heading,speed
2024-06-15 08:00:00,31.23456,122.34567,0,0,45,1.2
```

字段说明：
- `timestamp`: 时间戳（必需）
- `latitude`/`longitude`: 经纬度（或使用局部坐标）
- `x`/`y`: 局部坐标（米）
- `heading`: 艏向（度，0-360）
- `speed`: 速度（m/s 或 knots）

2. **ROV 遥测数据 (rov_telemetry.csv)**

```csv
timestamp,depth,cable_length,heading,thrust_forward,thrust_vertical,altitude
2024-06-15 08:00:00,85.0,120.0,60,2000,1000,5.0
```

字段说明：
- `timestamp`: 时间戳（必需）
- `depth`: 深度（米，支持 m、ft、fm 单位）
- `cable_length`: 放缆长度（米）
- `heading`: ROV 艏向
- `thrust_forward`: 水平推力（N）
- `thrust_vertical`: 垂直推力（N）
- `altitude`: 离底高度（米）

3. **海流剖面数据 (current_profile.csv)**

```csv
depth_from,depth_to,speed,direction
0,30,0.8,90
30,60,0.6,85
```

字段说明：
- `depth_from`: 层深度起始（米）
- `depth_to`: 层深度结束（米）
- `speed`: 海流速度（m/s 或 knots）
- `direction`: 海流方向（度，0=北）

**数据校验规则：**

导入时自动检测以下问题：
- 时间戳缺失或无效
- 时间倒序（前一行时间晚于当前行）
- 重复时间戳
- 坐标缺失（经纬度和局部坐标都缺失）
- 纬度超出 [-90, 90]
- 经度超出 [-180, 180]
- 深度为负值（可能符号混乱）
- 放缆长度为负值
- 艏向/方向超出 [0, 360]
- 速度为负值

### analyze 命令

执行张力校核分析。

```bash
rov-tension analyze [--no-save]
```

参数：
- `--save/--no-save`: 是否保存分析结果（默认保存）

**分析内容：**

1. **时间线对齐**
   - 合并航迹和 ROV 遥测的时间戳
   - 创建统一的采样时间线
   - 缺失数据使用线性插值填充

2. **水平偏移估算**
   - 基于经纬度或局部坐标计算
   - 或使用放缆长度和深度估算

3. **悬链线计算**
   - 计算缆线形态（x, z 坐标）
   - 计算各点张力
   - 计算缆线角度

4. **张力计算**
   - 顶端张力（母船端）
   - 底端张力（ROV 端）
   - 考虑海流阻力
   - 考虑 ROV 推力影响
   - 计算张力比率和安全裕度

5. **弯曲半径计算**
   - 基于张力和缆线重量计算
   - 找出最小弯曲半径位置
   - 与规范要求比较

6. **风险识别**
   - 张力超限/预警
   - 弯曲半径违规/预警
   - 放缆不足
   - 缆线角度突变
   - 海流突变
   - ROV 靠近管线保护架
   - 缆线松弛

### scenario 命令

执行场景推演。

```bash
rov-tension scenario [--analysis-id <ID>] -m <修改> -n <场景名> [--no-save]
```

参数：
- `--analysis-id, -a`: 分析 ID（默认使用最新分析）
- `--modify, -m`: 参数修改（可多次使用）
- `--name, -n`: 场景名称
- `--save/--no-save`: 是否保存结果

**修改格式：**

```
类型:值          设置为绝对值
类型:+值         增加
类型:-值         减少
```

支持的修改类型：
- `current_speed`: 海流速度（m/s）
- `current_direction`: 海流方向（度）
- `cable_length`: 放缆长度（米）
- `depth`: ROV 深度（米）
- `thrust_forward`: 水平推力（N）
- `thrust_vertical`: 垂直推力（N）

**场景推演不会修改原始分析记录，结果独立保存。**

### report 命令

导出分析报告。

```bash
rov-tension report [--analysis-id <ID>] [--format <格式>] [--output-dir <目录>] [--name <前缀>]
```

参数：
- `--analysis-id, -a`: 分析 ID（默认使用最新分析）
- `--format, -f`: 输出格式（可选：markdown, csv, json, all）
- `--output-dir, -o`: 输出目录
- `--name, -n`: 文件名前缀

**输出格式：**

1. **Markdown 报告**
   - 项目信息
   - 风险概览
   - 数据统计（张力、弯曲半径、放缆长度、深度、海流）
   - 风险详情
   - 采样数据摘要

2. **CSV 文件**
   - `*_risks.csv`: 风险点清单，包含时间、级别、类型、描述、详细信息
   - `*_timeseries.csv`: 完整时间序列数据，所有采样点的计算结果

3. **JSON 审计包**
   - `*_audit.json`: 完整数据，包含所有采样点和详细计算结果
   - `*_summary.json`: 摘要数据，仅包含统计信息

### history 命令

查询历史分析记录。

```bash
rov-tension history [--pipeline <编号>] [--date-from <日期>] [--date-to <日期>]
                    [--critical/--no-critical] [--limit <数量>] [--detail]
```

参数：
- `--pipeline, -p`: 按管线编号筛选
- `--date-from, -f`: 开始日期（格式：YYYY-MM-DD）
- `--date-to, -t`: 结束日期（格式：YYYY-MM-DD）
- `--critical/--no-critical`: 只显示有/无关键风险的记录
- `--limit, -l`: 显示记录数量限制（默认 20）
- `--detail, -d`: 显示详细信息

## 配置说明

### 缆线规格配置

```json
{
  "cable_spec": {
    "name": "标准脐带缆 19mm",
    "diameter": 0.019,
    "weight_in_air": 15.7,
    "weight_in_water": 8.5,
    "max_allowable_tension": 45000,
    "min_bending_radius": 0.285,
    "safety_factor": 1.5
  }
}
```

字段说明：
- `diameter`: 缆线直径（米）
- `weight_in_air`: 空气中单位长度重量（N/m）
- `weight_in_water`: 水中单位长度重量（N/m）
- `max_allowable_tension`: 最大允许张力（N）
- `min_bending_radius`: 最小弯曲半径（米）
- `safety_factor`: 安全系数（工作张力 = 最大张力 / 安全系数）

### ROV 规格配置

```json
{
  "rov_spec": {
    "name": "Work-class ROV",
    "weight_in_air": 45000,
    "weight_in_water": -2000,
    "maximum_thrust_horizontal": 12000,
    "maximum_thrust_vertical": 8000
  }
}
```

字段说明：
- `weight_in_water`: 水中重量（N），负值表示正浮力
- `maximum_thrust_horizontal`: 最大水平推力（N）
- `maximum_thrust_vertical`: 最大垂直推力（N）

### 海流层配置

```json
{
  "current_layers": [
    {
      "depth_from": 0,
      "depth_to": 30,
      "speed": 0.8,
      "direction": 90
    }
  ]
}
```

字段说明：
- `depth_from`: 层深度起始（米）
- `depth_to`: 层深度结束（米）
- `speed`: 海流速度（m/s）
- `direction`: 海流方向（度，0=北）

### 管线保护架配置

```json
{
  "protection_frames": [
    {
      "pipeline_id": "PL-2024-001",
      "latitude": 31.23456,
      "longitude": 122.34567,
      "local_x": 100.0,
      "local_y": 50.0,
      "collision_radius": 5.0
    }
  ]
}
```

用于检测 ROV 靠近保护架的擦碰风险。

### 风险阈值配置

```json
{
  "risk_thresholds": {
    "tension_warning_ratio": 0.8,
    "tension_critical_ratio": 0.95,
    "bending_radius_warning_ratio": 1.2,
    "bending_radius_critical_ratio": 1.05,
    "angle_change_warning": 15.0,
    "angle_change_critical": 30.0,
    "current_change_warning": 0.3,
    "current_change_critical": 0.6,
    "slack_cable_tension": 50.0
  }
}
```

字段说明：
- `tension_warning_ratio`: 张力预警比例（工作张力的 80%）
- `tension_critical_ratio`: 张力临界比例（工作张力的 95%）
- `bending_radius_warning_ratio`: 弯曲半径预警倍率（规范值的 1.2 倍）
- `bending_radius_critical_ratio`: 弯曲半径临界倍率（规范值的 1.05 倍）
- `angle_change_warning`: 角度突变预警（度/秒）
- `angle_change_critical`: 角度突变临界（度/秒）
- `current_change_warning`: 海流突变预警（m/s²）
- `current_change_critical`: 海流突变临界（m/s²）
- `slack_cable_tension`: 缆线松弛判定张力（N）

## 计算模型说明

### 悬链线方程

使用经典悬链线方程计算缆线形态：

```
x = c * sinh(s/c + sinh(Fh0/Th))
z = c * (cosh(s/c + sinh(Fh0/Th)) - cosh(sinh(Fh0/Th)))
```

其中：
- `c = Th / w`: 特征长度
- `Th`: 水平张力
- `w`: 缆线水中单位长度重量
- `s`: 沿缆线长度
- `Fh0`: ROV 端水平力

### 张力计算

缆线任意点张力：

```
T = sqrt(Th² + (Fv0 + w*s)²)
```

其中：
- `Fv0`: ROV 端垂直力
- `s`: 沿缆线从 ROV 端算起的长度

顶端张力：

```
T_top = sqrt(Th² + (Fv0 + w*L)²)
```

其中 `L` 为放出缆线总长度。

### 弯曲半径计算

基于张力和缆线重量：

```
R = T / w
```

最小弯曲半径出现在张力最小的位置（通常在 ROV 端或形态最低点）。

### 海流阻力计算

使用拖曳力公式：

```
Fd = 0.5 * Cd * ρ * V² * A
```

其中：
- `Cd = 1.2`: 拖曳系数（圆柱体）
- `ρ = 1025 kg/m³`: 海水密度
- `V`: 海流速度
- `A = D * L`: 缆线迎流投影面积
- `D`: 缆线直径
- `L`: 缆线长度

## 运行测试

```bash
pytest -v
```

或运行特定测试文件：

```bash
pytest tests/test_import.py -v
pytest tests/test_analysis.py -v
```

## 故障排除

### 1. 配置文件不存在

```
❌ 项目未初始化
请先运行: rov-tension init
```

解决方法：在当前目录或指定工作目录运行 `rov-tension init`。

### 2. 数据导入失败

检查 CSV 文件格式：
- 确保第一行是表头
- 检查时间戳格式是否正确
- 确认数值字段不包含非数字字符

查看隔离文件中的详细错误信息。

### 3. 分析结果异常

如果张力计算结果异常：
- 检查放缆长度和深度是否合理
- 确认放缆长度大于深度
- 检查海流速度单位是否正确

## 常见问题

**Q: 支持哪些时间戳格式？**

A: 支持以下格式：
- `2024-06-15 08:00:00`
- `2024-06-15 08:00:00.123456`
- `2024/06/15 08:00:00`
- `20240615 080000`
- `15-Jun-2024 08:00:00`
- `2024-06-15T08:00:00`
- ISO 8601 格式

**Q: 支持哪些单位？**

A: 导入时自动识别：
- 长度：m（米）、ft（英尺）、fm/fathom（英寻）
- 速度：m/s（米/秒）、knot/kt（节）
- 力/重量：N（牛）、kg（千克，自动转换为 N）

**Q: 分析需要多长时间？**

A: 典型 1000 个采样点的分析约需 1-2 秒。主要耗时在悬链线迭代求解。

**Q: 如何修改默认配置？**

A: 直接编辑 `rov_config.json` 文件，或重新运行 `rov-tension init` 覆盖配置。

**Q: 场景推演会影响原始分析吗？**

A: 不会。场景推演是基于原始分析的副本进行计算，结果独立保存。

## 许可证

本项目仅供内部使用。

## 版本历史

- v1.0.0: 初始版本
  - 支持 init、import、analyze、scenario、report、history 命令
  - 悬链线计算、张力计算、弯曲半径计算
  - 多类风险识别
  - 场景推演功能
  - 多格式报告导出
