# 镜像来源证明 API

基于 Spring Boot 构建的镜像来源证明管理服务，用于追踪容器镜像的构建来源、代码提交信息、流水线记录和签名验证结果。

## 技术栈

- Java 8+
- Spring Boot 2.7
- Spring Data JPA
- H2 Database (本地持久化)
- Lombok
- JUnit 5

## 核心功能

### 数据模型

- **镜像标签 (Image Tag)**: 唯一标识镜像
- **源码提交 (Source Commit)**: 仓库地址、分支、提交哈希、作者、消息
- **构建流水线 (Build Pipeline)**: 流水线ID、构建号、构建时间、状态
- **签名结果 (Signature Result)**: 签名算法、签名值、签名者身份、验证状态
- **例外申请 (Exception Request)**: 申请人、原因、审批人、审批状态
- **处理日志 (Processing Log)**: 完整记录每个步骤的输入、输出和操作人

### 核心规则

1. **来源校验**: 验证源码仓库地址和提交哈希是否存在
2. **签名核对**: 验证签名值、签名者身份和验证状态
3. **例外审批**: 支持第三方镜像等特殊场景的例外申请流程
4. **幂等提交**: 重复提交相同镜像标签返回已有记录
5. **证明包导出**: 导出完整的来源证明JSON包

### API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/provenance` | 提交镜像来源证明 |
| GET | `/api/v1/provenance/{id}` | 按ID查询记录 |
| GET | `/api/v1/provenance/tag/{imageTag}` | 按镜像标签查询 |
| GET | `/api/v1/provenance` | 查询所有记录（支持按状态过滤） |
| PUT | `/api/v1/provenance/{id}/status` | 更新记录状态 |
| PUT | `/api/v1/provenance/{id}/exception/approve` | 审批例外申请 |
| PUT | `/api/v1/provenance/{id}/correct` | 人工修正记录数据 |
| GET | `/api/v1/provenance/{id}/export` | 导出来源证明包 |
| POST | `/api/v1/provenance/init-sample` | 初始化样例数据 |

## 快速开始

### 编译项目

```bash
mvn clean compile
```

### 运行测试

```bash
mvn test
```

### 启动应用

```bash
mvn spring-boot:run
```

应用启动后访问: http://localhost:8080

H2 控制台: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:file:./data/provenancedb`
- 用户名: `sa`
- 密码: (空)

### 初始化样例数据

```bash
curl -X POST http://localhost:8080/api/v1/provenance/init-sample
```

## 使用示例

### 提交来源证明

```bash
curl -X POST http://localhost:8080/api/v1/provenance \
  -H "Content-Type: application/json" \
  -d '{
    "imageTag": "registry.example.com/myapp:v1.0.0",
    "imageDigest": "sha256:abcdef1234567890...",
    "registry": "registry.example.com",
    "repository": "myapp",
    "sourceCommit": {
      "repoUrl": "https://github.com/example/myapp",
      "branch": "main",
      "commitHash": "a1b2c3d4e5f6...",
      "commitAuthor": "dev@example.com",
      "commitMessage": "feat: 新功能发布"
    },
    "buildPipeline": {
      "pipelineId": "pipeline-001",
      "pipelineName": "myapp-build",
      "buildNumber": "123",
      "buildUrl": "https://ci.example.com/123",
      "buildStatus": "SUCCESS"
    },
    "signatureResult": {
      "signatureAlgorithm": "ECDSA",
      "signatureValue": "MEUCIQD...",
      "signerIdentity": "CN=build-robot,O=Example Corp",
      "signatureVerified": "TRUE"
    },
    "submittedBy": "ci-bot"
  }'
```

### 查询所有记录

```bash
curl http://localhost:8080/api/v1/provenance
```

### 按状态查询

```bash
curl "http://localhost:8080/api/v1/provenance?status=VERIFIED"
```

### 人工修正

```bash
curl -X PUT http://localhost:8080/api/v1/provenance/{id}/correct \
  -H "Content-Type: application/json" \
  -d '{
    "signatureResult": {
      "signatureAlgorithm": "ECDSA",
      "signatureValue": "CORRECTED_SIGNATURE",
      "signerIdentity": "CN=build-robot,O=Example Corp",
      "signatureVerified": "TRUE"
    },
    "correctionReason": "签名信息有误，重新提交正确签名",
    "operator": "admin"
  }'
```

### 导出证明包

```bash
curl -O http://localhost:8080/api/v1/provenance/{id}/export
```

## 测试覆盖

测试用例覆盖以下场景:

1. **正常流程**: 完整数据提交，自动校验通过
2. **脏数据处理**: 缺少来源或签名数据，标记为失败
3. **幂等提交**: 重复提交相同镜像标签，返回已有记录
4. **部分校验通过**: 仅来源校验通过，等待签名校验
5. **人工修正后重算**: 修正数据后自动重新校验
6. **例外审批流程**: 例外申请的批准流程
7. **证明包导出**: 完整JSON导出功能
8. **状态更新**: 手动更新记录状态
9. **异常路径处理**: 查询/导出不存在的记录

## 项目结构

```
src/
├── main/
│   ├── java/com/example/provenance/
│   │   ├── model/              # 数据模型
│   │   ├── dto/                # 请求/响应DTO
│   │   ├── repository/         # 数据访问层
│   │   ├── service/            # 业务逻辑层
│   │   ├── controller/         # REST控制器
│   │   ├── exception/          # 异常处理
│   │   └── ProvenanceApplication.java
│   └── resources/
│       └── application.yml     # 配置文件
└── test/
    └── java/com/example/provenance/
        └── ProvenanceServiceTest.java
```
