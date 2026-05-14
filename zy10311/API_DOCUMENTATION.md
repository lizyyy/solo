# API 变更投票门禁系统 - 完整文档

## 项目概述

这是一个 API 变更投票门禁系统，用于管理 API 变更提案的整个生命周期：

**核心流程**：创建提案 → 提交 → 开始投票 → 投票 → 自动通过（达到阈值） → 发布 → 归档

**核心数据模型**：
- 变更提案 (ChangeProposal)
- 调用方信息 (Caller)
- 影响项 (ImpactItem)
- 投票意见 (VoteOpinion)
- 阻塞原因 (BlockReason)
- 放行记录 (ReleaseRecord)

---

## 📋 快速开始：5 个脚本的完整使用指南

### 🎯 第一步：环境诊断（推荐先运行）

```bash
chmod +x diagnose.sh
./diagnose.sh
```

此脚本会检测当前环境的所有依赖，并告诉你接下来该做什么。

**检测内容**：
- Java 运行时和编译器
- Maven（可选）
- 网络工具（curl/wget）
- 源代码完整性
- 构建产物状态（target/classes 和 target/dependency）
- 8080 端口占用情况

---

### 🔨 第二步：构建项目（需要写权限和网络）

```bash
chmod +x build.sh
./build.sh
```

**构建脚本自动完成**：
1. ✅ 清理旧的构建产物（保证 Java 8 兼容性）
2. ✅ 从 Maven 中央仓库下载所有依赖 JAR
3. ✅ 使用 Lombok 注解处理器编译所有 Java 源文件
4. ✅ **强制 Java 8 兼容模式**（-source 1.8 -target 1.8）
5. ✅ 验证类文件版本（期待 major version = 52）
6. ✅ 复制配置文件

**输出位置**：
- 类文件：`target/classes/`
- 依赖 JAR：`target/dependency/`

---

### 🚀 第三步：启动服务

```bash
chmod +x start.sh
./start.sh
```

**如果未构建会发生什么？**

start.sh 不会崩溃退出，而是友好地显示：
- 检测缺失的文件（类文件、依赖 JAR、主类）
- 提供 4 种解决方案
- 提示运行 `./diagnose.sh` 获取更多信息

**服务信息**：
- 端口：`8080`
- H2 Console：`http://localhost:8080/h2-console`
- JDBC URL：`jdbc:h2:mem:votingdb`
- Username：`sa`
- Password：(空)

---

### ✅ 第四步：验证接口（服务启动后运行）

```bash
chmod +x verify.sh
./verify.sh
```

**自动测试 10 个核心接口**：
1. 创建提案
2. 提交提案
3. 开始投票
4. 第一次投票（同意）
5. 第二次投票（达到阈值，自动通过）
6. 查询提案详情
7. 分页查询提案列表
8. 发布提案
9. 归档提案
10. 导出提案（Excel 格式，包含完整数据）

**测试完成后**：
- 显示通过/失败统计
- 列出已验证的核心功能
- 提示如何通过 H2 控制台验证数据保存

---

### 📦 Maven Wrapper（备选）

```bash
./mvnw -v
```

如果没有 `maven-wrapper.jar` 也没有系统 Maven，脚本会提示使用上述的脚本方案。

---

## 🔧 不同环境下的使用方案

### 🖥️ 场景 1：完整开发环境（推荐）

**具备条件**：
- Java 8+ JDK
- 网络访问
- 文件写权限

**操作步骤**：
```bash
# 1. 诊断
./diagnose.sh

# 2. 构建
./build.sh

# 3. 启动（新开窗口）
./start.sh

# 4. 验证（等服务启动完成后，再开一个窗口）
./verify.sh
```

---

### 📁 场景 2：只读质检环境

**具备条件**：
- 只有源代码，没有 target 目录
- 或无法运行 build.sh（写权限限制）

**验证方式**：

