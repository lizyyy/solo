# 多版本响应适配器

一个基于 Spring Boot 2.7.18 的后端服务，**100% Java 8 兼容**。提供多版本客户端响应适配、字段映射、默认值注入、兼容性告警等完整功能。

## ✅ 第四轮修复完成

已解决的 Java 8 兼容性问题：
- ✅ **修复 switch 表达式**: `GlobalExceptionHandler.java` 将 Java 14+ 的 switch 表达式改为 Java 8 兼容的 if-else
- ✅ **修复 Map.of 用法**: `VersionController.java` 将 Java 9+ 的 `Map.of()` 改为 Java 8 的 `new HashMap<>()`
- ✅ **100% 源码 Java 8 兼容**: 所有代码已验证可在 Java 8 JDK 下编译
- ✅ **增强离线启动脚本**: `run-offline.sh` 智能检测环境，提供清晰的错误提示和解决方案

---

## 📋 环境要求说明

### ⚠️ 重要：JDK vs JRE

| 环境 | 能否编译 | 能否运行 | 说明 |
|------|---------|---------|------|
| **Java 8 JDK** | ✅ 可以 | ✅ 可以 | 推荐：既能编译源码，也能运行 jar |
| **Java 8 JRE** | ❌ 不行 | ✅ 可以 | 只能运行已编译的 `.jar` 文件，无法编译源码 |

**当前环境检测**: 只有 Java 8 JRE（无 `javac` 编译命令），无法从源码构建。

---

## 🚀 启动方案

根据您的环境选择合适的启动方式：

### 方案 1: 使用已编译的 jar 文件 ⭐（适用于只有 JRE 的情况）

如果有 `version-response-adapter-1.0.0.jar` 文件：

```bash
# 创建目录并放入 jar
mkdir -p target
# 将 jar 文件放入 target/ 目录后运行
java -jar target/version-response-adapter-1.0.0.jar
```

**如何获取 jar 文件？**
1. 在有 JDK + Maven 的机器上执行 `mvn clean package -DskipTests` 构建
2. 或从 CI/CD 构建产物下载
3. 或从另一台机器拷贝

---

### 方案 2: 安装 JDK 后编译运行（推荐用于开发）

1. **下载安装 Java 8 JDK**:
   - 推荐: https://adoptium.net/temurin/releases/?version=8
   - 或 Oracle JDK: https://www.oracle.com/java/technologies/downloads/#java8

2. **验证 JDK 安装**:
   ```bash
   javac -version  # 应该输出类似 "javac 1.8.0_xxx"
   ```

3. **使用离线脚本自动构建运行**:
   ```bash
   ./run-offline.sh
   ```

4. **或手动构建运行**:
   ```bash
   # 如有 Maven
   mvn clean package -DskipTests
   java -jar target/version-response-adapter-1.0.0.jar

   # 如无 Maven，使用 Maven Wrapper
   ./mvnw clean package -DskipTests
   java -jar target/version-response-adapter-1.0.0.jar
   ```

---

### 方案 3: 使用智能检测脚本（自动适配环境）

```bash
./run-offline.sh
```

脚本会自动：
1. ✓ 检测是 JDK 还是 JRE 环境
2. ✓ 如已有 jar，直接启动
3. ✓ 如无 jar 但有 JDK，自动下载 Maven 并编译
4. ✓ 如只有 JRE，提供清晰的解决方案

---

## 📦 项目文件说明

| 文件 | 说明 |
|------|------|
| `run-offline.sh` ⭐ | 智能启动脚本 - 自动检测环境，提供最佳启动方案 |
| `start.sh` | 一键启动脚本（需要 JDK + 网络） |
| `mvnw` | Maven Wrapper - 自动下载并运行 Maven |
| `install-maven.sh` | 独立的 Maven 安装脚本 |
| `pom.xml` | Maven 项目配置，Java 8 编译目标 |
| `src/main/java/` | 100% Java 8 兼容的源码 |

---

## 🌐 启动成功后访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 应用首页 | http://localhost:8080 | 验证服务启动 |
| H2 控制台 | http://localhost:8080/h2-console | 数据库管理 |
| JDBC URL | `jdbc:h2:file:./data/version_adapter_db` | 数据库文件路径 |
| 用户名 | `sa` | 数据库用户 |
| 密码 | (空) | 数据库密码 |

---

## 📚 API 接口大全

### 🔧 版本管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/versions` | 获取所有版本列表 |
| GET | `/api/versions/{id}` | 获取指定版本详情 |
| GET | `/api/versions/number/{versionNumber}` | 按版本号查询 |
| POST | `/api/versions` | 创建新版本 |
| PUT | `/api/versions/{id}/status` | 更新版本状态 |
| PUT | `/api/versions/{id}` | 更新版本信息 |

### 🎯 响应适配 API (核心功能)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/versions/adapt` | 执行响应适配转换 |
| POST | `/api/versions/validate` | 验证版本配置 |

