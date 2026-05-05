# Magic Method Analyzer

Python 魔术方法调用顺序分析工具 - 帮助团队理解和复盘魔术方法的调用机制。

## 功能特性

- **多源数据解析**: 支持 `magic-cases.yaml`、`events.jsonl` 和 `snippets/*.py`
- **深度分析**: 检测以下魔术方法相关问题：
  - `__getattribute__` / `__getattr__` 调用顺序和异常覆盖
  - `__setattr__` 无限递归风险
  - `__call__` 调用问题
  - `__len__` / `__bool__` 真值判断误用
  - `__eq__` / `__hash__` 哈希失效
  - 上下文管理器 (`__enter__` / `__exit__`) 资源清理遗漏
- **SQLite 存储**: 分析结果持久化存储，支持历史查询
- **多格式报告**: 导出 Markdown 和 JSON 格式报告
- **会话比较**: 支持两个分析会话的对比分析
- **格式验证**: 提供输入文件格式验证和错误提示

## 安装

### 开发模式安装

```bash
pip install -e .
```

### 安装开发依赖（可选）

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 使用示例数据

项目提供了完整的示例数据，位于 `examples/` 目录：

```
examples/
├── magic-cases.yaml      # 魔术方法测试用例
├── events.jsonl          # 方法调用事件日志
└── snippets/
    ├── attribute_access.py
    ├── callable.py
    ├── context_manager.py
    ├── equality_hash.py
    └── truth_value.py
```

### 2. 执行分析

```bash
# 使用示例数据执行分析
mmanalyzer analyze \
    --yaml examples/magic-cases.yaml \
    --jsonl examples/events.jsonl \
    --snippets examples/snippets \
    --output report_$(date +%Y%m%d) \
    --format both
```

### 3. 查看分析结果

分析完成后，会生成：
- `report_*.md` - Markdown 格式报告
- `report_*.json` - JSON 格式报告
- `magic_analysis.db` - SQLite 数据库（可通过环境变量 `MMA_DB_PATH` 指定路径）

## 命令详解

### analyze - 执行分析

```bash
mmanalyzer analyze [OPTIONS]

选项:
  --yaml, -y PATH       magic-cases.yaml 文件路径
  --jsonl, -j PATH      events.jsonl 文件路径
  --snippets, -s PATH   snippets 目录路径
  --session-id, -i TEXT 自定义会话 ID
  --no-save             不保存到数据库
  --output, -o PATH     导出报告路径
  --format, -f          报告格式: markdown / json / both [默认: markdown]
```

**示例:**

```bash
# 分析单个 JSONL 文件
mmanalyzer analyze --jsonl events.jsonl

# 分析所有数据源并导出报告
mmanalyzer analyze \
    -y magic-cases.yaml \
    -j events.jsonl \
    -s snippets/ \
    -o my_report \
    -f both
```

### export - 导出报告

```bash
mmanalyzer export [OPTIONS] [SESSION_ID]

选项:
  --output, -o PATH     导出路径
  --format, -f          报告格式: markdown / json / both [默认: markdown]
  --list, -l            列出所有会话
  --stats, -s           显示数据库统计
```

**示例:**

```bash
# 列出所有会话
mmanalyzer export --list

# 显示数据库统计
mmanalyzer export --stats

# 导出指定会话
mmanalyzer export session_20260505_100000_abc12345 -o output_report
```

### compare - 比较会话

```bash
mmanalyzer compare [OPTIONS] SESSION_ID_1 SESSION_ID_2

选项:
  --output, -o PATH     导出比较报告路径
```

**示例:**

```bash
# 比较两个会话
mmanalyzer compare session_20260505_100000_abc12345 session_20260505_110000_def67890 -o comparison_report
```

### validate - 验证文件格式

```bash
mmanalyzer validate [OPTIONS]

选项:
  --yaml, -y PATH       验证 YAML 文件格式
  --jsonl, -j PATH      验证 JSONL 文件格式
  --snippet, -s PATH    验证 Python 代码语法
```

**示例:**

```bash
# 验证 YAML 文件
mmanalyzer validate --yaml magic-cases.yaml

# 验证 JSONL 文件
mmanalyzer validate --jsonl events.jsonl

# 验证 Python 代码
mmanalyzer validate --snippet snippets/test.py
```

## 输入文件格式

### magic-cases.yaml

