# 前端埋点日志回放检查工具

一个用于验证前端埋点日志是否符合预设规则的本地检查工具，无需连接真实埋点平台，直接在本机运行即可完成埋点逻辑的完整性检查。

## 功能特性

- **多格式日志支持**：支持 JSONL 和 CSV 格式的埋点日志解析
- **灵活的规则引擎**：支持多种规则类型（时间窗口、顺序、重复、存在规则）
- **Session 级回放**：按 session 分组并按时序回放事件，模拟真实用户行为
- **详细的报告输出**：生成 HTML、Markdown、JSON 三种格式的验证报告
- **完整的错误定位**：显示具体 session、缺失事件、重复事件及原始行号
- **CI 友好**：可输出 JSON 格式结果用于自动化检查

## 安装

### 环境要求
- Python 3.8+
- pip 包管理工具

### 安装步骤

1. 克隆或下载项目代码
2. 安装依赖包：

```bash
pip install -r requirements.txt
```

3. 安装工具（可选，用于全局使用）：

```bash
pip install -e .
```

安装后可以使用 `tracker-verifier` 命令直接调用。

## 快速开始

### 使用示例文件测试

项目提供了示例日志和规则文件，你可以直接运行测试：

```bash
# 使用示例日志和规则进行验证
tracker-verifier verify \
  -l ./examples/logs \
  -r ./examples/rules/sample_rules.json \
  -o ./output \
  -v
```

或使用模块方式运行：

```bash
python -m tracker_verifier.cli verify \
  -l ./examples/logs \
  -r ./examples/rules/sample_rules.json \
  -o ./output \
  -v
```

### 查看生成的报告

验证完成后，在 `./output` 目录下会生成以下文件：
- `validation_report.html` - 可视化 HTML 报告（推荐）
- `validation_report.md` - Markdown 格式报告
- `validation_result.json` - 完整的 JSON 结果（供 CI/自动化读取）

直接用浏览器打开 HTML 报告即可查看详细的验证结果。

## 命令说明

### 主命令

```bash
tracker-verifier [OPTIONS] COMMAND [ARGS]...
```

### 子命令

#### 1. verify - 执行验证

核心命令，用于执行埋点日志验证。

**选项：**

| 选项 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--log-path` | `-l` | 是 | 日志文件路径或目录路径 |
| `--rules-path` | `-r` | 是 | 规则文件路径（JSON 格式） |
| `--output-dir` | `-o` | 否 | 报告输出目录，默认为 `./reports` |
| `--formats` | `-f` | 否 | 输出格式，用逗号分隔，支持 `json,html,md`，默认为全部 |
| `--fail-on-error` | 无 | 否 | 有规则失败时返回非零退出码（用于 CI） |
| `--verbose` | `-v` | 否 | 显示详细输出信息 |

**示例：**

```bash
# 基本用法
tracker-verifier verify -l ./logs -r ./rules.json

# 指定输出目录和格式
tracker-verifier verify -l ./logs -r ./rules.json -o ./output -f html,json

# 详细模式 + 失败时退出码
tracker-verifier verify -l ./logs -r ./rules.json -v --fail-on-error
```

#### 2. list_rules - 列出支持的规则类型

查看所有支持的规则类型及其说明。

```bash
# 查看所有规则类型
tracker-verifier list_rules

