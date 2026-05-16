# 构建缓存驱逐管理 API (Build Cache Eviction API)

一个基于 Spring Boot 的 REST API 服务，用于管理 CI 构建缓存的驱逐流程。支持缓存命中统计、占用排序、驱逐互斥检查、影响评估、清理报告等核心功能。

## 技术栈
- Java 17
- Spring Boot 3.2.x
- Spring Data JPA
- H2 嵌入式数据库 (持久化到本地文件)

## 快速开始

### 1. 启动服务

```bash
# 编译项目
mvn clean package -DskipTests

# 运行服务
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080

### 2. 数据库控制台 (H2 Console)

访问: http://localhost:8080/h2-console

- JDBC URL: `jdbc:h2:file:./data/cache_eviction_db`
- 用户名: `sa`
- 密码: (空)

### 3. 样例数据初始化

服务启动时会自动创建 10 条缓存条目样例数据，包含不同项目、大小、命中次数的数据。

## API 接口文档

### 基础接口

#### 查看缓存统计
```bash
curl http://localhost:8080/api/cache/stats
```

#### 查看所有缓存条目
```bash
curl http://localhost:8080/api/cache
```

#### 按大小排序查看缓存
```bash
curl http://localhost:8080/api/cache/sorted/size
```

#### 按命中次数排序查看缓存
```bash
curl http://localhost:8080/api/cache/sorted/hitcount
```

### 驱逐申请接口

#### 创建驱逐申请
```bash
curl -X POST http://localhost:8080/api/evictions \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "frontend-project",
    "cacheKeys": [
      "cache:frontend:build:v0.9.0"
    ],
    "requestedBy": "admin@example.com",
    "reason": "Old version no longer needed"
  }'
```

响应示例:
```json
{
  "success": true,
  "message": "Eviction application created",
  "data": {
    "applicationId": "EVICT-1716543210000-abc123",
    "projectName": "frontend-project",
    "cacheKeys": ["cache:frontend:build:v0.9.0"],
    "status": "PENDING",
    "estimatedFreedBytes": 503316480,
    "affectedBuildCount": 10,
    "impactAnalysis": "Impact Analysis for 1 cache entries:\n- Total cache size to free: 480.00 MB\n..."
  }
}
```

#### 查看所有驱逐申请
```bash
curl http://localhost:8080/api/evictions
```

#### 查看特定申请详情
```bash
curl http://localhost:8080/api/evictions/{applicationId}
```

#### 状态推进: 分析中
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "ANALYZING"
  }'
```

#### 状态推进: 批准 (无活跃构建)
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "APPROVED",
    "approvedBy": "manager@example.com"
  }'
```

#### 执行驱逐
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "EXECUTING"
  }'
```

#### 完成驱逐
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "COMPLETED"
  }'
```

响应中会包含清理报告:
```json
{
  "success": true,
  "message": "Status updated",
  "data": {
    "cleanupReport": "Eviction Cleanup Report\n=======================\nApplication ID: EVICT-...\nTotal bytes freed: 503316480 (480.00 MB)\n..."
  }
}
```

### 被规则拦截的路径示例

#### 场景 1: 检测到活跃构建时批准被拦截

创建一个包含高频使用缓存的驱逐申请:
```bash
curl -X POST http://localhost:8080/api/evictions \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "backend-service",
    "cacheKeys": [
      "cache:backend:dependencies:2024"
    ],
    "requestedBy": "admin@example.com"
  }'
```

然后尝试批准:
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "APPROVED",
    "approvedBy": "manager@example.com"
  }'
```

会被拦截并返回:
```json
{
  "success": false,
  "message": "Cannot approve eviction: Active builds detected. Use forceOverride to proceed.",
  "errorCode": "STATE_CONFLICT"
}
```

强制覆盖的方式:
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "APPROVED",
    "approvedBy": "manager@example.com",
    "forceOverride": true
  }'
```

#### 场景 2: 非法的状态转换

直接从 PENDING 跳到 COMPLETED:
```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "COMPLETED"
  }'
```

会被拦截并返回:
```json
{
  "success": false,
  "message": "Invalid status transition from PENDING to COMPLETED",
  "errorCode": "STATE_CONFLICT"
}
```

### 人工修正接口

```bash
curl -X PATCH http://localhost:8080/api/evictions/{applicationId}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "estimatedFreedBytes": 1073741824,
    "affectedBuildCount": 5,
    "impactAnalysis": "Manual override: risk reassessed as LOW after team review"
  }'
```

### 导出接口

#### 导出单个申请
```bash
curl http://localhost:8080/api/evictions/{applicationId}/export
```

#### 导出所有申请
```bash
curl http://localhost:8080/api/evictions/export
```

### 异常查询接口

所有异常（包括被拦截的请求）都会保留原始输入和处理结论：

```bash
# 查看所有异常
curl http://localhost:8080/api/exceptions

# 按申请ID查看关联异常
curl http://localhost:8080/api/exceptions/application/{applicationId}

# 按操作类型查看
curl http://localhost:8080/api/exceptions/operation/STATE_TRANSITION
```

## 核心规则说明

### 1. 命中统计
- 每次缓存访问自动记录命中次数
- 按命中次数排序，识别低频访问的缓存

### 2. 占用排序
- 按大小降序排列，快速识别大体积缓存
- 支持按项目分组统计

### 3. 驱逐互斥（活跃构建检测）
- 高频访问缓存 (>1000 hits) 被标记为高风险
- 受影响构建数 >3 时自动拦截批准操作
- 支持强制覆盖（需显式指定）

### 4. 影响评估
- 创建申请时自动生成影响分析报告
- 估算释放空间
- 预测受影响构建数量
- 风险等级（高/中/低）自动标注

### 5. 清理报告
- 驱逐执行后生成详细报告
- 记录实际释放字节数
- 记录处理的缓存键列表

### 6. 异常溯源
- 所有失败请求保留原始输入
- 记录处理结论和错误栈
- 支持按申请ID、缓存键、操作类型查询

## 状态流转图

```
PENDING → ANALYZING → APPROVED → EXECUTING → COMPLETED
   ↓           ↓           ↓           ↓
REJECTED    REJECTED    REJECTED    FAILED
   ↓           ↓           ↓           ↓
[TERMINAL]  [TERMINAL]  [TERMINAL]  [TERMINAL]

也可直接: PENDING → REJECTED, PENDING → CANCELLED
```

## 项目结构

```
src/main/java/com/ci/cache/
├── CacheEvictionApplication.java  # 主应用入口
├── model/
│   ├── CacheEntry.java           # 缓存条目实体
│   ├── EvictionApplication.java  # 驱逐申请实体
│   ├── EvictionStatus.java       # 状态枚举
│   └── ProcessingException.java  # 异常记录实体
├── dto/
│   ├── ApiResponse.java          # 统一响应封装
│   ├── EvictionRequest.java      # 创建申请请求
│   ├── StatusUpdateRequest.java  # 状态更新请求
│   └── ManualCorrectionRequest.java  # 人工修正请求
├── repository/                    # 数据访问层
├── service/                       # 业务逻辑层
├── controller/                    # REST 控制器
├── exception/
│   └── GlobalExceptionHandler.java  # 全局异常处理
└── config/
    ├── DataInitializer.java       # 样例数据初始化
    └── RequestCachingFilter.java  # 请求内容缓存过滤器
```

## 数据库文件位置

数据库文件存储在项目根目录:
```
./data/cache_eviction_db.mv.db
```

如需重置数据，直接删除 `./data` 目录后重启服务即可。
