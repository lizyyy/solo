# Asyncio Analyzer

一个用于分析 asyncio 代码问题的命令行工具，帮助团队复盘代码为什么会卡住或任务泄漏。

## 功能特性

- **init**: 初始化分析环境
- **analyze**: 分析指定的代码片段和事件日志
- **compare**: 对比两次分析结果
- **export**: 导出分析报告（Markdown/JSON 格式）

## 分析维度

1. **事件循环分析**: 检测事件循环是否被阻塞
2. **await 边界**: 分析 await 调用链和潜在的阻塞点
3. **create_task 未托管**: 检测未被正确管理的后台任务
4. **gather/TaskGroup 异常**: 分析 gather 和 TaskGroup 的异常处理
5. **timeout/cancel 传播**: 检测超时和取消操作的传播问题
6. **Queue 背压**: 分析队列的背压问题
7. **连接池耗尽**: 检测连接池资源耗尽问题

## 安装

```bash
pip install -e .
```

## 使用方法

### 初始化

```bash
asyncio-analyzer init --samples-dir ./samples
```

### 分析代码

```bash
asyncio-analyzer analyze --samples-dir ./samples
```

### 对比分析

```bash
asyncio-analyzer compare --before ./analysis1.db --after ./analysis2.db
```

### 导出报告

```bash
asyncio-analyzer export --format markdown --output report.md
asyncio-analyzer export --format json --output report.json
```

## 目录结构

```
.
├── asyncio_analyzer/    # 主代码目录
├── samples/             # 样例数据目录
│   ├── async-plan.yaml  # 异步计划配置
│   ├── events.jsonl     # 事件日志
│   └── snippets/        # 代码片段
├── tests/               # 测试目录
└── README.md
```

## 坏格式提示

工具会检测并报告以下格式问题：
- 无效的 YAML 格式
- 无效的 JSONL 格式
- 语法错误的 Python 代码
- 缺失的必需字段

## 测试

```bash
pytest
```

## License

MIT
