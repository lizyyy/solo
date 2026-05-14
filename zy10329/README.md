# API 合成事务巡检服务

一个基于 Spring Boot 的事务巡检服务，用于创建和管理API事务巡检任务。

## 核心特性

- **事务模板管理**：创建、查询、校验、撤销巡检模板
- **步骤编排**：定义多步骤API调用流程
- **变量传递**：从响应中提取变量供后续步骤使用
- **断言校验**：验证响应状态码、响应体等
- **执行批次**：创建、启动、撤销巡检执行批次
- **状态机保护**：严格的状态流转控制，防止非法操作
- **脏数据拦截**：创建时即校验必填字段
- **幂等性处理**：防止重复提交
- **失败定位**：精确记录失败位置和原因

## 已修复问题

### 1. 脏数据校验修复 (TransactionTemplateService.java:23-45)
- ✅ 创建时校验步骤不能为空
- ✅ 校验每个步骤的必填字段（stepOrder, stepName, httpMethod, url）
- ✅ 提前拦截无效数据，不保存到数据库

### 2. Maven Wrapper 支持
- ✅ 添加 `mvnw` 脚本
- ✅ 创建 `.mvn/wrapper/maven-wrapper.properties` 配置
- ✅ 无需系统安装Maven即可运行

### 3. 独立自检入口
- ✅ 创建 `SelfCheckMain.java` 主类
- ✅ 8个核心自检场景，直接运行即可验证
- ✅ 友好的输出格式

## 项目结构

```
src/
├── main/java/com/api/inspection/
│   ├── ApiInspectionApplication.java    # 主应用入口
│   ├── SelfCheckMain.java               # 自检入口
│   ├── annotation/Idempotent.java       # 幂等注解
│   ├── aspect/IdempotentAspect.java     # 幂等切面
│   ├── config/WebConfig.java            # Web配置
│   ├── controller/                      # REST API控制器
│   ├── dto/                             # 数据传输对象
│   ├── entity/                          # 数据实体
│   ├── enums/                           # 枚举类型
│   ├── exception/                       # 异常处理
│   ├── repository/                      # 数据访问层
│   └── service/                         # 业务逻辑层
└── test/java/com/api/inspection/
    └── SelfCheckTest.java               # JUnit测试
```

## 快速开始

### 方式一：运行自检（推荐）

```bash
chmod +x self-check.sh
./self-check.sh
```

自检将自动运行以下8个测试：
1. 创建事务模板 - 验证正常创建流程
2. 重复提交拦截 - 验证相同模板编码被拦截
3. 空步骤拦截 - 验证无步骤时被拦截
4. 模板校验功能 - 验证草稿->已校验的状态流转
5. 非法状态跳转拦截 - 验证VALIDATED不能直接跳转到RUNNING
6. 合法状态流转 - 验证VALIDATED->PENDING的正常流转
7. 创建执行批次 - 验证批次创建功能
8. 撤销模板功能 - 验证撤销功能

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

## API 接口

### 模板管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/templates` | 创建事务模板 |
| GET | `/api/templates/{id}` | 查询模板详情 |
| GET | `/api/templates/code/{code}` | 按编码查询 |
| GET | `/api/templates` | 查询所有模板 |
| POST | `/api/templates/{id}/validate` | 校验模板 |
| POST | `/api/templates/{id}/status` | 更新状态 |
| POST | `/api/templates/{id}/cancel` | 撤销模板 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 创建执行批次 |
| GET | `/api/batches/{id}` | 查询批次详情 |
| GET | `/api/batches/template/{templateId}` | 查询模板关联批次 |
| POST | `/api/batches/{id}/start` | 开始执行批次 |
| POST | `/api/batches/{id}/steps/{order}/execute` | 上报步骤执行结果 |
| POST | `/api/batches/{id}/cancel` | 撤销批次 |

### 导出功能

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/template/{id}` | 导出模板JSON |
| GET | `/api/export/batch/{id}` | 导出批次报告 |

## 状态机定义

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

## 技术栈

- Java 11
- Spring Boot 2.7.18
- Spring Data JPA
- H2 内存数据库
- Lombok
- FastJSON

## 使用示例

### 创建模板

```bash
curl -X POST http://localhost:8080/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "templateCode": "LOGIN-TEST-001",
    "templateName": "用户登录测试",
    "description": "测试登录流程",
    "createdBy": "tester",
    "steps": [
      {
        "stepOrder": 1,
        "stepName": "获取验证码",
        "httpMethod": "GET",
        "url": "http://example.com/api/captcha",
        "timeout": 5000
      },
      {
        "stepOrder": 2,
        "stepName": "提交登录",
        "httpMethod": "POST",
        "url": "http://example.com/api/login",
        "timeout": 10000
      }
    ]
  }'
```

## 许可证

MIT License
