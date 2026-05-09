# 多环境配置漂移巡检报告

**生成时间:** 2026/05/09 21:54:59
**环境数量:** 3

## 📋 巡检环境

- **test**: 测试环境
- **staging**: 预发环境
- **production**: 生产环境

## ⚠️ 风险问题概览

| 严重程度 | 数量 |
|---------|------|
| Critical | 1 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

## 🔴 风险问题详情

| 严重程度 | 规则 | 环境 | 配置项 | 问题描述 |
|---------|------|------|--------|----------|
| 🔴 **CRITICAL** | 生产环境不应有 DEBUG 模式 | production | DEBUG | 环境 "production" 的配置项 "DEBUG" 值为 "true"，但期望为 "false" |

## 📊 环境差异对比

### test vs staging

| 状态 | 配置项 | test | staging |
|------|--------|-----------------|-----------------|
| 🔄 修改 | API_BASE_URL | http://test.api.example.com | http://staging.api.example.com |
| 🔄 修改 | DB_HOST | localhost | staging-db.example.com |
| 🔄 修改 | DB_NAME | myapp_test | myapp_staging |
| 🔄 修改 | DB_PASS | test_password | staging_password_secure |
| 🔄 修改 | DB_USER | test_user | staging_user |
| 🔄 修改 | DEBUG | true | false |
| 🔄 修改 | FEATURE_B_ENABLED | false | true |
| 🔄 修改 | LOG_LEVEL | debug | info |
| 🔄 修改 | REDIS_HOST | localhost | staging-redis.example.com |
| ➕ 新增 | FEATURE_C_ENABLED | (未设置) | true |

### test vs production

| 状态 | 配置项 | test | production |
|------|--------|-----------------|-----------------|
| 🔄 修改 | API_BASE_URL | http://test.api.example.com | https://api.example.com |
| 🔄 修改 | DB_HOST | localhost | prod-db.example.com |
| 🔄 修改 | DB_NAME | myapp_test | myapp_prod |
| 🔄 修改 | DB_PASS | test_password | prod_password_very_secure |
| 🔄 修改 | DB_USER | test_user | prod_user |
| 🔄 修改 | FEATURE_B_ENABLED | false | true |
| 🔄 修改 | LOG_LEVEL | debug | error |
| 🔄 修改 | REDIS_HOST | localhost | prod-redis.example.com |

### staging vs production

| 状态 | 配置项 | staging | production |
|------|--------|-----------------|-----------------|
| 🔄 修改 | API_BASE_URL | http://staging.api.example.com | https://api.example.com |
| 🔄 修改 | DB_HOST | staging-db.example.com | prod-db.example.com |
| 🔄 修改 | DB_NAME | myapp_staging | myapp_prod |
| 🔄 修改 | DB_PASS | staging_password_secure | prod_password_very_secure |
| 🔄 修改 | DB_USER | staging_user | prod_user |
| 🔄 修改 | DEBUG | false | true |
| 🔄 修改 | LOG_LEVEL | info | error |
| 🔄 修改 | REDIS_HOST | staging-redis.example.com | prod-redis.example.com |
| ➖ 删除 | FEATURE_C_ENABLED | true | (未设置) |

## 📜 最近变更历史 (Top 20)

| 时间 | 环境 | 操作 | 配置项 | 变更内容 |
|------|------|------|--------|----------|
| 2026/05/09 21:54:34 | production | ➕ 新增 | DB_HOST | 值: prod-db.example.com |
| 2026/05/09 21:54:34 | production | ➕ 新增 | DB_PORT | 值: 5432 |
| 2026/05/09 21:54:34 | production | ➕ 新增 | DB_NAME | 值: myapp_prod |
| 2026/05/09 21:54:34 | production | ➕ 新增 | DB_USER | 值: prod_user |
| 2026/05/09 21:54:34 | production | ➕ 新增 | DB_PASS | 值: prod_password_very_secure |
| 2026/05/09 21:54:34 | production | ➕ 新增 | API_BASE_URL | 值: https://api.example.com |
| 2026/05/09 21:54:34 | production | ➕ 新增 | AUTH_ENABLED | 值: true |
| 2026/05/09 21:54:34 | production | ➕ 新增 | DEBUG | 值: true |
| 2026/05/09 21:54:34 | production | ➕ 新增 | LOG_LEVEL | 值: error |
| 2026/05/09 21:54:34 | production | ➕ 新增 | REDIS_HOST | 值: prod-redis.example.com |
| 2026/05/09 21:54:34 | production | ➕ 新增 | REDIS_PORT | 值: 6379 |
| 2026/05/09 21:54:34 | production | ➕ 新增 | FEATURE_A_ENABLED | 值: true |
| 2026/05/09 21:54:34 | production | ➕ 新增 | FEATURE_B_ENABLED | 值: true |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | DB_HOST | 值: staging-db.example.com |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | DB_PORT | 值: 5432 |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | DB_NAME | 值: myapp_staging |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | DB_USER | 值: staging_user |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | DB_PASS | 值: staging_password_secure |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | API_BASE_URL | 值: http://staging.api.example.com |
| 2026/05/09 21:54:34 | staging | ➕ 新增 | AUTH_ENABLED | 值: true |
