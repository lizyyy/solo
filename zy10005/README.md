# 灰度发布回滚系统

一个专注于**并发安全、幂等性、状态一致性、快速定位问题**的灰度发布回滚系统。

## 核心特性

### 🎯 已实现的关键能力

| 特性 | 说明 | 实现位置 |
|------|------|----------|
| **状态机引擎** | 严格的状态流转控制，防止非法操作 | `StateMachineConfig.java` |
| **分布式锁** | Redisson 可重入锁，防止并发冲突 | `DistributedLockService.java` |
| **幂等性机制** | SHA-256 哈希去重，重复请求只执行一次 | `IdempotentService.java` |
| **完整审计日志** | 每次操作的前后状态快照，支持回放 | `OperationLogService.java` |
| **错误回放** | 基于日志状态重建，精准重放失败操作 | `ErrorReplayService.java` |
| **自动恢复** | 定时检测卡住的任务，自动恢复 | `RecoveryService.java` |
| **缓存一致性** | 统一的缓存策略，写操作同步失效 | `ReleaseService.java` |
| **Markdown 报告** | 包含 Mermaid 状态图的分析报告 | `ReportService.java` |

### 🔄 状态流转

```
PENDING → PREPARING → CANARY_10 → CANARY_30 → CANARY_50 → CANARY_100 → COMPLETED
              |             |             |             |               |
              v             v             v             v               v
          ROLLBACKING ← ROLLBACKING ← ROLLBACKING ← ROLLBACKING ← ROLLBACKING
              |             |             |             |               |
              v             v             v             v               v
           FAILED       ROLLED_BACK   ROLLED_BACK   ROLLED_BACK   ROLLED_BACK
```

## 快速开始

### 前置要求

- **Docker** 20.10+（推荐，最简单的方式）
- 或者 **Java 17** + **Maven 3.9+** + **MySQL 8.0** + **Redis 7**

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆项目
cd /Users/lzy/pro/solo/workspaces/zy10005

# 2. 使用 Docker Compose 启动（自动构建并运行）
docker-compose up -d --build

# 3. 等待服务启动（约 30-60 秒）
docker-compose logs -f app

# 4. 验证服务健康
curl http://localhost:8080/actuator/health
```

### 方式二：本地开发（需要 Java 17）

```bash
# 1. 启动 MySQL 和 Redis
docker run -d --name rollback-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=rollback_system \
  mysql:8.0

docker run -d --name rollback-redis -p 6379:6379 redis:7-alpine

# 2. 编译项目
./mvnw clean package -DskipTests

# 3. 运行应用
java -jar target/rollback-system-1.0.0.jar

# 4. 验证
curl http://localhost:8080/actuator/health
```

## 使用示例

### 完整的灰度发布流程

```bash
# 1. 创建发布任务
RELEASE_ID=$(curl -s -X POST http://localhost:8080/api/releases \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "user-service",
    "currentVersion": "v1.0.0",
    "targetVersion": "v2.0.0",
    "totalInstances": 100,
    "metadata": "{\"env\":\"production\"}",
    "operator": "admin"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Created release: $RELEASE_ID"

# 2. 开始发布（进入 PREPARING 状态）
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/start

# 3. 逐步灰度发布
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/advance  # 10%
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/advance  # 30%
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/advance  # 50%

# 4. 查看当前状态
curl http://localhost:8080/api/releases/$RELEASE_ID | python3 -m json.tool
```

### 发现问题 - 触发回滚

```bash
# 1. 发现 50% 灰度有问题，触发回滚
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "High error rate detected (15% > 5% threshold)",
    "operator": "on-call-engineer"
  }'

# 2. 执行回滚
curl -X POST http://localhost:8080/api/releases/$RELEASE_ID/rollback/execute

# 3. 验证回滚结果
curl http://localhost:8080/api/releases/$RELEASE_ID | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d[\"status\"]}, Updated: {d[\"updatedInstances\"]}')"
```

### 问题排查与回放

```bash
# 1. 查看完整操作日志
curl http://localhost:8080/api/releases/$RELEASE_ID/logs | python3 -m json.tool

# 2. 查看失败操作
curl http://localhost:8080/api/releases/$RELEASE_ID/logs/failed | python3 -m json.tool

# 3. 生成完整的 Markdown 分析报告
curl http://localhost:8080/api/releases/$RELEASE_ID/report > report.md
cat report.md

