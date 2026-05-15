# API 响应差异归档系统

基于 Spring Boot 的 API 响应差异归档系统，用于对比和归档不同版本 API 响应的差异。

## 技术栈

- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (文件存储模式)
- Jackson (JSON处理)
- Apache Commons CSV
- Lombok

## 核心功能

### 1. 版本对比
- 支持 JSON 深度对比
- 识别字段新增、缺失、值变化、类型不匹配等差异
- 支持嵌套对象和数组对比

### 2. 差异归档
- 持久化存储所有差异记录
- 记录完整请求信息和响应内容
- 支持请求去重（基于 SHA-256 哈希）

### 3. 字段归因
- 支持对差异字段进行备注说明
- 记录归因人和时间

### 4. 确认闭环
- 多状态流转：待处理 → 分析中 → 确认/拒绝 → 归档
- 状态变更操作日志记录

### 5. 回归导出
- 支持 CSV 格式导出
- 支持按条件筛选导出数据

## API 接口

### 基础路径
`http://localhost:8080/api`

### 接口列表

#### 1. 创建差异记录
```
POST /diffs
Content-Type: application/json

{
  "apiPath": "/api/users/1",
  "httpMethod": "GET",
  "requestHeaders": {
    "Content-Type": "application/json"
  },
  "requestBody": null,
  "queryParams": null,
  "versionA": "v1.0.0",
  "responseA": {
    "id": 1,
    "name": "张三",
    "age": 25
  },
  "statusCodeA": 200,
  "responseTimeA": 100,
  "versionB": "v1.1.0",
  "responseB": {
    "id": 1,
    "name": "张三",
    "age": 26,
    "email": "zhangsan@example.com"
  },
  "statusCodeB": 200,
  "responseTimeB": 150,
  "createdBy": "admin",
  "tags": "user-api,regression"
}
```

#### 2. 查询单个差异记录
```
GET /diffs/{id}
```

#### 3. 分页查询差异记录
```
POST /diffs/query
Content-Type: application/json

{
  "status": "PENDING",
  "apiPath": "/api/users",
  "hasDifferences": true,
  "startTime": "2024-01-01T00:00:00",
  "endTime": "2024-12-31T23:59:59",
  "page": 0,
  "size": 20
}
```

#### 4. 更新状态
```
PUT /diffs/{id}/status
Content-Type: application/json

{
  "status": "CONFIRMED_BUG",
  "attributionNote": "年龄字段逻辑调整，预期行为",
  "operatedBy": "tester",
  "remark": "已和开发确认"
}
```

#### 5. 删除差异记录
```
DELETE /diffs/{id}?operatedBy=admin
```

#### 6. 查看操作日志
```
GET /diffs/{id}/logs
```

#### 7. 导出CSV
```
POST /diffs/export
Content-Type: application/json

{
  "status": "PENDING",
  "apiPath": null,
  "hasDifferences": null,
  "startTime": null,
  "endTime": null
}
```

## 状态枚举

| 状态值 | 说明 |
|--------|------|
| PENDING | 待处理 |
| ANALYZING | 分析中 |
| CONFIRMED_EXPECTED | 已确认-预期行为 |
| CONFIRMED_BUG | 已确认-BUG |
| CONFIRMED_ENV | 已确认-环境问题 |
| REJECTED | 已拒绝 |
| ARCHIVED | 已归档 |

## 差异类型枚举

| 类型值 | 说明 |
|--------|------|
| VALUE_CHANGED | 值变化 |
| FIELD_MISSING | 字段缺失 |
| FIELD_ADDED | 字段新增 |
| TYPE_MISMATCH | 类型不匹配 |
| NULLABILITY_CHANGED | 空值变化 |

## 数据库

### H2 控制台
访问地址：`http://localhost:8080/api/h2-console`

JDBC URL：`jdbc:h2:file:./data/api_diff_db`

用户名：`sa`

密码：（空）

### 主要数据表

- `api_diff_records` - 差异记录主表
- `diff_fields` - 差异字段明细表
- `operation_logs` - 操作日志表

## 运行项目

### 编译
```bash
mvn clean package
```

### 运行
```bash
mvn spring-boot:run
```

或直接运行 JAR 包：
```bash
java -jar target/api-diff-archive-1.0.0.jar
```

## 项目结构

```
api-diff-archive/
├── src/main/java/com/apidiff/
│   ├── ApiDiffArchiveApplication.java  # 启动类
│   ├── config/                         # 配置类
│   │   └── JacksonConfig.java
│   ├── controller/                     # 控制器
│   │   └── ApiDiffController.java
│   ├── dto/                            # 数据传输对象
│   │   ├── ApiDiffRequest.java
│   │   ├── ApiDiffResponse.java
│   │   ├── ApiResponse.java
│   │   ├── DiffFieldDTO.java
│   │   ├── DiffQueryRequest.java
│   │   └── StatusUpdateRequest.java
│   ├── entity/                         # 实体类
│   │   ├── ApiDiffRecord.java
│   │   ├── DiffField.java
│   │   ├── OperationLog.java
│   │   └── enums/
│   │       ├── ConfirmationStatus.java
│   │       └── DiffType.java
│   ├── exception/                      # 异常处理
│   │   └── GlobalExceptionHandler.java
│   ├── repository/                     # 数据访问层
│   │   ├── ApiDiffRecordRepository.java
│   │   ├── DiffFieldRepository.java
│   │   └── OperationLogRepository.java
│   └── service/                        # 业务逻辑层
│       ├── ApiDiffService.java
│       └── JsonDiffService.java
├── src/main/resources/
│   └── application.yml                  # 配置文件
└── pom.xml                              # Maven配置
```

## 特性说明

### 重复提交防重
系统通过对请求关键信息（API路径、HTTP方法、请求体、查询参数、版本号）计算 SHA-256 哈希值，实现重复提交的识别，避免脏数据产生。

### 完整操作审计
所有状态变更和删除操作都会记录操作日志，包括操作人、操作时间、前后值等信息。

### 灵活的查询条件
支持按状态、API路径、是否有差异、时间范围等多维度组合查询。

### CSV导出
支持将查询结果导出为 CSV 格式，便于进行离线分析和报告生成。
