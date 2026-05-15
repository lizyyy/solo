# 🎯 第 1 步：用 IDE 启动服务（唯一官方推荐）

## ⚠️ 为什么必须用 IDE？

**本机没有 `mvn` 命令，所以：**
- ❌ 不能用 `mvn spring-boot:run`
- ❌ 不能用 `mvn clean package` 打 jar
- ❌ 不能用 `java -jar target/xxx.jar`
- ✅ **只能用 IDE 内置 Maven 来下载依赖并启动**

---

## 🚀 IntelliJ IDEA 启动步骤（6 步搞定）

### 第 0 步：先清理
```bash
# 在项目根目录执行
rm -rf target
```

### 第 1 步：打开项目
```
File → Open → 选择 pom.xml → Open as Project
```

### 第 2 步：设置 Java 8（关键！）
```
File → Project Structure → Project:
  ✅ SDK: 选择 1.8
  ✅ Language level: 选择 8
```

### 第 3 步：设置 Compiler（关键！）
```
Preferences/Settings → Build, Execution, Deployment → Compiler → Java Compiler:
  ✅ Project bytecode version: 8
  ✅ Target bytecode version: 8
  ✅ Per-module bytecode version: 8
```

### 第 4 步：启用 Lombok
```
Preferences → Build, Execution, Deployment → Compiler → Annotation Processors:
  ✅ 勾选 Enable annotation processing
```

### 第 5 步：重新编译
```
Build → Rebuild Project
```

### 第 6 步：启动！
找到文件：`src/main/java/com/api/slimming/ApiSlimmingApplication.java`

**右键 → Run 'ApiSlimmingApplication'**

---

## ✅ 验证启动成功

看到以下日志就是成功了：
```
... Started ApiSlimmingApplication in 3.456 seconds
... Tomcat started on port(s): 8080 (http) with context path '/api-slimming'
```

浏览器打开验证：`http://localhost:8080/api-slimming/h2-console`

---

## 👉 第 2 步：运行验收脚本

服务启动成功后，打开新终端执行：
```bash
./2_VERIFY.sh
```

---

## ❓ 常见问题

### Q1: 启动报错 UnsupportedClassVersionError
**错误**: class file version 55.0
**解决**:
```bash
rm -rf target
# 然后 IDEA: Build → Rebuild Project
```

### Q2: 编译报错，找不到符号（@Data 等 Lombok 注解）
**解决**: 确认勾选了 `Enable annotation processing`

### Q3: 启动报错 NoClassDefFoundError
**解决**: 这是依赖没下载完
1. 等待 IDE 右下角进度条完成（下载 Maven 依赖）
2. 或者右键 pom.xml → Maven → Reload Project

### Q4: 8080 端口被占用
**解决**:
```bash
# 查找并杀掉占用端口的进程
lsof -ti:8080 | xargs kill -9
```

---

## 📚 相关文档

| 文档 | 内容 |
|------|------|
| `2_VERIFY.sh` | 一键验收脚本 |
| `IDE_JAVA8_GUIDE.md` | 完整的 IDE 配置指南 |
| `0_QUICK_START.md` | 快速启动总览 |
