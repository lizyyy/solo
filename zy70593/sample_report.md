# Redis Slowlog 归因分析报告

---

## 📊 总体统计

| 指标 | 值 |
|------|-----|
| 慢查询总数 | 100 |
| 解析错误数 | 5 |
| 总耗时 | 8.75s |
| 平均耗时 | 87.53ms |
| 最大耗时 | 471.35ms |
| 最小耗时 | 0.74ms |

## ⏱️  耗时分布

| 耗时区间 | 数量 | 占比 |
|----------|------|------|
| 0-1ms | 2 | 2.0% |
| 1-5ms | 4 | 4.0% |
| 5-10ms | 6 | 6.0% |
| 10-50ms | 36 | 36.0% |
| 50-100ms | 30 | 30.0% |
| 100ms-1s | 22 | 22.0% |
| >1s | 0 | 0.0% |

## 🔑 Key模式分析 (Top 10)

| 排名 | 模式 | 次数 | 平均耗时 | 命令 | 示例Key |
|------|------|------|----------|------|---------|
| 1 | `order:*:items` | 17 | 158.20ms | GET,SMEMBERS,KEYS | order:5262:items, order:8218:items, order:1989:items |
| 2 | `session:*-abc` | 16 | 50.10ms | GET,SMEMBERS,DEL | session:8110-abc, session:4839-abc, session:8706-abc |
| 3 | `user:*` | 15 | 126.63ms | SMEMBERS,DEL,SET | user:7385, user:3606, user:302 |
| 4 | `product:*:info` | 15 | 57.04ms | GET,SMEMBERS,DEL | product:2724:info, product:9814:info, product:9085:info |
| 5 | `rate_limit:*.*.*.*` | 10 | 83.45ms | DEL,KEYS,ZRANGE | rate_limit:10.0.10.78, rate_limit:10.0.0.217, rate_limit:10.0.5.172 |
| 6 | `cache:perm:*` | 4 | 63.14ms | DEL,HSET,ZADD | cache:perm:9820, cache:perm:2527, cache:perm:37 |
| 7 | `cache:temp:*` | 3 | 73.95ms | GET,LRANGE,SMEMBERS | cache:temp:9397, cache:temp:7347, cache:temp:6861 |
| 8 | `cache:data:*` | 3 | 28.15ms | ZADD,HGET | cache:data:8439, cache:data:5571, cache:data:5650 |
| 9 | `config:setting_76` | 2 | 255.58ms | KEYS,SET | config:setting_76 |
| 10 | `config:setting_24` | 1 | 129.39ms | HSET | config:setting_24 |

## 📞 调用方统计

| 排名 | 调用方 | 次数 | 平均耗时 | 主要命令 |
|------|--------|------|----------|----------|
| 1 | `unknown` | 63 | 93.89ms | HGET(12), KEYS(8), SMEMBERS(7) |
| 2 | `ip:192.168.1.100` | 12 | 36.59ms | DEL(6), ZRANGE(2), SET(2) |
| 3 | `ip:192.168.1.101` | 10 | 134.35ms | KEYS(2), HGET(2), HSET(1) |
| 4 | `ip:192.168.2.50` | 9 | 75.59ms | ZADD(2), SMEMBERS(2), GET(2) |
| 5 | `ip:10.0.0.25` | 6 | 62.54ms | LRANGE(2), KEYS(1), ZADD(1) |

## ⚡ 最慢查询 (Top 10)

| 排名 | 命令 | Key | 耗时 |
|------|------|-----|------|
| 1 | `KEYS` | `config:setting_76` | 471.35ms |
| 2 | `KEYS` | `user:4115` | 448.96ms |
| 3 | `KEYS` | `order:7287:items` | 441.69ms |
| 4 | `KEYS` | `user:8291` | 381.81ms |
| 5 | `KEYS` | `order:545:items` | 357.61ms |
| 6 | `KEYS` | `rate_limit:10.0.6.104` | 350.68ms |
| 7 | `KEYS` | `order:6978:items` | 339.32ms |
| 8 | `KEYS` | `order:3886:items` | 265.27ms |
| 9 | `KEYS` | `user:4506` | 255.58ms |
| 10 | `KEYS` | `product:4268:info` | 205.48ms |

## ❌ 解析错误

| 行号 | 错误原因 | 原始内容片段 |
|------|----------|--------------|
| 1017 | Expected RESP array | `INVALID LINE FORMAT` |
| 1018 | Protocol parse error: invalid literal for int() with base 10: 'not-a-number' | `*2` |
| 1019 | Expected RESP array | `:not-a-number` |
| 1020 | Expected RESP array | `$5` |
| 1021 | Expected RESP array | `hello` |

---

*报告由 redis-slowlog-attribution 工具自动生成*