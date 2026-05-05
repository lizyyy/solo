# Descriptor Inspector

一个专门用于分析 Python 描述符字段绑定问题的 CLI 工具。

## 功能特性

- **数据描述符 vs 非数据描述符优先级分析**：识别描述符类型并分析其在属性查找链中的优先级
- **实例 `__dict__` 覆盖检测**：检测非数据描述符是否可以被实例字典覆盖
- **`__get__`/`__set__`/`__delete__` 调用分析**：分析描述符方法的调用情况
- **`__set_name__` 字段注册**：检测是否使用了 `__set_name__` 进行自动字段名称注册
- **`property` vs `cached_property` 差异**：分析这两种常用描述符的行为差异
- **字段校验失败检测**：识别代码中的校验错误和异常处理
- **SQLite 持久化存储**：所有分析结果存储在 SQLite 数据库中
- **Markdown/JSON 报告导出**：支持导出结构化的分析报告

## 安装

```bash
pip install -e .
```

或者使用开发模式安装：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化项目

```bash
descriptor-inspector init
```

这将创建以下目录结构：
```
.
├── data/
│   ├── descriptor-cases.yaml    # 描述符测试案例配置
│   ├── events.jsonl             # 事件日志（JSON Lines 格式）
│   └── snippets/                # Python 代码片段
│       ├── data_descriptor.py
│       └── cached_property_example.py
└── descriptor_inspector.db      # SQLite 数据库（运行时创建）
```

使用 `--force` 选项覆盖现有文件：
```bash
descriptor-inspector init --force
```

### 2. 分析描述符案例

```bash
descriptor-inspector analyze
```

使用 `--verbose` 查看详细输出：
```bash
descriptor-inspector analyze -v
```

只分析特定案例：
```bash
descriptor-inspector analyze --case-id data_descriptor_01
```

### 3. 比较两个描述符案例

```bash
descriptor-inspector compare data_descriptor_01 non_data_descriptor_01
```

保存比较结果到数据库：
```bash
descriptor-inspector compare data_descriptor_01 non_data_descriptor_01 --save
```

### 4. 导出报告

导出 Markdown 和 JSON 格式的报告：
```bash
descriptor-inspector export
```

只导出特定格式：
```bash
descriptor-inspector export -f markdown
descriptor-inspector export -f json
```

指定输出目录：
```bash
descriptor-inspector export -o ./my-reports
```

只包含特定案例：
```bash
descriptor-inspector export --case-id data_descriptor_01 --case-id property_01
```

### 5. 查看详细信息

查看数据库统计和所有可用案例：
```bash
descriptor-inspector show
```

查看特定案例的详细信息：
```bash
descriptor-inspector show --case-id data_descriptor_01
```

查看特定分析结果：
```bash
descriptor-inspector show --analysis-id 1
```

查看特定比较结果：
```bash
descriptor-inspector show --comparison-id 1
```

## 数据文件格式

### descriptor-cases.yaml

描述符测试案例的 YAML 配置文件格式：

```yaml
cases:
  - id: case_01
    name: 案例名称
    description: 案例描述
    descriptor_type: data_descriptor  # 可选: data_descriptor, non_data_descriptor, property, cached_property, not_a_descriptor
    tags:
      - tag1
      - tag2
    code_snippet: |
      class MyDescriptor:
          def __get__(self, instance, owner):
              return instance._value
          
          def __set__(self, instance, value):
              instance._value = value
      
      class MyClass:
          value = MyDescriptor()
    expected_behavior:
      priority: data_descriptor_priority
      __get__called: true
```

### events.jsonl

事件日志文件，每行一个 JSON 对象：

```json
{"id": 1, "timestamp": "2026-05-05T10:00:00", "event_type": "__get__", "descriptor_name": "DataDescriptor", "instance_type": "MyClass", "owner_class": "MyClass", "value": 42, "context": {"line": 20}}
{"id": 2, "timestamp": "2026-05-05T10:00:01", "event_type": "__set__", "descriptor_name": "DataDescriptor", "instance_type": "MyClass", "owner_class": "MyClass", "value": 42, "context": {"line": 19}}
```

支持的事件类型：
- `__get__` - 描述符的 `__get__` 方法被调用
- `__set__` - 描述符的 `__set__` 方法被调用
- `__delete__` - 描述符的 `__delete__` 方法被调用
- `__set_name__` - 描述符的 `__set_name__` 方法被调用
- `instance_dict_access` - 访问了实例的 `__dict__`
- `validation_error` - 发生了校验错误
- `attribute_error` - 发生了属性错误

## 描述符类型

