# 环境变量检查报告

**生成时间**: 5/2/2026, 11:56:46 PM
**项目目录**: /Users/lzy/pro/solocoder/pro/zy1025/repo/zy1025/examples/sample-project

## 📊 概要

| 指标 | 数值 |
|------|------|
| 扫描文件数 | 6 |
| 发现变量数 | 21 |
| 发现问题数 | 10 |

**⚠️ 存在需要关注的问题**

### 问题分布

| 严重程度 | 数量 |
|----------|------|
| 🔴 严重 | 2 |
| 🟡 中等 | 4 |
| 🔵 轻微 | 4 |

## 🔍 发现的问题

### 🔴 严重 (2个)

#### Example 中缺失

**DB_PASSWORD**
> 变量 DB_PASSWORD 在代码/脚本中使用，但 .env.example 中缺失
> 来源: .env.local, README.md, docker-compose.yml

**API_KEY**
> 变量 API_KEY 在代码/脚本中使用，但 .env.example 中缺失
> 来源: .env.local, README.md, docker-compose.yml

### 🟡 中等 (4个)

#### 值冲突

**DB_HOST**
> 变量 DB_HOST 在不同文件中的默认值不一致
> 值冲突:
> - .env.example: localhost
> - .env.local: db.example.internal

**DB_PORT**
> 变量 DB_PORT 在不同文件中的默认值不一致
> 值冲突:
> - .env.example: 5432
> - .env.local: 5433

#### Local 中多余

**DB_PASSWORD**
> 变量 DB_PASSWORD 在 .env.local 中存在，但 .env.example 中未声明

**API_KEY**
> 变量 API_KEY 在 .env.local 中存在，但 .env.example 中未声明

### 🔵 轻微 (4个)

#### 潜在密钥

**API_BASE_URL**
> 变量 API_BASE_URL 看起来可能包含敏感信息
> 来源: .env.example, README.md, docker-compose.yml, package.json

**DB_PASSWORD**
> 变量 DB_PASSWORD 看起来可能包含敏感信息
> 来源: .env.local, README.md, docker-compose.yml

**API_KEY**
> 变量 API_KEY 看起来可能包含敏感信息
> 来源: .env.local, README.md, docker-compose.yml

**USER_EMAIL**
> 变量 USER_EMAIL 看起来可能包含敏感信息
> 来源: .env.local

## 📋 变量清单

### 所有变量

| 变量名 | 来源 | 发现位置 |
|--------|------|----------|
| API | README.md | markdown |
| API_BASE_URL | .env.example, README.md, docker-compose.yml, package.json | env_file, markdown, docker_compose, package_json |
| API_KEY | .env.local, README.md, docker-compose.yml | env_file, markdown, docker_compose |
| API_TIMEOUT | .env.example | env_file |
| BUILD_ENV | README.md, package.json | markdown, package_json |
| DB_HOST | .env.example, .env.local, README.md, docker-compose.yml, package.json | env_file, markdown, docker_compose, package_json |
| DB_NAME | .env.example, README.md, docker-compose.yml | env_file, markdown, docker_compose |
| DB_PASSWORD | .env.local, README.md, docker-compose.yml | env_file, markdown, docker_compose |
| DB_PORT | .env.example, .env.local, README.md, docker-compose.yml, package.json | env_file, markdown, docker_compose, package_json |
| DB_USER | .env.example, README.md, docker-compose.yml | env_file, markdown, docker_compose |
| DEBUG | README.md | markdown |
| DEV_TOOLS | .env.local | env_file |
| HOT_RELOAD | .env.local | env_file |
| LOG_LEVEL | README.md | markdown |
| NODE_ENV | .env.example, README.md, docker-compose.yml, package.json | env_file, markdown, docker_compose, package_json |
| PORT | .env.example, README.md, package.json | env_file, markdown, package_json |
| POSTGRES_DB | docker-compose.yml | docker_compose |
| POSTGRES_PASSWORD | docker-compose.yml | docker_compose |
| POSTGRES_USER | docker-compose.yml | docker_compose |
| REDIS_URL | README.md, docker-compose.yml | markdown, docker_compose |
| USER_EMAIL | .env.local | env_file |

### 按来源分类

#### 📝 .env.example 中的变量

| 变量名 | 默认值 |
|--------|--------|
| DB_HOST | localhost |
| DB_PORT | 5432 |
| DB_NAME | myapp |
| DB_USER | postgres |
| API_BASE_URL | https://api.example.com |
| API_TIMEOUT | 30000 |
| NODE_ENV | development |
| PORT | 3000 |

#### 🏠 .env.local 中的变量

| 变量名 | 值 |
|--------|-----|
| DB_PASSWORD | [REDACTED] |
| DB_HOST | db.example.internal |
| DB_PORT | 5433 |
| API_KEY | [REDACTED] |
| DEV_TOOLS | true |
| HOT_RELOAD | true |
| USER_EMAIL | developer@example.com |

#### 🐳 Docker Compose 中的变量

| 变量名 | 服务 |
|--------|------|
| NODE_ENV | web |
| API_BASE_URL | web |
| DB_HOST | web |
| DB_PORT | web |
| DB_NAME | web |
| DB_USER | web |
| DB_PASSWORD | web |
| API_KEY | web |
| REDIS_URL | web |
| POSTGRES_DB | db |
| POSTGRES_USER | db |
| POSTGRES_PASSWORD | db |

#### 📦 package.json 脚本中的变量

| 变量名 | 脚本 |
|--------|------|
| NODE_ENV | start, dev, test |
| PORT | dev |
| API_BASE_URL | test |
| BUILD_ENV | build |
| DB_HOST | migrate |
| DB_PORT | migrate |

#### 📖 Markdown 文档中的变量

| 变量名 |
|--------|
| DB_HOST |
| DB_PORT |
| DB_NAME |
| DB_USER |
| DB_PASSWORD |
| API |
| API_BASE_URL |
| API_KEY |
| NODE_ENV |
| PORT |
| DEBUG |
| LOG_LEVEL |
| REDIS_URL |
| BUILD_ENV |

## ⚙️ 配置的可选变量

- DEBUG
- LOG_LEVEL
- API
- REDIS_URL
- BUILD_ENV
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD

## 🏠 配置的本地专用变量

- DEV_TOOLS
- HOT_RELOAD
- USER_EMAIL

---

*报告由 env-checker 工具生成*