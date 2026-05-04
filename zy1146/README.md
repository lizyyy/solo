# Cache Analyzer - PHP 缓存分析服务

一个完整的 PHP 8 后端服务，用于分析老 PHP 站点的缓存性能，帮助你了解 Redis、文件缓存和 OPcache 是否真正帮上了忙。

## 功能特性

### 数据导入
- `cache-events.jsonl` - 缓存事件日志（HIT/MISS/SET/DELETE）
- `routes.csv` - 路由性能数据
- `cache-config.yaml` - 缓存后端配置（Redis/File/OPcache）
- `slow-queries.csv` - 慢查询日志

### 多维度分析
- **命中率分析** - 整体命中率、按后端/Key分组统计
- **性能分析** - P50/P95/P99 延迟、回源耗时估算
- **热Key分析** - 访问频率排名、基尼系数集中度
- **TTL分布分析** - 过期时间统计、聚集风险检测
- **风险分析** - 击穿/穿透/雪崩风险、OPcache配置异常、慢查询缓存机会

### 优化策略模拟
支持 9 种缓存优化策略的模拟和对比：
1. **TTL Adjustment** - TTL调整
2. **Cache Prewarming** - 缓存预热
3. **Mutex Lock** - 互斥锁防击穿
4. **Bloom Filter** - 布隆过滤器防穿透
5. **Stale-While-Revalidate** - 后台更新时返回旧数据
6. **Key Tiering** - Key分层策略
7. **Tag-Based Invalidation** - 标签失效
8. **TTL Jitter** - TTL抖动防雪崩
9. **Negative Caching** - 负向缓存

### 报告导出
- Markdown 格式报告
- JSON 格式数据
- CSV 格式原始数据

## 快速开始

### 环境要求
- PHP 8.0+
- PDO SQLite 扩展
- JSON 扩展
- Composer

### 安装

```bash
cd /path/to/cache-analyzer
composer install
```

### 启动服务

```bash
# 使用 PHP 内置服务器
php -S localhost:8080 -t public
```

服务将在 `http://localhost:8080` 启动。

### 导入示例数据

项目已包含样例数据在 `data/` 目录下：

```bash
# 方式1: 使用 curl 分别导入各数据文件

# 导入缓存事件
curl -X POST http://localhost:8080/api/import/cache-events \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(cat data/cache-events.jsonl | sed 's/"/\\"/g' | tr '\n' ' ')\"}"

# 导入路由数据
curl -X POST http://localhost:8080/api/import/routes \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(cat data/routes.csv | sed 's/"/\\"/g' | tr '\n' ' ')\"}"

# 导入缓存配置
curl -X POST http://localhost:8080/api/import/cache-config \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(cat data/cache-config.yaml | sed 's/"/\\"/g' | tr '\n' ' ')\"}"

# 导入慢查询
curl -X POST http://localhost:8080/api/import/slow-queries \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"$(cat data/slow-queries.csv | sed 's/"/\\"/g' | tr '\n' ' ')\"}"

# 方式2: 使用批量导入接口（需要修改 base_dir）
curl -X POST http://localhost:8080/api/import/all \
  -H "Content-Type: application/json" \
  -d "{\"base_dir\": \"/absolute/path/to/data\"}"
```

### 运行分析

```bash
# 获取命中率分析
curl http://localhost:8080/api/analysis/hit-rate

# 获取性能分析
curl http://localhost:8080/api/analysis/performance

# 获取热Key分析
curl http://localhost:8080/api/analysis/hot-keys

# 获取TTL分布分析
curl http://localhost:8080/api/analysis/ttl-distribution

# 获取风险分析
curl http://localhost:8080/api/analysis/risks

# 运行完整分析
curl -X POST http://localhost:8080/api/analysis/full
```

### 运行模拟优化

