# 附件元数据修复 API

基于 Spring Boot 的附件元数据批量修复服务，支持元数据补齐、权限推断、批次修复、异常保留和历史追踪。

## 技术栈

- **框架**: Spring Boot 3.2.0
- **数据库**: H2 (文件持久化模式)
- **构建工具**: Maven
- **Java版本**: JDK 17+

## 核心功能

### 数据对象

| 对象 | 说明 |
|------|------|
| Attachment | 附件实体，存储文件基本信息和元数据 |
| RepairBatch | 修复批次，批次维度管理修复任务 |
| RepairException | 异常清单，记录修复过程中的错误 |
| RepairHistory | 历史记录，追踪状态变化和操作人 |

### 核心规则

1. **元数据补齐**: 自动补全缺失的文件名、文件类型、上传时间、大小等
2. **权限推断**: 根据来源系统和文件名自动推断权限级别（PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED）
3. **批次修复**: 按批次批量处理附件，支持状态流转
4. **异常保留**: 修复失败的文件记录异常信息，不中断整体流程
5. **修复报告**: 生成完整的修复统计报告

## 快速开始

### 1. 编译项目

```bash
mvn clean package -DskipTests
```

### 2. 启动服务

```bash
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080/api

### 3. 运行测试脚本

```bash
chmod +x test-api.sh
./test-api.sh
```

## API 接口说明

### 基础路径

`http://localhost:8080/api/repair`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/batch` | 创建修复批次 |
| POST | `/batch/{batchNo}/validate` | 校验批次 |
| POST | `/batch/{batchNo}/start` | 开始修复 |
| GET | `/batch/{batchNo}/status` | 查询批次状态 |
| GET | `/batch/{batchNo}/report` | 查询修复报告 |
| GET | `/batch/{batchNo}/history` | 查询历史记录 |
| GET | `/batch/{batchNo}/exceptions` | 查询异常清单 |
| GET | `/batches` | 查询所有批次列表 |

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
┌─────────┬───────────────┬──────────┐
│ SUCCESS │ PARTIAL_SUCCESS │ FAILED │
└─────────┴───────────────┴──────────┘
```

### 权限级别

| 级别 | 说明 | 适用场景 |
|------|------|----------|
| PUBLIC | 公开 | 通用文档、公开资料 |
| INTERNAL | 内部 | OA系统、普通办公文件 |
| CONFIDENTIAL | 机密 | 财务系统、预算报表 |
| RESTRICTED | 受限 | 人事系统、薪资数据 |

## 使用示例

### 创建修复批次

**请求**:
```bash
curl -X POST http://localhost:8080/api/repair/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-2024-001",
    "batchName": "Q1附件修复",
    "operator": "admin",
    "attachments": [
      {"fileId": "FILE-001", "fileName": "财务预算.xlsx", "sourceSystem": "FINANCE"}
    ]
  }'
```

**响应**:
```json
{
  "code": 200,
  "message": "批次创建成功",
  "data": {
    "batchNo": "BATCH-2024-001",
    "batchName": "Q1附件修复",
    "status": "CREATED",
    "operator": "admin",
    "totalCount": 1
  }
}
```

### 校验并开始修复

```bash
# 校验
curl -X POST http://localhost:8080/api/repair/batch/BATCH-2024-001/validate?operator=张三

# 开始修复
curl -X POST http://localhost:8080/api/repair/batch/BATCH-2024-001/start?operator=张三
```

### 查询修复报告

```bash
curl http://localhost:8080/api/repair/batch/BATCH-2024-001/report
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "batchNo": "BATCH-2024-001",
    "status": "SUCCESS",
    "totalCount": 5,
    "successCount": 5,
    "failedCount": 0,
    "successRate": 100.0,
    "successFiles": ["FILE-001", "FILE-002", ...],
    "exceptions": []
  }
}
```

## 数据持久化

- 数据库文件存储在 `./data/` 目录下
- 重启服务后数据不会丢失
- H2控制台访问: http://localhost:8080/api/h2-console
  - JDBC URL: `jdbc:h2:file:./data/metadata_repair`
  - 用户名: `sa`
  - 密码: (空)

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
├── entity/                            # 实体类
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
├── enums/                             # 枚举类
│   ├── RepairStatus.java
│   ├── SourceSystem.java
│   └── PermissionLevel.java
├── exception/
│   └── GlobalExceptionHandler.java    # 全局异常处理
└── config/
    └── DataInitializer.java           # 数据初始化
```

## 测试场景

脚本 `test-api.sh` 包含以下测试场景：

1. **成功流**: 完整的创建-校验-修复流程，包含5个不同系统的附件
2. **问题流**: 包含缺失元数据的附件，验证异常记录功能
3. **幂等性测试**: 重复提交相同批次号，验证不会产生脏数据
4. **批量查询**: 查询所有批次列表

## 设计亮点

1. **幂等性保障**: 相同batchNo重复提交不会创建新数据
2. **状态机管理**: 严格的状态流转校验，防止非法操作
3. **异常隔离**: 单个文件修复失败不影响整体批次
4. **完整审计**: 所有状态变更记录操作人和时间
5. **持久化存储**: H2文件数据库，重启数据不丢失
6. **规则引擎**: 基于来源系统和文件名的智能权限推断
