# 资源锁冲突解释 API

一个完整的分布式锁管理系统，基于 Spring Boot 构建，提供资源加锁、冲突解释、等待排队、超时释放、审计追踪等核心功能。

## 技术栈

### ⭐ Python HTTP 服务器版本（首选，真实REST API）
- Python 3.6+ 标准库
- 内置 http.server，零外部依赖
- 完整REST/JSON API接口
- Web管理控制台

### Spring Boot版本（完整功能）
- Java 8+
- Spring Boot 2.7.x
- Spring Data JPA
- H2 内存数据库
- Lombok
- Thymeleaf（管理页面）

### Java独立服务器版本（零依赖）
- Java 8+ 纯JDK内置HttpServer
- 无任何外部依赖
- 内置内存存储

### Python离线逻辑验证版本
- Python 3.6+ 标准库

## 核心特性

✅ **资源加锁** - 基于资源ID的互斥访问控制  
✅ **冲突解释** - 锁被占用时返回详细冲突原因  
✅ **等待排队** - 自动维护FIFO等待队列  
✅ **超时释放** - 定时任务自动处理超时锁  
✅ **释放审计** - 完整的释放历史记录追踪  
✅ **幂等性** - 重复请求不会产生脏数据  
✅ **锁续期** - 同一持有人可自动续期  

## 快速开始

### 1. 构建项目

```bash
mvn clean package
```

### 2. 运行应用

```bash
mvn spring-boot:run
```

### 3. 访问应用

- 管理控制台: http://localhost:8080/
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:lockdb`
  - 用户名: `sa`
  - 密码: (空)

## API 文档

### 获取锁

**POST** `/api/locks/acquire`

请求体:
```json
{
    "resourceId": "order:1001",
    "lockHolder": "user:alice",
    "requestId": "req-001",
    "operationSource": "API",
    "timeoutStrategy": "AUTO_RELEASE",
    "timeoutSeconds": 300,
    "waitInQueue": true
}
```

响应:
```json
{
    "code": 200,
    "message": "操作成功",
    "data": {
        "resourceId": "order:1001",
        "lockHolder": "user:alice",
        "requestId": "req-001",
        "status": "LOCKED",
        "waitQueuePosition": null,
        "conflictReason": null,
        "lockTime": "2024-01-01T12:00:00",
        "expireTime": "2024-01-01T12:05:00",
        "success": true,
        "message": "成功获取锁"
    },
    "timestamp": "2024-01-01T12:00:00",
    "requestId": "req-001"
}
```

### 释放锁

**POST** `/api/locks/release`

请求体:
```json
{
    "resourceId": "order:1001",
    "lockHolder": "user:alice",
    "requestId": "req-release-001",
    "operationSource": "API",
    "releaseReason": "业务处理完成"
}
```

### 查询锁状态

**GET** `/api/locks/{resourceId}`

### 查询等待队列

**GET** `/api/locks/{resourceId}/queue`

### 查询释放历史

**GET** `/api/locks/{resourceId}/history`

支持时间范围查询:
- `startTime`: 开始时间 (ISO 8601)
- `endTime`: 结束时间 (ISO 8601)

### 查询所有锁

**GET** `/api/locks`

### 导出单资源锁完整状态

**GET** `/api/locks/{resourceId}/export`

导出内容包含:
- 锁当前状态
- 等待队列完整列表
- 释放历史记录
- 统计信息

### 导出所有锁汇总状态

**GET** `/api/locks/export`

导出内容包含:
- 所有锁列表
- 锁定/已释放统计
- 导出时间戳

## 幂等性保障

所有写入操作 (`/acquire` 和 `/release`) 都基于 `requestId` 实现了幂等性:

- **重复请求**不会产生脏数据
- **相同 requestId** 返回与首次请求完全一致的响应
- **幂等记录**持久化存储在数据库中

## 状态枚举

| 状态 | 说明 |
|------|------|
| `LOCKED` | 已锁定 |
| `AVAILABLE` | 可用 |
| `WAITING` | 等待中 |
| `RELEASED` | 已释放 |
| `EXPIRED` | 已过期 |

## 操作来源枚举

| 来源 | 说明 |
|------|------|
| `API` | API调用 |
| `ADMIN` | 管理员操作 |
| `TIMEOUT` | 超时自动释放 |
| `MANUAL_RELEASE` | 手动释放 |

## 超时策略枚举

| 策略 | 说明 |
|------|------|
| `AUTO_RELEASE` | 自动释放 |
| `NOTIFY_AND_RELEASE` | 通知并释放 |
| `EXTEND_ON_ACCESS` | 访问时续期 |

## 使用示例

### 1. Alice 获取锁

```bash
curl -X POST http://localhost:8080/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "order:1001",
    "lockHolder": "user:alice",
    "requestId": "req-alice-001",
    "operationSource": "API",
    "timeoutStrategy": "AUTO_RELEASE",
    "timeoutSeconds": 300,
    "waitInQueue": true
  }'
