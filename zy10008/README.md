# 微服务配置热更新系统

一个高可靠、可观测的配置热更新系统，专注于解决线上配置推送的一致性、可追溯和问题定位问题。

## 核心特性

### 1. 完整的可观测性
- **TraceId 链路追踪**：每个请求分配唯一 TraceId，贯穿整个配置更新生命周期
- **事件日志**：全链路事件记录（创建、更新、发布、推送、重试、回滚）
- **状态持久化**：所有操作状态都保存到数据库，支持事后分析
- **错误回放**：通过 TraceId 或 ReleaseId 完整回放事件序列

### 2. 可靠的推送机制
- **WebSocket 长连接**：实时推送，低延迟
- **真正的 ACK 确认机制**：发送后等待客户端 ACK，超时视为失败，确保推送真正生效
- **ACK 超时处理**：30秒内未收到 ACK 标记为 TIMEOUT 状态
- **ACK 去重与更新**：重复 ACK 不重复更新状态，支持状态回退更新
- **并发推送**：线程池并发处理，支持大量客户端
- **自动重试**：指数退避重试策略，最大 5 次
- **推送状态追踪**：每个实例的推送状态独立追踪
- **幂等保护**：Redis 去重键防止重复推送

### 3. 缓存一致性
- **多级缓存**：本地 Caffeine 缓存 + Redis 缓存
- **主动失效**：配置变更时自动失效相关缓存
- **细粒度控制**：支持单配置、命名空间、全量失效

### 4. 版本管理
- **自动版本递增**：每次更新自动 +1
- **发布记录**：每次发布独立记录
- **变更审计**：完整记录谁在什么时候改了什么

### 5. 边界处理
- **异常恢复**：定时扫描失败任务并自动重试
- **状态流转**：PENDING → PUBLISHING → (SUCCESS|FAILED|PARTIAL_SUCCESS)
- **心跳检测**：客户端在线状态维护
- **全局异常处理**：统一错误响应格式

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      REST API Layer                         │
│  ConfigController (CRUD)   DebugController (调试/回放)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Service Layer                           │
│  ConfigService (配置管理)  PushService (推送管理)            │
│  EventLogService (事件日志)  CacheService (缓存管理)         │
│  WebSocketService (连接管理)  DebugService (调试服务)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      Repository Layer                        │
│  ConfigItem  ConfigRelease  ClientPushStatus                │
│  ConfigEventLog  ClientRegistry                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
   ┌───────▼───────┐                    ┌──────────▼──────────┐
   │    MySQL/H2   │                    │       Redis         │
   │  持久化存储    │                    │  幂等键/缓存存储     │
   └───────────────┘                    └─────────────────────┘
```

## 项目结构

```
src/main/java/com/example/config/
├── ConfigHotUpdateApplication.java    # 启动类
├── config/
│   ├── GlobalExceptionHandler.java    # 全局异常处理
│   └── WebSocketConfig.java           # WebSocket 配置
├── controller/
│   ├── ConfigController.java          # 配置管理 API
│   └── DebugController.java           # 调试/回放 API
├── domain/
│   ├── ConfigItem.java                # 配置项实体
│   ├── ConfigRelease.java             # 发布记录
│   ├── ClientPushStatus.java          # 客户端推送状态
│   ├── ConfigEventLog.java            # 事件日志
│   └── ClientRegistry.java            # 客户端注册
├── repository/
│   ├── ConfigItemRepository.java
│   ├── ConfigReleaseRepository.java
│   ├── ClientPushStatusRepository.java
│   ├── ConfigEventLogRepository.java
│   └── ClientRegistryRepository.java
└── service/
    ├── ConfigService.java             # 配置业务逻辑
    ├── PushService.java               # 推送业务逻辑
    ├── EventLogService.java           # 事件日志服务
    ├── CacheService.java              # 缓存服务
    ├── WebSocketService.java          # WebSocket 服务
    └── DebugService.java              # 调试服务
```

## API 接口

### 配置管理

#### 创建配置
```http
POST /api/config
Content-Type: application/json

{
  "namespace": "service-order",
  "key": "feature.flag.enable-new-ui",
  "value": "true",
  "description": "启用新UI",
  "operator": "admin@example.com"
}
```

#### 更新配置
```http
PUT /api/config/service-order/feature.flag.enable-new-ui
Content-Type: application/json

