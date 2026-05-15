# 快速启动指南

## ✅ 前置条件检查

启动前请确保：
- 已安装 **JDK 8+**（不是 JRE，需要 javac 编译器）
- 至少 512MB 可用内存

### 环境验证命令
```bash
# 检查 Java 版本
java -version

# 检查是否有 javac 编译器（必须有！）
javac -version
```

> 💡 **如果只有 JRE（没有 javac）**：请先安装完整 JDK，下载地址 https://adoptium.net/

---

## 🚀 启动方式（三选一）

### 方式一：一键启动脚本（推荐）⭐

**Mac/Linux:**
```bash
chmod +x start.sh && ./start.sh
```

**Windows:**
```cmd
start.bat
```

脚本会自动：
1. ✅ 检查 Java 环境
2. ✅ 自动下载 Maven（首次运行）
3. ✅ 编译项目
4. ✅ 启动服务

---

### 方式二：使用 Maven Wrapper 手动编译

```bash
# 第一步：编译（需要 JDK）
./mvnw clean package -DskipTests   # Mac/Linux
mvnw.cmd clean package -DskipTests  # Windows

# 第二步：启动
java -jar target/data-access-approval-1.0.0.jar
```

---

### 方式三：已有预编译 JAR

如果从其他机器复制了 JAR 文件：
```bash
# 确保 JAR 在 target/ 目录下
ls target/*.jar

# 直接启动
java -jar target/data-access-approval-1.0.0.jar
```

---

## 🔍 验证服务启动

启动成功后会显示：
```
========================================
   服务地址: http://localhost:8080
   API 测试: http://localhost:8080/api/applications/statuses
   H2控制台: http://localhost:8080/h2-console
   数据库: jdbc:h2:file:./data/approvaldb
========================================
```

### 快速测试
```bash
# 检查状态枚举 API
curl http://localhost:8080/api/applications/statuses

# 创建测试申请
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

---

## 📁 数据持久化

数据库文件自动保存在 `./data/` 目录下：
- `approvaldb.mv.db` - 主数据文件
- `approvaldb.trace.db` - 日志文件

**重要**：重启服务后所有数据保留！
- 申请记录
- 审批链
- 令牌信息
- 审计日志
- 取证记录

---

## 🔧 常见问题解决方案

### ❌ 问题："No compiler is provided" 或 "未检测到 javac"
**原因**：安装的是 JRE（运行环境）而非 JDK（开发工具包）

**解决**：
1. 下载并安装 JDK 8+：https://adoptium.net/
2. 配置 JAVA_HOME 环境变量指向 JDK 目录
3. 重新运行启动脚本

### ❌ 问题：Maven 下载慢
**解决**：
- 耐心等待（约 10MB）
- 或手动下载 Maven 放到 `~/.m2/wrapper/dists/`

### ❌ 问题：端口 8080 被占用
**解决**：
编辑 `src/main/resources/application.yml`：
```yaml
server:
  port: 8081  # 改为其他端口
```

### ❌ 问题：编译失败
**解决**：
```bash
# 清理后重新编译
./mvnw clean
./mvnw package -DskipTests -X  # -X 显示详细日志
```

### ❌ 问题：首次运行卡在下载 Maven
**解决**：
- 这是正常现象，Maven Wrapper 正在下载 Maven
- 取决于网络速度，可能需要 1-5 分钟
- 后续运行不会重复下载

---

## 📋 API 快速参考

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/applications` | 创建申请 |
| GET | `/api/applications/{id}` | 查看申请详情 |
| POST | `/api/applications/{id}/submit-region-validation` | 提交地区校验 |
| POST | `/api/applications/{id}/validate-region` | 执行地区校验 |
| POST | `/api/applications/{id}/submit-approval` | 提交审批 |
| POST | `/api/applications/{id}/approve` | 执行审批 |
| POST | `/api/applications/{id}/issue-token` | 签发访问令牌 |
| GET | `/api/applications/{id}/audit-logs` | 查看审计日志 |
| GET | `/api/applications/{no}/export-report` | 导出问题排查报告 |

---

## 💡 小贴士

1. **H2 控制台登录**：访问 http://localhost:8080/h2-console
   - JDBC URL: `jdbc:h2:file:./data/approvaldb`
   - 用户名: `sa`
   - 密码: (空)

2. **查看日志**：日志输出到控制台，包含 SQL 语句方便调试

3. **数据备份**：直接复制 `./data/` 目录即可备份整个数据库

4. **生产环境**：建议替换为 MySQL/PostgreSQL，修改 `application.yml` 配置

---

## 🎯 完整业务流程测试

```bash
# 1. 创建申请
APP_NO=$(curl -s -X POST http://localhost:8080/api/applications \
  -H "Content-Type: application/json" \
  -d '{"applicantId":"test001","applicantName":"测试用户","dataDomainCode":"PUBLIC_DATA","targetRegion":"HONG_KONG","accessReason":"业务测试"}' \
  | grep -o '"applicationNo":"[^"]*"' | cut -d'"' -f4)

echo "申请编号: $APP_NO"

# 2. 提交地区校验
# ...
```

如有其他问题，请查看 `README.md` 获取详细文档。
