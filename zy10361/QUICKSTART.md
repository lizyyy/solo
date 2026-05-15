# 🚀 快速开始指南 - 第三轮最终版

## ✅ 解决的核心问题

| 问题 | 解决方案 |
|------|---------|
| `UnsupportedClassVersionError: 55.0` | **强制清理旧 class** + 用 `-source 1.8 -target 1.8` 重新编译 |
| 环境没有 Maven | **完全不依赖 Maven**，直接用 javac/java 命令 |
| 没有依赖 jar | 自动从 Maven 中央仓库下载所有依赖到 lib 目录 |
| Lombok 注解问题 | 脚本自动移除所有 Lombok 注解，生成纯 Java 代码 |

---

## 🎯 只需两步，零配置启动

### 第一步：赋予脚本执行权限
```bash
chmod +x *.sh
```

### 第二步：运行一键启动脚本 ⭐
```bash
./one-click-start.sh
```

**就是这么简单！** 脚本会自动完成所有 7 个步骤：

| 步骤 | 说明 |
|------|------|
| 🔍 1 | 检查 Java 环境（JDK 8+） |
| 🧹 2 | **强制清理旧的 class 文件**（关键！解决 version 55 问题） |
| 🔧 3 | 移除 Lombok 注解，生成纯 Java getter/setter |
| 📦 4 | 自动下载 ~40 个 Spring Boot 运行依赖到 lib 目录 |
| 🔨 5 | 用 **Java 8 兼容模式** 编译所有源码 |
| 🔍 6 | 验证 class 文件版本（确保是 52 = Java 8） |
| 🚀 7 | 启动 Spring Boot 服务 |

等待看到以下日志表示启动成功：
```
Started CompensationApplication in X.XXX seconds
Tomcat started on port(s): 8080 (http)
```

---

### 第三步：打开另一个终端，运行完整测试
```bash
./test-full.sh
```

这个测试会自动验证所有验收要点：

✅ **幂等性** - 重复创建、重复执行不产生脏数据  
✅ **顺序控制** - 乱序执行被拦截，明确提示前序依赖  
✅ **失败原因** - 状态错误、前序依赖都有清晰错误信息  
✅ **重试机制** - 失败后自动重试，达到阈值标记 FAILED  
✅ **历史查询** - 可查询所有流程状态和执行统计  
✅ **导出一致性** - 两次导出结果完全一致  

---

## 📁 新增的核心脚本说明

| 脚本 | 功能 |
|------|------|
| `one-click-start.sh` ⭐ | **终极一键启动脚本** - 什么都不用管，直接运行 |
| `download-deps.sh` | 纯 curl/wget 下载所有 Spring Boot 依赖 jar，不依赖 Maven |
| `compile.sh` | 纯 javac 编译，强制 Java 8 模式，自动清理旧 class |
| `run-standalone.sh` | 独立启动脚本，只用 java 命令运行 |
| `remove-lombok.sh` | 移除所有 Lombok 注解，生成纯 Java 代码 |

---

## 🧪 手动测试（可选）

服务启动后（端口 8080）：

#### 1. 创建补偿流程
```bash
curl -X POST http://localhost:8080/api/v1/compensation \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json
```

#### 2. 启动补偿
```bash
curl -X POST http://localhost:8080/api/v1/compensation/ORDER-TEST-001/start
```

#### 3. 获取下一条可执行指令
```bash
curl http://localhost:8080/api/v1/compensation/ORDER-TEST-001/next
```

#### 4. 执行指令（成功）
```bash
curl -X POST http://localhost:8080/api/v1/compensation/instruction/INST-ORDER-TEST-001-1/execute \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-001","executor":"tester"}'
```

#### 5. 执行指令（强制失败，测试重试）
```bash
curl -X POST http://localhost:8080/api/v1/compensation/instruction/INST-ORDER-TEST-001-3/execute \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-003","executor":"tester","forceFail":true}'
```

#### 6. 查询历史记录
```bash
curl http://localhost:8080/api/v1/compensation/history
```

#### 7. 导出执行报告
```bash
curl http://localhost:8080/api/v1/compensation/ORDER-TEST-001/export
```

---

## 🔍 验证 class 版本（确保 Java 8 兼容）

启动脚本会自动验证，你也可以手动验证：
```bash
# 查看 class 文件的主版本号
# Java 8 = 52, Java 11 = 55
od -An -j7 -N1 -tu1 target/classes/com/compensation/CompensationApplication.class
```

预期输出：`52`

---

## ❓ 常见问题

### Q: 启动时提示 "Permission denied"
A: 执行 `chmod +x *.sh` 赋予脚本执行权限

### Q: 下载依赖慢
A: 这是正常的，首次需要下载 ~40 个 Spring Boot 依赖，之后会复用

### Q: 8080 端口被占用
A: 修改 `src/main/resources/application.yml` 中的 `server.port`

### Q: 如何停止服务
A: 按 `Ctrl + C` 停止启动脚本中的服务

### Q: 想重新开始
A: 重新运行 `./one-click-start.sh`，它会自动清理和重新编译

---

## 🎓 技术细节

### 为什么不依赖 Maven 也能运行？
- 所有依赖 jar 直接从 Maven 中央仓库下载到 `lib/` 目录
- 用原生 `javac` 命令加 `-source 1.8 -target 1.8` 编译
- 用原生 `java -cp` 命令直接启动 Spring Boot
- 完全不依赖任何构建工具

### 如何保证 Java 8 兼容？
- 强制清理旧的 class 文件
- 编译时显式指定 `-source 1.8 -target 1.8`
- 启动前验证 class 文件版本号

---

## 📋 API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/compensation` | 创建补偿流程 |
| GET | `/api/v1/compensation/{processId}` | 查看流程详情 |
| POST | `/api/v1/compensation/{processId}/start` | 启动补偿流程 |
| POST | `/api/v1/compensation/instruction/{id}/confirm` | 人工确认指令 |
| POST | `/api/v1/compensation/instruction/{id}/execute` | 执行补偿指令 |
| GET | `/api/v1/compensation/{processId}/next` | 获取下一条可执行指令 |
| GET | `/api/v1/compensation/history` | 查询历史记录 |
| GET | `/api/v1/compensation/{processId}/export` | 导出执行报告 |

---

## ✅ 验收验证清单

运行 `./test-full.sh` 后，检查以下输出：

1. ✅ 创建补偿流程 - 返回 code: 200
2. ✅ 幂等性测试 - 重复创建不报错
3. ✅ 启动补偿 - 状态流转正确
4. ✅ 获取下一条指令 - 只返回顺序 1 的指令
5. ✅ 顺序控制 - 跳步执行返回错误，明确提示前序依赖
6. ✅ 人工确认 - 状态从 WAITING 变为 PENDING
7. ✅ 指令执行 - 成功执行，幂等性正确
8. ✅ 重试机制 - 连续 3 次失败后状态变为 FAILED
9. ✅ 历史查询 - 能查询到所有流程
10. ✅ 导出一致性 - 两次导出结果完全相同

---

**现在就试试：** `./one-click-start.sh` 🚀
