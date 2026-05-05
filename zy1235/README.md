# Decorator Analyzer

一个专门用于复盘 Python 装饰器调用链的命令行工具。帮助你理解装饰器到底把函数调用链改成了什么，检测潜在风险，并生成详细报告。

## 功能特性

- 📖 **多源解析**: 支持解析 `decorators.yaml`、`events.jsonl` 和 `snippets/*.py`
- 🔍 **深度分析**: 解析无参/带参装饰器、`functools.wraps`、装饰器叠加顺序、类装饰器、descriptor/bound method、async 装饰器
- ⚠️ **风险检测**: 检测异常吞掉、元数据丢失、签名变更、异步不匹配等风险
- 💾 **持久化存储**: 每次分析结果自动写入 SQLite 数据库
- 📊 **丰富报告**: 输出调用时间线、签名/metadata 保真检查、风险定位、改写建议
- 📄 **多格式导出**: 支持 Markdown 和 JSON 格式报告
- 🔄 **对比分析**: 支持多个分析会话的对比

## 安装

```bash
# 使用 pip 安装（开发模式）
pip install -e .

# 或者使用 hatch
hatch shell
```

## 快速开始

### 1. 初始化项目

```bash
# 初始化空项目
decorator-analyzer init

# 或者使用样例数据初始化（推荐用于学习）
decorator-analyzer init --seed
```

初始化后会创建以下结构：
```
your-project/
├── decorators.yaml      # 装饰器定义配置
├── events.jsonl         # 调用事件日志
├── snippets/            # Python 代码片段目录
│   ├── 01_simple_decorator.py
│   ├── 02_decorator_with_wraps.py
│   └── ...
└── .decorator_analyzer/ # 工具数据目录
    └── analysis.db      # SQLite 数据库
```

### 2. 运行分析

```bash
# 分析当前目录
decorator-analyzer analyze

# 带描述的分析
decorator-analyzer analyze -d "第一次分析"

# 严格模式（所有警告视为高风险）
decorator-analyzer analyze --strict

# 指定项目目录
decorator-analyzer -p /path/to/project analyze
```

### 3. 查看历史会话

```bash
# 列出最近 10 个会话
decorator-analyzer list

# 列出最近 5 个会话
decorator-analyzer list -n 5
```

### 4. 导出报告

```bash
# 导出最新会话的 Markdown 报告
decorator-analyzer export

# 导出指定会话的 JSON 报告
decorator-analyzer export -s <session-id> -f json

# 导出到指定路径
decorator-analyzer export -o report.md
```

### 5. 对比分析

```bash
# 对比两个会话
decorator-analyzer compare <session-id-1> <session-id-2>

# 带标签的对比
decorator-analyzer compare <id1> <id2> -l "修复前" -l "修复后"

# 导出 JSON 格式的对比报告
decorator-analyzer compare <id1> <id2> -f json -o comparison.json
```

### 6. 查看项目信息

```bash
decorator-analyzer info
```

## 支持的装饰器类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `simple` | 无参装饰器 | `@timer` |
| `with_args` | 带参装饰器 | `@retry(max_attempts=3)` |
| `functools_wraps` | 使用 `functools.wraps` | `@functools.wraps(func)` |
| `class_decorator` | 类装饰器 | `@singleton` |
| `descriptor` | 描述符装饰器 | `@property`, `@staticmethod`, `@classmethod` |
| `async` | 异步装饰器 | `@async_timer` |
| `stacked` | 叠加装饰器 | 多个装饰器应用于同一函数 |

## 检测的风险类型

| 风险类型 | 说明 | 严重程度 |
|----------|------|----------|
| `exception_swallow` | 异常吞掉 | CRITICAL / HIGH |
| `metadata_loss` | 元数据丢失 | HIGH / MEDIUM |
| `signature_change` | 签名变更 | MEDIUM |
| `return_value_altered` | 返回值变更 | LOW |
| `order_dependency` | 顺序依赖 | MEDIUM |
| `async_mismatch` | 异步不匹配 | HIGH |
| `descriptor_binding` | 描述符绑定 | MEDIUM |

## 配置文件说明

### decorators.yaml

