# 修复记录

## 第三轮修复 (2026-05-15) - Java 8 完全兼容

### 🔴 问题汇总

| 问题 | 状态 | 影响 |
|------|------|------|
| `jakarta.persistence` 包名 (Spring Boot 3) | ✅ 已修复 | Java 8 + Spring Boot 2.x 不兼容 |
| `jakarta.validation` 包名 | ✅ 已修复 | 编译错误 |
| Java 14+ switch 表达式 | ✅ 已修复 | Java 8 无法编译 |
| `target/classes` Java 17 class 残留 | ✅ 已修复 | UnsupportedClassVersionError |
| 测试脚本可靠性 | ✅ 已修复 | 无法验证功能 |

---

### ✅ 问题 1: jakarta.persistence → javax.persistence

**问题描述**:
- Spring Boot 3 使用 `jakarta.*` 包名 (EE 9+)
- Spring Boot 2.x 使用 `javax.*` 包名 (EE 8)
- 5 个实体类使用了错误的包名

**修复的文件**:
```
src/main/java/com/featureflag/audit/entity/AuditRecord.java
src/main/java/com/featureflag/audit/entity/BucketValue.java
src/main/java/com/featureflag/audit/entity/Experiment.java
src/main/java/com/featureflag/audit/entity/HitRule.java
src/main/java/com/featureflag/audit/entity/OverrideReason.java
```

**修改内容**:
```java
// 之前 (Spring Boot 3)
import jakarta.persistence.*;

// 之后 (Spring Boot 2.x + Java 8)
import javax.persistence.*;
```

---

### ✅ 问题 2: jakarta.validation → javax.validation

**问题描述**:
- Validation API 同样存在包名迁移问题

**修复的文件**:
```
src/main/java/com/featureflag/audit/dto/EvaluateRequest.java
src/main/java/com/featureflag/audit/controller/FeatureFlagController.java
```

**修改内容**:
```java
// 之前
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;

// 之后
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.Valid;
```

---

### ✅ 问题 3: Java 14+ switch 表达式

**问题描述**:
- FeatureFlagService.java:154 使用了 Java 14 switch 表达式新语法
- Java 8 不支持 `switch (x) { case A -> expr; }` 形式

**修复的文件**:
```
src/main/java/com/featureflag/audit/service/FeatureFlagService.java
```

**修改内容**:
```java
// 之前 (Java 14+)
return switch (operator) {
    case EQUALS -> attributeValue.equals(ruleValue);
    case NOT_EQUALS -> !attributeValue.equals(ruleValue);
    // ...
};

// 之后 (Java 8 兼容)
switch (operator) {
    case EQUALS:
        return attributeValue.equals(ruleValue);
    case NOT_EQUALS:
        return !attributeValue.equals(ruleValue);
    // ...
    default:
        return false;
}
```

---

### ✅ 问题 4: Java 17 class 文件残留

**问题描述**:
- `target/classes/` 目录下存在之前用 Java 17 编译的 class 文件
- 即使 pom.xml 设置了 Java 8，JVM 仍会加载旧版本 class
- 导致 `UnsupportedClassVersionError`

**修复方案**:
1. **强制清理 target 目录**
   ```bash
   rm -rf target/
   ```

2. **更新 bootstrap.sh 增强清理逻辑**
   - 每次启动前强制删除 `target/` 目录
   - 每次启动前强制删除 `maven-wrapper.jar` (重新下载)
   - 使用 `mvn clean compile` 而非单纯 `compile`
   - 确保所有字节码都是 Java 8 版本

---

### ✅ 问题 5: bootstrap.sh 增强

**修复内容**:
```bash
clean_target() {
    info "强制清理旧的编译产物 (防止 Java 17 class 残留)..."
    rm -rf "$PROJECT_DIR/target"
    rm -rf "$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar"
    success "清理完成"
}

build_project() {
    info "开始构建项目 (Java 8 兼容模式)..."
    cd "$PROJECT_DIR"
    # 使用 clean compile 确保从干净状态重新编译
    if ! ./mvnw clean compile -DskipTests -q; then
        error "构建失败！"
        exit 1
    fi
    success "项目构建完成 (Java 8 字节码)"
}
```

---

## 📁 第三轮修复文件汇总

