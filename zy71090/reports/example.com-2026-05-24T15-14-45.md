# Route53 TTL 分析报告 - example.com

**生成时间**: 2026/5/24 23:14:45
**总记录数**: 27
**平均 TTL**: 1h 0m
**最大 TTL**: 1h 0m
**最小 TTL**: 1h 0m

## 摘要

- ⚠️ **需调整记录**: 8 条
- 🔗 **CNAME 链路**: 8 条
- ❓ **缺失记录**: 5 条

## TTL 分级统计

| 级别 | 记录数 | 描述 |
|------|--------|------|
| **LOW** | 27 | 低优先级 - 30分钟-1天 |

## 需调整记录详情

| 域名 | 类型 | 当前 TTL | 推荐 TTL | 原因 |
|------|------|----------|----------|------|
| api.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| app.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| prod-api.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| stg-api.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| dev-api.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| metrics.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| *.staging | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |
| cdn.example.com | CNAME | 1h 0m | 5m 0s | CNAME 记录建议 TTL <= 30 分钟 |

## 环境分布

| 环境 | 记录数 |
|------|--------|
| production | 27 |
| staging | 3 |
| development | 2 |
| testing | 1 |
| monitoring | 2 |

## CNAME 链路分析

### 链路统计

- 总链路数: 8
- 平均深度: 1.1
- 最大深度: 2
- 循环引用: 0 条
- 未解析: 1 条

### 链路详情

#### api.example.com

```
api.example.com
  └── www.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### app.example.com

```
app.example.com
  ├── api.example.com (TTL: 3600s)
  └── www.example.com (TTL: 3600s)
```

- 深度: 2
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### prod-api.example.com

```
prod-api.example.com
  └── prod-www.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### stg-api.example.com

```
stg-api.example.com
  └── stg-www.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### dev-api.example.com

```
dev-api.example.com
  └── dev-www.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### metrics.example.com

```
metrics.example.com
  └── monitor.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### *.staging

```
*.staging
  └── prod-www.example.com (TTL: 3600s)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m

#### cdn.example.com

```
cdn.example.com
  └── example-com.cloudfront.net (TTL: 3600s)
  └── example-com.cloudfront.net (UNRESOLVED)
```

- 深度: 1
- 最大 TTL: 1h 0m
- 平均 TTL: 1h 0m
- ⚠️ 未解析: example-com.cloudfront.net

## 缺失记录

| 环境 | 记录名 | 类型 | 存在于 |
|------|--------|------|--------|
| internal | int-www.example.com | A | production, staging, development, testing |
| monitoring | mon-www.example.com | A | production, staging, development, testing |
| testing | test-api.example.com | CNAME | production, staging, development |
| internal | int-api.example.com | CNAME | production, staging, development |
| monitoring | mon-api.example.com | CNAME | production, staging, development |

## 记录类型分布

| 类型 | 数量 |
|------|------|
| SOA | 1 |
| NS | 2 |
| A | 12 |
| CNAME | 8 |
| MX | 1 |
| TXT | 2 |
| SRV | 1 |

## 附录

### TTL 分级规则

- **LOW**: 1801s - 86400s (低优先级 - 30分钟-1天)