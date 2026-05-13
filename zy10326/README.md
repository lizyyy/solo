# 接口重试预算服务

## 项目简介

接口重试预算服务是一个用于管理和控制API重试行为的后端服务，通过预算分配、失败分类、退避策略和耗尽拦截等机制，有效控制系统重试风暴，提升系统稳定性。

## 技术栈

- **框架**: Spring Boot 3.2.x
- **数据库**: H2 (嵌入式文件数据库)
- **ORM**: Spring Data JPA
- **JDK**: Java 17+
- **构建工具**: Maven

## 核心功能

### 1. 预算管理
- 为每个调用方和目标API组合分配独立重试预算
- 支持预算查询和状态监控
- 创建操作具有幂等性

### 2. 失败分类
- `TRANSIENT`: 临时性错误，建议重试
- `CLIENT_ERROR`: 客户端错误，不消耗预算
- `SERVER_ERROR`: 服务端错误
- `TIMEOUT`: 超时错误
- `NETWORK_ERROR`: 网络错误
- `RATE_LIMITED`: 限流错误
- `AUTHENTICATION_ERROR`: 认证错误，不消耗预算
- `UNKNOWN`: 未知错误

### 3. 退避策略
- `FIXED`: 固定间隔退避
- `LINEAR`: 线性退避
- `EXPONENTIAL`: 指数退避（推荐）
- `FIBONACCI`: 斐波那契退避

### 4. 耗尽拦截与恢复
- 预算耗尽后自动拦截后续重试请求
- 定时恢复机制（每分钟检查一次）
- 恢复后补充10%预算（至少1次）
- 记录耗尽事件便于审计

### 5. 幂等性保证
- 支持自定义幂等键
- 相同幂等键请求只处理一次，返回历史结果

## API接口

### 创建预算
```bash
POST /api/retry-budget/create
Content-Type: application/json

{
  "callerId": "service-order",
  "targetApi": "http://payment-service/api/pay",
  "totalBudget": 5,
  "backoffStrategy": "EXPONENTIAL",
  "initialBackoffMs": 1000,
  "maxBackoffMs": 10000,
  "backoffMultiplier": 2.0,
  "recoveryIntervalMs": 60000
}
```

### 重试检查
```bash
POST /api/retry-budget/check
Content-Type: application/json

{
  "callerId": "service-order",
  "targetApi": "http://payment-service/api/pay",
  "failureType": "TRANSIENT",
  "failureReason": "Connection timeout",
  "idempotentKey": "request-001"
}
```

### 记录成功
```bash
POST /api/retry-budget/success?callerId=service-order&targetApi=http://payment-service/api/pay
```

### 查询预算
```bash
GET /api/retry-budget/budget?callerId=service-order&targetApi=http://payment-service/api/pay
```

### 查询失败历史
```bash
GET /api/retry-budget/history?callerId=service-order&targetApi=http://payment-service/api/pay&page=0&size=20
```

### 查询耗尽记录
```bash
GET /api/retry-budget/exhaustion-records?callerId=service-order&targetApi=http://payment-service/api/pay
```

## 快速开始

### 环境要求
- JDK 17+
- Maven 3.8+

### 构建项目
```bash
mvn clean package
```

### 运行项目
```bash
mvn spring-boot:run
```
或者
```bash
java -jar target/retry-budget-service-1.0.0.jar
```

### 访问地址
- 服务地址: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
- H2 JDBC URL: jdbc:h2:file:./data/retry-budget-db

### 运行测试脚本
```bash
chmod +x test-api.sh
./test-api.sh
```

## 项目结构
```
src/main/java/com/retry/budget/
├── RetryBudgetApplication.java      # 启动类
├── config/
│   └── RetryBudgetConfig.java       # 配置类
├── controller/
│   └── RetryBudgetController.java   # REST控制器
├── dto/
│   ├── ApiResponse.java             # 统一响应封装
│   ├── BudgetResponse.java          # 预算响应DTO
│   ├── CreateBudgetRequest.java     # 创建预算请求DTO
│   ├── RetryCheckRequest.java       # 重试检查请求DTO
│   └── RetryCheckResponse.java      # 重试检查响应DTO
├── entity/
│   ├── ExhaustionRecord.java        # 耗尽记录实体
│   ├── FailureHistory.java          # 失败历史实体
│   └── RetryBudget.java             # 重试预算实体
├── enums/
│   ├── BackoffStrategy.java         # 退避策略枚举
│   └── FailureType.java             # 失败类型枚举
├── exception/
│   └── GlobalExceptionHandler.java  # 全局异常处理
├── repository/
│   ├── ExhaustionRecordRepository.java
│   ├── FailureHistoryRepository.java
│   └── RetryBudgetRepository.java
└── service/
    └── RetryBudgetService.java      # 核心业务逻辑
```

## 核心规则说明

### 预算消耗规则
- 客户端错误(CLIENT_ERROR)和认证错误(AUTHENTICATION_ERROR)不消耗预算
- 其他失败类型每次重试消耗1个预算

### 退避计算示例
使用指数退避策略:
- 初始退避: 1000ms
- 乘数: 2.0
- 最大退避: 10000ms
- 第1次失败: 1000ms
- 第2次失败: 2000ms
- 第3次失败: 4000ms
- 第4次失败: 8000ms
- 第5次及以后: 10000ms

### 恢复机制
- 预算耗尽后，恢复间隔时间到达后自动恢复
- 恢复预算 = 总预算 × 10%（至少恢复1次）

## 数据持久化

所有数据持久化到H2文件数据库，路径为`./data/retry-budget-db`。数据表包括：
- `retry_budget`: 重试预算表
- `failure_history`: 失败历史表
- `exhaustion_record`: 耗尽记录表

## 测试验证重点

1. **幂等性**: 重复创建预算、重复重试检查不会产生脏数据
2. **失败归类**: 根据失败原因自动归类失败类型
3. **历史查询**: 失败记录和耗尽记录可追溯
4. **导出一致性**: 查询结果与实际状态一致

## 许可证

MIT License
