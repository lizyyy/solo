# 多源身份校验 API

基于 Spring Boot 2.7 的多源身份校验系统，支持多数据源身份核验、冲突检测、可信评分及人工确认流程。

## 技术栈

- Java 8+ (JDK 1.8)
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database (内存数据库)
- Lombok
- Apache POI (Excel导出)

## 核心功能

### 1. 多源校验
- 支持多个身份数据源同时校验
- 自动检测字段级冲突
- 基于数据源权重计算可信评分
- 字段值为空时自动处理，避免空指针异常

### 2. 可信评分
- 每个数据源可配置信任权重 (0-100)
- 自动计算整体信任等级：VERY_LOW / LOW / MEDIUM / HIGH / VERY_HIGH
- 字段级一致性分析

### 3. 冲突处理
- 自动识别跨数据源的字段差异
- 基于权重推荐最优值
- 支持人工确认和裁决

### 4. 幂等性保证
- 基于 requestId 进行重复请求拦截
- 重复请求直接返回已有结果，不产生脏数据
- 重复请求返回 HTTP 409 Conflict 状态码

### 5. 导出功能
- 支持校验结果 JSON 导出
- 支持 Excel 多工作表导出

## 启动方式

### 环境要求
- **JDK 8+** (需要完整 JDK，仅 JRE 无法编译。推荐 JDK 1.8 或更高)
- Maven 3.6+ (项目自带 Maven Wrapper，无需系统安装)

#### 验证环境
```bash
# 检查是否有完整 JDK
javac -version

# 如果显示 "command not found"，需要安装 JDK
# macOS: brew install openjdk@8 或从 Oracle 官网下载
# Linux: apt-get install openjdk-8-jdk
```

### 编译运行

#### 使用 Maven Wrapper (推荐，无需系统安装 Maven)
```bash
# 编译项目
./mvnw clean package -DskipTests

# 运行应用
java -jar target/multi-source-identity-verification-1.0.0.jar
```

#### Windows 用户
```cmd
mvnw.cmd clean package -DskipTests
java -jar target\multi-source-identity-verification-1.0.0.jar
```

### 开发模式运行
```bash
./mvnw spring-boot:run
```

### Maven Wrapper 工作原理
- 首次运行 `./mvnw` 时，脚本会自动检测系统 Maven
- 如果系统无 Maven，将自动下载 Maven Wrapper JAR (~60KB)
- 需要网络连接，支持 curl 或 wget
- 后续运行无需重复下载

### 访问地址
- 应用端口: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
  - JDBC URL: jdbc:h2:mem:identitydb
  - 用户名: sa
  - 密码: (空)

## 关键接口

### 1. 创建校验任务
```
POST /api/verification
Content-Type: application/json

{
  "requestId": "REQ-001",
  "businessType": "用户注册",
  "description": "新用户身份校验",
  "createdBy": "system",
  "identityDataList": [
    {
      "sourceCode": "GOV",
      "idType": "ID_CARD",
      "idValue": "110101199001011234",
      "name": "张三",
      "gender": "男",
      "birthDate": "1990-01-01",
      "address": "北京市朝阳区",
      "phoneNumber": "13800138000",
      "email": "zhangsan@example.com"
    }
  ]
}
```

### 2. 查询校验结果
```
GET /api/verification/{taskId}
```

### 3. 通过RequestId查询
```
GET /api/verification/request/{requestId}
```

### 4. 推进校验 (人工确认冲突)
```
POST /api/verification/{taskId}/advance
Content-Type: application/json

{
  "operatorId": "OPERATOR-001",
  "operatorName": "审核员",
  "comments": "已核实",
  "resolutions": [
    {
      "conflictFieldId": 1,
      "finalValue": "男"
    }
  ]
}
```

### 5. 撤销校验
```
POST /api/verification/{taskId}/revoke?reason=撤销原因
```

### 6. 查询任务列表
```
GET /api/verification/list?status=PENDING_CONFIRM
```

### 7. 查询历史记录
```
GET /api/verification/{taskId}/history
```

### 8. 导出Excel
```
GET /api/export/{taskId}/excel
```

## 校验状态说明

