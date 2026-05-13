# 设备命令确认 API

## 项目概述

这是一个设备命令确认系统，提供完整的设备命令下发、执行确认、超时处理、自动补发、链路追踪的全生命周期管理。

## 核心特性

- **命令生命周期管理**: 创建 -> 校验 -> 下发 -> 确认 -> 完成
- **超时自动补发**: 超过确认时间自动重试，可配置重试次数
- **状态历史追踪**: 记录每次状态变更，支持完整链路查询
- **幂等性保障**: 重复提交不会产生脏数据
- **持久化存储**: 使用 H2 数据库，数据文件持久化，重启不丢失

## 技术栈

- Java 11
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database
- Lombok

## 快速开始

### 1. 编译项目

```bash
mvn clean package
```

### 2. 启动服务

```bash
java -jar target/device-command-confirmation-api-1.0.0.jar
```

服务启动后访问: http://localhost:8080

### 3. 访问 H2 控制台

http://localhost:8080/h2-console

- JDBC URL: `jdbc:h2:file:./data/devicedb
- 用户名: `sa`
- 密码: (空)

## API 接口

### 命令创建

```bash
POST /api/commands/create
Content-Type: application/json

{
  "batchNo": "BATCH001",
  "commandCode": "REBOOT",
  "commandName": "重启设备",
  "deviceId": 1,
  "deviceCode": "DEV001",
  "channelId": 1,
  "channelCode": "MQTT001",
  "timeoutSeconds": 300,
  "maxRetryCount": 3,
  "handler": "admin"
}
```

### 命令校验

```bash
POST /api/commands/validate/{batchNo}
```

### 命令下发

```bash
POST /api/commands/dispatch/{batchNo}
```

### 命令确认

```bash
POST /api/commands/confirm
Content-Type: application/json

{
  "batchNo": "BATCH001",
  "confirmResult": "SUCCESS",
  "resultCode": "0000",
  "resultMessage": "执行成功",
  "confirmSource": "DEVICE_REPORT",
  "handler": "system"
}
```

### 查询命令详情

```bash
GET /api/commands/{batchNo}
```

### 查询状态历史

```bash
GET /api/commands/{batchNo}/status-history
```

### 查询完整链路

```bash
GET /api/commands/{batchNo}/full-trace
```

返回包含:
- command: 命令基本信息
- statusHistory: 状态变更历史
- confirmRecords: 确认记录
- retryRecords: 补发记录
- timeoutReasons: 超时原因

## 命令状态流转

```
CREATED (已创建)
    ↓
VALIDATED (已校验)
    ↓
CONFIRMING (等待确认)
    ↓ ↓
    ↓ SUCCESS/FAILED → 终态
    ↓
TIMEOUT (超时)
    ↓
RETRYING (补发中) → 循环直到达到最大重试次数
```

## 数据模型

### CommandBatch (命令批次)
- 批次号、命令编码、设备信息
- 状态、超时配置
- 下发时间、确认时间
- 最终结论、处理人
- 乐观锁版本号

### CommandStatusHistory (状态历史)
- 批次关联、前后状态
- 变更原因、变更时间、处理人

### ExecutionConfirm (执行确认)
- 确认编号、确认结果
- 结果码、结果消息
- 确认来源、确认时间

### RetryRecord (补发记录)
- 补发编号、补发次数
- 补发原因、补发时间

### TimeoutReason (超时原因)
- 超时类型、原因编码
- 原因描述、详情信息

## 测试用例

项目包含4个核心测试场景：

1. **成功流测试** (`testSuccessFlow`): 正常创建-校验-下发-确认流程
2. **超时补发流测试** (`testTimeoutRetryFlow`): 超时后自动补发，直到最大重试次数
3. **幂等性测试** (`testIdempotentCreate`): 重复创建返回相同批次号，保证数据一致性
4. **失败流测试** (`testFailedFlow`): 确认失败场景

运行测试：
```bash
mvn test
```

## 核心设计要点

1. **幂等性处理**：通过 batchNo 唯一约束，重复提交返回已有记录
2. **状态机校验**：每个状态变更都有前置状态校验，非法状态流转被拒绝
3. **乐观锁机制**：使用 @Version 防止并发更新冲突
4. **定时任务**：每10秒扫描超时命令，自动触发补发
5. **全链路追踪**：所有操作记录处理人，支持审计追溯

## 配置说明

`application.yml` 主要配置项：

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:h2:file:./data/devicedb  # 数据文件持久化
  jpa:
    hibernate:
      ddl-auto: update  # 自动更新表结构
```

## 目录结构

```
src/main/java/com/devicecommand/
├── DeviceCommandApplication.java    # 启动类
├── controller/                       # 控制层
├── service/                          # 业务逻辑层
├── repository/                     # 数据访问层
├── entity/                         # 数据实体
├── dto/                            # 数据传输对象
├── enums/                          # 枚举定义
├── config/                         # 配置类
├── scheduler/                      # 定时任务
└── exception/                      # 异常处理
```
