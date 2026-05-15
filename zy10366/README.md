# 附件元数据修复 API

基于 Spring Boot 的附件元数据批量修复服务，支持元数据补齐、权限推断、批次修复、异常保留和历史追踪。

## 核心功能

| 功能 | 说明 |
|------|------|
| **数据模型** | Attachment、RepairBatch、RepairException、RepairHistory |
| **元数据补齐** | 自动补全文件名、文件类型、上传时间等 |
| **权限推断** | 根据来源系统和文件名自动推断权限级别 |
| **异常检测** | 业务单号、文件名缺失时记录为修复异常 |
| **持久化存储** | H2文件数据库，重启数据不丢失 |
| **幂等性保证** | 相同批次号重复提交不创建脏数据 |

## 环境要求

| 环境 | 最低要求 | 推荐 |
|------|----------|------|
| **Java** | JDK 8+ | JDK 8 或 JDK 11 |
| **Maven** | 3.6+ (可选) | 3.8+ |

⚠️ **重要提示**：需要 JDK（包含 javac）才能编译运行。只有 JRE 无法编译 Java 源码。

## 快速开始

### 方式一：使用 Maven（推荐）

```bash
# 编译并启动
mvn spring-boot:run

# 或者打包后运行
mvn package -DskipTests
java -jar target/attachment-metadata-repair-api-1.0.0.jar
```

### 方式二：使用启动脚本

```bash
chmod +x run.sh
./run.sh
```

脚本会自动检测环境并选择合适的方式启动。

### 服务启动后

- **API 基础路径**: `http://localhost:8080/api/repair`
- **H2 控制台**: `http://localhost:8080/api/h2-console`
  - JDBC URL: `jdbc:h2:file:./data/metadata_repair`
  - 用户名: `sa`
  - 密码: (空)

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/repair/batch` | 创建修复批次 |
| POST | `/repair/batch/{batchNo}/validate` | 校验批次元数据 |
| POST | `/repair/batch/{batchNo}/start` | 执行修复处理 |
| GET | `/repair/batch/{batchNo}/status` | 查询批次状态 |
| GET | `/repair/batch/{batchNo}/report` | 查询修复报告 |
| GET | `/repair/batch/{batchNo}/history` | 查询状态变迁历史 |
| GET | `/repair/batch/{batchNo}/exceptions` | 查询异常清单 |
| GET | `/repair/batches` | 查询所有批次列表 |

### 状态流转

```
CREATED (已创建)
    ↓
VALIDATING (校验中)
    ↓
VALIDATED (已校验)
    ↓
PROCESSING (处理中)
    ↓
┌──────────┬──────────────────┬──────────┐
│ SUCCESS  │ PARTIAL_SUCCESS  │ FAILED   │
│ 全部成功  │ 部分成功部分失败  │ 全部失败  │
└──────────┴──────────────────┴──────────┘
```

## 使用示例

### 场景1：成功流 - 完整元数据修复

```bash
curl -X POST http://localhost:8080/api/repair/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-001-SUCCESS",
    "batchName": "财务系统附件修复",
    "operator": "张三",
    "attachments": [
      {"fileId": "FILE-001", "fileName": "2024预算表.xlsx", "businessNo": "FIN-001", "sourceSystem": "FINANCE"},
      {"fileId": "FILE-002", "fileName": "人事档案.pdf", "businessNo": "HR-001", "sourceSystem": "EHR"}
    ]
  }'

# 校验
curl -X POST http://localhost:8080/api/repair/batch/BATCH-001-SUCCESS/validate

# 修复
curl -X POST http://localhost:8080/api/repair/batch/BATCH-001-SUCCESS/start

# 查询报告
curl http://localhost:8080/api/repair/batch/BATCH-001-SUCCESS/report
```

### 场景2：问题流 - 包含缺失元数据

```bash
curl -X POST http://localhost:8080/api/repair/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-002-PROBLEM",
    "batchName": "问题附件批次",
    "operator": "李四",
    "attachments": [
      {"fileId": "BAD-001"},
      {"fileId": "BAD-002", "businessNo": "TEST-002"},
      {"fileId": "BAD-003", "fileName": "缺少业务单号.pdf"}
    ]
  }'

# 校验（将记录3个异常）
curl -X POST http://localhost:8080/api/repair/batch/BATCH-002-PROBLEM/validate

# 查询异常清单
curl http://localhost:8080/api/repair/batch/BATCH-002-PROBLEM/exceptions
```

## 项目结构

```
src/main/java/com/metadata/repair/
├── MetadataRepairApplication.java    # 启动类
├── controller/
│   └── MetadataRepairController.java # REST API控制器
├── service/
│   └── MetadataRepairService.java    # 核心业务逻辑
├── repository/                        # 数据访问层
│   ├── AttachmentRepository.java
│   ├── RepairBatchRepository.java
│   ├── RepairExceptionRepository.java
│   └── RepairHistoryRepository.java
├── entity/                            # JPA实体类
│   ├── Attachment.java
│   ├── RepairBatch.java
│   ├── RepairException.java
│   └── RepairHistory.java
├── dto/                               # 数据传输对象
│   ├── CreateBatchRequest.java
│   ├── AttachmentDTO.java
│   ├── BatchResponse.java
│   ├── RepairReport.java
│   └── ApiResponse.java
├── enums/                             # 枚举定义
│   ├── RepairStatus.java
│   ├── SourceSystem.java
│   └── PermissionLevel.java
└── config/
    └── DataInitializer.java           # 启动初始化
```

## 测试验证

项目包含完整的测试脚本 `test-api.sh`：

```bash
chmod +x test-api.sh
./test-api.sh
```

测试覆盖场景：
1. ✅ 成功流程 - 完整元数据附件修复
2. ✅ 问题流程 - 关键元数据缺失检测
3. ✅ 幂等性验证 - 重复提交不产生脏数据
4. ✅ 持久化验证 - 重启后数据存在

## 设计亮点

1. **幂等性保证**: 相同 batchNo 重复提交不创建新数据
2. **状态机校验**: 严格的状态流转校验，防止非法操作
3. **异常隔离**: 单个附件修复失败不影响整体批次
4. **完整审计**: 所有状态变更记录操作人和时间戳
5. **两阶段异常**: 校验 + 修复两个阶段都记录异常
6. **关键元数据检测**: 业务单号、文件名缺失形成异常记录
7. **权限自动推断**: 财务系统 = CONFIDENTIAL, 人事系统 = RESTRICTED