定义魔术方法测试用例：

```yaml
cases:
  - id: case_001
    name: 属性访问顺序测试
    category: attribute_access
    description: 测试 __getattribute__ 和 __getattr__ 的调用顺序
    expected_behavior:
      - 先调用 __getattribute__
      - 如果 __getattribute__ 抛出 AttributeError，则调用 __getattr__
    code_snippet: |
      class MyClass:
          def __getattribute__(self, name):
              # 实现...
          def __getattr__(self, name):
              # 实现...
    metadata:
      tags: ["__getattribute__", "__getattr__"]
      difficulty: medium
```

### events.jsonl

每行一个 JSON 对象，记录方法调用事件：

```json
{"method": "__getattribute__", "timestamp": "2026-05-05T10:00:00.001", "caller": "<module>", "target": "MyObj@0x1", "args": ["name"], "kwargs": {}, "result": "Alice"}
{"method": "__getattr__", "timestamp": "2026-05-05T10:00:00.002", "caller": "<module>", "target": "MyObj@0x1", "args": ["missing"], "kwargs": {}, "result": "default", "exception": "AttributeError"}
```

**字段说明:**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `method` | string | 是 | 魔术方法名，如 `__getattribute__` |
| `timestamp` | string | 否 | ISO 格式时间戳 |
| `caller` | string | 否 | 调用者标识 |
| `target` | string | 否 | 目标对象标识 |
| `args` | array | 否 | 位置参数 |
| `kwargs` | object | 否 | 关键字参数 |
| `result` | any | 否 | 返回值 |
| `exception` | string/object | 否 | 异常信息 |

## 检测的问题类型

### 1. 异常覆盖 (Exception Override)

- **场景**: `__getattribute__` 抛出异常后调用 `__getattr__`
- **场景**: `__exit__` 返回 True 抑制异常
- **严重程度**: 警告/严重

### 2. 哈希失效 (Hash Invalidation)

- **场景**: 定义了 `__eq__` 但没有定义 `__hash__`
- **场景**: `__hash__` 返回 None
- **严重程度**: 严重/警告/提示

### 3. 真值判断误用 (Truth Value Misuse)

- **场景**: `__len__` 返回负值
- **场景**: 有 `__bool__` 但调用了 `__len__` 进行真值判断
- **严重程度**: 严重/提示

### 4. 上下文清理遗漏 (Context Cleanup Missing)

- **场景**: `__enter__` 被调用但 `__exit__` 未被调用
- **场景**: `__exit__` 处理异常时又抛出新异常
- **严重程度**: 严重/警告

### 5. 属性访问问题 (Attribute Access Issue)

- **场景**: `__setattr__` 可能存在无限递归
- **严重程度**: 严重

## 数据库结构

### analysis_sessions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| session_id | TEXT | 会话唯一标识 |
| start_time | TEXT | 开始时间 |
| end_time | TEXT | 结束时间 |
| source_files | TEXT | 源文件列表（JSON） |
| method_calls_count | INTEGER | 方法调用数 |
| issues_count | INTEGER | 问题数 |
| metadata | TEXT | 元数据（JSON） |

### method_calls 表

存储所有方法调用记录，外键关联 session_id。

### issues 表

存储所有检测到的问题，外键关联 session_id。

## 开发

### 运行测试

```bash
pytest
```

### 代码格式检查

```bash
black --check .
```

### 类型检查

```bash
mypy magic_method_analyzer/
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MMA_DB_PATH` | SQLite 数据库路径 | `./magic_analysis.db` |

## 常见问题

### Q: 如何生成 events.jsonl？

你可以通过以下方式生成：

1. 使用装饰器或元类记录魔术方法调用
2. 使用 `sys.settrace` 进行跟踪
3. 手动编写用于测试的事件日志

### Q: 为什么要同时定义 `__eq__` 和 `__hash__`？

Python 的规则是：如果两个对象相等（`__eq__` 返回 True），它们的哈希值必须相同。如果只定义 `__eq__` 不定义 `__hash__`，`__hash__` 会被自动设为 `None`，对象将不可哈希，无法用于集合或字典键。

### Q: `__exit__` 应该返回什么？

- 返回 `False` 或 `None`：让异常继续传播（推荐）
- 返回 `True`：抑制异常（谨慎使用，可能隐藏错误）

## 许可证

本项目仅供学习和团队内部使用。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。
