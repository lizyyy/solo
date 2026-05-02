# 管网漏点夜巡拼图器

城市供水抢修班专用命令行工具，用于夜间管网漏点检测与分析。

## 功能特性

- **init** - 初始化管网节点、阀门和传感器配置
- **import** - 读取多源CSV数据（压力传感器、听漏仪巡检、阀门台账）
- **analyze** - 时间轴对齐、压力骤降识别、声纹异常检测、传播延迟分析
- **plan** - 漏点定位、关阀计划制定、受影响用户评估
- **review** - 人工复核与结果确认
- **report** - 导出Markdown、CSV、JSON格式报告
- **self-test** - 运行自检程序

## 快速开始

### 环境要求

- Python 3.7+
- 无需额外依赖（使用标准库）

### 安装

将项目复制到本地即可使用：

```bash
cd /path/to/xy4129
```

### 临时目录验证流程

以下是在临时目录中验证工具功能的完整流程：

#### 1. 运行自检程序

```bash
python pipe_leak_puzzle.py self-test --output ./test_output
```

这将自动创建示例项目并运行完整的分析流程。

#### 2. 手动创建并测试项目

##### 步骤1：初始化项目

```bash
# 创建默认大小的管网项目
python pipe_leak_puzzle.py init ./my-leak-project

# 或使用小型模板
python pipe_leak_puzzle.py init ./my-leak-project --template small
```

##### 步骤2：导入数据

首先生成示例数据：

```bash
python -c "from pipe_leak_puzzle.sample_data import generate_sample_data; generate_sample_data('./sample_csv')"
```

然后导入数据：

```bash
# 导入压力传感器数据
python pipe_leak_puzzle.py import ./my-leak-project --pressure ./sample_csv/pressure_sample.csv

# 导入听漏仪数据
python pipe_leak_puzzle.py import ./my-leak-project --acoustic ./sample_csv/acoustic_sample.csv

# 导入阀门台账
python pipe_leak_puzzle.py import ./my-leak-project --valve ./sample_csv/valve_sample.csv

# 或一次性导入所有数据
python pipe_leak_puzzle.py import ./my-leak-project \
    --pressure ./sample_csv/pressure_sample.csv \
    --acoustic ./sample_csv/acoustic_sample.csv \
    --valve ./sample_csv/valve_sample.csv
```

##### 步骤3：时序分析

```bash
# 使用默认参数分析
python pipe_leak_puzzle.py analyze ./my-leak-project

# 或自定义参数
python pipe_leak_puzzle.py analyze ./my-leak-project \
    --pressure-threshold 0.15 \
    --acoustic-threshold 0.7 \
    --time-window 300
```

参数说明：
- `--pressure-threshold`: 压力骤降阈值（默认0.15，即15%）
- `--acoustic-threshold`: 声纹异常阈值（默认0.7）
- `--time-window`: 时间对齐窗口秒数（默认300秒=5分钟）

##### 步骤4：漏点定位与关阀计划

```bash
# 使用最小影响策略
python pipe_leak_puzzle.py plan ./my-leak-project

# 或使用保守策略
python pipe_leak_puzzle.py plan ./my-leak-project --isolation-strategy conservative
```

隔离策略说明：
- `minimal`: 最小化影响范围，只关闭必要阀门（默认）
- `conservative`: 保守策略，关闭更多阀门确保隔离
- `aggressive`: 激进策略，关闭所有相关阀门

##### 步骤5：人工复核

```bash
# 确认分析结果
python pipe_leak_puzzle.py review ./my-leak-project --confirm --notes "经现场核实，确认漏点位置"

# 或拒绝分析结果
python pipe_leak_puzzle.py review ./my-leak-project --reject --notes "为正常用水峰波动，非漏点"

# 或调整漏点位置
python pipe_leak_puzzle.py review ./my-leak-project \
    --confirm \
    --adjust-leak-location "S007东支管中段" \
    --notes "调整漏点位置至东支管中段"
```

##### 步骤6：导出报告

```bash
# 导出Markdown格式
python pipe_leak_puzzle.py report ./my-leak-project --format markdown

# 导出所有格式
python pipe_leak_puzzle.py report ./my-leak-project --format all

# 导出到指定目录
python pipe_leak_puzzle.py report ./my-leak-project --format all --output ./my-reports
```

