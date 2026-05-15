# API 返回体瘦身服务

## 项目简介

API返回体瘦身服务是一个用于优化API响应体积的中间件服务，通过字段裁剪、场景匹配等策略减少网络传输数据量，提升接口响应速度。

## 技术栈

- Java 1.8
- Spring Boot 2.7.18
- MyBatis-Plus 3.5.3.1
- H2 Database (内存数据库，开发环境)
- MySQL 8.0 (生产环境可选)
- Lombok
- Hutool

## 核心功能

### 1. 规则管理
- **创建规则**：定义API路径、字段排除/包含列表、场景匹配规则
- **校验规则**：验证规则有效性，预览瘦身效果
- **激活规则**：使规则正式生效
- **停用规则**：使规则失效
- **规则回滚**：回滚到历史版本
- **版本管理**：支持多版本管理，保留历史快照

### 2. 核心引擎
- **字段裁剪**：支持排除字段、包含字段两种模式
- **嵌套字段处理**：支持 JSON 嵌套字段路径（如 `data.user.extraInfo`）
- **场景匹配**：根据客户端类型、版本、用户组等场景匹配不同规则
- **兼容校验**：确保瘦身后的响应仍然兼容客户端解析
- **大小统计**：精确计算原始大小、瘦身大小、节省比例

### 3. 执行与记录
- **瘦身执行**：对API响应进行实时瘦身
- **请求幂等**：同一请求ID重复提交不产生脏数据
- **执行记录**：记录每次瘦身的详细信息
- **历史查询**：支持按多条件查询执行记录
- **CSV导出**：导出瘦身记录用于统计分析

## 项目结构

```
api-response-slimming-service/
├── src/main/java/com/api/slimming/
│   ├── ApiSlimmingApplication.java          # 启动类
│   ├── config/
│   │   └── MybatisPlusConfig.java           # MyBatis-Plus配置
│   ├── controller/
│   │   ├── SlimmingRuleController.java      # 规则管理接口
│   │   ├── SlimmingExecuteController.java   # 瘦身执行接口
│   │   └── RecordQueryController.java       # 记录查询接口
│   ├── dto/                                 # 数据传输对象
│   ├── entity/                              # 数据库实体
│   ├── enums/                               # 枚举定义
│   ├── exception/                           # 异常处理
│   ├── engine/
│   │   ├── FieldSlimmingEngine.java         # 字段瘦身引擎
│   │   └── SceneMatcher.java                # 场景匹配器
│   ├── mapper/                              # MyBatis Mapper
│   └── service/                             # 业务逻辑层
├── src/main/resources/
│   ├── application.yml                      # 应用配置
│   └── db/
│       ├── schema.sql                       # 数据库表结构
│       └── data.sql                         # 初始化数据
└── pom.xml
```

## API 接口

### 规则管理接口 (`/api/rules`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | / | 创建瘦身规则 |
| POST | /validate | 校验规则有效性 |
| POST | /{id}/activate | 激活规则 |
| POST | /{id}/deactivate | 停用规则 |
| POST | /{id}/rollback | 回滚规则到指定版本 |
| GET | /{id} | 查询规则详情 |
| POST | /query | 分页查询规则列表 |
| GET | /{id}/history | 查询规则变更历史 |

### 瘦身执行接口 (`/api/execute`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /slimming | 执行API响应瘦身 |

### 记录查询接口 (`/api/records`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /query | 分页查询执行记录 |
| GET | /{id} | 查询执行记录详情 |
| POST | /export | 导出执行记录CSV |
| POST | /history/query | 分页查询操作历史 |

## 快速开始

### 1. 环境要求

- JDK 1.8+

### 2. 启动方式

#### 方式一：IDE 直接启动（推荐，无需 Maven）

1. 使用 IntelliJ IDEA 或 Eclipse 打开项目
2. 找到 `src/main/java/com/api/slimming/ApiSlimmingApplication.java`
3. 右键点击并选择 "Run 'ApiSlimmingApplication'"
4. 等待启动完成，日志会显示：`Started ApiSlimmingApplication in X.XXX seconds`

#### 方式二：Maven 启动（如有 Maven 环境）

```bash
mvn spring-boot:run
```

#### 方式三：构建 JAR 后启动（如有 Maven 环境）

```bash
mvn clean package
java -jar target/api-response-slimming-service-1.0.0.jar
```

### 3. 访问服务

- 服务地址：`http://localhost:8080/api-slimming`
- H2 数据库控制台：`http://localhost:8080/api-slimming/h2-console`
  - JDBC URL: `jdbc:h2:mem:api_slimming`
  - 用户名：`sa`
  - 密码：（空）

## 验收测试流程

