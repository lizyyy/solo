# 数据修复脚本审批 API

统一数据修复脚本审批流程的后端服务，实现脚本登记、试跑预览、审批门禁、执行跟踪、回滚证明等核心功能。

## 技术栈

- Java 11
- Spring Boot 2.7.x
- MyBatis Plus 3.5.3
- H2 Database (开发验证) / MySQL 8.0 (生产)
- Lombok
- Hutool

## 快速开始

### 前置要求

- JDK 11+
- Maven 3.6+

### 启动方式

#### 方式一：使用启动脚本（推荐）

```bash
# 编译并启动（使用H2内存数据库，无需MySQL）
./start.sh

# 或 Windows
start.bat
```

#### 方式二：Maven命令启动

```bash
# 使用H2内存数据库（默认）
mvn clean spring-boot:run -Dspring.profiles.active=h2

# 使用MySQL数据库
mvn clean spring-boot:run -Dspring.profiles.active=mysql
```

### 访问地址

- API 基础地址: http://localhost:8080/api
- H2 控制台: http://localhost:8080/api/h2-console
  - JDBC URL: `jdbc:h2:mem:data_repair`
  - Username: `sa`
  - Password: (空)

### 健康检查

```bash
curl http://localhost:8080/api/health
```

## API 接口

### 1. 创建修复脚本

```bash
curl -X POST http://localhost:8080/api/repair-scripts \
  -H "Content-Type: application/json" \
  -d '{
    "scriptName": "用户数据修复脚本",
    "scriptType": "UPDATE",
    "scriptContent": "UPDATE users SET status = 1 WHERE id > 100",
    "rollbackScript": "UPDATE users SET status = 0 WHERE id > 100",
    "description": "修复异常用户状态",
    "businessSystem": "用户中心",
    "databaseName": "user_db",
    "applicant": "张三",
    "applicantDept": "技术部",
    "requestId": "REQ_" + $(date +%s),
    "targetScopes": [
      {
        "scopeType": "TABLE",
        "tableName": "users",
        "primaryKey": "id",
        "whereCondition": "id > 100",
        "estimatedRows": 500,
        "columnsAffected": "status"
      }
    ]
  }'
```

### 2. 提交审批

```bash
curl -X POST http://localhost:8080/api/repair-scripts/{scriptId}/submit?operator=张三
```

### 3. 执行试跑

```bash
curl -X POST http://localhost:8080/api/repair-scripts/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "operator": "张三",
    "requestId": "DRY_RUN_" + $(date +%s)
  }'
```

### 4. 审批通过/拒绝

```bash
curl -X POST http://localhost:8080/api/repair-scripts/approve \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "action": 2,
    "approver": "李四",
    "approverDept": "技术部",
    "opinion": "同意执行",
    "approvalLevel": 1,
    "passed": true,
    "requestId": "APV_" + $(date +%s)
  }'
```

### 5. 正式执行

```bash
curl -X POST http://localhost:8080/api/repair-scripts/execute \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "operator": "张三",
    "requestId": "EXEC_" + $(date +%s)
  }'
```

### 6. 回滚操作

```bash
curl -X POST http://localhost:8080/api/repair-scripts/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "executionBatchId": 123,
    "rollbackProof": "已验证数据一致性",
    "operator": "张三",
    "requestId": "RBK_" + $(date +%s)
  }'
```

### 7. 查询详情

```bash
# 查询脚本基本信息
curl http://localhost:8080/api/repair-scripts/{scriptId}

# 查询脚本完整详情（含关联数据）
curl http://localhost:8080/api/repair-scripts/{scriptId}/detail

# 查询问题排查报告
curl http://localhost:8080/api/repair-scripts/{scriptId}/troubleshoot-report
```

### 8. 分页查询

```bash
curl "http://localhost:8080/api/repair-scripts/page?pageNum=1&pageSize=10&status=0"
```

## 自检验证

### 运行完整自检

```bash
# 启动服务后运行自检脚本
./health-check.sh
```

### 手动验证核心流程

