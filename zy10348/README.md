# 多租户加密轮换 API (Multi-tenant Encryption Rotation API)

## 项目概述

这是一个基于 Spring Boot 2.7.x 的多租户加密密钥轮换管理系统，提供完整的密钥轮换工作流管理，包括批次创建、任务执行、异常处理、验证抽样和报告生成。

## 核心特性

- **状态机驱动**: 完整的轮换状态流转控制
  - PENDING → VALIDATING → IN_PROGRESS → PARTIAL_SUCCESS → VERIFYING → COMPLETED
  - 支持 CANCELLED、FAILED 异常终止状态

- **分批轮换**: 支持批量创建重加密任务
- **失败隔离**: 单个任务失败不影响整个批次，自动记录失败详情
- **验证抽样**: 对成功任务自动抽取 10% 进行验证
- **重复提交保护**: 幂等性设计，相同请求返回同一批次
- **完整审计**: 所有操作都有历史记录可追溯

## 技术栈

- Java 8+ (兼容 JDK 1.8 - 17)
- Spring Boot 2.7.18
- Spring Data JPA
- H2 内存数据库
- Lombok

## 快速开始

### 环境要求

- **JDK**: 8 或更高版本 (1.8 - 17)
- **Maven**: 3.6 或更高版本（必需）

### 环境验证

运行验证脚本检查环境和代码：

```bash
./verify.sh
```

### 1. 启动应用

确保已安装 Maven 后运行：

```bash
mvn spring-boot:run
```

应用默认运行在 `http://localhost:8080`

### 2. 访问 H2 数据库控制台

```
http://localhost:8080/h2-console
JDBC URL: jdbc:h2:mem:rotationdb
用户名: sa
密码: (空)
```

## API 接口

### 基础路径

```
/api/rotation
```

### 1. 创建轮换批次

**POST** `/api/rotation`

请求体:
```json
{
  "tenantId": "tenant-001",
  "sourceKeyId": "key-v1",
  "targetKeyId": "key-v2",
  "createdBy": "admin",
  "reason": "季度密钥轮换",
  "dataIdentifiers": ["data-001", "data-002", "data-003", "data-004", "data-005"]
}
```

### 2. 启动轮换

**POST** `/api/rotation/{batchId}/start`

### 3. 处理单个任务

**POST** `/api/rotation/task/{taskId}/process?simulateFailure=false`

参数:
- `simulateFailure`: 是否模拟失败，默认 false

### 4. 取消轮换

**POST** `/api/rotation/{batchId}/cancel`

请求体 (可选):
```json
{
  "reason": "发现问题，中止轮换"
}
```

### 5. 开始验证阶段

**POST** `/api/rotation/{batchId}/verify`

Header:
- `X-User-Id`: 操作人ID

### 6. 完成轮换

**POST** `/api/rotation/{batchId}/complete`

### 7. 查询批次详情

**GET** `/api/rotation/{batchId}`

### 8. 生成轮换报告

**GET** `/api/rotation/{batchId}/report`

### 9. 查询租户历史

**GET** `/api/rotation/tenant/{tenantId}/history`

### 10. 查询任务列表

**GET** `/api/rotation/{batchId}/tasks`

### 11. 查询失败记录

**GET** `/api/rotation/{batchId}/failures`

### 12. 查询验证记录

**GET** `/api/rotation/{batchId}/verifications`

## 测试用例

### 正常流程测试

```bash
# 1. 创建轮换批次
curl -X POST http://localhost:8080/api/rotation \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-001",
    "sourceKeyId": "key-v1",
    "targetKeyId": "key-v2",
    "createdBy": "admin",
    "reason": "季度密钥轮换",
    "dataIdentifiers": ["data-001", "data-002", "data-003", "data-004", "data-005"]
  }'

# 2. 启动轮换（替换 batchId）
curl -X POST http://localhost:8080/api/rotation/{batchId}/start

# 3. 查看任务列表
curl http://localhost:8080/api/rotation/{batchId}/tasks

# 4. 逐个处理任务（替换 taskId）
curl -X POST http://localhost:8080/api/rotation/task/{taskId}/process

# 5. 开始验证
curl -X POST http://localhost:8080/api/rotation/{batchId}/verify \
  -H "X-User-Id: verifier-001"

# 6. 完成轮换
curl -X POST http://localhost:8080/api/rotation/{batchId}/complete

# 7. 查看报告
curl http://localhost:8080/api/rotation/{batchId}/report
```