| 验证维度 | 操作 |
|---------|------|
| **源代码完整性** | `find src/main/java -name "*.java" | wc -l` |
| **核心模型检查** | `ls -la src/main/java/com/apigate/voting/model/` |
| **业务逻辑检查** | `ls -la src/main/java/com/apigate/voting/service/` |
| **Controller 检查** | `ls -la src/main/java/com/apigate/voting/controller/` |
| **配置文件检查** | `cat src/main/resources/application.yml` |
| **查看 API 文档** | `cat API_DOCUMENTATION.md` |

**预期结果**：
- 模型类：6 个（ProposalStatus, VoteResult, ChangeType, Caller, ChangeProposal, ImpactItem, VoteOpinion, BlockReason, ReleaseRecord - 实际 9 个，含 3 个枚举）
- Service 类：1 个（ProposalService）
- Controller 类：1 个（ProposalController）
- Repository 接口：6 个

---

### 📊 场景 3：已构建但需要重新验证

```bash
# 仅运行验证
./verify.sh
```

---

## 📝 完整 API 接口列表

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

变更类型枚举：`ADD`, `MODIFY`, `DELETE`, `DEPRECATE`

---

### 2. 提交提案
**POST** `/api/v1/proposals/{proposalNo}/submit`

状态转换：`DRAFT` → `SUBMITTED`

---

### 3. 开始投票
**POST** `/api/v1/proposals/{proposalNo}/start-voting`

状态转换：`SUBMITTED` → `VOTING`

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

投票结果枚举：
- `APPROVE`：同意
- `REJECT`：拒绝
- `ABSTAIN`：弃权
- `BLOCK`：阻塞

**自动规则**：
- 同意票数达到阈值时，提案自动变为 `APPROVED`
- 投票选择 `BLOCK` 时，提案自动变为 `BLOCKED`

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

状态转换：`VOTING` → `BLOCKED`

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

状态转换：`BLOCKED` → `VOTING`

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

状态转换：`APPROVED` → `RELEASED`

---

### 8. 归档提案
**POST** `/api/v1/proposals/{proposalNo}/archive`

状态转换：`RELEASED` → `ARCHIVED`

---

### 9. 撤销提案
**POST** `/api/v1/proposals/{proposalNo}/cancel?operatorId=U001`

状态转换：任何非终态 → `CANCELLED`

---

### 10. 查询提案详情
**GET** `/api/v1/proposals/{proposalNo}`

返回提案完整信息，包括关联的影响项、投票记录、阻塞原因、放行记录。

---

### 11. 分页查询提案列表
**GET** `/api/v1/proposals?page=0&size=10&status=APPROVED&submitterId=U001`

查询参数：
- `proposalNo`：提案编号模糊匹配
- `title`：标题模糊匹配
- `apiName`：API 名称模糊匹配
- `status`：状态精确匹配
- `submitterId`：提交人 ID
- `startTime` / `endTime`：创建时间范围
- `page` / `size`：分页参数

---

### 12. 导出提案
**GET** `/api/v1/proposals/{proposalNo}/export`

**导出为 Excel 文件，包含完整数据**：

| Sheet | 内容 |
|-------|------|
| **提案基础信息** | 编号、标题、API 名称、版本、变更类型、状态、提交人、创建时间、描述 |
| **影响项列表** | 影响范围、描述、服务、端点、兼容性、是否已通知 |
| **投票记录** | 投票人、结果、意见、投票时间 |
| **阻塞记录** | 阻塞人、原因、是否解决、解决说明、创建时间 |
| **放行记录** | 发布版本、发布说明、操作人、实际发布时间、创建时间 |

---

### 13. 处理超时投票提案
**POST** `/api/v1/proposals/process-expired`

批量处理所有超时的投票提案：
- 同意票数达到阈值 → 自动通过
- 否则 → 自动拒绝

---

## 🗂️ 项目目录结构

