# 跨境数据访问审批 API

## 项目概述

本项目是一个基于 Spring Boot 3.2 构建的跨境数据访问审批系统，提供完整的申请、审批、令牌管理、审计和取证功能。

## 核心功能

### 1. 数据对象管理
- **数据域 (DataDomain)**: 定义不同类型的数据分类和敏感级别
- **访问地区 (RegionType)**: 支持 MAINLAND_CHINA, HONG_KONG, MACAU, TAIWAN, UNITED_STATES, EUROPEAN_UNION, UNITED_KINGDOM, JAPAN, SOUTH_KOREA, SINGAPORE, AUSTRALIA, OTHER

### 2. 审批流程
- 创建申请 → 提交地区校验 → 地区校验通过 → 提交审批 → 多级审批 → 审批通过 → 签发令牌

### 3. 令牌管理
- 令牌签发、验证、吊销
- 访问计数和过期管理

### 4. 审计与取证
- 关键操作完整审计日志
- 取证记录带 SHA-256 哈希验证
- 时间线追踪

### 5. 问题排查导出
- 导出完整的问题排查报告，包含申请信息、审批历史、令牌信息、审计日志、取证记录

## 技术栈

- Java 8+ (兼容 Java 8-21)
- Spring Boot 2.7.18
- Spring Data JPA
- H2 Database (文件持久化存储)
- Lombok
- Hibernate Validator

## 快速开始

### 环境要求
- Java 8 或更高版本（兼容 Java 8-21）
- 无需预先安装 Maven（已内置 Maven Wrapper）

### 一键启动（推荐）

**Mac/Linux:**
```bash
chmod +x start.sh && ./start.sh
```

**Windows:**
```cmd
start.bat
```

### 手动启动方式

使用 Maven Wrapper（无需本地安装 Maven）:

```bash
# 编译项目
./mvnw clean package -DskipTests   # Mac/Linux
mvnw.cmd clean package -DskipTests  # Windows

# 启动项目
java -jar target/*.jar
```

### 服务访问

启动成功后访问:
- API 服务: http://localhost:8080
- H2 数据库控制台: http://localhost:8080/h2-console

**数据库连接信息（持久化存储）:**
- JDBC URL: `jdbc:h2:file:./data/approvaldb`
- 用户名: `sa`
- 密码: (空)

> 💡 数据持久化说明：数据库文件存储在 `./data/` 目录下，重启服务后数据不会丢失

## API 接口说明

### 申请管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications` | 创建申请 |
| GET | `/api/applications/{id}` | 获取申请详情 |
| GET | `/api/applications/no/{applicationNo}` | 根据编号获取申请 |
| GET | `/api/applications/applicant/{applicantId}` | 获取申请人的所有申请 |
| GET | `/api/applications/status/{status}` | 根据状态查询申请 |

### 地区校验

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications/{id}/submit-region-validation` | 提交地区校验 |
| POST | `/api/applications/{id}/validate-region` | 执行地区校验 |

### 审批流程

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications/{id}/submit-approval` | 提交审批 |
| POST | `/api/applications/{id}/approve` | 执行审批 |
| GET | `/api/applications/{id}/approval-history` | 获取审批历史 |

### 令牌管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications/{id}/issue-token` | 签发访问令牌 |
| GET | `/api/applications/{id}/token` | 获取令牌信息 |
| POST | `/api/applications/token/validate` | 验证令牌有效性 |
| POST | `/api/applications/token/{tokenId}/revoke` | 吊销令牌 |

### 审计与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/applications/{id}/audit-logs` | 获取审计日志 |
| GET | `/api/applications/{id}/evidence` | 获取取证记录 |
| GET | `/api/applications/{applicationNo}/export-report` | 导出问题排查报告 |

### 辅助接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/applications/restricted-regions` | 获取受限制地区列表 |
| GET | `/api/applications/statuses` | 获取所有状态枚举 |
| GET | `/api/applications/regions` | 获取所有地区枚举 |

## API 使用示例

### 1. 创建申请

```bash
curl -X POST http://localhost:8080/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "user001",
    "applicantName": "张三",
    "dataDomainCode": "USER_PROFILE",
    "targetRegion": "UNITED_STATES",
    "accessReason": "业务数据分析需求"
  }'
```

### 2. 提交地区校验

```bash
curl -X POST "http://localhost:8080/api/applications/1/submit-region-validation?operatorId=admin001&operatorName=管理员"
```

