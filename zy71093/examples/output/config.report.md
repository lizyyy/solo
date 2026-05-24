# YAML Anchor 展开报告

- **输入文件**: examples/config.yaml
- **生成时间**: 2026-05-24T13:08:21.318Z
- **工具版本**: 1.0.0

## 摘要

| 项目 | 数量 | 状态 |
|------|------|------|
| Anchor 定义 | 0 | - |
| Alias 引用 | 0 | - |
| Merge Key | 0 | - |
| 环境覆盖 | 6 | ✅ |
| 警告 | 0 | ✅ |
| 错误 | 0 | ✅ |
| 循环引用 | 否 | ✅ |

## 覆盖链详情

| 序号 | 路径 | 来源文件 | 原值 | 新值 |
|------|------|----------|------|------|
| 0 | production.host | examples/prod-override.yaml | `"prod.example.com"` | `"prod-primary.example.com"` |
| 0 | production.pool.min | examples/prod-override.yaml | `2` | `10` |
| 0 | production.pool.max | examples/prod-override.yaml | `10` | `50` |
| 0 | production.timeout | examples/prod-override.yaml | `60000` | `120000` |
| 0 | features.caching | examples/prod-override.yaml | `false` | `true` |
| 0 | features.rate_limit | examples/prod-override.yaml | `1000` | `5000` |

## 展开后的 YAML

```yaml
defaults:
  adapter: postgres
  host: localhost
  port: 5432
  pool:
    min: 2
    max: 10
  timeout: 30000
logging:
  level: info
  format: json
  timestamp: true
development:
  adapter: postgres
  host: localhost
  port: 5432
  pool:
    min: 2
    max: 10
  timeout: 30000
  database: app_dev
  logging:
    level: debug
    format: json
    timestamp: true
test:
  adapter: postgres
  host: localhost
  port: 5432
  pool:
    min: 1
    max: 5
  timeout: 30000
  database: app_test
production:
  adapter: postgres
  host: prod-primary.example.com
  port: 5432
  pool:
    min: 10
    max: 50
  timeout: 120000
  database: app_prod
  logging:
    level: warn
    format: json
    timestamp: true
features:
  auth: true
  caching: true
  rate_limit: 5000
```

## 差异对比

```diff
Index: yaml
===================================================================
--- yaml	original
+++ yaml	expanded
@@ -33,19 +33,19 @@
   timeout: 30000
   database: app_test
 production:
   adapter: postgres
-  host: prod.example.com
+  host: prod-primary.example.com
   port: 5432
   pool:
-    min: 2
-    max: 10
-  timeout: 60000
+    min: 10
+    max: 50
+  timeout: 120000
   database: app_prod
   logging:
     level: warn
     format: json
     timestamp: true
 features:
   auth: true
-  caching: false
-  rate_limit: 1000
+  caching: true
+  rate_limit: 5000
```