### 测试一：创建规则 + 幂等性验证

**步骤1：第一次创建规则**

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "excludeFields": ["data.extraInfo", "data.debugLog"],
    "includeFields": [],
    "requestId": "req_test_001",
    "createdBy": "tester",
    "remark": "测试规则"
  }'
```

**期望结果**：返回200，规则创建成功，状态为"草稿"(0)，版本号为"1.0"

---

**步骤2：使用相同 requestId 重复提交**

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "excludeFields": ["data.extraInfo", "data.debugLog"],
    "includeFields": [],
    "requestId": "req_test_001",
    "createdBy": "tester",
    "remark": "测试规则"
  }'
```

**期望结果**：返回已创建的规则，不会重复创建新规则（返回409或直接返回已存在的规则）

---

**步骤3：查看数据库中保存的结果**

访问 H2 控制台 `http://localhost:8080/api-slimming/h2-console`，执行 SQL：

```sql
SELECT * FROM slimming_rule;
SELECT * FROM slimming_record;
SELECT * FROM rule_history;
```

**期望结果**：
- slimming_rule 表中只有 1 条记录（幂等生效）
- slimming_record 表中 requestId = "req_test_001" 的记录存在，且关联了正确的 ruleId
- rule_history 表中存在 CREATE 操作的历史记录

---

### 测试二：规则状态流转

**步骤1：校验规则**

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": 1,
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"大量冗余数据...\",\"debugLog\":\"调试日志...\"}}",
    "operator": "tester"
  }'
```

**期望结果**：校验通过，valid=true，瘦身前后大小对比正确

---

**步骤2：激活规则**

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/activate \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "tester"
  }'
```

**期望结果**：规则状态变为"生效"(20)，版本号仍为"1.0"

---

**步骤3：查看历史变更**

```bash
curl http://localhost:8080/api-slimming/api/rules/1/history
```

**期望结果**：能看到 CREATE -> VALIDATE -> ACTIVATE 的完整操作历史，每个操作都有快照

---

### 测试三：执行瘦身

```bash
curl -X POST http://localhost:8080/api-slimming/api/execute/slimming \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"这是一段很长的冗余数据，应该被裁剪掉\",\"debugLog\":\"调试日志信息也应该被移除\"}}",
    "requestId": "exec_test_001"
  }'
```

**期望结果**：
- slimmedResponse 中不包含 extraInfo 和 debugLog 字段
- originalSize > slimmedSize
- savedSize > 0，savedRatio > 0

---

**查看执行记录**

```bash
curl -X POST http://localhost:8080/api-slimming/api/records/query \
  -H "Content-Type: application/json" \
  -d '{
    "pageNum": 1,
    "pageSize": 10
  }'
```

---

### 测试四：规则回滚

**步骤1：先更新规则（模拟版本变化）**

```bash
# 先停用当前生效的规则
curl -X POST http://localhost:8080/api-slimming/api/rules/1/deactivate \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "tester"
  }'
```

---

**步骤2：查看历史版本列表**

```bash
curl http://localhost:8080/api-slimming/api/rules/1/history
```

查看 snapshotAfter 中的 version 字段，确定要回滚的目标版本（如 "1.0"）

---

**步骤3：执行回滚**

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "targetVersion": "1.0",
    "operator": "tester"
  }'
```

**期望结果**：
- 规则状态变为"已回滚"(40)
- 版本号升级为 "1.1"（在原版本基础上递增）
- 字段配置等内容恢复到目标版本的状态

---

## 状态流转

规则状态流转：

```
草稿(0) --校验--> 校验中(10) --激活--> 生效(20) --停用--> 失效(30)
                                      ↓
                                    回滚(40)
```

状态说明：
- 0: 草稿（刚创建）
- 10: 校验中（校验通过）
- 20: 生效（激活后可用于瘦身匹配）
- 30: 失效（停用后不再匹配）
- 40: 已回滚（回滚到历史版本后的状态）

## 生产环境部署

1. 修改 `application.yml` 中的数据库配置，切换到 MySQL
2. 配置合适的连接池参数
3. 配置日志级别为 INFO
4. 考虑配置 Redis 缓存热门规则和请求幂等记录

## 注意事项

1. **幂等性保证**：创建规则时必须传 `requestId`，相同 requestId 不会重复创建
2. **版本管理**：每次状态变更都会保存快照，回滚依赖这些快照
3. **规则生效**：规则需要先校验通过，再激活才能被瘦身引擎匹配
4. **嵌套字段路径**：使用点号（`.`）分隔，如 `data.user.extraInfo`
5. **瘦身执行**：不会修改原始响应，仅返回瘦身后的响应副本
