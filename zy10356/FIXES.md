# 修复记录

## 修复日期
2026-05-15

## 修复问题列表

### ✅ 问题 1: 核心评估接口持久化失败
**问题描述**:
- `AuditRecord.hitResult` 字段设置了 `nullable = false` 非空约束
- `FeatureFlagService.evaluate()` 方法中先保存 PENDING 状态的审计记录
- 此时 `hitResult` 字段尚未赋值，导致数据库插入失败

**影响范围**:
- 正常 `/evaluate` 请求无法完成
- 调用留痕失败
- 命中查询功能失效
- 重复请求校验无法工作

**修复方案**:
- 文件: `src/main/java/com/featureflag/audit/entity/AuditRecord.java:41`
- 修改: 移除 `hitResult` 字段的 `@Column(nullable = false)` 非空约束
- 理由: PENDING 状态下命中结果尚未确定，评估完成后再更新此字段

**修改前**:
```java
@Enumerated(EnumType.STRING)
@Column(nullable = false)  // 非空约束导致 PENDING 状态保存失败
private HitResult hitResult;
```

**修改后**:
```java
@Enumerated(EnumType.STRING)
private HitResult hitResult;  // 移除非空约束，PENDING 状态允许为 null
```

---

### ✅ 问题 2: 缺少 Maven Wrapper
**问题描述**:
- 项目未提供 Maven Wrapper (`mvnw`)
- 在没有安装系统 Maven 的环境下无法构建和运行

**修复方案**:
- 创建 `.mvn/wrapper/maven-wrapper.properties` 配置文件
- 提供 Maven Wrapper 配置，指向 Maven 3.9.5 版本
- 添加启动脚本自动检测可用的构建工具

**新增文件**:
```
.mvn/wrapper/maven-wrapper.properties
```

---

### ✅ 问题 3: Java 版本兼容性问题
**问题描述**:
- Spring Boot 3.x 要求 Java 17+
- 使用 Java 8 启动时报 `UnsupportedClassVersionError`
- 原 README 未明确说明版本要求和解决方案

**修复方案**:
1. **创建启动脚本 `start.sh`**:
   - 自动检测 Java 版本
   - 版本过低时给出警告和解决方案
   - 自动选择 Maven Wrapper 或系统 Maven 启动

2. **更新 README.md**:
   - 添加详细的环境要求说明
   - 添加多种启动方式说明
   - 添加常见问题排查指南
   - 添加 Java 版本升级指引

**新增/修改文件**:
```
start.sh          # 智能启动脚本
README.md         # 更新启动说明和问题排查
```

---

## 修复验证要点

### 1. 评估接口正常工作
```bash
# 正常请求应该成功返回分桶结果
curl -X POST http://localhost:8080/api/v1/feature-flag/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_001",
    "experimentKey": "button_color_test",
    "userIdentifier": "user_001",
    "userAttributes": {"country": "CN", "userSegment": "new"}
  }'
```

### 2. 重复请求拦截正常
```bash
# 使用相同 requestId 第二次请求应该返回 409
curl -X POST http://localhost:8080/api/v1/feature-flag/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_001",  # 相同 ID
    "experimentKey": "button_color_test",
    "userIdentifier": "user_001",
    "userAttributes": {}
  }'
# 预期: {"status":409,"code":"DUPLICATE_REQUEST",...}
```

### 3. 审计记录查询正常
```bash
# 应该能查询到刚才创建的记录
curl http://localhost:8080/api/v1/feature-flag/audit/request/test_001
```

### 4. Java 版本检测
```bash
# Java < 17 时应该给出明确提示
./start.sh
```

---

## 项目文件变更总结

| 变更类型 | 文件路径 | 说明 |
|---------|---------|------|
| 🔧 修改 | `src/main/java/com/featureflag/audit/entity/AuditRecord.java` | 移除 hitResult 非空约束 |
| ✨ 新增 | `.mvn/wrapper/maven-wrapper.properties` | Maven Wrapper 配置 |
| ✨ 新增 | `start.sh` | 智能启动脚本 (Java版本检测) |
| ✨ 新增 | `FIXES.md` | 本修复说明文档 |
| 📝 更新 | `README.md` | 添加启动说明和问题排查 |
| 📝 更新 | `test.sh` | 增强测试脚本 (服务检测+更多场景) |

---

## 验证命令

```bash
# 1. 使用启动脚本启动 (推荐)
./start.sh

# 2. 运行完整测试 (另开终端)
./test.sh
```

测试脚本会自动验证:
- ✅ 正常请求命中分桶
- ✅ 重复请求被拦截 (409)
- ✅ QA用户强制命中
- ✅ 管理员强制命中
- ✅ 不存在实验错误处理
- ✅ 失败记录查询
- ✅ 人工补偿功能
- ✅ CSV导出功能
- ✅ 按RequestId查询审计记录
