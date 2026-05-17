# JSON 配置差异分析报告

生成时间: 2026/5/17 22:42:18


## 比较: defaults → development

| 统计项 | 数量 |
|--------|------|
| 总计差异 | 10 |
| 修改字段 | 1 |
| 新增字段 | 5 |
| 删除字段 | 4 |
| 数组变更 | 0 |
| 敏感字段 | 0 |
| 默认值匹配 | 0 |

### 详细差异

| 类型 | 路径 | 详情 | 备注 |
|------|------|------|------|
| 修改 | `debug` | `false` → `true` | 默认值应为: `false` |
| 删除 | `database.port` | `5432` | 📋 默认值 |
| 删除 | `database.ssl` | `false` | 📋 默认值 |
| 删除 | `redis.port` | `6379` | 📋 默认值 |
| 删除 | `rateLimit.windowMs` | `60000` | 📋 默认值 |
| 新增 | `appName` | `"my-app"` | - |
| 新增 | `database` | `{"host":"localhost","port":5432,"username":"dev_user","password":"dev_secret_123","database":"dev_db"}` | - |
| 新增 | `features` | `["auth","logging","metrics"]` | - |
| 新增 | `rateLimit` | `{"max":1000,"windowMs":60000}` | - |
| 新增 | `redis` | `{"host":"localhost","port":6379}` | - |

## 比较: defaults → production

| 统计项 | 数量 |
|--------|------|
| 总计差异 | 10 |
| 修改字段 | 1 |
| 新增字段 | 5 |
| 删除字段 | 4 |
| 数组变更 | 0 |
| 敏感字段 | 0 |
| 默认值匹配 | 0 |

### 详细差异

| 类型 | 路径 | 详情 | 备注 |
|------|------|------|------|
| 修改 | `port` | `3000` → `8080` | 默认值应为: `3000` |
| 删除 | `database.port` | `5432` | 📋 默认值 |
| 删除 | `database.ssl` | `false` | 📋 默认值 |
| 删除 | `redis.port` | `6379` | 📋 默认值 |
| 删除 | `rateLimit.windowMs` | `60000` | 📋 默认值 |
| 新增 | `appName` | `"my-app"` | - |
| 新增 | `database` | `{"host":"prod-db.example.com","port":5432,"username":"prod_user","password":"prod_secret_789","database":"prod_db","ssl":true,"poolSize":20}` | - |
| 新增 | `features` | `["auth","logging","metrics","cache","cdn"]` | - |
| 新增 | `rateLimit` | `{"max":100,"windowMs":60000}` | - |
| 新增 | `redis` | `{"host":"prod-redis.example.com","port":6379,"password":"redis_prod_secret","cluster":true}` | - |

## 比较: defaults → staging

| 统计项 | 数量 |
|--------|------|
| 总计差异 | 9 |
| 修改字段 | 0 |
| 新增字段 | 5 |
| 删除字段 | 4 |
| 数组变更 | 0 |
| 敏感字段 | 0 |
| 默认值匹配 | 0 |

### 详细差异

| 类型 | 路径 | 详情 | 备注 |
|------|------|------|------|
| 删除 | `database.port` | `5432` | 📋 默认值 |
| 删除 | `database.ssl` | `false` | 📋 默认值 |
| 删除 | `redis.port` | `6379` | 📋 默认值 |
| 删除 | `rateLimit.windowMs` | `60000` | 📋 默认值 |
| 新增 | `appName` | `"my-app"` | - |
| 新增 | `database` | `{"host":"staging-db.example.com","port":5432,"username":"staging_user","password":"stg_secret_456","database":"staging_db","ssl":true}` | - |
| 新增 | `features` | `["auth","logging","metrics","cache"]` | - |
| 新增 | `rateLimit` | `{"max":500,"windowMs":60000}` | - |
| 新增 | `redis` | `{"host":"staging-redis.example.com","port":6379,"password":"redis_stg_secret"}` | - |

---
*此报告由 json-config-diff 工具自动生成*