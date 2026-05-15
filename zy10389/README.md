# API 可观测标签校验系统

基于 Spring Boot 的 API 可观测性标签校验服务，提供标签白名单管理、样本校验、违规聚合、修复建议等核心功能。

## 🚀 快速开始（3步）

```bash
# 1. 检查环境
./check-env.sh

# 2. 编译项目
./mvnw clean package -DskipTests

# 3. 启动服务
./mvnw spring-boot:run

# 新开终端，运行完整测试
./test_demo.sh
```

## 核心特性

- ✅ **标签白名单管理** - 支持配置允许的标签键、允许值、正则校验、必填标记
- ✅ **样本校验引擎** - 支持批量上报标签样本，实时校验合规性
- ✅ **违规记录聚合** - 相同类型违规自动聚合统计
- ✅ **修复建议生成** - 针对每种违规类型提供智能修复建议
- ✅ **状态流转管理** - PENDING -> VALIDATING -> VALID -> FIXING -> FIXED -> REVOKED
- ✅ **幂等性保证** - 重复提交样本不会产生脏数据
- ✅ **CSV 报告导出** - 完整导出 API 信息、标签白名单、违规记录汇总
- ✅ **H2 内存数据库** - 开箱即用，无需额外安装

## 技术栈

- **Java 17+** (必须) - Spring Boot 3.x 最低要求
- Spring Boot 3.2.x
- Spring Data JPA
- H2 Database (内存)
- Lombok
- Apache Commons CSV

### 环境检查

运行前请检查 Java 版本：
```bash
java -version
# 需要 >= 17.0.0
```

如版本不符，请先安装 JDK 17：
- macOS: `brew install openjdk@17`
- Linux: `sudo apt install openjdk-17-jdk`
- Windows: 下载 [Oracle JDK 17](https://www.oracle.com/java/technologies/downloads/#java17)

## 快速开始

### 1. 编译项目

**推荐：使用项目内置 Maven Wrapper（无需安装 Maven）**
```bash
./mvnw clean package -DskipTests
```

**或使用系统 Maven（如已安装）**
```bash
mvn clean package -DskipTests
```

### 2. 启动服务

**方法一：使用 Maven Wrapper 直接运行**
```bash
./mvnw spring-boot:run
```

**方法二：运行编译好的 jar 包**
```bash
java -jar target/api-tag-validation-1.0.0.jar
```

服务启动后访问：
- API 地址: http://localhost:8080/api
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:tag_validation_db
  - 用户名: sa
  - 密码: (空)

## API 接口列表

### 创建 API 配置

```bash
POST /api/create
Content-Type: application/json

{
  "requestId": "API-001",
  "apiName": "用户查询接口",
  "apiPath": "/api/v1/users",
  "apiMethod": "GET",
  "serviceName": "user-service",
  "description": "用户信息查询接口",
  "createdBy": "admin",
  "tagKeys": [
    {
      "keyName": "env",
      "description": "环境标识",
      "required": true,
      "allowedValues": ["prod", "test", "dev"]
    }
  ]
}
```

### 上报样本校验

```bash
POST /api/report
Content-Type: application/json

{
  "requestId": "API-001",
  "sampleId": "SAMPLE-001",
  "source": "gateway",
  "tags": {
    "env": "prod",
    "service": "user-service"
  }
}
```

### 查询 API 详情

```bash
GET /api/{requestId}
```

### 查询所有 API

```bash
GET /api/list
```

### 查询样本列表

```bash
GET /api/{requestId}/samples
```

### 查询违规记录

```bash
GET /api/{requestId}/violations
```

### 推进 API 状态

```bash
POST /api/{requestId}/advance
```

### 撤销 API

```bash
POST /api/{requestId}/revoke
```

### 标记违规已解决

```bash
POST /api/violations/{violationId}/resolve
```

### 导出 CSV 报告

```bash
GET /api/{requestId}/export
```

## 运行演示脚本

```bash
chmod +x test_demo.sh
./test_demo.sh
```

演示脚本将完成以下流程：
1. 创建 API 配置，包含标签白名单规则
2. 提交合法样本（验证通过）
3. 提交非法样本（包含未知标签 + 值不在白名单）
4. 重复提交相同样本（验证幂等性）
5. 提交格式不匹配样本（正则校验失败）
6. 查询 API 详情、样本列表、违规记录
7. 推进 API 状态
8. 导出 CSV 报告

## 违规类型说明

| 违规类型 | 说明 |
|---------|------|
| `UNKNOWN_TAG_KEY` | 未知标签键，不在白名单中 |
| `INVALID_TAG_VALUE` | 标签值不在允许值列表中 |
| `MISSING_REQUIRED_TAG` | 缺少必填标签 |
| `FORMAT_MISMATCH` | 标签值格式与正则表达式不匹配 |

## 状态流转说明

```
PENDING (待处理)
    ↓
VALIDATING (校验中)
    ↓
VALID (校验通过)
    ↓ (发现违规)
INVALID (校验不通过)
    ↓
FIXING (修复中)
    ↓
FIXED (已修复)

REVOKED (已撤销) ← 任意状态都可撤销
```

## 项目结构

```
src/main/java/com/observability/tagvalidation/
├── TagValidationApplication.java    # 启动类
├── controller/
│   └── ApiController.java           # REST API 控制器
├── service/
│   └── ApiService.java              # 业务逻辑层
├── engine/
│   ├── TagValidationEngine.java     # 校验引擎
│   └── ValidationResult.java        # 校验结果
├── entity/
│   ├── ApiInfo.java                 # API 信息实体
│   ├── TagKey.java                  # 标签键实体
│   ├── AllowedValue.java            # 允许值实体
│   ├── ReportSample.java            # 上报样本实体
│   ├── ViolationRecord.java         # 违规记录实体
│   └── RepairSuggestion.java        # 修复建议实体
├── repository/                      # JPA Repository
├── dto/                            # 数据传输对象
├── enums/                          # 枚举定义
└── exception/                      # 异常处理
```
