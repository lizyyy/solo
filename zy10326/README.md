# 接口重试预算服务

## 🚀 30秒快速开始

### 前置要求
- **Java 17+** (必选)
- **curl** (必选，用于下载Maven和测试)

### 只需两步，直接运行

```bash
# 1. 启动服务 (自动下载Maven + 依赖 + 编译 + 启动)
./start.sh

# 2. 新开终端，运行完整验证
./verify.sh
```

就这么简单！无需预装Maven，无需任何其他配置。

---

## 📋 项目简介

接口重试预算服务是一个用于管理和控制API重试行为的后端服务，通过预算分配、失败分类、退避策略和耗尽拦截等机制，有效控制系统重试风暴，提升系统稳定性。

## ✅ 已修复问题

1. **✓ 运行链路问题** - 提供 `start.sh` 全自动脚本，无需预装Maven，自动下载所有依赖
2. **✓ 非消耗型失败不落历史** - 所有失败都记录历史，包括CLIENT_ERROR和AUTHENTICATION_ERROR
3. **✓ 预算耗尽返回逻辑不一致** - 耗尽时统一返回allowed=false，状态和恢复时间准确
4. **✓ 缺少导出接口** - 支持CSV和JSON两种格式导出，直接验证数据一致性
5. **✓ 完整测试脚本** - `verify.sh` 自动验证14项核心功能

## 📁 脚本说明

| 脚本 | 说明 |
|------|------|
| `start.sh` | ⭐ 推荐！全自动启动脚本，自动下载Maven、编译、运行 |
| `verify.sh` | 完整功能验证脚本，覆盖幂等、耗尽、导出等所有场景 |
| `run.sh` | 标准启动脚本，优先使用mvnw，其次系统Maven |
| `mvnw` | Maven wrapper，项目自带，无需系统安装Maven |
| `test-api.sh` | 旧版测试脚本（保留兼容） |

## 🎯 核心功能

### 1. 预算管理
- 为每个调用方和目标API组合分配独立重试预算
- 创建操作具有幂等性，重复创建不生成脏数据

### 2. 失败分类与消耗规则
- **消耗预算** (扣减remaining): `TRANSIENT`, `SERVER_ERROR`, `TIMEOUT`, `NETWORK_ERROR`, `RATE_LIMITED`, `UNKNOWN`
- **不消耗预算** (但记录历史): `CLIENT_ERROR`, `AUTHENTICATION_ERROR`
- 系统会根据失败原因自动分类

### 3. 退避策略
- `FIXED`: 固定间隔退避
- `LINEAR`: 线性退避
- `EXPONENTIAL`: 指数退避（推荐）
- `FIBONACCI`: 斐波那契退避

### 4. 耗尽拦截与恢复
- 预算耗尽后自动拦截后续重试请求 (allowed=false)
- 定时恢复机制（每分钟检查一次）
- 恢复后补充10%预算（至少1次）
- 记录耗尽事件便于审计

### 5. 幂等性保证
- 支持自定义幂等键 `idempotentKey`
- 相同幂等键请求只处理一次，返回历史结果

### 6. 数据导出
- **CSV导出**: 失败历史明细表，可直接用Excel打开
- **JSON导出**: 完整快照，包含预算状态 + 失败历史 + 耗尽记录
- 导出数据与数据库查询完全一致，可用于一致性校验

## 🌐 API接口清单

### 预算管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/retry-budget/create` | 创建预算（幂等） |
| GET | `/api/retry-budget/budget` | 查询单个预算状态 |
| GET | `/api/retry-budget/budgets` | 查询调用方所有预算 |

### 重试控制
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/retry-budget/check` | 重试检查（支持幂等键） |
| POST | `/api/retry-budget/success` | 记录成功，重置连续失败 |

### 数据查询
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/retry-budget/history` | 分页查询失败历史 |
| GET | `/api/retry-budget/history/{budgetId}` | 查询预算历史 |
| GET | `/api/retry-budget/exhaustion-records` | 查询耗尽记录 |

### 数据导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/retry-budget/export/csv` | 导出CSV格式失败历史 |
| GET | `/api/retry-budget/export/json` | 导出JSON格式完整数据 |

## 🔍 手动测试curl示例

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
  }' | python3 -m json.tool

# 2. 重试检查（带幂等键）
curl -X POST "http://localhost:8080/api/retry-budget/check" \
  -H "Content-Type: application/json" \
  -d '{
    "callerId": "service-order",
    "targetApi": "http://payment-service/api/pay",
    "failureType": "TRANSIENT",
    "failureReason": "Connection timeout",
    "idempotentKey": "request-001"
  }' | python3 -m json.tool

# 3. 查询预算状态
curl "http://localhost:8080/api/retry-budget/budget?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool

# 4. 导出CSV
curl "http://localhost:8080/api/retry-budget/export/csv?callerId=service-order&targetApi=http://payment-service/api/pay"

# 5. 导出JSON
curl "http://localhost:8080/api/retry-budget/export/json?callerId=service-order&targetApi=http://payment-service/api/pay" | python3 -m json.tool
```

## 🏗️ 项目结构

```
src/main/java/com/retry/budget/
├── RetryBudgetApplication.java      # 启动类
├── controller/
│   └── RetryBudgetController.java   # REST控制器
├── dto/                             # 数据传输对象
├── entity/                          # 数据实体
├── enums/                           # 枚举定义
├── exception/
│   └── GlobalExceptionHandler.java  # 全局异常处理
├── repository/                      # 数据访问层
└── service/
    └── RetryBudgetService.java      # 核心业务逻辑
```

## 💾 数据持久化

所有数据持久化到H2文件数据库，路径为 `./data/retry-budget-db`。

**H2控制台访问:**
- URL: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:file:./data/retry-budget-db`
- 用户名: `sa`
- 密码: (空)

数据表包括:
- `retry_budget`: 重试预算表
- `failure_history`: 失败历史表
- `exhaustion_record`: 耗尽记录表

## ✅ 验收要点

运行 `./verify.sh` 会自动验证以下所有场景:

1. **✓ 幂等性**: 创建预算、重试检查的幂等性
2. **✓ 失败原因**: 失败原因正确记录到历史表
3. **✓ 非消耗型失败**: CLIENT_ERROR不扣预算但记录历史
4. **✓ 预算耗尽**: allowed=false，后续请求被拦截
5. **✓ 成功重置**: 记录success后状态正确重置
6. **✓ 历史查询**: 查询接口返回完整数据
7. **✓ 导出功能**: CSV和JSON导出正常工作
8. **✓ 数据一致性**: 导出数据与查询结果完全一致

## 📝 常见问题

**Q: 启动很慢？**
A: 第一次运行需要下载Maven和Spring Boot依赖（约50MB），只需要下载一次，后续启动会很快。

**Q: 需要设置Maven镜像吗？**
A: 脚本已经自动配置了阿里云镜像，国内访问也很快。

**Q: 如何清理数据重新测试？**
A: `rm -rf data/` 删除H2数据库，然后重新运行 `./start.sh`。

**Q: Java版本不兼容？**
A: 确保Java >= 17，运行 `java -version` 检查，Mac可通过 `brew install openjdk@17` 安装。
