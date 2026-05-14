# 多版本响应适配器

一个基于 Spring Boot 的后端服务，用于管理多版本客户端的响应适配、字段映射、默认值注入和兼容性警告。

## 项目特性

- ✅ **客户端版本管理** - 支持多版本生命周期管理
- ✅ **响应模板配置** - API 端点与版本映射
- ✅ **字段映射转换** - 源字段到目标字段的自定义映射
- ✅ **默认值注入** - 缺失字段自动填充默认值
- ✅ **兼容警告机制** - 版本兼容性检测与告警
- ✅ **调用样本记录** - 完整请求响应历史记录
- ✅ **审计时间线** - 所有操作的完整审计日志
- ✅ **排查汇总导出** - 问题诊断报告生成
- ✅ **持久化数据库** - H2 文件型数据库，数据不丢失

## 技术栈

- **框架**: Spring Boot 2.7.18 (兼容 Java 8+)
- **ORM**: Spring Data JPA
- **数据库**: H2 (文件持久化存储)
- **构建**: Maven (带 Wrapper)
- **验证**: JSR-303 Bean Validation
- **日志**: SLF4J + Lombok

## 快速开始

### 环境要求

- Java 8 或更高版本 (已验证 Java 8 兼容)
- 无需预先安装 Maven (使用项目内置 mvnw)

### 启动方式

```bash
# 方式 1: 使用一键启动脚本（推荐）
chmod +x run.sh
./run.sh

# 方式 2: 手动构建运行
./mvnw clean package -DskipTests
java -jar target/version-response-adapter-1.0.0.jar
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 应用 | http://localhost:8080 |
| H2 控制台 | http://localhost:8080/h2-console |

## 核心 API 端点

### 版本管理
```
GET    /api/versions                # 获取所有版本
POST   /api/versions                # 创建新版本
GET    /api/versions/{id}           # 获取指定版本
PUT    /api/versions/{id}/status    # 更新版本状态
```

### 响应适配 (核心功能)
```
POST   /api/versions/adapt          # 执行响应适配
POST   /api/versions/validate       # 验证版本配置
```

### 模板管理
```
GET    /api/templates               # 获取所有模板
POST   /api/templates               # 创建新模板
GET    /api/templates/{id}/fields   # 获取模板字段映射
POST   /api/templates/fields        # 创建字段映射
```

### 调用样本
```
GET    /api/samples                 # 获取所有调用记录
GET    /api/samples/errors          # 获取错误调用
GET    /api/samples/warnings        # 获取警告调用
GET    /api/samples/troubleshooting-summary  # 导出排查报告
```

### 审计时间线
```
GET    /api/audit                   # 获取所有审计记录
GET    /api/audit/type/{entityType} # 按实体类型筛选
```

## 数据库配置

- **JDBC URL**: `jdbc:h2:file:./data/version_adapter_db`
- **用户名**: `sa`
- **密码**: (空)

数据库文件自动创建在项目目录 `./data/` 下。

## 演示数据

首次启动时自动创建：
- 客户端版本: `v1.0.0`, `v2.0.0`
- 响应模板: `user-info-api-v1`
- 字段映射: `id→userId`, `name→userName`, `email→email`
- 默认值: `email` 字段默认 `unknown@example.com`

## 测试示例

```bash
# 测试响应适配
curl -X POST http://localhost:8080/api/versions/adapt \
  -H "Content-Type: application/json" \
  -d '{
    "clientVersion": "v1.0.0",
    "apiEndpoint": "/api/user/info",
    "httpMethod": "GET",
    "originalResponse": {
      "id": 123,
      "name": "张三"
    }
  }'
```

## 项目结构

```
version-response-adapter/
├── src/main/java/com/version/adapter/
│   ├── controller/          # REST API 控制器
│   ├── service/             # 业务逻辑层
│   ├── repository/          # 数据访问层
│   ├── entity/              # JPA 实体类
│   ├── dto/                 # 数据传输对象
│   ├── exception/           # 异常处理
│   └── config/              # 配置类
├── src/main/resources/
│   └── application.yml      # 应用配置
├── mvnw                     # Maven Wrapper
├── run.sh                   # 一键启动脚本
└── pom.xml                  # Maven 配置
```

## 许可证

MIT License