```bash
# 1. 健康检查
curl http://localhost:8080/api/health

# 2. 创建脚本
export REQ_ID="TEST_$(date +%s)"
curl -X POST http://localhost:8080/api/repair-scripts \
  -H "Content-Type: application/json" \
  -d "{\"scriptName\":\"测试脚本\",\"scriptType\":\"UPDATE\",\"scriptContent\":\"SELECT 1\",\"description\":\"测试\",\"businessSystem\":\"测试系统\",\"databaseName\":\"test_db\",\"applicant\":\"test\",\"requestId\":\"${REQ_ID}\",\"targetScopes\":[{\"scopeType\":\"TABLE\",\"tableName\":\"test\",\"whereCondition\":\"1=1\",\"estimatedRows\":1}]}"

# 3. 查看脚本列表
curl http://localhost:8080/api/repair-scripts/page
```

## 脚本状态流转

```
草稿(0) → 已提交(1) → 试跑中(4) → 试跑成功(5)
                          ↓
                    待审批(6) → 已批准(7) / 已拒绝(8)
                          ↓
                    执行中(9) → 执行成功(10) / 执行失败(11)
                          ↓
                    回滚中(12) → 回滚成功(13) / 回滚失败(14)
```

## 核心特性

### 1. 幂等性保证

- 所有写操作通过 `requestId` 参数实现幂等
- 重复提交不会产生脏数据

### 2. 枚举持久化

- 通过 `CodeEnumTypeHandler` 实现枚举与数据库 INT 字段的双向转换
- 使用 `@EnumValue` 注解标记枚举值字段

### 3. 时间线追踪

- 每个关键操作自动记录时间线
- 记录操作人、操作时间、状态变更、详细信息
- 支持完整的操作审计回溯

### 4. 问题排查汇总

- 脚本基本信息汇总
- 目标范围分析（影响表、预估行数）
- 试跑历史统计
- 执行批次汇总
- 回滚记录分析
- 完整操作时间线
- 风险指标识别

## 配置说明

### 切换数据库

在 `application.yml` 中修改 `spring.profiles.active`:

```yaml
# 使用H2内存数据库（默认，无需外部依赖）
spring:
  profiles:
    active: h2

# 使用MySQL数据库
spring:
  profiles:
    active: mysql
```

### MySQL 数据库初始化

执行 `src/main/resources/schema.sql` 创建数据库表结构。

## 项目结构

```
src/main/java/com/datarepair/approval/
├── DataRepairApprovalApplication.java    # 启动类
├── common/                                # 通用类
│   └── Result.java                        # 统一返回结果
├── config/                                # 配置类
│   ├── MybatisPlusConfig.java             # MyBatis Plus配置
│   └── MyMetaObjectHandler.java           # 自动填充处理器
├── controller/                            # 控制层
│   └── RepairScriptController.java        # 脚本API
├── dto/                                   # 数据传输对象
├── entity/                                # 实体类
├── enums/                                 # 枚举类
├── exception/                             # 异常处理
│   ├── BusinessException.java             # 业务异常
│   └── GlobalExceptionHandler.java        # 全局异常拦截
├── handler/                               # 类型处理器
│   └── CodeEnumTypeHandler.java           # 枚举类型处理器
├── mapper/                                # 数据访问层
└── service/                               # 业务逻辑层
    ├── RepairScriptService.java           # 核心业务服务
    ├── TimelineService.java               # 时间线服务
    └── TroubleshootService.java           # 问题排查服务
```

## 常见问题

### 1. 枚举值读写失败

确保实体类枚举字段添加了 `@TableField(typeHandler = CodeEnumTypeHandler.class)` 注解，
并且 `@TableName` 添加了 `autoResultMap = true` 属性。

### 2. H2控制台访问404

确保访问路径包含 context-path：`http://localhost:8080/api/h2-console`

### 3. 启动失败提示缺少表

H2模式会自动初始化表结构，MySQL模式需要先执行 schema.sql。

## 许可证

MIT License