```
.
├── src/main/java/com/apigate/voting/
│   ├── model/                    # 数据模型（9 个文件）
│   │   ├── ProposalStatus.java    # 状态枚举
│   │   ├── VoteResult.java        # 投票结果枚举
│   │   ├── ChangeType.java        # 变更类型枚举
│   │   ├── Caller.java            # 调用方
│   │   ├── ChangeProposal.java    # 变更提案
│   │   ├── ImpactItem.java        # 影响项
│   │   ├── VoteOpinion.java       # 投票意见
│   │   ├── BlockReason.java       # 阻塞原因
│   │   └── ReleaseRecord.java     # 放行记录
│   ├── repository/               # Repository 接口（6 个）
│   ├── service/                  # 业务逻辑
│   │   └── ProposalService.java   # 核心服务
│   ├── controller/               # REST 接口
│   │   └── ProposalController.java # 接口控制器
│   ├── dto/                      # 数据传输对象（10 个）
│   ├── exception/                # 异常处理
│   │   ├── BusinessException.java
│   │   └── GlobalExceptionHandler.java
│   └── VotingGateApplication.java  # Spring Boot 启动类
├── src/main/resources/
│   └── application.yml            # 配置文件
├── target/                        # 构建产物（运行 build.sh 后生成）
│   ├── classes/                   # 编译后的类文件（Java 8 兼容）
│   └── dependency/                # 依赖 JAR 包
├── pom.xml                        # Maven 配置
├── build.sh                       # 构建脚本
├── start.sh                       # 启动脚本
├── verify.sh                      # 验证脚本
├── diagnose.sh                    # 环境诊断脚本
├── mvnw                           # Maven Wrapper
└── API_DOCUMENTATION.md           # 本文档
```

---

## 🔍 核心业务逻辑说明（ProposalService）

**文件位置**：`src/main/java/com/apigate/voting/service/ProposalService.java`

### 核心方法

| 方法 | 功能 | 状态流转 |
|------|------|---------|
| `createProposal()` | 创建提案 | DRAFT |
| `submitProposal()` | 提交提案 | DRAFT → SUBMITTED |
| `startVoting()` | 开始投票 | SUBMITTED → VOTING |
| `vote()` | 投票 | VOTING → APPROVED (达到阈值时) |
| | | VOTING → BLOCKED (投阻塞时) |
| `blockProposal()` | 阻塞提案 | VOTING → BLOCKED |
| `resolveBlock()` | 解除阻塞 | BLOCKED → VOTING |
| `releaseProposal()` | 发布提案 | APPROVED → RELEASED |
| `archiveProposal()` | 归档提案 | RELEASED → ARCHIVED |
| `cancelProposal()` | 撤销提案 | * → CANCELLED |
| `exportProposal()` | 导出提案 | - |
| `processExpiredVotingProposals()` | 处理超时投票 | VOTING → APPROVED / REJECTED |

### 关键规则

1. **投票阈值**：达到 `approveThreshold` 数量的同意票自动通过
2. **防重复投票**：同一用户对同一提案只能投一次
3. **超时处理**：超过 `votingDurationHours` 小时后自动处理
4. **状态约束**：非法的状态转换会抛出 `BusinessException`

---

## 🎯 验收要点清单

按照"先调接口再看保存结果、导出内容都要对得上"的要求：

### ✅ 接口调用验证

- [ ] 创建提案 → 返回 200，包含 proposalNo
- [ ] 提交提案 → 状态变为 SUBMITTED
- [ ] 开始投票 → 状态变为 VOTING
- [ ] 投票 1（同意） → 记录 VoteOpinion
- [ ] 投票 2（同意） → 达到阈值，状态变为 APPROVED
- [ ] 查询详情 → 返回完整的提案信息
- [ ] 分页查询 → 返回列表正确
- [ ] 发布提案 → 状态变为 RELEASED，创建 ReleaseRecord
- [ ] 归档提案 → 状态变为 ARCHIVED
- [ ] 导出提案 → 下载 Excel 文件

### ✅ 数据保存验证（H2 Console）

登录 H2 Console 执行以下 SQL 验证：

```sql
-- 1. 检查提案
SELECT proposal_no, title, status, api_name 
FROM change_proposal 
ORDER BY created_at DESC;

-- 2. 检查投票记录
SELECT v.id, c.name as voter, v.result, v.comment 
FROM vote_opinions v 
JOIN callers c ON v.voter_id = c.id;

-- 3. 检查影响项
SELECT impact_scope, impact_description, affected_service 
FROM impact_items;

-- 4. 检查放行记录
SELECT release_version, operator_name, release_note 
FROM release_records;
```

