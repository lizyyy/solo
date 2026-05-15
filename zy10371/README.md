# 敏感操作双人确认API

## 项目概述

本项目提供了一套完整的敏感操作双人确认机制API，用于确保高风险操作需要经过多人审核确认后才能执行，有效防范误操作和恶意操作。

## 快速开始

### 环境要求
- **JDK 8+** (已验证兼容 Java 8)

### ⚡ 一键启动（推荐）

**macOS/Linux:**
```bash
./start.sh
```

**Windows:**
```cmd
start.bat
```

### 📋 验证API功能

服务启动后，在另一个终端运行：

```bash
./verify-api.sh
```

该脚本会自动测试以下核心功能：
1. ✅ 创建高风险操作
2. ✅ 双人确认流程
3. ✅ 重复确认幂等性
4. ✅ 申请人不能自我确认
5. ✅ 执行凭证验证
6. ✅ JSON/CSV数据导出

### 手动启动方式

如果一键启动脚本无法使用，可以尝试以下方式：

**使用Maven Wrapper（无需安装Maven）:**
```bash
# 编译并打包
./mvnw clean package -DskipTests

# 运行应用
java -jar target/dual-confirmation-api-1.0.0.jar
```

**如果已有Maven环境:**
```bash
mvn spring-boot:run
```

### 访问地址
- **API服务**: http://localhost:8080
- **H2数据库控制台**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:testdb`
  - 用户名: `sa`
  - 密码: (空)

## 核心特性

### 1. 风险等级识别
- **低/中风险**: 需要1人确认
- **高风险**: 需要2人确认（可配置）

### 2. 状态机控制
```
PENDING → CONFIRMING → CONFIRMED → EXECUTING → EXECUTED
                       ↓
                    REJECTED
                       ↓
                   CANCELLED
                       ↓
                    EXPIRED
```

### 3. 幂等性保证
- 重复创建同一操作不会产生脏数据
- 同一确认人重复确认不会产生重复记录

### 4. 执行凭证机制
- 确认完成后生成唯一执行token
- 只有持有有效token才能执行操作
- 执行后token立即失效

### 5. 过期机制
- 高风险操作: 默认1小时过期
- 中低风险操作: 默认24小时过期
- 过期后操作状态自动变为EXPIRED

### 6. 审计追溯
- 记录所有确认人、确认时间
- 记录拒绝原因、撤销人
- 支持JSON和CSV格式导出

## API接口

### 创建操作
```http
POST /api/operations
Content-Type: application/json

{
    "requestId": "OP_001",
    "operationType": "BALANCE_ADJUST",
    "requesterId": "user001",
    "requesterName": "张三",
    "riskLevel": "HIGH",
    "operationData": "{\"account\":\"12345\",\"amount\":10000}",
    "expireMinutes": 60
}
```

### 查询操作
```http
GET /api/operations/{operationId}
GET /api/operations?status=CONFIRMING
GET /api/operations?requesterId=user001
```

### 确认操作
```http
POST /api/operations/{operationId}/confirm
Content-Type: application/json

{
    "confirmerId": "user002",
    "confirmerName": "李四",
    "comment": "审核通过"
}
```

### 拒绝操作
```http
POST /api/operations/{operationId}/reject
Content-Type: application/json

{
    "rejectorId": "user002",
    "rejectorName": "李四",
    "rejectReason": "金额异常"
}
```

### 撤销操作
```http
POST /api/operations/{operationId}/cancel
Content-Type: application/json

{
    "cancellerId": "user001",
    "cancellerName": "张三"
}
```

### 执行操作
```http
POST /api/operations/{operationId}/execute?token=TOKEN_XXX
```

### 导出数据
```http
GET /api/operations/export/json
GET /api/operations/export/csv
```

## 配置说明

```yaml
app:
  confirmation:
    default-expire-minutes: 1440    # 默认过期时间（分钟）
    high-risk-expire-minutes: 60    # 高风险过期时间（分钟）
    required-confirmers: 2          # 高风险需要确认人数
```

## 项目文件结构

```
sensitive-operation-api/
├── pom.xml                          # Maven配置（Java 8兼容）
├── mvnw / mvnw.cmd                  # Maven Wrapper脚本（无需安装Maven）
├── start.sh / start.bat             # ⭐ 一键启动脚本
├── verify-api.sh                    # ⭐ API功能验证脚本
├── README.md                        # 本文档
├── .mvn/
│   ├── wrapper/
│   │   └── maven-wrapper.properties # Wrapper配置
│   └── jvm.config                   # JVM参数配置
└── src/
    ├── main/
    │   ├── java/com/sensitive/operation/
    │   │   ├── DualConfirmationApplication.java
    │   │   ├── config/
    │   │   ├── controller/
    │   │   ├── service/
    │   │   ├── repository/
    │   │   ├── model/
    │   │   ├── dto/
    │   │   ├── enums/
    │   │   └── exception/
    │   └── resources/
    │       └── application.yml
    └── test/
        └── java/com/sensitive/operation/
            ├── SensitiveOperationServiceTest.java  # 业务逻辑测试
            └── SensitiveOperationApiTest.java      # API集成测试
```

## 测试覆盖场景

### 核心流程测试
- ✅ 创建不同风险等级操作
- ✅ 中低风险1人确认流程
- ✅ 高风险双人确认流程
- ✅ 拒绝操作流程
- ✅ 撤销操作流程
- ✅ 执行操作（凭证验证）

### 幂等性测试
- ✅ 重复创建同一操作
- ✅ 同一人重复确认

### 异常场景测试
- ✅ 申请人不能确认自己的操作
- ✅ 无效执行凭证
- ✅ 查询不存在的操作
- ✅ 操作过期后不能确认
- ✅ 状态不允许跳转（已执行不能撤销、已拒绝不能确认等）

### API测试
- ✅ 参数校验
- ✅ 完整流程API调用
- ✅ 导出功能
- ✅ 异常响应处理

## 状态流转规则

| 当前状态 | 允许的操作 |
|---------|-----------|
| PENDING | confirm, reject, cancel |
| CONFIRMING | confirm, reject, cancel |
| CONFIRMED | execute, cancel |
| EXECUTED | - |
| REJECTED | - |
| CANCELLED | - |
| EXPIRED | - |

## 典型使用场景

1. **财务调账**: 高风险金额调整需要财务主管+经理双人确认
2. **用户权限变更**: 管理员权限变更需要双人审核
3. **批量数据删除**: 生产环境数据删除需要多人确认
4. **系统配置变更**: 核心配置修改需要审核确认

## 技术栈

- **框架**: Spring Boot 2.7.x
- **数据库**: H2（内存数据库，可替换为MySQL/PostgreSQL）
- **验证**: JSR-380 Bean Validation
- **测试**: JUnit 5 + RestAssured
- **构建**: Maven 3.8.x (通过Wrapper提供)
- **Java版本**: 1.8+ (已验证兼容)

## 常见问题

**Q: 提示缺少Maven怎么办？**
A: 本项目已包含Maven Wrapper，直接使用 `./mvnw` 或运行 `start.sh` 即可，无需安装Maven。

**Q: 如何在离线环境运行？**
A: 如果有预编译的JAR包，直接运行 `java -jar target/dual-confirmation-api-1.0.0.jar` 即可。

**Q: 如何修改数据库配置？**
A: 修改 `src/main/resources/application.yml` 中的数据库连接配置，支持MySQL、PostgreSQL等。

**Q: 如何调整高风险操作需要的确认人数？**
A: 在 `application.yml` 中修改 `app.confirmation.required-confirmers` 参数。