{
  "value": "false",
  "operator": "admin@example.com"
}
```

#### 查询配置
```http
GET /api/config/service-order/feature.flag.enable-new-ui
GET /api/config/service-order
```

#### 发布配置（触发推送）
```http
POST /api/config/service-order/feature.flag.enable-new-ui/publish
Content-Type: application/json

{
  "operator": "admin@example.com"
}
```

### 调试与回放

#### 按 TraceId 回放事件
```http
GET /api/debug/replay/{traceId}
```

#### 查看发布时间线
```http
GET /api/debug/release/{releaseId}/timeline
```

#### 生成 Markdown 报告
```http
GET /api/debug/release/{releaseId}/report?format=markdown
```

#### 查看最近错误
```http
GET /api/debug/errors?minutes=60
```

#### 查看事件日志
```http
GET /api/debug/events/trace/{traceId}
GET /api/debug/events/entity/{entityId}
```

## WebSocket 协议

### 连接地址
```
ws://localhost:8080/ws/config
```

### 消息格式

#### 客户端注册
```json
{
  "type": "REGISTER",
  "instanceId": "service-order-01",
  "serviceName": "service-order",
  "environment": "prod",
  "ipAddress": "10.0.0.1",
  "port": 8080
}
```

#### 订阅命名空间
```json
{
  "type": "SUBSCRIBE",
  "namespace": "service-order"
}
```

#### 心跳
```json
{
  "type": "HEARTBEAT"
}
```

#### 服务器推送
```json
{
  "type": "CONFIG_UPDATE",
  "releaseId": "abc123",
  "namespace": "service-order",
  "key": "feature.flag.enable-new-ui",
  "value": "false",
  "version": 2,
  "timestamp": 1715234567000
}
```

#### 客户端确认 (ACK 机制)

服务器发送配置更新后，**必须**等待客户端的 ACK 确认。只有收到 ACK 才认为推送成功，30 秒内未收到 ACK 则标记为 TIMEOUT。

```json
{
  "type": "ACK",
  "releaseId": "abc123",
  "status": "OK"
}
```

ACK 状态说明：
- `OK`：配置更新成功应用
- `ERROR`：配置更新失败（如解析错误）
- `SKIP`：跳过（如版本号已更新）

ACK 机制保障：
1. **真正生效验证**：只有客户端返回 ACK，服务器才认为推送成功
2. **超时检测**：30 秒内未收到 ACK，状态变为 TIMEOUT
3. **自动重试**：TIMEOUT 状态会触发自动重试（最多 5 次）
4. **完整追踪**：ACK 时间、重试次数、最终状态全部持久化记录

## 状态流转

### 发布状态 (ReleaseStatus)
```
PENDING → PUBLISHING → SUCCESS
                      → PARTIAL_SUCCESS
                      → FAILED
                      → ROLLED_BACK
```

### 推送状态 (PushStatus)
```
PENDING → SENDING → SUCCESS
                → FAILED → (重试)
                → TIMEOUT → (重试)
                → SKIPPED
```

### 客户端状态 (ConnectionStatus)
```
CONNECTED → (心跳中断) → STALE
          → (连接关闭) → DISCONNECTED
          → (长时间不活跃) → OFFLINE
```

## 配置项说明

```yaml
config:
  hot-update:
    cache:
      enabled: true                    # 是否启用缓存
      local-cache-size: 1000           # 本地缓存大小
      local-cache-expire-seconds: 300  # 本地缓存过期时间
      redis-ttl-seconds: 600           # Redis 缓存过期时间
    push:
      timeout-seconds: 30              # 推送超时
      max-retry-count: 5               # 最大重试次数
      retry-backoff-milliseconds: 1000 # 重试退避基础时间
      concurrency: 10                  # 推送并发数
    event-log:
      enabled: true                    # 是否启用事件日志
      keep-days: 30                    # 日志保留天数
    websocket:
      heartbeat-interval-seconds: 30   # 心跳间隔
      disconnect-timeout-seconds: 60   # 断开超时
    idempotent:
      enabled: true                    # 是否启用幂等
      ttl-seconds: 600                 # 幂等键过期时间
```

## 快速开始

### 前置条件
- **Java 8+ (JDK)**（代码严格使用 Java 8 兼容 API，不依赖 Java 9/11+ 特性）
- Maven 3.6+（可选，也可以使用项目提供的脚本）
- Redis（可选，默认不启用缓存，使用本地 Caffeine 缓存）

## 运行方式（三选一）

### 方式 1：使用 run.sh 脚本（推荐，无需 Maven）
项目提供了 `run.sh` 脚本，可以**完全不依赖 Maven** 来运行项目。

```bash
# 查看帮助
./run.sh help

