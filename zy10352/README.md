# API 字段血缘服务

一个基于 Spring Boot 的 API 字段血缘追踪服务，用于追踪 API 响应字段的来源、依赖关系和变更历史。

## 功能特性

- **血缘登记**: 记录 API 响应字段的来源表、计算规则和依赖接口
- **依赖展开**: 递归展开字段的所有依赖关系
- **影响分析**: 查询某个数据库字段或 API 变更会影响哪些下游字段
- **变更留痕**: 记录所有状态变更和操作历史
- **血缘导出**: 导出完整的血缘信息，包括依赖和历史
- **状态管理**: 支持 DRAFT → VALIDATING → VALID/INVALID → DEPRECATED → ARCHIVED 的状态流转
- **完善校验**: 完整的参数校验和友好的错误返回

## 技术栈

- Java 11
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database (文件持久化)
- Lombok

## 环境要求

- **Java**: 11 或更高版本
- **Maven**: 3.6 或更高版本（或使用 Maven Wrapper）

## 快速开始

### 方式一：使用启动脚本（推荐）

#### Linux / macOS

```bash
# 构建并启动
./start.sh

# 或分别执行
./start.sh build    # 仅构建
./start.sh start    # 仅启动

# 查看帮助
./start.sh help
```

#### Windows

```batch
# 构建并启动
start.bat

# 或分别执行
start.bat build    # 仅构建
start.bat start    # 仅启动

# 查看帮助
start.bat help
```

### 方式二：使用 Maven 命令

```bash
# 构建项目
mvn clean package -DskipTests

# 运行服务
java -jar target/api-field-lineage-service-1.0.0-SNAPSHOT.jar
```

### 方式三：使用 Maven Wrapper（如果有 mvnw 文件）

```bash
# Linux / macOS
./mvnw clean package -DskipTests
./mvnw spring-boot:run

# Windows
mvnw.cmd clean package -DskipTests
mvnw.cmd spring-boot:run
```

服务运行在 `http://localhost:8080`

### 访问 H2 控制台

- URL: `http://localhost:8080/h2-console`
- JDBC URL: `jdbc:h2:file:./data/lineage-db`
- Username: `sa`
- Password: `password`

## API 接口

### 1. 创建血缘记录

```bash
POST /api/v1/lineage
Content-Type: application/json

{
  "apiPath": "/api/v1/orders",
  "apiMethod": "GET",
  "apiName": "获取订单列表",
  "responseField": "totalAmount",
  "fieldPath": "data.totalAmount",
  "fieldType": "DOUBLE",
  "description": "订单总金额",
  "exampleValue": "1000.00",
  "sourceTables": [
    {
      "tableName": "orders",
      "schemaName": "order_db",
      "columnName": "amount",
      "columnType": "decimal(10,2)",
      "description": "订单金额",
      "dataSource": "order_master"
    }
  ],
  "calculationRule": {
    "ruleName": "订单金额汇总",
    "ruleType": "AGGREGATION",
    "ruleExpression": "SUM(amount)",
    "description": "汇总订单金额"
  },
  "dependentApis": [
    {
      "apiPath": "/api/v1/products",
      "apiMethod": "GET",
      "apiName": "获取商品列表",
      "responseField": "price",
      "description": "依赖商品价格"
    }
  ],
  "createdBy": "user1"
}
```

**请求示例（含非法值测试）：**

```bash
# 测试：缺少必填字段
curl -X POST http://localhost:8080/api/v1/lineage \
  -H "Content-Type: application/json" \
  -d '{"apiPath": "", "responseField": "test"}'

# 测试：嵌套对象字段非法
curl -X POST http://localhost:8080/api/v1/lineage \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/test",
    "apiMethod": "GET",
    "responseField": "test",
    "createdBy": "user1",
    "sourceTables": [{"tableName": "", "columnName": "test"}]
  }'
```

### 2. 查询血缘记录

```bash
GET /api/v1/lineage/{id}
```

### 3. 按 API 路径查询

```bash
GET /api/v1/lineage/search?apiPath=/api/v1/orders
```

### 4. 验证血缘记录

```bash
POST /api/v1/lineage/{id}/validate?operator=admin
```

### 5. 更新状态

```bash
PUT /api/v1/lineage/{id}/status?newStatus=DEPRECATED&reason=接口已废弃&operator=admin
```

### 6. 影响分析 - 按数据库字段

```bash
GET /api/v1/lineage/impact/table?tableName=orders&columnName=amount
```

### 7. 影响分析 - 按 API

```bash
GET /api/v1/lineage/impact/api?dependentApiPath=/api/v1/products
```

### 8. 展开依赖关系

