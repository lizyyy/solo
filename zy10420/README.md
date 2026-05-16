# 状态页公告API

## 项目概述

这是一个基于 Spring Boot 3.x 构建的事故状态管理后端服务，提供完整的公告版本化、订阅方确认、状态推进、异常记录和复盘摘要导出功能。

## 技术栈

- **框架**: Spring Boot 3.2.0
- **数据库**: H2 (嵌入式，本地持久化)
- **ORM**: Spring Data JPA
- **构建工具**: Maven
- **JDK版本**: Java 17+

## 快速启动

### 1. 构建项目

```bash
mvn clean package -DskipTests
```

### 2. 启动服务

```bash
mvn spring-boot:run
```

或者运行打包后的jar:

```bash
java -jar target/statuspage-announcement-api-1.0.0.jar
```

### 3. 访问服务

- **API基础地址**: http://localhost:8080/api/v1
- **H2数据库控制台**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/statuspage`
  - 用户名: `sa`
  - 密码: (空)

## 样例数据

服务启动时会自动初始化以下样例数据：

- **订阅方**: 运维团队A、运维团队B、开发团队A、业务团队A
- **事故1**: INC-2024-001 支付系统响应缓慢 (含3个版本公告，2个确认记录)
- **事故2**: INC-2024-002 用户中心服务中断

## API接口列表

### 事故管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/incidents | 创建新事故 |
| GET | /api/v1/incidents | 获取所有事故 |
| GET | /api/v1/incidents/active | 获取进行中的事故 |
| GET | /api/v1/incidents/{incidentNumber} | 获取单个事故详情 |

### 公告管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/incidents/{incidentNumber}/announcements | 创建新公告(自动版本号) |
| GET | /api/v1/incidents/{incidentNumber}/announcements | 获取事故所有公告 |

### 订阅方确认

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/incidents/{incidentNumber}/confirmations | 提交公告确认(自动去重) |
| GET | /api/v1/incidents/{incidentNumber}/confirmations | 获取事故所有确认 |
| GET | /api/v1/incidents/announcements/{announcementId}/confirmations | 获取单个公告的确认 |

### 状态推进

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/incidents/{incidentNumber}/status | 推进事故状态(防止重复) |

### 人工修正

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/incidents/{incidentNumber}/correct | 人工修正事故信息 |

### 异常日志

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/incidents/{incidentNumber}/exception-logs | 获取事故的异常操作记录 |
| GET | /api/v1/incidents/exception-logs | 获取所有异常日志 |
| POST | /api/v1/incidents/exception-logs/{id}/resolve | 标记异常已处理 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/incidents/{incidentNumber}/export | 导出复盘摘要(JSON) |
| GET | /api/v1/incidents/{incidentNumber}/download | 下载复盘摘要(Markdown文件) |

### 订阅方管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/subscribers | 创建订阅方 |
| GET | /api/v1/subscribers | 获取所有订阅方 |
| GET | /api/v1/subscribers/active | 获取活跃订阅方 |
| PUT | /api/v1/subscribers/{subscriberId} | 更新订阅方信息 |
| DELETE | /api/v1/subscribers/{subscriberId} | 删除订阅方 |

## 核心功能特性

### 1. 公告版本化
- 每个新公告自动递增版本号 (v1, v2, v3...)
- 保留完整的历史变更记录
- 每个版本独立记录确认状态

### 2. 状态推进保护
- 事故状态: INVESTIGATING → IDENTIFIED → MONITORING → RESOLVED → POST_MORTEM
- 服务状态: MAJOR_OUTAGE → PARTIAL_OUTAGE → DEGRADED_PERFORMANCE → OPERATIONAL
- 防止状态回退
- 重复提交同一状态转换会被拒绝

### 3. 确认去重机制
- 同一订阅方对同一公告只能确认一次
- 数据库唯一约束 + 业务层双重校验
- 重复确认返回清晰的错误提示

### 4. 异常路径记录
- 所有业务异常自动记录日志
- 保留原始请求参数
- 记录错误码、错误信息、时间、操作人
- 支持标记异常处理状态

### 5. 复盘摘要导出
- 导出完整的事故时间线
- 包含所有公告版本
- 列出所有订阅方确认记录
- 支持Markdown格式文件下载

## 验收测试用例

### 测试1: 创建正常数据

```bash
# 创建新事故
curl -X POST http://localhost:8080/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "incidentNumber": "TEST-001",
    "title": "测试事故",
    "description": "这是一个测试",
    "serviceStatus": "DEGRADED_PERFORMANCE",
    "affectedServices": "API网关",
    "createdBy": "tester",
    "announcementTitle": "测试公告",
    "announcementContent": "测试公告内容"
  }'

