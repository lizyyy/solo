# 串口协议回放诊断台

一个专为嵌入式测试工程师设计的本地端侧工具，用于解析、回放、分析串口/Modbus协议日志。

## 功能特性

- **协议配置初始化** (`init`) - 创建自定义协议配置，支持Modbus RTU/ASCII和自定义串口协议
- **日志导入解析** (`import-log`) - 导入串口/Modbus风格日志，自动校验时间戳、帧校验、设备地址和寄存器范围
- **会话回放** (`replay`) - 支持倍速、断点和故障注入回放
- **智能分析** (`analyze`) - 自动检测超时、乱序、重复帧和状态迁移异常
- **报告导出** (`export`) - 导出Markdown诊断报告、CSV异常清单和JSON回放包

## 项目结构

```
serial-protocol-diagnostic/
├── src/
│   └── serial_diagnostic/
│       ├── __init__.py          # 包初始化
│       ├── cli.py               # CLI命令行界面
│       ├── models.py            # 协议模型（帧定义、配置）
│       ├── parser.py            # 日志解析器
│       ├── state_machine.py     # 状态机引擎
│       ├── fault_injection.py   # 故障注入模块
│       ├── replay.py            # 回放调度器
│       ├── analyzer.py          # 协议分析器
│       └── exporter.py          # 报告导出器
├── examples/
│   ├── config.yaml              # 示例协议配置
│   ├── normal_log.txt           # 正常日志示例
│   ├── error_log.txt            # 包含异常的日志示例
│   └── scenario.yaml            # 场景脚本示例
├── tests/
│   └── test_all.py              # 单元测试
├── pyproject.toml               # 项目配置
└── README.md                    # 本文档
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

1. 克隆或下载项目到本地

```bash
cd xy4075
```

2. 以开发模式安装

```bash
pip install -e .
```

3. 安装开发依赖（可选）

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化协议配置

首先创建一个协议配置文件：

```bash
serial-diag init my_config.yaml --protocol modbus_rtu --baud-rate 19200 --timeout 500
```

或者使用示例配置：

```bash
cp examples/config.yaml my_config.yaml
```

### 2. 导入并解析日志

导入示例正常日志：

```bash
serial-diag import-log examples/normal_log.txt --config my_config.yaml -v
```

导入包含异常的日志：

```bash
serial-diag import-log examples/error_log.txt --config my_config.yaml --output parsed_session.json
```

### 3. 分析异常

使用正常日志进行分析：

```bash
serial-diag analyze --log examples/normal_log.txt --config my_config.yaml --output analysis_result -v
```

使用包含异常的日志进行分析：

```bash
serial-diag analyze --log examples/error_log.txt --config my_config.yaml --output error_analysis -v
```

### 4. 回放会话

正常回放（2倍速）：

```bash
serial-diag replay --log examples/normal_log.txt --config my_config.yaml --speed 2.0 -v
```

带故障注入的回放：

```bash
serial-diag replay --log examples/normal_log.txt --config my_config.yaml --inject-fault corrupt_crc@frame=5 -v
```

单步模式：

```bash
serial-diag replay --log examples/normal_log.txt --config my_config.yaml --step -v
```

添加断点：

```bash
serial-diag replay --log examples/normal_log.txt --config my_config.yaml --breakpoint frame:10 --breakpoint slave:1 -v
```

### 5. 导出报告

导出完整报告：

```bash
serial-diag export report --analysis analysis_result.json --config my_config.yaml --format all
```

导出异常清单CSV：

```bash
serial-diag export anomalies --analysis error_analysis.json --config my_config.yaml --format csv
```

导出JSON回放包：

```bash
serial-diag export replay_package --log examples/normal_log.txt --config my_config.yaml --format json
```

## 命令详解

### init 命令

初始化协议配置文件。

```bash
serial-diag init CONFIG_PATH [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `CONFIG_PATH` | string | 必填 | 配置文件输出路径 |
| `--protocol, -p` | choice | modbus_rtu | 协议类型：modbus_rtu, modbus_ascii, custom_serial |
| `--baud-rate, -b` | int | 9600 | 波特率 |
| `--timeout, -t` | int | 1000 | 超时时间（毫秒） |
| `--slave-range, -s` | string | 1-247 | 从机地址范围 |
| `--register-range, -r` | string | 0-65535 | 寄存器地址范围 |

**示例：**

```bash
# Modbus RTU 配置
serial-diag init modbus_config.yaml --protocol modbus_rtu --baud-rate 19200 --timeout 500

# Modbus ASCII 配置
serial-diag init ascii_config.yaml --protocol modbus_ascii --baud-rate 9600

# 自定义串口协议
serial-diag init custom_config.yaml --protocol custom_serial --slave-range 1-10
```

### import-log 命令

导入并解析串口/Modbus日志文件。

```bash
serial-diag import-log LOG_PATH --config CONFIG_PATH [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `LOG_PATH` | string | 必填 | 日志文件路径 |
| `--config, -c` | string | 必填 | 协议配置文件路径 |
| `--output, -o` | string | 无 | 解析结果输出路径（JSON） |
| `--validate/--no-validate` | flag | True | 是否校验帧 |
| `--verbose, -v` | flag | False | 显示详细信息 |

**示例：**

```bash
# 基本解析
serial-diag import-log log.txt --config config.yaml

# 解析并保存为JSON
serial-diag import-log log.txt --config config.yaml --output session.json

# 详细输出
serial-diag import-log log.txt --config config.yaml -v
```

**支持的日志格式：**

1. 带时间戳的Modbus RTU格式：
```
2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B
2026-05-02 10:00:00.150 R 01 03 04 00 01 00 02 79 79
```

其中：
- `T` 表示发送/请求帧
- `R` 表示接收/响应帧
- `01 03 ...` 为十六进制帧数据

2. 简单十六进制格式：
```
01 03 00 00 00 02 C4 0B
01 03 04 00 01 00 02 79 79
```

### replay 命令

回放会话，支持倍速、断点和故障注入。

```bash
serial-diag replay [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--config, -c` | string | 必填 | 协议配置文件路径 |
| `--log, -l` | string | 无 | 日志文件路径（需提供 --log 或 --session） |
| `--session, -s` | string | 无 | 已解析的会话JSON文件路径 |
| `--speed, -x` | float | 1.0 | 回放倍速（如 2.0 表示2倍速） |
| `--timeout, -t` | int | 配置值 | 超时时间（毫秒），覆盖配置 |
| `--breakpoint, -b` | string | 无 | 断点设置，可重复使用 |
| `--inject-fault, -i` | string | 无 | 故障注入，可重复使用 |
| `--from-frame` | int | 0 | 从指定帧开始 |
| `--step` | flag | False | 单步模式 |
| `--verbose, -v` | flag | False | 显示详细信息 |

**断点格式：** `类型:值`

支持的断点类型：
- `frame:N` - 在第N帧暂停
- `slave:N` - 访问从机N时暂停
- `func:XX` - 功能码为XX时暂停（如 `func:03`）
- `time:N` - 时间偏移N秒时暂停
- `error` - 遇到错误帧时暂停

**故障注入格式：** `故障类型@触发类型=值`

支持的故障类型：
- `drop` - 丢帧
- `duplicate` - 重复帧
- `delay` - 延迟帧
- `corrupt_crc` - 损坏CRC
- `corrupt_data` - 损坏数据
- `corrupt_slave` - 损坏从机地址
- `corrupt_func` - 损坏功能码
- `garbage` - 插入垃圾数据
- `truncate` - 截断帧
- `timeout` - 超时

支持的触发类型：
- `frame=N` - 第N帧
- `slave=N` - 从机N
- `func=XX` - 功能码XX
- `random` - 随机
- `time=N` - 时间偏移N秒

**示例：**

```bash
# 2倍速回放
serial-diag replay --log log.txt --config config.yaml --speed 2.0

# 带断点回放
serial-diag replay --log log.txt --config config.yaml --breakpoint frame:10 --breakpoint slave:1

# 故障注入 - 第5帧损坏CRC
serial-diag replay --log log.txt --config config.yaml --inject-fault corrupt_crc@frame=5

# 故障注入 - 从机1的帧丢包
serial-diag replay --log log.txt --config config.yaml --inject-fault drop@slave=1

# 单步模式
serial-diag replay --log log.txt --config config.yaml --step -v

# 从第5帧开始
serial-diag replay --log log.txt --config config.yaml --from-frame 5
```

### analyze 命令

分析会话，检测超时、乱序、重复帧和状态迁移异常。

```bash
serial-diag analyze [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--config, -c` | string | 必填 | 协议配置文件路径 |
| `--log, -l` | string | 无 | 日志文件路径 |
| `--session, -s` | string | 无 | 已解析的会话JSON文件路径 |
| `--timeout, -t` | int | 配置值 | 超时时间（毫秒） |
| `--output, -o` | string | 无 | 分析结果输出路径 |
| `--format, -f` | choice | all | 输出格式：json, csv, all |
| `--verbose, -v` | flag | False | 显示详细信息 |

**检测的异常类型：**

| 异常类型 | 严重程度 | 说明 |
|----------|----------|------|
| `timeout` | HIGH | 响应超时 |
| `out_of_order` | HIGH | 帧乱序 |
| `duplicate_frame` | MEDIUM | 重复帧 |
| `invalid_state_transition` | HIGH | 无效状态迁移 |
| `crc_error` | HIGH | CRC校验错误 |
| `lrc_error` | HIGH | LRC校验错误 |
| `invalid_slave_address` | HIGH | 无效从机地址 |
| `invalid_register_address` | MEDIUM | 无效寄存器地址 |
| `unexpected_response` | HIGH | 意外响应 |
| `missing_response` | CRITICAL | 缺少响应 |

**严重程度级别：**
- `CRITICAL` - 关键，必须修复
- `HIGH` - 高优先级，建议修复
- `MEDIUM` - 中等优先级
- `LOW` - 低优先级
- `INFO` - 信息级别

**示例：**

```bash
# 基本分析
serial-diag analyze --log log.txt --config config.yaml

# 分析并导出报告
serial-diag analyze --log log.txt --config config.yaml --output result -v

# 自定义超时时间
serial-diag analyze --log log.txt --config config.yaml --timeout 1000

# 使用已解析的会话
serial-diag analyze --session session.json --config config.yaml
```

### export 命令

导出诊断报告、异常清单和回放包。

```bash
serial-diag export OUTPUT_PATH [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `OUTPUT_PATH` | string | 必填 | 输出文件基础路径 |
| `--config, -c` | string | 必填 | 协议配置文件路径 |
| `--log, -l` | string | 无 | 日志文件路径 |
| `--session, -s` | string | 无 | 已解析的会话JSON文件路径 |
| `--analysis, -a` | string | 无 | 分析结果JSON文件路径 |
| `--format, -f` | choice | all | 导出格式：markdown, csv, json, all |
| `--include-session/--no-session` | flag | True | 是否包含完整会话数据（仅JSON） |

**导出格式：**

- `markdown` - Markdown格式诊断报告
- `csv` - CSV格式异常清单
- `json` - JSON格式完整回放包
- `all` - 同时导出所有格式

**示例：**

```bash
# 导出所有格式
serial-diag export report --analysis analysis.json --config config.yaml

# 仅导出Markdown报告
serial-diag export diagnosis --analysis analysis.json --config config.yaml --format markdown

# 导出异常清单CSV
serial-diag export anomalies --analysis analysis.json --config config.yaml --format csv

# 从日志直接导出
serial-diag export full_report --log log.txt --config config.yaml --format all
```

## 临时目录验证流程

以下是一个完整的验证流程，使用临时目录测试所有功能：

```bash
# 创建临时目录
mkdir -p /tmp/serial_test
cd /tmp/serial_test

# 1. 初始化配置
serial-diag init config.yaml --protocol modbus_rtu --baud-rate 19200 --timeout 500
echo "=== 配置文件内容 ==="
cat config.yaml

# 2. 创建测试日志
cat > test_log.txt << 'EOF'
2026-05-02 10:00:00.100 T 01 03 00 00 00 02 C4 0B
2026-05-02 10:00:00.150 R 01 03 04 00 01 00 02 79 79
2026-05-02 10:00:00.200 T 01 03 00 0A 00 01 A4 08
2026-05-02 10:00:00.230 R 01 03 02 00 01 79 79
2026-05-02 10:00:00.300 T 02 03 00 64 00 02 E5 EC
2026-05-02 10:00:00.350 R 02 03 04 01 90 02 58 65 4F
2026-05-02 10:00:00.400 T 01 05 00 C8 FF 00 CD 6A
2026-05-02 10:00:00.420 R 01 05 00 C8 FF 00 CD 6A
EOF

# 3. 导入日志
echo ""
echo "=== 导入日志 ==="
serial-diag import-log test_log.txt --config config.yaml --output session.json -v

# 4. 分析日志
echo ""
echo "=== 分析日志 ==="
serial-diag analyze --session session.json --config config.yaml --output analysis -v

# 5. 回放日志（快速模式）
echo ""
echo "=== 回放日志 ==="
serial-diag replay --session session.json --config config.yaml --speed 10.0 -v

# 6. 导出报告
echo ""
echo "=== 导出报告 ==="
serial-diag export report --analysis analysis.json --config config.yaml --session session.json --format all

# 7. 查看导出的文件
echo ""
echo "=== 导出的文件 ==="
ls -la report.*

# 8. 查看Markdown报告内容
echo ""
echo "=== Markdown报告预览 ==="
head -50 report.md

# 返回原目录
cd -
```

## 协议配置详解

配置文件使用YAML格式，以下是完整配置说明：

```yaml
# 基本配置
name: modbus_gateway_config          # 配置名称
protocol_type: modbus_rtu             # 协议类型: modbus_rtu, modbus_ascii, custom_serial

# 串口参数
baud_rate: 19200                       # 波特率
data_bits: 8                           # 数据位: 5-8
stop_bits: 1.0                         # 停止位: 1.0, 1.5, 2.0
parity: N                               # 校验位: N(无), O(奇), E(偶)

# 地址范围
slave_address_range:                   # 从机地址范围
  - 1
  - 10
register_range:                        # 寄存器地址范围
  - 0
  - 1000

# 通信参数
timeout_ms: 500                        # 超时时间(毫秒)
max_retry_count: 3                     # 最大重试次数

# 帧格式定义（用于自定义协议）
frame_formats:
  - name: modbus_rtu_timestamped
    pattern: ^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+([RTX])\s+([0-9A-Fa-f\s]+)$
    description: 带时间戳的Modbus RTU帧格式

# 寄存器定义（可选，用于详细分析）
registers:
  - address: 0
    name: Device_ID
    type: holding_register              # 类型: coil, discrete_input, input_register, holding_register
    description: 设备ID寄存器
    min_value: 1
    max_value: 255
  
  - address: 100
    name: Sensor_Temperature
    type: input_register
    description: 温度传感器读数
    scale: 0.1                           # 缩放因子
    unit: "°C"                           # 单位
```

## 故障注入示例

### 场景1：CRC错误测试

测试设备对CRC错误的处理：

```bash
serial-diag replay --log log.txt --config config.yaml --inject-fault corrupt_crc@frame=5 -v
```

### 场景2：丢包测试

模拟通信丢包：

```bash
serial-diag replay --log log.txt --config config.yaml --inject-fault drop@random -v
```

### 场景3：超时测试

模拟设备响应超时：

```bash
serial-diag replay --log log.txt --config config.yaml --inject-fault timeout@slave=1 -v
```

### 场景4：组合故障注入

同时注入多种故障：

```bash
serial-diag replay --log log.txt --config config.yaml \
  --inject-fault corrupt_crc@frame=3 \
  --inject-fault drop@frame=7 \
  --inject-fault duplicate@slave=2 \
  -v
```

## API使用示例

除了命令行界面，也可以作为Python库使用：

```python
from serial_diagnostic.models import ProtocolConfig, ProtocolType
from serial_diagnostic.parser import LogParserFactory
from serial_diagnostic.analyzer import ProtocolAnalyzer
from serial_diagnostic.replay import ReplayScheduler
from serial_diagnostic.exporter import ReportExporter

# 1. 创建配置
config = ProtocolConfig(
    name="my_config",
    protocol_type=ProtocolType.MODBUS_RTU,
    baud_rate=19200,
    timeout_ms=500
)

# 2. 解析日志
parser = LogParserFactory.create(config)
session = parser.parse_file("log.txt")

print(f"解析了 {session.frame_count} 帧")

# 3. 分析异常
analyzer = ProtocolAnalyzer(config, timeout_ms=500)
result = analyzer.analyze(session)

print(f"发现 {result.anomaly_count} 个异常")
for anomaly in result.anomalies:
    print(f"  - {anomaly.anomaly_type.value}: {anomaly.message}")

# 4. 回放
scheduler = ReplayScheduler(session)
scheduler.speed_multiplier = 2.0

def on_frame(frame, idx):
    print(f"处理帧 {idx}: {frame.direction.value}")

scheduler.on_frame(on_frame)
scheduler.start()

# 5. 导出报告
exporter = ReportExporter(
    analysis_result=result,
    session=session,
    protocol_config=config
)
exporter.export_all("report")
```

## 运行测试

运行单元测试：

```bash
pytest tests/ -v
```

运行测试并生成覆盖率报告：

```bash
pytest tests/ --cov=serial_diagnostic --cov-report=html
```

## 常见问题

### Q1: 支持哪些日志格式？

目前支持：
- 带时间戳的Modbus RTU格式（推荐）
- 简单十六进制格式
- Modbus ASCII格式

可以通过配置文件中的 `frame_formats` 自定义解析格式。

### Q2: 如何处理时间戳解析错误？

检查日志中的时间戳格式是否符合以下之一：
- `YYYY-MM-DD HH:MM:SS.ffffff`
- `YYYY-MM-DD HH:MM:SS`
- `HH:MM:SS.ffffff`
- `HH:MM:SS`
- Unix时间戳（秒）

如果使用自定义格式，可以在配置中添加自定义帧格式。

### Q3: 故障注入会修改原始日志吗？

不会。故障注入只在内存中进行，不会修改原始日志文件。所有修改都是临时的，回放结束后即消失。

### Q4: 如何添加新的故障类型？

可以通过扩展 `BaseFaultInjector` 类来添加新的故障类型：

```python
from serial_diagnostic.fault_injection import BaseFaultInjector, FaultType

class MyCustomInjector(BaseFaultInjector):
    def apply(self, frame, config):
        # 实现自定义故障逻辑
        pass

# 注册到工厂
FaultInjectorFactory._injectors[FaultType('my_custom')] = MyCustomInjector()
```

### Q5: 支持实时串口监听吗？

当前版本专注于离线日志分析和回放。实时监听功能可能在未来版本中添加。

## 版本历史

- **1.0.0** (2026-05-02)
  - 初始版本发布
  - 支持Modbus RTU/ASCII协议解析
  - 实现故障注入和回放功能
  - 实现异常分析和报告导出

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。