```bash
# 获取可用策略列表
curl http://localhost:8080/api/simulation/strategies

# 模拟单策略优化（如 TTL 调整）
curl -X POST http://localhost:8080/api/simulation/optimization \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "ttl_adjustment",
    "parameters": {
      "ttl_multiplier": 2.0,
      "max_ttl": 86400
    }
  }'

# 对比多种策略
curl -X POST http://localhost:8080/api/simulation/compare \
  -H "Content-Type: application/json" \
  -d '{
    "strategies": [
      {"strategy": "ttl_adjustment", "parameters": {"ttl_multiplier": 2.0}},
      {"strategy": "ttl_jitter", "parameters": {"jitter_percent": 15}},
      {"strategy": "prewarming", "parameters": {"prewarm_ratio": 0.2}}
    ]
  }'

# 运行推荐优化组合
curl -X POST http://localhost:8080/api/simulation/recommended
```

### 导出报告

```bash
# 导出 Markdown 报告
curl http://localhost:8080/api/export/report/markdown -o report.md

# 导出 JSON 报告
curl http://localhost:8080/api/export/report/json -o report.json

# 导出 CSV 数据
curl http://localhost:8080/api/export/report/csv -o events.csv
```

## API 端点总览

### 数据导入
| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/import/cache-events` | 导入缓存事件 JSONL |
| POST | `/api/import/routes` | 导入路由 CSV |
| POST | `/api/import/cache-config` | 导入缓存配置 YAML |
| POST | `/api/import/slow-queries` | 导入慢查询 CSV |
| POST | `/api/import/all` | 从文件批量导入 |
| POST | `/api/import/clear` | 清除所有数据 |
| GET | `/api/import/status` | 获取导入状态 |

### 分析
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/analysis/hit-rate` | 命中率分析 |
| GET | `/api/analysis/performance` | 性能分析 |
| GET | `/api/analysis/hot-keys` | 热Key分析 |
| GET | `/api/analysis/ttl-distribution` | TTL分布分析 |
| GET | `/api/analysis/risks` | 风险分析 |
| POST | `/api/analysis/full` | 完整分析 |

### 模拟
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/simulation/strategies` | 获取可用策略列表 |
| POST | `/api/simulation/optimization` | 单策略模拟 |
| POST | `/api/simulation/compare` | 多策略对比 |
| POST | `/api/simulation/recommended` | 推荐优化组合 |

### 导出
| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/export/report/markdown` | 导出 Markdown 报告 |
| GET | `/api/export/report/json` | 导出 JSON 报告 |
| GET | `/api/export/report/csv` | 导出 CSV 数据 |

## 数据格式说明

### cache-events.jsonl
每行一个 JSON 对象，格式如下：
```json
{
  "id": "evt_001",
  "key": "user:profile:1001",
  "type": "HIT",
  "backend": "redis",
  "timestamp": 1735689600.0,
  "latency_ms": 2.5,
  "ttl": 3600,
  "size_bytes": 1024,
  "route": "/api/users/profile",
  "tags": ["user", "profile"],
  "error": null
}
```

**事件类型 (type):**
- `HIT` - 缓存命中
- `MISS` - 缓存未命中
- `SET` - 设置缓存
- `DELETE` - 删除缓存
- `GET` - 缓存查询操作

**缓存后端 (backend):**
- `redis` - Redis 缓存
- `file` - 文件缓存
- `opcache` - PHP OPcache

### routes.csv
```csv
path,method,name,avg_response_time_ms,p95_response_time_ms,p99_response_time_ms,request_count,error_count,cache_hit_rate,related_cache_keys
/api/users/profile,GET,user_profile,15.5,25.3,45.2,150,2,0.85,"user:profile:*"
```

### cache-config.yaml
```yaml
cache_backends:
  - name: redis
    type: redis
    max_memory_mb: 512
    eviction_policy: allkeys-lru
    default_ttl:
      page_fragment: 3600

opcache:
  enabled: true
  config:
    opcache.memory_consumption: 128
    opcache.validate_timestamps: 1
```

### slow-queries.csv
```csv
query,query_type,execution_time_ms,lock_time_ms,rows_examined,rows_sent,database,table_name,timestamp,explain_plan,is_cacheable,recommendation
"SELECT * FROM users WHERE id = 1001",SELECT,150.5,0.5,1,1,mydb,users,1735689600.0,"Using index",1,"Cache with TTL 3600s"
```

## 错误处理

服务支持以下异常检测并返回可读的错误信息：

