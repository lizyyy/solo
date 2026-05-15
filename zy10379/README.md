# 服务令牌交换 API (Service Token Exchange)

一个完整的服务令牌交换系统，提供令牌交换、范围收缩、过期控制、使用审计、撤销处理等核心功能。采用 Java Spring Boot 单体架构设计。

## 🌟 核心功能

| 功能 | 描述 |
|------|------|
| 🔄 **令牌交换** | 将用户令牌交换为特定服务的短期令牌 |
| 🎯 **范围收缩** | 细粒度权限控制，支持按需缩小权限范围 |
| ⏰ **过期控制** | 灵活的有效期设置，支持分钟级精度 |
| 📝 **使用审计** | 完整的操作记录，追踪令牌每次使用 |
| 🚫 **撤销处理** | 即时令牌失效机制，支持主动撤销 |
| ♻️ **幂等保证** | 基于 requestId 的幂等处理，防止重复提交 |
| 📊 **时间线记录** | 每个关键动作都留下完整的时间线轨迹 |
| 🔍 **问题排查汇总** | 多维度诊断报告，快速定位问题 |

## 🏗️ 数据模型

| 实体 | 描述 |
|------|------|
| **UserToken** | 用户令牌 - 长期有效的用户身份凭证 |
| **ShortToken** | 短期令牌 - 交换生成的短期服务访问凭证 |
| **ServiceIdentity** | 服务身份 - 服务身份信息与权限范围 |
| **ExchangeScenario** | 交换场景 - 预定义的令牌交换规则 |
| **UsageRecord** | 使用记录 - 完整的操作审计记录 |
| **TimelineEvent** | 时间线事件 - 关键动作时间线追踪 |
| **IdempotentRequest** | 幂等请求 - 防止重复提交的记录 |

## 🚀 快速开始

### 环境要求
- JDK 8+
- Maven 3.6+ (可选)

### 启动方式

#### 方式 1: 使用启动脚本（推荐）
```bash
# 进入项目目录
cd /path/to/project

# 运行启动脚本，会自动检测环境并提供多种运行方式
chmod +x start.sh
./start.sh
```

#### 方式 2: 使用 Maven
```bash
# 直接使用全局 Maven
mvn clean spring-boot:run

# 或使用 Maven wrapper（如果已安装 Maven）
./mvnw clean spring-boot:run
```

#### 方式 3: 使用 IDE（无需 Maven）
详细步骤请参考: `IDE_QUICKSTART.md`

1. 用 IntelliJ IDEA / Eclipse / VS Code 打开项目
2. 作为 Maven 项目导入（IDE 会自动处理）
3. 找到 `TokenExchangeApplication.java` 右键运行

> 💡 IDE 会自动下载所有依赖，无需手动安装 Maven，即使没有 Maven 也能运行！

### 访问地址

服务启动后访问：
- **管理首页**: http://localhost:8080
- **H2 数据库控制台**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:tokendb`
  - 用户名: `sa`
  - 密码: (空)

### 初始化测试数据

系统启动时会自动初始化测试数据：
- 4 个服务身份（认证服务、用户服务、订单服务、支付服务）
- 2 个交换场景（用户访问订单、订单访问支付）
- 2 个测试用户令牌

## 🔗 API 端点

### 🔐 令牌管理（核心功能）

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/token/exchange` | 令牌交换 - 用户令牌交换为短期令牌 |
| POST | `/api/token/validate` | 令牌验证 - 校验令牌有效性 |
| POST | `/api/token/revoke` | 令牌撤销 - 立即使令牌失效 |

### ⚙️ 管理 API（完整 CRUD）

#### 用户令牌管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/admin/user-tokens` | 创建用户令牌 |
| GET | `/api/admin/user-tokens` | 查询所有用户令牌 |
| GET | `/api/admin/user-tokens/{id}` | 查询指定用户令牌 |
| GET | `/api/admin/user-tokens/user/{userId}` | 查询用户的所有令牌 |
| PUT | `/api/admin/user-tokens/{id}` | 更新用户令牌 |
| DELETE | `/api/admin/user-tokens/{id}` | 删除用户令牌 |

