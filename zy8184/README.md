# Metro Power Analyzer - 地铁供电检修事件分析工具

## 简介

Metro Power Analyzer 是一个为地铁供电检修班设计的本地Python CLI工具，用于分析牵引变电所保护动作事件。

### 主要功能

- **数据导入**：支持保护动作CSV、录波采样JSONL、保护定值YAML、设备台账YAML
- **事件链重建**：自动按时间排序，检测乱序事件
- **定值符合性判断**：判断过流、接地、母联联跳是否符合定值
- **报告输出**：生成 events.csv、review_report.md、timeline.html
- **边界处理**：采样缺口检测、乱序事件标记、定值版本生效日跨越

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd zy8184

# 安装依赖
pip install -r requirements.txt

# 安装为可执行命令
pip install -e .
```

## 快速开始

### 使用内置Sample数据演示

```bash
# 使用sample数据运行分析
metro-power-analyzer sample --output ./result

# 或简写
metro-power-analyzer sample -o ./result
```

### 使用自定义数据

```bash
# 分析自定义数据
metro-power-analyzer analyze \
  --protection-csv ./data/protection_actions.csv \
  --sampling-jsonl ./data/sampling_data.jsonl \
  --settings-yaml ./data/protection_settings.yaml \
  --inventory-yaml ./data/device_inventory.yaml \
  --output ./result \
  --tolerance 0.05
```

### 命令行参数说明

#### `sample` 命令

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--output, -o` | 输出目录 | 当前目录 |

#### `analyze` 命令

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `--protection-csv, -p` | 保护动作CSV文件路径 | 是 | - |
| `--sampling-jsonl, -s` | 录波采样JSONL文件路径 | 否 | - |
| `--settings-yaml, -t` | 保护定值YAML文件路径 | 是 | - |
| `--inventory-yaml, -i` | 设备台账YAML文件路径 | 否 | - |
| `--output, -o` | 输出目录 | 否 | 当前目录 |
| `--tolerance` | 定值允许误差百分比 | 否 | 0.05 (5%) |

## 输入数据格式

### 1. 保护动作CSV

```csv
时间,装置名称,保护类型,动作类型,动作值,定值,相别,状态
2024-01-15 10:23:45.123,1#牵引变过流保护,过流保护I段,动作,8.5,5.0,ABC,动作
```

**字段说明：**
- `时间`：事件发生时间，支持多种格式
- `装置名称`：保护装置名称
- `保护类型`：过流保护I段/接地保护/母联联跳等
- `动作类型`：启动/动作/返回等
- `动作值`：实际动作值
- `定值`：保护整定值
- `相别`：ABC/A/B/AB等
- `状态`：动作状态

### 2. 录波采样JSONL

```jsonl
{"timestamp": "2024-01-15T10:23:44.800000+00:00", "channels": {"Ia": 1.2, "Ib": 1.1, "Ic": 1.3, "Ua": 27500.0}}
{"timestamp": "2024-01-15T10:23:44.801000+00:00", "channels": {"Ia": 1.3, "Ib": 1.2, "Ic": 1.4, "Ua": 27480.0}}
```

**字段说明：**
- `timestamp`：采样时间戳（ISO格式）
- `channels`：各通道采样值，如电流(Ia,Ib,Ic)、电压(Ua,Ub,Uc)

### 3. 保护定值YAML

```yaml
version: "2024-01"
effective_date: "2024-01-01"
devices:
  - name: "1#牵引变过流保护"
    type: "过流保护"
    settings:
      - name: "过流I段定值"
        value: 5.0
        unit: "A"
        effective_date: "2023-06-01"
        expiry_date: "2024-12-31"
      - name: "过流I段时限"
        value: 0.1
        unit: "s"
```

**定值版本生效日跨越处理：**
- 支持 `effective_date` 和 `expiry_date` 字段
- 根据事件时间自动匹配生效的定值版本

### 4. 设备台账YAML

```yaml
inventory:
  - id: "TR-001"
    name: "1#牵引变压器"
    type: "牵引变压器"
    location: "牵引变电所A"
    voltage: "27.5kV"
    protection_devices:
      - "1#牵引变过流保护"
    related_buses:
      - "27.5kV I段母线"
```

## 输出文件说明

运行分析后会生成以下三个文件：

### 1. events.csv

事件详细列表CSV，包含：
- 事件ID、时间、事件类型
- 装置名称、相别
- 动作值、定值
- 评估状态（符合/不符合/无定值）
- 乱序标记
- 备注信息

