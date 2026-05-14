# API 变更投票门禁系统 - 接口文档

## 项目概述
这是一个 API 变更投票门禁系统，用于管理 API 变更提案的整个生命周期，包括创建、提交、投票、阻塞、放行和归档等环节。

## 技术栈
- Spring Boot 2.7.x (兼容 Java 8+)
- JPA / Hibernate
- H2 Database (内存数据库)
- Apache POI (Excel导出)
- Lombok

---

## ⚠️ 重要启动说明

### 正确的执行顺序（必须严格遵守）

```
第一步: ./build.sh   ← 下载依赖 + 编译为 Java 8
第二步: ./start.sh   ← 启动服务
第三步: ./verify.sh  ← 验证所有接口
```

### ❌ 不要直接运行这些命令（如果没有安装 Maven）
- `mvn clean install` ❌
- `mvn spring-boot:run` ❌
- `./mvnw` ❌

---

## 启动方式详解

### ✅ 方式一：使用脚本（推荐，无需 Maven）

#### 1. 构建项目（必须先运行）
```bash
chmod +x build.sh start.sh verify.sh
./build.sh
```

构建脚本会自动：
- 检查 Java 8+ 环境
- ✅ 清理旧的编译产物（避免 Java 11 class 残留）
- ✅ 从 Maven 中央仓库下载所有依赖 JAR
- ✅ 使用 Lombok 注解处理器编译源代码
- ✅ **强制使用 Java 8 兼容模式**（class version 52）
- ✅ 验证类文件版本兼容性
- ✅ 复制配置文件

#### 2. 启动服务（构建成功后）
```bash
./start.sh
```

启动脚本会自动：
- 检查是否已完成构建
- 验证所有类文件和依赖是否存在
- 启动 Spring Boot 服务

#### 3. 验证接口（服务完全启动后，约 10-30 秒）
```bash
./verify.sh
```

验证脚本会自动测试所有核心接口。

---

### 方式二：使用 Maven（仅限已安装 Maven 时）

如果系统已安装 Maven：
```bash
mvn clean compile
mvn spring-boot:run
```

---

## 服务信息

- **服务端口**: 8080
- **H2 Console 访问**: http://localhost:8080/h2-console
  - **JDBC URL**: `jdbc:h2:mem:votingdb`
  - **Username**: `sa`
  - **Password**: (空)

## Java 版本兼容性

- ✅ **Java 8** (class version 52) - 完全支持
- ✅ Java 9-17 - 完全支持
- ⚠️ 旧的 Java 11 class 文件已被清理，会重新编译

---

## 预置测试用户

- U001: 张三 (技术部)
- U002: 李四 (产品部)
- U003: 王五 (架构组)
- U004: 赵六 (测试部)

---

## API 接口列表

### 1. 创建提案
**POST** `/api/v1/proposals`

请求体：
```json
{
  "title": "用户登录接口优化",
  "description": "优化用户登录接口性能，增加限流机制",
  "apiName": "user.login",
  "apiVersion": "v2.0",
  "changeType": "MODIFY",
  "submitterId": "U001",
  "votingDurationHours": 24,
  "approveThreshold": 2,
  "impactItems": [
    {
      "impactScope": "登录模块",
      "impactDescription": "登录接口响应时间优化",
      "affectedService": "auth-service",
      "affectedEndpoint": "/api/auth/login",
      "compatibilityLevel": "backward_compatible"
    }
  ]
}
```

变更类型 (changeType) 枚举：
- ADD: 新增
- MODIFY: 修改
- DELETE: 删除
- DEPRECATE: 废弃

---

### 2. 提交提案
**POST** `/api/v1/proposals/{proposalNo}/submit`

说明：将草稿状态的提案提交，进入待投票状态。

---

### 3. 开始投票
**POST** `/api/v1/proposals/{proposalNo}/start-voting`

说明：开始投票流程，进入投票中状态，同时分发影响通知。

---

### 4. 投票
**POST** `/api/v1/proposals/{proposalNo}/vote`