```bash
GET /api/v1/lineage/{id}/dependencies?maxDepth=5
```

### 9. 查询变更历史

```bash
GET /api/v1/lineage/{id}/history
```

### 10. 导出血缘信息

```bash
GET /api/v1/lineage/{id}/export
```

## 核心 API 流程体验

服务启动后，您可以按以下顺序体验完整流程：

1. **创建血缘记录** - 调用 POST `/api/v1/lineage` 创建记录
2. **查询记录** - 调用 GET `/api/v1/lineage/{id}` 查看详情
3. **验证记录** - 调用 POST `/api/v1/lineage/{id}/validate` 执行验证
4. **状态推进** - 调用 PUT `/api/v1/lineage/{id}/status` 更新状态
5. **查询历史** - 调用 GET `/api/v1/lineage/{id}/history` 查看变更历史
6. **导出信息** - 调用 GET `/api/v1/lineage/{id}/export` 导出完整信息

## 样例数据

服务启动时会自动创建样例数据，包括：

### 成功流样例
- API: `/api/v1/orders` - `totalAmount` 字段
- 包含来源表、计算规则
- 已通过验证，状态为 VALID

### 问题流样例
- API: `/api/v1/users` - `userName` 字段
- 包含来源表和依赖 API
- API: `/api/v1/invalid` - `invalidField` 字段
- 缺少来源表，验证失败，状态为 INVALID
- 已被重置为 DRAFT 状态

## 状态流转图

```
DRAFT → VALIDATING → VALID → DEPRECATED → ARCHIVED
           ↓
         INVALID → DRAFT
```

## 错误码和异常处理

服务提供完善的异常处理和错误返回：

| 错误码 | 说明 |
|--------|------|
| `LINEAGE_NOT_FOUND` | 血缘记录不存在 |
| `LINEAGE_ALREADY_EXISTS` | 血缘记录已存在（相同 API 路径和响应字段） |
| `INVALID_STATUS_TRANSITION` | 不允许的状态转换 |
| `VALIDATION_FAILED` | 参数校验失败 |
| `INVALID_PARAMETER` | 无效参数 |
| `INVALID_REQUEST_BODY` | 请求体格式错误 |
| `METHOD_NOT_ALLOWED` | 不支持的 HTTP 方法 |
| `UNSUPPORTED_MEDIA_TYPE` | 不支持的媒体类型 |
| `NULL_POINTER_ERROR` | 系统内部空指针错误 |
| `INTERNAL_ERROR` | 系统内部错误 |

## 数据持久化

数据存储在 `./data/lineage-db` 文件中，服务重启后数据不会丢失。

## 项目结构

```
.
├── pom.xml                    # Maven 配置文件
├── start.sh                   # Linux/Mac 启动脚本
├── start.bat                  # Windows 启动脚本
├── README.md                  # 项目说明文档
├── src/main/java/com/lineage/
│   ├── ApiFieldLineageApplication.java    # 启动类
│   ├── config/
│   │   └── SampleDataInitializer.java     # 样例数据初始化
│   ├── controller/
│   │   └── FieldLineageController.java    # API 控制器
│   ├── dto/
│   │   ├── ApiResponse.java
│   │   ├── CalculationRuleDto.java
│   │   ├── DependentApiDto.java
│   │   ├── FieldLineageCreateRequest.java
│   │   ├── LineageDependency.java
│   │   ├── LineageExport.java
│   │   └── SourceTableDto.java
│   ├── entity/
│   │   ├── CalculationRule.java
│   │   ├── DependentApi.java
│   │   ├── FieldLineage.java
│   │   ├── LineageHistory.java
│   │   └── SourceTable.java
│   ├── enums/
│   │   ├── FieldType.java
│   │   └── LineageStatus.java
│   ├── exception/
│   │   ├── ErrorCode.java
│   │   ├── GlobalExceptionHandler.java
│   │   └── LineageException.java
│   ├── repository/
│   │   ├── FieldLineageRepository.java
│   │   └── LineageHistoryRepository.java
│   └── service/
│       └── FieldLineageService.java
└── src/main/resources/
    └── application.yml        # 应用配置
```

## 故障排除

### Java 版本错误

如果遇到 `UnsupportedClassVersionError`，请检查 Java 版本：

```bash
java -version
```

确保 Java 版本 >= 11。

### Maven 未找到

如果系统没有安装 Maven，您可以：
1. 安装 Maven 3.6 或更高版本
2. 或者下载 Maven Wrapper 到项目目录

### 找不到 Jar 文件

确保您已经执行过构建操作：

```bash
# Linux/Mac
./start.sh build

# Windows
start.bat build

# 或直接使用 Maven
mvn clean package -DskipTests
```
