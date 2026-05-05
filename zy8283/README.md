# PLC 日志分析工具

工厂设备运维夜班专用的日志整理工具，支持解析 PLC 网关和边缘采集器的多种日志格式。

## 功能特性

- **多格式支持**: 解析 `.log`, `.txt`, `.jsonl` 多种日志格式
- **YAML 配置**: 灵活的正则模板系统，可配置多套解析规则
- **字段抽取**: 自动提取时间戳、设备号、日志级别、错误码、批次号
- **坏行检测**: 识别无法匹配、时间倒序、跨午夜归属可疑的行
- **归档功能**: 将坏行归档到 JSONL 文件，保留原始行号和原因
- **报告生成**: 输出按设备/错误码聚合的事件汇总报告

## 安装

### Python 依赖

```bash
pip install -r requirements.txt
```

或手动安装：

```bash
pip install pyyaml python-dateutil
```

## 快速开始

### 分析示例数据

```bash
python -m plc_log_analyzer analyze
```

这将：
1. 使用 `config/templates.yaml` 配置
2. 分析 `samples/` 目录下的所有日志文件
3. 生成 `incident_summary.md` 报告
4. 将坏行归档到 `archive/bad-lines.jsonl`

### 命令行参数

```bash
python -m plc_log_analyzer analyze [选项]

选项:
  -i, --input     输入路径 (文件或目录，默认: samples)
  -c, --config    配置文件路径 (默认: config/templates.yaml)
  -o, --output    输出目录 (默认: 当前目录)
  -a, --archive   坏行归档目录 (默认: archive)
  -t, --timezone  时区偏移 (小时，默认: 8 表示 UTC+8)
```

### 使用示例

```bash
# 指定输入目录
python -m plc_log_analyzer analyze -i /path/to/logs

# 指定自定义配置
python -m plc_log_analyzer analyze -c my_templates.yaml

# 指定输出位置
python -m plc_log_analyzer analyze -o ./reports -a ./bad_archive

# 完整示例
python -m plc_log_analyzer analyze \
  -i /var/log/plc \
  -c /etc/plc-analyzer/templates.yaml \
  -o /reports/plc \
  -a /reports/plc/archive
```

## 配置说明

配置文件使用 YAML 格式，定义多套正则模板。

### 模板类型

#### 1. 标准正则模板

```yaml
templates:
  - name: plc_gateway_standard
    description: "PLC网关标准日志格式"
    pattern: '^(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+\[(?P<device>PLC-\w+)\]\s+(?P<level>INFO|WARN|ERROR|DEBUG)\s+(?P<module>[\w\.]+):\s+(?P<message>.*)$'
    fields:
      timestamp:
        format: "%Y-%m-%d %H:%M:%S.%f"
    error_code_extraction:
      pattern: 'Error\s+Code:\s*(?P<error_code>E\d{3,4})'
    batch_extraction:
      pattern: 'Batch\s+ID:\s*(?P<batch_id>B\d{6})'
```

#### 2. JSONL 模板

```yaml
  - name: edge_collector_jsonl
    description: "边缘采集器JSONL格式"
    pattern: '^(?P<json>.*)$'
    is_json: true
    json_fields:
      timestamp: ["time", "timestamp", "@timestamp"]
      device: ["device_id", "device", "plc_id"]
      level: ["level", "log_level", "severity"]
      message: ["message", "msg", "content"]
      error_code: ["error_code", "code", "err_code"]
      batch_id: ["batch_id", "batch", "lot_id"]
    timestamp_format: "%Y-%m-%dT%H:%M:%S.%fZ"
```

#### 3. 遗留 syslog 格式

```yaml
  - name: legacy_syslog_format
    description: "遗留syslog格式日志"
    pattern: '^(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(?P<device>PLC-\w+)\s+(?P<level>\w+):\s+(?P<message>.*)$'
    fields:
      timestamp:
        format: "%b %d %H:%M:%S"
        year_default: 2026
    level_mapping:
      "warning": "WARN"
      "err": "ERROR"
      "info": "INFO"
      "debug": "DEBUG"
```

### 可抽取字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| timestamp | 时间戳 | 2026-05-04 08:00:01.123 |
| device | 设备号 | PLC-001, EDGE-002 |
| level | 日志级别 | INFO, WARN, ERROR, DEBUG |
| module | 模块名 | plc.gateway.connection |
| message | 原始消息 | Connection established |
| error_code | 错误码 | E1001, E2003 |
| batch_id | 批次号 | B2026001 |

## 示例数据说明

`samples/` 目录包含多种格式的示例日志：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| `plc_gateway.log` | 标准正则格式 | PLC网关正常日志 |
| `edge_collector.jsonl` | JSONL 格式 | 边缘采集器日志 |
| `legacy_syslog.txt` | Syslog 格式 | 遗留系统日志 |
| `bad_examples.txt` | 混合格式 | **坏样例演示文件** |

## 坏样例演示

`samples/bad_examples.txt` 包含各种脏数据场景，展示工具的处理能力：

### 1. 半截行 (Partial Lines)

