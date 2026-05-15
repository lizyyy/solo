# 对象生命周期规则 API

企业级对象存储生命周期规则管理系统，支持对象前缀配置、归档/删除规则、任务调度、保留例外、审计追踪和执行证明导出。

## 第二轮修复内容

### 已修复的问题

1. **修复损坏的Maven Wrapper**
   - 重新创建了正确的 `mvnw` 启动脚本（原文件是GitHub HTML页面）
   - 修复了 `maven-wrapper.properties` 配置文件
   - 添加了 `MavenWrapperDownloader.java` 用于自动下载依赖

2. **创建独立运行脚本**
   - `run.sh` - 一站式启动脚本，支持编译、运行、测试、停止等
   - `test-api.sh` - API功能测试脚本，覆盖所有7大模块

3. **完整API覆盖（已补全7大模块）**
   - 对象前缀管理 (`/api/v1/prefixes`)
   - 生命周期规则管理 (`/api/v1/rules`)
   - 归档任务管理 (`/api/v1/archive-tasks`)
   - 删除候选管理 (`/api/v1/deletion-candidates`)
   - 保留例外管理 (`/api/v1/retention-exceptions`)
   - 审计日志查询 (`/api/v1/*/audit-logs`)
   - 执行证明导出 (`/api/v1/execution-proofs`)

## 快速开始

### 环境要求
- Java 8+
- 网络连接（首次运行自动下载Maven）

### 启动服务

使用提供的一站式脚本：

```bash
# 赋予执行权限
chmod +x run.sh test-api.sh

# 后台启动服务（自动编译、打包、启动）
./run.sh start

# 或前台运行（查看日志）
./run.sh run
```

### 脚本命令说明

| 命令 | 说明 |
|------|------|
| `./run.sh build` | 编译项目 |
| `./run.sh start` | 后台启动服务 |
| `./run.sh run` | 前台运行服务 |
| `./run.sh stop` | 停止服务 |
| `./run.sh status` | 查看服务状态 |
| `./run.sh test` | 运行单元测试 |
| `./run.sh clean` | 清理构建文件 |

### API功能测试

服务启动后，运行API测试脚本：

```bash
./test-api.sh
```

该脚本将测试所有7大模块的API接口，包括：
- 对象前缀的创建、查询
- 生命周期规则的创建、状态流转（校验→激活→暂停→撤销）
- 归档任务的创建、查询、执行
- 删除候选的创建、管理
- 保留例外的创建、查询
- 审计日志的查询
- 执行证明的查询

### 访问地址

启动成功后，可以访问以下地址：

- **API根地址**: http://localhost:8080/api/v1
- **H2数据库控制台**: http://localhost:8080/h2-console

H2数据库连接配置：
- JDBC URL: `jdbc:h2:mem:lifecycle_db`
- 用户名: `sa`
- 密码: (空)

## API 接口说明

### 1. 对象前缀管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/prefixes` | 创建对象前缀 |
| GET | `/api/v1/prefixes` | 获取所有前缀 |
| GET | `/api/v1/prefixes/{id}` | 获取指定前缀 |
| PUT | `/api/v1/prefixes/{id}` | 更新前缀 |
| PATCH | `/api/v1/prefixes/{id}/toggle` | 切换启用状态 |
| DELETE | `/api/v1/prefixes/{id}` | 删除前缀 |
| GET | `/api/v1/prefixes/{id}/audit-logs` | 查看变更审计日志 |

创建示例：
```json
{
    "prefix": "/data/",
    "bucketName": "my-bucket",
    "description": "业务数据目录"
}
```

### 2. 生命周期规则管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/rules` | 创建规则 |
| GET | `/api/v1/rules` | 获取所有规则 |
| GET | `/api/v1/rules/{ruleId}` | 获取指定规则 |
| POST | `/api/v1/rules/{ruleId}/verify` | 校验规则 |
| POST | `/api/v1/rules/{ruleId}/activate` | 激活规则 |
| POST | `/api/v1/rules/{ruleId}/suspend` | 暂停规则 |
| POST | `/api/v1/rules/{ruleId}/cancel` | 撤销规则 |
| GET | `/api/v1/rules/{ruleId}/audit-logs` | 查看变更审计日志 |
| GET | `/api/v1/rules/{ruleId}/execution-proofs` | 查看执行证明 |

创建示例：
```json
{
    "ruleId": "RULE-001",
    "ruleName": "30天归档90天删除",
    "description": "业务数据生命周期规则",
    "prefixId": 1,
    "archiveAfterDays": 30,
    "deleteAfterDays": 90,
    "storageClass": "GLACIER"
}
```

**规则状态流转**:
```
草稿 (DRAFT) → 已校验 (VERIFIED) → 激活 (ACTIVE) ↔ 已暂停 (SUSPENDED) → 已撤销 (CANCELLED)
```

### 3. 归档任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/archive-tasks` | 创建归档任务 |
| GET | `/api/v1/archive-tasks` | 获取所有任务 |
| GET | `/api/v1/archive-tasks/{taskId}` | 获取指定任务 |
| POST | `/api/v1/archive-tasks/{taskId}/start` | 开始执行任务 |
| POST | `/api/v1/archive-tasks/{taskId}/complete` | 完成任务 |
| POST | `/api/v1/archive-tasks/{taskId}/fail` | 标记任务失败 |
| POST | `/api/v1/archive-tasks/{taskId}/cancel` | 撤销任务 |
| GET | `/api/v1/archive-tasks/{taskId}/audit-logs` | 查看变更审计日志 |

