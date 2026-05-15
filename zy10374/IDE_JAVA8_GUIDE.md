# IDE Java 8 配置与启动指南（必读！）

## ⚠️ 重要提示

项目之前编译的 class 文件是 Java 11 版本（version 55.0），必须用 Java 8 重新编译才能运行。

---

## 📋 前置检查

先确认你的 Java 版本：
```bash
java -version
javac -version
```

**要求**: 必须是 `1.8.0_xxx` 或 Java 8 版本。

---

## 🔧 IntelliJ IDEA 配置步骤（强制 Java 8 编译）

### 步骤 1：设置 Project SDK

1. 打开：**File → Project Structure** (快捷键: `⌘;` / `Ctrl+Alt+Shift+S`)

2. 左侧选择 **Project**，设置：
   - **SDK**: 选择 `1.8` (如果没有，点击 `Add SDK → JDK` 添加你的 JDK 8 目录)
   - **Language level**: 选择 `8 - Lambdas, type annotations etc.`
   - **Compiler output**: (保持默认即可)

   ![Project Settings](screenshot placeholder)

### 步骤 2：设置 Modules 语言级别

1. 左侧选择 **Modules**
2. 选中项目模块
3. **Sources** 标签 → Language level: 选择 `8 - Lambdas, type annotations etc.`
4. **Dependencies** 标签 → Module SDK: 选择 `1.8`

### 步骤 3：设置 Maven 编译配置

1. 打开：**Preferences/Settings → Build, Execution, Deployment → Build Tools → Maven**
2. 检查：
   - **Maven home path**: 使用 Bundled (IDEA 内置 Maven，无需安装)
   - **Runner** 标签 → JRE: 选择 `1.8`
   - ✅ **重要**: 勾选 `Delegate IDE build/run actions to Maven`

### 步骤 4：设置 Java Compiler

1. 打开：**Preferences/Settings → Build, Execution, Deployment → Compiler → Java Compiler**
2. 设置：
   - **Project bytecode version**: `8`
   - **Per-module bytecode version**: 确保项目也是 `8`
   - **Target bytecode version**: `8`

### 步骤 5：清理并重新编译

1. 清理旧的编译产物：
   - **Build → Rebuild Project**
   - 或手动删除 `target` 目录后再 Build

2. 验证编译结果：
   ```bash
   # 检查 class 文件版本（应该是 52.0 = Java 8）
   find target/classes -name "*.class" | head -1 | xargs javap -verbose | grep "major version"
   ```
   预期输出：`major version: 52`

### 步骤 6：启动应用

找到启动类：
```
src/main/java/com/api/slimming/ApiSlimmingApplication.java
```

1. 右键 → **Run 'ApiSlimmingApplication'**
2. 或点击类名左侧的 ▶️ 按钮
3. 看到以下日志即为成功：
   ```
   Started ApiSlimmingApplication in 3.456 seconds (JVM running for 4.123)
   ```

---

## 🔧 Eclipse 配置步骤

### 步骤 1：设置 JRE

1. **Window → Preferences → Java → Installed JREs**
2. 添加 JDK 8 并设为默认

### 步骤 2：设置 Compiler

1. **Window → Preferences → Java → Compiler**
2. **Compiler compliance level**: `1.8`

### 步骤 3：项目设置

1. 右键项目 → **Properties → Java Build Path**
2. Libraries 标签 → 确认 JRE System Library 是 `JavaSE-1.8`
3. **Java Compiler** → Enable project specific settings → `1.8`

### 步骤 4：清理并运行

1. **Project → Clean...** 选择项目清理
2. 右键 `ApiSlimmingApplication.java` → **Run As → Java Application**

---

## 🔧 VS Code 配置步骤

### 步骤 1：安装插件

确保已安装：
- **Extension Pack for Java** (Microsoft)

### 步骤 2：配置 Java 8

1. 创建/编辑 `.vscode/settings.json`:
   ```json
   {
     "java.configuration.runtimes": [
       {
         "name": "JavaSE-1.8",
         "path": "/path/to/your/jdk8",
         "default": true
       }
     ],
     "java.compiler.fallback": "1.8",
     "maven.executable.preferMavenWrapper": false
   }
   ```

### 步骤 3：编译运行

1. 打开 `ApiSlimmingApplication.java`
2. 点击 `Run` 或按 `F5`

---

## ✅ 验证启动成功

### 1. 检查日志

控制台输出应包含：
```
o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port(s): 8080 (http) with context path '/api-slimming'
c.a.s.ApiSlimmingApplication             : Started ApiSlimmingApplication in X.XXX seconds
```

### 2. 访问测试

浏览器打开：`http://localhost:8080/api-slimming/h2-console`

或用 curl：
```bash
curl http://localhost:8080/api-slimming/
```

返回 404 错误页面 = 服务正常启动！

---

## 🧪 启动后运行验收脚本

```bash
./verify.sh
```

---

## ❓ 常见问题

### Q1: java.lang.UnsupportedClassVersionError

**错误信息**:
```
java.lang.UnsupportedClassVersionError: com/api/slimming/ApiSlimmingApplication 
has been compiled by a more recent version of the Java Runtime (class file version 55.0), 
this version of the Java Runtime only recognizes class file versions up to 52.0
```

**解决方案**:
1. 确认 Project SDK 是 1.8
2. 确认 Language level 是 8
3. **Build → Rebuild Project**（必须！）
4. 如果仍不行：
   - 关闭 IDE
   - 删除 `target` 目录
   - 删除 IDE 的 `.idea` 目录（或 `.settings` for Eclipse）
   - 重新打开项目

### Q2: 找不到符号 / 编译错误

**可能原因**: Lombok 未生效

**解决方案**:
- IntelliJ IDEA: 安装 Lombok 插件，启用 Annotation Processing
  - **Preferences → Build, Execution, Deployment → Compiler → Annotation Processors**
  - ✅ 勾选 `Enable annotation processing`

### Q3: 没有 Maven 怎么办？

**解决方案**:
- IntelliJ IDEA 自带内置 Maven，无需单独安装
- 只要打开 pom.xml，IDEA 会自动处理依赖

### Q4: 如何手动清理旧的 class 文件

```bash
# 删除 target 目录（推荐，IDE 会自动重建）
rm -rf target

# 或只删除 class 文件
find target -name "*.class" -delete
```

---

## 📝 验收检查清单

- [ ] `java -version` 显示 1.8.x
- [ ] IDE 的 Project SDK 设置为 1.8
- [ ] Language level 设置为 8
- [ ] Rebuild Project 无编译错误
- [ ] 启动 ApiSlimmingApplication 无报错
- [ ] 能访问 `http://localhost:8080/api-slimming/h2-console`
- [ ] 运行 `./verify.sh` 所有测试通过