用于手动定义被装饰的函数及其装饰器：

```yaml
functions:
  - name: process_data
    module: data_processor
    signature: (data: list[dict], filter_key: str = "active") -> list[dict]
    docstring: 处理数据并应用过滤器
    is_async: false
    is_method: false
    decorators:
      - name: timer
        type: simple           # simple/with_args/functools_wraps/class_decorator/descriptor/async
        line_number: 15
        has_wraps: false       # 是否使用 functools.wraps
        parameters: {}         # 装饰器参数
        source_code: |         # 装饰器源代码（用于风险检测）
          def timer(func):
              def wrapper(*args, **kwargs):
                  return func(*args, **kwargs)
              return wrapper
```

### events.jsonl

用于记录函数调用事件，每行一个 JSON 对象：

```json
{"function_id": "process_data", "timestamp": "2024-01-15T10:30:00", "caller": "main", "args": [["active", "inactive"]], "kwargs": {"filter_key": "active"}, "return_value": ["filtered_data"], "exception": null, "decorator_stack": ["timer"], "duration_ms": 156.23}
```

字段说明：
- `function_id`: 函数标识
- `timestamp`: 调用时间戳
- `caller`: 调用者
- `args`: 位置参数
- `kwargs`: 关键字参数
- `return_value`: 返回值
- `exception`: 异常信息（如有）
- `decorator_stack`: 装饰器调用栈
- `duration_ms`: 执行耗时（毫秒）

### snippets/*.py

Python 代码片段目录。工具会自动解析这些文件中的装饰器：

```python
# snippets/my_decorators.py

import functools
import time

def timer(func):
    """计时装饰器 - 不使用 functools.wraps（会触发元数据丢失警告）"""
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"耗时: {end - start}")
        return result
    return wrapper

def timer_with_wraps(func):
    """计时装饰器 - 使用 functools.wraps（正确做法）"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"耗时: {end - start}")
        return result
    return wrapper

@timer
def slow_function(n: int) -> int:
    """一个较慢的函数"""
    time.sleep(0.1)
    return sum(range(n))

@timer_with_wraps
def fast_function(n: int) -> int:
    """一个较快的函数"""
    return sum(i * i for i in range(n))
```

## 样例代码说明

使用 `--seed` 初始化会创建 8 个样例文件：

| 文件 | 说明 | 演示内容 |
|------|------|----------|
| `01_simple_decorator.py` | 简单装饰器 | 无 `functools.wraps` 的元数据丢失风险 |
| `02_decorator_with_wraps.py` | 正确使用 wraps | 元数据保真的最佳实践 |
| `03_decorator_with_args.py` | 带参数的装饰器 | 装饰器工厂模式 |
| `04_stacked_decorators.py` | 叠加装饰器 | 多个装饰器的执行顺序 |
| `05_class_decorator.py` | 类装饰器 | 单例模式、类日志装饰 |
| `06_descriptor_methods.py` | 描述符和绑定方法 | `@property`、`@staticmethod`、`@classmethod`、自定义描述符 |
| `07_async_decorators.py` | 异步装饰器 | `async/await` 函数的装饰器 |
| `08_exception_swallow_risk.py` | 异常吞掉风险 | 危险的异常处理模式 vs 正确做法 |

## 报告示例

### Markdown 报告

```markdown
# 装饰器分析报告

- **分析ID**: abc123...
- **分析时间**: 2024-01-15 10:30:00

## 概览

| 指标 | 数值 |
|------|------|
| 被装饰函数 | 8 |
| 调用事件 | 4 |
| 风险数量 | 5 |

## 风险分析

### 🔴 CRITICAL (1 个)

#### 异常吞掉

- **位置**: silent_exception:15
- **描述**: 潜在异常吞掉检测...
- **建议**: Review exception handling...

## 被装饰函数详情

### `slow_function`

- **模块**: 01_simple_decorator
- **签名**: `(n: int) -> int`
- **异步**: 否
- **方法**: 否

#### 装饰器列表 (从内到外)

1. **`timer`**
   - 类型: simple
   - 行号: 12
   - 使用 wraps: 否
```

### JSON 报告

