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
- **批次对比**：对比两个执行结果对比功能

## ✅ 第三轮修复完成

### 已修复问题

1. **核心巡检能力**
   - 新增 `HttpExecuteEngine` HTTP 调用引擎
   - 自动提取变量功能
   - 自动执行断言功能
   - 失败定位功能

2. **一键执行功能
   - `executeAllSteps - 一键执行批次所有步骤
   - 自动状态机流转控制
   - 失败中断机制

3. **批次对比功能
   - `compareBatches` - 同一模板两个批次对比

4. **Java 版本兼容性
   - 调整为 Java 8 兼容

5. **自检脚本
   - 真实 API 调用测试
   - 完整流程验证

## 🚀 快速开始

### 方式一：一键运行自检测试（推荐）

```bash
# 1. 设置脚本执行权限
chmod +x setup.sh self-check.sh mvnw

# 2. 配置环境（自动下载 maven-wrapper.jar）
./setup.sh

# 3. 运行自检测试
./self-check.sh
```

自检测试将自动完成：
1. 模板管理测试（创建、校验）
2. 批次执行测试（真实HTTP API调用）
3. 变量提取与传递测试
4. 断言执行测试
5. 批次对比功能测试
6. 查询功能测试

### 方式二：启动完整服务

```bash
./mvnw spring-boot:run
```

服务启动后：
- 基础URL: http://localhost:8080
- H2控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:inspection`
  - 用户名: `sa`
  - 密码: (空)

### 方式三：打包运行

```bash
./mvnw package
java -jar target/api-transaction-inspection-1.0.0.jar
```

## 📡 API 接口列表

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建事务模板 |
| GET | `/api/templates/{id}` | 查询模板详情 |
| GET | `/api/templates/code/{code}` | 按编码查询 |
| GET | `/api/templates` | 查询所有模板 |
| POST | `/api/templates/{id}/validate` | 校验模板 |
| POST | `/api/templates/{id}/cancel` | 撤销模板 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 创建执行批次 |
| GET | `/api/batches/{id}` | 查询批次详情 |
| GET | `/api/batches/template/{templateId}` | 查询模板关联批次 |
| POST | `/api/batches/{id}/start` | 启动批次 |
| POST | `/api/batches/{id}/steps/{order}/execute` | 执行单个步骤 |
| POST | `/api/batches/{id}/execute-all` | 一键执行所有步骤 |
| GET | `/api/batches/compare?batchId1={id1}&batchId2={id2}` | 批次对比 |
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

## 🔄 状态机定义

```
DRAFT(草稿)
  ↓ VALIDATE
VALIDATED(已校验)
  ↓ PENDING        ↘ CANCEL
PENDING(待执行)
  ↓ START          ↘ CANCEL
RUNNING(执行中)
  ↓ SUCCESS/FAILED ↘ CANCEL
SUCCESS(成功) / FAILED(失败)

CANCELLED(已撤销) - 最终状态
```

## 📝 使用示例

### 创建模板并执行批次

```bash
# 1. 创建模板
curl -X POST http://localhost:8080/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateCode": "LOGIN-TEST-001",
    "templateName": "用户登录测试",
    "createdBy": "tester",
    "steps": [
      {
        "stepOrder": 1,
        "stepName": "获取验证码",
        "httpMethod": "GET",
        "url": "http://localhost:8080/mock/captcha",
        "variableExtracts": [
          {"variableName": "captchaId", "extractExpression": "$.data.captchaId", "sourceType": "RESPONSE_BODY"}
        ],
        "assertions": [
          {"assertionType": "STATUS_CODE", "expectedValue": "200", "enabled": true}
        ]
      },
      {
        "stepOrder": 2,
        "stepName": "用户登录",
        "httpMethod": "POST",
        "url": "http://localhost:8080/mock/login",
        "body": "{\"username\":\"demo\",\"password\":\"123456\",\"captchaId\":\"${captchaId}\"}",
        "variableExtracts": [
          {"variableName": "token", "extractExpression": "$.data.token", "sourceType": "RESPONSE_BODY"}
        ],
        "assertions": [
          {"assertionType": "STATUS_CODE", "expectedValue": "200", "enabled": true},
          {"assertionType": "JSON_PATH", "expression": "$.data.username", "expectedValue": "demo", "enabled": true}
        ]
      }
    ]
  }'

# 2. 校验模板
curl -X POST http://localhost:8080/api/templates/{templateId}/validate

# 3. 创建批次
curl -X POST "http://localhost:8080/api/batches?templateId={templateId}&executedBy=tester"

# 4. 一键执行所有步骤
curl -X POST http://localhost:8080/api/batches/{batchId}/execute-all

# 5. 查看执行结果
curl http://localhost:8080/api/batches/{batchId}

# 6. 创建第二个批次并对比
curl -X POST "http://localhost:8080/api/batches?templateId={templateId}&executedBy=tester"
curl -X POST http://localhost:8080/api/batches/{batchId2}/execute-all
curl "http://localhost:8080/api/batches/compare?batchId1={batchId1}&batchId2={batchId2}
```

## 🛠 技术栈

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

## 📄 许可证

MIT License
