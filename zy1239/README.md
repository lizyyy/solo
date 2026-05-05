# Metaclass Analyzer

一个用于分析和调试 Python 元类相关问题的本地 CLI 工具。

## 功能特性

- **类创建时间线分析**: 追踪 `__prepare__`、`metaclass` 选择、`__new__`/`__init__`、`__set_name__`、`__init_subclass__` 等事件
- **MRO 合并分析**: 分析方法解析顺序和菱形继承
- **元类冲突检测**: 检测多继承中的元类冲突并提供修复建议
- **字段注册顺序**: 分析类字段的定义和注册顺序
- **SQLite 存储**: 持久化分析结果到 SQLite 数据库
- **报告导出**: 支持导出 Markdown 和 JSON 格式的报告

## 安装

```bash
pip install -e .
```

或者使用开发依赖：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 使用样例数据

项目包含一套完整的样例数据，位于 `data/` 目录下：

```
data/
├── class-cases.yaml    # 类定义配置
├── events.jsonl        # 事件时间线数据
└── snippets/           # Python 代码片段
    ├── simple_class.py
    ├── custom_metaclass.py
    ├── inheritance.py
    ├── multi_inherit.py
    ├── init_subclass.py
    ├── descriptors.py
    └── ordered_meta.py
```

### 运行分析

```bash
cd data/
metaclass-analyzer analyze
```

或者指定文件路径：

```bash
metaclass-analyzer analyze \
  --yaml data/class-cases.yaml \
  --jsonl data/events.jsonl \
  --snippets data/snippets
```

## 命令用法

### analyze - 执行分析

```bash
metaclass-analyzer analyze [OPTIONS]
```

选项：
- `--yaml PATH`: YAML 配置文件路径 (默认: class-cases.yaml)
- `--jsonl PATH`: JSONL 事件文件路径 (默认: events.jsonl)
- `--snippets PATH`: Python 代码片段目录 (默认: snippets)
- `--no-db`: 跳过保存到数据库
- `--db PATH`: SQLite 数据库路径 (默认: metaclass_analysis.db)

### list - 列出历史运行

```bash
metaclass-analyzer list [OPTIONS]
```

选项：
- `--limit N`, `-n N`: 显示最近 N 条记录 (默认: 10)

### export - 导出报告

```bash
metaclass-analyzer export [OPTIONS] [RUN_ID]
```

选项：
- `--format {json,md,markdown,both}`, `-f`: 输出格式 (默认: md)
- `--output PATH`, `-o`: 输出文件路径 (不含扩展名)

示例：
```bash
# 导出最新运行的 Markdown 报告
metaclass-analyzer export -f md -o report

# 导出指定运行的 JSON 和 Markdown
metaclass-analyzer export 1 -f both -o analysis_1
```

### timeline - 查看类时间线

```bash
metaclass-analyzer timeline CLASS_NAME
```

示例：
```bash
metaclass-analyzer timeline OrderedAttrClass
```

### search - 搜索类

```bash
metaclass-analyzer search PATTERN
```

使用 SQL LIKE 语法，`%` 表示通配符。

示例：
```bash
metaclass-analyzer search "%Meta%"
metaclass-analyzer search "Simple%"
```

## 输入文件格式

### class-cases.yaml

```yaml
classes:
  - name: MyClass
    bases: [BaseClass]
    metaclass: CustomMeta
    fields:
      - name: field1
        value: 1
        order: 1
      - name: field2
        value: "test"
        order: 2
        descriptor_type: StringDescriptor
    mro: [MyClass, BaseClass, object]
    source: snippets/my_class.py
    has_conflict: false
```

### events.jsonl

每行一个 JSON 对象：

```json
{"event_type": "__prepare__", "timestamp": "2026-05-01T10:00:01.0001", "class_name": "MyClass", "metaclass_name": "CustomMeta", "details": {"returns": "OrderedDict"}, "order": 1, "success": true}
{"event_type": "metaclass_select", "timestamp": "2026-05-01T10:00:01.0002", "class_name": "MyClass", "metaclass_name": "CustomMeta", "details": {"selected_from": "explicit_metaclass"}, "order": 2, "success": true}
```

