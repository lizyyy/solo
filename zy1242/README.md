# perf-attrib - Python 性能优化归因 CLI 工具

用于团队复盘 "代码到底慢在哪" 的本地性能分析工具。

## 功能特性

- 📊 **多格式支持**: cProfile/pstats、py-spy、timeit、pytest-benchmark
- 🔍 **智能分析**: 自动识别 CPU 热点、函数调用扇出、重复 I/O、过度分配
- 📈 **对比分析**: compare 命令对比两次运行，识别回归和改进
- 📄 **报告导出**: export 命令导出 Markdown/JSON 报告
- 💾 **数据持久化**: SQLite 保存每次分析、证据和建议
- ⚠️ **清晰报错**: 坏格式有清楚的错误提示和解决方案建议

## 安装

```bash
# 克隆或下载代码后
pip install -e .

# 或使用开发模式
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化样例

```bash
# 生成样例文件到 ./perf_examples 目录
perf-attrib init

# 强制覆盖已存在的目录
perf-attrib init --force
```

这会生成以下样例文件：
- `slow_script.py` - 包含各种性能问题的演示脚本
- `cprofile_example.prof` - cProfile 二进制输出
- `pystats_example.json` - py-spy 采样数据
- `benchmark_example.json` - pytest-benchmark 结果
- `timeit_example.txt` - timeit 输出
- `cprofile_text_example.txt` - cProfile 文本输出

### 2. 分析性能数据

```bash
# 分析 cProfile 二进制文件
perf-attrib analyze ./perf_examples/cprofile_example.prof

# 分析 py-spy JSON 数据
perf-attrib analyze ./perf_examples/pystats_example.json --type pystats

# 分析 benchmark 结果
perf-attrib analyze ./perf_examples/benchmark_example.json --type benchmark

# 指定分析名称和备注
perf-attrib analyze ./perf_examples/cprofile_example.prof \
    --name "优化前分析" \
    --notes "第一次性能测试"

# 与基线对比，检测回归
perf-attrib analyze ./perf_examples/cprofile_example.prof \
    --baseline 1

# 分析时同时读取源码片段
perf-attrib analyze ./perf_examples/cprofile_example.prof \
    --source-path ./perf_examples
```

### 3. 列出所有分析

```bash
# 列出最近 10 条分析
perf-attrib list

# 列出所有分析
perf-attrib list --all

# 列出最近 20 条
perf-attrib list -n 20
```

### 4. 查看详细分析

```bash
# 查看分析 ID 为 1 的详细信息
perf-attrib show 1
```

### 5. 对比两次分析

```bash
# 对比分析 1 和 2
perf-attrib compare 1 2

# 对比时指定名称
perf-attrib compare 1 2 --name "优化前后对比" --notes "v1.0 vs v1.1"
```

### 6. 导出报告

```bash
# 导出为 Markdown 格式（默认）
perf-attrib export 1

# 导出为 JSON 格式
perf-attrib export 1 -f json

# 导出到指定文件
perf-attrib export 1 -f markdown -o ./report.md
perf-attrib export 1 -f json -o ./report.json

# 导出时不包含源码片段
perf-attrib export 1 --no-include-code

# 导出时不包含优化建议
perf-attrib export 1 --no-include-suggestions
```

## 支持的数据格式

### cProfile / pstats

```bash
# 生成 cProfile 二进制文件
python -m cProfile -o profile.prof your_script.py

# 生成文本格式
python -m cProfile your_script.py > profile.txt

# 使用 pstats 查看
python -m pstats profile.prof
```

### py-spy

```bash
# 记录采样数据（需要 sudo）
sudo py-spy record -o profile.svg -- python your_script.py

# 生成 JSON 格式
sudo py-spy record --format json -o profile.json -- python your_script.py

# 转储正在运行的进程
sudo py-spy dump --pid 12345 > profile.txt
```

### pytest-benchmark

```bash
# 运行 benchmark 并保存 JSON
pytest --benchmark-autosave --benchmark-json=benchmark.json

# 或在测试中使用
pytest benchmarks/ --benchmark-json=results.json
```

### timeit

```bash
# 命令行使用
python -m timeit -s "import math" "math.sqrt(2)"

