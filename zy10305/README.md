# 分布式缓存失效编排 API

基于 Spring Boot 的分布式缓存失效编排系统，支持完整的失效批次管理、节点确认、失败重试和数据导出。

## 功能特性

- ✅ **批次创建与管理**: 支持批量缓存失效请求，通过 requestId 实现幂等
- ✅ **键模式解析**: 支持通配符 `cache:*` 和范围 `cache:[1-100]` 模式
- ✅ **节点注册**: 多服务节点批量注册，支持优先级配置
- ✅ **状态推进**: CREATED → VALIDATED → PROCESSING → RETRYING → [SUCCESS, PARTIAL_SUCCESS, FAILED]
- ✅ **确认回执**: 每个节点独立提交处理结果
- ✅ **失败重试**: 自动记录失败原因，支持手动触发重试
- ✅ **结果对账**: 自动汇总节点状态，计算批次完成率
- ✅ **历史查询**: 按时间、状态、requestId 多维度查询
- ✅ **CSV 导出**: 完整审计数据导出

## 快速开始

### 方式一：使用启动脚本（推荐，无需 mvn）

```bash
# 1. 给脚本加执行权限
chmod +x start.sh

# 2. 启动服务
./start.sh
```

服务启动后访问 `http://localhost:8080`

### 方式二：使用 Maven

```bash
# 构建
mvn clean package -DskipTests

# 运行
java -jar target/cache-invalidation-orchestrator-1.0.0.jar
```

### 验证服务

```bash
# 检查服务是否启动
curl http://localhost:8080/api/v1/invalidation/batches/request/REQ-2024-001
```

## API 接口文档

### 1. 创建失效批次

```bash
POST /api/v1/invalidation/batches

curl -X POST http://localhost:8080/api/v1/invalidation/batches \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ-2024-001",
    "keyPattern": "cache:user:*",
    "serviceNodes": [
      {"nodeId": "node-01", "nodeAddress": "http://node1:8080", "priority": 1},
      {"nodeId": "node-02", "nodeAddress": "http://node2:8080", "priority": 2}
    ],
    "retryConfig": {
      "maxRetries": 3,
      "delaySeconds": 60
    }
  }'
```

**响应示例**:
```json
{
  "code": 200,
  "message": "批次创建成功",
  "data": {
    "batchId": 1,
    "requestId": "REQ-2024-001",
    "status": "CREATED",
    "totalKeys": 10,
    "totalNodes": 2
  }
}
```

### 2. 校验批次

```bash
POST /api/v1/invalidation/batches/{batchId}/validate

curl -X POST http://localhost:8080/api/v1/invalidation/batches/1/validate
```

### 3. 开始处理

```bash
POST /api/v1/invalidation/batches/{batchId}/start

curl -X POST http://localhost:8080/api/v1/invalidation/batches/1/start
```

### 4. 提交确认回执

```bash
POST /api/v1/invalidation/batches/{batchId}/confirm

curl -X POST http://localhost:8080/api/v1/invalidation/batches/1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "RCP-001",
    "nodeId": "node-01",
    "status": "CONFIRMED",
    "keysProcessed": 10
  }'
```

**状态说明**:
- `CONFIRMED`: 处理成功
- `FAILED`: 处理失败（需填写 failureReason）
- `TIMEOUT`: 超时

### 5. 触发节点重试

```bash
POST /api/v1/invalidation/batches/{batchId}/retry/{nodeId}

curl -X POST http://localhost:8080/api/v1/invalidation/batches/1/retry/node-02
```

**响应示例**:
```json
{
  "code": 200,
  "message": "重试计划已启动",
  "data": {
    "nodeId": "node-02",
    "retryNumber": 1,
    "maxRetries": 3,
    "status": "RETRYING",
    "previousFailureReason": "连接超时: 无法连接到 Redis 服务器"
  }
}
```

### 6. 恢复整个批次重试

```bash
POST /api/v1/invalidation/batches/{batchId}/retry-all

curl -X POST http://localhost:8080/api/v1/invalidation/batches/1/retry-all
```

对所有失败的节点批量触发重试。

### 7. 查询批次状态

```bash
GET /api/v1/invalidation/batches/{batchId}

curl http://localhost:8080/api/v1/invalidation/batches/1
```

### 8. 通过 requestId 查询

```bash
GET /api/v1/invalidation/batches/request/{requestId}

curl http://localhost:8080/api/v1/invalidation/batches/request/REQ-2024-001
```

### 9. 查询历史批次

