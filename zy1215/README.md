# Perf Trainer - Linux 性能排障练习工具

一个帮助新同事学习和练习 Linux 性能排障技能的交互式命令行工具。

## 功能特性

- **交互式演练**: 按 CPU、IO、网络、系统调用、热点函数分阶段引导排障
- **智能推荐**: 每个阶段给出"下一步该看哪个命令、为什么、看到什么算异常"
- **持久化存储**: SQLite 记录每次演练的完整路径
- **对比分析**: compare 命令对比两次排障路径的差异
- **复盘导出**: export 命令导出 Markdown/JSON 格式的复盘报告
- **样例数据**: seed 命令创建完整的样例事件，开箱即用
- **格式验证**: 详细的错误提示，帮助创建正确的 incident.yaml

## 快速开始

### 安装

```bash
# 克隆项目
cd zy1215

# 安装依赖（推荐使用虚拟环境）
pip install -e .

# 或者使用 pip install -e ".[dev]" 安装开发依赖
```

### 第一次使用

```bash
# 1. 创建样例事件
perf-trainer seed ./my-first-incident

# 2. 开始演练
perf-trainer start ./my-first-incident
```

## 命令详解

### start - 开始排障演练

```bash
# 基本用法
perf-trainer start <incident_path>

# 恢复之前的会话
perf-trainer start <incident_path> --resume <session_id>
```

**交互式操作选项**：

| 命令 | 说明 |
|------|------|
| `数字` | 执行对应编号的命令，查看输出 |
| `info` | 查看当前事件的详细信息 |
| `stages` | 查看所有排障阶段及进度 |
| `analysis` | 输入你的分析，提交后进入下一阶段 |
| `next` | 跳过当前阶段（不推荐） |
| `quit` | 退出演练，会话自动保存 |

### list - 查看历史会话

```bash
# 列出最近 20 个会话
perf-trainer list

# 列出更多会话
perf-trainer list --limit 50
```

### compare - 对比排障路径

```bash
# 对比两个会话
perf-trainer compare <session1_id> <session2_id>

# 导出对比结果到文件
perf-trainer compare 5 7 --output comparison.md
```

**对比内容包括**：
- 基本信息对比（事件名称、状态、步骤数、正确率）
- 每个阶段的详细对比（使用的命令、分析内容、系统反馈）

### export - 导出复盘报告

```bash
# 导出为 Markdown（默认）
perf-trainer export <session_id>

# 导出为 JSON
perf-trainer export <session_id> --format json

# 导出到文件
perf-trainer export <session_id> --output report.md
```

**报告内容**：
- 会话基本信息
- 统计数据（步骤数、正确率、完成阶段）
- 每个步骤的详细记录（你的分析 + 系统反馈）
- 总结备注

### seed - 创建样例事件

```bash
# 创建样例事件
perf-trainer seed ./sample-incident

# 强制覆盖已存在的目录
perf-trainer seed ./sample-incident --force
```

生成的目录结构：
```
sample-incident/
├── incident.yaml          # 事件定义文件
└── samples/               # 采样文件目录
    ├── top_output.txt
    ├── vmstat_output.txt
    ├── strace_output.txt
    ├── lsof_output.txt
    ├── perf_top_output.txt
    └── perf_report_output.txt
```

## 事件定义格式

### incident.yaml 结构

```yaml
name: 事件名称
description: |
  详细描述事件背景和现象。
  可以是多行文本。

root_cause: |
  根本原因（完成后显示给用户）。

difficulty: easy | medium | hard

stages:
  - name: cpu                    # 阶段名称：cpu, io, network, syscall, hot_function
    description: 阶段描述
    commands:
      - name: top                # 命令名称
        description: 命令描述
        sample: top_output.txt   # 对应的样本文件名
        why: 为什么要看这个命令
        what_to_look_for: 应该关注什么
        anomaly_signs:           # 异常迹象列表
          - 单个进程 CPU > 80%
          - 整体 us + sy > 90%
    expected_analysis: |
      期望的分析内容（用于评估用户输入）。
    success_criteria: 此阶段的成功标准

samples:
  - name: top_output
    type: cpu
    file: top_output.txt
    description: 样本文件描述
```

### 阶段说明

| 阶段 | 说明 | 常用命令 |
|------|------|----------|
| `cpu` | CPU 使用情况分析 | top, htop, vmstat, mpstat, pidstat |
| `io` | 磁盘 IO 分析 | iostat, vmstat, iotop, dstat |
| `network` | 网络分析 | netstat, ss, sar, iftop, tcpdump, ping |
| `syscall` | 系统调用分析 | strace, ltrace, lsof, sysctl |
| `hot_function` | 热点函数分析 | perf top, perf record/report, 火焰图 |

## 常见问题

### Q1: incident.yaml 格式错误怎么办？

工具会给出详细的错误提示，例如：

```
incident.yaml 格式错误:
  字段: stages.0.commands.0
  问题: Command at stage 'cpu', index 0 missing 'name' field
提示: Each command needs a 'name' (e.g., 'top', 'vmstat').
```

**常见错误**：
1. **缩进错误**: YAML 使用空格缩进，不要用 Tab
2. **缺少必需字段**: 检查错误提示中提到的字段
3. **无效的阶段名称**: 只能使用 cpu, io, network, syscall, hot_function
4. **引用不存在的样本**: 确保 samples 目录中的文件名与引用一致

### Q2: 如何创建自己的事件？

```bash
# 1. 先用 seed 创建一个模板
perf-trainer seed ./my-incident

# 2. 编辑 incident.yaml，修改事件描述、阶段配置

# 3. 替换 samples 目录下的文件为真实的命令输出

# 4. 测试
perf-trainer start ./my-incident
```

### Q3: 会话保存在哪里？

默认位置：`~/.perf_trainer/perf_trainer.db`

可以通过 `--data-dir` 选项指定其他位置：
```bash
perf-trainer --data-dir ./my-data start ./incident
```

### Q4: 如何恢复被中断的演练？

```bash
# 先查看会话列表
perf-trainer list

# 找到会话 ID 后恢复
perf-trainer start ./incident-path --resume <session_id>
```

## 开发指南

### 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 运行测试并显示覆盖率
pytest --cov=perf_trainer
```

### 项目结构

```
perf_trainer/
├── __init__.py
├── cli.py              # 命令行入口
├── config.py           # 配置常量
├── engine.py           # 核心排障引擎
├── exceptions.py       # 自定义异常
├── incident_parser.py  # incident.yaml 解析器
└── storage.py          # SQLite 存储

tests/
├── __init__.py
└── test_basic.py       # 基础测试

pyproject.toml          # 项目配置
README.md              # 本文档
```

## 版本历史

### v0.1.0
- 初始版本发布
- 支持 5 个排障阶段
- 实现 start, list, compare, export, seed 命令
- SQLite 持久化存储
- 完整的错误处理和格式验证

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
