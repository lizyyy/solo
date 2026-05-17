# 日志字段字典CLI (log-field-dict)

解决服务日志字段越加越多、同名字段在不同服务里含义不同的问题，告别人工维护的Excel表格。

## 功能特性

- ✅ **日志解析**: 支持JSON和key=value格式的日志自动识别
- ✅ **字段抽取**: 自动提取所有日志字段，支持嵌套字段
- ✅ **类型推断**: 智能识别字段类型（string/integer/float/boolean/timestamp/object/array）
- ✅ **冲突检测**: 自动发现同名但类型不一致的字段
- ✅ **多格式输出**:
  - 终端彩色摘要（方便快速查看）
  - 机器可读JSON（方便后续处理）
  - Markdown友好报告（直接发给同事）
  - 坏记录独立文件（保留原始位置和原因）

## 安装

```bash
# 安装依赖
pip install -e .

# 或使用
pip install click rich pyyaml jinja2
pip install -e .
```

安装完成后，就可以使用 `logdict` 命令了。

## 快速开始

```bash
# 1. 生成示例日志
logdict sample

# 2. 分析示例日志
logdict analyze sample.log
```

## 命令说明

### 1. analyze - 完整分析（最常用）

分析单个日志文件或整个目录，生成完整报告。

```bash
# 分析单个文件
logdict analyze sample.log

# 分析整个目录（所有.log和.txt文件）
logdict analyze ./logs/

# 指定固定服务名（当日志中不含服务名字段时）
logdict analyze user-service.log --service user-service

# 指定输出目录
logdict analyze sample.log --output ./report/

# 静默模式（只输出文件，不打印终端摘要）
logdict analyze sample.log --quiet

# 查看调试错误信息
logdict analyze sample.log --debug
```

### 2. fields - 快速列出所有字段

```bash
logdict fields sample.log
```

输出示例：
```
✓ level                                    类型: string          服务: user-service, order-service
✓ message                                  类型: string          服务: user-service
⚠ order_id                                 类型: integer, string 服务: order-service
✓ payment_id                               类型: string          服务: payment-service
```

### 3. conflicts - 仅查看冲突字段

```bash
logdict conflicts sample.log
```

输出示例：
```
发现 3 个冲突字段:

amount
  float        → order-service
  string       → order-service

order_id
  integer      → order-service
  string       → order-service

user_id
  integer      → user-service, order-service, payment-service
  string       → user-service, order-service
```

### 4. sample - 生成示例日志

```bash
logdict sample
```

## 支持的日志格式

### JSON格式（推荐）

```json
{"service": "user-service", "timestamp": "2024-01-15T10:30:00", "user_id": 12345, "level": "info"}
```

### Key=Value格式

```
service=user-service timestamp=2024-01-15T10:30:00 user_id=12345 level=info
```

## 服务名自动识别

工具会自动从以下位置提取服务名：

1. 日志字段: `service`, `service_name`, `app`, `app_name`, `module`
2. 日志前缀: `service-name | ...`
3. 方括号: `[service-name] ...`

如果日志中不含服务名，使用 `--service` 参数指定。

## 输出文件说明

运行 `analyze` 命令后，输出目录（默认为 `output/`）会生成以下文件：

```
output/
├── field_dictionary.json      # 机器可读的完整字典（JSON格式）
├── field_dictionary_report.md # 适合发给同事的友好报告（Markdown格式）
└── bad_records.json           # 解析失败的坏记录
```

### field_dictionary.json 结构

```json
{
  "metadata": {
    "generated_at": "2024-01-15T10:30:00",
    "total_records": 1000,
    "total_fields": 50,
    "services": ["user-service", "order-service"],
    "conflicting_fields_count": 3,
    "bad_records_count": 5
  },
  "conflicting_fields": ["user_id", "order_id", "amount"],
  "fields": {
    "user_id": {
      "has_conflict": true,
      "services": ["user-service", "order-service"],
      "type_summary": {
        "integer": ["user-service", "order-service"],
        "string": ["user-service"]
      },
      "samples": {
        "user-service": {
          "type": "integer",
          "sample_value": "12345",
          "first_seen_line": 1
        }
      }
    }
  }
}
```

### bad_records.json 结构

```json
[
  {
    "line_number": 7,
    "service_name": null,
    "error_message": "Unrecognized log format (not JSON or key=value)",
    "raw_content": "这是一条坏日志，无法解析"
  }
]
```

## 使用场景示例

### 场景1: 排查事故时快速确认字段含义

```bash
# 拉取各服务的最新日志
kubectl logs user-service > user.log
kubectl logs order-service > order.log

# 合并分析
cat *.log > combined.log
logdict analyze combined.log

# 只看冲突
logdict conflicts combined.log
```

### 场景2: 定期生成字段字典发给团队

```bash
# 在CI中定期执行
logdict analyze /var/logs/ --output ./field-dict/

# 把 field_dictionary_report.md 发群里
```

### 场景3: 新服务接入时检查字段规范

```bash
# 新服务的日志
logdict analyze new-service.log

# 查看新服务的字段是否与现有字段冲突
```

## 字段类型说明

| 类型 | 说明 |
|------|------|
| string | 字符串 |
| integer | 整数 |
| float | 浮点数 |
| boolean | 布尔值 (true/false) |
| null | 空值 |
| timestamp | 时间戳（自动识别常见格式） |
| object | 嵌套对象 |
| array | 数组 |
| unknown | 无法识别 |

## 常见问题

### Q: 为什么有些日志解析失败？

A: 查看 `bad_records.json` 文件，里面有具体的错误原因和原始内容。目前只支持标准JSON和key=value格式，如果你的日志格式特殊，可以提Issue。

### Q: 嵌套字段怎么处理？

A: 嵌套字段会自动展开，用 `.` 连接，例如 `{"user": {"id": 123}}` 会变成 `user.id`。

### Q: 日志很大怎么办？

A: 工具是流式处理的，不会一次性加载整个文件到内存，可以处理大日志。

### Q: 遇到报错只显示"错误: xxx"怎么办？

A: 加上 `--debug` 参数查看完整堆栈信息。

## 项目结构

```
src/log_field_dict/
├── __init__.py       # 版本信息
├── models.py         # 数据模型
├── log_parser.py     # 日志解析器
├── type_inferencer.py # 类型推断
├── analyzer.py       # 核心分析逻辑
├── reporter.py       # 报告生成
└── cli.py            # CLI入口
```

## License

MIT
