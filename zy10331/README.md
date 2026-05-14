# 批处理优先级队列 API

基于 Spring Boot 2.7.x 的优先级批处理任务调度系统，支持抢占式调度、执行槽位管理、状态追踪和数据导出。

---

## 🚀 快速开始（必读）

### 前置要求

- **JDK 8 或更高版本**（⚠️ 注意：JRE 无法编译，必须是完整 JDK）
- macOS / Linux / Windows

### 一键构建并启动

```bash
# 方式 1: 推荐 - 全自动构建启动
./build_and_run.sh

# 方式 2: 使用 Maven Wrapper
./mvnw clean package -DskipTests
java -jar target/priority-queue-api-1.0.0.jar

# 方式 3: IDE 启动
# 直接运行主类: com.batchqueue.PriorityQueueApplication
```

### 启动成功验证

服务启动后访问以下地址：

| 资源 | 地址 |
|------|------|
| API 入口 | http://localhost:8080/api/tasks |
| H2 数据库控制台 | http://localhost:8080/h2-console |

**H2 控制台登录信息：**
- JDBC URL: `jdbc:h2:file:./data/batchqueue`
- 用户名: `sa`
- 密码: （空）

---

## ❗ 常见问题排查

### 问题 1: "No compiler is provided in this environment"
**原因**: 只安装了 JRE，没有安装完整 JDK

**解决**:
1. 下载安装 JDK 8+:
   - OpenJDK: https://adoptium.net/temurin/releases/?version=8
   - Oracle JDK: https://www.oracle.com/java/technologies/downloads/

2. 设置环境变量:
   ```bash
   # macOS
   export JAVA_HOME=`/usr/libexec/java_home`
   
   # Linux
   export JAVA_HOME=/path/to/jdk
   
   # Windows (PowerShell)
   $env:JAVA_HOME="C:\path\to\jdk"
   ```

3. 验证安装:
   ```bash
   java -version
   javac -version
   ```

### 问题 2: "Unable to access jarfile"
**原因**: 还没有构建生成 JAR 文件

**解决**: 先运行构建命令:
```bash
./mvnw clean package -DskipTests
```

### 问题 3: 端口 8080 被占用
**解决**: 修改 `src/main/resources/application.yml`:
```yaml
server:
  port: 8081  # 改为其他端口
```

---

## 项目概述

这是一个完整的批处理任务队列管理 API，提供以下核心功能：

- **优先级调度**：4级优先级（CRITICAL > HIGH > MEDIUM > LOW）
- **抢占机制**：高优先级任务可抢占低优先级任务的执行槽位
- **执行槽位管理**：可配置的并发执行槽位数（默认 5 个）
- **状态追踪**：完整的任务生命周期管理和调度日志
- **重复提交校验**：任务 ID 唯一性保证
- **数据持久化**：使用嵌入式 H2 数据库，重启不丢失数据
- **数据导出**：支持 JSON 和 CSV 格式导出

## 环境要求

### 必需

- **JDK 8 或更高版本**（注意：JRE 无法编译，需要完整 JDK）
- Maven 3.6+（项目已包含 Maven Wrapper，无需单独安装）

### 可选

- 支持 Java 的 IDE（IntelliJ IDEA, Eclipse 等）

## 快速开始

### 方式一：使用 Maven Wrapper（推荐）

```bash
# 1. 检查 Java 环境（确保是 JDK 而非 JRE）
java -version
javac -version

# 2. 编译打包（如果是 Linux/macOS）
./mvnw clean package -DskipTests

# 如果是 Windows
mvnw.cmd clean package -DskipTests

# 3. 运行
java -jar target/priority-queue-api-1.0.0.jar
```

### 方式二：使用 IDE

1. 使用 IntelliJ IDEA 或 Eclipse 导入项目
2. 等待 Maven 依赖下载完成
3. 运行主类：`com.batchqueue.PriorityQueueApplication`

### 方式三：使用提供的脚本（macOS/Linux）

```bash
# 初始化并构建（会自动下载 Maven）
./setup.sh

# 启动服务
./run.sh
```

