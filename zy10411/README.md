# Notebook 执行制品 API

解决数据团队分享 Notebook 结果时只传截图、无法复现参数和输出文件的问题。

## 技术栈

- Java 17
- Spring Boot 3.2
- Spring Data JPA
- H2 Database (本地持久化)
- Lombok

## 快速启动

### 前置要求

- JDK 17+
- Maven 3.8+

### 构建项目

```bash
mvn clean install
```

### 启动服务

```bash
mvn spring-boot:run
```

服务启动后访问: http://localhost:8080

H2 数据库控制台: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:file:./data/notebookdb`
- 用户名: `sa`
- 密码: (空)

## 初始化样例

服务首次启动时会自动初始化 3 条样例数据:
1. 销售预测模型 (已完成、已复核)
2. 客户分群 K-Means (运行中)
3. 异常检测 (已创建)

## API 接口

### 基础路径

```
http://localhost:8080/api/v1/notebook-executions
```

---

### 1. 创建执行记录

```bash
curl -X POST http://localhost:8080/api/v1/notebook-executions \
  -H "Content-Type: application/json" \
  -d '{
    "notebookIdentifier": "recommendation-system-v2",
    "notebookName": "商品推荐系统",
    "notebookPath": "/notebooks/recommendation/v2.ipynb",
    "executedBy": "ml-engineer-01",
    "parameterDescription": "推荐模型训练参数",
    "parameters": {
      "embedding_size": 64,
      "batch_size": 256,
      "learning_rate": 0.001,
      "epochs": 50,
      "dropout_rate": 0.3
    },
    "runtimeEnvironment": {
      "pythonVersion": "3.10.12",
      "notebookKernel": "python3-ml",
      "dependencies": "tensorflow==2.14.0,pandas==2.1.0",
      "osInfo": "Linux Ubuntu 22.04",
      "hardwareInfo": "CPU: 16核, RAM: 64GB"
    },
    "outputArtifacts": [
      {
        "artifactName": "recommendation_model.h5",
        "artifactType": "model",
        "artifactPath": "/artifacts/recsys/model.h5",
        "fileSize": 10485760,
        "fileHash": "abc123def456",
        "description": "训练好的推荐模型"
      }
    ]
  }'
```

---

### 2. 查询所有执行记录

```bash
curl http://localhost:8080/api/v1/notebook-executions
```

---

### 3. 查询单个执行记录

```bash
# 先用上面创建记录的 executionId (从返回结果中获取)
EXECUTION_ID="NB-xxxxxxxxxxx"
curl http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID
```

---

### 4. 按 Notebook ID 查询

```bash
curl http://localhost:8080/api/v1/notebook-executions/notebook/sales-forecast-model-v3
```

---

### 5. 查询版本历史

```bash
curl http://localhost:8080/api/v1/notebook-executions/notebook/sales-forecast-model-v3/versions
```

---

### 6. 状态推进 - 开始运行

```bash
curl -X PUT http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "RUNNING",
    "executionLog": "开始执行Notebook，加载数据...",
    "updatedBy": "system"
  }'
```

---

### 7. 状态推进 - 完成执行

```bash
curl -X PUT http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "executionLog": "执行完成，准确率: 0.875",
    "updatedBy": "system"
  }'
```

---

### 8. 添加复核意见

```bash
curl -X POST http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "data-lead-01",
    "status": "APPROVED",
    "comments": "模型效果良好，可以发布",
    "correctionSuggestions": "建议增加负样本比例"
  }'
```

---

### 9. 人工修正

```bash
curl -X PUT http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/correct \
  -H "Content-Type: application/json" \
  -d '{
    "correctedBy": "ml-engineer-01",
    "correctionReason": "修正学习率参数",
    "correctedParameters": {
      "embedding_size": 128,
      "batch_size": 512,
      "learning_rate": 0.0005
    },
    "executionLogUpdate": "根据复核意见调整参数"
  }'
```

---

### 10. 导出制品索引

```bash
curl -X POST http://localhost:8080/api/v1/notebook-executions/sales-forecast-model-v3/export-index \
  -H "Content-Type: application/json" \
  -d '{
    "tags": ["sales", "forecast", "q3-2024"],
    "createdBy": "data-scientist-01"
  }'
