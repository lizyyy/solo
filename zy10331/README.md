# 批处理优先级队列 API

基于优先级的批处理任务调度系统，支持抢占式调度、执行槽位管理、状态追踪和数据导出。

## 技术栈

- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (嵌入式)
- Lombok

## 核心特性

### 1. 优先级调度
- 4级优先级：CRITICAL(紧急) > HIGH(高) > MEDIUM(中) > LOW(低)
- 等待队列按优先级排序，高优先级任务优先执行

### 2. 抢占机制
- 当执行槽位满时，高优先级任务可抢占低优先级任务的槽位
- 每小时最大抢占次数可配置（默认3次）
- 抢占记录完整保存

### 3. 执行槽位管理
- 可配置的并发执行槽位数（默认5个）
- 槽位状态实时追踪
- 任务完成后自动释放槽位

### 4. 完整的状态追踪
- 任务状态：PENDING → WAITING → RUNNING → COMPLETED / CANCELLED / PREEMPTED
- 详细的调度日志记录每次状态变更
- 等待时长、执行时长统计

### 5. 重复提交校验
- 任务ID唯一约束
- 重复提交自动拦截并返回友好提示

## API 接口

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks | 创建任务 |
| GET | /api/tasks | 获取所有任务 |
| GET | /api/tasks/{taskId} | 获取单个任务详情 |
| GET | /api/tasks/status/{status} | 按状态获取任务 |

### 任务操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks/progress | 推进任务（标记完成） |
| POST | /api/tasks/cancel | 撤销任务 |
| GET | /api/tasks/queue/waiting | 获取等待队列 |
| GET | /api/tasks/queue/running | 获取运行中任务 |

### 日志与统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/{taskId}/logs | 获取任务调度日志 |
| GET | /api/tasks/logs/all | 获取所有调度日志 |
| GET | /api/tasks/slots | 获取执行槽位状态 |
| GET | /api/tasks/preemptions | 获取抢占记录 |
| GET | /api/tasks/stats/average-wait-time | 获取平均等待时长 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/export/json | 导出任务为JSON |
| GET | /api/tasks/export/csv | 导出任务为CSV |

## 请求示例

### 创建任务

```json
POST /api/tasks
{
  "taskId": "TASK001",
  "taskName": "数据处理任务",
  "taskType": "DATA_PROCESSING",
  "priority": "HIGH",
  "payload": "{\"file\":\"data.csv\"}",
  "handler": "admin"
}
```

### 推进任务（标记完成）

```json
POST /api/tasks/progress
{
  "taskId": "TASK001",
  "result": "处理完成，共1000条记录",
  "operator": "admin"
}
```

### 取消任务

```json
POST /api/tasks/cancel
{
  "taskId": "TASK001",
  "reason": "任务不再需要",
  "operator": "admin"
}
```

## 配置说明

在 `application.yml` 中可配置：

```yaml
batchqueue:
  execution:
    max-slots: 5                    # 最大并发执行槽位数
  priority:
    levels:
      - CRITICAL
      - HIGH
      - MEDIUM
      - LOW
    preemption:
      enabled: true                 # 是否启用抢占
      max-per-hour: 3               # 每小时最大抢占次数
```

## 运行项目

```bash
# 编译
mvn clean package

# 运行
java -jar target/priority-queue-api-1.0.0.jar
```

服务启动后访问：
- API: http://localhost:8080/api/tasks
- H2控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:file:./data/batchqueue
  - 用户名: sa
  - 密码: (空)

## 数据库持久化

所有数据保存在嵌入式 H2 数据库中，数据文件位于 `./data/batchqueue`，重启服务后数据不会丢失。

## 项目结构

```
src/main/java/com/batchqueue/
├── PriorityQueueApplication.java     # 启动类
├── controller/
│   └── TaskController.java           # REST API控制器
├── model/
│   ├── dto/                          # 数据传输对象
│   ├── entity/                       # 实体类
│   └── enums/                        # 枚举类
├── repository/                       # 数据访问层
├── service/                          # 业务逻辑层
└── exception/                        # 异常处理
```