| 类型 | 文件 | 变更说明 |
|------|------|---------|
| 🔧 修改 | `entity/AuditRecord.java` | jakarta → javax |
| 🔧 修改 | `entity/BucketValue.java` | jakarta → javax |
| 🔧 修改 | `entity/Experiment.java` | jakarta → javax |
| 🔧 修改 | `entity/HitRule.java` | jakarta → javax |
| 🔧 修改 | `entity/OverrideReason.java` | jakarta → javax |
| 🔧 修改 | `dto/EvaluateRequest.java` | jakarta.validation → javax |
| 🔧 修改 | `controller/FeatureFlagController.java` | jakarta.validation → javax |
| 🔧 修改 | `service/FeatureFlagService.java` | Java 14 switch → Java 8 switch |
| 🔧 修改 | `bootstrap.sh` | 增强清理 + clean compile |
| 🗑️ 删除 | `target/` | 强制删除 Java 17 class 残留 |

---

## 🔍 编译兼容性验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Spring Boot 版本 | ✅ 2.7.18 | Java 8+ 兼容 |
| Java 编译目标 | ✅ 1.8 | maven.compiler.target=8 |
| javax.persistence | ✅ 已修复 | 全部替换完成 |
| javax.validation | ✅ 已修复 | 全部替换完成 |
| Java 8 语法 | ✅ 已修复 | switch 表达式已替换 |
| Lambda 表达式 | ✅ 兼容 | Java 8 支持 |
| Stream API | ✅ 兼容 | Java 8 支持 |
| 无 var 关键字 | ✅ 确认 | 未使用 Java 10 var |
| 无 text blocks | ✅ 确认 | 未使用 Java 15 """ |
| 无 record 类 | ✅ 确认 | 未使用 Java 16 record |

---

## 🚀 完整运行流程 (第三轮后)

### 步骤 1: 启动服务 (完全自举)
```bash
# 确保在项目目录下
cd feature-flag-audit

# 一键启动 (自动完成所有设置)
./bootstrap.sh
```

**bootstrap.sh 执行流程**:
```
1. 检查 Java 版本 (≥ 8)
2. 强制清理:
   ├── 删除 target/ 目录 (Java 17 class 残留)
   └── 删除 maven-wrapper.jar (重新下载)
3. 下载 maven-wrapper.jar
4. 生成 mvnw 启动脚本
5. mvn clean compile -DskipTests (Java 8 字节码)
6. 启动 Spring Boot
```

### 步骤 2: 验证功能
```bash
# 新开终端运行测试
./test.sh
```

### 步骤 3: 访问服务
- 管理页面: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console

---

## ✅ 三轮修复总览

| 轮次 | 修复重点 | 核心问题 | 状态 |
|------|---------|---------|------|
| 第一轮 | 核心业务 | hitResult 非空约束导致持久化失败 | ✅ |
| 第二轮 | 启动链路 | Maven + Java 版本环境依赖 | ✅ |
| 第三轮 | 源码兼容 | Jakarta 包名 + Java 14 语法 | ✅ |

### 最终确认的兼容性

| 环境 | 最低要求 | 状态 |
|------|---------|------|
| JDK | 8+ | ✅ 完全兼容 |
| Maven | 无需预装 | ✅ 自动下载 Wrapper |
| Spring Boot | 2.7.18 | ✅ LTS 稳定版本 |
| 操作系统 | Linux/macOS | ✅ 兼容 |

### 核心功能全部可用

| 功能 | 接口 | 状态 |
|------|------|------|
| 特征评估 | POST /api/v1/feature-flag/evaluate | ✅ |
| 重复请求拦截 | RequestId 幂等 | ✅ 返回 409 |
| 分桶计算 | 稳定哈希分桶 | ✅ |
| 覆盖规则 | QA/管理员强制分组 | ✅ |
| 审计记录 | 完整持久化 | ✅ |
| 人工补偿 | POST /audit/{id}/compensate | ✅ |
| CSV 导出 | GET /audit/export | ✅ |
| 历史查询 | GET /audit + RequestId查询 | ✅ |

---

### 🎯 最终目标达成

✅ **可安装**: bootstrap.sh 自动处理所有依赖  
✅ **可运行**: Java 8 完全兼容，无版本错误  
✅ **可验证**: test.sh 完整验证所有核心功能
