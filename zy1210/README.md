# Cache Forensics - 缓存事故复盘工具

一个本地命令行工具，帮助后端工程师复盘缓存事故。通过模拟进程内本地缓存、Redis 分布式缓存和数据库回源链路，分析不同缓存策略下的风险事件。

## 功能特性

- **多层缓存模拟**: 支持进程内本地缓存 + Redis 分布式缓存的二级缓存架构
- **丰富的缓存策略**:
  - TTL 过期时间 + 抖动（Jitter）防止雪崩
  - 布隆过滤器防止缓存穿透
  - 互斥锁防止缓存击穿
  - 缓存预热机制
- **风险事件检测**:
  - 旧值读取（Stale Read）
  - 一致性窗口（Consistency Window）
  - 缓存穿透（Cache Penetration）
  - 热点 Key 击穿（Hot Key Breakdown）
  - 批量过期雪崩（Batch Expire Avalanche）
- **策略对比**: 对比不同缓存策略的效果差异
- **报告导出**: 支持 Markdown 和 JSON 格式的报告导出
- **数据持久化**: 所有运行结果保存到 SQLite 数据库

## 安装

```bash
pip install -e .
```

或者使用开发依赖：

```bash
pip install -e ".[dev]"
```

## 快速开始

### 1. 初始化工作目录

```bash
cache-forensics init --dir ./my-analysis
```

这将创建：
- `traffic.jsonl` - 流量数据样例
- `db-updates.yaml` - 数据库更新样例
- `cache-policy.yaml` - 缓存策略配置
- `cache-forensics.db` - SQLite 数据库

### 2. 回放流量数据

使用默认策略（good-policy）：

```bash
cache-forensics replay --work-dir ./my-analysis
```

指定特定策略：

```bash
cache-forensics replay --work-dir ./my-analysis --policy bad-policy
```

### 3. 查看历史运行

```bash
cache-forensics list --work-dir ./my-analysis
```

### 4. 对比两次运行

```bash
cache-forensics compare --run-id1 <run-id-1> --run-id2 <run-id-2> --work-dir ./my-analysis
```

### 5. 导出报告

导出 Markdown 格式：

```bash
cache-forensics export --run-id <run-id> --work-dir ./my-analysis --format markdown
```

导出 JSON 格式：

```bash
cache-forensics export --run-id <run-id> --work-dir ./my-analysis --format json
```

## 配置文件说明

### traffic.jsonl

每行一个 JSON 对象，描述流量事件：

```json
{
  "timestamp": "2026-05-05T10:00:00",
  "operation": "read",
  "key": "user:123",
  "request_id": "req-001",
  "source": "web",
  "value": {"name": "张三"},
  "metadata": {"region": "cn-east-1"}
}
```

字段说明：
- `timestamp`: ISO 格式时间戳
- `operation`: 操作类型（read/write/update/delete）
- `key`: 缓存 Key
- `request_id`: 请求唯一标识
- `source`: 请求来源（可选）
- `value`: 写入的值（write/update 操作时需要）
- `metadata`: 元数据（可选）

### db-updates.yaml

描述数据库的更新操作：

```yaml
updates:
  - timestamp: "2026-05-05T10:00:00"
    operation: "write"
    key: "user:123"
    old_value: null
    new_value: {"name": "张三", "version": 1}
    transaction_id: "txn-001"
```

### cache-policy.yaml

定义缓存策略，可以定义多个策略用于对比：

```yaml
policies:
  - name: "good-policy"
    ttl_seconds: 300
    ttl_jitter_seconds: 30
    local_cache_enabled: true
    redis_cache_enabled: true
    bloom_filter_enabled: true
    mutex_lock_enabled: true
    warmup_enabled: true
    warmup_keys: ["user:123", "user:456"]
    consistency_mode: "eventual"
    write_strategy: "write_through"
    invalidation_strategy: "delete"
    hot_key_threshold: 100
    penetration_threshold: 50
    avalanche_window_seconds: 60
```