| 状态 | 说明 |
|------|------|
| CREATED | 已创建 |
| VERIFYING | 校验中 |
| CONFLICT | 存在冲突 |
| PENDING_CONFIRM | 待人工确认 |
| CONFIRMED | 已确认 |
| MERGED | 已合并 |
| REVOKED | 已撤销 |

## 预置数据源

系统启动时自动初始化以下数据源配置：

| 编码 | 名称 | 信任权重 | 说明 |
|------|------|----------|------|
| GOV | 政府数据源 | 90 | 公安系统官方数据源 |
| BANK | 银行数据源 | 80 | 银行系统数据源 |
| TELECOM | 运营商数据源 | 70 | 电信运营商数据源 |
| THIRD_PARTY | 第三方数据源 | 50 | 第三方合作机构 |

## 会被拦截的路径说明

### 重复请求拦截机制

**拦截路径**: `POST /api/verification`

**拦截条件**: 当请求中的 `requestId` 已存在于系统中时

**行为**:
- 不创建新的校验任务（避免脏数据）
- 直接返回已有的校验结果
- HTTP 状态码: 409 Conflict
- 业务响应 body 中的 code: 409
- 响应消息: "重复请求，已返回已有结果"

**实现机制**:
- Controller 层返回 `ResponseEntity<ApiResponse<T>>`
- Service 层调用 `ApiResponse.duplicateRequestEntity(data)` 返回正确的 HTTP 状态
- 确保重复请求不会产生任何副作用

**设计意图**:
- 保证接口幂等性
- 防止网络重试导致重复创建任务
- 相同业务请求无论提交多少次，最终结果一致

**示例**:
```
第一次请求 requestId = "REQ-001" → 创建新任务，HTTP 200 OK，业务 code 200
第二次请求 requestId = "REQ-001" → 拦截，HTTP 409 Conflict，业务 code 409，返回已有结果
数据库中始终只有一条记录
```

## 数据对象关系

```
VerificationTask (校验任务)
    ├── PersonIdentifier (人员标识记录)
    │   └── 每个数据源提交的身份数据
    ├── ConflictField (冲突字段)
    │   └── 字段级差异记录
    ├── MergeSuggestion (合并建议)
    │   └── 基于权重的推荐值
    └── ConfirmationRecord (确认记录)
        └── 人工操作历史记录
```

## 项目结构

```
src/main/java/com/identity/verification/
├── IdentityVerificationApplication.java  # 启动类
├── config/
│   └── DataInitializer.java              # 数据初始化
├── controller/
│   ├── VerificationController.java       # 校验接口
│   └── ExportController.java             # 导出接口
├── dto/
│   ├── ApiResponse.java                  # 统一响应封装
│   ├── CreateVerificationRequest.java    # 创建请求DTO
│   ├── AdvanceRequest.java               # 推进请求DTO
│   ├── VerificationResult.java           # 校验结果DTO
│   ├── VerificationHistory.java          # 历史记录DTO
│   └── ...
├── model/
│   ├── VerificationTask.java             # 校验任务实体
│   ├── PersonIdentifier.java             # 人员标识实体
│   ├── ConflictField.java                # 冲突字段实体
│   ├── MergeSuggestion.java              # 合并建议实体
│   ├── ConfirmationRecord.java           # 确认记录实体
│   ├── IdentitySource.java               # 身份数据源实体
│   └── enums/
│       ├── VerificationStatus.java       # 校验状态枚举
│       └── TrustLevel.java               # 可信等级枚举
├── repository/                           # JPA Repository
├── service/
│   ├── VerificationService.java          # 校验业务逻辑
│   └── ExportService.java                # 导出业务逻辑
└── exception/
    └── GlobalExceptionHandler.java       # 全局异常处理
```

## 测试用例

详细测试用例请参考: `src/test/resources/test-cases.md`

包含场景:
1. 正常请求 - 无冲突场景
2. 正常请求 - 有冲突场景
3. 异常请求 - 参数缺失
4. 异常请求 - 查询不存在的任务
5. 重复提交请求 (幂等性验证)
6. 人工处理冲突 - 推进校验
7. 撤销校验任务
8. 导出Excel
9. 查看历史记录
