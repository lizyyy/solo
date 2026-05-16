# 依赖升级许可 API

基于 Spring Boot 3 的依赖升级许可管理后端服务，用于管理基础库升级过程中的仓库审批流程。

## 技术栈

- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database (嵌入式)
- Swagger/OpenAPI 3.0
- Lombok
- Apache Commons CSV

## 核心功能

### 数据模型
- **依赖包 (DependencyPackage)**: 管理需要升级的第三方依赖
- **仓库 (Repository)**: 管理代码仓库及其负责人信息
- **升级批次 (UpgradeBatch)**: 组织一次升级的批次，包含多个仓库
- **审批记录 (RepositoryApproval)**: 每个仓库的审批状态
- **延期申请 (DeferralRequest)**: 仓库升级延期申请
- **审计日志 (AuditLog)**: 记录所有操作及其输入输出

### 核心规则
1. **语义化版本校验**: 严格遵循 SemVer 2.0 规范
2. **幂等性保证**: 重复提交审批不会重复执行
3. **状态流转校验**: 严格的状态机流转控制
4. **延期冲突检测**: 防止重复提交延期申请
5. **审批完整性检查**: 全部仓库批准后才能开始升级
6. **异常追踪**: 所有异常都保留原始输入和处理结果

## 快速开始

### 环境要求
- JDK 17+
- Maven 3.8+

### 启动服务

```bash
mvn spring-boot:run
```

### 访问地址

| 服务 | 地址 |
|------|------|
| API 文档 | http://localhost:8080/swagger-ui.html |
| H2 控制台 | http://localhost:8080/h2-console |
| API 基础路径 | http://localhost:8080/api/v1 |

### H2 数据库配置

- JDBC URL: `jdbc:h2:file:./data/license_db`
- 用户名: `sa`
- 密码: (空)

## API 接口

### 依赖包管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/packages | 创建依赖包 |
| GET | /api/v1/packages | 获取所有依赖包 |
| GET | /api/v1/packages/{id} | 获取依赖包详情 |
| PUT | /api/v1/packages/{id} | 更新依赖包 |

### 仓库管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/repositories | 创建仓库 |
| GET | /api/v1/repositories | 获取所有仓库 |
| GET | /api/v1/repositories/active | 获取活跃仓库 |
| GET | /api/v1/repositories/{id} | 获取仓库详情 |
| PUT | /api/v1/repositories/{id} | 更新仓库 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/batches | 创建批次 |
| GET | /api/v1/batches | 获取所有批次 |
| GET | /api/v1/batches/{id} | 获取批次详情 |
| POST | /api/v1/batches/{id}/submit | 提交审批 |
| GET | /api/v1/batches/{id}/approvals | 获取审批列表 |
| POST | /api/v1/batches/approvals/{id}/approve | 审批 |
| POST | /api/v1/batches/approvals/{id}/defer | 申请延期 |
| GET | /api/v1/batches/{id}/deferrals | 获取延期列表 |
| POST | /api/v1/batches/{id}/start | 开始升级 |
| POST | /api/v1/batches/{id}/complete | 完成升级 |
| POST | /api/v1/batches/approvals/{id}/correct | 人工修正 |
| GET | /api/v1/batches/{id}/export | 导出许可清单 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/audit | 获取所有审计日志 |
| GET | /api/v1/audit/failures | 获取失败日志 |
| GET | /api/v1/audit/entity/{type}/{id} | 获取实体相关日志 |
| GET | /api/v1/audit/export | 导出审计日志 |

## 测试场景

### 1. 正常流程

```bash
# 创建依赖包
curl -X POST http://localhost:8080/api/v1/packages \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JUnit",
    "groupId": "org.junit.jupiter",
    "artifactId": "junit-jupiter",
    "currentVersion": "5.9.0",
    "targetVersion": "5.10.0",
    "category": "test"
  }'

# 创建批次并完成审批
```

### 2. 幂等性验证

```bash
# 对同一个审批重复提交，第二次不会有实际变化
curl -X POST http://localhost:8080/api/v1/batches/approvals/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approver": "张三",
    "comment": "同意"
  }'
```

### 3. 异常场景

- 版本号不符合规范
- 目标版本低于当前版本
- 在错误的状态下推进
- 重复申请延期

### 4. 导出报告

```bash
curl -O http://localhost:8080/api/v1/batches/1/export
```

## 状态流转

### 批次状态

```
DRAFT (草稿) → PENDING_APPROVAL (待审批) → IN_PROGRESS (进行中) → COMPLETED (已完成)
                          ↓
                      CANCELLED (已取消)
```

### 审批状态

```
PENDING (待审批) → APPROVED (已同意)
          ↓            ↓
        REJECTED (已拒绝)
          ↓
        DEFERRED (已延期)
```

## 项目结构

```
src/main/java/com/dependency/license/
├── LicenseApiApplication.java     # 启动类
├── config/
│   └── SampleDataInitializer.java # 样例数据初始化
├── controller/                    # REST API 控制器
├── dto/                           # 数据传输对象
├── exception/                     # 异常处理
├── model/                         # 数据模型和枚举
├── repository/                    # 数据访问层
├── service/                       # 业务逻辑层
└── util/                          # 工具类
```