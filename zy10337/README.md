# 批量审批回调协调器

基于 Spring Boot 的单体后端服务，核心规则内置，解决批量审批场景下的回调协调问题。

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **批次拆分** | 支持将大批量单据按配置分片处理，默认分片大小10 |
| **幂等校验** | 通过幂等键防止重复提交产生脏数据，数据库唯一索引保证 |
| **部分失败定位** | 精确追踪每个单据的处理状态和错误信息 |
| **范围重放** | 支持按单据ID、分片号或全量失败重放 |
| **回执汇总** | 生成可导出的处理回执和问题排查报告 |
| **时间线追踪** | 完整记录每个关键动作的操作轨迹 |

## 🏗️ 技术栈

- **框架**: Spring Boot 2.7.18 (兼容 Java 8)
- **数据库**: H2 (内存数据库，生产环境可替换为MySQL)
- **ORM**: Spring Data JPA
- **数据校验**: Javax Validation
- **构建工具**: Maven (内置 Wrapper)

## 🚀 快速开始

### 1. 编译项目

```bash
mvn clean package -DskipTests
```

### 2. 启动服务

```bash
mvn spring-boot:run
```

服务启动后访问:
- 管理页面: http://localhost:8080
- API 文档: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:approvaldb`
  - 用户名: `sa`
  - 密码: (空)

### 3. 运行演示脚本

```bash
./demo-api.sh
```

## 📊 核心数据模型

### ApprovalBatch (审批批次)

| 字段 | 说明 |
|------|------|
| batchId | 批次ID (主键) |
| businessType | 业务类型 |
| sourceSystem | 来源系统 |
| status | 批次状态: CREATED, PROCESSING, PARTIAL_SUCCESS, COMPLETED, REPLAYING |
| totalCount | 单据总数 |
| successCount | 成功数量 |
| failedCount | 失败数量 |
| chunkSize | 分片大小 |
| currentChunk | 当前分片号 |
| totalChunks | 总分片数 |

### ApprovalItem (审批单据)

| 字段 | 说明 |
|------|------|
| id | 自增ID |
| itemId | 单据ID |
| idempotentKey | 幂等键 (唯一索引) |
| status | 单据状态: PENDING, PROCESSING, SUCCESS, FAILED, REPLAYING, SKIPPED |
| chunkNumber | 所属分片号 |
| errorCode | 错误码 |
| errorMessage | 错误信息 |
| retryCount | 重试次数 |

## 🔌 API 接口

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 创建审批批次 |
| POST | `/api/batches/{batchId}/start` | 开始处理批次 |
| GET | `/api/batches` | 查询批次列表 |
| GET | `/api/batches/{batchId}` | 查询批次详情 |

### 回调处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches/callback` | 处理回调结果 |

### 重放机制

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches/{batchId}/replay` | 重放单据 |

支持的重放方式:
```json
{
  "batchId": "BATCH-001",
  "operator": "admin",
  "itemIds": ["EXP-005", "EXP-007"],  // 按单据ID重放
  "chunkNumbers": [1, 2],              // 按分片号重放
  "replayAllFailed": true              // 重放所有失败单据
}
```

### 单据查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches/{batchId}/items` | 查询批次下所有单据 |
| GET | `/api/batches/{batchId}/items/failed` | 查询失败单据 |

