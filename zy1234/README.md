# MemProfiler - Python内存问题排查小工具

一个用于Python内存问题排查的教学工具，支持分析tracemalloc快照、GC日志、对象引用关系等数据，帮助开发者理解和定位内存泄漏问题。

## 功能特性

- **多源数据读取**：支持脚本片段、tracemalloc快照、GC/debug日志、对象引用关系JSON
- **智能分析引擎**：
  - 引用计数变化分析
  - 循环引用检测
  - `__del__`导致的不可回收对象识别
  - 弱引用分析
  - 缓存容器残留检测
  - 大对象保留链追踪
- **命令行接口**：init、analyze、compare、export四个核心命令
- **数据持久化**：分析结果存储到SQLite数据库
- **报告导出**：支持Markdown和JSON格式的分析报告
- **样例数据**：包含seed样例数据用于培训演示
- **友好提示**：坏格式检测和详细的错误提示

## 安装

```bash
# 克隆项目
cd zy1234

# 安装依赖
pip install -e .
```

## 快速开始

### 1. 初始化项目

```bash
# 使用默认配置初始化
memprofiler init

# 或指定工作目录
memprofiler init --workdir ./my-analysis
```

### 2. 准备分析数据

将以下类型的数据放入 `samples/` 目录：
- 脚本片段（`.py` 文件）
- tracemalloc快照（`.snap` 或 `.txt` 格式的摘要）
- GC/debug日志（`.log` 文件）
- 对象引用关系JSON（`.json` 文件）

或者使用内置的seed样例数据：

```bash
# 生成seed样例数据
memprofiler init --seed
```

### 3. 执行分析

```bash
# 分析所有可用数据
memprofiler analyze

# 分析指定快照
memprofiler analyze --snapshot snapshots/snapshot1.snap

# 详细模式
memprofiler analyze --verbose
```

### 4. 比较快照

```bash
# 比较两个快照
memprofiler compare --before snapshot1.snap --after snapshot2.snap

# 显示增长最多的对象类型
memprofiler compare --before snapshot1.snap --after snapshot2.snap --top 20
```

### 5. 导出报告

```bash
# 导出Markdown报告
memprofiler export --format markdown --output report.md

# 导出JSON报告
memprofiler export --format json --output report.json

# 导出最近一次分析的报告
memprofiler export --latest
```

## 支持的数据格式

### 1. 脚本片段（.py）
- 包含内存相关代码的Python脚本
- 工具会分析代码中的潜在内存问题模式

### 2. tracemalloc快照摘要（.txt/.snap）
- tracemalloc模块生成的快照
- 支持 `tracemalloc.Snapshot` 对象的 `.snap` 文件
- 支持文本格式的快照摘要

### 3. GC/debug日志（.log）
- 启用gc.debug后的日志输出
- 包含循环引用、不可回收对象等信息

### 4. 对象引用关系JSON（.json）
- 自定义格式的对象引用关系数据
- 包含对象ID、类型、引用计数、引用关系等信息

## 分析能力

### 引用计数变化分析
- 追踪对象引用计数的变化
- 识别引用计数异常波动
- 检测潜在的引用计数泄漏

### 循环引用检测
- 识别对象间的循环引用链
- 分析循环引用是否可被GC回收
- 提供打破循环引用的建议

### `__del__`方法导致的不可回收问题
- 检测包含`__del__`方法的对象
- 识别因`__del__`导致的循环引用无法回收
- 提供替代方案建议

### 弱引用分析
- 追踪弱引用的使用情况
- 识别弱引用目标已被释放的情况
- 分析弱引用缓存的有效性

### 缓存容器残留检测
- 识别常见的缓存容器（dict、list、set等）
- 检测缓存中的残留对象
- 分析缓存策略的有效性

### 大对象保留链追踪
- 识别内存占用大的对象
- 追踪大对象的引用链
- 定位导致大对象无法释放的根引用

## 命令参考

### init
初始化分析环境，创建必要的目录结构和配置文件。

**选项：**
- `--workdir, -w`：指定工作目录（默认：当前目录）
- `--seed, -s`：生成样例数据用于培训
- `--force, -f`：强制初始化，覆盖现有文件

