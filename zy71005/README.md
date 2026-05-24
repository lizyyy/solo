# 牙套印模返工 API 系统

## 项目介绍

本系统是一套完整的牙套印模返工流程管理 API，解决传统返工流程中的三大痛点：

1. **重复返工**：通过状态机严格控制流程走向，防止同一环节重复操作
2. **医生确认超时**：完整的审计日志记录每个操作时间，便于追踪超时原因
3. **快递丢件标记**：支持在寄出后标记快递丢失，避免流程卡死

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Spring Boot | 3.2.5 | 核心框架 |
| Spring Data JPA | 3.2.5 | ORM 数据访问 |
| H2 Database | 2.2.x | 内存数据库 |
| Lombok | 最新 | 简化代码 |
| Validation | 3.0.x | 参数校验 |

## 快速开始

### 启动项目

使用 Maven Wrapper（推荐）：
```bash
# 编译打包
./mvnw clean package

# 运行
java -jar target/rework-api-1.0.0.jar

# 或使用 Maven 直接运行
./mvnw spring-boot:run
```

使用系统 Maven：
```bash
# 编译打包
mvn clean package

# 运行
java -jar target/rework-api-1.0.0.jar

# 或使用 Maven 直接运行
mvn spring-boot:run
```

### 健康检查

```bash
curl http://localhost:8080/health
```

返回示例：
```json
{
  "status": "UP",
  "timestamp": "2024-01-15T10:30:00"
}
```

### H2 控制台

访问地址：`http://localhost:8080/h2-console`

- JDBC URL: `jdbc:h2:mem:reworkdb`
- 用户名: `sa`
- 密码: (空)

## 状态机流程图

```
┌─────────────────┐
│    CREATED      │  已创建
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    RECEIVED     │  已收件
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    INSPECTED    │  已核验
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PROCESSING    │  处理中
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DOCTOR_CONFIRMED│  医生已确认
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    REVIEWED     │  已复查
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    SHIPPED      │  已寄出
└───────┬─────────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
┌─────────┐ ┌─────────┐
│ CLOSED  │ │  LOST   │  快递丢失
└─────────┘ └─────────┘
  已结案
```

状态说明：

| 状态 | 说明 | 可转换至 |
|------|------|----------|
| `CREATED` | 已创建 | RECEIVED |
| `RECEIVED` | 已收件 | INSPECTED |
| `INSPECTED` | 已核验 | PROCESSING |
| `PROCESSING` | 处理中 | DOCTOR_CONFIRMED |
| `DOCTOR_CONFIRMED` | 医生已确认 | REVIEWED, SHIPPED |
| `REVIEWED` | 已复查 | SHIPPED, CLOSED |
| `SHIPPED` | 已寄出 | CLOSED, LOST |
| `CLOSED` | 已结案 | - |
| `LOST` | 快递丢失 | - |

## 造数说明

项目启动时 `DataInitializer` 会自动创建以下测试数据：

### 患者数据
| 患者编号 | 姓名 | 电话 |
|----------|------|------|
| P001 | 张三 | 13800138000 |
| P002 | 李四 | 13900139000 |

### 批次数据
| 批次号 | 所属患者 | 说明 |
|--------|----------|------|
| BATCH-001 | 张三 | 正畸牙模批次1 |
| BATCH-002 | 李四 | 正畸牙模批次2 |

### 返工单数据
| 工单号 | 批次 | 当前状态 | 返工原因 | 技师备注 |
|--------|------|----------|----------|----------|
| RW1001 | BATCH-001 | CREATED | 牙模边缘不清晰 | - |
| RW1002 | BATCH-002 | INSPECTED | 咬合关系不准确 | 正在检查中... |

## 完整 Curl 示例

### 1. 创建返工单

```bash
curl -X POST http://localhost:8080/api/rework/create \
  -H "Content-Type: application/json" \
  -d '{
    "patientNo": "P003",
    "patientName": "王五",
    "patientPhone": "13700137000",
    "doctorName": "王医生",
    "batchNo": "BATCH-003",
    "impressionType": "正畸牙模",
    "reworkReason": "牙模变形",
    "operator": "admin"
  }'
```