## API 接口文档

### 基础信息

- 服务地址：`http://localhost:8080`
- H2 控制台：`http://localhost:8080/h2-console`
  - JDBC URL: `jdbc:h2:file:./data/batchqueue`
  - 用户名: `sa`
  - 密码: （空）

### 任务管理接口

#### 创建任务

```http
POST /api/tasks
Content-Type: application/json

{
    "taskId": "TASK001",
    "taskName": "月度报表生成",
    "taskType": "REPORT_GENERATION",
    "priority": "HIGH",
    "payload": "{\"month\": \"2026-05\"}",
    "handler": "admin"
}
```

任务类型可选值：
- `DATA_PROCESSING` - 数据处理
- `REPORT_GENERATION` - 报表生成
- `BATCH_IMPORT` - 批量导入
- `BATCH_EXPORT` - 批量导出
- `SYSTEM_MAINTENANCE` - 系统维护

优先级可选值：
- `CRITICAL` - 紧急（最高）
- `HIGH` - 高
- `MEDIUM` - 中
- `LOW` - 低

#### 获取所有任务

```http
GET /api/tasks
```

#### 获取单个任务详情

```http
GET /api/tasks/{taskId}
```

#### 按状态获取任务

```http
GET /api/tasks/status/{status}
```

状态可选值：
- `PENDING` - 待执行
- `WAITING` - 等待中
- `RUNNING` - 执行中
- `PREEMPTED` - 被抢占
- `COMPLETED` - 已完成
- `CANCELLED` - 已撤销
- `FAILED` - 执行失败

### 队列管理接口

#### 获取等待队列

```http
GET /api/tasks/queue/waiting
```

按优先级排序，显示所有等待执行的任务。

#### 获取运行中任务

```http
GET /api/tasks/queue/running
```

按优先级降序排序，显示当前运行的任务。

### 任务操作接口

#### 推进任务（标记完成）

```http
POST /api/tasks/progress
Content-Type: application/json

{
    "taskId": "TASK001",
    "result": "报表生成成功，共处理 1250 条记录",
    "operator": "admin"
}
```

#### 撤销任务

```http
POST /api/tasks/cancel
Content-Type: application/json

{
    "taskId": "TASK001",
    "reason": "需求变更，暂时取消",
    "operator": "admin"
}
```

### 日志与统计接口

#### 获取任务调度日志

```http
GET /api/tasks/{taskId}/logs
```

#### 获取所有调度日志

```http
GET /api/tasks/logs/all
```

#### 获取执行槽位状态

```http
GET /api/tasks/slots
```

#### 获取抢占记录

```http
GET /api/tasks/preemptions
```

#### 获取平均等待时间

```http
GET /api/tasks/stats/average-wait-time
```

### 数据导出接口

#### 导出为 JSON

```http
GET /api/tasks/export/json
```

#### 导出为 CSV

```http
GET /api/tasks/export/csv
```

## 使用示例流程

### 成功流程示例

```bash
# 1. 创建一个紧急任务
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "DEMO001",
    "taskName": "紧急数据同步",
    "taskType": "DATA_PROCESSING",
    "priority": "CRITICAL",
    "handler": "system"
  }'

# 2. 查看任务状态
curl http://localhost:8080/api/tasks/DEMO001

# 3. 查看等待队列
curl http://localhost:8080/api/tasks/queue/waiting

# 4. 模拟任务完成（推进）
curl -X POST http://localhost:8080/api/tasks/progress \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "DEMO001",
    "result": "同步成功，10000 条记录已更新",
    "operator": "admin"
  }'

# 5. 查看调度日志
curl http://localhost:8080/api/tasks/DEMO001/logs
```

### 抢占场景示例

