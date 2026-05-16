# 连接池泄漏诊断API

## 项目概述

为线上偶发连接数飙高问题提供诊断能力，保留诊断证据。

## 技术栈

- Spring Boot 2.7.18
- JPA + H2 Database
- Lombok
- Apache POI (Excel导出)
- FastJSON

## 项目结构

```
src/main/java/com/diagnostic/
├── DiagnosticApplication.java      # 启动类
├── config/
│   ├── DiagnosticProperties.java   # 诊断配置参数
│   └── WebConfig.java              # Web配置
├── controller/
│   └── DiagnosticController.java   # API控制器
├── dto/
│   ├── ApiResponse.java            # 统一响应
│   ├── DiagnosticCreateRequest.java
│   ├── DiagnosticQueryRequest.java
│   ├── ManualCorrectionRequest.java
│   └── StatusUpdateRequest.java
├── entity/
│   ├── ConnectionPoolDiagnostic.java  # 诊断记录实体
│   ├── DiagnosticReport.java          # 诊断报告实体
│   └── ServiceInstance.java           # 服务实例实体
├── enums/
│   └── DiagnosticStatus.java          # 诊断状态枚举
├── exception/
│   └── GlobalExceptionHandler.java    # 全局异常处理
├── repository/
│   ├── ConnectionPoolDiagnosticRepository.java
│   └── DiagnosticReportRepository.java
└── service/
    └── DiagnosticService.java         # 业务逻辑
```

## 核心数据模型

### 诊断记录字段
- 服务实例ID、连接池名称、采样时间
- 连接数统计（总连接、活跃连接、空闲连接、等待线程）
- 堆栈摘要、堆栈详情
- 疑似泄漏标记、泄漏置信度、连续泄漏采样数
- 状态（待处理/已确认/被拦截/已撤销/已补偿）
- 原始输入、处理依据、最终结论
- 复核人、复核时间、复核意见

### 诊断状态
- **PENDING** (待处理): 初始状态，等待人工确认
- **CONFIRMED** (已确认): 人工确认泄漏存在
- **BLOCKED** (被拦截): 系统自动拦截
- **REVOKED** (已撤销): 撤销误报
- **COMPENSATED** (已补偿): 已处理完毕

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/diagnostic | 创建诊断记录 |
| POST | /api/diagnostic/query | 查询诊断记录 |
| GET | /api/diagnostic/{id} | 查询单条记录 |
| PUT | /api/diagnostic/status | 状态推进 |
| PUT | /api/diagnostic/manual-correction | 人工修正 |
| POST | /api/diagnostic/report | 生成诊断报告 |
| GET | /api/diagnostic/report/{reportNo} | 查询报告 |
| POST | /api/diagnostic/export/excel | 导出Excel |
| POST | /api/diagnostic/export/json | 导出JSON |
| GET | /api/diagnostic/statuses | 获取所有状态 |
| POST | /api/diagnostic/archive | 归档旧记录 |

## 核心规则

### 泄漏评估规则 (满分100分)
1. **活跃连接使用率** >= 阈值(默认80%): +40分
2. **连接使用时间** > 阈值(默认300秒): +30分
3. **存在等待线程**: +20分
4. **连续泄漏采样** >= 阈值(默认3次): +10分

评分 >= 50分 标记为 **疑似泄漏**

### 归档规则
- 默认保留30天数据
- 可通过配置修改保留天数

## 配置说明

```yaml
diagnostic:
  leak:
    threshold:
      active-connection: 80      # 活跃连接使用率阈值
      connection-usage-time: 300 # 连接使用时间阈值(秒)
      consecutive-samples: 3     # 连续采样阈值
    archive:
      retention-days: 30         # 数据保留天数
      sample-interval-minutes: 5 # 建议采样间隔
```

## 启动方式

### 方式1: 使用启动脚本 (推荐，自动检测环境)
脚本会自动检测Maven或Docker，优先使用本地Maven
```bash
./start.sh
```

### 方式2: Maven Wrapper (无需预装Maven)
自动下载并使用指定版本的Maven
```bash
./mvnw spring-boot:run
```

### 方式3: Docker Compose (无需Maven，一键启动)
```bash
docker-compose up --build
```

### 方式4: 纯Docker命令 (分步执行)
```bash
# 构建镜像
docker build -t diagnostic-api .

# 运行容器
docker run -p 8080:8080 diagnostic-api
```

### 方式5: 本地Maven (已安装Maven时使用)
```bash
mvn spring-boot:run
```

## 服务验证

服务启动成功后，执行以下命令验证核心API：
```bash
# 方式1: 使用验证脚本（推荐）
./verify_api.sh

# 方式2: 手动curl测试
curl http://localhost:8080/diagnostic/api/diagnostic/statuses
```

## 访问信息

- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- **- *t:8080/diagnostic/h2-console
- **ContextPath**: /diagnostic
- **默认端口**: 8080

## 接口调用示例

### 创建诊断记录
```bash
curl -X POST http://localhost:8080/diagnostic/api/diagnostic \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "service-001",
    "poolName": "hikari-pool",
    "sampleTime": "2024-01-15T10:30:00",
    "totalConnections": 100,
    "activeConnections": 95,
    "idleConnections": 5,
    "waitingThreads": 20,
    "maxPoolSize": 100,
    "connectionUsageAvgTime": 280,
    "connectionUsageMaxTime": 600,
    "stackSummary": "com.mysql.jdbc.PreparedStatement.execute",
    "rawInput": "..."
  }'
```

### 查询诊断记录
```bash
curl -X POST http://localhost:8080/diagnostic/api/diagnostic/query \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "service-001",
    "suspectedLeak": true,
    "pageNum": 1,
    "pageSize": 20
  }'
```

### 状态推进
```bash
curl -X PUT http://localhost:8080/diagnostic/api/diagnostic/status \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "targetStatus": "CONFIRMED",
    "finalConclusion": "确认存在连接泄漏",
    "reviewer": "admin"
  }'
```

### 人工修正
```bash
curl -X PUT http://localhost:8080/diagnostic/api/diagnostic/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "suspectedLeak": false,
    "leakConfidence": 10,
    "reviewer": "admin",
    "processingBasis": "经核实为业务高峰期",
    "finalConclusion": "正常业务波动",
    "reviewComment": "误报"
  }'
```

### 生成诊断报告
```bash
curl -X POST "http://localhost:8080/diagnostic/api/diagnostic/report?instanceId=service-001&poolName=hikari-pool&startTime=2024-01-15 00:00:00&endTime=2024-01-15 23:59:59"
```