```bash
GET /api/v1/invalidation/batches/history?startTime=2024-01-01T00:00:00&endTime=2024-12-31T23:59:59

curl "http://localhost:8080/api/v1/invalidation/batches/history?startTime=2024-01-01T00:00:00&endTime=2024-12-31T23:59:59"
```

### 10. 按状态查询

```bash
GET /api/v1/invalidation/batches/status?statuses=PROCESSING,RETRYING

curl "http://localhost:8080/api/v1/invalidation/batches/status?statuses=PROCESSING,RETRYING"
```

### 11. 导出批次详情（CSV）

```bash
GET /api/v1/invalidation/batches/{batchId}/export

curl -o batch_1.csv http://localhost:8080/api/v1/invalidation/batches/1/export
```

### 12. 导出历史批次（CSV）

```bash
GET /api/v1/invalidation/batches/history/export?startTime=...&endTime=...

curl -o history.csv "http://localhost:8080/api/v1/invalidation/batches/history/export?startTime=2024-01-01T00:00:00&endTime=2024-12-31T23:59:59"
```

## 完整测试流程

```bash
# 运行完整测试脚本
chmod +x test-flow.sh
./test-flow.sh
```

测试流程包含：
1. 创建批次（含节点配置和重试策略）
2. 幂等性验证（重复 requestId）
3. 校验批次
4. 开始处理
5. 节点 1 提交成功回执
6. 节点 2 提交失败回执（含失败原因）
7. 回执幂等性验证
8. 节点 3 提交成功回执
9. 触发节点 2 重试
10. 重试后节点 2 提交成功回执
11. 查询最终批次状态
12. 按状态查询批次列表
13. 导出 CSV 报告

## 状态流转图

```
CREATED
   ↓
VALIDATED
   ↓
PROCESSING ←───┐
   ↓   ↑        │
   │   └─ RETRYING  (重试状态)
   │
   ├─ SUCCESS          (全部成功)
   ├─ PARTIAL_SUCCESS  (部分成功)
   └─ FAILED           (全部失败)
```

## 核心数据模型

### InvalidationBatch（失效批次）
- `batchId`: 批次唯一标识
- `requestId`: 请求ID（幂等键）
- `keyPattern`: 缓存键模式
- `totalKeys`: 解析出的键总数
- `totalNodes`: 节点总数
- `status`: 批次状态
- `errorMessage`: 错误信息
- `createdAt/updatedAt/completedAt`: 时间戳

### ConfirmationReceipt（确认回执）
- `receiptId`: 回执ID（幂等键）
- `nodeId`: 节点ID
- `status`: 回执状态(CONFIRMED/FAILED/TIMEOUT)
- `failureReason`: 失败原因
- `keysProcessed`: 已处理键数
- `confirmedAt`: 确认时间

### FailedNode（失败节点）
- `nodeId`: 节点ID
- `failureReason`: 失败原因
- `retryCount`: 重试次数
- `failedAt`: 失败时间

### RetryPlan（重试计划）
- `nodeId`: 节点ID
- `retryNumber`: 当前重试次数
- `maxRetries`: 最大重试次数
- `delaySeconds`: 重试延迟秒数
- `scheduledAt`: 计划执行时间
- `executedAt`: 实际执行时间
- `retryResult`: 重试结果

## 幂等性说明

1. **创建批次**: 同一 `requestId` 多次提交返回相同结果
2. **确认回执**: 同一 `receiptId + batchId` 多次提交不重复处理
3. **重试操作**: 同一节点在 RETRYING 状态下重复触发返回相同结果

## H2 数据库控制台

访问 `http://localhost:8080/h2-console`

- JDBC URL: `jdbc:h2:file:./data/cache_invalidation`
- 用户名: `sa`
- 密码: (空)

## 项目结构

```
.
├── pom.xml                          # Maven 配置
├── README.md                        # 本文档
├── start.sh                         # 一键启动脚本
├── test-flow.sh                     # 完整流程测试脚本
└── src/main/
    ├── java/com/cache/orchestrator/
    │   ├── CacheInvalidationApplication.java  # 启动类
    │   ├── controller/               # API 控制层
    │   ├── service/                  # 业务逻辑层
    │   ├── repository/               # 数据访问层
    │   ├── domain/
    │   │   ├── entity/              # 数据实体
    │   │   ├── dto/                 # 传输对象
    │   │   └── enums/               # 枚举定义
    │   ├── exception/               # 异常处理
    │   └── config/                  # 配置类
    └── resources/
        └── application.yml           # 应用配置
```

## 故障排查指南

### Q1: start.sh 无法启动，提示"无法自动启动"

**原因**: 没有找到可用的启动方式。

