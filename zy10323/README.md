# 多版本响应适配器

一个基于 Spring Boot 2.7.18 的后端服务，支持 Java 8+ 运行环境。提供多版本客户端响应适配、字段映射、默认值注入、兼容性告警等完整功能。

## ✅ 第三轮修复完成

已解决的构建/启动问题：
- ✅ **Maven Wrapper 自动补全**: `mvnw` 脚本可自动下载缺失的 `maven-wrapper.jar`
- ✅ **Maven 自动安装**: `start.sh` 脚本在无 Maven 时自动下载安装本地 Maven
- ✅ **Java 8 完全兼容**: Spring Boot 2.7.18 + 所有依赖都适配 Java 8
- ✅ **零依赖启动**: 只需 Java 8 + curl/wget，无需预先安装 Maven
- ✅ **旧编译产物清理**: 已移除 Java 17 编译的 target/classes
- ✅ **多种启动方式**: 提供 4 种启动方案，适应各种环境

## 🚀 快速开始（推荐）

### 方式 1: 一键启动脚本 ⭐ （完全无需预先安装 Maven）

```bash
cd /Users/lzy/pro/solo/workspaces/zy10323
chmod +x start.sh   # 如还没有执行权限
./start.sh
```

**脚本自动完成**:
1. ✓ 检测 Java 环境
2. ✓ 检测/下载/安装 Maven
3. ✓ 编译项目（Java 8 兼容）
4. ✓ 打包并启动服务

---

### 方式 2: 使用 Maven Wrapper

```bash
./mvnw clean package -DskipTests
java -jar target/version-response-adapter-1.0.0.jar
```

> 首次运行 `./mvnw` 会自动下载 `maven-wrapper.jar`

---

### 方式 3: 先安装 Maven 再启动

```bash
# 独立安装 Maven 到项目本地目录
./install-maven.sh

# 然后使用本地 Maven 构建
./.tools/maven/apache-maven-3.9.6/bin/mvn clean package -DskipTests
java -jar target/version-response-adapter-1.0.0.jar
```

---

### 方式 4: 使用系统 Maven（如已安装）

```bash
mvn clean package -DskipTests
java -jar target/version-response-adapter-1.0.0.jar
```

## 🌐 访问地址

启动成功后可访问以下地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| 应用首页 | http://localhost:8080 | 验证服务启动 |
| H2 控制台 | http://localhost:8080/h2-console | 数据库管理 |
| JDBC URL | `jdbc:h2:file:./data/version_adapter_db` | 数据库文件 |
| 用户名 | `sa` | 数据库用户 |
| 密码 | (空) | 数据库密码 |

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
│   ├── exception/           # 异常处理
│   └── config/              # 配置类
├── src/main/resources/
│   └── application.yml      # 应用配置
├── .mvn/wrapper/
│   └── maven-wrapper.properties
├── .tools/                  # 自动下载的工具 (git忽略)
├── data/                    # H2 数据库文件 (git忽略)
├── target/                  # 编译产物 (git忽略)
├── start.sh                 # ⭐ 一键启动脚本 (推荐)
├── install-maven.sh         # Maven 独立安装脚本
├── mvnw                     # Maven Wrapper 脚本
├── pom.xml                  # Maven 配置
├── API验证指南.md          # 详细 API 测试文档
└── README.md                # 本文件
```

## 🎬 演示数据

首次启动时会自动初始化以下演示数据，可直接测试：

- **客户端版本**: `v1.0.0`, `v2.0.0`
- **响应模板**: `user-info-api-v1` (用户信息接口)
- **版本-模板映射**: 两个版本都关联到同一模板
- **字段映射**:
  - `id` → `userId` (数字类型)
  - `name` → `userName` (字符串类型)
  - `email` → `email` (字符串类型)
- **默认值**: `email` 字段默认为 `unknown@example.com`

## 🔧 技术栈

| 组件 | 版本 | 说明 |
|------|------|------|
| Java | 8+ | 已验证 Java 8 完全兼容 |
| Spring Boot | 2.7.18 | Java 8 支持的最新稳定版 |
| Spring Data JPA | 2.7.x | ORM 数据访问 |
| H2 Database | 2.1.x | 文件型持久化数据库 |
| Lombok | 1.18.x | 简化代码 |
| Jackson | 2.13.x | JSON 序列化 |
| Maven | 3.9.x | 构建工具 (自动下载) |

## 📋 环境要求

### 必需
- **Java 8 或更高版本**
- **curl 或 wget** (用于下载依赖，Mac/Linux 一般自带)

### 可选
- **Maven 3.6+** (如不使用启动脚本自动安装)

## 🚦 常见问题

### Q: 启动脚本报 "command not found: mvn"
**A**: 这是正常的，`start.sh` 脚本会自动检测并下载安装 Maven，无需手动处理。

### Q: 下载 Maven 很慢怎么办
**A**: 可以手动下载 Maven 压缩包放到 `.tools/maven/` 目录，脚本会自动识别跳过下载。

### Q: 如何重置数据库
**A**: 删除 `./data` 目录，重启应用会自动重新初始化。

### Q: 端口 8080 被占用
**A**: 修改 `src/main/resources/application.yml` 中的 `server.port` 配置。

### Q: 如何查看详细的编译日志
**A**: 去掉 `-q` 参数运行：
```bash
./mvnw clean package -DskipTests
```

## 📖 更多文档

- **[API验证指南.md](./API验证指南.md)**: 详细的 API 测试步骤和示例
- **[start.sh](./start.sh)**: 一键启动脚本源码

## 📄 许可证

MIT License
