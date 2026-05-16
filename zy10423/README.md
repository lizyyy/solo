# 证书链体检API

基于Spring Boot的本地可运行证书链分析服务，提供证书解析、算法风险检测、过期预警、修复建议和报告导出功能。

## 功能特性

### 核心功能
- **证书链解析**：支持PEM格式证书链解析，支持多证书组合
- **算法风险检测**：识别MD5、SHA-1等弱哈希算法，检测密钥长度不足问题
- **过期预警**：自动计算证书剩余有效期，提前预警即将过期的证书
- **修复建议**：基于检测结果提供具体的修复建议和参考链接
- **健康报告**：生成完整的证书链健康分析报告
- **报告导出**：支持JSON格式报告导出

### 状态管理
- PENDING：待处理
- PARSING：解析中
- ANALYZING：分析中
- HEALTHY：健康
- WARNING：警告
- ERROR：错误
- NEEDS_MANUAL_FIX：需要人工修复
- FIXED：已修复

### 风险等级
- NONE：无风险
- LOW：低风险
- MEDIUM：中等风险
- HIGH：高风险
- CRITICAL：严重风险

## 技术栈

- Java 17
- Spring Boot 3.2.x
- Spring Data JPA
- H2 Database（本地持久化）
- Bouncy Castle（密码学库）
- Lombok

## 快速开始

### 环境要求
- JDK 17+
- Maven 3.8+

### 构建项目

```bash
mvn clean install
```

### 运行项目

```bash
mvn spring-boot:run
```

服务启动后访问：http://localhost:8080

### H2控制台

访问数据库控制台：http://localhost:8080/h2-console
- JDBC URL: jdbc:h2:file:./data/cert_health_db
- 用户名: sa
- 密码: (空)

## API接口

### 1. 上传证书

```bash
POST /api/v1/certificates
Content-Type: application/json

{
    "certificateData": "-----BEGIN CERTIFICATE-----...",
    "fileName": "certificate.pem",
    "uploadedBy": "admin",
    "certificateFormat": "PEM"
}
```

### 2. 查询所有证书

```bash
GET /api/v1/certificates
```

### 3. 查询单个证书详情

```bash
GET /api/v1/certificates/{id}
```

### 4. 按状态查询证书

```bash
GET /api/v1/certificates/status/{status}
```

### 5. 更新证书状态

```bash
PUT /api/v1/certificates/{id}/status?newStatus=HEALTHY
```

### 6. 人工修复

```bash
POST /api/v1/certificates/{id}/manual-fix
Content-Type: application/json

{
    "fixNotes": "已更新证书到最新版本",
    "fixedBy": "admin",
    "correctedCertificateData": "-----BEGIN CERTIFICATE-----..."
}
```

### 7. 重新分析证书

```bash
POST /api/v1/certificates/{id}/reanalyze
```

### 8. 查询健康报告

```bash
GET /api/v1/certificates/{id}/report
```

### 9. 导出报告

```bash
GET /api/v1/certificates/{id}/export
```

## 项目结构

```
src/main/java/com/certificate/health/
├── CertificateHealthApplication.java    # 启动类
├── controller/                           # REST控制器
│   └── CertificateHealthController.java
├── service/                              # 业务服务
│   ├── CertificateHealthService.java
│   ├── CertificateParserService.java
│   └── HealthReportService.java
├── model/                                # 数据模型
│   ├── CertificateFile.java
│   ├── ChainNode.java
│   ├── AlgorithmInfo.java
│   ├── ExpiryWindow.java
│   ├── FixSuggestion.java
│   └── HealthReport.java
├── repository/                           # 数据访问层
│   ├── CertificateFileRepository.java
│   └── HealthReportRepository.java
├── dto/                                  # 数据传输对象
│   ├── CertificateUploadRequest.java
│   └── ManualFixRequest.java
├── enums/                                # 枚举类型
│   ├── HealthStatus.java
│   └── RiskLevel.java
└── exception/                            # 异常处理
    ├── CertificateProcessingException.java
    └── GlobalExceptionHandler.java
```

## 核心规则说明

### 证书链验证

1. 验证每个证书的数字签名
2. 验证颁发者和主体的匹配关系
3. 检测是否存在缺失的中间证书

### 弱算法检测

**危险算法（CRITICAL）：**
- MD2, MD5 哈希算法
- RSA < 1024 位

**高风险算法（HIGH）：**
- SHA-1 哈希算法
- RSA < 2048 位

**推荐算法：**
- RSA-2048+ 配合 SHA-256/SHA-384
- ECDSA P-256/P-384 曲线

### 过期预警

- 已过期：严重风险（CRITICAL）
- 30天内过期：高风险（HIGH）
- 90天内过期：中等风险（MEDIUM）
- 90天以上：无风险

## 异常处理

异常响应格式：

```json
{
    "timestamp": "2024-01-01T12:00:00",
    "status": 400,
    "error": "Certificate Processing Failed",
    "message": "证书解析失败",
    "originalInputHash": "abc123...",
    "processingConclusion": "原始证书数据格式不正确，请检查PEM格式"
}
```

## 测试

运行单元测试：

```bash
mvn test
```

测试覆盖场景：
- 正常流：有效证书上传和解析
- 脏数据：无效证书数据处理
- 重复请求：相同证书数据的幂等处理
- 算法分析：弱算法检测
- 有效期分析：过期和即将过期检测

## 样例数据

使用以下命令测试API：

```bash
# 上传测试证书
curl -X POST http://localhost:8080/api/v1/certificates \
  -H "Content-Type: application/json" \
  -d '{
    "certificateData": "-----BEGIN CERTIFICATE-----\nMIICUTCCAfugAwIBAgIBADANBgkqhkiG9w0BAQQFADBXMQswCQYDVQQGEwJDTjEL\nMAkGA1UECBMCUE4xCzAJBgNVBAcTAkNOMQswCQYDVQQKEwJPTjELMAkGA1UECxMC\nVU4xCzAJBgNVBAMTAklUMB4XDTk5MDYyNjA2MjQ0N1oXDTAwMDYyNTA2MjQ0N1ow\nVzELMAkGA1UEBhMCQ04xCzAJBgNVBAgTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UE\nChMCT04xCzAJBgNVBAcTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UEChMCT04xCzAJ\nBgNVBAcTAlBOMQswCQYDVQQHEwJDTjELMAkGA1UEChMCT04xCzAJBgNVBAcTAlBO\nMA0GCSqGSIb3DQEBBAUAA4GBADIe6QDjJzJRGWdaS2W5vXf7idYJOhxVZLuN4n+B\naUsX5D5eJZ7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5Q4eJ5Z7Kz5\n-----END CERTIFICATE-----",
    "fileName": "test-cert.pem",
    "uploadedBy": "test-user"
}'

# 查看所有证书
curl http://localhost:8080/api/v1/certificates

# 导出报告
curl http://localhost:8080/api/v1/certificates/1/export
```

## 许可证

MIT License