#### 服务身份管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/admin/services` | 创建服务身份 |
| GET | `/api/admin/services` | 查询所有服务身份 |
| GET | `/api/admin/services/{serviceId}` | 查询指定服务 |
| PUT | `/api/admin/services/{serviceId}` | 更新服务身份 |
| DELETE | `/api/admin/services/{serviceId}` | 删除服务身份 |

#### 交换场景管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/admin/scenarios` | 创建交换场景 |
| GET | `/api/admin/scenarios` | 查询所有交换场景 |
| GET | `/api/admin/scenarios/{scenarioCode}` | 查询指定场景 |
| PUT | `/api/admin/scenarios/{scenarioCode}` | 更新交换场景 |
| DELETE | `/api/admin/scenarios/{scenarioCode}` | 删除交换场景 |

#### 短期令牌查询
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/admin/short-tokens` | 查询所有短期令牌 |
| GET | `/api/admin/short-tokens/{id}` | 查询指定短期令牌 |
| GET | `/api/admin/short-tokens/user/{userId}` | 查询用户的短期令牌 |
| GET | `/api/admin/short-tokens/service/{source}/{target}` | 查询服务间的短期令牌 |

### 📊 查询与审计

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/token/timeline/{entityId}` | 查询实体时间线 |
| GET | `/api/token/timeline?start=&end=` | 按时间范围查询事件 |
| GET | `/api/token/usage/token/{tokenValue}` | 查询令牌使用记录 |
| GET | `/api/token/usage/user/{userId}` | 查询用户使用记录 |
| GET | `/api/token/usage/service/{serviceId}` | 查询服务使用记录 |

### 🔍 诊断报告

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/token/diagnostic/token/{tokenValue}` | 令牌完整诊断报告 |
| GET | `/api/token/diagnostic/user/{userId}` | 用户完整活动报告 |
| GET | `/api/token/diagnostic/summary` | 系统整体运行汇总 |

## 📝 API 使用示例

### 1. 创建服务身份
```bash
curl -X POST http://localhost:8080/api/admin/services \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "service-demo",
    "serviceName": "演示服务",
    "description": "用于演示的服务",
    "allowedScopes": "read,write"
  }'
```

### 2. 创建交换场景
```bash
curl -X POST http://localhost:8080/api/admin/scenarios \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioCode": "DEMO_SCENARIO",
    "scenarioName": "演示场景",
    "description": "令牌交换演示场景",
    "sourceServiceId": "service-user",
    "targetServiceId": "service-demo",
    "allowedScopes": "read",
    "defaultExpireMinutes": 15
  }'
```

### 3. 创建用户令牌
```bash
curl -X POST http://localhost:8080/api/admin/user-tokens \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "scopes": "read,write,admin",
    "expireDays": 30
  }'
```

### 4. 令牌交换（核心功能）
```bash
# 先获取用户令牌值（从步骤 3 返回结果中获取）
USER_TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:8080/api/token/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "userToken": "'"$USER_TOKEN"'",
    "sourceServiceId": "service-user",
    "targetServiceId": "service-demo",
    "scenarioCode": "DEMO_SCENARIO",
    "requestedScopes": "read",
    "expireMinutes": 15,
    "maxUseCount": 5,
    "requestId": "req-001"
  }'
```

### 5. 令牌验证
```bash
# 获取短期令牌值（从步骤 4 返回结果中获取）
SHORT_TOKEN="eyJhbGciOiJIUzI1NiIs..."

curl -X POST http://localhost:8080/api/token/validate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$SHORT_TOKEN"'",
    "serviceId": "service-demo",
    "requiredScope": "read",
    "requestId": "req-002"
  }'
```

### 6. 令牌撤销
```bash
curl -X POST http://localhost:8080/api/token/revoke \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$SHORT_TOKEN"'",
    "reason": "用户主动注销",
    "operatorId": "admin-001",
    "requestId": "req-003"
  }'
```

### 7. 查询诊断报告
```bash
# 令牌诊断报告
curl http://localhost:8080/api/token/diagnostic/token/$SHORT_TOKEN

# 用户诊断报告
curl http://localhost:8080/api/token/diagnostic/user/user-001

