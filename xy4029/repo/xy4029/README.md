# 故障复盘拼图器

一个给小型运维/SRE 值班组用的本地自动化工具，用于将散落在监控告警、值班群消息、服务日志中的故障信息统一整理成一条可信的事件时间线。

## 功能特性

- **多源数据导入**: 支持导入监控告警CSV、值班群Markdown/JSON消息、服务日志片段
- **时间线归并**: 自动修正时区和设备时钟偏移，合并重复告警
- **事件类型识别**: 智能识别"告警触发、人工确认、变更操作、错误日志激增、恢复验证、复盘待办"等事件类型
- **敏感数据脱敏**: 内置敏感字段脱敏规则，支持自定义规则
- **隔离区机制**: 遇到时间戳缺失、格式不匹配、来源冲突等问题时，写入隔离区并给出清楚原因，而非静默丢弃
- **报告导出**: 生成Markdown复盘报告和CSV事件清单，包含影响时长、检测耗时、恢复耗时分析
- **历史查询**: 支持按服务、日期、严重级别查询过去的复盘记录

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 克隆或下载项目代码
cd postmortem-puzzle

# 以开发模式安装
pip install -e .

# 或者安装依赖后直接运行
pip install -r requirements.txt
python -m postmortem_puzzle.cli --help
```

## 快速开始

### 使用示例数据验证核心流程

```bash
# 1. 创建临时目录
mkdir -p /tmp/postmortem-demo
cd /tmp/postmortem-demo

# 2. 初始化项目
postmortem init --name "演示故障复盘" --service api-gateway --service order-service

# 3. 查看项目结构
ls -la .postmortem/

# 4. 导入示例数据（假设示例文件在 examples 目录）
# 导入告警CSV
postmortem import-alerts /path/to/examples/sample_alerts.csv --service api-gateway

# 导入聊天记录
postmortem import-chat /path/to/examples/sample_chat.md

# 导入服务日志
postmortem import-logs /path/to/examples/sample_app.log --service api-gateway

# 5. 归并时间线
postmortem reconcile

# 6. 导出报告
postmortem report