```
2026-05-04 08:00:03.456 [PLC-PARTIAL] ERROR 
2026-05-04 08:00:04.789 [PLC-PARTIAL] WARN incomplete message with no en
```

**处理结果**: 无法匹配完整模板，标记为坏行，保留部分字段。

### 2. 编码混杂 (Mixed Encoding)

```
2026-05-04 08:00:05.123 [PLC-ENCODING] INFO 传感器读数异常: 温度过高
2026-05-04 08:00:06.456 [PLC-ENCODING] WARN 设备状态异常: 连接断开
```

**处理结果**: 自动尝试多种编码 (UTF-8, GBK, Latin-1)，最终使用替换模式读取。

### 3. 模块名缺失 (Missing Module)

```
2026-05-04 08:00:07 无模块名的日志行
2026-05-04 08:00:08 另一个没有模块和级别的行
```

**处理结果**: 无法匹配标准模板，标记为坏行，尝试提取部分信息。

### 4. 错误码内嵌 (Embedded Error Code)

```
2026-05-04 08:00:09.123 [PLC-EMBEDDED] ERROR something.wrong: Fatal error occurred E5001 during processing
```

**处理结果**: 通过 `error_code_extraction` 配置从 message 中提取 `E5001`。

### 5. 时间倒序 (Out of Order)

```
2026-05-04 08:00:15.123 [PLC-ORDER] INFO time.order: This should be last
2026-05-04 08:00:12.456 [PLC-ORDER] INFO time.order: This should be first
2026-05-04 08:00:10.789 [PLC-ORDER] INFO time.order: This is even earlier
```

**处理结果**: 检测到时间倒序，标记为坏行并写入归档。

### 6. 跨午夜可疑 (Midnight Crossing Suspicious)

```
2026-05-04 23:59:58.123 [PLC-MIDNIGHT] INFO midnight.test: Before midnight
2026-05-04 00:00:01.456 [PLC-MIDNIGHT] INFO midnight.test: After midnight but wrong date
```

**处理结果**: 检测到时间间隙超过 12 小时且非正常跨午夜，标记为可疑。

### 7. 无效 JSON (Invalid JSON)

```
{invalid json because no closing
just some random text with no timestamp
```

**处理结果**: JSON 解析失败，无法匹配任何模板，标记为坏行。

## 输出文件说明

### 1. incident_summary.md

事件汇总报告，包含：

- **概览统计**: 总行数、有效行数、坏行数、涉及设备数、错误码数
- **时间范围**: 日志覆盖的时间区间
- **按设备聚合**: 每个设备的事件统计和详情
- **按错误码聚合**: 每个错误码的出现次数和涉及设备
- **事件时间线**: 按时间排序的事件列表

### 2. archive/bad-lines.jsonl

坏行归档文件，每行一个 JSON 对象，包含：

```json
{
  "original_line": "原始日志行内容",
  "line_number": 123,
  "file_path": "/path/to/file.log",
  "reasons": ["no_matching_template", "missing_timestamp"],
  "parsed_fields": {
    "timestamp": "2026-05-04T08:00:01",
    "device_id": "PLC-001",
    "level": "ERROR",
    "error_code": "E1001",
    "matched_template": "plc_gateway_standard"
  }
}
```

### 坏行原因类型

| 原因 | 说明 |
|------|------|
| no_matching_template | 无法匹配任何预定义模板 |
| time_out_of_order | 时间戳出现倒序 |
| midnight_crossing_suspicious | 跨午夜时间间隙过大 |
| missing_timestamp | 缺少时间戳 |
| empty_line | 空行 |
| invalid_timestamp_format | 时间戳格式无效 |
| unknown_log_level | 未知的日志级别 |

## 项目结构

```
.
├── plc_log_analyzer/     # 主模块
│   ├── __init__.py       # 版本信息
│   ├── __main__.py       # 模块入口
│   ├── main.py           # CLI 主程序
│   ├── parser.py         # 日志解析核心
│   ├── config_loader.py  # YAML 配置加载
│   ├── analyzer.py       # 坏行检测与分析
│   └── reporter.py       # 报告生成
├── config/
│   └── templates.yaml    # 正则模板配置
├── samples/              # 示例数据
│   ├── plc_gateway.log
│   ├── edge_collector.jsonl
│   ├── legacy_syslog.txt
│   └── bad_examples.txt  # 坏样例演示
├── archive/              # 坏行归档 (生成)
│   └── bad-lines.jsonl
├── incident_summary.md   # 分析报告 (生成)
├── requirements.txt      # Python 依赖
└── README.md
```

## 常见问题

### Q: 如何添加新的日志格式支持？

在 `config/templates.yaml` 中添加新的模板定义，配置正则表达式和字段映射。

### Q: 工具支持哪些编码？

自动尝试以下编码顺序：UTF-8 → GBK → GB2312 → CP1252 → Latin-1

### Q: 如何处理跨时区的日志？

使用 `-t/--timezone` 参数指定时区偏移（小时），默认为 UTC+8。

### Q: 坏行被归档后还能恢复吗？

归档文件 `archive/bad-lines.jsonl` 保留了原始行号和部分提取的字段，可以用于后续人工审核。

## License

MIT License
