# 数据修复脚本审批 API

统一数据修复脚本审批流程的后端服务，实现脚本登记、试跑预览、审批门禁、执行跟踪、回滚证明等核心功能。

## 技术栈

- Java 8+
- Spring Boot 2.7.x
- MyBatis Plus 3.5.3
- H2 Database (开发验证) / MySQL 8.0 (生产)
- Lombok
- Hutool

## 快速开始

### 前置要求

- JDK 8+
- Maven 3.6+（项目已内置 Maven Wrapper，无需系统安装）

### 启动方式

#### 方式一：使用启动脚本（推荐）

```bash
# 终端1：编译并启动服务（使用H2内存数据库，无需外部依赖）
./start.sh

# 终端2：服务启动后，运行健康检查（自动验证所有核心API）
./health-check.sh
```

**说明：**
- `./start.sh` 会自动使用 Maven Wrapper (`./mvnw`)，无需系统安装 Maven
- 首次启动需要下载依赖，可能需要 1-3 分钟
- 使用 H2 内存数据库，数据仅在内存中，重启后清空
- 服务启动后会在控制台显示 `Started DataRepairApprovalApplication`

### 访问地址

- **API 基础地址**: http://localhost:8080/api
- **健康检查**: http://localhost:8080/api/health
- **H2 控制台**: http://localhost:8080/api/h2-console (仅H2模式)
  - JDBC URL: `jdbc:h2:mem:data_repair`
  - Username: `sa`
  - Password: (空)

## API 接口

所有写操作均支持**幂等性**，通过 `requestId` 参数控制。相同的 `requestId` 重复提交不会产生脏数据。

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
    "requestId": "REQ_20240516_001",
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
curl -X POST http://localhost:8080/api/repair-scripts/submit \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "operator": "张三",
    "requestId": "SUBMIT_20240516_001"
  }'
```

### 3. 执行试跑

```bash
curl -X POST http://localhost:8080/api/repair-scripts/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "operator": "张三",
    "requestId": "DRYRUN_20240516_001"
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
    "requestId": "APV_20240516_001"
  }'
```

### 5. 正式执行

```bash
curl -X POST http://localhost:8080/api/repair-scripts/execute \
  -H "Content-Type: application/json" \
  -d '{
    "scriptId": 1,
    "operator": "张三",
    "requestId": "EXEC_20240516_001"
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
    "requestId": "RBK_20240516_001"
  }'
```

### 7. 查询接口

```bash
# 查询脚本基本信息
curl http://localhost:8080/api/repair-scripts/{id}

# 查询脚本完整详情（含关联数据）
curl http://localhost:8080/api/repair-scripts/{id}/detail

# 查询问题排查报告
curl http://localhost:8080/api/repair-scripts/{id}/troubleshoot-report

# 分页查询
curl "http://localhost:8080/api/repair-scripts/page?pageNum=1&pageSize=10"
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

所有写操作通过 `requestId` 参数实现幂等：
- 内存缓存最近 60 分钟内的请求
- 相同 `requestId` 重复提交直接返回已有结果
- 不会产生脏数据

**支持幂等的接口：**
- 创建脚本
- 提交审批
- 执行试跑
- 审批操作
- 正式执行
- 回滚操作

### 2. 枚举持久化

通过自定义 `CodeEnumTypeHandler` 实现枚举与数据库 INT 字段的双向转换：
- 枚举值存储为数字，查询时自动转为枚举对象
- 支持 `@EnumValue` 注解标记枚举值字段

### 3. 时间线追踪

每个关键操作自动记录时间线：
- 记录操作人、操作时间、状态变更
- 支持完整的操作审计回溯

### 4. 问题排查汇总

生成完整的问题排查报告，包含：
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
│   ├── HealthController.java              # 健康检查接口
│   └── RepairScriptController.java        # 脚本API接口
├── dto/                                   # 数据传输对象
│   ├── RepairScriptCreateDTO.java
│   ├── SubmitDTO.java
│   ├── DryRunDTO.java
│   ├── ApprovalDTO.java
│   ├── ExecuteDTO.java
│   ├── RollbackDTO.java
│   └── ...
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
    ├── IdempotencyService.java            # 幂等性服务
    └── TroubleshootService.java           # 问题排查服务
```

## 常见问题

### 1. Maven Wrapper 无法下载依赖

如果网络问题导致依赖下载失败：
- 配置 Maven 镜像源（阿里云）
- 或者手动将依赖包放入 `~/.m2/repository` 目录

### 2. 启动失败提示端口被占用

检查并关闭占用 8080 端口的进程：
```bash
lsof -i :8080
kill -9 <PID>
```

### 3. H2控制台无法访问

确保：
- 服务已正常启动（检查健康检查接口）
- 访问路径包含 context-path: `/api/h2-console`
- JDBC URL 正确：`jdbc:h2:mem:data_repair`

## 许可证

MIT License