### 2. 收件登记

```bash
curl -X POST http://localhost:8080/api/rework/receive \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "receivedBy": "factory_receiver",
    "remark": "包装完好，已签收"
  }'
```

### 3. 到件核验

```bash
curl -X POST http://localhost:8080/api/rework/inspect \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "inspectionResult": "牙模完整，无破损",
    "inspectionRemark": "符合返工要求，可进行下一步处理",
    "inspectionBy": "inspector_wang"
  }'
```

### 4. 添加技师备注

```bash
curl -X POST http://localhost:8080/api/rework/technician-note \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "technicianNote": "牙模边缘需要重新打磨，建议重新取模",
    "technicianName": "tech_zhang"
  }'
```

### 5. 医生确认

```bash
curl -X POST http://localhost:8080/api/rework/doctor-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "doctorConfirmation": "同意返工方案，请按方案执行",
    "doctorName": "dr_li"
  }'
```

### 6. 复查

```bash
curl -X POST http://localhost:8080/api/rework/review \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "reviewResult": "复查通过，符合质量要求",
    "reviewBy": "reviewer_zhao"
  }'
```

### 7. 寄出

```bash
curl -X POST http://localhost:8080/api/rework/ship \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "expressNo": "SF1234567890",
    "expressCompany": "顺丰速运",
    "shippedBy": "admin",
    "receiver": "诊所A",
    "receiverPhone": "13800138000"
  }'
```

### 8. 结案

```bash
curl -X POST http://localhost:8080/api/rework/close \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "closeReason": "返工完成，患者已确认收到",
    "closedBy": "admin"
  }'
```

### 9. 标记丢失

```bash
curl -X POST http://localhost:8080/api/rework/mark-lost \
  -H "Content-Type: application/json" \
  -d '{
    "expressNo": "SF1234567890",
    "lostRemark": "快递超过7天未更新，确认丢失",
    "operator": "admin"
  }'
```

### 10. 查询详情

```bash
curl http://localhost:8080/api/rework/RW-XXXXXXXX
```

**查询所有返工单：**
```bash
curl http://localhost:8080/api/rework/list
```

**按状态查询返工单：**
```bash
curl "http://localhost:8080/api/rework/list?status=PROCESSING"
```

## 失败路径演示

### 场景1：重复操作拦截

**问题：** 在已完成医生确认后再次调用医生确认接口

```bash
curl -X POST http://localhost:8080/api/rework/doctor-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "doctorConfirmation": "再次确认",
    "doctorName": "dr_li"
  }'
```

**返回：**
```json
{
  "code": 200,
  "message": "该返工单已完成医生确认，重复操作已记录",
  "data": { ... }
}
```

### 场景2：状态非法转换

**问题：** 在 `CREATED` 状态直接尝试寄出

```bash
curl -X POST http://localhost:8080/api/rework/ship \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "expressNo": "SF1234567890",
    "expressCompany": "顺丰速运",
    "shippedBy": "admin"
  }'
```

**返回：**
```json
{
  "code": 400,
  "message": "状态转换不允许",
  "data": "Invalid status transition from CREATED to SHIPPED"
}
```

### 场景3：终态无法继续操作

**问题：** `CLOSED` 或 `LOST` 状态后继续操作

```bash
curl -X POST http://localhost:8080/api/rework/inspect \
  -H "Content-Type: application/json" \
  -d '{
    "reworkNo": "RW-XXXXXXXX",
    "inspectionResult": "test",
    "inspectionBy": "inspector_wang"
  }'
```

**返回：**
```json
{
  "code": 400,
  "message": "状态转换不允许",
  "data": "Invalid status transition from CLOSED to INSPECTED"
}
```