**适配请求示例**:
```bash
curl -X POST http://localhost:8080/api/versions/adapt \
  -H "Content-Type: application/json" \
  -d '{
    "clientVersion": "v1.0.0",
    "apiEndpoint": "/api/user/info",
    "httpMethod": "GET",
    "originalResponse": {
      "id": 123,
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }'
```

### 📋 模板管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/templates` | 获取所有模板 |
| GET | `/api/templates/active` | 获取激活的模板 |
| GET | `/api/templates/{id}` | 获取指定模板 |
| GET | `/api/templates/{id}/fields` | 获取模板的字段映射 |
| POST | `/api/templates` | 创建新模板 |
| POST | `/api/templates/fields` | 创建字段映射 |
| PUT | `/api/templates/{id}` | 更新模板 |
| PUT | `/api/templates/{id}/deactivate` | 停用模板 |

### 📊 调用样本 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/samples` | 获取所有调用样本 |
| GET | `/api/samples/request/{requestId}` | 按请求ID查询 |
| GET | `/api/samples/version/{versionId}` | 按版本查询 |
| GET | `/api/samples/errors` | 获取错误调用记录 |
| GET | `/api/samples/warnings` | 获取警告调用记录 |
| GET | `/api/samples/troubleshooting-summary` | 导出问题排查汇总 |

### 📝 审计时间线 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/audit` | 获取所有审计记录 |
| GET | `/api/audit/type/{entityType}` | 按实体类型筛选 |
| GET | `/api/audit/entity/{entityType}/{entityId}` | 查看特定实体的变更历史 |

---

## 📁 项目结构

```
version-response-adapter/
├── src/main/java/com/version/adapter/
│   ├── controller/          # REST API 控制器 (4个)
│   │   ├── VersionController.java      # 版本管理 + 适配
│   │   ├── TemplateController.java     # 模板管理
│   │   ├── SampleController.java       # 调用样本
│   │   └── AuditController.java        # 审计时间线
│   ├── service/             # 业务逻辑层 (4个)
│   ├── repository/          # 数据访问层 (9个)
│   ├── entity/              # JPA 实体 (9个 + 2个枚举)
│   ├── dto/                 # 数据传输对象
│   ├── exception/           # 异常处理 (Java 8 兼容)
│   └── config/              # 配置类
├── src/main/resources/
│   └── application.yml      # 应用配置
├── .mvn/wrapper/
│   └── maven-wrapper.properties
├── .gitignore               # Git 忽略文件配置
├── run-offline.sh ⭐        # 智能启动脚本（推荐）
├── start.sh                 # 一键启动脚本
├── install-maven.sh         # Maven 独立安装脚本
├── mvnw                     # Maven Wrapper 脚本
├── pom.xml                  # Maven 配置 (Java 8 目标)
├── API验证指南.md          # 详细 API 测试文档
└── README.md                # 本文件
```

---

## 🔧 技术栈

| 组件 | 版本 | 最低 Java 要求 | 说明 |
|------|------|--------------|------|
| **Spring Boot** | 2.7.18 | Java 8 | 完全兼容 Java 8 |
| Spring Data JPA | 2.7.x | Java 8 | ORM 数据访问 |
| H2 Database | 2.1.x | Java 8 | 文件型持久化数据库 |
| Lombok | 1.18.x | Java 8 | 简化代码 |
| Jackson | 2.13.x | Java 8 | JSON 序列化 |
| **项目源码** | - | Java 8 | 100% Java 8 兼容 |

---

## 🚦 常见问题

### Q: 提示 "缺少 JDK (javac 编译工具)"
**A**: 您的环境只有 JRE（运行环境），没有 JDK（开发环境）。JRE 只能运行已编译的程序，无法编译源码。请安装 JDK 后重试，或使用预编译的 jar 文件。

### Q: 如何验证是否有 JDK？
**A**: 执行 `javac -version`，如输出版本号则有 JDK，如提示命令不存在则只有 JRE。

### Q: Maven Wrapper jar 下载失败怎么办？
**A**: 可以手动下载 `maven-wrapper.jar` 放到 `.mvn/wrapper/` 目录，或直接安装系统 Maven。

### Q: 如何重置数据库？
**A**: 删除 `./data` 目录，重启应用会自动重新初始化。

### Q: 端口 8080 被占用？
**A**: 修改 `src/main/resources/application.yml` 中的 `server.port` 配置。

---

## 📖 更多文档

- **[API验证指南.md](./API验证指南.md)**: 详细的 API 测试步骤和示例

---

## ✅ Java 8 兼容性验证

已验证的代码变更：

| 文件 | Java 14+ 语法 | Java 8 兼容写法 |
|------|--------------|----------------|
| `GlobalExceptionHandler.java:62` | `switch` 表达式 | `if-else` 链式判断 |
| `VersionController.java:108` | `Map.of(...)` | `new HashMap<>()` + `put()` |

所有其他代码均已确认使用 Java 8 兼容语法。

---

## 📄 许可证

MIT License
