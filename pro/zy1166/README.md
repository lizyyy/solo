# Memory Analyzer CLI

Node.js 内存分析 CLI 工具 - 分析 GC 日志、Heap 快照、流量数据，检测内存问题并模拟参数调整效果。

## 功能特性

### 📊 数据导入支持
- **GC 日志** (`trace-gc.log`) - 解析 V8 GC 事件
- **Heap 摘要** (`heap-summary.json`) - Heap 快照分析
- **Retainer 路径** (`retainer-paths.json`) - 引用链追踪
- **接口流量** (`endpoint-traffic.csv`) - 请求内存关联分析
- **配置文件** (`config.json`) - 缓存/对象池配置解析

### 🔍 内存问题检测
1. **Young/Old Space 增长** - 堆空间异常增长趋势
2. **Major GC 回收不足** - 老年代回收效率低下
3. **对象晋升过快** - 年轻代存活率高导致频繁晋升
4. **闭包/事件监听器误持有** - 引用泄漏检测
5. **Buffer/原生内存异常** - 大对象/Buffer 积累
6. **对象池反而吃内存** - 无界对象池/空闲对象过多
7. **WeakRef/FinalizationRegistry 误用** - 弱引用不当使用
8. **缓存问题** - 无界缓存/TTL 缺失

### 🎮 参数模拟
- `max-old-space-size` - 老年代大小调整
- `semi-space-size` - 年轻代半空间调整
- `cacheTTL` - 缓存过期时间
- `poolMaxSize` - 对象池上限
- `batchSize` - 批处理窗口

### 📝 报告导出
- **Markdown** - 详细分析报告
- **JSON** - 结构化数据导出
- **CSV** - 多文件数据导出

## 安装

```bash
npm install
npm link  # 全局安装
```

## 快速开始

### 1. 生成示例数据
```bash
# 生成好样例和坏样例数据
memory-analyzer generate-seed

# 仅生成好样例
memory-analyzer generate-seed --type good

# 仅生成坏样例
memory-analyzer generate-seed --type bad
```

### 2. 运行分析
```bash
# 使用坏样例数据分析（会检测到多个问题）
memory-analyzer analyze \
  --gc-log ./seed-data/bad/trace-gc.log \
  --heap-summary ./seed-data/bad/heap-summary.json \
  --retainer-paths ./seed-data/bad/retainer-paths.json \
  --endpoint-traffic ./seed-data/bad/endpoint-traffic.csv \
  --config ./seed-data/bad/config.json \
  --output ./analysis-results \
  --format markdown

# 使用好样例数据分析（无问题或少量警告）
memory-analyzer analyze \
  --gc-log ./seed-data/good/trace-gc.log \
  --heap-summary ./seed-data/good/heap-summary.json \
  --retainer-paths ./seed-data/good/retainer-paths.json \
  --endpoint-traffic ./seed-data/good/endpoint-traffic.csv \
  --config ./seed-data/good/config.json \
  --output ./analysis-results-good \
  --format markdown
```

### 3. 运行参数模拟
```bash
memory-analyzer simulate \
  --config ./seed-data/bad/config.json \
  --gc-log ./seed-data/bad/trace-gc.log
```

### 4. 查看报告
```bash
# Markdown 报告
cat ./analysis-results/report.md

# JSON 报告
cat ./analysis-results/report.json

# CSV 报告
ls ./analysis-results/csv/
```

## 命令详解

### analyze 命令
分析内存数据并生成报告。

**选项:**
| 选项 | 描述 |
|------|------|
| `--gc-log <path>` | GC 日志文件路径 |
| `--heap-summary <path>` | Heap 摘要文件路径 |
| `--retainer-paths <path>` | Retainer 路径文件路径 |
| `--endpoint-traffic <path>` | 接口流量文件路径 |
| `--config <path>` | 配置文件路径 |
| `--output <path>` | 输出目录路径 |
| `--format <format>` | 输出格式: markdown, json, csv (默认: markdown) |
| `--verbose` | 显示详细信息 |

### simulate 命令
模拟参数调整效果。

**选项:**
| 选项 | 描述 |
|------|------|
| `--config <path>` | 基础配置文件路径 |
| `--gc-log <path>` | GC 日志文件路径（用于校准） |

### generate-seed 命令
生成示例数据（包含好/坏样例）。

**选项:**
| 选项 | 描述 |
|------|------|
| `--output <path>` | 输出目录 (默认: ./seed-data) |
| `--type <type>` | 数据类型: all, good, bad (默认: all) |

## 数据格式说明

