# 🚀 必读：30 秒快速启动指南

## ⚠️ 你必须先读这个！

### 问题现象
```
# 你可能遇到的错误：
1. mvn: command not found
2. Unable to access jarfile target/api-response-slimming-service-1.0.0.jar
3. UnsupportedClassVersionError: class file version 55.0 (Java 11)
```

### 原因
- 旧的 class 文件是 Java 11 编译的（version 55）
- 需要用 Java 8 重新编译
- **不需要安装 Maven！** IDE 自带内置 Maven

---

## 🎯 最快启动方式（IntelliJ IDEA，推荐）

### 第 0 步：清理旧文件（重要！）
```bash
# 在项目根目录执行
rm -rf target
```

### 第 1 步：用 IDEA 打开项目
```bash
# 直接用 IDEA 打开 pom.xml 文件
File → Open → 选择 pom.xml → Open as Project
```

### 第 2 步：检查 Java 版本（非常重要！）
```
File → Project Structure → Project:
  ✅ SDK: 选择 1.8
  ✅ Language level: 选择 8
```

### 第 3 步：设置 Java Compiler
```
Preferences/Settings → Build, Execution, Deployment → Compiler → Java Compiler:
  ✅ Project bytecode version: 8
  ✅ Target bytecode version: 8
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

看到类似日志：
```
Started ApiSlimmingApplication in 3.456 seconds
Tomcat started on port(s): 8080 (http) with context path '/api-slimming'
```

浏览器访问：`http://localhost:8080/api-slimming/h2-console`

---

## 🧪 验收测试（启动后执行）

```bash
# 运行一键验收脚本
./verify.sh
```

脚本会自动测试：
- ✅ 创建规则 + 幂等性
- ✅ 规则校验、激活
- ✅ 执行瘦身
- ✅ 查询记录
- ✅ 显示 H2 控制台信息

---

## 📚 更多文档

| 文档 | 内容 |
|------|------|
| `IDE_JAVA8_GUIDE.md` | 完整的 IDE 配置指南（IDEA/Eclipse/VS Code） |
| `START.md` | 详细的启动和验收流程 |
| `README.md` | 项目完整说明 |
| `verify.sh` | 自动化验收脚本 |

---

## ❓ 卡住了？

**如果遇到 UnsupportedClassVersionError:**
```bash
rm -rf target
# 然后 IDEA: Build → Rebuild Project
```

**如果编译错误（找不到符号）:**
- 确认勾选了 `Enable annotation processing` (Lombok 需要)

**如果没有 IDEA:**
- 用 Eclipse 或 VS Code，参考 `IDE_JAVA8_GUIDE.md`

---

## 🎯 验收目标清单

- [ ] 能启动 `ApiSlimmingApplication`
- [ ] 能访问 `http://localhost:8080/api-slimming/h2-console`
- [ ] 能创建规则（POST `/api/rules`）
- [ ] 重复提交不产生脏数据（幂等性）
- [ ] 能校验、激活规则
- [ ] 能执行瘦身
- [ ] 能查询执行记录
- [ ] 能回滚规则
