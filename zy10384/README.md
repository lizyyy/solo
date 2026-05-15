# 资源标签继承 API

Resource Tag Inheritance API - 解决重复调用和状态不明痛点的后端服务

## 项目概述

这是一个基于 Spring Boot 的标签继承计算服务，主要用于资源节点的标签继承计算，具备以下核心特性：

- **幂等性保证**: 基于 requestId 的重复请求拦截，返回真正的 HTTP 409 状态码，防止脏数据产生
- **状态机管理**: 清晰的任务状态推进（PENDING → VALIDATING → INHERITING → CONFLICT → COMPLETED/FAILED）
- **冲突检测**: 只有相同优先级不同值时才产生冲突，覆盖规则应用后自动清除冲突
- **历史记录**: 完整的变更历史追踪与导出
- **结果缓存**: 任务状态的缓存机制

## 技术栈

- **Java 8+** (完全兼容 Java 8 到 Java 21，已验证 ✅)
- **Spring Boot 2.7.18** (Java 8 兼容版本，javax 命名空间)
- Spring Data JPA
- H2 Database (内存)
- Spring Cache
- Lombok

## 快速启动

### 前置条件
- **JDK 8 或更高版本**（需要 javac 编译器，不是 JRE）
  - 下载地址: https://www.oracle.com/java/technologies/downloads/

### 第一步: 验证项目

```bash
# 验证项目完整性和 Java 兼容性
chmod +x verify.sh
./verify.sh
```

### 第二步: 启动项目

```bash
# 方式 1: 使用 Maven Wrapper（推荐，无需安装 Maven）
chmod +x mvnw
./mvnw spring-boot:run

# 方式 2: 如果有系统 Maven
mvn spring-boot:run

# 方式 3: 打包成 JAR 后运行
./mvnw clean package -DskipTests
java -jar target/tag-inheritance-api-1.0.0.jar
```

### 访问地址
- API 服务: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:tag_inheritance
  - Username: sa
  - Password: (空)

## 核心数据对象

| 对象 | 说明 |
|------|------|
| ResourceNode | 资源节点，支持层级关系 |
| Tag | 标签，key-value 结构，带优先级 |
| OverrideRule | 覆盖规则，强制覆盖特定节点的标签值 |
| ConflictItem | 冲突项，记录标签值冲突及解决状态 |
| CalculationResult | 计算结果，标签继承的最终结果 |
| ChangeHistory | 变更历史，记录所有操作轨迹 |
| InheritanceTask | 继承任务，包含状态、执行信息 |

## 关键接口

### 1. 创建任务
```
POST /api/v1/tag-inheritance/tasks
```
**请求体**:
```json
{
  "requestId": "REQ_001",
  "targetNodeId": "PROJ_001",
  "createdBy": "admin"
}
```

> **重要**: `requestId` 是幂等性的关键！相同 requestId 的重复请求会被拦截，返回 **HTTP 409 Conflict** 真正的状态码。

### 2. 验证任务
```
POST /api/v1/tag-inheritance/tasks/{taskId}/validate
```
- 验证节点祖先链是否存在循环引用
- 状态从 PENDING → VALIDATING → INHERITING

### 3. 执行继承计算
```
POST /api/v1/tag-inheritance/tasks/{taskId}/calculate
```
- 收集所有祖先标签
- 应用覆盖规则
- 检测冲突
- 生成计算结果

### 4. 查询任务状态
```
GET /api/v1/tag-inheritance/tasks/{taskId}/status
```

### 5. 查询冲突列表
```
GET /api/v1/tag-inheritance/tasks/{taskId}/conflicts
```

### 6. 解决冲突
```
POST /api/v1/tag-inheritance/tasks/{taskId}/conflicts/{conflictId}/resolve
```
**请求体**:
```json
{
  "resolution": "PARENT_WINS",
  "resolvedBy": "admin",
  "resolvedValue": "custom_value"
}
```
支持的冲突解决方式:
- `PARENT_WINS` - 父级值获胜
- `CHILD_WINS` - 子级值获胜
- `MANUAL_OVERRIDE` - 手动指定值
- `SKIP` - 跳过