### GC 日志格式 (trace-gc.log)
```
[12345] 123.456: [GC (Scavenge) 65536K->24576K(524288K), 0.005 secs]
[12345] 123.456:   [Scavenge: 40960K]
[12345] 123.456:   Young generation: 52428K->19660K(131072K)
[12345] 123.456:   Promoted 2048K
[12345] 123.456:   Survival rate: 45.0%
```

### Heap 摘要格式 (heap-summary.json)
```json
{
  "summary": {
    "totalHeapSize": 536870912,
    "usedHeapSize": 188743680,
    "heapSizeLimit": 536870912
  },
  "spaces": [
    { "name": "old_space", "size": 419430400, "used_size": 125829120, "usagePercent": 30 }
  ],
  "nodes": [
    { "type": "string", "self_size": 31457280, "count": 15000 }
  ]
}
```

### Retainer 路径格式 (retainer-paths.json)
```json
{
  "totalPaths": 100,
  "suspiciousPaths": [
    {
      "pathString": "global -> eventListeners[\"click\"] -> Element",
      "matchedPatterns": [
        { "name": "事件监听器", "severity": "critical" }
      ]
    }
  ]
}
```

### 接口流量格式 (endpoint-traffic.csv)
```csv
timestamp,endpoint,method,status,latency,memory_before,memory_after,heap_used,rss
2024-01-01T00:00:00.000Z,/api/users,GET,200,45.23,180.50MB,178.30MB,144.40MB,270.75MB
```

### 配置文件格式 (config.json)
```json
{
  "v8Flags": {
    "parsed": {
      "maxOldSpaceSize": 512,
      "semiSpaceSize": 32
    }
  },
  "caches": [
    { "name": "userCache", "maxSize": 10000, "ttl": 300, "currentSize": 4500 }
  ],
  "objectPools": [
    { "name": "connectionPool", "maxSize": 50, "idleTimeout": 60000 }
  ]
}
```

## 坏样例包含的问题

生成的 `bad` 样例包含以下典型内存问题：

| 问题类型 | 描述 | 检测位置 |
|----------|------|----------|
| **老年代持续增长** | Major GC 后老年代使用量持续上升 | GC 日志 |
| **Major GC 回收不足** | 回收率 < 30% | GC 日志 |
| **对象晋升过快** | 存活率 > 60%，晋升量高 | GC 日志 |
| **事件监听器泄漏** | 全局事件监听器未移除 | Retainer 路径 |
| **闭包/定时器引用** | 定时器回调持有大数据 | Retainer 路径 |
| **Buffer 积累** | 大量 Buffer 对象 (>1000 个) | Heap 摘要 |
| **大对象** | 多个 > 10MB 的 ArrayBuffer | Heap 摘要 |
| **无界缓存** | 无 maxSize、无 TTL | 配置 |
| **无界对象池** | 无 maxSize、无 idleTimeout | 配置 |
| **无界批处理** | 无 maxPending、无 flushInterval | 配置 |
| **WeakRef 误用** | 持有强引用，未检查 deref | 配置 |
| **FinalizationRegistry 误用** | 未使用 unregister | 配置 |

## 运行测试

```bash
npm test
```

## 项目结构

```
.
├── src/
│   ├── cli.js                 # CLI 入口
│   ├── parsers/               # 数据解析器
│   │   ├── gc-parser.js       # GC 日志解析
│   │   ├── heap-parser.js     # Heap 摘要解析
│   │   ├── retainer-parser.js # Retainer 路径解析
│   │   ├── traffic-parser.js  # 流量 CSV 解析
│   │   └── config-parser.js   # 配置解析
│   ├── detectors/
│   │   └── detector.js        # 问题检测器
│   ├── simulator/
│   │   └── simulator.js       # 参数模拟器
│   ├── reporters/
│   │   └── reporter.js        # 报告生成器
│   └── utils/
│       └── seed-generator.js  # 样例数据生成器
├── tests/                      # 测试文件
├── package.json
└── README.md
```

## 检测阈值配置

以下是默认检测阈值，可根据实际需求调整：

| 检测项 | 阈值 | 说明 |
|--------|------|------|
| 老年代增长 | > 50MB | 连续 3 个采样点 |
| Major GC 回收率 | < 30% | 回收效率过低 |
| 对象存活率 | > 60% | 晋升风险高 |
| Buffer 总数 | > 1000 | 可能泄漏 |
| Buffer 总大小 | > 50MB | 内存压力 |
| 大对象 | > 10MB | 单个对象过大 |
| 空闲对象比例 | > 70% | 对象池浪费 |
| 可疑引用路径 | 匹配模式 | 泄漏模式 |

## 许可证

MIT
