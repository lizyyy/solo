# 兼容性变更说明

## 第二轮修复 (2026-05-16)

### 新增修复的问题

#### 5. Optional.orElseThrow() Java 8 不兼容
**问题**: `VerificationService.java:33` 使用了无参的 `orElseThrow()`，这是 Java 10+ 才支持的语法
```java
// Java 10+ 才支持
VerificationTask existingTask = taskRepository.findByRequestId(requestId).orElseThrow();
```

**修复**: 添加 Supplier 参数，改为 Java 8 兼容的写法：
```java
// Java 8 兼容
VerificationTask existingTask = taskRepository.findByRequestId(requestId)
        .orElseThrow(() -> new RuntimeException("校验任务不存在"));
```

**影响文件**:
- `src/main/java/com/identity/verification/service/VerificationService.java`

#### 6. 缺少 Maven 环境
**问题**: 当前环境没有安装 `mvn` 命令，项目也没有 `mvnw` 或 `target/*.jar`

**修复**:
- 添加 Maven Wrapper 脚本：
  - `mvnw` (Linux/macOS)
  - `mvnw.cmd` (Windows)
  - `.mvn/wrapper/maven-wrapper.properties`
- 脚本特性：
  - 优先使用系统已安装的 Maven
  - 如无系统 Maven，自动下载 Maven Wrapper JAR (~60KB)
  - 支持 curl 和 wget 两种下载方式

**新增文件**:
- `mvnw` (可执行 shell 脚本)
- `mvnw.cmd` (Windows 批处理脚本)
- `.mvn/wrapper/maven-wrapper.properties`

---

## 第一轮修复 (2026-05-15)

### 问题修复摘要

#### 1. Java 版本降级
**问题**: 原 pom.xml 要求 Java 17，但系统只有 Java 1.8
**修复**: 
- `pom.xml` 中 Java 版本降级为 1.8
- Spring Boot 版本从 3.2.0 降级为 2.7.18

### 2. Jakarta EE → Java EE 包名变更
**问题**: Spring Boot 3.x 使用 jakarta.* 包名，而 2.x 使用 javax.*
**修复**: 所有文件中的包名替换：
- `jakarta.persistence.*` → `javax.persistence.*`
- `jakarta.validation.*` → `javax.validation.*`

### 3. null 分组键问题
**问题**: `birthDate/address/phoneNumber/email` 等可选字段为 null 时，`Collectors.groupingBy` 会抛出 NullPointerException
**修复**: `VerificationService.getFieldValue()` 方法中添加 null 值处理：
```java
// 原代码 (switch 表达式 Java 12+)
private String getFieldValue(PersonIdentifier identifier, String field) {
    return switch (field) {
        case "name" -> identifier.getName();
        // ...
        default -> "";
    };
}

// 修复后 (Java 8 兼容 switch 语句 + null 处理)
private String getFieldValue(PersonIdentifier identifier, String field) {
    String value;
    switch (field) {
        case "name": value = identifier.getName(); break;
        // ...
        default: value = "";
    }
    return value != null ? value : "";
}
```

### 4. HTTP 409 状态码问题
**问题**: 原实现只在 ApiResponse.body 中设置 code=409，但 HTTP 响应状态码仍是 200
**修复**: 
- `ApiResponse` 类添加 `ResponseEntity` 包装的静态方法：
  - `successEntity(data)`: 返回 HTTP 200
  - `errorEntity(code, message)`: 返回指定 HTTP 状态码
  - `duplicateRequestEntity(data)`: 返回 HTTP 409 Conflict
- 所有 Controller 和 Service 方法返回类型改为 `ResponseEntity<ApiResponse<T>>`
- `GlobalExceptionHandler` 也改为返回 `ResponseEntity`

## 受影响的文件清单

### 配置文件
- `pom.xml` - Java 和 Spring Boot 版本降级

### 实体类
- `src/main/java/com/identity/verification/model/IdentitySource.java`
- `src/main/java/com/identity/verification/model/PersonIdentifier.java`
- `src/main/java/com/identity/verification/model/ConflictField.java`
- `src/main/java/com/identity/verification/model/MergeSuggestion.java`
- `src/main/java/com/identity/verification/model/ConfirmationRecord.java`
- `src/main/java/com/identity/verification/model/VerificationTask.java`

### DTO 类
- `src/main/java/com/identity/verification/dto/CreateVerificationRequest.java`
- `src/main/java/com/identity/verification/dto/AdvanceRequest.java`
- `src/main/java/com/identity/verification/dto/ApiResponse.java` - 新增 ResponseEntity 方法

### Service 层
- `src/main/java/com/identity/verification/service/VerificationService.java`
  - getFieldValue null 处理
  - 所有返回类型改为 ResponseEntity
- `src/main/java/com/identity/verification/service/ExportService.java`
  - getExportData 返回类型改为 ResponseEntity

### Controller 层
- `src/main/java/com/identity/verification/controller/VerificationController.java`
  - 所有返回类型改为 ResponseEntity
- `src/main/java/com/identity/verification/controller/ExportController.java`
  - getExportData 返回类型改为 ResponseEntity

### 异常处理
- `src/main/java/com/identity/verification/exception/GlobalExceptionHandler.java`
  - 移除 @ResponseStatus 注解
  - 返回类型改为 ResponseEntity

## 编译验证

确保项目可以通过编译：
```bash
mvn clean compile -DskipTests
```

项目应该能够：
- 在 Java 8 环境下正常编译
- 启动后所有接口返回正确的 HTTP 状态码
- 重复请求返回 HTTP 409
- 可选字段为空时不会抛出 NullPointerException