请求体：
```json
{
  "result": "APPROVE",
  "voterId": "U002",
  "comment": "方案可行，同意通过"
}
```

投票结果 (result) 枚举：
- APPROVE: 同意
- REJECT: 拒绝
- ABSTAIN: 弃权
- BLOCK: 阻塞

说明：当达到同意人数阈值时，提案自动通过；投票选择 BLOCK 时，提案自动进入阻塞状态。

---

### 5. 阻塞提案
**POST** `/api/v1/proposals/{proposalNo}/block`

请求体：
```json
{
  "blockerId": "U003",
  "reason": "存在安全隐患，需要重新评估"
}
```

---

### 6. 解除阻塞
**POST** `/api/v1/proposals/{proposalNo}/resolve-block`

请求体：
```json
{
  "resolverId": "U001",
  "resolvedNote": "已修复安全问题"
}
```

---

### 7. 发布提案
**POST** `/api/v1/proposals/{proposalNo}/release`

请求体：
```json
{
  "releaseVersion": "v2.0.0",
  "releaseNote": "登录接口优化正式发布",
  "operatorName": "张三",
  "actualReleaseTime": "2024-01-15T10:00:00"
}
```

---

### 8. 归档提案
**POST** `/api/v1/proposals/{proposalNo}/archive`

---

### 9. 撤销提案
**POST** `/api/v1/proposals/{proposalNo}/cancel?operatorId=U001`

---

### 10. 查询提案详情
**GET** `/api/v1/proposals/{proposalNo}`

---

### 11. 分页查询提案列表
**GET** `/api/v1/proposals`

查询参数：
- `proposalNo`: 提案编号（模糊匹配）
- `title`: 标题（模糊匹配）
- `apiName`: API名称（模糊匹配）
- `status`: 状态（精确匹配）
- `submitterId`: 提交人ID
- `startTime`: 创建起始时间
- `endTime`: 创建结束时间
- `page`: 页码（默认0）
- `size`: 每页条数（默认20）

提案状态 (status) 枚举：
- DRAFT: 草稿
- SUBMITTED: 已提交
- VOTING: 投票中
- BLOCKED: 已阻塞
- APPROVED: 已通过
- REJECTED: 已拒绝
- RELEASED: 已发布
- ARCHIVED: 已归档
- CANCELLED: 已撤销

---

### 12. 导出提案
**GET** `/api/v1/proposals/{proposalNo}/export`

说明：导出提案详情为 Excel 文件，包含以下完整内容：

| 分类 | 字段 |
|------|------|
| **提案基础信息** | 编号、标题、API 名称、版本、变更类型、状态、提交人、创建时间、描述 |
| **影响项列表** | 影响范围、描述、服务、端点、兼容性、是否已通知 |
| **投票记录** | 投票人、结果、意见、投票时间 |
| **阻塞记录** | 阻塞人、原因、是否解决、解决说明、创建时间 |
| **放行记录** | 发布版本、发布说明、操作人、实际发布时间、创建时间 |

---

### 13. 处理超时投票提案
**POST** `/api/v1/proposals/process-expired`

说明：定时处理所有超时的投票提案，根据投票结果自动通过或拒绝。

---

## 核心业务流程

```
1. 提案创建  → DRAFT
2. 提交提案  → SUBMITTED
3. 开始投票  → VOTING (分发影响通知)
4. 投票环节  → 相关方进行投票
   ├─ 达到同意阈值 → APPROVED (自动通过)
   └─ 有人投票 BLOCK → BLOCKED
5. 阻塞处理  → BLOCKED，解决后可重新进入 VOTING
6. 提案发布  → RELEASED (需要 APPROVED 状态)
7. 提案归档  → ARCHIVED
```

## 超时处理

投票超时后系统自动处理：
- 同意票数达到阈值 → 自动通过
- 否则 → 自动拒绝

## 防重复提交机制

- 同一用户对同一提案只能投票一次
- 状态流转严格校验，非法状态转换会被拒绝
- 完整的事务保证数据一致性