**解决方案**:
```bash
# 方案 A: 在 IDE 中运行（最简单）
# 打开 src/main/java/com/cache/orchestrator/CacheInvalidationApplication.java
# 右键点击 main 方法 -> Run

# 方案 B: 安装系统 Maven
brew install maven    # macOS
sudo apt install maven # Ubuntu

# 方案 C: 在 IDE 中编译后再试
# IDEA 中: Build -> Build Project
# 然后再次运行 ./start.sh
```

### Q2: 启动时卡在下载依赖

**原因**: Maven 中央仓库访问速度慢。

**解决方案**:
1. 等待下载完成（首次运行需要 1-3 分钟）
2. 配置阿里云 Maven 镜像：
```bash
# 在 ~/.m2/settings.xml 中添加镜像配置
mkdir -p ~/.m2
# 编辑 settings.xml 添加阿里云镜像
```

### Q3: 端口 8080 被占用

**解决方案**:
```bash
# 查看端口占用
lsof -i :8080

# 杀掉占用进程
kill -9 <PID>

# 或者在 application.yml 中修改端口
# server:
#   port: 8081
```

### Q4: verify.sh 提示"服务启动超时"

**解决方案**:
1. 检查 start.sh 所在的终端是否有错误输出
2. 查看 Java 进程是否存在: `ps aux | grep java`
3. 检查端口是否被占用: `lsof -i :8080`
4. 首次启动依赖下载慢，多等一会再试

### Q5: 数据库文件损坏

**解决方案**:
```bash
# 删除 H2 数据库文件，重新启动会自动重建
rm -rf data/
./start.sh
```

---

## 项目文件说明

```
.
├── pom.xml                          # Maven 配置文件
├── README.md                        # 本文档
├── start.sh                         # ⭐️ 智能启动脚本（4种启动模式）
├── verify.sh                        # ⭐️ 服务验证脚本
├── test-flow.sh                     # ⭐️ 完整流程测试脚本
├── mvnw                             # Maven Wrapper (Linux/macOS)
├── mvnw.cmd                         # Maven Wrapper (Windows)
├── .mvn/
│   └── wrapper/
│       └── maven-wrapper.properties # Maven Wrapper 配置
├── data/                            # H2 数据库文件（自动创建）
└── src/main/java/com/cache/orchestrator/
    ├── CacheInvalidationApplication.java  # 主启动类
    ├── standalone/
    │   └── StandaloneLauncher.java       # 独立启动器
    ├── controller/
    │   └── InvalidationController.java    # API 控制器
    ├── service/
    │   ├── InvalidationOrchestratorService.java
    │   ├── RetryService.java              # 重试服务
    │   ├── ConfirmationService.java       # 确认回执服务
    │   ├── KeyResolverService.java        # 键解析服务
    │   └── ExportService.java             # 导出服务
    ├── repository/
    ├── domain/
    │   ├── entity/                        # 数据实体
    │   ├── dto/                           # 数据传输对象
    │   └── enums/                         # 枚举定义
    └── exception/
```

## 核心业务规则

### 节点确认与对账逻辑

#### 🔒 安全规则 1: 回执双重幂等
- **receiptId 幂等**: 同一 receiptId 重复提交直接忽略（幂等返回）
- **nodeId 幂等**: 同一 nodeId 在同一批次内不允许重复提交不同回执
- 防止恶意用户通过不同 receiptId 绕过对账逻辑

#### 🔒 安全规则 2: 按节点去重对账
- 对账统计时按 nodeId 去重，确保每个节点只统计一次
- 只有当 `去重后的节点数 == 总节点数` 时才推进到最终状态
- 防止重复回执让批次提前进入 SUCCESS/PARTIAL_SUCCESS

#### 状态流转
```
CREATED → VALIDATED → PROCESSING → RETRYING → [SUCCESS, PARTIAL_SUCCESS, FAILED]
```

### 重试机制

- 节点失败后可触发重试
- 每个节点有独立的重试计数和最大重试限制
- 重试期间批次状态保持为 RETRYING
- 重试成功后清除失败记录，更新重试计划状态

---

## 测试脚本说明

| 脚本 | 说明 |
|------|------|
| `./start.sh` | 启动服务（4种模式自动检测） |
| `./verify.sh` | 快速验证服务是否正常工作 |
| `./test-flow.sh` | 完整流程测试（18个步骤） |
| `./test-attack-scenario.sh` | 漏洞场景测试 |

---

## 技术栈

- Spring Boot 2.7.18
- Spring Data JPA
- H2 Database (嵌入式)
- Lombok