创建示例：
```json
{
    "taskId": "ARCHIVE-001",
    "ruleId": 1,
    "objectKey": "/data/file1.txt",
    "bucketName": "my-bucket",
    "objectSize": 1024000,
    "sourceStorageClass": "STANDARD",
    "targetStorageClass": "GLACIER"
}
```

### 4. 删除候选管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/deletion-candidates` | 创建删除候选 |
| GET | `/api/v1/deletion-candidates` | 获取所有候选 |
| GET | `/api/v1/deletion-candidates/{id}` | 获取指定候选 |
| POST | `/api/v1/deletion-candidates/{id}/execute-delete` | 执行删除 |
| POST | `/api/v1/deletion-candidates/{id}/mark-exception` | 标记为例外 |
| POST | `/api/v1/deletion-candidates/{id}/cancel` | 撤销删除 |
| GET | `/api/v1/deletion-candidates/{id}/audit-logs` | 查看变更审计日志 |

创建示例：
```json
{
    "objectKey": "/data/old-log.txt",
    "bucketName": "my-bucket",
    "objectSize": 512000,
    "ruleId": 1,
    "lastModifiedDate": "2024-01-01T00:00:00",
    "scheduledDeletionDate": "2024-04-01T00:00:00"
}
```

### 5. 保留例外管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/retention-exceptions` | 创建保留例外 |
| GET | `/api/v1/retention-exceptions` | 获取所有例外 |
| GET | `/api/v1/retention-exceptions/{id}` | 获取指定例外 |
| PATCH | `/api/v1/retention-exceptions/{id}/toggle` | 切换启用状态 |
| DELETE | `/api/v1/retention-exceptions/{id}` | 删除例外 |
| GET | `/api/v1/retention-exceptions/{id}/audit-logs` | 查看变更审计日志 |

创建示例：
```json
{
    "objectKey": "/data/important-document.pdf",
    "bucketName": "my-bucket",
    "reason": "合规要求保留",
    "reasonCode": "COMPLIANCE-001",
    "effectiveFrom": "2024-01-01T00:00:00",
    "effectiveTo": "2025-01-01T00:00:00",
    "ruleId": 1
}
```

### 6. 执行证明管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/execution-proofs/{proofId}` | 获取指定证明 |
| GET | `/api/v1/execution-proofs?ruleId={ruleId}` | 按规则ID查询 |
| GET | `/api/v1/execution-proofs?objectKey={key}&bucketName={bucket}` | 按对象查询 |
| GET | `/api/v1/execution-proofs/export?ruleId={ruleId}` | 导出JSON格式 |
| GET | `/api/v1/execution-proofs/export?ruleId={ruleId}&format=csv` | 导出CSV格式 |

## 核心业务规则

### 1. 规则匹配引擎
- 根据对象前缀自动匹配相应的生命周期规则
- 支持多前缀多规则并行生效

### 2. 归档排程
- 自动计算归档时间
- 支持多种存储层级过渡（STANDARD → GLACIER等）

### 3. 删除预检
- 执行删除前检查保留例外
- 发现保留例外自动跳过

### 4. 例外保留
- 按对象精确配置
- 支持时间区间设置
- 与规则关联管理

### 5. 证明导出
- 所有操作自动生成执行证明
- 支持JSON和CSV两种导出格式
- 可按规则、对象、时间范围检索

## 审计与追溯

所有实体的变更都会记录审计日志，包括：
- 操作类型（创建/更新/删除等）
- 变更前后的值
- 操作时间
- 操作人（如配置）

查询示例：
```
GET /api/v1/rules/{ruleId}/audit-logs
```

## 项目结构

```
src/main/java/com/object/lifecycle/
├── ObjectLifecycleApplication.java  # 启动类
├── common/
│   └── BaseEntity.java              # 基础实体类
├── entity/                          # 数据实体（7个）
├── dto/                             # 数据传输对象（6个）
├── enums/                           # 枚举定义
├── repository/                      # 数据访问层（7个）
├── service/                         # 业务逻辑层（7个）
├── controller/                      # 控制器层（7个）
└── exception/                       # 异常处理

项目根目录
├── pom.xml                          # Maven配置
├── mvnw                             # Maven Wrapper脚本
├── .mvn/wrapper/                    # Wrapper配置和下载器
├── run.sh                           # 一站式运行脚本
├── test-api.sh                      # API测试脚本
└── README.md                        # 本文档
```

## 开发与测试

```bash
# 编译项目
./run.sh build

# 运行单元测试
./run.sh test

# 启动服务（后台）
./run.sh start

# 运行API功能测试
./test-api.sh

# 停止服务
./run.sh stop
```

## 技术栈

- **框架**: Spring Boot 2.7.18
- **数据库**: H2（内存数据库）
- **ORM**: Spring Data JPA
- **验证**: JSR-380 Bean Validation
- **日志**: SLF4J + Logback
- **审计**: JPA Auditing

## 常见问题

### Q: 首次启动很慢？
A: 首次运行会自动下载Maven和依赖jar包，请耐心等待。后续启动会快很多。

### Q: 端口8080被占用？
A: 修改 `src/main/resources/application.yml` 中的 `server.port` 配置。

### Q: 如何查看服务日志？
A: 后台启动后，日志会输出到 `app.log` 文件：`tail -f app.log`

### Q: H2数据库数据会丢失吗？
A: 使用内存数据库，重启服务后数据会清空。如需持久化，修改 `application.yml` 中的JDBC URL为文件模式。
