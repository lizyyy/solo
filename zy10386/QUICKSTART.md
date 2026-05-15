# 快速启动指南

## 🚀 最快启动方式

### 方式一：使用预编译版本（推荐，无需 Maven）

1. 确保已安装 **JDK 8+**（不是 JRE）
2. 运行一键启动脚本：

**Mac/Linux:**
```bash
chmod +x start.sh && ./start.sh
```

**Windows:**
```cmd
start.bat
```

### 方式二：手动编译启动

```bash
# 编译（需要 JDK 8+）
./mvnw clean package -DskipTests

# 启动
java -jar target/data-access-approval-1.0.0.jar
```

## ✅ 环境检查

### 检查 Java 版本
```bash
java -version
# 确保版本 >= 1.8.0
```

### 检查是否为 JDK（而非 JRE）
```bash
javac -version
# 如果显示版本号，说明是完整 JDK
```

> 💡 如果只有 JRE，请安装完整 JDK 才能编译项目
> 下载地址: https://adoptium.net/

## 🔍 验证服务启动

启动成功后：
1. 访问 API: http://localhost:8080/api/applications/statuses
2. 访问 H2 控制台: http://localhost:8080/h2-console
3. 创建申请测试：
```bash
curl -X POST http://localhost:8080/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicantId": "test001",
    "applicantName": "测试用户",
    "dataDomainCode": "PUBLIC_DATA",
    "targetRegion": "HONG_KONG",
    "accessReason": "业务测试"
  }'
```

## 📁 数据持久化

数据库文件自动保存在 `./data/` 目录下：
- `approvaldb.mv.db` - 主数据文件
- 重启服务后所有申请、审批记录、令牌、审计日志都会保留

## 🔧 常见问题

### Q: 提示 "No compiler is provided"
A: 安装的是 JRE 而非 JDK，请下载并安装完整 JDK

### Q: 提示 "Java 版本太低"
A: 升级到 Java 8 或更高版本

### Q: Maven 下载慢
A: 配置国内 Maven 镜像源，或手动下载 Maven 放到 `~/.m2/wrapper/`

### Q: 端口被占用
A: 修改 `application.yml` 中的 `server.port` 配置
