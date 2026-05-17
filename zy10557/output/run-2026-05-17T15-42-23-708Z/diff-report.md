# JSON 配置差异分析报告

生成时间: 2026/5/17 22:42:23


## 比较: dev → staging

| 统计项 | 数量 |
|--------|------|
| 总计差异 | 10 |
| 修改字段 | 7 |
| 新增字段 | 2 |
| 删除字段 | 0 |
| 数组变更 | 1 |
| 敏感字段 | 0 |
| 默认值匹配 | 0 |

### 详细差异

| 类型 | 路径 | 详情 | 备注 |
|------|------|------|------|
| 修改 | `debug` | `true` → `false` | 📋 默认值 |
| 修改 | `database.host` | `"localhost"` → `"staging-db.example.com"` | - |
| 修改 | `database.username` | `"dev_user"` → `"staging_user"` | - |
| 修改 | `database.password` | `dev********23` → `stg********56` | 🔒 敏感 |
| 修改 | `database.database` | `"dev_db"` → `"staging_db"` | - |
| 新增 | `database.ssl` | `true` | 默认值应为: `false` |
| 数组新增 | `features[3]` | `"cache"` | - |
| 修改 | `rateLimit.max` | `1000` → `500` | - |
| 修改 | `redis.host` | `"localhost"` → `"staging-redis.example.com"` | - |
| 新增 | `redis.password` | `redi********ret` | 🔒 敏感 |

## 比较: dev → prod

| 统计项 | 数量 |
|--------|------|
| 总计差异 | 14 |
| 修改字段 | 8 |
| 新增字段 | 4 |
| 删除字段 | 0 |
| 数组变更 | 2 |
| 敏感字段 | 0 |
| 默认值匹配 | 0 |

### 详细差异

| 类型 | 路径 | 详情 | 备注 |
|------|------|------|------|
| 修改 | `debug` | `true` → `false` | 📋 默认值 |
| 修改 | `port` | `3000` → `8080` | 默认值应为: `3000` |
| 修改 | `database.host` | `"localhost"` → `"prod-db.example.com"` | - |
| 修改 | `database.username` | `"dev_user"` → `"prod_user"` | - |
| 修改 | `database.password` | `dev********23` → `pro********789` | 🔒 敏感 |
| 修改 | `database.database` | `"dev_db"` → `"prod_db"` | - |
| 新增 | `database.ssl` | `true` | 默认值应为: `false` |
| 新增 | `database.poolSize` | `20` | - |
| 数组新增 | `features[3]` | `"cache"` | - |
| 数组新增 | `features[4]` | `"cdn"` | - |
| 修改 | `rateLimit.max` | `1000` → `100` | - |
| 修改 | `redis.host` | `"localhost"` → `"prod-redis.example.com"` | - |
| 新增 | `redis.password` | `redi********ret` | 🔒 敏感 |
| 新增 | `redis.cluster` | `true` | - |

---
*此报告由 json-config-diff 工具自动生成*