### 异常场景测试

#### 1. 模拟任务失败

```bash
# 处理任务时触发失败
curl -X POST http://localhost:8080/api/rotation/task/{taskId}/process?simulateFailure=true

# 查看失败记录
curl http://localhost:8080/api/rotation/{batchId}/failures
```

#### 2. 取消正在进行的轮换

```bash
curl -X POST http://localhost:8080/api/rotation/{batchId}/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "发现问题，需要中止"}'
```

#### 3. 状态机异常测试

```bash
# 尝试重复完成已完成的批次（应该失败）
curl -X POST http://localhost:8080/api/rotation/{batchId}/complete
```

## 数据模型

### 核心实体

| 实体 | 说明 | 关键字段 |
|------|------|----------|
| Tenant | 租户 | tenantCode, tenantName |
| KeyVersion | 密钥版本 | version, keyReference, status |
| RotationBatch | 轮换批次 | batchNumber, status, 统计字段 |
| ReEncryptionTask | 重加密任务 | dataIdentifier, status, retryCount |
| FailureRecord | 失败记录 | failureType, errorMessage, stackTrace |
| VerificationRecord | 验证记录 | isSampled, status, verifiedBy |

### 状态枚举

**RotationStatus**:
- `PENDING`: 待开始
- `VALIDATING`: 验证中
- `IN_PROGRESS`: 进行中
- `PARTIAL_SUCCESS`: 部分成功
- `VERIFYING`: 验证中
- `COMPLETED`: 已完成
- `CANCELLED`: 已取消
- `FAILED`: 已失败

**TaskStatus**:
- `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `SKIPPED`, `RETRYING`

## 预置测试数据

应用启动时自动初始化:

- **Tenants**:
  - `tenant-001` (ACME Corporation)
  - `tenant-002` (Globex Inc.)

- **Keys**:
  - `key-v1` (ACTIVE, tenant-001)
  - `key-v2` (PENDING_ACTIVATION, tenant-001)
  - `key-v3` (ACTIVE, tenant-002)

## 统一响应格式

```json
{
  "success": true,
  "code": "200",
  "message": "操作成功",
  "data": { ... }
}
```

错误响应:
```json
{
  "success": false,
  "code": "INVALID_STATE_TRANSITION",
  "message": "不允许从状态[COMPLETED]转换到[IN_PROGRESS]",
  "data": null
}
```

## 核心业务规则

1. **状态机约束**: 所有状态转换必须符合预定规则，终态不可变更
2. **重复提交保护**: 相同租户 + 源密钥 + 目标密钥 + 相同数据标识集合的请求，在批次未完成前返回同一批次
3. **数据签名机制**: 通过 SHA-256 对排序后的数据标识生成签名，确保顺序无关的重复检测
4. **失败隔离**: 单个任务失败不影响其他任务，自动记录失败详情
5. **抽样验证**: 对成功任务自动抽取 10%（至少 1 个）进行验证
6. **进度自动更新**: 任务处理完成后自动更新批次统计信息

## 重复提交保护机制

### 实现原理

```
CreateRotationRequest
    │
    ▼
  排序 dataIdentifiers（确保顺序无关）
    │
    ▼
  SHA-256 生成 dataSignature
    │
    ▼
  查询: tenantId + sourceKeyId + targetKeyId + dataSignature
        + 状态为非终态(PENDING/VALIDATING/IN_PROGRESS/PARTIAL_SUCCESS/VERIFYING)
    │
    ├─ 找到匹配批次 → 返回已有批次
    └─ 未找到 → 创建新批次
```

### 测试方法

```bash
# 第一次创建
curl -X POST http://localhost:8080/api/rotation \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-001","sourceKeyId":"key-v1","targetKeyId":"key-v2","createdBy":"admin","dataIdentifiers":["a","b","c"]}'

# 第二次相同请求 → 返回同一批次 ID
curl -X POST http://localhost:8080/api/rotation \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-001","sourceKeyId":"key-v1","targetKeyId":"key-v2","createdBy":"admin","dataIdentifiers":["c","b","a"]}'

# 注意：即使 dataIdentifiers 顺序不同，也会识别为重复
```
