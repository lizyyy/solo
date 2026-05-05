# Pitfall Analyzer - 迭代器坑点分析工具

一个帮助团队复盘 Python 迭代器和生成器常见坑点的命令行工具。

## 功能特性

- **静态代码分析**: 检测 `__iter__/__next__`、`yield/yield from`、`send/throw/close` 等实现问题
- **多文件支持**: 解析 `pipelines.yaml`、`events.jsonl` 和 `snippets/*.py`
- **SQLite 持久化**: 每次分析结果保存到数据库，支持历史追溯
- **对比功能**: 对比两次改造前后的分析结果
- **报告导出**: 支持 Markdown 和 JSON 格式报告
- **友好报错**: 对坏格式输入提供清晰的错误提示

## 安装

```bash
pip install -e .
```

依赖:
- Python 3.8+
- pyyaml >= 6.0

## 快速开始

### 1. 初始化示例项目

```bash
# 在当前目录创建示例数据
pitfall init

# 或指定目录
pitfall init -d ./my-project
```

这会创建以下文件结构:
```
./
├── pipelines.yaml    # 流水线配置（包含风险定义）
├── events.jsonl      # 事件日志（运行时问题记录）
└── snippets/         # 代码片段
    ├── bad_iterator_protocol.py    # 错误的迭代器协议实现
    ├── bad_stopiteration.py         # StopIteration 处理问题
    ├── bad_single_use.py            # 一次性迭代器重复消费
    ├── bad_tee.py                    # tee 缓存膨胀
    ├── bad_send.py                   # send/throw/close 使用问题
    ├── bad_lazy.py                   # 惰性求值陷阱
    ├── good_iterator_protocol.py     # 正确的迭代器协议
    ├── good_stopiteration.py         # 正确的 StopIteration 处理
    ├── good_single_use.py            # 正确处理一次性迭代器
    ├── good_tee.py                   # 正确使用 tee
    ├── good_send.py                  # 正确使用 send/throw/close
    └── good_lazy.py                  # 正确使用惰性求值
```

### 2. 执行分析

```bash
# 分析当前目录的所有文件
pitfall analyze

# 命名本次分析（便于后续对比）
pitfall analyze --name "v1.0-修复前"

# 自定义文件路径
pitfall analyze \
    --pipelines ./config/pipelines.yaml \
    --events ./logs/events.jsonl \
    --snippets ./code/
```

### 3. 导出报告

```bash
# 导出最新分析为 Markdown
pitfall export

# 导出指定分析 ID
pitfall export --analysis-id 1

# 导出为 JSON 格式
pitfall export --format json

# 导出到文件
pitfall export --format markdown --output ./report.md
```

### 4. 对比分析

```bash
# 对比两次分析（ID 1 和 ID 2）
pitfall compare 1 2

# 对比并导出 JSON
pitfall compare 1 2 --format json

# 对比并导出 Markdown
pitfall compare 1 2 --format markdown
```

## 检测的坑点类型

| 类型 | 严重程度 | 描述 |
|------|----------|------|
| `iterator_protocol` | 高 | `__iter__` 返回 `self` 导致一次性迭代器 |
| `stop_iteration` | 严重 | 生成器中手动抛出 `StopIteration` |
| `single_use` | 高 | 一次性迭代器被重复消费 |
| `tee_cache` | 中 | `itertools.tee` 可能导致内存膨胀 |
| `send_throw_close` | 中/严重 | `send()` 启动问题、`GeneratorExit` 处理 |
| `lazy_evaluation` | 低 | 生成器表达式的惰性求值陷阱 |
| `closure_capture` | 高 | 闭包变量捕获问题 |
| `yield_from` | 信息 | 使用 `yield from` 委托生成器 |

## 命令详解

### `pitfall init`

初始化示例数据目录。

```bash
pitfall init [OPTIONS]

Options:
  -f, --force           强制覆盖已存在的文件
  -d, --directory PATH  目标目录 (默认: 当前目录)
  -h, --help            显示帮助
```

**示例:**
```bash
# 安全初始化（不覆盖现有文件）
pitfall init

# 强制覆盖
pitfall init --force

# 指定目录
pitfall init -d ./demo
```

### `pitfall analyze`

分析项目中的迭代器坑点。

```bash
pitfall analyze [OPTIONS]

Options:
  -n, --name TEXT       本次分析的名称标签
  --pipelines PATH      pipelines.yaml 文件路径 (默认: pipelines.yaml)
  --events PATH         events.jsonl 文件路径 (默认: events.jsonl)
  --snippets PATH       snippets 目录路径 (默认: snippets)
  --db PATH             SQLite 数据库文件路径 (默认: .pitfall.db)
  --verbose             启用详细输出
  -h, --help            显示帮助
```

