# JVM Tune CLI

JVM调优分析CLI工具，用于分析Java应用在容器环境中的GC行为、内存使用和性能问题，提供智能调优建议。

## 功能特性

- **多源数据导入**: 支持 gc.log、jfr-summary.json、pod-metrics.csv、traffic.csv、jvm-options.yaml、tuning-policies.yaml
- **深度分析**: 暂停分布、吞吐量、堆水位、容器内存余量、流量峰值
- **风险识别**: Full GC、晋升失败、Humongous分配、暂停SLO超标、参数冲突、OOM风险
- **智能调优**: 基于规则的调优建议，支持G1/ZGC/Parallel GC等多种收集器
- **模拟对比**: 支持堆大小、MaxGCPauseMillis、Region大小、新生代比例等参数调整模拟
- **多格式导出**: Markdown/JSON/CSV调优报告
- **多会话管理**: 支持多分析会话，便于对比不同场景

## 安装

```bash
# 克隆仓库
git clone <repository-url>
cd jvm-tune-cli

# 安装依赖
pip install -r requirements.txt

# 安装CLI (可选)
pip install -e .
```

## 快速开始

### 1. 初始化工作区

```bash
jvm-tune init
```

### 2. 创建分析会话

```bash
jvm-tune session create --name production-analysis
```

### 3. 导入数据文件

```bash
# 导入GC日志
jvm-tune import --type gc_log --file data/gc.log

# 导入JVM参数
jvm-tune import --type jvm_options --file data/jvm-options.yaml

# 导入容器指标
jvm-tune import --type pod_metrics --file data/pod-metrics.csv

# 导入流量指标
jvm-tune import --type traffic --file data/traffic.csv

# 导入JFR摘要
jvm-tune import --type jfr_summary --file data/jfr-summary.json

# 导入调优策略
jvm-tune import --type tuning_policies --file data/tuning-policies.yaml
```

### 4. 执行分析

```bash
jvm-tune analyze
```

### 5. 执行调优

```bash
# 执行默认调优
jvm-tune tune

# 使用模拟参数调优
jvm-tune tune \
  --collector G1 \
  --heap-size-mb 6144 \
  --max-gc-pause-ms 150 \
  --region-size-mb 8 \
  --new-ratio 2 \
  --container-reserve-pct 20
```

### 6. 对比分析结果

```bash
jvm-tune compare --sessions session_a,session_b
```

### 7. 导出报告

```bash
# 导出Markdown报告
jvm-tune export --format markdown --output report.md

# 导出JSON报告
jvm-tune export --format json --output report.json

# 导出CSV报告
jvm-tune export --format csv --output report.csv
```

## 命令参考

### init
初始化工作区目录结构。

```bash
jvm-tune init [--force] [--dir <directory>]
```

- `--force`: 强制重新初始化
- `--dir`: 指定工作区目录（默认当前目录下的 .jvm-tune）

### status
查看工作区和当前会话状态。

```bash
jvm-tune status
```

### session
会话管理命令：

```bash
# 创建会话
jvm-tune session create [--name <name>]

# 列出所有会话
jvm-tune session list

# 切换会话
jvm-tune session switch <session-name>
```

### import
导入数据文件。

```bash
jvm-tune import --type <type> --file <path>
```

支持的类型：
- `gc_log`: GC日志文件
- `jfr_summary`: JFR摘要JSON
- `pod_metrics`: Pod指标CSV
- `traffic`: 流量指标CSV
- `jvm_options`: JVM参数YAML
- `tuning_policies`: 调优策略YAML

### analyze
执行GC分析。

```bash
jvm-tune analyze [--slo-pause-ms <ms>] [--slo-gc-overhead <pct>]
```

- `--slo-pause-ms`: 暂停时间SLO阈值（默认200ms）
- `--slo-gc-overhead`: GC开销SLO阈值（默认10%）

### tune
执行调优分析。

```bash
jvm-tune tune [options]
```

调优参数：
- `--collector`: 收集器类型 (G1/ZGC/Parallel)
- `--heap-size-mb`: 堆大小(MB)
- `--max-gc-pause-ms`: 最大GC暂停时间目标(ms)
- `--region-size-mb`: G1 Region大小(MB)
- `--new-ratio`: 新老生代比例
- `--new-size-mb`: 新生代大小(MB)
- `--survivor-ratio`: Eden/Survivor比例
- `--container-reserve-pct`: 容器内存预留比例(%)

### compare
对比多个会话的分析结果。

```bash
jvm-tune compare --sessions <session1,session2,...>
```

### export
导出分析报告。

