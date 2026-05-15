# 文件病毒扫描编排 API

基于 Spring Boot 2.7.x 的本地后端服务，用于管理文件病毒扫描任务的编排、状态跟踪和隔离管理。

**兼容 Java 8+**

## 技术栈

- **框架**: Spring Boot 2.7.18 (兼容 Java 8)
- **数据库**: H2 (嵌入式，持久化存储)
- **ORM**: Spring Data JPA
- **校验**: Java Validation
- **测试**: JUnit 5

## 核心数据模型

1. **UploadFile** - 上传文件信息
   - 文件ID、文件名、文件大小、文件哈希、内容类型、上传人、来源系统

2. **ScanTask** - 扫描任务
   - 任务ID、文件ID、请求ID、状态、扫描引擎、扫描结果、病毒详情、重试次数、最大重试、开始/结束时间

3. **Quarantine** - 隔离区记录
   - 隔离ID、文件ID、任务ID、隔离路径、病毒原因、操作人、是否已放行

4. **ReleaseCertificate** - 放行凭证
   - 凭证ID、文件ID、任务ID、隔离ID、放行原因、操作人、审批签名

5. **FailureReason** - 失败原因记录
   - 失败ID、任务ID、文件ID、错误码、错误消息、堆栈信息、是否可重试

6. **NotificationRecord** - 通知记录
   - 通知ID、任务ID、文件ID、通知类型、通知状态、接收者、主题、内容

## 任务状态流转

```
PENDING → SCANNING → CLEAN
                 → INFECTED → QUARANTINED → RELEASED
                 → FAILED → PENDING (重试)
                 → CANCELLED
```

**状态转换规则**:
- PENDING → SCANNING, CANCELLED, FAILED
- SCANNING → CLEAN, INFECTED, FAILED, CANCELLED
- INFECTED → QUARANTINED
- QUARANTINED → RELEASED
- FAILED → PENDING

## API 接口

### 扫描任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/scan-tasks | 创建扫描任务 |
| GET | /api/scan-tasks/{taskId} | 查询任务详情 |
| PUT | /api/scan-tasks/{taskId}/status | 更新任务状态 |
| GET | /api/scan-tasks | 查询任务列表 (支持 fileId/status/时间范围) |
| GET | /api/scan-tasks/{taskId}/failures | 查询任务失败记录 |
| GET | /api/scan-tasks/{taskId}/notifications | 查询任务通知记录 |
| GET | /api/scan-tasks/statistics | 查询统计信息 |

### 隔离区接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/quarantines | 查询隔离文件列表 |
| GET | /api/quarantines/{quarantineId} | 查询隔离详情 |
| POST | /api/quarantines/release | 放行隔离文件 |

## 防脏数据机制

1. **重复提交防护**: 相同 requestId 返回已有任务，避免重复创建
2. **活跃任务检查**: 同一文件不能同时存在多个 PENDING/SCANNING 状态的任务
3. **状态流转校验**: 严格限制状态转换路径，防止非法状态变更
4. **乐观锁**: 使用 @Version 防止并发更新冲突

## 快速开始

### 环境要求

- Java 8 或更高版本（已测试通过 Java 8）

### 一键启动服务（推荐）

```bash
./start.sh
```

脚本会自动：
1. 使用 Maven Wrapper 构建项目（首次运行自动下载依赖）
2. 启动 Spring Boot 服务

### 运行单元测试

```bash
./test.sh
```

### 运行 API 自检脚本（需要先启动服务）

```bash
# 先在一个终端启动服务
./start.sh

# 在另一个终端运行自检脚本
./self-check.sh
```

### 服务地址

启动后访问：
- API 地址: http://localhost:8080/api
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/virus_scan_db`
  - 用户名: `sa`
  - 密码: (空)

### 使用 Maven Wrapper

如果需要直接使用 Maven 命令：

```bash
# 构建项目
./mvnw clean package -DskipTests

# 启动服务
./mvnw spring-boot:run

# 运行测试
./mvnw test
```

## API 示例

### 创建扫描任务

```bash
curl -X POST http://localhost:8080/api/scan-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "FILE-001",
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "fileHash": "a1b2c3d4e5f6",
    "contentType": "application/pdf",
    "uploadedBy": "user01",
    "sourceSystem": "web-portal",
    "requestId": "REQ-UNIQUE-001",
    "maxRetry": 3
  }'
```

### 更新任务状态

```bash
curl -X PUT http://localhost:8080/api/scan-tasks/{taskId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "CLEAN",
    "scanResult": "No virus found",
    "operator": "system"
  }'
```

### 放行隔离文件

```bash
curl -X POST http://localhost:8080/api/quarantines/release \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "FILE-001",
    "quarantineId": "QUAR-XXXX",
    "releaseReason": "误报，经人工审核确认安全",
    "releasedBy": "admin",
    "approverSignature": "manager-01"
  }'
```

## 项目结构

```
├── mvnw                          # Maven Wrapper 脚本
├── .mvn/wrapper/
│   └── maven-wrapper.properties  # Maven Wrapper 配置
├── start.sh                      # 一键启动脚本
├── test.sh                       # 单元测试脚本
├── self-check.sh                 # API 自检脚本
├── pom.xml                       # Maven 配置
├── build.gradle                  # Gradle 配置
├── src/
│   ├── main/
│   │   ├── java/com/virusscan/
│   │   │   ├── controller/       # REST 控制器
│   │   │   ├── dto/             # 数据传输对象
│   │   │   ├── entity/          # JPA 实体
│   │   │   ├── enums/           # 枚举类型
│   │   │   ├── exception/       # 异常处理
│   │   │   ├── repository/      # 数据访问层
│   │   │   ├── service/         # 业务逻辑层
│   │   │   └── VirusScanApplication.java
│   │   └── resources/
│   │       └── application.yml   # 配置文件
│   └── test/
│       └── java/com/virusscan/  # 单元测试
└── data/                         # H2 数据库文件（运行后生成）
```

## 配置说明

主要配置项 (`application.yml`):

```yaml
spring:
  datasource:
    url: jdbc:h2:file:./data/virus_scan_db  # 数据库文件路径
  jpa:
    hibernate:
      ddl-auto: update  # 自动更新表结构

server:
  port: 8080
  servlet:
    context-path: /api
```

## 注意事项

1. **数据库**: 默认使用 H2 嵌入式数据库，数据文件存储在 `./data/` 目录
2. **重试机制**: 任务失败后会自动重置为 PENDING 状态等待重试，直到达到最大重试次数
3. **通知机制**: 任务状态变更时如果配置了 callbackUrl 会创建通知记录（可扩展实际发送逻辑）
4. **幂等性**: 创建任务时建议传入 requestId 确保幂等

## 异常返回说明

| HTTP 状态码 | 场景 |
|------------|------|
| 404 | 任务不存在、文件不存在等 |
| 409 | 状态转换冲突、同一文件有活跃任务等 |
| 400 | 参数校验失败、非法请求等 |
| 500 | 系统内部错误 |