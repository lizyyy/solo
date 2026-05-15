# 附件元数据修复 API

基于 Spring Boot 的附件元数据批量修复服务，支持元数据补齐、权限推断、批次修复、异常保留和历史追踪。

## 技术栈

- **框架**: Spring Boot 2.7.18 (兼容 Java 8)
- **数据库**: H2 (文件持久化模式)
- **构建工具**: Maven

## 核心功能

### 数据对象

| 对象 | 说明 |
|------|------|
| Attachment | 附件实体，存储文件基本信息和元数据 |
| RepairBatch | 修复批次，批次维度管理修复任务 |
| RepairException | 异常清单，记录修复过程中的错误 |
| RepairHistory | 历史记录，追踪状态变化和操作人 |

### 核心规则

1. **关键元数据校验**: 业务单号(businessNo)、文件名(fileName)缺失时记录为校验异常
2. **元数据补齐**: 可修复的元数据（文件类型、上传时间、大小）自动补全
3. **权限推断**: 根据来源系统和文件名自动推断权限级别
4. **异常保留**: 校验和修复阶段的异常都会持久化保存，不中断整体流程
5. **修复报告**: 生成完整的成功/失败统计和异常清单

## 快速开始

### 环境要求
- Java 8 或更高版本 (JDK或JRE均可)
- Maven (可选，如果没有会自动下载依赖)

### 1. 启动服务

```bash
# 赋予执行权限并启动
chmod +x start.sh
./start.sh
```

脚本会自动检测环境、下载依赖、编译源码并启动服务。

服务启动后访问:
- API基础路径: `http://localhost:8080/api/repair`
- H2控制台: `http://localhost:8080/api/h2-console`

### 2. 运行测试脚本

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
| POST | `/batch/{batchNo}/validate` | 校验批次元数据 |
| POST | `/batch/{batchNo}/start` | 开始执行修复 |
| GET | `/batch/{batchNo}/status` | 查询批次状态 |
| GET | `/batch/{batchNo}/report` | 查询修复报告 |
| GET | `/batch/{batchNo}/history` | 查询状态变迁历史 |
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
┌───────────┬───────────────────┬──────────┐
│ SUCCESS   │ PARTIAL_SUCCESS   │ FAILED   │
│ 全部成功   │ 部分成功部分失败    │ 全部失败  │
└───────────┴───────────────────┴──────────┘
```

### 关键元数据校验规则

| 字段 | 是否必需 | 缺失处理 |
|------|----------|----------|
| fileId | 是 | 创建时必需 |
| businessNo | 是 | 校验阶段记录异常，修复阶段无法自动修复 |
| fileName | 是 | 校验阶段记录异常，修复阶段可根据fileId补全 |
| fileType | 否 | 修复阶段根据文件名自动推断 |
| uploadTime | 否 | 修复阶段设为当前时间 |
| fileSize | 否 | 修复阶段设为0 |

### 权限级别

| 级别 | 说明 | 适用场景 |
|------|------|----------|
| PUBLIC | 公开 | 通用文档、公开资料 |
| INTERNAL | 内部 | OA办公、ERP系统 |
| CONFIDENTIAL | 机密 | 财务系统、预算报表 |
| RESTRICTED | 受限 | 人事系统、薪资数据 |

## 使用示例

### 场景1: 成功流 - 完整元数据批量修复

```bash
# 创建批次
curl -X POST http://localhost:8080/api/repair/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-2024-001",
    "batchName": "Q1附件修复",
    "operator": "张三",
    "attachments": [
      {"fileId": "FILE-001", "fileName": "财务预算.xlsx", "businessNo": "FIN-001", "sourceSystem": "FINANCE"}
    ]
  }'

# 校验
curl -X POST http://localhost:8080/api/repair/batch/BATCH-2024-001/validate?operator=张三

# 修复
curl -X POST http://localhost:8080/api/repair/batch/BATCH-2024-001/start?operator=张三

# 查询报告
curl http://localhost:8080/api/repair/batch/BATCH-2024-001/report
```

### 场景2: 问题流 - 包含元数据缺失的附件

```bash
# 创建包含问题数据的批次
curl -X POST http://localhost:8080/api/repair/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-PROBLEM-001",
    "batchName": "问题附件测试",
    "operator": "李四",
    "attachments": [
      {"fileId": "BAD-001"},
      {"fileId": "BAD-002", "businessNo": "TEST-002"},
      {"fileId": "BAD-003", "fileName": "没有业务单号.pdf"}
    ]
  }'

# 校验 - 将发现多个 MISSING_CRITICAL_METADATA 异常
curl -X POST http://localhost:8080/api/repair/batch/BATCH-PROBLEM-001/validate?operator=李四

# 查询异常清单
curl http://localhost:8080/api/repair/batch/BATCH-PROBLEM-001/exceptions
```

### 查询修复报告

```bash
curl http://localhost:8080/api/repair/batch/BATCH-2024-001/report
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "batchNo": "BATCH-2024-001",
    "status": "PARTIAL_SUCCESS",
    "totalCount": 5,
    "successCount": 2,
    "failedCount": 3,
    "successRate": 40.0,
    "successFiles": ["FILE-001", "FILE-002"],
    "exceptions": [
      {
        "fileId": "BAD-001",
        "errorCode": "MISSING_CRITICAL_METADATA",
        "errorMessage": "关键元数据缺失: 业务单号(businessNo), 文件名(fileName)",
        "errorStage": "VALIDATION"
      }
    ]
  }
}
```

## 数据持久化

- 数据库文件存储在 `./data/` 目录下
- 重启服务后数据不会丢失
- H2控制台访问: `http://localhost:8080/api/h2-console`
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
│   └── MetadataRepairService.java    # 核心业务逻辑（校验、修复）
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
    └── DataInitializer.java           # 服务启动提示
```

## 测试场景

脚本 `test-api.sh` 包含完整的功能验证：

1. **成功流**: 完整的创建-校验-修复流程（5个完整元数据附件）
2. **问题流**: 包含业务单号缺失、文件名缺失的附件，验证异常检测和保留机制
3. **幂等性测试**: 重复提交相同批次号，验证不会产生脏数据
4. **持久化验证**: 查询所有批次，确认数据已持久化存储

## 设计亮点

1. **幂等性保障**: 相同batchNo重复提交不会创建新数据
2. **状态机管理**: 严格的状态流转校验，防止非法操作
3. **异常隔离**: 单个文件修复失败不影响整体批次，异常详细记录
4. **完整审计**: 所有状态变迁记录操作人、时间、备注
5. **持久化存储**: H2文件数据库，重启后数据不丢失
6. **两阶段异常记录**: 校验阶段和修复阶段分别记录异常
7. **关键/非关键元数据区分**: 关键元数据缺失形成异常，非关键元数据自动补全