### 7. 查询计算结果
```
GET /api/v1/tag-inheritance/tasks/{taskId}/results
```

### 8. 查询变更历史
```
GET /api/v1/tag-inheritance/tasks/{taskId}/history
```

### 9. 导出历史
```
GET /api/v1/tag-inheritance/tasks/{taskId}/history/export
```

## 核心规则

### 标签继承规则
1. 从根节点向下遍历到目标节点
2. 相同 key 的标签，优先级高的值覆盖优先级低的
3. **只有优先级相同且值不同时 → 才产生冲突**
4. 覆盖规则（OverrideRule）优先级最高，应用后自动清除冲突

### 状态机流转
```
PENDING → VALIDATING → INHERITING → CONFLICT → (人工处理) → COMPLETED
                          ↓
                        FAILED
```

### 重复请求拦截路径

**拦截位置**: `TagInheritanceService.createTask()`

**拦截逻辑**:
1. 检查数据库中是否存在相同 requestId 的任务
2. 如果存在 → 返回 **真正的 HTTP 409 Conflict** 状态码，不创建新任务
3. 如果不存在 → 正常创建任务，返回 HTTP 200

**其他 HTTP 状态码**:
- **400 Bad Request**: 参数验证失败、状态推进错误
- **404 Not Found**: 任务不存在、节点不存在
- **500 Internal Server Error**: 服务器内部错误

**这是关键的幂等性保证！** 即使前端/调用方重复提交，系统不会产生脏数据。

## 预加载测试数据

系统启动时会自动加载以下测试数据:

### 资源节点层级
```
ORG_001 (Root Organization)
└── DEPT_001 (Engineering Department)
    └── TEAM_001 (Backend Team)
        └── PROJ_001 (Tag Inheritance Project)
```

### 覆盖规则
- RULE_001: environment → production (针对 PROJ_001)
- RULE_002: security_level → top_secret (针对 PROJ_001)

## 测试场景

详细的测试请求示例请参考 [test-requests.md](test-requests.md)

### 1. 正常流程
创建任务 → 验证 → 计算 → 查看结果

### 2. 异常场景
节点不存在、状态错误等

### 3. 重复请求（会被拦截！）
相同 requestId 的第二次请求会返回 409

### 4. 人工处理冲突
多种冲突解决方式

## 项目结构

```
src/main/java/com/resource/tag/
├── TagInheritanceApplication.java    # 启动类
├── model/                           # 数据模型
│   ├── ResourceNode.java
│   ├── Tag.java
│   ├── OverrideRule.java
│   ├── ConflictItem.java
│   ├── CalculationResult.java
│   ├── ChangeHistory.java
│   ├── InheritanceTask.java
│   └── TaskStatus.java
├── repository/                      # 数据访问层
├── dto/                             # 数据传输对象
├── service/                         # 业务逻辑层
│   └── TagInheritanceService.java   # 核心服务
├── controller/                      # API 控制层
│   └── TagInheritanceController.java
├── config/                          # 配置类
│   └── DataInitializer.java       # 数据初始化
└── exception/                       # 异常处理
    └── GlobalExceptionHandler.java
```

## 核心规则总结

| 特性 | 实现方式 |
|------|----------|
| 标签继承 | 祖先链遍历 + 优先级比较 |
| 覆盖解析 | OverrideRule 最高优先级，应用后清除冲突 |
| 冲突提示 | **只有相同优先级不同值时**才记录冲突 |
| 结果缓存 | Spring Cache + taskStatus |
| 历史导出 | ChangeHistory 表查询 |
| 重复拦截 | requestId 检查 + **真正的 HTTP 409** 返回 |
| 状态推进 | 状态机校验 + 状态更新 |
| 异常处理 | GlobalExceptionHandler + 标准 HTTP 状态码 |
| Java 兼容 | Spring Boot 2.7.x + Java 8+ |