# 4. 如果回滚过程中有失败操作，重放该操作
# 假设失败操作的日志 ID 是 5
curl -X POST "http://localhost:8080/api/releases/$RELEASE_ID/replay/5?operator=sre"
```

### 幂等性验证（重复请求安全）

```bash
# 同一个请求多次发送，只会执行一次
for i in 1 2 3; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:8080/api/releases \
    -H "Content-Type: application/json" \
    -d '{
      "serviceName": "order-service",
      "currentVersion": "v1.0.0",
      "targetVersion": "v2.0.0",
      "totalInstances": 50
    }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
  sleep 1
done
```

## API 文档

### 发布管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/releases` | 创建新发布 |
| GET | `/api/releases` | 获取所有进行中的发布 |
| GET | `/api/releases/{id}` | 获取发布详情 |
| POST | `/api/releases/{id}/start` | 开始发布（PENDING → PREPARING） |
| POST | `/api/releases/{id}/advance` | 推进到下一个灰度阶段 |
| POST | `/api/releases/{id}/rollback` | 触发回滚 |
| POST | `/api/releases/{id}/rollback/execute` | 执行回滚 |
| POST | `/api/releases/{id}/fail` | 标记为失败 |

### 日志与回放

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/releases/{id}/logs` | 获取完整操作日志 |
| GET | `/api/releases/{id}/logs/failed` | 获取失败操作列表 |
| POST | `/api/releases/{id}/replay/{logId}` | 重放指定失败操作 |
| POST | `/api/releases/{id}/replay/all` | 重放所有失败操作 |
| POST | `/api/releases/{id}/recover` | 强制恢复卡住的任务 |

### 报告生成

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/releases/{id}/report` | 生成单个发布的 Markdown 报告 |
| GET | `/api/releases/report` | 生成系统级报告（支持时间范围） |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/actuator/health` | 健康检查 |
| GET | `/actuator/info` | 应用信息 |
| GET | `/actuator/metrics` | 指标数据 |

## 核心设计说明

### 1. 幂等性实现

```
请求 → SHA-256 哈希 → 幂等 Key
    ↓
检查 Redis/DB 是否已存在
    ├─ 已处理 → 返回缓存的响应
    ├─ 处理中 → 拒绝请求（防止重复）
    └─ 未处理 → 创建记录 → 执行业务 → 缓存响应
```

**关键代码**：`IdempotentService.executeIdempotent()`

### 2. 缓存一致性策略

采用**Cache-Aside + 写穿透**模式：

```
读操作:
  1. 先查 Caffeine 本地缓存
  2. 未命中则查 Redis 分布式缓存
  3. 还未命中则查 DB
  4. 结果回填到所有缓存层

写操作:
  1. 直接更新 DB
  2. 失效 Caffeine 缓存（@CacheEvict）
  3. 删除 Redis 缓存
  4. 下次读取时自动重建
```

**关键代码**：`ReleaseService` 中的 `@Cacheable` 和 `@CacheEvict` 注解

### 3. 错误回放机制

回放不是简单的重试接口，而是**基于日志状态重建**：

```
1. 获取失败操作的日志记录
2. 反序列化 beforeState 获取操作前的完整状态
3. 验证当前状态与日志状态的一致性
4. 重新执行相同的操作
5. 记录回放日志
```

**关键代码**：`ErrorReplayService.replayOperation()`

### 4. 并发控制

每个发布操作都使用双重保护：

1. **Redis 分布式锁**：防止不同实例的并发操作
2. **JPA 乐观锁**：`@Version` 字段防止同一实例的并发修改

```java
// 分布式锁 + 数据库乐观锁双重保护
return lockService.executeWithLock(
    "release:" + releaseId,
    5, config.getLockTimeoutSeconds(), TimeUnit.SECONDS,
    () -> {
        // 获取数据库行锁
        Optional<Release> releaseOpt = releaseRepository.findByIdWithLock(releaseId);
        // ... 执行业务逻辑
        // JPA 会自动检查 @Version 字段
    }
);
```

## 运行测试

### 基础测试

```bash
# 运行单元测试（需要 Testcontainers + Docker）
./mvnw test

