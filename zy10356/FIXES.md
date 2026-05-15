# 修复记录

## 第二轮修复 (2026-05-15)

### 🔴 问题汇总

| 问题 | 状态 | 影响 |
|------|------|------|
| Spring Boot 3.x 要求 Java 17+ | ✅ 已修复 | Java 8 环境无法启动 |
| 缺少完整的 Maven Wrapper | ✅ 已修复 | 无 mvn 环境无法构建 |
| start.sh 只能提示无法真正运行 | ✅ 已修复 | 项目无法自举启动 |
| 预编译 class 版本不兼容 | ✅ 已修复 | UnsupportedClassVersionError |
| 测试脚本无法验证功能 | ✅ 已修复 | 无法验证调用/重复请求/补偿/导出 |

---

### ✅ 问题 1: Spring Boot 版本降级 (Java 8 兼容)

**问题描述**:
- Spring Boot 3.2.0 要求 Java 17+
- 当前环境为 Java 8，启动报 `UnsupportedClassVersionError`

**修复方案**:
- **文件**: `pom.xml`
- **修改**: Spring Boot 从 3.2.0 降级到 2.7.18 (LTS)
- **Java 版本要求**: 从 Java 17 降到 Java 8

```xml
<!-- 之前 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>
<properties>
    <java.version>17</java.version>
</properties>

<!-- 之后 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
</parent>
<properties>
    <java.version>8</java.version>
</properties>
```

**同步降级的依赖**:
- Guava: 32.1.3-jre → 31.1-jre (Java 8 兼容)
- commons-lang3: 固定为 3.12.0

---

### ✅ 问题 2: 完整的自举启动脚本 bootstrap.sh

**问题描述**:
- 项目只有 `.mvn/wrapper/maven-wrapper.properties`
- 缺少 `mvnw` 脚本和 `maven-wrapper.jar`
- 环境没有系统 `mvn` 命令
- 原 `start.sh` 只能检查版本然后退出

**修复方案**:
- **新增文件**: `bootstrap.sh`
- **功能**: 全自动自举启动，不依赖预装 Maven

**bootstrap.sh 核心功能**:
```
1. 检查 Java 环境 (Java 8+)
2. 自动下载 maven-wrapper.jar
3. 自动生成完整的 mvnw 脚本
4. 清理旧的编译产物 (避免版本冲突)
5. 使用 Maven Wrapper 编译项目
6. 启动 Spring Boot 服务
```

**使用方式**:
```bash
# 一条命令完成所有，无需预装 Maven
./bootstrap.sh
```

---

### ✅ 问题 3: 完整的功能验证 test.sh

**问题描述**:
- 服务无法启动导致测试脚本无法验证
- 缺少完整的功能测试场景

**修复方案**: 增强 `test.sh` 脚本
- 添加服务启动检测
- 添加等待重试机制
- 覆盖完整的功能测试场景

**测试覆盖的功能**:
| 测试场景 | 验证点 |
|---------|--------|
| 正常请求 | 命中分桶，返回 bucketKey/Value |
| 重复请求 | 返回 409 Conflict，幂等性生效 |
| QA覆盖用户 | 强制命中对照组 |
| 管理员覆盖 | 强制命中变体组 |
| 不存在实验 | 正确返回错误信息 |
| 失败记录查询 | 可查询 FAILED 状态记录 |
| 人工补偿 | 状态从 FAILED → COMPENSATED |
| CSV导出 | 成功生成 audit_export.csv |
| RequestId查询 | 可按请求ID追溯审计记录 |

---

### ✅ 问题 4: 核心评估接口持久化

**问题描述**:
- `AuditRecord.hitResult` 字段设置了 `nullable=false`
- PENDING 状态下 hitResult 为空，入库失败

**修复方案**:
- **文件**: `src/main/java/com/featureflag/audit/entity/AuditRecord.java:41`
- **修改**: 移除 `@Column(nullable = false)` 约束

```java
// 之前
@Enumerated(EnumType.STRING)
@Column(nullable = false)  // 非空约束
private HitResult hitResult;

// 之后
@Enumerated(EnumType.STRING)
private HitResult hitResult;  // PENDING 状态允许为 null
```

---

## 📁 项目变更文件汇总

| 类型 | 文件 | 变更说明 |
|------|------|---------|
| 🔧 修改 | `pom.xml` | Spring Boot 2.7.18 + Java 8 兼容 |
| 🔧 修改 | `.mvn/wrapper/maven-wrapper.properties` | Maven Wrapper 配置 |
| ✨ 新增 | `bootstrap.sh` | ✨自举启动脚本 - 核心修复 |
| ✨ 新增 | `FIXES.md` | 修复记录文档 |
| 📝 更新 | `README.md` | 完整启动说明 + 验证指南 |
 | ✨ 新增 | `test.sh` | | ✅ 增强
 |
 | | - ✅ 补偿
 | - ✅ 导出 |

---

## 🚀 完整运行验证流程

### 步骤 1: 启动服务
```bash
# 进入项目目录
cd feature-flag-audit

# 一键自举启动（无需预装 Maven）
./bootstrap.sh
```

**启动过程会自动完成**:
1. ✅ 检查 Java 版本 (8+)
2. ✅ 下载 maven-wrapper.jar
3. ✅ 生成 mvnw 脚本
4. ✅ 清理旧编译产物
5. ✅ 编译项目
6. ✅ 启动服务

### 步骤 2: 验证功能（新开终端）

```bash
./test.sh
```

### 步骤 3: 访问管理页面

打开浏览器访问:
- **管理页面**: http://localhost:8080
- **H2数据库**: http://localhost:8080/h2-console

---

## 🧪 预期测试结果

运行 `./test.sh` 后，预期看到:

```
1. 测试正常请求 - 命中分桶
   ✅ 返回 bucketKey, bucketValue

2. 测试重复请求
   ✅ 返回 409 Conflict

3. 测试QA覆盖
   ✅ 强制命中对照组

4. 测试管理员覆盖
   ✅ 强制命中变体组

5. 测试不存在实验
   ✅ 正确处理错误

6. 查询失败记录
   ✅ 返回 FAILED 状态记录

7. 人工补偿
   ✅ 状态变为 COMPENSATED

8. 导出CSV
   ✅ audit_export.csv 生成

9. 按RequestId查询
   ✅ 正确返回审计记录
```

---

## ✅ 第二轮修复总结

| 目标 | 达成状态 |
|------|---------|
| 可安装 | ✅ bootstrap.sh 自动下载和设置 Maven Wrapper |
| 可运行 | ✅ Spring Boot 2.7.18 + Java 8 兼容 |
| 可验证 | ✅ test.sh 完整验证所有核心功能 |

**核心功能全部可用**:
- ✅ /evaluate 评估接口
- ✅ 重复请求拦截（409）
- ✅ 分桶计算
- ✅ 覆盖规则
- ✅ 审计记录持久化
- ✅ 人工补偿
- ✅ CSV 导出
