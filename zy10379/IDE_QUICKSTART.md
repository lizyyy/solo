# IDE 快速启动指南

本指南将帮助你在常见 IDE 中快速启动服务令牌交换 API 项目。

## 📋 项目基本信息

- **项目类型**: Maven 项目
- **Java 版本**: Java 8+
- **Spring Boot 版本**: 2.7.18
- **主类**: `com.tokenexchange.TokenExchangeApplication`

## 🚀 IntelliJ IDEA (推荐)

### 方法 1: 直接打开项目

1. 打开 IntelliJ IDEA
2. 选择 **File → Open**
3. 选择项目根目录（包含 `pom.xml` 的文件夹）
4. 点击 **Open**

### 方法 2: 导入为 Maven 项目

1. 打开 IntelliJ IDEA
2. 选择 **File → New → Project from Existing Sources**
3. 选择项目根目录下的 `pom.xml`
4. 点击 **Open**
5. 保持默认设置，点击 **Next** 直到完成

### 启动项目

1. 在 **Project** 面板中展开:
   ```
   src/main/java/com/tokenexchange/
   ```
2. 找到 `TokenExchangeApplication.java`
3. 右键点击文件
4. 选择 **Run 'TokenExchangeApplication'**

### 验证启动

1. 查看控制台输出，应该看到类似:
   ```
   Started TokenExchangeApplication in X.XXX seconds
   ```
2. 打开浏览器访问: http://localhost:8080

## 🌙 Eclipse

### 导入项目

1. 打开 Eclipse
2. 选择 **File → Import**
3. 展开 **Maven** 文件夹
4. 选择 **Existing Maven Projects**
5. 点击 **Next**
6. 点击 **Browse** 选择项目根目录
7. 勾选 `pom.xml`
8. 点击 **Finish**

### 启动项目

1. 在 **Package Explorer** 中展开项目
2. 展开:
   ```
   src/main/java/com/tokenexchange/
   ```
3. 右键点击 `TokenExchangeApplication.java`
4. 选择 **Run As → Java Application**

## 💻 VS Code

### 准备工作

1. 安装 **Extension Pack for Java** 插件
2. 重启 VS Code

### 打开项目

1. 打开 VS Code
2. 选择 **File → Open Folder**
3. 选择项目根目录
4. 点击 **Select Folder**

### 启动项目

1. 等待 VS Code 完成项目导入（右下角会显示进度）
2. 在左侧 **Explorer** 面板展开:
   ```
   src/main/java/com/tokenexchange/
   ```
3. 点击打开 `TokenExchangeApplication.java`
4. 点击代码编辑器右上角的 **Run** 按钮
   或按 `F5` 启动调试

## 📝 启动后的验证

### 检查服务是否正常

1. **访问管理首页**:
   ```
   http://localhost:8080
   ```
   应该看到一个包含 API 端点说明的页面

2. **检查 H2 数据库控制台**:
   ```
   http://localhost:8080/h2-console
   ```
   - JDBC URL: `jdbc:h2:mem:tokendb`
   - 用户名: `sa`
   - 密码: (留空)
   - 点击 **Connect** 应该能连接成功

3. **测试 API 端点**:

   查看所有服务:
   ```bash
   curl http://localhost:8080/api/admin/services
   ```

   查看所有交换场景:
   ```bash
   curl http://localhost:8080/api/admin/scenarios
   ```

   创建用户令牌:
   ```bash
   curl -X POST http://localhost:8080/api/admin/user-tokens \
     -H "Content-Type: application/json" \
     -d '{"userId": "user-001", "scopes": "read,write", "expireDays": 30}'
   ```

## 🔧 常见问题

### Q1: IDE 无法识别为 Maven 项目

**解决方案**:
- IntelliJ IDEA: 右键 `pom.xml` → Add as Maven Project
- Eclipse: 右键项目 → Configure → Convert to Maven Project
- VS Code: 按 `Ctrl+Shift+P` → Maven: Reload Projects

### Q2: 端口 8080 被占用

**解决方案**:
修改 `src/main/resources/application.yml`:
```yaml
server:
  port: 8081  # 改为其他端口
```

### Q3: 依赖下载缓慢

**解决方案**:
配置 Maven 镜像源（阿里云镜像），在 `~/.m2/settings.xml` 中添加:
```xml
<mirrors>
  <mirror>
    <id>aliyunmaven</id>
    <mirrorOf>*</mirrorOf>
    <name>阿里云公共仓库</name>
    <url>https://maven.aliyun.com/repository/public</url>
  </mirror>
</mirrors>
```

### Q4: Java 版本不兼容

**解决方案**:
确保 IDE 使用的是 Java 8 或更高版本:

- IntelliJ IDEA: File → Project Structure → Project → SDK
- Eclipse: Window → Preferences → Java → Installed JREs
- VS Code: 设置 `java.configuration.runtimes`

## 🧪 完整测试流程

### 1. 启动服务
- 等待看到 `Started TokenExchangeApplication`

### 2. 验证初始化数据
```bash
# 查看服务
curl http://localhost:8080/api/admin/services

# 查看场景
curl http://localhost:8080/api/admin/scenarios
```

### 3. 创建用户令牌
```bash
curl -X POST http://localhost:8080/api/admin/user-tokens \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "scopes": "read,write,admin", "expireDays": 7}'
```

### 4. 令牌交换测试
从步骤 3 的返回中获取令牌值，然后:
```bash
curl -X POST http://localhost:8080/api/token/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "userToken": "你的用户令牌值",
    "sourceServiceId": "service-auth",
    "targetServiceId": "service-order",
    "scenarioCode": "USER_TO_ORDER",
    "expireMinutes": 15,
    "maxUseCount": 3
  }'
```

### 5. 验证短期令牌
从步骤 4 的返回中获取短期令牌，然后:
```bash
curl -X POST http://localhost:8080/api/token/validate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "你的短期令牌值",
    "serviceId": "service-order",
    "requiredScope": "read"
  }'
```

### 6. 查看诊断报告
```bash
curl http://localhost:8080/api/token/diagnostic/summary
```

## 📚 更多资源

- 完整的 API 文档: 查看 `README.md`
- 启动脚本: 运行 `./start.sh` 获取交互式引导
- Maven Wrapper: 使用 `./mvnw` 替代系统 Maven

---

**🎉 祝你使用愉快！如果有问题，请检查控制台日志或查看 README.md**
