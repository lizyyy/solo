# 接口重试预算服务

## 项目简介

接口重试预算服务是一个用于管理和控制API重试行为的后端服务，通过预算分配、失败分类、退避策略和耗尽拦截等机制，有效控制系统重试风暴，提升系统稳定性。

## ✅ 已修复问题

1. **非消耗型失败不落历史** - 修复：所有失败都记录历史，包括CLIENT_ERROR和AUTHENTICATION_ERROR
2. **预算耗尽返回逻辑不一致** - 修复：耗尽时统一返回allowed=false，添加状态和恢复时间
3. **缺少导出接口** - 新增：支持CSV和JSON两种格式导出
4. **运行依赖问题** - 提供启动脚本，自动检测环境

## 核心功能

### 1. 预算管理
- 为每个调用方和目标API组合分配独立重试预算
- 支持预算查询和状态监控
- 创建操作具有幂等性

### 2. 失败分类与消耗规则
- **消耗预算的失败类型**: TRANSIENT, SERVER_ERROR, TIMEOUT, NETWORK_ERROR, RATE_LIMITED, UNKNOWN
- **不消耗预算的失败类型**: CLIENT_ERROR, AUTHENTICATION_ERROR（但仍记录历史）
- 系统会根据失败原因自动分类

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

### 6. 数据导出
- 支持CSV格式导出失败历史
- 支持JSON格式导出完整数据（预算状态+失败历史+耗尽记录）

## API接口清单

### 预算管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/retry-budget/create | 创建预算（幂等） |
| GET | /api/retry-budget/budget | 查询单个预算状态 |
| GET | /api/retry-budget/budgets | 查询调用方所有预算 |

### 重试控制
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/retry-budget/check | 重试检查（支持幂等键） |
| POST | /api/retry-budget/success | 记录成功，重置连续失败 |

### 数据查询
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/retry-budget/history | 分页查询失败历史 |
| GET | /api/retry-budget/history/{budgetId} | 查询预算历史 |
| GET | /api/retry-budget/exhaustion-records | 查询耗尽记录 |

### 数据导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/retry-budget/export/csv | 导出CSV格式失败历史 |
| GET | /api/retry-budget/export/json | 导出JSON格式完整数据 |

## 快速开始

### 环境要求
- JDK 17+
- Maven 3.8+（可选，启动脚本会自动检测）

### 一键启动

```bash
# 启动服务（自动检测环境，有Maven用Maven，没有提示安装）
./run.sh
```

服务启动后访问：
- 服务地址: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
- JDBC URL: jdbc:h2:file:./data/retry-budget-db

### 运行完整测试

```bash
# 新开一个终端，运行测试脚本
./test-api.sh
```

测试脚本会自动验证：
1. 预算创建幂等
2. 重试检查幂等
3. 失败原因分类
4. 非消耗型失败不扣预算但记录历史
5. 预算耗尽拦截
6. 成功记录状态恢复
7. 历史记录可追溯
8. CSV和JSON导出功能

### 手动测试curl示例

```bash
# 1. 创建预算
curl -X POST "http://localhost:8080/api/retry-budget/create" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "totalBudget": 5,
    "backoffStrategy": "EXPONENTIAL",
    "initialBackoffMs": 1000,
    "maxBackoffMs": 10000,
    "backoffMultiplier": 2.0,
    "recoveryIntervalMs": 60000
  }'

# 2. 重试检查（带幂等键）
curl -X POST "http://localhost:8080/api/retry-budget/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "TRANSIENT",
    "failureReason": "Connection timeout",
    "idempotentKey": "request-001"
  }'

# 3. 查询预算状态
curl "http://localhost:8080/api/retry-budget/budget?callerId=service-order&targetApi=http://payment-service/api/pay"

# 4. 导出CSV
curl "http://localhost:8080/api/retry-budget/export/csv?callerId=service-order&targetApi=http://payment-service/api/pay"

# 5. 导出JSON
curl "http://localhost:8080/api/retry-budget/export/json?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool
```

## 项目结构

```
src/main/java/com/retry/budget/
├── RetryBudgetApplication.java      # 启动类
├── config/
│   └── RetryBudgetConfig.java       # 配置类（定时任务）
├── controller/
│   └── RetryBudgetController.java   # REST控制器
├── dto/                             # 数据传输对象
│   ├── ApiResponse.java
│   ├── BudgetResponse.java
│   ├── CreateBudgetRequest.java
│   ├── RetryCheckRequest.java
│   └── RetryCheckResponse.java
├── entity/                          # 数据实体
│   ├── RetryBudget.java            # 重试预算
│   ├── FailureHistory.java         # 失败历史（含budgetConsumed字段）
│   └── ExhaustionRecord.java      # 耗尽记录
├── enums/                           # 枚举定义
│   ├── BackoffStrategy.java
│   └── FailureType.java
├── exception/
│   └── GlobalExceptionHandler.java  # 全局异常处理
├── repository/                      # 数据访问层
│   ├── RetryBudgetRepository.java
│   ├── FailureHistoryRepository.java
│   └── ExhaustionRecordRepository.java
└── service/
    └── RetryBudgetService.java      # 核心业务逻辑
```

## 核心逻辑修复说明

### 修复前问题
1. 非消耗型失败（CLIENT_ERROR, AUTHENTICATION_ERROR）不记录历史
2. 预算耗尽返回逻辑不一致，校验与历史数据可能不同步
3. 缺少数据导出功能，无法验证数据一致性
4. 运行依赖Maven，无Maven环境无法启动

### 修复后改进

#### 1. 历史记录完整记录
- **所有失败都记录**：无论是否消耗预算，都写入失败历史
- **新增budgetConsumed字段**：明确标识这次失败是否消耗了预算
- **幂等请求也记录**：第一次请求会记录，后续幂等命中直接返回历史

#### 2. 返回逻辑一致性
- 三种场景清晰区分：
  - ✅ 非消耗型失败：allowed=true，预算不变，记录历史
  - ✅ 正常消耗预算：allowed=true（未耗尽），预算减1，记录历史
  - ❌ 预算已耗尽：allowed=false，不扣预算，记录历史
  - ❌ 本次耗尽预算：allowed=false，预算减至0，创建耗尽记录

#### 3. 数据导出功能
- **CSV导出**：失败历史明细表，可直接用Excel打开
- **JSON导出**：完整快照包含预算状态+失败历史+耗尽记录
- 导出数据可用于一致性校验

#### 4. 启动优化
- 自动检测是否有Maven
- 有Maven用Maven编译运行
- 无Maven给出清晰安装指引

## 数据持久化

所有数据持久化到H2文件数据库，路径为`./data/retry-budget-db`。数据表包括：

- **retry_budget**: 重试预算表（callerId + targetApi 唯一索引）
- **failure_history**: 失败历史表（idempotentKey唯一索引，支持幂等）
- **exhaustion_record**: 耗尽记录表

## 验收要点

### 1. 幂等性验证
- 创建预算：重复调用返回相同数据，不重复创建
- 重试检查：相同idempotentKey返回相同结果，不重复扣预算

### 2. 失败原因验证
- 检查failure_history表中failureReason和failureType是否与请求一致
- 客户端错误不消耗预算但记录历史（budgetConsumed=false）

### 3. 历史查询验证
- 查询接口返回的历史数据应与实际调用一致
- 分页参数正确工作

### 4. 导出结果一致性
- CSV导出包含所有失败记录
- JSON导出预算状态remainingBudget与实际调用次数一致
- 导出数据与数据库查询结果完全相同

## 许可证

MIT License
