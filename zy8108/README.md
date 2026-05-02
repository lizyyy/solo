# CAN总线诊断与回放工具

一个用于硬件测试的本地CAN总线日志分析与诊断CLI工具。

## 功能特性

- **日志解析**: 支持多种candump格式，自动处理跨天时间戳
- **信号解码**: 从YAML配置加载信号定义，支持大小端、有符号/无符号、缩放偏移、枚举类型
- **诊断规则**: 检测心跳丢失、信号越界、计数器回跳、ID冲突、周期违规等问题
- **状态聚合**: 重建每台设备的状态时间线
- **报告生成**: 导出issues.csv、timeline.html、report.md三种格式

## 项目结构

```
zy8108/
├── can_diagnostic_tool/
│   ├── __init__.py
│   ├── log_parser.py        # 日志解析模块
│   ├── signal_decoder.py    # 信号解码模块
│   ├── rule_engine.py       # 规则引擎模块
│   ├── state_aggregator.py  # 状态聚合模块
│   ├── report_generator.py  # 报告生成模块
│   └── main.py              # CLI入口
├── sample_data/
│   ├── signals.yaml          # 信号定义配置
│   ├── diagnostic_rules.yaml # 诊断规则配置
│   ├── devices.csv           # 设备台账
│   ├── candump.log           # 示例CAN日志
│   └── generate_sample_log.py # 日志生成脚本
└── README.md
```

## 安装依赖

```bash
pip3 install pyyaml
```

## 快速开始

运行完整示例演示：

```bash
cd /Users/lzy/pro/solocoder/pro/zy8108/repo/zy8108

python3 -m can_diagnostic_tool \
    --signals sample_data/signals.yaml \
    --log sample_data/candump.log \
    --rules sample_data/diagnostic_rules.yaml \
    --devices sample_data/devices.csv \
    --output ./output \
    --verbose
```

或者使用短参数：

```bash
python3 -m can_diagnostic_tool \
    -s sample_data/signals.yaml \
    -l sample_data/candump.log \
    -r sample_data/diagnostic_rules.yaml \
    -d sample_data/devices.csv \
    -o ./output \
    -v
```

## 输入文件格式

### 1. signals.yaml - 信号定义配置

定义CAN ID到信号的映射关系：

```yaml
can_ids:
  0x123:  # CAN ID (十六进制)
    name: "Motor_Controller_Heartbeat"
    description: "电机控制器心跳帧"
    dlc: 8
    cycle_time_ms: 1000  # 期望周期(毫秒)
    is_heartbeat: true    # 标记为心跳帧
    signals:
      heartbeat_counter:   # 信号名称
        start_bit: 0        # 起始位
        bit_length: 8       # 位长度
        is_signed: false    # 是否有符号
        is_little_endian: true  # 是否小端(Intel格式)
        scale: 1.0          # 缩放因子
        offset: 0.0         # 偏移量
        unit: ""            # 单位
        min: 0              # 最小值(用于越界检测)
        max: 255            # 最大值
        enum:               # 枚举值(可选)
          0: "STANDBY"
          1: "RUNNING"
```

### 2. diagnostic_rules.yaml - 诊断规则配置

```yaml
rules:
  # 心跳丢失检测
  heartbeat_miss:
    name: "心跳丢失检测"
    severity: "CRITICAL"    # CRITICAL/WARNING/INFO
    enabled: true
    parameters:
      default_interval_ms: 1000  # 默认期望周期
      max_multiplier: 3.0        # 允许的最大倍数(超过则判定丢失)

  # 信号越界检测
  signal_out_of_range:
    name: "信号越界检测"
    severity: "WARNING"
    enabled: true

  # 计数器回跳检测
  counter_jump_back:
    name: "计数器回跳检测"
    severity: "CRITICAL"
    enabled: true
    parameters:
      counter_signals:        # 定义哪些信号是计数器
        heartbeat_counter:
          bit_length: 8
          allow_rollover: true  # 是否允许循环(如255->0)

  # ID冲突检测
  id_conflict:
    name: "ID冲突检测"
    severity: "CRITICAL"
    enabled: true

  # 周期违规检测
  cycle_violation:
    name: "周期违规检测"
    severity: "WARNING"
    enabled: true
    parameters:
      min_multiplier: 0.5   # 最小允许倍数(太快)
      max_multiplier: 2.0   # 最大允许倍数(太慢)
```

### 3. devices.csv - 设备台账

```csv
device_id,device_name,can_ids,description,location,model,serial_number
MCU001,电机控制器,0x123;0x124,主驱动电机控制器,前舱,MCU-V2.0,MCU-2024-001
BMS001,电池管理系统,0x150;0x151;0x152,动力电池BMS,后舱,BMS-V1.5,BMS-2024-001
VCU001,整车控制器,0x180,整车控制单元,驾驶舱,VCU-V3.0,VCU-2024-001
```