# 输出到文件
python -m timeit -n 1000 "for i in range(100): pass" > timeit_result.txt
```

## 分析能力

### CPU 热点识别

- 检测占用大量 CPU 时间的函数
- 识别高频调用且单次耗时较长的函数
- 分析单次调用耗时过长的函数
- 识别调用子函数过多的函数

### 函数调用扇出分析

- 检测高扇出函数（调用过多其他函数）
- 识别深度大于 5 的调用链
- 提供 Facade 模式重构建议

### 重复 I/O 检测

- 识别高频率 I/O 调用（>100 次）
- 检测累计耗时较长的 I/O 操作
- 建议使用缓存或批量处理

### 过度分配识别

- 检测高频内存操作（>10000 次）
- 识别频繁使用 list.append 的代码
- 建议使用生成器或预分配

### 回归检测

- 与基线分析对比
- 检测性能下降超过 10% 的函数
- 识别新增的性能热点

## 数据库结构

数据保存在 `~/.perf_attrib.db` SQLite 数据库中，包含以下表：

| 表名 | 说明 |
|------|------|
| `analysis` | 分析记录元数据 |
| `function_profile` | 函数性能数据（cProfile） |
| `sample_profile` | 采样数据（py-spy） |
| `benchmark_result` | Benchmark 结果 |
| `io_call` | I/O 调用记录 |
| `memory_allocation` | 内存分配记录 |
| `hotspot` | 热点函数识别结果 |
| `suggestion` | 优化建议 |
| `source_snippet` | 源码片段 |
| `comparison` | 对比记录 |

## 测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=perf_attrib

# 运行特定测试文件
pytest tests/test_database.py
pytest tests/test_engine.py
```

## 项目结构

```
perf_attrib/
├── __init__.py          # 版本信息
├── cli.py               # CLI 入口
├── database.py          # 数据库模型
├── errors.py            # 错误处理
├── init.py              # init 命令实现
├── analyzer.py          # analyze 命令实现
├── engine.py            # 分析引擎
├── comparison.py        # compare 命令实现
└── exporter.py          # export 命令实现

tests/
├── __init__.py
├── conftest.py          # pytest 配置
├── test_database.py     # 数据库测试
└── test_engine.py       # 分析引擎测试

pyproject.toml           # 项目配置
README.md               # 本文档
```

## 使用示例场景

### 场景 1: 性能优化前后对比

```bash
# 1. 优化前分析
python -m cProfile -o before.prof my_app.py
perf-attrib analyze before.prof --name "优化前"
# 记录分析 ID，例如: 1

# 2. 进行代码优化...

# 3. 优化后分析
python -m cProfile -o after.prof my_app.py
perf-attrib analyze after.prof --name "优化后"
# 记录分析 ID，例如: 2

# 4. 对比分析
perf-attrib compare 1 2 --name "优化对比"

# 5. 导出报告
perf-attrib export 2 -f markdown -o optimization_report.md
```

### 场景 2: 监控回归

```bash
# 1. 创建基准分析
perf-attrib analyze baseline.prof --name "v1.0 基准"

# 2. 在 CI 中运行，与基线对比
perf-attrib analyze new_profile.prof --baseline 1

# 3. 如果有回归，导出详细报告
perf-attrib export 2 -f json -o regression_report.json
```

### 场景 3: 团队复盘

```bash
# 1. 收集多种性能数据
python -m cProfile -o profile.prof app.py
sudo py-spy record --format json -o pystats.json -- python app.py

# 2. 分析所有数据
perf-attrib analyze profile.prof --name "cProfile 分析"
perf-attrib analyze pystats.json --type pystats --name "采样分析"

# 3. 导出 Markdown 报告用于分享
perf-attrib export 1 -f markdown -o team_review.md
```

## 错误处理

当遇到格式错误时，工具会提供清晰的错误信息和解决方案建议：

```
❌ 无法解析 cProfile 二进制文件: Invalid data
   错误代码: FILE_FORMAT_ERROR
   详细信息:
      file_path: ./bad_file.prof
      file_type: cprofile

💡 建议: 请检查文件格式是否正确: ./bad_file.prof
cProfile 文件应使用 `python -m cProfile -o output.prof script.py` 生成
或者使用 pstats 格式的文本输出
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