# 构建项目（自动下载依赖）
./run.sh build

# 启动应用
./run.sh start

# 一键完成：清理 -> 构建 -> 启动
./run.sh all

# 运行测试
./run.sh test

# 清理构建
./run.sh clean
```

### 方式 2：使用 Maven Wrapper (mvnw)
如果系统没有安装 Maven，可以使用 `mvnw` 脚本：

```bash
# 先下载 Maven Wrapper JAR（只需要执行一次）
curl -o .mvn/wrapper/maven-wrapper.jar \
  https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar

# 然后使用 mvnw 代替 mvn
./mvnw spring-boot:run
./mvnw test
./mvnw clean package -DskipTests
```

### 方式 3：使用系统 Maven
如果系统已安装 Maven，可以直接使用：

```bash
# 编译并打包
mvn clean package -DskipTests

# 启动服务
mvn spring-boot:run

# 或使用打包后的 JAR 运行
java -jar target/config-hot-update-0.0.1-SNAPSHOT.jar

# 运行测试
mvn test
```

---

服务启动后访问：
- H2 控制台：http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:configdb`
  - Username: `sa`
  - Password: （留空）
- 健康检查：http://localhost:8080/actuator/health
- 配置 API：http://localhost:8080/api/config

### 运行压测
```bash
# 使用 Maven
mvn exec:java -Dexec.mainClass="com.example.config.performance.ConfigLoadTester" \
  -Dexec.args="http://localhost:8080 100 50 10"
```

参数说明：
- `http://localhost:8080`：目标地址
- `100`：预创建配置数量
- `50`：并发用户数
- `10`：每用户迭代次数

## 故障排查指南

### 场景 1：部分实例配置未生效
1. 获取发布 ID（从发布接口返回）
2. 查看发布时间线：
   ```
   GET /api/debug/release/{releaseId}/timeline
   ```
3. 查看详细报告：
   ```
   GET /api/debug/release/{releaseId}/report
   ```
4. 检查失败的实例：
   - `failedPushes` 字段会列出失败实例
   - `currentStatus` 显示实例当前是否在线
   - `lastError` 显示具体失败原因

### 场景 2：想知道谁改了配置
1. 查看配置发布历史：
   ```
   GET /api/config/releases?namespace={ns}&key={key}
   ```
2. 或查看事件日志：
   ```
   GET /api/debug/events/entity/{namespace}:{key}
   ```

### 场景 3：追踪某次请求的完整链路
1. 从错误响应中获取 `traceId`
2. 回放事件：
   ```
   GET /api/debug/replay/{traceId}
   ```
3. 按时间顺序查看所有相关事件

### 场景 4：查看最近系统错误
```
GET /api/debug/errors?minutes=60
```

## 核心设计要点

### 1. 可观测性优先
- **TraceId 贯穿始终**：`EventLogService.getCurrentTraceId()` 获取当前链路 ID
- **事件类型丰富**：20+ 种事件类型覆盖全生命周期
- **异常堆栈持久化**：错误发生时完整堆栈保存到数据库

### 2. 幂等性设计
- 使用 Redis SETNX 实现推送去重
- 幂等键格式：`idempotent:push:{releaseId}:{instanceId}`
- 过期时间防止键堆积

### 3. 重试机制
- 指数退避：`retryBackoffMs * attempt`
- 定时扫描：每 30 秒扫描可重试任务
- 重试次数限制：避免无限重试

### 4. 缓存一致性
- 读写穿透：先查缓存，再查数据库
- 写时失效：更新配置后立即失效缓存
- 支持多级失效粒度

### 5. 状态机
- 明确的状态流转规则
- 每个状态变更都记录事件日志
- 支持部分成功场景

## 扩展建议

### 接入真实 MySQL
修改 `application.yml`：
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/config_center
    username: root
    password: password
    driver-class-name: com.mysql.cj.jdbc.Driver
```

### 启用 Redis 缓存
确保 Redis 运行在 `localhost:6379`，配置已默认启用。

### 添加监控
- Actuator 端点已暴露：`/actuator/health`, `/actuator/metrics`
- 可接入 Prometheus + Grafana
- 关键指标：推送成功率、平均延迟、客户端在线数

### 添加告警
- 订阅 `PARTIAL_SUCCESS`、`FAILED` 状态
- 推送失败率超过阈值触发告警
- 客户端大量离线触发告警

## License
MIT