### 3. 通过地区校验

```bash
curl -X POST "http://localhost:8080/api/applications/1/validate-region?approved=true&operatorId=admin001&operatorName=管理员"
```

### 4. 提交审批

```bash
curl -X POST "http://localhost:8080/api/applications/1/submit-approval?operatorId=user001&operatorName=张三"
```

### 5. 执行审批

```bash
curl -X POST http://localhost:8080/api/applications/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approverId": "approver001",
    "approverName": "审批人A",
    "result": "APPROVED",
    "comment": "同意申请"
  }'
```

### 6. 签发令牌

```bash
curl -X POST "http://localhost:8080/api/applications/1/issue-token?operatorId=admin001&operatorName=管理员"
```

### 7. 验证令牌

```bash
curl -X POST "http://localhost:8080/api/applications/token/validate?token=CB-TOKEN-XXX..."
```

### 8. 导出问题排查报告

```bash
curl -X GET http://localhost:8080/api/applications/CB-20240115-XXX/export-report
```

## 申请状态流转

```
DRAFT (草稿)
    ↓ submit-region-validation
PENDING_REGION_VALIDATION (待地区校验)
    ↓ validate-region
REGION_VALIDATED (地区校验通过)
    ↓ submit-approval
PENDING_APPROVAL (待审批)
    ↓ approve (多级审批)
APPROVED (审批通过)
    ↓ issue-token
TOKEN_ISSUED (令牌已签发)
    ↓ token expired/revoked
TOKEN_EXPIRED / TOKEN_REVOKED
```

## 核心业务规则

### 1. 重复提交检测
- 同一申请人、同一数据域、同一目标地区只能有一个活跃申请
- 活跃状态包括：草稿、待地区校验、地区校验通过、待审批、审批通过、令牌已签发

### 2. 审批级别规则
- 根据数据域的敏感级别和特殊审批标记决定审批级别
- 敏感级别 1: 1 级审批
- 敏感级别 2: 2 级审批
- 敏感级别 3: 3 级审批
- 标记为需要特殊审批的数据域固定为 3 级审批

### 3. 地区限制
- 受限制地区：UNITED_STATES, EUROPEAN_UNION, HONG_KONG
- 需要额外的合规检查

### 4. 令牌有效期
- 默认有效期：签发后 24 小时
- 可通过申请的 accessEndTime 自定义过期时间

## 预置数据

系统启动时自动初始化以下数据域：

| 编码 | 名称 | 敏感级别 | 特殊审批 |
|------|------|----------|----------|
| USER_PROFILE | 用户个人信息 | 2 | 否 |
| FINANCIAL_DATA | 财务数据 | 3 | 是 |
| HEALTH_RECORD | 健康记录 | 3 | 是 |
| BUSINESS_INTEL | 商业智能数据 | 2 | 否 |
| PUBLIC_DATA | 公开数据 | 1 | 否 |

## 项目结构

```
src/main/java/com/crossborder/approval/
├── CrossBorderApprovalApplication.java  # 启动类
├── config/
│   └── DataInitializer.java             # 数据初始化
├── controller/
│   └── ApplicationController.java        # REST API 控制器
├── exception/
│   ├── BusinessException.java            # 业务异常
│   ├── GlobalExceptionHandler.java      # 全局异常处理
│   └── ...
├── model/
│   ├── dto/                              # 数据传输对象
│   │   ├── ApiResponse.java
│   │   ├── CreateApplicationRequest.java
│   │   └── ApprovalRequest.java
│   ├── entity/                           # 实体类
│   │   ├── DataDomain.java
│   │   ├── DataAccessApplication.java
│   │   ├── ApprovalChain.java
│   │   ├── AccessToken.java
│   │   ├── AuditLog.java
│   │   └── EvidenceRecord.java
│   └── enums/                            # 枚举类
│       ├── ApplicationStatus.java
│       ├── RegionType.java
│       └── ApprovalResult.java
├── repository/                           # 数据访问层
│   ├── DataDomainRepository.java
│   ├── DataAccessApplicationRepository.java
│   ├── ApprovalChainRepository.java
│   ├── AccessTokenRepository.java
│   ├── AuditLogRepository.java
│   └── EvidenceRecordRepository.java
└── service/                              # 业务逻辑层
    ├── ApplicationService.java
    ├── ApprovalService.java
    ├── TokenService.java
    ├── AuditService.java
    ├── EvidenceService.java
    └── ExportService.java
```