事件类型：
- `__prepare__`: 命名空间准备
- `metaclass_select`: 元类选择
- `__new__`: 类对象创建
- `__init__`: 类对象初始化
- `__set_name__`: 描述器名称设置
- `__init_subclass__`: 子类初始化
- `mro_compute`: MRO 计算
- `metaclass_conflict`: 元类冲突
- `class_created`: 类创建完成

## 元类机制参考

### 类创建流程

1. **`__prepare__`**: 在类体执行前调用
   - 返回一个映射对象（通常是 `dict` 或 `OrderedDict`）
   - 返回的映射用作初始命名空间

2. **元类选择**: Python 决定使用哪个元类
   - 显式的 `metaclass=` 参数优先
   - 否则使用第一个基类的元类
   - 如果没有基类或元类指定，回退到 `type`

3. **`__new__`**: 创建类对象
   - 接收: 元类、类名、基类、命名空间
   - 返回新创建的类对象

4. **`__init__`**: 初始化类对象
   - 接收: 类对象、类名、基类、命名空间
   - 在 `__new__` 创建类后调用

5. **`__set_name__`**: 在描述器上调用
   - 为类命名空间中的每个描述器调用
   - 接收: 描述器实例、所有者类、属性名

6. **`__init_subclass__`**: 在基类上调用
   - 为每个定义了它的基类调用
   - 用于子类注册和自定义

### 元类冲突解决

当多继承导致元类冲突时：

1. 识别所有基类的元类
2. 创建一个继承自**所有**基类元类的新元类
3. 使用 `metaclass=` 参数显式应用组合元类
4. 确保组合元类的 MRO 有效

示例：

```python
# 冲突：MetaA 和 type 不兼容
class MetaA(type): pass
class ClassA(metaclass=MetaA): pass
class ClassB: pass  # 使用 type

# 错误！
# class MyClass(ClassA, ClassB): pass

# 修复：创建组合元类
class CombinedMeta(MetaA, type): pass

# 正确
class MyClass(ClassA, ClassB, metaclass=CombinedMeta): pass
```

## 坏格式提示

当输入文件格式错误时，工具会提供详细的错误信息和修复建议：

### YAML 格式错误

```
Error: Invalid format in class-cases.yaml: Failed to parse YAML
  Line: 42
  Suggestions:
    - Check YAML syntax (indentation, colons, etc.)
    - Use a YAML validator to check the file
    - Ensure all required fields are present
```

### JSONL 格式错误

```
Error: Invalid format in events.jsonl: Invalid JSON on line 15
  Line: 15
  Suggestions:
    - Each line must be a valid JSON object
    - Check for missing commas or quotes
    - Ensure consistent JSON structure across lines
```

### Python 语法错误

```
Error: Invalid format in snippets/bad.py: Syntax error in Python file
  Line: 5
  Column: 10
  Suggestions:
    - Check Python syntax
    - Ensure all parentheses, brackets, and braces are balanced
    - Verify indentation (use 4 spaces)
```

## 运行测试

```bash
pytest tests/ -v
```

带覆盖率：

```bash
pytest tests/ --cov=metaclass_analyzer -v
```

## 项目结构

```
metaclass_analyzer/
├── __init__.py      # 包初始化
├── models.py        # 数据模型
├── errors.py        # 自定义异常
├── reader.py        # 文件读取器 (YAML/JSONL/Python)
├── analyzer.py      # 元类分析器
├── storage.py       # SQLite 存储
├── reporter.py      # 报告生成 (JSON/Markdown)
└── cli.py           # 命令行接口

data/
├── class-cases.yaml    # 样例类定义
├── events.jsonl        # 样例事件数据
└── snippets/           # 样例 Python 代码

tests/
├── test_reader.py      # 读取器测试
├── test_analyzer.py    # 分析器测试
├── test_storage.py     # 存储测试
└── test_reporter.py    # 报告生成测试
```

## 许可证

MIT License