## API 接口清单

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/api/rework/create` | 创建返工单 | `CreateReworkRequest` |
| POST | `/api/rework/receive` | 收件登记 | `ReceiveRequest` |
| POST | `/api/rework/inspect` | 到件核验 | `InspectionRequest` |
| POST | `/api/rework/technician-note` | 添加技师备注 | `TechnicianNoteRequest` |
| POST | `/api/rework/doctor-confirm` | 医生确认 | `DoctorConfirmRequest` |
| POST | `/api/rework/review` | 复查 | `ReviewRequest` |
| POST | `/api/rework/ship` | 寄出 | `ShipRequest` |
| POST | `/api/rework/close` | 结案 | `CloseRequest` |
| POST | `/api/rework/mark-lost` | 标记丢失 | `MarkLostRequest` |
| GET | `/api/rework/{reworkNo}` | 查询单条返工单 | - |
| GET | `/api/rework/list` | 查询返工单列表（支持按状态筛选） | - |
| POST | `/api/rework/export/{reworkNo}` | 导出返工报告 | - |
| GET | `/health` | 健康检查 | - |

### 请求体结构

**CreateReworkRequest:**
```json
{
  "patientNo": "string (必填)",
  "patientName": "string",
  "patientPhone": "string",
  "doctorName": "string",
  "batchNo": "string (必填)",
  "impressionType": "string",
  "reworkReason": "string (必填)",
  "operator": "string"
}
```

**ReceiveRequest:**
```json
{
  "reworkNo": "string (必填)",
  "receivedBy": "string (必填)",
  "remark": "string"
}
```

**InspectionRequest:**
```json
{
  "reworkNo": "string (必填)",
  "inspectionResult": "string (必填)",
  "inspectionRemark": "string",
  "inspectionBy": "string (必填)"
}
```

**TechnicianNoteRequest:**
```json
{
  "reworkNo": "string (必填)",
  "technicianNote": "string (必填)",
  "technicianName": "string (必填)"
}
```

**DoctorConfirmRequest:**
```json
{
  "reworkNo": "string (必填)",
  "doctorConfirmation": "string (必填)",
  "doctorName": "string (必填)"
}
```

**ReviewRequest:**
```json
{
  "reworkNo": "string (必填)",
  "reviewResult": "string (必填)",
  "reviewBy": "string (必填)"
}
```

**ShipRequest:**
```json
{
  "reworkNo": "string (必填)",
  "expressNo": "string (必填)",
  "expressCompany": "string",
  "shippedBy": "string (必填)",
  "receiver": "string",
  "receiverPhone": "string"
}
```

**CloseRequest:**
```json
{
  "reworkNo": "string (必填)",
  "closeReason": "string (必填)",
  "closedBy": "string (必填)"
}
```

**MarkLostRequest:**
```json
{
  "expressNo": "string (必填)",
  "lostRemark": "string",
  "operator": "string (必填)"
}
```

## 自检功能说明

### 审计日志

系统内置完整的审计日志功能，每个操作都会记录：
- 操作类型 (CREATE_REWORK / RECEIVE / INSPECT 等)
- 状态变更前后
- 操作人
- 操作时间
- 备注信息

**查看审计日志：**
```bash
curl http://localhost:8080/api/rework/RW-XXXXXXXX
```

返回中的 `auditLogs` 字段包含完整操作记录：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reworkNo": "RW1001",
    "status": "CLOSED",
    "auditLogs": [
      {
        "operationType": "CREATE_REWORK",
        "fromStatus": null,
        "toStatus": "CREATED",
        "operator": "system",
        "operationTime": "2024-01-15T10:00:00",
        "remark": "创建返工单"
      },
      {
        "operationType": "RECEIVE",
        "fromStatus": "CREATED",
        "toStatus": "RECEIVED",
        "operator": "factory_receiver",
        "operationTime": "2024-01-15T10:05:00",
        "remark": "收件登记"
      }
    ]
  }
}
```

### 状态转换校验

所有状态转换都通过 `ReworkStateMachine` 进行校验，确保：
- 只能按预设流程进行状态转换
- 终态 (CLOSED / LOST) 不可继续操作
- 非法状态转换抛出明确错误信息

### 数据完整性

- 患者和批次信息不存在时自动创建
- 快递信息与返工单关联存储
- 核验报告独立存储，支持追溯
