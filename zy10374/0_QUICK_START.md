# 🚀 必读：验收标准流程

## ⚠️ 本机环境限制

**`mvn` 命令不存在，所以：**
- ❌ 不能用 `mvn spring-boot:run`
- ❌ 不能用 `mvn clean package` 打 jar
- ❌ 不能用 `java -jar target/xxx.jar`
- ✅ **只能用 IDE 内置 Maven 来启动**

---

## 🎯 两步验收流程

### ──────────────────────────────────────────
### 第 1 步：用 IDE 启动服务
### ──────────────────────────────────────────

👉 **请查看文件：`1_IDE_START_FIRST.md`**

```bash
# 0. 先清理旧文件
rm -rf target

# 1. 用 IntelliJ IDEA 打开 pom.xml
# 2. 设置 Project SDK = 1.8, Language level = 8
# 3. 设置 Java Compiler bytecode version = 8
# 4. 启用 Lombok Annotation Processing
# 5. Build → Rebuild Project
# 6. 右键运行: src/main/java/com/api/slimming/ApiSlimmingApplication.java
```

**看到以下日志就是启动成功：**
```
Started ApiSlimmingApplication in 3.456 seconds
Tomcat started on port(s): 8080 (http) with context path '/api-slimming'
```

---

### ──────────────────────────────────────────
### 第 2 步：运行验收脚本
### ──────────────────────────────────────────

**服务启动成功后，打开新终端执行：**

```bash
./2_VERIFY.sh
```

👉 **脚本自动完成 11 项验收测试：**

| 测试项 | 功能 |
|--------|------|
| 测试 1 | 创建规则 |
| 测试 2 | 幂等性验证（重复提交） |
| 测试 3 | 校验规则有效性 |
| 测试 4 | 激活规则 |
| 测试 5 | 查询规则详情 |
| 测试 6 | 查询规则变更历史 |
| 测试 7 | 执行 API 响应瘦身 |
| 测试 8 | 查询执行记录列表 |
| 测试 9 | 停用规则 |
| 测试 10 | 回滚规则到历史版本 |
| 测试 11 | 导出执行记录 CSV |

---

## 📋 验收脚本输出说明

```
╔═════════════════════════════════════════════╗
║       🧪 API 返回体瘦身服务 - 完整验收测试  ║
╚═════════════════════════════════════════════╝
...
╔═════════════════════════════════════════════╗
║                    📊 测试总结               ║
╠═════════════════════════════════════════════╣
║   通过测试: 11 个                           ║
║   失败测试:  0 个                           ║
╚═════════════════════════════════════════════╝
```

**最后会输出数据库验证指南，告诉你怎么用 H2 控制台查看数据。**

---

## 📚 文档索引

| 文件 | 作用 |
|------|------|
| `0_QUICK_START.md` | 本文件 - 快速启动总览 |
| `1_IDE_START_FIRST.md` | IDE 启动详细步骤（必读） |
| `2_VERIFY.sh` | 一键验收脚本（IDE 启动后执行） |
| `start_ide.sh` | IDE 编译后，尝试用命令行启动（备选） |
| `IDE_JAVA8_GUIDE.md` | 完整 IDE 配置指南 |
| `README.md` | 项目完整说明 |

---

## ❓ 常见问题

### Q1: UnsupportedClassVersionError (class file version 55.0)
**原因**: 旧的 class 是 Java 11 编译的
**解决**:
```bash
rm -rf target
# IDEA: Build → Rebuild Project
```

### Q2: 编译报错找不到符号（@Data 等）
**解决**: 确认勾选了 `Enable annotation processing`

### Q3: 启动报错 NoClassDefFoundError
**解决**: 等 IDE 右下角 Maven 依赖下载完成，或右键 pom.xml → Maven → Reload Project

### Q4: 8080 端口被占用
```bash
lsof -ti:8080 | xargs kill -9
```