```bash
# 1. 先创建多个低优先级任务填满槽位
for i in 1 2 3 4 5; do
  curl -X POST http://localhost:8080/api/tasks \
    -H "Content-Type: application/json" \
    -d "{
      \"taskId\": \"LOW$i\",
      \"taskName\": \"低优先级任务$i\",
      \"taskType\": \"DATA_PROCESSING\",
      \"priority\": \"LOW\",
      \"handler\": \"batch\"
    }"
  echo ""
done

# 2. 查看运行中的任务
curl http://localhost:8080/api/tasks/queue/running

# 3. 创建一个高优先级任务（触发抢占）
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "HIGH_JOB",
    "taskName": "紧急故障修复",
    "taskType": "SYSTEM_MAINTENANCE",
    "priority": "CRITICAL",
    "handler": "admin"
  }'

# 4. 查看抢占记录
curl http://localhost:8080/api/tasks/preemptions
```

### 重复提交校验

```bash
# 第一次提交（成功）
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "DUPLICATE_TEST",
    "taskName": "重复提交测试",
    "taskType": "DATA_PROCESSING",
    "priority": "MEDIUM",
    "handler": "test"
  }'

# 第二次提交（失败，返回 409）
curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "DUPLICATE_TEST",
    "taskName": "重复提交测试",
    "taskType": "DATA_PROCESSING",
    "priority": "MEDIUM",
    "handler": "test"
  }'
```

## 配置说明

在 `src/main/resources/application.yml` 中可配置：

```yaml
batchqueue:
  execution:
    max-slots: 5                    # 最大并发执行槽位数
  priority:
    preemption:
      enabled: true                 # 是否启用抢占
      max-per-hour: 3               # 每小时最大抢占次数
```

## 数据持久化

- 数据库文件保存在 `./data/batchqueue.*`
- 重启服务后所有状态、处理人、最终结论均可查询
- 可通过 H2 控制台直接查看和管理数据

## 项目结构

```
src/main/java/com/batchqueue/
├── PriorityQueueApplication.java     # 启动类
├── controller/
│   └── TaskController.java           # REST API 控制器
├── model/
│   ├── dto/                          # 数据传输对象
│   │   ├── ApiResponse.java
│   │   ├── TaskCancelRequest.java
│   │   ├── TaskCreateRequest.java
│   │   ├── TaskProgressRequest.java
│   │   └── TaskResponse.java
│   ├── entity/                       # 实体类
│   │   ├── ExecutionSlot.java
│   │   ├── PreemptionRecord.java
│   │   ├── ScheduleLog.java
│   │   └── Task.java
│   └── enums/                        # 枚举类
│       ├── TaskPriority.java
│       ├── TaskStatus.java
│       └── TaskType.java
├── repository/                       # 数据访问层
│   ├── ExecutionSlotRepository.java
│   ├── PreemptionRecordRepository.java
│   ├── ScheduleLogRepository.java
│   └── TaskRepository.java
├── service/                          # 业务逻辑层
│   ├── ExecutionSlotService.java
│   ├── ExportService.java
│   ├── ScheduleLogService.java
│   ├── TaskSchedulerService.java
│   └── TaskService.java
└── exception/                        # 异常处理
    ├── DuplicateTaskException.java
    ├── GlobalExceptionHandler.java
    ├── InvalidTaskStateException.java
    └── TaskNotFoundException.java
```

## 核心设计

### 任务生命周期

```
PENDING → WAITING → RUNNING → COMPLETED
                          ↓
                       PREEMPTED → WAITING
                          ↓
                       CANCELLED
```

### 调度算法

1. 新任务创建后进入 `PENDING` 状态
2. 调度器将任务移入 `WAITING` 队列，按优先级排序
3. 有空闲槽位时，优先分配给优先级最高的任务
4. 无空闲槽位但启用抢占时，检查是否可抢占低优先级任务
5. 每小时抢占次数受配置限制

## 常见问题

### Q: 编译报错 "No compiler is provided in this environment"
A: 检查是否安装了 JDK 而非 JRE。运行 `javac -version` 确认。

### Q: 如何更改运行端口？
A: 修改 `application.yml` 中的 `server.port` 配置。

### Q: 数据文件在哪里？
A: 数据库文件保存在应用运行目录的 `data` 子目录下。

### Q: 如何清空所有数据重新开始？
A: 停止服务后删除 `data` 目录，重启后会重新初始化。

## 许可证

本项目仅供学习和研究使用。