# 创建新版本公告
curl -X POST http://localhost:8080/api/v1/incidents/TEST-001/announcements \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试公告v2",
    "content": "问题已定位",
    "serviceStatus": "DEGRADED_PERFORMANCE",
    "incidentStatus": "IDENTIFIED",
    "createdBy": "tester",
    "publishImmediately": true
  }'

# 订阅方确认
curl -X POST http://localhost:8080/api/v1/incidents/TEST-001/confirmations \
  -H "Content-Type: application/json" \
  -d '{
    "announcementId": 1,
    "subscriberId": "ops-001",
    "subscriberName": "运维团队A",
    "note": "收到通知"
  }'
```

### 测试2: 验证重复提交保护

```bash
# 重复确认同一公告 (应该失败)
curl -X POST http://localhost:8080/api/v1/incidents/TEST-001/confirmations \
  -H "Content-Type: application/json" \
  -d '{
    "announcementId": 1,
    "subscriberId": "ops-001",
    "subscriberName": "运维团队A",
    "note": "再次确认"
  }'

# 预期返回: {"success":false,"message":"订阅方已确认该公告","data":null,"errorCode":"CONFIRM_001"}

# 推进到已解决
curl -X POST http://localhost:8080/api/v1/incidents/TEST-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "incidentStatus": "RESOLVED",
    "serviceStatus": "OPERATIONAL",
    "operator": "tester"
  }'

# 尝试从已解决回退到监控中 (应该失败)
curl -X POST http://localhost:8080/api/v1/incidents/TEST-001/status \
  -H "Content-Type: application/json" \
  -d '{
    "incidentStatus": "MONITORING",
    "operator": "tester"
  }'

# 预期返回: 状态转换错误
```

### 测试3: 查看异常日志和导出

```bash
# 查看异常日志
curl http://localhost:8080/api/v1/incidents/exception-logs

# 查看该事故的异常日志
curl http://localhost:8080/api/v1/incidents/TEST-001/exception-logs

# 导出复盘摘要
curl http://localhost:8080/api/v1/incidents/INC-2024-001/export

# 下载Markdown文件
curl -O -J http://localhost:8080/api/v1/incidents/INC-2024-001/download
```

## 数据模型

### Incident (事故)
- incidentNumber: 事故编号(唯一)
- title: 标题
- description: 描述
- status: 事故状态 (INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED/POST_MORTEM)
- serviceStatus: 服务状态
- affectedServices: 影响服务
- startTime/endTime: 开始/结束时间
- reviewSummary: 复盘总结

### Announcement (公告)
- version: 版本号
- title: 标题
- content: 内容
- serviceStatus: 服务状态
- incidentStatus: 事故状态
- createdBy: 创建人
- published: 是否已发布
- publishedAt: 发布时间

### Confirmation (确认)
- announcementId: 公告ID
- subscriberId: 订阅方ID
- subscriberName: 订阅方名称
- note: 备注
- confirmedBy: 确认人
- confirmedAt: 确认时间

### ExceptionLog (异常日志)
- incidentNumber: 事故编号
- operation: 操作
- errorCode: 错误码
- errorMessage: 错误信息
- originalInput: 原始输入
- processingConclusion: 处理结论
- resolved: 是否已解决
- resolvedBy: 处理人

## 项目结构

```
src/main/java/com/statuspage/
├── StatusPageAnnouncementApplication.java  # 启动类
├── config/
│   └── DataInitializer.java                 # 样例数据初始化
├── controller/
│   ├── IncidentController.java              # 事故API
│   └── SubscriberController.java            # 订阅方API
├── dto/                                     # 请求/响应DTO
├── exception/
│   ├── BusinessException.java               # 业务异常
│   ├── ErrorCode.java                       # 错误码
│   └── GlobalExceptionHandler.java          # 全局异常处理
├── model/                                   # 数据实体
├── repository/                              # 数据访问层
└── service/                                 # 业务逻辑层
```

## 配置说明

配置文件位于 `src/main/resources/application.yml`

主要配置项:
- 数据库路径: `./data/statuspage`
- 服务端口: 8080
- H2控制台: 已启用

## 注意事项

1. H2数据库文件存储在 `./data` 目录下，重启服务数据不会丢失
2. 状态推进是单向的，不允许回退
3. 确认记录基于(事故ID,公告ID,订阅方ID)做唯一约束
4. 所有异常操作都会被记录到异常日志表，可以通过API查询
