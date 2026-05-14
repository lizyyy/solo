# 接口降级演练服务

## 项目简介

接口降级演练服务（Degrade Drill Service）是一个标准化的API降级演练平台，用于测试和验证系统在故障场景下的兜底逻辑。通过该服务可以模拟各种降级场景，验证系统的容错能力。

## 技术栈

- Java 1.8+
- Spring Boot 2.7.x
- Spring Data JPA
- H2 文件数据库（持久化）
- Lombok

## 核心特性

1. **演练编排**：完整的演练生命周期管理（创建 -> 校验 -> 启动 -> 停止 -> 归档）
2. **兜底注入**：通过Filter拦截指定接口，返回预置的兜底响应
3. **指标观察**：定时采集演练指标（错误率、响应时间）
4. **自动停止**：支持多种停止条件（时长、错误率阈值、响应时间阈值、人工停止）
5. **报告归档**：演练结束后自动生成报告，记录执行结果
6. **幂等处理**：通过requestId防止重复提交产生脏数据
7. **数据持久化**：所有演练计划、指标、报告均持久化存储，重启服务数据不丢失

## 快速开始

### 1. 环境要求

- JDK 1.8+
- Maven 3.6+（无需预装，项目包含Maven wrapper）

### 2. 构建项目

**方式一：使用Maven wrapper（推荐，无需预装Maven）**
```bash
# macOS/Linux
./mvnw clean package -DskipTests

# Windows
mvnw.cmd clean package -DskipTests
```

### 3. 启动服务

**方式一：使用Maven wrapper直接启动（无需打包）**
```bash
./mvnw spring-boot:run
```

**方式二：使用启动脚本**
```bash
# macOS/Linux
chmod +x start.sh && ./start.sh
```

**方式三：运行打包后的JAR**
```bash
java -jar target/degrade-drill-service-1.0.0.jar
```

服务默认启动端口：8080

### 4. 访问H2控制台（可选）

- 地址：http://localhost:8080/h2-console
- JDBC URL：`jdbc:h2:file:./data/degrade_drill`
- 用户名：`sa`
- 密码：`degrade123`

数据库文件保存在项目 `./data/` 目录下，重启服务数据不会丢失。

## 核心接口

### 演练管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/drill | 创建演练计划 |
| POST | /api/v1/drill/{id}/validate | 校验演练计划 |
| POST | /api/v1/drill/{id}/start | 启动演练 |
| POST | /api/v1/drill/{id}/stop | 停止演练 |
| POST | /api/v1/drill/{id}/cancel | 取消演练 |
| GET | /api/v1/drill/{id} | 查询单个演练 |
| GET | /api/v1/drill | 查询所有演练 |
| GET | /api/v1/drill/{id}/metrics | 查询演练指标 |

### 报告查询

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/v1/drill/reports | 查询所有演练报告 |
| GET | /api/v1/drill/reports/{drillId} | 根据演练ID查询报告 |

## 使用示例

### 场景1：正常演练流程

#### 1. 创建演练计划

```bash
curl -X POST http://localhost:8080/api/v1/drill \
  -H "Content-Type: application/json" \
  -d @src/main/resources/test-data/normal-drill.json
```

#### 2. 校验演练计划

```bash
curl -X POST http://localhost:8080/api/v1/drill/1/validate
```

#### 3. 启动演练

```bash
curl -X POST http://localhost:8080/api/v1/drill/1/start
```

#### 4. 访问被拦截的接口（会返回兜底响应）

```bash
curl http://localhost:8080/api/order/query
```

**预期响应**：
```json
{
  "code": 200,
  "message": "服务降级中，请稍后重试",
  "data": []
}
```

#### 5. 人工停止演练

```bash
curl -X POST "http://localhost:8080/api/v1/drill/1/stop?reason=人工干预停止"
```

#### 6. 重启服务验证数据持久化

```bash
# 停止服务后重新启动
./start.sh

# 查询历史数据，确认之前创建的演练和报告仍然存在
curl http://localhost:8080/api/v1/drill
curl http://localhost:8080/api/v1/drill/reports
```

### 场景2：异常场景-校验失败

```bash
# 创建一个配置错误的演练
curl -X POST http://localhost:8080/api/v1/drill \
  -H "Content-Type: application/json" \
  -d @src/main/resources/test-data/invalid-drill.json

# 校验时会失败
curl -X POST http://localhost:8080/api/v1/drill/2/validate
```

### 场景3：重复请求测试

```bash
# 使用相同的requestId重复请求
curl -X POST http://localhost:8080/api/v1/drill \
  -H "Content-Type: application/json" \
  -d @src/main/resources/test-data/normal-drill.json

# 系统会返回已有演练，不会创建新记录
```

## 状态流转

```
CREATED (已创建)
    ↓
VALIDATED (已校验)
    ↓
RUNNING (运行中)
    ↓
STOPPING (停止中)
    ↓
COMPLETED (已完成)

CREATED/VALIDATED → CANCELLED (已取消)
VALIDATED → FAILED (校验失败)
```

## 停止条件类型

1. **DURATION**：按演练时长自动停止
2. **ERROR_RATE**：错误率达到阈值时停止
3. **RESPONSE_TIME**：响应时间达到阈值时停止
4. **MANUAL**：人工手动停止

## 数据模型

### DrillPlan（演练计划）
- 基本信息：名称、描述、创建人
- 目标接口配置
- 兜底响应配置
- 停止条件配置
- 状态跟踪

### TargetApi（目标接口）
- 接口路径
- 请求方法
- 描述
- 是否启用

### FallbackResponse（兜底响应）
- HTTP状态码
- 响应体
- Content-Type
- 延迟时间（模拟超时）

### StopCondition（停止条件）
- 条件类型
- 阈值
- 指标名称
- 时长

### MetricObservation（观测指标）
- 指标名称
- 指标值
- 单位
- 观测时间

### DrillReport（演练报告）
- 演练总结
- 执行时长
- 请求统计
- 兜底命中数
- 平均响应时间
- 错误率
- 停止原因

## 注意事项

1. 拦截路径与演练管理接口路径冲突时，管理接口优先执行
2. 演练状态有严格的流转限制，不允许跨状态操作
3. H2数据库为文件持久化模式，重启服务数据不会丢失，数据库文件保存在 `./data/` 目录
4. 建议在测试环境使用，避免在生产环境执行演练
5. 每个演练计划只能生成一个报告，系统会自动防止重复归档
