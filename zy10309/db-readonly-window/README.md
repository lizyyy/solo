# 数据库只读窗口 API (Database Read-Only Window API)

基于 Spring Boot 3.2 构建的数据库只读窗口管理后端服务，用于在发布期间控制数据库写入操作，确保数据一致性。

## 核心功能

- **冻结窗口管理**: 创建、激活、暂停、完成、撤销冻结窗口
- **写入请求审批**: 提交、审批、拒绝写入请求
- **解除凭证**: 发放和使用解除冻结凭证
- **冲突记录**: 记录未经授权的写入尝试
- **时间线审计**: 完整记录所有关键操作的时间线
- **导出功能**: 导出窗口汇总和完整审计报告

## 技术栈

- Java 17
- Spring Boot 3.2
- Spring Data JPA
- H2 内存数据库
- Lombok

## 快速开始

### 编译项目

```bash
cd db-readonly-window
mvn clean package
```

### 运行项目

```bash
mvn spring-boot:run
```

服务将在 http://localhost:8080 启动

### 运行自检演示

```bash
# 查看API概览
curl http://localhost:8080/api/demo/quick-demo

# 运行完整自检流程
curl -X POST http://localhost:8080/api/demo/self-test
```

## API 接口

### 冻结窗口管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/windows` | 创建冻结窗口 |
| POST | `/api/windows/{code}/activate` | 激活窗口 |
| POST | `/api/windows/{code}/suspend` | 暂停窗口 |
| POST | `/api/windows/{code}/cancel` | 撤销窗口 |
| POST | `/api/windows/{code}/complete` | 完成窗口 |
| GET | `/api/windows/{code}` | 查询窗口详情 |
| GET | `/api/windows` | 查询所有窗口 |
| GET | `/api/windows/active` | 查询活跃窗口 |
| GET | `/api/windows/check-resource` | 检查资源是否被冻结 |

### 写入请求

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/requests` | 提交写入请求 |
| POST | `/api/requests/approve` | 批准请求 |
| POST | `/api/requests/reject` | 拒绝请求 |
| GET | `/api/requests/{code}` | 查询请求详情 |
| GET | `/api/requests/window/{code}` | 查询窗口所有请求 |
| GET | `/api/requests/window/{code}/pending` | 查询待审批请求 |

### 解除凭证

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/credentials/issue` | 发放凭证 |
| POST | `/api/credentials/{code}/use` | 使用凭证 |
| GET | `/api/credentials/{code}` | 查询凭证详情 |
| GET | `/api/credentials/window/{code}` | 查询窗口凭证 |
| GET | `/api/credentials/{code}/verify` | 验证凭证有效性 |

### 冲突记录

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/conflicts/record` | 记录冲突 |
| POST | `/api/conflicts/{code}/resolve` | 解决冲突 |
| GET | `/api/conflicts/{code}` | 查询冲突详情 |
| GET | `/api/conflicts/window/{code}` | 查询窗口冲突 |

### 时间线查询

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/timeline/window/{id}` | 查询窗口时间线 |
| GET | `/api/timeline/request/{id}` | 查询请求时间线 |
| GET | `/api/timeline/credential/{id}` | 查询凭证时间线 |
| GET | `/api/timeline/conflict/{id}` | 查询冲突时间线 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/window/{code}/summary` | 导出窗口汇总 |
| GET | `/api/export/audit-report` | 导出完整审计报告 |

## 核心实体

### FreezeWindow (冻结窗口)
- `windowCode`: 唯一编码 (WIN-XXXX)
- `status`: 状态 (DRAFT, ACTIVE, SUSPENDED, CANCELLED, COMPLETED)
- `startTime` / `endTime`: 时间范围
- `resourceScopes`: 冻结的资源范围

### ResourceScope (资源范围)
- `resourceType`: 资源类型 (DATABASE, TABLE, SCHEMA)
- `resourceName`: 资源名称

### WriteRequest (写入请求)
- `requestCode`: 唯一编码 (REQ-XXXX)
- `status`: 状态 (PENDING, APPROVED, REJECTED, EXPIRED, PROCESSED)
- `requester`: 请求人
- `justification`: 理由说明

### ReleaseCredential (解除凭证)
- `credentialCode`: 唯一编码 (CRD-XXXX)
- `issuedTo`: 发放对象
- `used`: 是否已使用
- `validUntil`: 有效期

### ConflictRecord (冲突记录)
- `conflictCode`: 唯一编码 (CNF-XXXX)
- `operationType`: 操作类型
- `operator`: 操作者
- `resolved`: 是否已解决

### TimelineEvent (时间线事件)
- `eventType`: 事件类型
- `eventTime`: 事件时间
- `operator`: 操作者
- `description`: 描述

## 状态流转

```
冻结窗口状态:
DRAFT(草稿) → ACTIVE(活跃) → SUSPENDED(暂停) → COMPLETED(完成)
                    ↓
                CANCELLED(撤销)

写入请求状态:
PENDING(待审批) → APPROVED(已批准)
           ↓
        REJECTED(已拒绝)
```

## H2 数据库控制台

访问: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:readonlydb`
- 用户名: `sa`
- 密码: (空)

## 使用示例

### 1. 创建冻结窗口

```bash
curl -X POST http://localhost:8080/api/windows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "发布冻结窗口",
    "description": "v2.0发布期间禁止写入",
    "startTime": "2024-01-15T09:00:00",
    "endTime": "2024-01-15T18:00:00",
    "operator": "admin",
    "resourceScopes": [
      {"resourceType": "DATABASE", "resourceName": "prod-db"}
    ]
  }'
```

### 2. 提交写入请求

```bash
curl -X POST http://localhost:8080/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "windowCode": "WIN-ABC123",
    "requester": "developer1",
    "resourceType": "TABLE",
    "resourceName": "users",
    "justification": "紧急修复用户数据"
  }'
```

### 3. 导出窗口汇总

```bash
curl http://localhost:8080/api/export/window/WIN-ABC123/summary
```

## 项目结构

```
db-readonly-window/
├── src/main/java/com/example/readonlywindow/
│   ├── entity/           # 实体类
│   ├── dto/              # 数据传输对象
│   ├── repository/       # 数据访问层
│   ├── service/          # 业务逻辑层
│   ├── controller/       # 控制器
│   └── exception/        # 异常处理
├── src/main/resources/
│   └── application.yml   # 配置文件
└── pom.xml
```