**示例:**
```bash
# 基础分析
pitfall analyze

# 带名称的分析
pitfall analyze --name "迭代器修复后"

# 详细模式
pitfall analyze --verbose
```

### `pitfall compare`

对比两次分析结果。

```bash
pitfall compare [OPTIONS] ANALYSIS_ID_1 ANALYSIS_ID_2

Options:
  --format [console|json|markdown]  输出格式 (默认: console)
  --db PATH                          SQLite 数据库文件路径
  -h, --help                         显示帮助
```

**示例:**
```bash
# 控制台输出
pitfall compare 1 2

# JSON 格式
pitfall compare 1 2 --format json

# Markdown 格式
pitfall compare 1 2 --format markdown
```

### `pitfall export`

导出分析报告。

```bash
pitfall export [OPTIONS]

Options:
  -a, --analysis-id INTEGER  指定分析 ID (默认: 最新分析)
  -f, --format [markdown|json]  导出格式 (默认: markdown)
  -o, --output PATH          输出文件路径 (默认: 标准输出)
  --db PATH                  SQLite 数据库文件路径
  -h, --help                 显示帮助
```

**示例:**
```bash
# 导出最新分析
pitfall export

# 导出指定分析
pitfall export --analysis-id 2

# 导出到文件
pitfall export --format markdown --output ./report.md
```

### `pitfall --help`

显示所有命令帮助。

```bash
pitfall --help
pitfall init --help
pitfall analyze --help
pitfall compare --help
pitfall export --help
```

## 文件格式说明

### pipelines.yaml

流水线配置文件，定义数据处理流程和潜在风险点。

```yaml
version: "1.0"
pipelines:
  - name: data_processing
    description: 数据处理流水线
    stages:
      - name: reader
        type: iterator
        class: FileReader
        description: 读取文件数据
    risks:
      - type: single_use_iterator
        stage: reader
        description: FileReader 是一次性迭代器，被多个 stage 消费
        severity: high  # critical, high, medium, low, info
```

### events.jsonl

事件日志文件，每行一个 JSON 对象，记录运行时问题。

```json
{"timestamp": "2026-05-05T10:00:00", "type": "iterator_exhausted", "level": "error", "message": "Iterator has been exhausted", "context": {"iterator_type": "FileReader"}}
{"timestamp": "2026-05-05T10:30:00", "type": "stopiteration_raised", "level": "warning", "message": "StopIteration raised inside generator", "context": {"generator_name": "transform_data"}}
```

### snippets/*.py

Python 代码片段文件，包含待分析的代码。

工具会自动检测代码中的:
- `__iter__` / `__next__` 实现
- `yield` / `yield from` 使用
- `send()` / `throw()` / `close()` 调用
- `itertools.tee` 使用
- 生成器表达式
- 闭包变量捕获模式

## 错误处理

工具对坏格式输入提供友好的错误提示:

| 错误场景 | 提示信息 |
|----------|----------|
| YAML 语法错误 | 显示文件路径、行号和具体问题 |
| JSON 解析错误 | 显示哪一行的 JSON 格式错误 |
| 文件不存在 | 提示文件路径，并建议运行 `pitfall init` |
| Python 语法错误 | 显示错误位置和原因 |
| 分析 ID 不存在 | 列出最近的分析记录供选择 |

## 工作流程示例

典型的团队复盘工作流程:

```bash
# 1. 初始化项目
cd ./my-project
pitfall init

# 2. 分析当前状态（修复前）
pitfall analyze --name "v1.0-修复前"
# 记录分析 ID（比如是 1）

# 3. 查看报告，了解问题
pitfall export --analysis-id 1 --output ./before.md

# 4. 修复代码中的问题
# 编辑 snippets/*.py 中的代码

# 5. 再次分析（修复后）
pitfall analyze --name "v1.1-修复后"
# 记录分析 ID（比如是 2）

# 6. 对比改进效果
pitfall compare 1 2

# 7. 导出对比报告
pitfall compare 1 2 --format markdown --output ./comparison.md
```

## 数据库结构

分析结果保存在 SQLite 数据库中（默认 `.pitfall.db`）:

| 表名 | 说明 |
|------|------|
| `analyses` | 分析记录（ID、名称、时间、摘要） |
| `code_snippets` | 分析的代码片段 |
| `findings` | 检测到的问题发现 |
| `pipelines` | 流水线配置 |
| `pipeline_risks` | 流水线定义的风险 |
| `events` | 事件日志记录 |

## 开发

### 安装开发依赖

```bash
pip install -e ".[dev]"
```

### 运行测试

```bash
pytest
```

## License

MIT