### 4. candump.log - CAN日志

支持的格式：

```
# 标准candump格式
(1705284000.000000) can0 123#0010000000000000
(1705284000.100000) can0 124#0000000041460000
```

## 输出文件说明

### 1. issues.csv - 问题列表

包含所有检测到的问题，按时间排序：

| 字段 | 说明 |
|------|------|
| timestamp | 时间戳 |
| issue_type | 问题类型 |
| severity | 严重程度 |
| device_id | 设备ID |
| can_id | CAN ID |
| signal_name | 信号名称 |
| message | 问题描述 |
| details | 详细信息 |

### 2. timeline.html - 交互式时间线

一个HTML文件，包含：
- 问题统计卡片
- 多维度筛选(设备、事件类型、严重程度、关键词搜索)
- 可视化时间线，支持颜色编码
- 信号变化和问题事件

在浏览器中打开查看：

```bash
open output/timeline.html
```

### 3. report.md - 完整分析报告

Markdown格式的详细报告，包含：
- 概览和问题统计
- 日志解析统计
- 设备状态
- ID冲突检测
- 未知CAN ID列表
- 问题详情
- 总结建议

## 模块说明

### log_parser.py - 日志解析

- 支持多种candump格式
- **跨天处理**: 检测时间戳突然回退超过1小时，自动添加天偏移
- **未知ID处理**: 标记不在配置中的CAN ID

### signal_decoder.py - 信号解码

- 加载signals.yaml配置
- 支持Intel(小端)和Motorola(大端)格式
- 支持有符号/无符号值
- 应用缩放因子和偏移量
- 支持枚举类型解码

### rule_engine.py - 规则引擎

检测以下问题类型：

| 问题类型 | 说明 |
|----------|------|
| HEARTBEAT_MISS | 心跳帧间隔超过允许范围 |
| SIGNAL_OUT_OF_RANGE | 信号值超出min/max范围 |
| COUNTER_JUMP_BACK | 计数器异常回跳(排除正常循环) |
| ID_CONFLICT | 同一CAN ID被多个设备占用 |
| CYCLE_VIOLATION | 帧发送周期异常 |
| UNKNOWN_CAN_ID | 未在配置中定义的CAN ID |

### state_aggregator.py - 状态聚合

- 跟踪每台设备的信号值变化
- 重建状态时间线
- 检测ID冲突
- 统计设备活跃度

### report_generator.py - 报告生成

- CSV导出：问题列表
- HTML时间线：交互式可视化
- Markdown报告：完整分析

## 示例日志包含的问题场景

运行示例日志将检测到以下问题：

1. **心跳丢失**: 第7秒和第8秒跳过MCU心跳帧
2. **信号越界**: 电机温度超过BMS定义的85°C范围
3. **计数器回跳**: 第8.5秒BMS数据计数器从高值回跳到10
4. **未知CAN ID**: CAN ID 0x200不在配置中
5. **跨天时间戳**: 模拟从1月15日23:59:59跨越到1月16日00:00:01

## 命令行参数

```
usage: can_diagnostic_tool [-h] --signals SIGNALS --log LOG --rules RULES
                            --devices DEVICES [--output OUTPUT] [--verbose]

CAN总线诊断与回放工具 - 分析CAN日志并生成诊断报告

optional arguments:
  -h, --help            show this help message and exit
  --signals SIGNALS, -s SIGNALS
                        信号定义YAML文件路径 (signals.yaml)
  --log LOG, -l LOG     candump日志文件路径
  --rules RULES, -r RULES
                        诊断规则YAML文件路径
  --devices DEVICES, -d DEVICES
                        设备台账CSV文件路径
  --output OUTPUT, -o OUTPUT
                        输出目录路径 (默认: ./output)
  --verbose, -v         显示详细输出
```

## 注意事项

1. **跨天日志**: 工具会自动检测时间戳回退超过1小时的情况，认为是跨越了午夜，自动添加天偏移。如果日志确实存在时间戳跳变但不是跨天，请确保日志时间戳是连续的。

2. **未知报文ID**: 工具会记录并报告日志中出现但未在signals.yaml中定义的CAN ID。这些帧会被忽略解码，但会在报告中列出。

3. **ID冲突**: 确保devices.csv中每个CAN ID只属于一个设备。如果同一ID被多个设备声明，工具会检测到冲突。

4. **计数器循环**: 配置counter_signals时，设置allow_rollover: true可以允许计数器从最大值回到0(如255->0)，这种情况不会被判定为回跳。

## 许可证

内部使用。