## 项目结构

```
my-leak-project/
├── config/
│   ├── network.json      # 管网配置（节点、阀门、传感器）
│   └── metadata.json     # 项目元数据
├── data/
│   ├── pressure_data.json   # 压力传感器数据
│   ├── acoustic_data.json   # 听漏仪数据
│   ├── valve_data.json      # 阀门台账数据
│   └── flow_data.json       # 流量数据（可选）
├── analysis/
│   ├── analysis_result.json  # 时序分析结果
│   └── isolation_result.json # 隔离计划结果
├── reports/                  # 导出的报告
└── review/                   # 复核记录
```

## 数据格式说明

### 压力传感器CSV

```csv
时间戳,传感器ID,压力(MPa),状态
2026-05-01 20:00:00,P001,0.4500,正常
2026-05-01 20:00:00,P002,0.4200,正常
...
```

### 听漏仪CSV

```csv
时间戳,位置,声强(dB),主频(Hz),异常评分,设备ID
2026-05-02 02:00:00,主干管中段,45.0,50,0.100,A001
2026-05-02 02:05:00,东支管中段,65.0,350,0.850,A001
...
```

### 阀门台账CSV

```csv
阀门ID,阀门名称,位置,状态,管径(mm),所在管段,操作优先级,X坐标,Y坐标
V001,水厂出口阀,水厂,开启,400,S001,1,75,100
V004,主干1入口阀,主干节点1东侧,开启,300,S004,1,325,100
...
```

## 核心算法说明

### 1. 压力骤降检测

- 按传感器分组计算基线压力（排除极端值10%后取平均）
- 检测超过阈值的压力下降事件
- 自动排除正常用水峰时段的小幅波动

### 2. 声纹异常检测

- 分析声强水平与基线的偏差
- 检测特定频率范围（100-1000Hz为漏水典型频率）
- 综合计算异常评分

### 3. 传播延迟分析

- 分析不同传感器检测到异常的时间差
- 结合管网拓扑计算理论传播时间
- 判断异常是否为同一事件

### 4. 正常用水峰过滤

- 识别典型用水高峰时段（早6-9点，晚18-22点）
- 分析压力下降幅度和持续时间
- 结合声纹数据综合判断

### 5. 漏点定位

- 高置信度事件优先
- 结合压力和声纹双重证据
- 利用传播延迟分析结果

### 6. 关阀计划

- 支持三种隔离策略
- 基于管网拓扑计算被隔离区域
- 评估受影响用户范围

## 命令参考

```bash
# 查看帮助
python pipe_leak_puzzle.py --help

# 查看子命令帮助
python pipe_leak_puzzle.py init --help
python pipe_leak_puzzle.py analyze --help

# 查看版本
python pipe_leak_puzzle.py --version
```

## 模块说明

| 模块 | 功能 |
|------|------|
| `cli.py` | 命令行调度器 |
| `network_model.py` | 管网数据模型（节点、阀门、传感器、管段） |
| `parser.py` | 多源CSV数据解析与校验 |
| `time_series.py` | 时序分析（时间对齐、异常检测） |
| `valve_isolation.py` | 漏点定位与关阀计划 |
| `review_storage.py` | 人工复核存储 |
| `report.py` | 报告导出（Markdown/CSV/JSON） |
| `sample_data.py` | 示例数据生成 |

## 常见问题

### Q: 如何判断是正常用水还是漏点？

A: 工具通过以下特征区分：
- **正常用水峰**: 发生在典型用水时段（早6-9，晚18-22），压力下降幅度小（<10%），持续时间短
- **疑似漏点**: 压力骤降幅度大（>15%），伴随声纹异常，发生在非高峰时段

### Q: 如何调整分析灵敏度？

A: 通过以下参数调整：
- 降低 `--pressure-threshold`（如0.10）会检测更多压力下降
- 降低 `--acoustic-threshold`（如0.5）会检测更多声纹异常

### Q: 为什么自检程序很重要？

A: 自检程序会：
- 创建完整的示例项目
- 模拟包含漏点的压力数据
- 执行完整的分析流程
- 验证所有模块功能正常

## 许可证

本工具仅供内部使用。