| 错误类型 | 示例文件 | 检测内容 |
|---------|---------|---------|
| 坏 JSON | `bad-json.jsonl` | 无效的 JSON 语法 |
| 缺失字段 | `missing-fields.jsonl` | 缺少必填字段（id, key, type, backend, timestamp） |
| 无效 TTL | `invalid-ttl.jsonl` | 负数 TTL、非数字 TTL |
| 重复 ID | `duplicate-keys.jsonl` | 相同的事件 ID |
| 时间倒序 | `out-of-order.jsonl` | 时间戳非递增 |

测试错误处理：
```bash
# 测试坏 JSON 导入
curl -X POST http://localhost:8080/api/import/cache-events \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"{invalid json}\"}"
```

## 运行测试

```bash
# 运行所有测试
composer test

# 或使用 phpunit
./vendor/bin/phpunit

# 运行特定测试
./vendor/bin/phpunit tests/HitRateAnalyzerTest.php
```

## 风险分析详解

### 缓存击穿 (Cache Breakdown)
- **检测**: 同一 Key 在短时间内（1秒）出现多次未命中
- **风险**: 热点 Key 失效时，大量请求同时穿透到数据库
- **防护策略**: 互斥锁、永不过期、预热

### 缓存穿透 (Cache Penetration)
- **检测**: 长延迟未命中且无后续 SET 操作（查询不存在的数据）
- **风险**: 大量请求查询根本不存在的数据，绕过缓存直接访问数据库
- **防护策略**: 布隆过滤器、负向缓存

### 缓存雪崩 (Cache Avalanche)
- **检测**: TTL 聚集（大量 Key 使用相同或相近的过期时间）
- **风险**: 大量 Key 同时过期，导致数据库瞬时压力暴增
- **防护策略**: TTL 抖动、分层过期、多级缓存

### OPcache 配置异常
- **检测**: 检查常见的配置问题
  - `opcache.enable` 未开启
  - `opcache.validate_timestamps` 频繁检查
  - `opcache.memory_consumption` 过小
  - `opcache.max_accelerated_files` 不足

## 项目结构

```
cache-analyzer/
├── public/
│   └── index.php              # 入口文件和路由
├── src/
│   ├── Analyzer/              # 分析器
│   │   ├── HitRateAnalyzer.php
│   │   ├── PerformanceAnalyzer.php
│   │   ├── HotKeyAnalyzer.php
│   │   ├── TtlDistributionAnalyzer.php
│   │   └── RiskAnalyzer.php
│   ├── Controller/            # 控制器
│   │   ├── ImportController.php
│   │   ├── AnalysisController.php
│   │   ├── SimulationController.php
│   │   └── ExportController.php
│   ├── Importer/              # 数据导入器
│   │   ├── CacheEventsImporter.php
│   │   ├── RoutesImporter.php
│   │   ├── CacheConfigImporter.php
│   │   └── SlowQueriesImporter.php
│   ├── Model/                 # 数据模型
│   │   ├── CacheEvent.php
│   │   ├── CacheConfig.php
│   │   ├── Route.php
│   │   └── SlowQuery.php
│   ├── Simulation/            # 模拟引擎
│   │   └── SimulationEngine.php
│   └── Storage/               # 数据存储
│       └── Database.php       # SQLite 封装
├── data/                      # 样例数据
│   ├── cache-events.jsonl
│   ├── routes.csv
│   ├── cache-config.yaml
│   ├── slow-queries.csv
│   └── examples/              # 异常样例数据
│       ├── bad-json.jsonl
│       ├── missing-fields.jsonl
│       ├── invalid-ttl.jsonl
│       ├── duplicate-keys.jsonl
│       └── out-of-order.jsonl
├── tests/                     # 单元测试
│   ├── HitRateAnalyzerTest.php
│   ├── PerformanceAnalyzerTest.php
│   ├── HotKeyAnalyzerTest.php
│   ├── CacheEventsImporterTest.php
│   └── SimulationEngineTest.php
├── composer.json
├── phpunit.xml
└── README.md
```

## 数据持久化

数据存储在 SQLite 数据库中，默认路径：
```
data/cache_analyzer.db
```

可以通过修改 `public/index.php` 中的数据库路径来自定义：
```php
$database = new Database('/path/to/your/database.db');
```

## License

MIT
