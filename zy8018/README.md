# MCP 工具调用录制与重放调试器

一个用于分析 MCP (Model Context Protocol) 工具调用轨迹、检测 Schema 漂移、分析风险并生成重放计划的调试工具。

## 功能特性

- **时间线重建**: 解析调用轨迹，重建执行时间线，识别并行执行批次
- **Schema 漂移检测**: 对比录制时的参数与当前 Schema，检测类型变化、字段增减、枚举值变更等
- **风险分析**: 识别重试模式、非幂等操作风险、时间戳异常等
- **报告生成**: 输出 Markdown 或 JSON 格式的分析报告
- **重放计划**: 生成 dry-run 重放计划，支持自定义配置
- **最小复现包**: 自动提取问题相关事件，生成最小复现包

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 分析调用轨迹

使用 `analyze` 命令分析工具调用轨迹：

```bash
mcp-replay analyze \
  --schema examples/tools_schema.json \
  --trace examples/trace.jsonl \
  --output report.md \
  --verbose
```

参数说明：
- `--schema, -s`: 工具 Schema 文件 (JSON 或 YAML)
- `--trace, -t`: 调用轨迹文件 (JSONL 格式)
- `--config, -c`: 回放配置文件 (可选)
- `--output, -o`: 输出报告文件路径
- `--format, -f`: 输出格式 (markdown, json, console)
- `--verbose, -v`: 详细输出

### 2. 检测 Schema 漂移

使用已漂移的 Schema 进行对比：

```bash
mcp-replay analyze \
  --schema examples/schema_drifted.json \
  --trace examples/trace.jsonl \
  --format console \
  --verbose
```

这将检测以下类型的 Schema 漂移：
- 字段重命名 (如 `query` → `query_text`)
- 类型变更
- 必填字段变更
- 枚举值变更
- 约束条件变更 (如 min/max)

### 3. 生成重放计划

```bash
mcp-replay plan \
  --schema examples/tools_schema.json \
  --trace examples/trace.jsonl \
  --output plan.json \
  --include-retries \
  --no-respect-timing
```

参数说明：
- `--include-retries/--no-include-retries`: 是否包含重试事件
- `--respect-timing/--no-respect-timing`: 是否遵循原始时间间隔

### 4. 生成最小复现包

```bash
mcp-replay repro \
  --schema examples/tools_schema.json \
  --trace examples/trace.jsonl \
  --output ./repro-package \
  --mode minimal
```

模式选项：
- `minimal`: 仅包含问题相关事件（漂移、风险、错误、重试）
- `full`: 包含所有事件

## 输入数据格式

### 1. 工具 Schema (JSON/YAML)

```json
{
  "tools": [
    {
      "name": "search_code",
      "description": "搜索代码",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"},
          "language": {"type": "string", "enum": ["python", "go"]}
        },
        "required": ["query"]
      }
    }
  ]
}
```

### 2. 调用轨迹 (JSONL)

每行一个事件：

```json
{"tool_call_id": "call_001", "tool_name": "search_code", "arguments": {"query": "test"}, "timestamp": "2024-01-15T10:00:00.000Z", "event_type": "request"}
{"tool_call_id": "call_001", "tool_name": "search_code", "arguments": {"query": "test"}, "timestamp": "2024-01-15T10:00:00.150Z", "event_type": "response", "response": {"results": []}}
```

字段说明：
- `tool_call_id`: 工具调用唯一标识
- `tool_name`: 工具名称
- `arguments`: 调用参数
- `timestamp`: 时间戳 (ISO 格式或 Unix 时间戳)
- `event_type`: 事件类型 (request, response, error)
- `response`: 响应数据 (可选)
- `error`: 错误信息 (可选)
- `duration_ms`: 耗时毫秒数 (可选)

### 3. 回放配置 (JSON)

```json
{
  "mode": "dry_run",
  "include_retries": true,
  "respect_timing": true,
  "field_mappings": [
    {"old_name": "query", "new_name": "query_text", "confidence": 0.9}
  ]
}
```

## 边界情况处理

### 同一 tool_call_id 重复

工具会自动检测：
- 同一 `tool_call_id` 的多次出现会被标记为重试
- 如果不同工具使用相同 ID，会报告高风险

### Schema 字段改名

支持两种检测方式：
1. **显式映射**: 通过配置文件提供 `field_mappings`
2. **模糊匹配**: 自动计算字段名相似度 (>70% 视为可能重命名)

### 非幂等操作

基于以下规则识别非幂等工具：
- 工具名称包含关键字: `create`, `delete`, `update`, `write`, `send` 等
- 描述中包含相关关键字
- 用户可通过 Schema 描述显式声明

## 演示示例

运行以下命令查看完整演示：

```bash
# 1. 基本分析（控制台输出）
mcp-replay analyze --schema examples/tools_schema.json --trace examples/trace.jsonl

# 2. 生成 Markdown 报告
mcp-replay analyze --schema examples/tools_schema.json --trace examples/trace.jsonl --output report.md

# 3. 检测 Schema 漂移
mcp-replay analyze --schema examples/schema_drifted.json --trace examples/trace.jsonl --verbose

# 4. 生成重放计划
mcp-replay plan --schema examples/tools_schema.json --trace examples/trace.jsonl --output plan.json

# 5. 生成最小复现包
mcp-replay repro --schema examples/tools_schema.json --trace examples/trace.jsonl --output ./repro
```

## 项目结构

```
mcp_replay_debugger/
├── __init__.py
├── cli.py              # CLI 入口
├── core/               # 核心模块
│   ├── __init__.py
│   ├── schema_parser.py      # Schema 解析
│   ├── trace_parser.py       # 轨迹解析
│   ├── timeline_rebuilder.py # 时间线重建
│   ├── schema_drift.py       # 漂移检测
│   └── risk_analyzer.py      # 风险分析
├── reports/            # 报告生成
│   ├── __init__.py
│   ├── markdown_generator.py
│   └── json_generator.py
└── repro/              # 复现包生成
    ├── __init__.py
    └── repro_generator.py

examples/               # 示例数据
├── tools_schema.json
├── schema_drifted.json
├── trace.jsonl
└── config.json
```

## 测试

运行测试：

```bash
pip install -e ".[dev]"
pytest
```

## License

MIT