策略配置说明：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `name` | string | 策略名称 |
| `ttl_seconds` | int | 缓存过期时间（秒） |
| `ttl_jitter_seconds` | int | TTL 抖动范围，防止批量过期 |
| `local_cache_enabled` | bool | 是否启用本地缓存 |
| `redis_cache_enabled` | bool | 是否启用 Redis 缓存 |
| `bloom_filter_enabled` | bool | 是否启用布隆过滤器 |
| `mutex_lock_enabled` | bool | 是否启用互斥锁 |
| `warmup_enabled` | bool | 是否启用缓存预热 |
| `warmup_keys` | list[string] | 预热的 Key 列表 |
| `consistency_mode` | string | 一致性模式（eventual/strong） |
| `write_strategy` | string | 写策略（write_through/write_behind/write_around） |
| `invalidation_strategy` | string | 失效策略（delete/update） |
| `hot_key_threshold` | int | 热点 Key 阈值 |
| `penetration_threshold` | int | 穿透事件阈值 |
| `avalanche_window_seconds` | int | 雪崩检测窗口（秒） |

## 写策略说明

### write_through（写穿透）
写操作同时更新缓存和数据库。适用于数据一致性要求高的场景。

### write_behind（写回/异步写）
先写缓存，异步更新数据库。性能高但有数据丢失风险。

### write_around（写绕）
只写数据库，不更新缓存，后续读取时从数据库加载。适用于写多读少的场景。

## 风险事件类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `stale_read` | 读取到旧值，缓存版本低于数据库版本 | high |
| `cache_penetration` | 缓存穿透，请求的 Key 在缓存和数据库都不存在 | medium |
| `hot_key_breakdown` | 热点 Key 击穿，某个 Key 被超量访问 | high/medium |
| `batch_expire_avalanche` | 批量过期雪崩，短时间内大量缓存未命中 | high |
| `cache_miss_storm` | 缓存未命中风暴，大量穿透事件导致 | high |

## 好配置 vs 坏配置对比

### good-policy（推荐配置）

```yaml
name: "good-policy"
ttl_seconds: 300           # 较长的 TTL
ttl_jitter_seconds: 30     # 30 秒抖动防止雪崩
local_cache_enabled: true  # 启用本地缓存
redis_cache_enabled: true  # 启用 Redis
bloom_filter_enabled: true # 布隆过滤器防穿透
mutex_lock_enabled: true   # 互斥锁防击穿
warmup_enabled: true       # 预热热点数据
write_strategy: "write_through"  # 写穿透保证一致性
invalidation_strategy: "delete"  # 删除缓存而非更新
```

### bad-policy（风险配置示例）

```yaml
name: "bad-policy"
ttl_seconds: 60            # 过短的 TTL
ttl_jitter_seconds: 0      # 无抖动，所有 Key 同时过期
local_cache_enabled: false # 禁用本地缓存
bloom_filter_enabled: false # 无布隆过滤器
mutex_lock_enabled: false  # 无互斥锁
warmup_enabled: false      # 无预热
write_strategy: "write_around"  # 可能导致缓存未命中
invalidation_strategy: "update" # 更新缓存可能引入一致性问题
hot_key_threshold: 1000    # 阈值过高，无法及时发现热点
penetration_threshold: 1000 # 阈值过高，无法及时发现穿透
```

## 运行测试

```bash
pytest -v
```

带覆盖率：

```bash
pytest --cov=cache_forensics -v
```

## 项目结构

```
cache-forensics/
├── cache_forensics/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── cache.py           # 缓存层实现（本地/Redis/数据库）
│   ├── engine.py          # 模拟引擎核心
│   ├── storage.py         # SQLite 存储层
│   ├── reporter.py        # 报告生成器
│   └── cli.py             # 命令行入口
├── tests/
│   ├── __init__.py
│   ├── test_models.py
│   ├── test_cache.py
│   ├── test_engine.py
│   └── test_storage.py
├── pyproject.toml
└── README.md
```

## 示例工作流

```bash
# 1. 初始化
cache-forensics init --dir ./incident-analysis

# 2. 准备真实数据（替换样例文件）
# - 从日志导出 traffic.jsonl
# - 从 binlog 导出 db-updates.yaml

# 3. 使用"好"策略回放
cache-forensics replay --work-dir ./incident-analysis --policy good-policy

# 4. 使用"坏"策略回放（模拟事故场景）
cache-forensics replay --work-dir ./incident-analysis --policy bad-policy

# 5. 查看运行列表
cache-forensics list --work-dir ./incident-analysis

# 6. 对比两次运行的差异
cache-forensics compare \
  --run-id1 <good-run-id> \
  --run-id2 <bad-run-id> \
  --work-dir ./incident-analysis \
  --output ./comparison.md

# 7. 导出详细报告
cache-forensics export \
  --run-id <bad-run-id> \
  --work-dir ./incident-analysis \
  --format markdown \
  --output ./incident-report.md
```

## License

MIT