### 追踪与回执

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches/{batchId}/timeline` | 查询批次时间线 |
| POST | `/api/batches/{batchId}/receipts` | 生成处理回执 |
| GET | `/api/batches/{batchId}/receipts` | 查询批次回执列表 |
| GET | `/api/batches/{batchId}/debug-report` | 导出问题排查报告 |

## 📋 状态流转

### 批次状态

```
CREATED → PROCESSING → PARTIAL_SUCCESS / COMPLETED → REPLAYING
```

### 单据状态

```
PENDING → PROCESSING → SUCCESS / FAILED → REPLAYING → SUCCESS / FAILED
```

## 🔒 幂等性保证

1. **创建批次时**: 检查 batchId 是否已存在，存在则返回错误
2. **创建单据时**: 检查 idempotentKey 是否已存在，数据库唯一索引双重保证
3. **重复提交保护**: 相同 batchId 或 idempotentKey 的请求会被拒绝
4. **重复回调保护**: 已处于 SUCCESS/FAILED 终态的单据，重复回调会被自动跳过，不会重复计数
5. **重放状态修正**: 重放成功会自动扣减旧失败计数，重放失败会自动扣减旧成功计数，保证统计准确

## 🐛 核心规则修复说明

### 1. 重放 API 参数校验修复（第四轮）
- **问题**: `ReplayRequest` DTO 中 `batchId` 有 `@NotBlank` 校验，但 Controller 中 `batchId` 从路径参数获取，进入方法后才 `setBatchId`
  - 根本原因: Spring `@Valid` 校验在方法执行前触发，此时 request body 的 `batchId` 为 null
  - 后果: 所有重放请求都返回 400 参数校验失败，范围重放核心流程不可用
- **修复方案**:
  - 移除 `ReplayRequest.batchId` 的 `@NotBlank` 校验注解
  - `batchId` 由路径参数提供，确保 API 可调用
  - 验证: `demo-api.sh` 第 6 步使用路径参数 API 可正常执行

### 2. 重复回调不产生脏结果
- **问题**: 同一单据重复回调会重复累加成功/失败计数
- **修复**: 检测到单据已处于 SUCCESS/FAILED 终态时自动跳过，新增 `skippedCount` 统计字段

### 3. 重放后状态计数准确（第三轮修复）
- **问题**: 失败单据重放成功后，失败计数不会扣减，导致批次状态和回执汇总失真
  - 根本原因: 重放时先将状态改为 `REPLAYING`，回调时无法判断原始状态
- **修复方案**:
  - 在 `ApprovalItem` 实体中新增 `previousStatus` 字段
  - 重放时保存原始状态到 `previousStatus`
  - 回调时优先使用 `previousStatus` 判断真实原始状态
  - 重放成功: 自动扣减 `failedCount`（真正的失败→成功转换）
  - 重放失败: 自动扣减 `successCount`（罕见场景）
  - 回调完成后清空 `previousStatus`
  - 添加边界保护 `if (count < 0) count = 0`，防止计数为负数

### 4. 重放状态过滤
- 仅允许 FAILED 和 REPLAYING 状态的单据被重放
- 成功单据的重放请求会被跳过并记录 warning
- 避免状态流转混乱

## 🔍 验证场景示例

### 完整业务流程验证
1. **初始创建**: 7 个单据
2. **首次回调**: 4 成功, 3 失败 → success=4, failed=3
3. **重放失败单据**: 3 个 FAILED 单据转为 REPLAYING（保存 previousStatus=FAILED）
4. **重放回调**: 2 成功, 1 失败 →
   - 成功的 2 个: failedCount -2, successCount +2
   - 失败的 1 个: 计数不变（仍为失败）
5. **最终结果**: success=6, failed=1 ✓ 统计准确

## 📝 问题排查报告

导出的问题排查报告包含：
1. 批次基本信息
2. 单据状态分布统计
3. 失败单据明细（含错误码和错误信息）
4. 完整的时间线追踪
5. 针对性的问题排查建议

## 🛠️ 配置说明

在 `application.yml` 中可配置：

```yaml
approval:
  batch:
    max-size: 100          # 单次最大提交数量
    default-chunk-size: 10 # 默认分片大小
    retry:
      max-attempts: 3      # 最大重试次数
      delay-ms: 1000       # 重试延迟
```

## 📁 项目结构

```
src/main/java/com/approval/coordinator/
├── BatchApprovalCoordinatorApplication.java  # 启动类
├── controller/
│   └── BatchController.java                  # REST API控制器
├── service/
│   ├── BatchService.java                     # 批次核心业务
│   ├── TimelineService.java                  # 时间线服务
│   └── ReceiptService.java                   # 回执生成服务
├── model/
│   ├── entity/                               # 数据实体
│   │   ├── ApprovalBatch.java
│   │   ├── ApprovalItem.java
│   │   ├── TimelineEvent.java
│   │   └── ProcessingReceipt.java
│   ├── enums/                                # 枚举定义
│   │   ├── BatchStatus.java
│   │   └── ItemStatus.java
│   └── dto/                                  # 请求响应DTO
├── repository/                               # 数据访问层
└── exception/                                # 异常处理
```

## 🔄 典型使用流程

1. **创建批次**: 调用 `POST /api/batches` 提交批量单据
2. **开始处理**: 调用 `POST /api/batches/{batchId}/start` 推进状态
3. **接收回调**: 业务系统处理完成后调用 `POST /api/batches/callback` 回执
4. **处理失败**: 如有部分失败，调用重放接口重试
5. **生成报告**: 导出处理回执和问题排查报告

## 🎯 适用场景

- 费用报销批量审批
- 采购订单批量审批
- 请假申请批量审批
- 任何需要批量处理且要求精确追踪每笔单据状态的场景
