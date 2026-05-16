# 模型提示版本 API

## 项目简介

这是一个用于管理提示词模板版本的后端服务，支持版本发布、流量分配、命中记录、回滚幂等功能，并提供完整的异常处理和导出功能。

## 技术栈

- Java 11
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database (本地持久化)
- Apache Commons CSV

## 快速开始

### 1. 编译项目

```bash
mvn clean package
```

### 2. 运行项目

```bash
mvn spring-boot:run
```

或

```bash
java -jar target/prompt-version-api-1.0.0.jar
```

服务启动后访问: http://localhost:8080

### 3. H2数据库控制台

访问: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:file:./data/prompt_version`
- 用户名: `sa`
- 密码: (空)

## API 接口文档

### 模板管理 (Templates)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建模板 |
| GET | `/api/templates` | 获取所有模板 |
| GET | `/api/templates/{id}` | 根据ID获取模板 |
| GET | `/api/templates/name/{name}` | 根据名称获取模板 |
| DELETE | `/api/templates/{id}` | 删除模板 |

**创建模板请求示例:**
```json
{
    "templateName": "聊天提示词",
    "description": "通用对话场景",
    "createdBy": "admin"
}
```

### 版本管理 (Versions)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/versions` | 创建版本 |
| POST | `/api/versions/{id}/publish` | 发布版本 (DRAFT -> PUBLISHED) |
| POST | `/api/versions/{id}/activate` | 激活版本 (PUBLISHED -> ACTIVE) |
| PUT | `/api/versions/{id}/traffic` | 更新流量占比 |
| POST | `/api/versions/rollback` | 回滚版本 |
| GET | `/api/versions/template/{templateId}` | 获取模板的所有版本 |
| GET | `/api/versions/template/{templateId}/active` | 获取模板的激活版本 |
| GET | `/api/versions/{id}` | 获取版本详情 |
| GET | `/api/versions/template/{templateId}/select` | 根据流量分配选择版本 |

**创建版本请求示例:**
```json
{
    "templateId": 1,
    "versionNumber": "v1.0.0",
    "content": "你是一个乐于助人的AI助手...",
    "trafficPercentage": 50,
    "publishedBy": "admin",
    "remark": "初始版本"
}
```

**回滚版本请求示例:**
```json
{
    "versionId": 1,
    "rollbackType": "MANUAL",
    "operator": "admin",
    "reason": "效果不佳",
    "targetVersionId": 2
}
```

### 命中记录 (Hit Records)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/hits` | 记录命中 |
| GET | `/api/hits/version/{versionId}` | 获取版本的命中记录 |
| GET | `/api/hits/template/{templateId}` | 获取模板的命中记录 |
| GET | `/api/hits/template/{templateId}/range` | 按时间范围获取命中记录 |

**记录命中请求示例:**
```json
{
    "templateId": 1,
    "versionId": 2,
    "requestId": "req_001",
    "userId": "user_123",
    "modelName": "gpt-4",
    "hitReason": "流量分配-50%",
    "latencyMs": 150
}
```

### 异常日志 (Exception Logs)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/exceptions` | 获取所有异常 |
| GET | `/api/exceptions/{id}` | 获取异常详情 |
| GET | `/api/exceptions/template/{templateId}` | 获取模板相关异常 |
| GET | `/api/exceptions/operation/{operationType}` | 按操作类型获取异常 |
| GET | `/api/exceptions/range` | 按时间范围获取异常 |
| PUT | `/api/exceptions/{id}/conclusion` | 更新异常处理结论 |

### 导出功能 (Export)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/version-summary/{templateId}` | 导出版本摘要 (CSV) |
| GET | `/api/export/hit-records/{templateId}` | 导出版本命中记录 (CSV) |
| GET | `/api/export/rollback-events/{templateId}` | 导出回滚事件 (CSV) |
| GET | `/api/export/exception-logs` | 导出异常日志 (CSV) |
| GET | `/api/export/full-report/{templateId}` | 导出完整报告 (TXT) |

## 核心功能说明

### 1. 版本生命周期

状态流转:
- **DRAFT (草稿)**: 新建版本的初始状态，可编辑
- **PUBLISHED (已发布)**: 发布后状态，等待激活
- **ACTIVE (激活)**: 活跃状态，参与流量分配
- **ROLLED_BACK (已回滚)**: 回滚后状态，不再参与流量分配

### 2. 流量分配机制

每个激活版本设置流量百分比(0-100)，根据用户ID哈希值进行流量分配：
```java
int userHash = Math.abs(userId.hashCode());
int bucket = userHash % 100;
// 根据bucket落在哪个版本的流量区间进行分配
```

### 3. 回滚幂等保证

- 重复提交相同版本的回滚请求会被拒绝
- 已处理的回滚事件不会重复执行
- 回滚操作是原子性的，确保状态一致性

### 4. 异常处理机制

- 所有业务异常自动记录到异常日志表
- 保留原始请求参数和错误信息
- 支持人工添加处理结论
- 异常记录可导出用于审计

## 验收测试流程