| 类型 | 说明 | 优先级 |
|------|------|--------|
| `data_descriptor` | 实现了 `__get__` 和 `__set__`/`__delete__` | 高于实例 `__dict__` |
| `non_data_descriptor` | 只实现了 `__get__` | 低于实例 `__dict__` |
| `property` | 使用 `@property` 装饰器 | 数据描述符优先级 |
| `cached_property` | 使用 `functools.cached_property` | 非数据描述符优先级 |

## 关键概念

### 数据描述符 vs 非数据描述符

**数据描述符**（同时定义了 `__get__` 和 `__set__`）：
- 在属性查找中具有最高优先级
- 即使实例 `__dict__` 中有同名属性，也会调用描述符的 `__get__`
- 典型例子：`property`

**非数据描述符**（只定义了 `__get__`）：
- 优先级低于实例 `__dict__`
- 如果实例 `__dict__` 中有同名属性，会绕过描述符的 `__get__`
- 典型例子：`cached_property`、函数

### property vs cached_property

| 特性 | property | cached_property |
|------|----------|-----------------|
| 描述符类型 | 数据描述符 | 非数据描述符 |
| 每次访问调用 `__get__` | 是 | 仅首次 |
| 结果缓存 | 否 | 是（存储在实例 `__dict__`） |
| 可被实例 `__dict__` 覆盖 | 否 | 是 |
| 适用场景 | 计算属性、校验 | 昂贵计算结果缓存 |

### `__set_name__` 方法

Python 3.6+ 引入的描述符协议方法，在类创建时自动调用，用于让描述符知道自己被分配给了哪个字段名：

```python
class ValidatedDescriptor:
    def __set_name__(self, owner, name):
        self.name = name  # 自动获取字段名 "score"
    
    def __get__(self, instance, owner):
        return instance.__dict__.get(self.name, 0)

class MyClass:
    score = ValidatedDescriptor()  # __set_name__ 被调用，name = "score"
```

## 坏格式提示

工具会在以下情况提供详细的错误提示：

### YAML 解析错误
```
Validation Errors:
  File: descriptor-cases.yaml:1
  Type: YAMLError
  Message: while parsing a block collection
  Suggestion: Check YAML syntax and formatting.
```

### JSONL 解析错误
```
Validation Errors:
  File: events.jsonl:3
  Type: JSONDecodeError
  Message: Expecting value: line 1 column 1 (char 0)
  Suggestion: Ensure each line is valid JSON.
  Context: invalid json line
```

### 无效的描述符类型
```
Validation Errors:
  File: descriptor-cases.yaml:2
  Type: InvalidDescriptorType
  Message: Invalid descriptor type: invalid_type
  Suggestion: Use one of: data_descriptor, non_data_descriptor, property, cached_property, not_a_descriptor
```

### 语法错误
```
Validation Errors:
  File: test_case.py:2
  Type: SyntaxError
  Message: expected ':'
  Suggestion: Check for syntax errors in the code snippet.
  Context: class InvalidSyntax
```

## 数据库结构

### 表结构

- **descriptor_cases** - 描述符测试案例
- **events** - 事件日志
- **analysis_results** - 分析结果
- **comparison_results** - 比较结果
- **schema_version** - 数据库模式版本

### 索引

- `idx_events_case_id` - 按案例 ID 索引事件
- `idx_analysis_case_id` - 按案例 ID 索引分析结果
- `idx_comparison_cases` - 按案例对索引比较结果

## 运行测试

```bash
pytest
```

运行测试并生成覆盖率报告：
```bash
pytest --cov=descriptor_inspector
```

## 项目结构

```
descriptor-inspector/
├── descriptor_inspector/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型和枚举
│   ├── analyzer.py          # 描述符分析逻辑
│   ├── storage.py           # SQLite 存储层
│   ├── exporter.py          # 报告导出器
│   └── cli.py               # 命令行接口
├── tests/
│   ├── __init__.py
│   ├── test_models.py       # 模型测试
│   ├── test_analyzer.py     # 分析器测试
│   └── test_storage.py      # 存储层测试
├── pyproject.toml           # 项目配置
└── README.md               # 本文档
```

## 命令参考

```
descriptor-inspector [OPTIONS] COMMAND [ARGS]...

Options:
  --db PATH           Path to SQLite database file.
  --version           Show the version and exit.
  --help              Show this message and exit.

Commands:
  init      Initialize a new descriptor inspection project.
  analyze   Analyze descriptor cases and code snippets.
  compare   Compare two descriptor cases.
  export    Export analysis results to Markdown or JSON reports.
  show      Show detailed information about cases, analyses, or comparisons.
```

## License

MIT License
