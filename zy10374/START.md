# 快速启动指南（无需 Maven）

## 前置条件

- JDK 1.8 或更高版本
- IntelliJ IDEA / Eclipse / VSCode 任一 IDE

---

## 方式一：IDE 直接启动（推荐，100% 可用）

### 步骤 1：用 IDE 打开项目

**IntelliJ IDEA**:
1. File → Open → 选择 `pom.xml` → Open as Project
2. 等待 IDE 自动下载依赖（首次需要几分钟）

**Eclipse**:
1. File → Import → Existing Maven Projects → 选择项目根目录

**VSCode**:
1. 安装 Extension Pack for Java
2. 打开项目文件夹，等待 Maven 同步

### 步骤 2：启动应用

找到启动类：
```
src/main/java/com/api/slimming/ApiSlimmingApplication.java
```

- **右键** → Run 'ApiSlimmingApplication'
- 或点击类名左侧的 ▶️ 按钮

### 步骤 3：验证启动成功

看到类似日志即为启动成功：
```
Started ApiSlimmingApplication in 3.456 seconds (JVM running for 4.123)
```

---

## 方式二：Maven Wrapper 启动（如果有 mvn 或 ./mvnw）

如果你的环境有 mvn 或项目包含 maven wrapper：

```bash
# 方式 A：直接运行（推荐）
mvn spring-boot:run

# 或
./mvnw spring-boot:run

# 方式 B：先打包再运行
mvn clean package
java -jar target/api-response-slimming-service-1.0.0.jar
```

---

## 验证验收流程

### 验证 1：服务启动检查

**浏览器或 curl 访问**：
```bash
curl http://localhost:8080/api-slimming/
```

**期望**：返回 404 或白标错误页（说明服务已启动）

---

### 验证 2：创建规则 + 幂等性

**第一次创建**：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "excludeFields": ["data.extraInfo", "data.debugLog"],
    "requestId": "req_001",
    "createdBy": "tester",
    "remark": "测试规则"
  }'
```

**重复提交（相同 requestId）**：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "excludeFields": ["data.extraInfo", "data.debugLog"],
    "requestId": "req_001",
    "createdBy": "tester",
    "remark": "测试规则"
  }'
```

**验收标准**：
- 第二次不会创建新规则（返回已存在的规则或 409 错误）
- 数据库中 slimming_rule 表只有 1 条记录

---

### 验证 3：查看数据库（H2 控制台）

访问：`http://localhost:8080/api-slimming/h2-console`

**登录配置**：
- JDBC URL: `jdbc:h2:mem:api_slimming`
- 用户名：`sa`
- 密码：（空）

**执行查询**：
```sql
-- 查看规则表
SELECT * FROM slimming_rule;

-- 查看执行记录表（验证幂等性）
SELECT * FROM slimming_record;

-- 查看操作历史表
SELECT * FROM rule_history;
```

---

### 验证 4：规则完整生命周期

**1. 校验规则**（ruleId 用实际返回的 ID）：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": 1,
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"冗余数据\"}}",
    "operator": "tester"
  }'
```

**2. 激活规则**：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/activate \
  -H "Content-Type: application/json" \
  -d '{"operator": "tester"}'
```

**3. 查看历史变更**：
```bash
curl http://localhost:8080/api-slimming/api/rules/1/history
```

**验收标准**：
- 每条状态变更记录都有 snapshotBefore 和 snapshotAfter
- 历史记录包含 CREATE → VALIDATE → ACTIVATE 完整流程

---

### 验证 5：执行瘦身

```bash
curl -X POST http://localhost:8080/api-slimming/api/execute/slimming \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"这是一段很长的冗余数据\",\"debugLog\":\"调试日志\"}}",
    "requestId": "exec_001"
  }'
```

**验收标准**：
- slimmedResponse 中不包含 extraInfo 和 debugLog 字段
- originalSize > slimmedSize
- savedSize > 0

---

### 验证 6：规则回滚

**1. 先停用规则**：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/deactivate \
  -H "Content-Type: application/json" \
  -d '{"operator": "tester"}'
```

**2. 查看历史版本**：
```bash
curl http://localhost:8080/api-slimming/api/rules/1/history
```

查看返回的 snapshotAfter 字段中的 version 值。

**3. 执行回滚**（targetVersion 用实际版本，如 "1.0"）：
```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "targetVersion": "1.0",
    "operator": "tester"
  }'
```

**验收标准**：
- 规则状态变为 40（已回滚）
- 版本号升级（如 1.0 → 1.1）
- 字段配置恢复到目标版本

---

## 常见问题

### Q1: IDE 提示找不到 Lombok 注解？
**A**: 安装 Lombok 插件，重启 IDE。

### Q2: 启动时报数据库连接错误？
**A**: 默认使用 H2 内存数据库，无需额外配置。如果配置了 MySQL，请检查 application.yml。

### Q3: 如何生成 jar 文件？
**A**: 需要 Maven 环境：
```bash
mvn clean package
ls target/*.jar
```

### Q4: Java 版本对不上怎么办？
**A**: 代码已兼容 Java 8，检查 IDE 的 Project SDK 设置：
- File → Project Structure → Project → SDK: 选择 1.8
