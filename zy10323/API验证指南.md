# 多版本响应适配器 - API 验证指南

## 项目修复内容汇总

### 第二轮修复
1. ✅ **修复编译错误**: 删除 DefaultValueRepository 中重复的方法定义
2. ✅ **添加 Maven Wrapper**: 提供 mvnw 脚本，无需全局 Maven 安装
3. ✅ **Java 版本兼容**: 从 Spring Boot 3.2 (Java 17+) 降级到 2.7.18 (Java 8+)
4. ✅ **Javax 迁移**: 所有 jakarta.* 导入改为 javax.*
5. ✅ **持久化数据库**: H2 文件型数据库 (./data/version_adapter_db)
6. ✅ **启动脚本**: 提供 ./run.sh 一键启动脚本

## 环境要求

- **Java**: JDK 8 或更高版本 (已验证 Java 8 兼容)
- **Maven**: 无需预先安装，使用项目内置 mvnw
- **内存**: 至少 512MB 可用内存

## 快速启动

```bash
# 方法 1: 使用一键启动脚本（推荐）
cd /Users/lzy/pro/solo/workspaces/zy10323
chmod +x run.sh    # 如果还没有执行权限
./run.sh

# 方法 2: 使用 Maven 手动构建
cd /Users/lzy/pro/solo/workspaces/zy10323
mvn clean package -DskipTests
java -jar target/version-response-adapter-1.0.0.jar
```

## 启动后访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 应用首页 | http://localhost:8080 | 验证服务启动 |
| H2 控制台 | http://localhost:8080/h2-console | 数据库管理 |
| JDBC URL | jdbc:h2:file:./data/version_adapter_db | 数据库连接 |
| 用户名 | sa | 数据库用户 |
| 密码 | (空) | 数据库密码 |

## API 验证流程

### 1. 版本管理 API

```bash
# 获取所有版本
curl http://localhost:8080/api/versions

# 获取特定版本 (启动后自动创建 v1.0.0, v2.0.0)
curl http://localhost:8080/api/versions/number/v1.0.0

# 创建新版本
curl -X POST http://localhost:8080/api/versions \
  -H "Content-Type: application/json" \
  -d '{
    "versionNumber": "v3.0.0",
    "clientType": "mobile",
    "description": "新版本测试",
    "status": "DRAFT",
    "deprecated": false
  }'

# 更新版本状态
curl -X PUT "http://localhost:8080/api/versions/1/status?status=ACTIVE"
```

### 2. 响应适配 API (核心功能)

```bash
# 测试适配
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

# 预期响应:
# {
#   "requestId": "...",
#   "clientVersion": "v1.0.0",
#   "adaptedResponse": {
#     "userId": 123,
#     "userName": "张三",
#     "email": "zhangsan@example.com"
#   },
#   "warnings": [...],
#   "hasWarnings": false,
#   "adaptationTimeMs": ...
# }
```

### 3. 模板管理 API

```bash
# 获取所有模板
curl http://localhost:8080/api/templates

# 获取激活模板
curl http://localhost:8080/api/templates/active

# 创建新模板
curl -X POST http://localhost:8080/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "order-api-v1",
    "apiEndpoint": "/api/order",
    "httpMethod": "GET",
    "description": "订单接口模板",
    "active": true
  }'

# 获取模板字段映射
curl http://localhost:8080/api/templates/1/fields
```

### 4. 调用样本 API

```bash
# 获取所有调用样本
curl http://localhost:8080/api/samples

# 获取错误调用
curl http://localhost:8080/api/samples/errors

# 获取警告调用
curl http://localhost:8080/api/samples/warnings

# 导出排查汇总报告
curl http://localhost:8080/api/samples/troubleshooting-summary
```

### 5. 审计时间线 API

```bash
# 获取所有审计记录
curl http://localhost:8080/api/audit

# 按实体类型筛选
curl http://localhost:8080/api/audit/type/ClientVersion

# 查看特定实体的历史
curl http://localhost:8080/api/audit/entity/ClientVersion/1
```

## 数据初始化说明

项目首次启动时会自动创建以下演示数据:

1. **客户端版本**: v1.0.0, v2.0.0
2. **响应模板**: user-info-api-v1 (用户信息接口)
3. **版本-模板映射**: 两个版本都映射到同一模板
4. **字段映射**:
   - id → userId (数字)
   - name → userName (字符串)
   - email → email (字符串)
5. **默认值**: email 字段默认为 "unknown@example.com"

## 常见问题

### 1. 端口被占用
```bash
# 修改 src/main/resources/application.yml
server:
  port: 8081  # 改为其他端口
```

### 2. Maven 下载慢
编辑 ~/.m2/settings.xml 添加阿里云镜像:
```xml
<mirror>
  <id>aliyun</id>
  <mirrorOf>central</mirrorOf>
  <name>Aliyun Maven</name>
  <url>https://maven.aliyun.com/repository/central</url>
</mirror>
```

### 3. 数据库路径问题
H2 数据库文件默认保存在:
```
./data/version_adapter_db.mv.db
```
确保应用对该目录有写入权限。

## 项目结构

```
version-response-adapter/
├── src/main/java/com/version/adapter/
│   ├── controller/          # REST 控制器
│   │   ├── VersionController.java     # 版本管理 + 适配
│   │   ├── TemplateController.java    # 模板管理
│   │   ├── SampleController.java      # 调用样本
│   │   └── AuditController.java       # 审计时间线
│   ├── service/             # 业务逻辑层
│   ├── repository/          # 数据访问层
│   ├── entity/              # JPA 实体类
│   ├── dto/                 # 数据传输对象
│   ├── exception/           # 异常处理
│   └── config/              # 配置类
├── src/main/resources/
│   └── application.yml      # 应用配置
├── .mvn/wrapper/            # Maven Wrapper
├── mvnw                     # Maven 启动脚本
├── run.sh                   # 一键启动脚本
└── pom.xml                  # Maven 配置
```

## 验证清单

- [ ] 项目能够成功编译打包 (mvn clean package)
- [ ] 应用能够正常启动，监听 8080 端口
- [ ] H2 控制台能够访问并连接数据库
- [ ] 版本管理 API 正常工作
- [ ] 响应适配 API 能够正确转换字段
- [ ] 调用样本被正确记录
- [ ] 审计时间线被正确记录
- [ ] 排查汇总报告能够正常导出
- [ ] 数据库持久化正常（重启后数据不丢失）
