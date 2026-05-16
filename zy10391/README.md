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

### 5. 完整历史追踪
- 记录所有状态变更轨迹
- 支持回答"哪一步改了结果"
- 可追踪操作包括：
  - 任务创建
  - 校验开始
  - 校验完成(无冲突)
  - 发现冲突(待确认)
  - 解决单个冲突
  - 完成全部合并
  - 撤销任务
- 每次记录包含：操作类型、前后状态、操作人、时间戳、变更详情

### 6. 导出功能
- 支持校验结果 JSON 导出
- 支持 Excel 多工作表导出

## 启动方式

### 快速启动脚本 (推荐)
项目自带环境检测和启动脚本，自动检测环境并提供运行方案：

```bash
./quick-start.sh
```

脚本会：
1. 自动检测 Java 版本和类型 (JDK/JRE)
2. 检测 Maven 环境
3. 检查是否有已编译好的 JAR
4. 提供合适的启动方案
5. 显示完整 API 信息和状态流转图

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

### 7. 查询历史记录 (追踪哪一步改了结果)
```
GET /api/verification/{taskId}/history
```

**返回示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "taskId": 123,
      "previousStatus": null,
      "newStatus": "CREATED",
      "actionType": "创建任务",
      "operatorId": "system",
      "description": "创建校验任务，请求ID: REQ-001",
      "createdAt": "2024-01-15T10:30:00"
    },
    {
      "id": 2,
      "taskId": 123,
      "previousStatus": "CREATED",
      "newStatus": "VERIFYING",
      "actionType": "开始校验",
      "description": "多源校验开始，数据源数量: 3",
      "conflictCount": 2,
      "trustScore": 65,
      "createdAt": "2024-01-15T10:30:01"
    },
    {
      "id": 3,
      "taskId": 123,
      "previousStatus": "VERIFYING",
      "newStatus": "PENDING_CONFIRM",
      "actionType": "发现冲突",
      "description": "校验完成，发现 2 个字段冲突，待人工确认",
      "conflictCount": 2,
      "trustScore": 65,
      "createdAt": "2024-01-15T10:30:02"
    },
    {
      "id": 4,
      "taskId": 123,
      "previousStatus": "PENDING_CONFIRM",
      "newStatus": "PENDING_CONFIRM",
      "actionType": "解决冲突",
      "operatorId": "OPERATOR-001",
      "operatorName": "审核员",
      "fieldName": "gender",
      "finalValue": "男",
      "description": "解决字段冲突: gender",
      "createdAt": "2024-01-15T11:00:00"
    },
    {
      "id": 5,
      "taskId": 123,
      "previousStatus": "PENDING_CONFIRM",
      "newStatus": "MERGED",
      "actionType": "完成合并",
      "operatorId": "OPERATOR-001",
      "operatorName": "审核员",
      "description": "所有冲突已解决，校验完成合并",
      "conflictCount": 0,
      "trustScore": 65,
      "createdAt": "2024-01-15T11:00:01"
    }
  ]
}
```

**历史追踪能力**: 可以清晰看到任务从创建→校验→发现冲突→解决冲突→完成合并的全流程，回答"到底哪一步改了结果"

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
