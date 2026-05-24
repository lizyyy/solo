# CI 失败签名聚类 CLI

智能分析 CI 失败日志，自动按根因聚类，帮助维护者快速定位问题。

## 功能特性

- **多格式输入**: 支持纯文本日志、JSON、YAML 格式的 CI 失败记录
- **智能解析**: 自动提取提交号、任务名、矩阵参数、重跑次数等元数据
- **签名归一化**: 处理同错不同栈、日志截断、路径/行号/时间戳变化
- **聚类分析**: 基于相似度的失败聚类，识别同一根因的多个失败
- **矩阵聚合**: 分析失败在不同 OS/版本/架构上的分布
- **抖动评分**: 评估失败的随机性，区分确定性失败和偶发问题
- **多格式输出**:
  - 终端彩色摘要
  - 机器可读 JSON
  - 给同事看的 Markdown 报告

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 分析日志目录

```bash
ci-failure-cluster analyze --dir ./failure-logs --output ./reports
```

### 2. 分析单个文件

```bash
ci-failure-cluster analyze ./log1.txt ./log2.txt -o ./reports
```

### 3. 检查解析结果

```bash
ci-failure-cluster inspect ./failure-logs/build_1.txt
```

### 4. 生成配置文件

```bash
ci-failure-cluster init-config -o .ci-failure-cluster.yaml
```

## 命令参数

### analyze 命令

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--dir, -d` | 包含日志的目录（递归扫描） | - |
| `--output, -o` | 输出目录 | `./ci-failure-reports` |
| `--config, -c` | 配置文件路径 | - |
| `--similarity, -s` | 签名相似度阈值 (0.0-1.0) | `0.85` |
| `--min-cluster, -m` | 最小聚类大小 | `2` |
| `--overwrite` | 覆盖已存在的输出文件 | `false` |
| `--no-recursive` | 不递归扫描目录 | 递归 |
| `--quiet, -q` | 静默模式 | `false` |
| `--rerun-threshold` | 只分析重跑次数 >= 阈值的失败 | `0` |

### 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 成功完成分析 |
| `1` | 没有找到输入文件 |
| `2` | 解析错误 |
| `3` | 没有找到可分析的失败记录 |
| `4` | 输出错误 |

## 核心算法说明

### 日志切片 (Log Slicing)

自动识别错误起始位置（Error/Traceback/Exception/AssertionError 等），提取完整错误栈，截断无意义的输出。

### 签名归一化 (Signature Normalization)

- **路径归一化**: 替换文件系统路径为 `<PATH>`
- **UUID/HEX 归一化**: 替换唯一标识为 `<UUID>`/`<HEX>`
- **行号归一化**: 替换行号为 `<N>`
- **时间戳归一化**: 替换时间戳为 `<TS>`
- **过滤无关栈帧**: 过滤第三方库（site-packages、node_modules 等）栈帧

### 聚类算法

1. 基于签名哈希的初步分组
2. 使用模糊字符串匹配和 token 相似度合并相似聚类
3. 加权相似度计算：错误信息(50%) + token 重叠(30%) + 栈跟踪(20%)

### 矩阵聚合

分析每个聚类在各个矩阵维度（OS/版本/架构）上的分布，识别是否在特定配置下集中出现。

### 抖动评分

衡量失败的随机性：
- `0 = 完全确定`: 同一提交同一任务必现
- `1 = 完全随机`: 跨多个提交和任务随机出现
- **低抖动（<0.3）**: 确定性失败，特定条件必现
- **中抖动（0.3-0.7）**: 半随机，可能和时序/环境相关
- **高抖动（>0.7）**: 高度随机，需要关注稳定性问题

## 配置文件

使用 `init-config` 生成默认配置文件：

```yaml
similarity_threshold: 0.85
min_cluster_size: 2
max_tokens_per_signature: 50
normalize_paths: true
normalize_hex: true
normalize_numbers: true
normalize_uuids: true
normalize_timestamps: true
stop_words:
  - error
  - failed
  - failure
error_patterns:
  - AssertionError
  - TimeoutError
  - ConnectionError
stack_frame_ignore:
  - site-packages
  - node_modules
jitter_window_size: 10
```

## 示例

### 输入日志示例

```text
commit: a1b2c3d4e5f6
job_name: linux-python-3.9-tests
matrix:
  os: ubuntu-latest
  python: 3.9

AssertionError: Expected 42 but got 56
  File "/home/runner/work/project/tests/test_calc.py", line 45, in test_addition
    assert result == 42
```

### 输出报告

终端会显示：
- 概览统计（总失败数、聚类数、未聚类数）
- Top 聚类列表（大小、错误类型、抖动评分、重跑成功率、涉及提交）
- 聚类详情预览

Markdown 报告包含：
- 完整的聚类算法说明
- 每个聚类的详细信息
- 矩阵覆盖可视化
- 涉及的失败记录列表
- 分析参数记录

## 项目结构

```
src/ci_failure_cluster/
├── __init__.py          # 包版本
├── cli.py               # CLI 入口
├── types.py             # 数据类型定义
├── config.py            # 配置管理
├── parser.py            # 日志解析器
├── normalizer.py        # 签名归一化
├── clusterer.py         # 聚类算法 + 矩阵聚合 + 抖动评分
└── reporter.py          # 报告生成器
```

## 稳定性保证

- 重复运行同一批材料时，聚类结果稳定（基于哈希和确定算法）
- 输出文件包含时间戳，避免覆盖（除非指定 `--overwrite`）
- 文件已存在时自动追加序号

## 常见问题

**Q: 如何处理"重跑成功掩盖"的问题？**

A: 使用 `--rerun-threshold N` 只分析重跑 N 次以上的失败，这些更可能是真正的问题。

**Q: 同一种错误但栈不同怎么办？**

A: 签名归一化会过滤路径、行号、内存地址等易变信息，只保留错误核心语义。

**Q: 日志被截断了怎么办？**

A: 算法优先使用错误信息和关键词，不依赖完整栈跟踪。

**Q: 如何调整聚类粒度？**

A: 使用 `--similarity` 调整相似度阈值（0.7=更粗，0.9=更细）。