```json
{
  "analysis_id": "abc123...",
  "timestamp": "2024-01-15T10:30:00",
  "summary": {
    "total_functions": 8,
    "total_events": 4,
    "total_risks": 5,
    "risks_by_level": {
      "critical": 1,
      "high": 2,
      "medium": 1,
      "low": 1
    }
  },
  "decorated_functions": [...],
  "call_events": [...],
  "risks": [...]
}
```

## 命令参考

### 全局选项

```bash
-p, --project TEXT  # 项目目录 (默认: 当前目录)
-v, --version       # 显示版本号
--help              # 显示帮助
```

### init 命令

```bash
decorator-analyzer init [OPTIONS]

选项:
  --seed  # 使用样例数据初始化
```

### analyze 命令

```bash
decorator-analyzer analyze [OPTIONS]

选项:
  -d, --description TEXT  # 分析描述
  --strict                # 严格模式
  --no-sig-check          # 跳过签名保真检查
  --no-meta-check         # 跳过元数据保真检查
```

### list 命令

```bash
decorator-analyzer list [OPTIONS]

选项:
  -n, --limit INTEGER  # 显示的会话数量 (默认: 10)
```

### export 命令

```bash
decorator-analyzer export [OPTIONS]

选项:
  -s, --session TEXT      # 会话 ID (默认: 最新会话)
  -f, --format [markdown|json]  # 输出格式 (默认: markdown)
  -o, --output PATH       # 输出文件路径
```

### compare 命令

```bash
decorator-analyzer compare [OPTIONS] SESSION_IDS...

参数:
  SESSION_IDS...  # 至少两个会话 ID

选项:
  -l, --label TEXT        # 每个会话的标签
  -f, --format [markdown|json]  # 输出格式
  -o, --output PATH       # 输出文件路径
```

### info 命令

```bash
decorator-analyzer info
```

## 开发

### 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 运行测试并显示覆盖率
pytest --cov=decorator_analyzer
```

### 项目结构

```
decorator_analyzer/
├── __init__.py
├── cli.py                 # CLI 入口
├── models.py              # 数据模型
├── analyzer/              # 分析引擎
│   ├── __init__.py
│   └── decorator_analyzer.py
├── parser/                # 解析器
│   ├── __init__.py
│   ├── yaml_parser.py     # YAML 解析
│   ├── jsonl_parser.py    # JSONL 解析
│   └── py_parser.py       # Python 代码解析
├── storage/               # 存储层
│   ├── __init__.py
│   └── sqlite_storage.py  # SQLite 存储
├── exporter/              # 报告导出
│   ├── __init__.py
│   └── report_exporter.py # Markdown/JSON 导出
└── seed_data.py           # 样例数据生成

tests/                     # 测试目录
├── __init__.py
├── test_parser.py
├── test_analyzer.py
└── test_cli.py
```

## 常见问题

### Q: 为什么需要 `functools.wraps`？

A: 不使用 `functools.wraps` 会导致被装饰函数的元数据（`__name__`、`__doc__`、`__module__` 等）被替换为 wrapper 函数的元数据。这会影响：
- 调试（错误堆栈显示错误的函数名）
- 文档生成
- 反射操作
- 某些依赖函数元数据的框架

### Q: 装饰器的执行顺序是怎样的？

A: 装饰器的应用顺序是**从上到下**，但执行顺序是**从外到内**：

```python
@decorator_a  # 第三个执行
@decorator_b  # 第二个执行
@decorator_c  # 第一个执行
def func():
    pass
```

调用时：`decorator_a -> decorator_b -> decorator_c -> func -> decorator_c -> decorator_b -> decorator_a`

### Q: 什么是"异常吞掉"风险？

A: 异常吞掉指的是在装饰器中捕获了异常但没有重新抛出，导致错误被静默忽略。常见的危险模式：

```python
# 危险：捕获所有异常且不重新抛出
def bad_decorator(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:  # ❌ 捕获所有异常
            return None  # ❌ 静默返回
    return wrapper

# 较好：捕获特定异常并重新抛出
def good_decorator(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            logger.error(f"验证错误: {e}")
            raise  # ✅ 重新抛出
    return wrapper
```

## License

MIT