### 测试1: 正常流程 - 创建并发布版本

```bash
# 1. 创建模板
curl -X POST http://localhost:8080/api/templates \
  -H "Content-Type: application/json" \
  -d '{"templateName":"测试模板","description":"测试","createdBy":"tester"}'

# 2. 创建版本 (DRAFT状态)
curl -X POST http://localhost:8080/api/versions \
  -H "Content-Type: application/json" \
  -d '{"templateId":1,"versionNumber":"v1.0","content":"测试内容","publishedBy":"tester"}'

# 3. 发布版本 (PUBLISHED状态)
curl -X POST http://localhost:8080/api/versions/1/publish

# 4. 激活版本 (ACTIVE状态)
curl -X POST http://localhost:8080/api/versions/1/activate

# 5. 设置流量
curl -X PUT "http://localhost:8080/api/versions/1/traffic?percentage=100"

# 6. 查看版本状态
curl http://localhost:8080/api/versions/1
```

### 测试2: 幂等性测试 - 重复提交相同动作

```bash
# 重复激活相同版本，会返回错误
curl -X POST http://localhost:8080/api/versions/1/activate
# 预期返回: 400错误，状态未变化

# 重复提交相同版本的回滚
curl -X POST http://localhost:8080/api/versions/rollback \
  -H "Content-Type: application/json" \
  -d '{"versionId":1,"rollbackType":"MANUAL","operator":"tester"}'

# 再次提交相同回滚
curl -X POST http://localhost:8080/api/versions/rollback \
  -H "Content-Type: application/json" \
  -d '{"versionId":1,"rollbackType":"MANUAL","operator":"tester"}'
# 预期返回: 400错误，提示"该版本已有待处理的回滚事件"
```

### 测试3: 导出报告 - 验证异常可追溯

```bash
# 先触发一个异常（重复创建相同版本号）
curl -X POST http://localhost:8080/api/versions \
  -H "Content-Type: application/json" \
  -d '{"templateId":1,"versionNumber":"v1.0","content":"重复版本","publishedBy":"tester"}'

# 查看异常日志
curl http://localhost:8080/api/exceptions

# 导出异常日志
curl -O http://localhost:8080/api/export/exception-logs

# 导出完整报告
curl -O http://localhost:8080/api/export/full-report/1
```

## 数据模型说明

### PromptTemplate (提示词模板)
- id: 主键
- templateName: 模板名称（唯一）
- description: 描述
- createdBy: 创建人
- createdAt/updatedAt: 时间戳

### TemplateVersion (模板版本)
- id: 主键
- templateId: 关联模板ID
- versionNumber: 版本号
- content: 提示词内容
- trafficPercentage: 流量占比
- publishedBy: 发布人
- status: 版本状态
- remark: 备注

### HitRecord (命中记录)
- id: 主键
- templateId: 模板ID
- versionId: 版本ID
- requestId: 请求ID
- userId: 用户ID
- modelName: 模型名称
- hitReason: 命中原因
- hitTime: 命中时间
- latencyMs: 延迟毫秒数

### RollbackEvent (回滚事件)
- id: 主键
- templateId: 模板ID
- versionId: 版本ID
- rollbackType: 回滚类型 (AUTO/MANUAL)
- operator: 操作人
- reason: 回滚原因
- previousVersionId: 目标版本ID
- processed: 是否已处理

### ExceptionLog (异常日志)
- id: 主键
- operationType: 操作类型
- originalInput: 原始输入
- errorMessage: 错误信息
- stackTrace: 堆栈信息
- conclusion: 处理结论
- operator: 操作人
- createdAt: 创建时间

## 项目结构

```
src/main/java/com/promptversion/
├── PromptVersionApplication.java    # 启动类
├── config/
│   └── SampleDataInitializer.java   # 样例数据初始化
├── controller/                       # 控制器层
│   ├── TemplateController.java
│   ├── VersionController.java
│   ├── HitRecordController.java
│   ├── ExceptionLogController.java
│   └── ExportController.java
├── dto/                              # 数据传输对象
│   ├── ApiResponse.java
│   ├── CreateTemplateRequest.java
│   ├── CreateVersionRequest.java
│   ├── RollbackRequest.java
│   └── HitRecordRequest.java
├── entity/                           # 数据实体
│   ├── PromptTemplate.java
│   ├── TemplateVersion.java
│   ├── HitRecord.java
│   ├── RollbackEvent.java
│   └── ExceptionLog.java
├── enums/                            # 枚举
│   ├── VersionStatus.java
│   └── RollbackType.java
├── exception/                        # 异常处理
│   ├── BusinessException.java
│   └── GlobalExceptionHandler.java
├── repository/                       # 数据访问层
│   ├── PromptTemplateRepository.java
│   ├── TemplateVersionRepository.java
│   ├── HitRecordRepository.java
│   ├── RollbackEventRepository.java
│   └── ExceptionLogRepository.java
└── service/                          # 业务逻辑层
    ├── TemplateService.java
    ├── VersionService.java
    ├── HitRecordService.java
    └── ExportService.java
```
