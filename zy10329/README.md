# API 合成事务巡检服务

一个基于 Spring Boot 的事务巡检服务，用于创建和管理API事务巡检任务。

## 核心特性

- **事务模板管理**：创建、查询、校验、撤销巡检模板
- **步骤编排**：定义多步骤API调用流程
- **变量传递**：从响应中提取变量供后续步骤使用
- **断言校验**：验证响应状态码、响应体、JSON Path、Header、响应时间
- **执行批次**：创建、启动、撤销、一键执行巡检批次
- **状态机保护**：严格的状态流转控制，防止非法操作
- **脏数据拦截**：创建时即校验必填字段
- **幂等性处理**：防止重复提交
- **失败定位**：精确记录失败位置和原因
- **批次对比**：对比两个执行批次的结果差异

## 🚀 快速开始（三步完成）

### 第一步：环境配置（只需运行一次）

```bash
chmod +x setup.sh
./setup.sh
```

这个脚本会自动：
1. 检查Java环境（要求JDK 8+）
2. 下载并安装 Maven Wrapper（如果需要）
3. 自动编译项目
4. 设置所有脚本的执行权限

### 第二步：运行自检测试（验证核心功能）

```bash
./self-check.sh
```

自检测试将自动完成以下10项测试：
1. ✅ 创建事务模板
2. ✅ 查询模板详情
3. ✅ 校验模板（草稿→已校验）
4. ✅ 创建执行批次（必须模板已校验才能创建）
5. ✅ 启动批次执行
6. ✅ 一键执行所有步骤（真实HTTP API调用）
7. ✅ 变量提取验证
8. ✅ 断言执行验证
9. ✅ 批次对比功能
10. ✅ 查询批次详情

### 第三步：启动完整服务（可选）

```bash
./start.sh
# 或
./mvnw spring-boot:run
```

服务启动后：
- 服务地址: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:inspection`
  - 用户名: `sa`
  - 密码: (空)

## 📖 状态机流程（必须遵守）

```
创建模板 → DRAFT(草稿)
    ↓ 校验
VALIDATED(已校验) ← 必须达到此状态才能创建批次！
    ↓ 自动流转(可选)
PENDING(待执行)
    ↓ 启动
RUNNING(执行中)
    ↓ 完成
SUCCESS(成功) / FAILED(失败)

任意状态 ↓ 撤销
CANCELLED(已撤销) - 最终状态，不可恢复
```

## 📡 API 接口列表

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建事务模板 |
| GET | `/api/templates/{id}` | 查询模板详情 |
| GET | `/api/templates/code/{code}` | 按编码查询 |
| GET | `/api/templates` | 查询所有模板 |
| POST | `/api/templates/{id}/validate` | 校验模板（DRAFT→VALIDATED） |
| POST | `/api/templates/{id}/cancel` | 撤销模板 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches?templateId={id}&executedBy={name}` | 创建执行批次（模板必须是 VALIDATED） |
| GET | `/api/batches/{id}` | 查询批次详情 |
| GET | `/api/batches/template/{templateId}` | 查询模板所有批次 |
| POST | `/api/batches/{id}/start` | 启动批次（PENDING→RUNNING） |
| POST | `/api/batches/{id}/steps/{order}/execute` | 执行单个步骤 |
| POST | `/api/batches/{id}/execute-all` | 一键执行所有步骤（自动start+执行） |
| GET | `/api/batches/compare?batchId1={id1}&batchId2={id2}` | 批次对比（必须同一模板） |
| POST | `/api/batches/{id}/cancel` | 撤销批次 |

### 导出功能

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/template/{id}` | 导出模板JSON |
| GET | `/api/export/batch/{id}` | 导出批次报告 |

### Mock API（内置测试用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/mock/health` | 健康检查 |
| GET | `/mock/captcha` | 获取验证码(返回captchaId) |
| POST | `/mock/login` | 用户登录(需captchaId，返回token) |
| GET | `/mock/user/info` | 获取用户信息(需Authorization header) |
| GET | `/mock/delay/{ms}` | 延迟响应 |
| GET | `/mock/error/{code}` | 指定错误码响应 |

## 🔧 技术栈

- Java 8
- Spring Boot 2.7.18
- Spring Data JPA
- H2 内存数据库
- Lombok
- FastJSON
- RestTemplate (HTTP客户端)

## 📁 项目结构

```
src/main/java/com/api/inspection/
├── ApiInspectionApplication.java    # 主应用入口
├── SelfCheckMain.java               # 自检入口
├── annotation/
│   └── Idempotent.java            # 幂等注解
├── aspect/
│   └── IdempotentAspect.java      # 幂等切面
├── config/
│   └── WebConfig.java             # Web配置
├── controller/
│   ├── TransactionTemplateController.java
│   ├── ExecutionBatchController.java
│   ├── ExportController.java
│   └── MockApiController.java       # 模拟API用于测试
├── dto/
│   ├── ApiResponse.java
│   ├── CreateTemplateRequest.java
│   ├── StepRequest.java
│   ├── VariableExtractRequest.java
│   └── AssertionRequest.java
├── entity/
│   ├── TransactionTemplate.java
│   ├── TransactionStep.java
│   ├── VariableExtract.java
│   ├── AssertionRule.java
│   ├── ExecutionBatch.java
│   ├── StepExecution.java
│   ├── AssertionResult.java
│   └── FailureLocation.java
├── enums/
│   ├── TransactionStatus.java
│   └── AssertionType.java
├── exception/
│   ├── BusinessException.java
│   └── GlobalExceptionHandler.java
├── repository/
│   ├── TransactionTemplateRepository.java
│   └── ExecutionBatchRepository.java
└── service/
    ├── TransactionTemplateService.java
    ├── ExecutionBatchService.java
    └── HttpExecuteEngine.java       # HTTP执行引擎
```

## 📋 脚本说明

| 脚本 | 说明 |
|------|------|
| `setup.sh` | 环境配置脚本（只需运行一次） |
| `self-check.sh` | 自检测试脚本（验证所有核心功能） |
| `start.sh` | 启动完整服务 |
| `mvnw` | Maven Wrapper 脚本 |

## 📄 许可证

MIT License