# 查看特定规则类型的详细说明
tracker-verifier list_rules time_window
```

#### 3. init_examples - 初始化示例目录结构

创建示例目录结构（日志目录和规则目录）。

```bash
tracker-verifier init_examples -o ./my-examples
```

## 日志格式说明

### 必需字段

每条埋点日志必须包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `session_id` | string | 会话唯一标识 |
| `user_id` | string | 用户唯一标识 |
| `event` | string | 事件名称 |
| `timestamp` | string/number | 时间戳（支持多种格式） |
| `page` | string | 页面标识 |
| `props` | object/string | 事件属性（JSON 对象或 JSON 字符串） |

### 时间戳格式

支持以下时间戳格式：
- Unix 时间戳（秒）：如 `1705305600`
- Unix 时间戳（毫秒）：如 `1705305600000`
- ISO 格式字符串：如 `"2024-01-15T10:00:00"`
- 标准格式字符串：如 `"2024-01-15 10:00:00"`

### JSONL 格式示例

```json
{"session_id": "sess_001", "user_id": "user_1001", "event": "page_view", "timestamp": "2024-01-15 10:00:00", "page": "home", "props": {"referrer": "search"}}
{"session_id": "sess_001", "user_id": "user_1001", "event": "click_buy", "timestamp": 1705305750, "page": "detail", "props": {"product_id": "p_1001"}}
```

### CSV 格式示例

```csv
session_id,user_id,event,timestamp,page,props
sess_001,user_1001,page_view,2024-01-15 10:00:00,home,"{""referrer"": ""search""}"
sess_001,user_1001,click_buy,2024-01-15 10:02:30,detail,"{""product_id"": ""p_1001""}"
```

**注意：** CSV 中的 `props` 字段需要使用转义的 JSON 字符串。

## 规则类型说明

### 1. time_window（时间窗口规则）

检查在某个事件发生后的指定时间窗口内，是否应该（或不应该）出现另一个事件。

**适用场景：**
- 打开详情页后一定时间内应该有购买行为
- 点击按钮后不应该快速重复点击

**配置字段：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `"time_window"` |
| `rule_id` | string | 是 | 规则唯一标识 |
| `name` | string | 是 | 规则名称 |
| `trigger_event` | string | 是 | 触发事件名称 |
| `target_events` | array | 是 | 目标事件名称列表 |
| `window_seconds` | number | 否 | 时间窗口（秒），默认 300 |
| `must_have` | boolean | 否 | `true`=必须有，`false`=不能有，默认 `true` |

**示例：**

```json
{
  "rule_id": "R001",
  "name": "打开详情页后5分钟内应有购买行为",
  "type": "time_window",
  "trigger_event": "page_view",
  "target_events": ["click_buy", "add_to_cart"],
  "window_seconds": 300,
  "must_have": true
}
```

### 2. sequence（顺序规则）

检查事件的发生顺序，确保事件 B 在事件 A 之后发生。

**适用场景：**
- 支付成功前必须提交订单
- 进入详情页前必须点击商品列表

**配置字段：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `"sequence"` |
| `rule_id` | string | 是 | 规则唯一标识 |
| `name` | string | 是 | 规则名称 |
| `before_event` | string | 是 | 必须先发生的事件 |
| `after_event` | string | 是 | 后发生的事件 |
| `strict` | boolean | 否 | 是否严格相邻，默认 `false` |

**示例：**

```json
{
  "rule_id": "R002",
  "name": "支付成功前必须提交订单",
  "type": "sequence",
  "before_event": "submit_order",
  "after_event": "payment_success",
  "strict": false
}
```

### 3. duplicate（重复规则）

检查同一个 Session 中是否重复上报了过多相同的事件。

**适用场景：**
- 曝光事件不能连续重复上报超过 N 次
- 防止埋点代码误触发导致的重复上报

**配置字段：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `"duplicate"` |
| `rule_id` | string | 是 | 规则唯一标识 |
| `name` | string | 是 | 规则名称 |
| `target_event` | string | 是 | 要检查的事件名称 |
| `max_count` | number | 否 | 最大允许次数，默认 3 |
| `consecutive` | boolean | 否 | 是否连续重复，默认 `true` |
| `include_page` | boolean | 否 | 是否按页面区分，默认 `false` |

**示例：**

```json
{
  "rule_id": "R003",
  "name": "曝光事件不能连续重复超过3次",
  "type": "duplicate",
  "target_event": "product_impression",
  "max_count": 3,
  "consecutive": true
}
```

### 4. presence（存在规则）

检查某个事件是否必须存在或必须不存在。

**适用场景：**
- 每个 Session 必须有页面浏览事件
- 测试环境不应出现生产环境的埋点事件

**配置字段：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `"presence"` |
| `rule_id` | string | 是 | 规则唯一标识 |
| `name` | string | 是 | 规则名称 |
| `target_event` | string | 是 | 目标事件名称 |
| `must_exist` | boolean | 否 | `true`=必须存在，`false`=必须不存在，默认 `true` |
| `min_count` | number | 否 | 最小出现次数，默认 1（仅当 must_exist=true 时有效） |
| `max_count` | number | 否 | 最大出现次数（可选） |

**示例：**

```json
{
  "rule_id": "R004",
  "name": "每个session必须有page_view",
  "type": "presence",
  "target_event": "page_view",
  "must_exist": true,
  "min_count": 1
}
```

## 规则文件完整示例

完整的规则文件是一个 JSON 数组，每个元素是一条规则配置：

```json
[
  {
    "rule_id": "R001",
    "name": "打开详情页后5分钟内应有购买行为",
    "type": "time_window",
    "description": "用户打开商品详情页之后，5分钟内应该有click_buy或add_to_cart行为",
    "trigger_event": "page_view",
    "target_events": ["click_buy", "add_to_cart"],
    "window_seconds": 300,
    "must_have": true
  },
  {
    "rule_id": "R002",
    "name": "支付成功前必须提交订单",
    "type": "sequence",
    "description": "支付成功事件之前必须有submit_order事件",
    "before_event": "submit_order",
    "after_event": "payment_success",
    "strict": false
  },
  {
    "rule_id": "R003",
    "name": "曝光事件不能连续重复超过3次",
    "type": "duplicate",
    "description": "同一个session中，product_impression事件不能连续重复上报超过3次",
    "target_event": "product_impression",
    "max_count": 3,
    "consecutive": true
  },
  {
    "rule_id": "R004",
    "name": "每个session必须有page_view",
    "type": "presence",
    "description": "每个有效的session都应该至少有一个page_view事件",
    "target_event": "page_view",
    "must_exist": true,
    "min_count": 1
  }
]
```

## 报告说明

### HTML 报告

HTML 报告提供了最友好的可视化界面，包含：

1. **整体概览**
   - 规则验证统计（总数、通过数、失败数、通过率）
   - Session 统计（总数、通过数、失败数、通过率）
   - 解析错误列表

2. **失败规则排行**
   - 按失败次数排序的规则列表
   - 快速定位最常失败的问题

3. **问题 Session 明细**
   - 每个失败 Session 的详细信息
   - 失败规则的具体描述
   - 相关事件的原始行号和时间戳

4. **日志统计信息**
   - 事件类型分布
   - 平均 Session 时长
   - 独立用户数等

### Markdown 报告

Markdown 报告适合在文档或代码仓库中查看，结构与 HTML 报告类似。

### JSON 结果

JSON 结果包含完整的验证数据，适合 CI/CD 自动化读取和处理。结构如下：

```json
{
  "summary": {
    "generated_at": "2024-01-15T10:00:00",
    "total_rules": 10,
    "passed_rules": 8,
    "failed_rules": 2,
    "pass_rate": 80.0,
    "total_sessions": 5,
    "passed_sessions": 3,
    "failed_sessions_count": 2,
    "session_pass_rate": 60.0,
    "parse_errors_count": 0,
    "failed_rules_ranking": [...]
  },
  "statistics": {...},
  "parse_errors": [],
  "failed_sessions_details": [...],
  "all_results": {...}
}
```

## 项目结构

```
tracker-verifier/
├── tracker_verifier/          # 主包目录
│   ├── __init__.py           # 包初始化
│   ├── cli.py                # 命令行入口
│   ├── log_parser.py         # 日志解析模块
│   ├── rule_engine.py        # 规则引擎模块
│   ├── session_manager.py    # Session管理模块
│   └── reporter.py           # 报告生成模块
├── examples/                  # 示例文件
│   ├── logs/
│   │   ├── sample_logs.jsonl
│   │   └── sample_logs.csv
│   └── rules/
│       └── sample_rules.json
├── setup.py                  # 安装配置
├── requirements.txt          # 依赖列表
└── README.md                 # 本文档
```

## 常见问题

### Q1: 为什么解析失败？

可能的原因：
- 缺少必需字段（session_id, user_id, event, timestamp, page, props）
- 时间戳格式不支持
- JSON 格式错误（JSONL 格式）
- CSV 格式错误（引号未转义等）

查看报告中的"解析错误"部分获取详细信息。

### Q2: 规则不生效？

检查规则配置：
- 规则类型是否正确（type 字段）
- 事件名称是否与日志中的完全一致
- 时间窗口单位是否正确（秒）
- 布尔值是否为小写（true/false）

### Q3: 如何在 CI 中使用？

使用 `--fail-on-error` 选项，当有规则失败时会返回非零退出码：

```bash
tracker-verifier verify \
  -l ./logs \
  -r ./rules.json \
  -o ./reports \
  -f json \
  --fail-on-error
```

然后在 CI 脚本中检查退出码。

### Q4: 支持哪些日志格式？

目前支持：
- JSONL（每行一个 JSON 对象）
- CSV（第一行为表头）

计划支持：
- Parquet
- 自定义格式（通过插件）

## 扩展开发

### 添加新的规则类型

1. 在 `rule_engine.py` 中继承 `BaseRule` 类
2. 实现 `_get_rule_type()` 和 `validate_session()` 方法
3. 在 `RuleEngine.RULE_CLASSES` 中注册新规则类型

### 自定义报告格式

在 `reporter.py` 中添加新的生成方法，遵循现有的 `generate_xxx_report` 模式。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
