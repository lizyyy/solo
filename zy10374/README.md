# API 返回体瘦身服务

## 项目简介

API返回体瘦身服务是一个用于优化API响应体积的中间件服务，通过字段裁剪、场景匹配等策略减少网络传输数据量，提升接口响应速度。

## 技术栈

- Java 11
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

- JDK 11+
- Maven 3.6+

### 2. 构建项目

```bash
mvn clean package
```

### 3. 启动服务

```bash
java -jar target/api-response-slimming-service-1.0.0.jar
```

服务默认启动在 `http://localhost:8080/api-slimming`

### 4. 访问 H2 控制台

- 地址：`http://localhost:8080/api-slimming/h2-console`
- JDBC URL: `jdbc:h2:mem:api_slimming`
- 用户名：`sa`
- 密码：（空）

## 使用示例

### 1. 创建瘦身规则

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "excludeFields": ["data.extraInfo", "data.debugLog"],
    "includeFields": [],
    "requestId": "req_001",
    "createdBy": "admin",
    "remark": "用户信息接口瘦身规则"
  }'
```

### 2. 校验规则

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/validate \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": 1,
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"...\",\"debugLog\":\"...\"}}",
    "operator": "admin"
  }'
```

### 3. 激活规则

```bash
curl -X POST http://localhost:8080/api-slimming/api/rules/1/activate \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin"
  }'
```

### 4. 执行瘦身

```bash
curl -X POST http://localhost:8080/api-slimming/api/execute/slimming \
  -H "Content-Type: application/json" \
  -d '{
    "apiPath": "/api/v1/user/info",
    "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"大量冗余数据...\",\"debugLog\":\"调试日志...\"}}",
    "requestId": "exec_001"
  }'
```

## 状态流转

规则状态流转：

```
草稿(0) --校验--> 校验中(10) --激活--> 生效(20) --停用--> 失效(30)
                                      ↓
                                    回滚(40)
```

## 生产环境部署

1. 修改 `application.yml` 中的数据库配置，切换到 MySQL
2. 配置合适的连接池参数
3. 配置日志级别为 INFO
4. 考虑配置 Redis 缓存热门规则和请求幂等记录

## 注意事项

1. 规则创建后需要校验并激活才能生效
2. 嵌套字段路径使用点号（`.`）分隔
3. 请求幂等依赖 `requestId` 参数，建议每次请求生成唯一ID
4. 瘦身操作不会修改原始响应，仅返回瘦身后的响应