### 2. review_report.md

详细的Markdown审查报告，包含：
- 事件摘要（总数、时间范围、类型分布）
- 定值符合性评估统计
- 不符合定值事件详情
- 事件时间线（按时间排序）
- 录波采样数据摘要（如有）
- 采样缺口警告（如有）

### 3. timeline.html

交互式HTML时间线页面，包含：
- 事件统计卡片
- 可视化时间线（颜色区分：绿色-符合、红色-不符合、黄色-待确认）
- 事件详情（装置、相别、动作值、定值）
- 评估状态和详情
- 乱序事件标记
- 录波采样数据摘要（如有）

**预览方式：**
```bash
# macOS
open ./result/timeline.html

# 或直接在浏览器中打开文件
```

## 边界情况处理

### 1. 采样缺口检测

- 自动检测采样间隔异常
- 在报告和HTML中标记采样缺口警告
- 缺口定义：实际间隔 > 期望间隔 × 1.5

### 2. 动作顺序乱序

- 自动按时间戳重新排序
- 标记原始时间乱序的事件
- 在输出中显示"乱序"警告

### 3. 定值版本生效日跨越

- 支持定值的 `effective_date`（生效日）和 `expiry_date`（到期日）
- 根据事件发生时间自动匹配正确的定值版本
- 自动忽略在事件时间未生效或已过期的定值

## 项目结构

```
metro_power_analyzer/
├── __init__.py          # 包入口
├── cli.py               # 命令行入口
├── parser/              # 解析模块
│   ├── __init__.py
│   ├── csv_parser.py    # CSV解析（保护动作）
│   ├── jsonl_parser.py  # JSONL解析（录波采样）
│   └── yaml_parser.py   # YAML解析（定值、台账）
├── rules/               # 规则计算模块
│   ├── __init__.py
│   ├── event_chain.py   # 事件链构建
│   └── evaluator.py     # 定值符合性评估
├── exporter/            # 报告导出模块
│   ├── __init__.py
│   ├── csv_exporter.py  # CSV导出
│   ├── markdown_exporter.py  # Markdown报告导出
│   └── html_exporter.py      # HTML时间线导出
└── sample_data/         # 内置Sample数据
    ├── __init__.py
    ├── protection_actions.csv   # 保护动作（含乱序）
    ├── sampling_data.jsonl      # 录波采样（含缺口）
    ├── protection_settings.yaml # 保护定值（含版本）
    └── device_inventory.yaml    # 设备台账
```

## 评估规则

### 过流保护评估

- **动作条件**：动作值 >= 定值 × (1 - 允许误差)
- **默认允许误差**：5% (0.05)
- **评估结果**：
  - `符合定值`：动作值满足条件
  - `不符合定值`：动作值不满足条件但保护动作
  - `无对应定值`：未找到匹配的定值

### 接地保护评估

- 规则与过流保护相同
- 定值名称匹配支持多种变体（接地保护/零序保护/Ground等）

### 母联联跳评估

- 检查触发保护与母联装置的关联关系
- 通过设备台账中的母线关联判断
- 支持同一母线分段、相同编号设备的关联匹配

## 示例输出预览

运行 `metro-power-analyzer sample` 后，你将看到：

```
============================================================
地铁供电检修事件分析工具 - Sample演示
============================================================

Sample数据目录: /path/to/sample_data

[1/6] 读取保护动作CSV: /path/to/protection_actions.csv
      解析到 7 条保护动作记录
[2/6] 读取录波采样JSONL: /path/to/sampling_data.jsonl
      解析到 18 个采样点
      通道: Ia, Ib, Ic, Ua, Ub, Uc
      ⚠️ 检测到 1 个采样缺口
[3/6] 读取保护定值YAML: /path/to/protection_settings.yaml
      解析到 5 个装置的定值
[4/6] 读取设备台账YAML: /path/to/device_inventory.yaml
      解析到 9 个设备

[5/6] 构建事件链...
      事件总数: 7
      ⚠️ 检测到 2 个乱序事件

[6/6] 定值符合性评估...
      已评估 7 个事件
      符合定值: 4
      不符合定值: 0
      无对应定值: 1

------------------------------------------------------------
导出结果...
  ✓ events.csv -> ./result/events.csv
  ✓ review_report.md -> ./result/review_report.md
  ✓ timeline.html -> ./result/timeline.html

============================================================
分析完成!
============================================================
```

## 许可证

本工具仅供内部使用。