```

---

### 11. 查询异常记录

```bash
curl http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/exceptions
```

---

## ❌ 被规则拦住的路径 - 非法状态转换

**注意: 不能直接从 CREATED 状态转到 COMPLETED

```bash
# 这会被规则拦住
curl -X PUT http://localhost:8080/api/v1/notebook-executions/$EXECUTION_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED",
    "executionLog": "跳过RUNNING状态直接完成",
    "updatedBy": "test"
  }'
```

**预期返回错误:**
```json
{
  "success": false,
  "message": "不允许的状态转换: CREATED -> COMPLETED。允许的状态: [RUNNING]",
  "errorCode": "INVALID_STATE"
}
```

**正确的状态流转图:
```
CREATED → RUNNING → COMPLETED → NEEDS_REVIEW → REVIEWED → ARCHIVED
                    ↓
                  FAILED → ARCHIVED
```

---

## 核心数据模型

### NotebookExecution (执行记录)
- executionId: 唯一执行ID
- notebookIdentifier: Notebook标识
- status: 执行状态 (CREATED/RUNNING/COMPLETED/FAILED/ARCHIVED/NEEDS_REVIEW/REVIEWED)
- version: 版本号
- parameterSet: 参数集 (带参数签名和哈希)
- runtimeEnvironment: 运行环境
- outputArtifacts: 输出制品列表
- reviewOpinions: 复核意见列表

### ParameterSet (参数集)
- parameterSignature: 参数签名
- parameterHash: 参数哈希 (SHA256)
- parameters: JSON格式参数

### RuntimeEnvironment (运行环境)
- pythonVersion: Python版本
- dependencies: 依赖列表
- environmentHash: 环境哈希

### OutputArtifact (输出制品)
- artifactName: 制品名称
- artifactType: 制品类型
- fileHash: 文件哈希
- version: 版本

### ReviewOpinion (复核意见)
- reviewer: 复核人
- status: 复核状态 (PENDING/APPROVED/REJECTED/NEEDS_CORRECTION)
- comments: 复核意见

### ArtifactIndex (制品索引)
- indexId: 索引ID
- tags: 标签列表
- exportPath: 导出路径
- version: 索引版本

### ExceptionRecord (异常记录)
- originalInput: 原始输入 (JSON)
- errorMessage: 错误信息
- stackTrace: 堆栈信息
- processingConclusion: 处理结论

---

## 核心业务规则

1. **参数签名**: 所有参数自动生成签名和SHA256哈希，确保可追溯
2. **版本控制**: 每次修改自动递增版本号
3. **状态机**: 严格的状态转换验证，防止非法流转
4. **复核流程**: 完成后需经过复核才能归档
5. **异常留存**: 异常路径保留原始输入和处理结论
6. **索引导出**: 支持按Notebook导出制品索引

---

## 项目结构

```
src/main/java/com/notebook/artifact/
├── NotebookArtifactApplication.java    # 启动类
├── model/                              # 数据模型
│   ├── NotebookExecution.java
│   ├── ParameterSet.java
│   ├── RuntimeEnvironment.java
│   ├── OutputArtifact.java
│   ├── ReviewOpinion.java
│   ├── ArtifactIndex.java
│   ├── ExceptionRecord.java
│   ├── ExecutionStatus.java
│   └── ReviewStatus.java
├── dto/                                # 请求/响应DTO
│   ├── NotebookExecutionRequest.java
│   ├── StatusUpdateRequest.java
│   ├── ReviewRequest.java
│   ├── ManualCorrectionRequest.java
│   └── ApiResponse.java
├── repository/                         # 数据访问层
│   ├── NotebookExecutionRepository.java
│   ├── ArtifactIndexRepository.java
│   └── ExceptionRecordRepository.java
├── service/                            # 业务逻辑层
│   ├── NotebookExecutionService.java
│   └── HashService.java
├── controller/                         # REST接口层
│   └── NotebookExecutionController.java
├── exception/                          # 异常处理
│   └── GlobalExceptionHandler.java
└── config/                             # 配置
    └── SampleDataInitializer.java     # 样例数据初始化
```