# 系统汇总报告
curl http://localhost:8080/api/token/diagnostic/summary
```

## 🔐 核心规则

### 令牌交换流程

```
用户令牌(UserToken) 
      ↓
[有效性验证] → [服务身份验证] → [场景匹配]
      ↓
[范围收缩计算] → [有效期设置] → [使用次数限制]
      ↓
生成短期令牌(ShortToken)
      ↓
记录时间线(TimelineEvent) + 审计记录(UsageRecord)
```

### 权限范围计算

最终授予的权限 = 原令牌权限 ∩ 请求权限 ∩ 源服务权限 ∩ 目标服务权限 ∩ 场景权限

### 短期令牌有效性判断

短期令牌同时满足以下条件才有效：
- ✅ 未被撤销 (revoked = false)
- ✅ 未过期 (expiresAt > now)
- ✅ 使用次数未耗尽 (useCount < maxUseCount)

## 📊 时间线事件类型

系统会记录以下关键事件：

| 事件类型 | 描述 |
|----------|------|
| `TOKEN_ISSUED` | 令牌签发 |
| `TOKEN_EXCHANGED` | 令牌交换 |
| `TOKEN_VALIDATED` | 令牌验证成功 |
| `TOKEN_VALIDATION_FAILED` | 令牌验证失败 |
| `TOKEN_USED` | 令牌使用 |
| `TOKEN_REVOKED` | 令牌撤销 |

## 🛠️ 项目结构

```
service-token-exchange/
├── src/main/java/com/tokenexchange/
│   ├── TokenExchangeApplication.java    # 应用启动类
│   ├── config/
│   │   └── DataInitializer.java         # 测试数据初始化
│   ├── entity/                          # 数据实体
│   │   ├── UserToken.java
│   │   ├── ShortToken.java
│   │   ├── ServiceIdentity.java
│   │   ├── ExchangeScenario.java
│   │   ├── UsageRecord.java
│   │   ├── TimelineEvent.java
│   │   └── IdempotentRequest.java
│   ├── repository/                      # 数据访问层
│   ├── dto/                             # 数据传输对象
│   ├── exception/                       # 异常处理
│   ├── service/                         # 业务逻辑层
│   │   ├── TokenExchangeService.java    # 令牌交换核心服务
│   │   ├── TimelineService.java         # 时间线服务
│   │   ├── UsageRecordService.java      # 使用记录服务
│   │   ├── IdempotencyService.java      # 幂等服务
│   │   └── DiagnosticService.java       # 诊断报告服务
│   └── controller/
│       ├── TokenExchangeController.java # 令牌 API 控制器
│       └── AdminController.java         # 管理 API 控制器
├── src/main/resources/
│   ├── application.yml                   # 应用配置
│   └── static/
│       └── index.html                    # 管理首页
├── mvnw                                  # Maven wrapper (Unix)
├── mvnw.cmd                              # Maven wrapper (Windows)
├── start.sh                              # 一键启动脚本
└── pom.xml                               # Maven 配置
```

## 📋 配置说明

`application.yml` 关键配置项：

```yaml
token:
  exchange:
    jwt-secret: service-token-exchange-secret-key-2024  # JWT 签名密钥
    default-short-token-expire-minutes: 15               # 默认短期令牌有效期
    max-short-token-expire-minutes: 60                   # 最大短期令牌有效期
```

## 🔍 问题排查

当遇到问题时，可以通过以下方式排查：

1. **查看令牌诊断报告**: `GET /api/token/diagnostic/token/{tokenValue}`
   - 令牌基本信息
   - 状态检查（是否过期、撤销、耗尽）
   - 完整时间线事件
   - 所有使用记录
   - 成功率统计

2. **查看用户诊断报告**: `GET /api/token/diagnostic/user/{userId}`
   - 用户所有令牌统计
   - 指定时间段使用记录
   - 按操作类型和服务分类统计
   - 最近失败记录
   - 完整事件时间线

3. **查看系统汇总报告**: `GET /api/token/diagnostic/summary`
   - 系统整体运行状态
   - 各服务使用情况
   - 活跃用户排行
   - 24小时成功率统计

## 📄 License

MIT License
