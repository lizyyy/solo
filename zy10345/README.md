# 设备命令确认 API

## 项目概述

这是一个设备命令确认系统，提供完整的设备命令下发、执行确认、超时处理、自动补发、链路追踪的全生命周期管理。

## 核心特性

- **命令生命周期管理**: 创建 → 校验 → 下发 → 确认 → 完成
- **超时自动补发**: 超过确认时间自动重试，可配置重试次数
- **状态历史追踪**: 记录每次状态变更，支持完整链路查询
- **幂等性保障**: 重复提交不会产生脏数据
- **持久化存储**: 使用 H2 文件数据库，重启服务数据不丢失

## 技术栈

- Java 8+ (兼容 JRE，无需 JDK)
- Spring Boot 2.7.x
- Spring Data JPA
- H2 Database (文件持久化)
- Lombok

## 快速开始

### 🚀 方案一：一键启动（推荐）

**macOS/Linux:**
```bash
chmod +x start.sh test-api.sh
./start.sh
```

**Windows:**
双击 `start.bat` 或在命令行执行：
```cmd
start.bat
```

脚本自动完成：
1. ✅ 检查 Java 8+ 环境
2. ✅ 自动下载 Maven（无需预装）
3. ✅ 编译项目
4. ✅ 启动 API 服务

### 💻 方案二：纯 JRE 启动（无需 JDK/Maven）

```bash
chmod +x run.sh
./run.sh
```

此方案使用 Eclipse ECJ 编译器，仅需 JRE 即可运行。

### 🔧 方案三：手动编译（有 Maven 环境）

```bash
mvn clean package -DskipTests
java -jar target/device-command-confirmation-api-1.0.0.jar
```

## 服务访问

启动成功后：
- **API 服务**: http://localhost:8080
- **H2 数据库控制台**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/devicedb`
  - 用户名: `sa`
  - 密码: (空)

## 功能验证

服务启动后，新开终端执行测试：

**macOS/Linux:**
```bash
./test-api.sh
```

自动验证以下场景：
1. ✅ **成功流**：创建 → 校验 → 下发 → 确认执行成功
2. ✅ **失败流**：确认执行失败，状态正确流转
3. ✅ **幂等性**：重复创建相同批次号，返回原有数据
4. ✅ **按设备查询**：查询某设备的所有命令记录
5. ✅ **完整链路**：查询单条命令的所有状态变更历史、确认记录等

## 持久化验证

重启服务后数据不会丢失，再次查询验证：
```bash
curl http://localhost:8080/api/commands/{batchNo}/full-trace
```

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

返回包含：
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

## 核心设计要点

1. **幂等性处理**：通过 batchNo 唯一约束，重复提交返回已有记录
2. **状态机校验**：每个状态变更都有前置状态校验，非法状态流转被拒绝
3. **乐观锁机制**：使用 @Version 防止并发更新冲突
4. **定时任务**：每 10 秒扫描超时命令，自动触发补发
5. **全链路追踪**：所有操作记录处理人，支持审计追溯

## 项目结构

```
src/main/java/com/devicecommand/
├── DeviceCommandApplication.java    # 启动类
├── controller/                       # 控制层
├── service/                          # 业务逻辑层
├── repository/                       # 数据访问层
├── entity/                           # 数据实体
├── dto/                              # 数据传输对象
├── enums/                            # 枚举定义
├── config/                           # 配置类
├── scheduler/                        # 定时任务
└── exception/                        # 异常处理
```
