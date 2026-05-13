# 资源锁冲突解释 API

一个完整的分布式锁管理系统，基于 Spring Boot 构建，提供资源加锁、冲突解释、等待排队、超时释放、审计追踪等核心功能。

## 技术栈

- Java 11+
- Spring Boot 2.7.x
- Spring Data JPA
- H2 内存数据库
- Lombok
- Thymeleaf（管理页面）

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

## 运行测试

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
