# 环境变量覆盖链影子值定位排查报告

## 概览

- 扫描路径: `/Users/lzy/pro/solo/workspaces/zy70761/testdata`
- 解析文件数: 4
- 发现变量数: 17
- 有覆盖变量: 7
- 缺失提示变量: 0

## 变量详情

### ✅ API_KEY

- **最终值**: `shell-api-key-12345`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/start.sh:13`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | shell | 40 | `start.sh:13` | `shell-api-key-12345` |

### ⚠️ APP_DEBUG

- **最终值**: `true`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/.env.local:3`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:4` | `false` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:3` | `true` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `false` | `true` | `.env:4` | `.env.local:3` |

### ⚠️ APP_ENV

- **最终值**: `compose`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:8`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:3` | `production` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:2` | `development` |
| 3 | ⊕ 激活 | shell | 40 | `start.sh:4` | `staging` |
| 4 | ⊕ 激活 | compose | 50 | `docker-compose.yml:8` | `compose` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `production` | `development` | `.env:3` | `.env.local:2` |
| 2 | `development` | `staging` | `.env.local:2` | `start.sh:4` |
| 3 | `staging` | `compose` | `start.sh:4` | `docker-compose.yml:8` |

### ⚠️ APP_NAME

- **最终值**: `Docker Compose App`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:7`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:2` | `MyApplication` |
| 2 | ⊕ 激活 | shell | 40 | `start.sh:5` | `Shell Override App` |
| 3 | ⊕ 激活 | compose | 50 | `docker-compose.yml:7` | `Docker Compose App` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `MyApplication` | `Shell Override App` | `.env:2` | `start.sh:5` |
| 2 | `Shell Override App` | `Docker Compose App` | `start.sh:5` | `docker-compose.yml:7` |

### ⚠️ APP_URL

- **最终值**: `http://localhost:8080`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/.env.local:4`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:5` | `https://example.com` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:4` | `http://localhost:8080` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `https://example.com` | `http://localhost:...` | `.env:5` | `.env.local:4` |

### ⚠️ DB_HOST

- **最终值**: `compose-db`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:20`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:8` | `localhost` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:7` | `127.0.0.1` |
| 3 | ⊕ 激活 | shell | 40 | `start.sh:9` | `shell-host` |
| 4 | ⊕ 激活 | compose | 50 | `docker-compose.yml:20` | `compose-db` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `localhost` | `127.0.0.1` | `.env:8` | `.env.local:7` |
| 2 | `127.0.0.1` | `shell-host` | `.env.local:7` | `start.sh:9` |
| 3 | `shell-host` | `compose-db` | `start.sh:9` | `docker-compose.yml:20` |

### ⚠️ DB_NAME

- **最终值**: `local_db`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/.env.local:9`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:10` | `app_db` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:9` | `local_db` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `app_db` | `local_db` | `.env:10` | `.env.local:9` |

### ✅ DB_PASS

- **最终值**: `localpass`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/.env.local:10`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊗ 注释 | env | 20 | `.env:12` | `secret123` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:10` | `localpass` |

### ⚠️ DB_PORT

- **最终值**: `3306`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:21`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:9` | `3306` |
| 2 | ⊕ 激活 | env | 30 | `.env.local:8` | `3307` |
| 3 | ⊕ 激活 | shell | 40 | `start.sh:10` | `5432` |
| 4 | ⊕ 激活 | compose | 50 | `docker-compose.yml:21` | `3306` |

#### 覆盖链

| # | 旧值 | 新值 | 旧来源 | 新来源 |
|---|------|------|--------|--------|
| 1 | `3306` | `3307` | `.env:9` | `.env.local:8` |
| 2 | `3307` | `5432` | `.env.local:8` | `start.sh:10` |
| 3 | `5432` | `3306` | `start.sh:10` | `docker-compose.yml:21` |

### ✅ DB_USER

- **最终值**: `root`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/.env:11`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | env | 20 | `.env:11` | `root` |

### ✅ LOG_LEVEL

- **最终值**: `info`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/start.sh:6`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | shell | 40 | `start.sh:6` | `info` |

### ✅ MYSQL_DATABASE

- **最终值**: `compose_db`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:18`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | compose | 50 | `docker-compose.yml:18` | `compose_db` |

### ✅ MYSQL_ROOT_PASSWORD

- **最终值**: `compose-pass`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:17`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | compose | 50 | `docker-compose.yml:17` | `compose-pass` |

### ✅ MYSQL_USER

- **最终值**: `compose_user`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:19`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | compose | 50 | `docker-compose.yml:19` | `compose_user` |

### ✅ NGINX_HOST

- **最终值**: `localhost`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:9`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | compose | 50 | `docker-compose.yml:9` | `localhost` |

### ✅ NGINX_PORT

- **最终值**: `80`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/docker-compose.yml:10`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | compose | 50 | `docker-compose.yml:10` | `80` |

### ✅ SECRET_KEY

- **最终值**: `shell-secret-67890`
- **生效来源**: `/Users/lzy/pro/solo/workspaces/zy70761/testdata/start.sh:14`

#### 所有定义

| # | 状态 | 来源 | 层级 | 位置 | 值 |
|---|------|------|------|------|----|
| 1 | ⊕ 激活 | shell | 40 | `start.sh:14` | `shell-secret-67890` |
