# Redis Slowlog 归因分析工具

解析 Redis 慢查询日志，提取 Key 模式，统计耗时分布，关联调用方，生成多种格式报告。

## 功能特性

- ✅ **多格式解析**: 支持 Redis RESP 协议、JSON、redis-cli 输出格式
- ✅ **Key模式归并**: 自动识别数字、UUID、哈希等模式并归并统计
- ✅ **耗时分布统计**: 按区间统计慢查询分布
- ✅ **调用方关联**: 基于 IP、客户端名称、命令类型进行调用方分类
- ✅ **多格式报告**: 终端摘要、JSON机器可读、Markdown同事友好报告
- ✅ **错误行保留**: 保留解析失败的原始位置和原因
- ✅ **自检功能**: 内置 `self-test` 命令验证所有功能

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 使用示例数据演示

```bash
redis-slowlog analyze --sample
```

### 2. 分析真实的 slowlog 文件

```bash
redis-slowlog analyze slowlog.txt -o my_report
```

### 3. 生成指定格式报告

```bash
redis-slowlog analyze slowlog.txt -f json
redis-slowlog analyze slowlog.txt -f markdown
```

### 4. 生成示例测试数据

```bash
redis-slowlog generate-sample -o test_slowlog.txt -n 50
```

### 5. 执行自检

```bash
redis-slowlog self-test
```

## 输出文件

报告生成后会产生以下文件：

- `sample_report.json`: 机器可读的 JSON 格式完整数据
- `sample_report.md`: 适合分享给同事的 Markdown 格式报告
- 终端: 实时显示摘要信息

## 项目结构

```
redis_slowlog_attribution/
├── __init__.py      # 包导出
├── parser.py        # 日志解析器
├── pattern.py       # Key模式提取
├── analysis.py      # 分析统计逻辑
├── report.py        # 报告生成器
└── cli.py           # 命令行入口
```

## 使用示例代码

```python
from redis_slowlog_attribution import SlowlogParser, SlowlogAnalyzer, generate_all_reports

# 读取文件
with open('slowlog.txt', 'r') as f:
    content = f.read()

# 解析
parser = SlowlogParser()
result = parser.parse(content)

# 分析
analyzer = SlowlogAnalyzer(result)
analysis_result = analyzer.analyze()

# 生成所有报告
generate_all_reports(analysis_result, 'output')
```

## 支持的 Redis 命令

支持自动提取 Key 的命令包括：
- GET, SET, DEL, EXISTS, INCR, DECR, TTL, TYPE
- HGET, HSET, HDEL, HEXISTS, HINCRBY, HMGET, HMSET, HKEYS, HVALS, HGETALL
- LPUSH, RPUSH, LPOP, RPOP, LLEN, LRANGE
- SADD, SREM, SISMEMBER, SMEMBERS
- ZADD, ZREM, ZRANGE, ZRANK
- EXPIRE, EXPIREAT, PERSIST, RENAME
- KEYS, SCAN 等