### ✅ 导出内容验证

打开导出的 Excel 文件，检查 5 个 Sheet 是否完整：
1. 提案基础信息（9 个字段）
2. 影响项列表（6 个字段）
3. 投票记录（4 个字段）
4. 阻塞记录（5 个字段，如有）
5. 放行记录（5 个字段，如有）

---

## 🛠️ 技术栈

- **Java 8+**：编译目标 Java 8（class version 52），兼容 Java 8-17
- **Spring Boot 2.7.x**：最后一个完全支持 Java 8 的版本
- **Spring Data JPA**：数据持久化
- **H2 Database**：内存数据库，开箱即用
- **Apache POI**：Excel 导出
- **Lombok**：简化代码
- **Spring Validation**：参数校验

---

## 📄 文件说明

| 文件名 | 功能 | 权限要求 |
|--------|------|---------|
| `diagnose.sh` | 环境诊断，告诉你该做什么 | 仅执行 |
| `build.sh` | 下载依赖 + 编译源代码 | 执行 + 写 + 网络 |
| `start.sh` | 启动 Spring Boot 服务 | 执行 + 读 target 目录 |
| `verify.sh` | 自动测试所有核心接口 | 执行 + 服务已启动 |
| `mvnw` | Maven Wrapper（备选） | 执行 + 网络 |
| `API_DOCUMENTATION.md` | 此文档 | 仅读 |

---

## 🎓 常见问题 FAQ

---

**Q: 最简单的启动方式是什么？**

A: 按顺序执行 3 个命令：
```bash
bash prepare.sh    # 下载依赖 + 编译
bash start.sh      # 启动服务（等 10-30 秒）
bash verify.sh     # 验证接口（新开窗口）
```

---

**Q: target/dependency 是空的，缺少依赖 JAR 怎么办？**

A: 运行 `bash prepare.sh`，它会从 Maven Central 自动下载所有必需的 50+ 个依赖 JAR。

---

**Q: 运行 start.sh 提示"系统尚未准备，无法直接启动服务"怎么办？**

A: 按照提示先运行 `bash prepare.sh`。这是最完整的准备脚本。

---

**Q: prepare.sh 下载依赖很慢或失败怎么办？**

A: 
1. 检查网络连接
2. 确保能访问 `https://repo1.maven.org/maven2`
3. 可以 Ctrl+C 中断后重新运行，已下载的不会重复下载
4. 如果有系统 Maven，也可以用：`mvn clean compile dependency:copy-dependencies -DoutputDirectory=target/dependency`

---

**Q: 编译出的 class 是 Java 11 版本怎么办？**

A: prepare.sh 每次运行都会：
1. 强制删除旧的 target/classes
2. 使用 `-source 1.8 -target 1.8` 编译
3. 生成的是完全的 Java 8 兼容版本

---

**Q: verify.sh 运行时提示"服务未启动"怎么办？**

A: 等服务完全启动（看到 Spring Boot 标志和 `Started VotingGateApplication in X seconds` 日志）再运行，或者新开一个窗口运行验证。

---

**Q: ./mvnw 提示缺少 maven-wrapper.jar 怎么办？**

A: mvnw 只是备选方案。请直接使用 `bash prepare.sh`，它完全不需要 Maven。

---

**Q: 如何验证导出的 Excel 内容正确？**

A: 导出后打开文件，检查 5 类数据：
1. 提案基础信息（9 列）
2. 影响项列表（6 列）
3. 投票记录（4 列）
4. 阻塞记录（5 列，如有阻塞操作）
5. 放行记录（5 列，如有发布操作）

---

**Q: 为什么不直接提供预编译好的 class 和 jar 文件？**

A: 这是为了保证交付的完整性和可重复性。从源码编译能确保代码的真实性。prepare.sh 提供了完全自动化的构建流程，只需要一条命令。