# 7. 查看历史记录
postmortem history --full
```

## 命令详解

### init - 初始化项目

创建项目配置和目录结构。

```bash
postmortem init --name "项目名称" [--service <服务名>...] [--timezone <时区>] [--force]
```

**选项**:
- `--name, -n`: 项目名称（必需）
- `--service, -s`: 服务名称（可多次指定）
- `--timezone, -t`: 默认时区，默认 `Asia/Shanghai`
- `--force, -f`: 强制覆盖现有配置

**示例**:
```bash
postmortem init --name "生产环境故障复盘" --service api-gateway --service order-service --timezone Asia/Shanghai
```

### import-alerts - 导入监控告警CSV

将监控告警CSV导入到项目中。**原始文件不会被修改**，会复制到项目的 `imports/alerts` 目录下。

```bash
postmortem import-alerts <csv_file> [--service <服务名>] [--timezone <时区>]
```

**支持的CSV格式**:
- 列名支持: `timestamp`, `time`, `alertname`, `severity`, `status`, `description`, `source`, `service` 等
- 支持 Prometheus Alertmanager、Zabbix、Nagios 等常见监控系统的导出格式

**示例**:
```bash
postmortem import-alerts alerts_20240115.csv --service api-gateway
```

### import-chat - 导入值班群消息

支持 Markdown 和 JSON 格式的聊天记录导出。

```bash
postmortem import-chat <chat_file> [--format <markdown|json|auto>] [--service <服务名>] [--timezone <时区>]
```

**支持的格式**:
- **Markdown**: 微信/企业微信导出格式
  ```
  2024-01-15 10:30:00 张三
  收到告警了，帮忙看看

  2024-01-15 10:31:00 李四
  我来处理
  ```
- **JSON**: Slack、钉钉等导出格式

**示例**:
```bash
postmortem import-chat wechat_export.md
postmortem import-chat slack_export.json --format json
```

### import-logs - 导入服务日志片段

可同时导入多个日志文件。支持多种日志时间格式。

```bash
postmortem import-logs <log_file1> [log_file2...] [--service <服务名>] [--timezone <时区>] [--log-format <格式名>]
```

**支持的日志格式**:
- Nginx 访问日志
- Java 应用日志 (Log4j, Logback)
- Python 应用日志
- 通用文本日志 (带时间戳)

**示例**:
```bash
postmortem import-logs app.log error.log --service api-gateway
postmortem import-logs nginx.log --log-format Common
```

### reconcile - 归并时间线

将所有导入的事件统一归并成一条可信的时间线：

- 修正时区和设备时钟偏移
- 合并重复告警（按配置的去重窗口）
- 识别事件类型
- 处理冲突和异常事件到隔离区

```bash
postmortem reconcile [--output <输出文件>] [--dry-run]
```

**选项**:
- `--output, -o`: 输出时间线JSON文件路径
- `--dry-run, -n`: 仅预览，不保存结果

**示例**:
```bash
postmortem reconcile
postmortem reconcile --dry-run
postmortem reconcile --output timeline.json
```

**隔离区 (quarantine.json)**:

当遇到以下情况时，事件会被写入隔离区：
- 时间戳缺失
- 日志格式不匹配
- 同一事件来源冲突
- 敏感字段命中但无法脱敏

隔离区文件位置: `.postmortem/data/quarantine.json`

### report - 导出复盘报告

生成 Markdown 格式的复盘报告和 CSV 格式的事件清单。

```bash
postmortem report [--timeline-id <时间线ID>] [--output-dir <输出目录>] [--name <文件名前缀>]
```

**报告内容**:
- 故障基本信息和时间线概览
- 影响时长、检测到确认耗时、确认到恢复耗时分析
- 关键事件和证据片段
- 待办事项列表
- 隔离事件说明

**示例**:
```bash
postmortem report
postmortem report --timeline-id abc12345 --output-dir ./reports
```

### history - 查询历史复盘记录

从本地 SQLite 数据库查询过去的故障复盘时间线。

```bash
postmortem history [--service <服务名>] [--start-date <开始日期>] [--end-date <结束日期>] [--severity <级别>] [--limit <数量>] [--full]
```

**选项**:
- `--service, -s`: 按服务筛选
- `--start-date, -d`: 开始日期 (格式: YYYY-MM-DD)
- `--end-date, -e`: 结束日期 (格式: YYYY-MM-DD)
- `--severity, -l`: 按严重级别筛选
- `--limit, -n`: 显示数量限制，默认 10
- `--full, -f`: 显示完整详情

**示例**:
```bash
postmortem history
postmortem history --service api-gateway --limit 20
postmortem history --start-date 2024-01-01 --end-date 2024-01-31
postmortem history --full
```

## 项目结构

```
postmortem-puzzle/
├── postmortem_puzzle/
│   ├── __init__.py
│   ├── cli.py              # CLI入口
│   ├── config.py           # 配置模型和数据模型
│   ├── reconciler.py       # 时间线归并和去重规则
│   ├── sanitizer.py        # 脱敏与隔离区
│   ├── storage.py          # SQLite存储层
│   ├── reporter.py         # 报告导出
│   └── parsers/
│       ├── __init__.py
│       ├── alerts_parser.py # 告警CSV解析器
│       ├── chat_parser.py   # 聊天记录解析器
│       └── logs_parser.py   # 日志解析器
├── examples/
│   ├── sample_alerts.csv   # 示例告警CSV
│   ├── sample_chat.md      # 示例聊天记录
│   └── sample_app.log      # 示例应用日志
├── tests/
│   ├── __init__.py
│   └── test_config.py      # 配置模型测试
├── pyproject.toml          # 项目配置
└── README.md
```

## 配置说明

初始化后，配置文件位于 `.postmortem/config.json`，可手动编辑：

```json
{
  "project_name": "演示故障复盘",
  "default_timezone": "Asia/Shanghai",
  "services": ["api-gateway", "order-service"],
  "environments": ["production", "staging", "development"],
  "deduplication_window_seconds": 300,
  "clock_offset_seconds": 0,
  "log_time_formats": [
    {"name": "ISO8601", "format": "%Y-%m-%dT%H:%M:%S%z"},
    {"name": "Common", "format": "%Y-%m-%d %H:%M:%S"}
  ],
  "sensitivity_rules": [
    {
      "name": "password",
      "pattern": "(?i)(password|passwd|pwd)[\"\\s:=]+[\"']?[^\\s\"',}]+[\"']?",
      "replacement": "\\1: \"***\""
    },
    {
      "name": "ip_address",
      "pattern": "\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b",
      "replacement": "***.***.***.***"
    }
  ]
}
```

**配置项说明**:
- `deduplication_window_seconds`: 告警去重窗口（秒），默认300秒
- `clock_offset_seconds`: 设备时钟偏移（秒），正数表示设备时间比实际时间快
- `log_time_formats`: 支持的日志时间格式列表
- `sensitivity_rules`: 敏感字段脱敏规则列表

## 事件类型说明

| 事件类型 | 说明 | 触发条件 |
|---------|------|---------|
| `alert_trigger` | 告警触发 | 监控告警触发状态 |
| `alert_recover` | 告警恢复 | 监控告警恢复状态 |
| `human_confirm` | 人工确认 | 聊天记录中包含"确认、收到、我来处理"等关键词 |
| `change_operation` | 变更操作 | 聊天记录中包含"发布、部署、回滚、重启、配置变更"等关键词 |
| `error_surge` | 错误激增 | 日志中短时间内出现大量错误 |
| `recovery_verify` | 恢复验证 | 聊天记录中包含"恢复、正常了、已恢复"等关键词 |
| `todo_item` | 复盘待办 | 聊天记录中包含"待办、TODO、需要、应该、建议"等关键词 |
| `unknown` | 未知 | 无法识别的事件类型 |

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 运行测试并生成覆盖率报告
pytest --cov=postmortem_puzzle
```

## 完整使用示例流程

```bash
# 1. 创建工作目录
mkdir -p ~/incident-reviews/2024-01-15-api-outage
cd ~/incident-reviews/2024-01-15-api-outage

# 2. 初始化项目
postmortem init \
  --name "2024-01-15 API网关故障" \
  --service api-gateway \
  --service order-service \
  --timezone Asia/Shanghai

# 3. 收集故障材料
# 从监控系统导出告警CSV
# 从值班群导出聊天记录
# 从服务器下载相关日志

# 4. 导入所有材料
postmortem import-alerts ~/Downloads/alerts_20240115.csv --service api-gateway
postmortem import-chat ~/Downloads/wechat_20240115.md
postmortem import-logs ~/Downloads/api-gateway.log ~/Downloads/nginx_error.log --service api-gateway

# 5. 归并时间线（预览）
postmortem reconcile --dry-run

# 6. 正式归并
postmortem reconcile

# 7. 查看是否有隔离事件
cat .postmortem/data/quarantine.json

# 8. 导出报告
postmortem report --output-dir ./reports --name "2024-01-15-postmortem"

# 9. 查看报告
open ./reports/2024-01-15-postmortem.md

# 10. 稍后查看历史记录
postmortem history --service api-gateway --limit 5
```

## 许可证

MIT License