### analyze
分析收集到的内存数据，生成分析报告。

**选项：**
- `--snapshot, -s`：指定要分析的快照文件
- `--gc-log, -g`：指定GC日志文件
- `--ref-json, -r`：指定引用关系JSON文件
- `--script, -c`：指定脚本片段文件
- `--verbose, -v`：详细输出模式
- `--output, -o`：输出结果到文件

### compare
比较两个内存快照，分析内存变化。

**选项：**
- `--before, -b`：之前的快照文件
- `--after, -a`：之后的快照文件
- `--top, -t`：显示前N个增长最多的类型（默认：10）
- `--include-free, -f`：包括已释放的对象

### export
导出分析报告。

**选项：**
- `--format, -f`：输出格式（markdown/json）（默认：markdown）
- `--output, -o`：输出文件路径
- `--latest, -l`：使用最近一次分析结果
- `--analysis-id, -a`：指定分析ID

## 样例数据

使用 `--seed` 选项可以生成培训用的样例数据：

```bash
memprofiler init --seed
```

生成的样例数据包括：
1. **脚本片段**：包含各种内存问题模式的示例代码
2. **tracemalloc快照**：模拟内存增长的快照数据
3. **GC日志**：包含循环引用和不可回收对象的日志
4. **引用关系JSON**：对象引用关系的示例数据

## 坏格式提示

工具会检测输入数据的格式问题，并提供友好的提示：

- **JSON格式错误**：显示具体的错误位置和修复建议
- **快照格式错误**：提示是否为有效的tracemalloc快照
- **日志格式错误**：建议启用正确的GC debug标志
- **引用关系缺失**：提示缺少的关键字段

## 测试

运行测试套件：

```bash
# 运行所有测试
pytest

# 运行测试并生成覆盖率报告
pytest --cov=memprofiler
```

## 项目结构

```
zy1234/
├── memprofiler/          # 主包目录
│   ├── __init__.py
│   ├── cli.py            # 命令行接口
│   ├── config.py         # 配置管理
│   ├── models.py         # 数据模型（SQLite）
│   ├── readers.py        # 数据读取模块
│   ├── analyzer.py       # 分析引擎
│   ├── exporters.py      # 报告导出
│   ├── utils.py          # 工具函数
│   └── exceptions.py     # 自定义异常
├── samples/              # 样例数据目录
│   ├── scripts/          # 脚本片段
│   ├── snapshots/        # tracemalloc快照
│   ├── gc_logs/          # GC日志
│   └── ref_json/         # 引用关系JSON
├── tests/                # 测试目录
│   ├── test_readers.py
│   ├── test_analyzer.py
│   ├── test_exporters.py
│   └── test_cli.py
├── setup.py
└── README.md
```

## 培训场景

### 场景1：循环引用导致的内存泄漏
1. 使用 `init --seed` 生成样例数据
2. 运行 `analyze` 分析循环引用样例
3. 查看报告中的循环引用检测结果
4. 学习如何使用 `weakref` 打破循环引用

### 场景2：`__del__`方法导致的不可回收对象
1. 分析包含 `__del__` 方法的对象
2. 观察GC日志中的不可回收对象提示
3. 理解为什么 `__del__` 会阻止循环引用回收
4. 学习使用 `contextlib` 或其他替代方案

### 场景3：缓存容器残留
1. 分析使用全局dict作为缓存的代码
2. 观察缓存对象的增长趋势
3. 学习使用 `LRU缓存` 或 `weakref.WeakKeyDictionary`
4. 比较不同缓存策略的内存占用

## 常见问题

**Q: 如何生成tracemalloc快照？**
```python
import tracemalloc

tracemalloc.start()
# ... 执行代码 ...
snapshot = tracemalloc.take_snapshot()
snapshot.dump('snapshot.snap')
```

**Q: 如何启用GC debug日志？**
```python
import gc
gc.set_debug(gc.DEBUG_LEAK)
```

**Q: 工具支持Python 2吗？**
不支持，工具使用了Python 3.7+的特性。

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