# 跳过 Docker 相关的测试
./mvnw test -Dtest=ReleaseServiceTest
```

### 压力测试

压测样例位于 `src/test/java/com/grayscale/rollback/LoadTest.java`，包含：

1. **并发创建发布**（50 线程 x 20 次）
2. **并发灰度推进**（20 线程操作 10 个发布）
3. **混合工作负载**（推进 + 回滚 并发执行）

```bash
# 运行压测（需要较长时间）
./mvnw test -Dtest=LoadTest
```

## 部署到 Kubernetes

```bash
# 1. 构建镜像
docker build -t rollback-system:1.0.0 .

# 2. 推送镜像仓库（可选）
# docker tag rollback-system:1.0.0 your-registry/rollback-system:1.0.0
# docker push your-registry/rollback-system:1.0.0

# 3. 创建 Secret（敏感配置）
kubectl create secret generic rollback-system-secret \
  --from-literal=db-url="jdbc:mysql://mysql-service:3306/rollback_system" \
  --from-literal=db-username="root" \
  --from-literal=db-password="your-password"

# 4. 部署应用
kubectl apply -f k8s-deployment.yaml

# 5. 验证部署
kubectl get pods
kubectl get svc rollback-system-service
```

## 项目结构

```
.
├── src/
│   ├── main/
│   │   ├── java/com/grayscale/rollback/
│   │   │   ├── RollbackSystemApplication.java  # 主应用类
│   │   │   ├── config/                         # 配置类
│   │   │   │   ├── CacheConfig.java           # 缓存配置
│   │   │   │   ├── RedissonConfig.java        # Redis 配置
│   │   │   │   ├── RollbackSystemConfig.java  # 应用配置
│   │   │   │   └── StateMachineConfig.java    # 状态机配置
│   │   │   ├── controller/                     # REST 控制器
│   │   │   ├── dto/                            # 数据传输对象
│   │   │   ├── entity/                         # JPA 实体
│   │   │   ├── enums/                          # 枚举定义
│   │   │   ├── exception/                      # 异常处理
│   │   │   ├── repository/                     # 数据访问层
│   │   │   └── service/                        # 业务逻辑
│   │   │       ├── DistributedLockService.java   # 分布式锁
│   │   │       ├── IdempotentService.java        # 幂等性
│   │   │       ├── OperationLogService.java      # 操作日志
│   │   │       ├── ReleaseService.java           # 核心发布逻辑
│   │   │       ├── ErrorReplayService.java       # 错误回放
│   │   │       ├── RecoveryService.java          # 异常恢复
│   │   │       └── ReportService.java            # 报告生成
│   │   └── resources/
│   │       ├── application.yml                # 应用配置
│   │       └── schema.sql                     # 数据库 Schema
│   └── test/
│       ├── java/com/grayscale/rollback/
│       │   ├── ReleaseServiceTest.java        # 核心业务测试
│       │   ├── StateMachineTest.java          # 状态机测试
│       │   └── LoadTest.java                  # 压测样例
│       └── resources/
│           └── application-test.yml           # 测试配置
├── Dockerfile                                 # Docker 镜像构建
├── docker-compose.yml                         # 本地开发环境
├── k8s-deployment.yaml                        # Kubernetes 部署
├── pom.xml                                    # Maven 配置
├── mvnw                                       # Maven Wrapper (Unix)
├── mvnw.cmd                                   # Maven Wrapper (Windows)
└── README.md                                  # 本文档
```

## 故障排查

### 常见问题

**Q: 服务启动失败，提示数据库连接错误**
```bash
# 检查 MySQL 是否运行
docker ps | grep mysql

# 查看详细日志
docker-compose logs mysql
```

**Q: 发布状态卡住不动**
```bash
# 查看是否有自动恢复任务运行
curl http://localhost:8080/actuator/metrics

# 手动触发恢复
curl -X POST "http://localhost:8080/api/releases/{id}/recover?operator=sre"
```

**Q: 回滚失败怎么办**
```bash
# 1. 查看失败操作列表
curl http://localhost:8080/api/releases/{id}/logs/failed

# 2. 生成详细报告
curl http://localhost:8080/api/releases/{id}/report

# 3. 尝试重放失败操作
curl -X POST "http://localhost:8080/api/releases/{id}/replay/all?operator=sre"
```

**Q: 如何查看完整的状态变更历史**
```bash
# 获取所有操作日志
curl http://localhost:8080/api/releases/{id}/logs

# 或者直接看生成的报告
curl http://localhost:8080/api/releases/{id}/report
```

## 许可证

MIT License
