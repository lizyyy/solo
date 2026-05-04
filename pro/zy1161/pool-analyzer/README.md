# Pool Analyzer - 数据库连接池分析工具

一个用于分析多个微服务共用 PostgreSQL 数据库连接池配置的命令行工具。帮助发布前发现连接池配置问题：峰值连接预算、等待/超时风险、重试放大、租户抢占等问题。

## 功能特性

- **配置导入**：支持导入 services.yaml、pool-configs/、traffic.csv、db-limits.yaml
- **连接预算**：计算各服务的理论最大连接、预期峰值连接、利用率
- **风险评估**：检测超时风险、重试风暴、单服务垄断、租户配额超限等
- **流量模拟**：模拟真实流量下的连接使用情况，支持可复现的随机种子
- **报告对比**：对比多个配置方案的分析报告
- **多格式导出**：支持 Markdown 和 JSON 格式报告

## 安装

```bash
cd pool-analyzer
pip install -e .
```

或安装依赖：

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 分析种子数据（正常配置）

```bash
cd data/seed
pool-analyze analyze --output ../../reports/seed-report.md
```

### 2. 分析坏样例（有问题的配置）

```bash
cd data/bad-samples
pool-analyze analyze --output ../../reports/bad-report.md
```

### 3. 运行模拟

```bash
cd data/seed
pool-analyze simulate --duration 30 --seed 42 --output ../../reports/simulation.json
```

### 4. 对比报告

```bash
cd reports
pool-analyze compare seed-report.json bad-report.json --output comparison.json
```

## 命令说明

### `analyze` - 主分析命令

```bash
pool-analyze analyze [OPTIONS]

选项:
  --services PATH       服务配置文件 (默认: services.yaml)
  --pool-configs PATH   连接池配置目录 (默认: pool-configs/)
  --traffic PATH        流量配置文件 (默认: traffic.csv)
  --db-limits PATH      数据库限制配置 (默认: db-limits.yaml)
  --output, -o PATH     输出报告文件路径
  --format, -f TEXT     输出格式: json/md (默认: md)
  --no-simulate         跳过模拟
  --sim-duration INT    模拟时长（分钟）(默认: 30)
  --seed INT            随机种子
  --quiet, -q           静默模式
```

### `simulate` - 单独运行模拟

```bash
pool-analyze simulate [OPTIONS]

选项:
  --services PATH       服务配置文件
  --pool-configs PATH   连接池配置目录
  --traffic PATH        流量配置文件
  --db-limits PATH      数据库限制配置
  --duration, -d INT    模拟时长（分钟）(默认: 60)
  --seed INT            随机种子
  --output, -o PATH     输出JSON文件
```

### `compare` - 对比报告

```bash
pool-analyze compare [OPTIONS] REPORT_FILES...

选项:
  --output, -o PATH     输出对比报告
```

## 配置文件格式

### services.yaml

```yaml
services:
  - name: user-service
    type: java
    pool_config: java-default
    instances: 3
    priority: 1
    tenant_id: core
    description: 用户核心服务
```

### pool-configs/<name>.yaml

```yaml
service_name: java-default
max_pool_size: 10
min_pool_size: 2
connection_timeout: 30.0
idle_timeout: 300.0
max_lifetime: 1800.0
retry_attempts: 3
retry_delay: 1.0
statement_timeout: 60.0
```

### traffic.csv

```csv
service_name,peak_qps,avg_db_calls_per_request,peak_db_calls_per_request,avg_connection_hold_time_ms,peak_connection_hold_time_ms,time_window_minutes
user-service,500,1.5,3,50,200,5
```

### db-limits.yaml

```yaml
max_connections: 200
reserved_connections: 10
superuser_reserved_connections: 3
max_connections_per_tenant: 60
max_wal_size: 4GB
shared_buffers: 512MB
```

## 风险类型说明

| 风险类型 | 说明 | 严重程度 |
|---------|------|---------|
| `total_max_exceeds_capacity` | 理论最大连接数超限 | CRITICAL |
| `expected_peak_exceeds_capacity` | 预期峰值连接超限 | CRITICAL/HIGH/MEDIUM |
| `timeout_too_short` | 连接超时时间过短 | HIGH |
| `retry_storm_risk` | 重试次数过多可能引发重试风暴 | HIGH |
| `single_service_dominance` | 单服务占用超过一半连接 | MEDIUM |
| `tenant_quota_exceeded` | 租户配额超限 | CRITICAL |

## 示例数据

- `data/seed/` - 正常配置的种子数据（7个服务，合理的连接池配置）
- `data/bad-samples/` - 有问题的配置样例：
  - `giant-service`: 单服务配置超大连接池 (50 * 10 = 500连接)
  - `quick-timeout`: 超时时间只有2秒
  - `retry-storm`: 重试次数10次
  - 租户A的服务叠加后远超租户配额

## 项目结构

```
pool-analyzer/
├── pool_analyzer/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── config_loader.py   # 配置加载器
│   ├── analyzer.py        # 核心分析逻辑
│   ├── exporter.py        # 报告导出
│   └── cli.py             # 命令行入口
├── data/
│   ├── seed/              # 正常配置示例
│   │   ├── services.yaml
│   │   ├── pool-configs/
│   │   ├── traffic.csv
│   │   └── db-limits.yaml
│   └── bad-samples/       # 有问题的配置示例
│       ├── services.yaml
│       ├── pool-configs/
│       ├── traffic.csv
│       └── db-limits.yaml
├── tests/
│   ├── test_config_loader.py
│   ├── test_analyzer.py
│   └── test_exporter.py
├── requirements.txt
├── setup.py
└── README.md
```

## 测试

```bash
pytest -v
```

## 使用场景

1. **发布前检查**：在部署新版本前，检查新增服务或调整后的连接池配置是否会导致数据库连接耗尽
2. **容量规划**：评估增加服务实例或扩容时的连接需求
3. **问题诊断**：当出现数据库连接问题时，分析是哪个服务或配置导致的
4. **配置对比**：对比不同配置方案的优缺点，选择最优方案

## License

MIT