```

### 2. Bob 尝试获取同一个锁（加入队列）

```bash
curl -X POST http://localhost:8080/api/locks/acquire \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "order:1001",
    "lockHolder": "user:bob",
    "requestId": "req-bob-001",
    "operationSource": "API",
    "timeoutStrategy": "AUTO_RELEASE",
    "timeoutSeconds": 300,
    "waitInQueue": true
  }'
```

### 3. Alice 释放锁

```bash
curl -X POST http://localhost:8080/api/locks/release \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "order:1001",
    "lockHolder": "user:alice",
    "requestId": "req-release-alice",
    "operationSource": "API",
    "releaseReason": "订单处理完成"
  }'
```

### 4. 查看释放历史

```bash
curl http://localhost:8080/api/locks/order:1001/history
```

### 5. 导出完整状态

**导出单个资源的完整状态（锁状态 + 队列 + 历史）：

```bash
curl http://localhost:8080/api/locks/order:1001/export
```

**导出所有资源的汇总状态：

```bash
curl http://localhost:8080/api/locks/export
```

## 运行测试

```bash
mvn test
```

## 故障排除

### 问题 1：`mvnw 无法下载 maven-wrapper.jar

**现象**：
```
curl: (7) Failed to connect to 127.0.0.1 port 7890
```

**解决方案**：

**推荐直接使用 Python 离线验证**（无需 Maven：
```bash
python3 verify.py
```

或者取消代理后重试：
```bash
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
./download-maven-wrapper.sh
```

### 问题 2：Java 版本不兼容

**现象**：`Unsupported major.minor version 55.0`

**解决方案**：项目已降级支持 Java 8，检查 Java 版本：
```bash
java -version
```

确保使用 Java 8 或更高版本。

### 问题 3：无法启动端口被占用

**现象**：`Address already in use`

**解决方案**：
```bash
lsof -i :8080 | grep LISTEN
# 或者修改端口：
```
在 `application.yml` 中添加：
```yaml
server:
  port: 8081
```

### 问题 4：只有 JRE 没有 JDK

**现象**：`javac: command not found

**解决方案**：直接使用 Python 离线验证：
```bash
python3 verify.py
```

或者安装完整 JDK，或者使用 IDE（如果系统自带的 JDK。

```bash
mvn test
```

## 项目结构

```
src/main/java/com/example/lock/
├── ResourceLockApplication.java    # 启动类
├── controller/                     # 控制器层
│   ├── LockController.java         # 锁API控制器
│   └── PageController.java         # 页面控制器
├── dto/                            # 数据传输对象
│   ├── ApiResponse.java
│   ├── LockRequest.java
│   ├── LockResponse.java
│   └── ReleaseRequest.java
├── entity/                         # 实体类
│   ├── ReleaseAudit.java
│   ├── ResourceLock.java
│   └── WaitQueueItem.java
├── enums/                          # 枚举类
│   ├── LockStatus.java
│   ├── OperationSource.java
│   └── TimeoutStrategy.java
├── exception/                      # 异常处理
│   ├── GlobalExceptionHandler.java
│   └── LockException.java
├── repository/                     # 数据访问层
│   ├── ReleaseAuditRepository.java
│   ├── ResourceLockRepository.java
│   └── WaitQueueItemRepository.java
├── scheduler/                      # 定时任务
│   └── LockExpirationScheduler.java
└── service/                        # 业务逻辑层
    └── ResourceLockService.java
```

## 配置说明

主要配置项在 `application.yml`:

```yaml
server:
  port: 8080

spring:
  h2:
    console:
      enabled: true
      path: /h2-console
```

## 许可证

MIT License
