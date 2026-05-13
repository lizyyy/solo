# API 字段血缘服务

一个基于 Spring Boot 的 API 字段血缘追踪服务，用于追踪 API 响应字段的来源、依赖关系和变更历史。

## 功能特性

- **血缘登记**: 记录 API 响应字段的来源表、计算规则和依赖接口
- **依赖展开**: 递归展开字段的所有依赖关系
- **影响分析**: 查询某个数据库字段或 API 变更会影响哪些下游字段
- **变更留痕**: 记录所有状态变更和操作历史
- **血缘导出**: 导出完整的血缘信息，包括依赖和历史
- **状态管理**: 支持 DRAFT -> VALIDATING -> VALID/INVALID -> DEPRECATED -> ARCHIVED 的状态流转

## 技术栈

- Java 11
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database (文件持久化)
- Lombok

## 快速开始

### 构建项目

```bash
mvn clean package
```

### 运行服务

```bash
java -jar target/api-field-lineage-service-1.0.0-SNAPSHOT.jar
```

服务默认运行在 `http://localhost:8080`

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

## 错误码

- `LINEAGE_NOT_FOUND`: 血缘记录不存在
- `LINEAGE_ALREADY_EXISTS`: 血缘记录已存在（相同 API 路径和响应字段）
- `INVALID_STATUS_TRANSITION`: 不允许的状态转换
- `VALIDATION_FAILED`: 参数验证失败

## 数据持久化

数据存储在 `./data/lineage-db` 文件中，服务重启后数据不会丢失。