```bash
jvm-tune export --format <format> --output <path>
```

支持的格式：
- `markdown`: Markdown格式报告
- `json`: JSON格式报告
- `csv`: CSV格式报告

## 数据文件格式

### GC日志
支持标准的Java GC日志格式：
- Unified GC Logging (Java 9+)
- Pre-unified format (Java 8)

### JVM参数配置 (jvm-options.yaml)
```yaml
jvmOptions:
  - "-XX:+UseG1GC"
  - "-Xms4g"
  - "-Xmx4g"
  - "-XX:MaxGCPauseMillis=200"
```

### 容器指标 (pod-metrics.csv)
```csv
timestamp,pod_name,namespace,container_name,cpu_usage_percent,memory_usage_bytes,memory_limit_bytes,memory_rss_bytes,memory_cache_bytes,network_rx_bytes,network_tx_bytes,restart_count,uptime_seconds
2025-01-15T10:00:00Z,my-app,prod,my-app-container,45.5,4299161600,5368709120,3221225472,1073741824,1024000,512000,0,3600
```

### 流量指标 (traffic.csv)
```csv
timestamp,rps,response_time_p50_ms,response_time_p95_ms,response_time_p99_ms,error_rate_percent,success_count,error_count
2025-01-15T10:00:00Z,150.5,25.0,80.0,150.0,0.1,14985,15
```

### JFR摘要 (jfr-summary.json)
```json
{
  "recording": {
    "startTime": "2025-01-15T10:00:00Z",
    "endTime": "2025-01-15T11:00:00Z",
    "durationMs": 3600000
  },
  "gc": {
    "totalCollections": 120,
    "totalPauseTimeMs": 8500,
    "gcOverheadPercent": 2.36
  }
}
```

### 调优策略 (tuning-policies.yaml)
```yaml
riskThresholds:
  fullGcCountThreshold: 5
  humongousCountThreshold: 10
  highHeapUsageThreshold: 85.0
  criticalHeapUsageThreshold: 95.0

sloConfig:
  maxPauseMs: 200
  maxGcOverheadPercent: 10
  minMemoryReservePercent: 10
```

## 示例数据

项目包含示例数据用于测试：

- `data/gc.log`: 示例GC日志
- `data/jvm-options.yaml`: 示例JVM参数
- `data/pod-metrics.csv`: 示例容器指标
- `data/traffic.csv`: 示例流量指标
- `data/jfr-summary.json`: 示例JFR摘要
- `data/tuning-policies.yaml`: 示例调优策略

### 坏样例数据

用于测试异常场景：

- `data/bad/jvm-options-conflict.yaml`: 包含参数冲突的配置
- `data/bad/jvm-options-container-mismatch.yaml`: 堆大小超过容器内存限制
- `data/bad/gc-many-full-gc.log`: 包含大量Full GC的日志

## 风险检测

工具可以检测以下风险类型：

| 风险类型 | 说明 |
|---------|------|
| FULL_GC_FREQUENT | Full GC发生频繁 |
| HUMONGOUS_ALLOCATION | 大对象分配频繁 |
| PROMOTION_FAILURE | 晋升失败事件 |
| PAUSE_SLO_VIOLATION | 暂停时间超过SLO |
| HIGH_GC_OVERHEAD | GC开销过高 |
| OOM_RISK | OOM风险（堆使用接近限制） |
| PARAMETER_CONFLICT | JVM参数冲突 |
| CONTAINER_MEMORY_MISMATCH | 堆配置与容器内存不匹配 |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/test_workspace.py -v
python -m pytest tests/test_models.py -v
```

## 项目结构

```
jvm-tune-cli/
├── jvm_tune_cli/
│   ├── __init__.py
│   ├── cli.py              # CLI入口
│   ├── workspace.py        # 工作区管理
│   ├── models/
│   │   ├── __init__.py
│   │   ├── gc_event.py     # GC事件模型
│   │   └── tuning_policy.py # 调优策略模型
│   ├── parsers/
│   │   └── __init__.py
│   ├── analyzers/
│   │   └── __init__.py
│   ├── simulators/
│   │   └── __init__.py
│   └── exporters/
│       └── __init__.py
├── data/
│   ├── gc.log
│   ├── jvm-options.yaml
│   ├── pod-metrics.csv
│   ├── traffic.csv
│   ├── jfr-summary.json
│   ├── tuning-policies.yaml
│   └── bad/                # 坏样例数据
├── tests/
│   ├── __init__.py
│   ├── test_workspace.py
│   └── test_models.py
├── requirements.txt
├── setup.py
└── README.md
```

## License

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
