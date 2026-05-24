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
│  PENDING_REVIEW │  待审核
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│TECHNICIAN_REVIEW│  技师审核中  ◄───────────┐
└────────┬────────┘                           │
         │                                    │
         ▼                                    │
┌─────────────────┐                           │
│  DOCTOR_CONFIRM │  医生确认中               │
└───────┬─────────┘                           │
        │                                     │
   ┌────┴────┐                                │
   │         │                                │
   ▼         ▼                                │
┌─────────┐ ┌─────────────────┐               │
│READY_TO │ │TECHNICIAN_REVIEW│  医生驳回─────┘
│  SHIP   │ └─────────────────┘
└────┬────┘  待寄出
     │
     ▼
┌─────────┐
│ SHIPPED │  已寄出
└────┬────┘
     │
  ┌──┴──┐
  │     │
  ▼     ▼
┌─────┐ ┌──────┐
│RECEIV│ │ LOST │  快递丢失
│ ED  │ └──────┘
└──┬──┘  已收件
   │
   ▼
┌────────┐
│INSPECT │  核验中
│  ION   │
└───┬────┘
    │
    ▼
┌────────┐
│ CLOSED │  已结案
└────────┘
```

状态说明：

| 状态 | 说明 | 可转换至 |
|------|------|----------|
| `PENDING_REVIEW` | 待审核 | TECHNICIAN_REVIEW |
| `TECHNICIAN_REVIEW` | 技师审核中 | DOCTOR_CONFIRM, PENDING_REVIEW |
| `DOCTOR_CONFIRM` | 医生确认中 | READY_TO_SHIP, TECHNICIAN_REVIEW |
| `READY_TO_SHIP` | 待寄出 | SHIPPED |
| `SHIPPED` | 已寄出 | RECEIVED, LOST |
| `RECEIVED` | 已收件 | INSPECTION |
| `INSPECTION` | 核验中 | CLOSED |
| `CLOSED` | 已结案 | - |
| `LOST` | 快递丢失 | - |

## 造数说明

项目启动时 `DataInitializer` 会自动创建以下测试数据：

### 患者数据
| 患者ID | 姓名 | 电话 |
|--------|------|------|
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
| RW1001 | BATCH-001 | PENDING_REVIEW | 牙模边缘不清晰 | - |
| RW1002 | BATCH-002 | TECHNICIAN_REVIEW | 咬合关系不准确 | 正在检查中... |

## 完整 Curl 示例

### 1. 创建返工单

```bash
curl -X POST http://localhost:8080/api/rework \
  -H "Content-Type: application/json" \
  -d '{
    "batchNumber": "BATCH-003",
    "patientId": "P003",
    "patientName": "王五",
    "patientPhone": "13700137000",
    "reworkReason": "牙模变形"
  }'
```

### 2. 技师开始审核

```bash
curl -X POST http://localhost:8080/api/rework/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "tech_zhang",
    "remark": "开始审核"
  }'
```

### 3. 添加技师备注

```bash
curl -X POST http://localhost:8080/api/rework/1/technician-note \
  -H "Content-Type: application/json" \
  -d '{
    "note": "牙模边缘需要重新打磨，建议重新取模",
    "operator": "tech_zhang"
  }'
```

### 4. 医生确认

**确认通过：**
```bash
curl -X POST http://localhost:8080/api/rework/1/doctor-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed": true,
    "note": "同意返工方案",
    "operator": "dr_li"
  }'
```

**驳回重审：**
```bash
curl -X POST http://localhost:8080/api/rework/1/doctor-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed": false,
    "note": "方案不完整，请补充",
    "operator": "dr_li"
  }'
```

### 5. 寄出

```bash
curl -X POST http://localhost:8080/api/rework/1/ship \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "SF1234567890",
    "courier": "顺丰速运",
    "sender": "诊所A",
    "receiver": "工厂B",
    "operator": "admin"
  }'
```

### 6. 收件

```bash
curl -X POST http://localhost:8080/api/rework/1/receive \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "factory_receiver",
    "remark": "包装完好，已签收"
  }'
```

### 7. 核验

```bash
curl -X POST http://localhost:8080/api/rework/1/inspect \
  -H "Content-Type: application/json" \
  -d '{
    "inspectionResult": "牙模完整，无破损",
    "conclusion": "符合返工要求，可进行下一步处理",
    "reporter": "inspector_wang"
  }'
```

### 8. 结案

```bash
curl -X POST http://localhost:8080/api/rework/1/close \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "remark": "返工完成，流程结束"
  }'
```

### 9. 标记丢失

```bash
curl -X POST http://localhost:8080/api/rework/1/mark-lost \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin",
    "remark": "快递超过7天未更新，确认丢失"
  }'
```

### 10. 查询详情

```bash
curl http://localhost:8080/api/rework/1
```

**查询所有返工单：**
```bash
curl http://localhost:8080/api/rework
```

## 失败路径演示

### 场景1：重复操作拦截

**问题：** 在 `DOCTOR_CONFIRM` 状态再次调用审核接口

```bash
# 假设工单已处于 DOCTOR_CONFIRM 状态
curl -X POST http://localhost:8080/api/rework/1/review \
  -H "Content-Type: application/json" \
  -d '{"operator": "tech_zhang"}'
```

**返回：**
```json
{
  "code": 500,
  "message": "Invalid status transition from DOCTOR_CONFIRM to TECHNICIAN_REVIEW",
  "data": null
}
```

### 场景2：状态非法转换

**问题：** 在 `PENDING_REVIEW` 状态直接尝试寄出

```bash
curl -X POST http://localhost:8080/api/rework/1/ship \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "SF1234567890",
    "courier": "顺丰速运"
  }'
```

**返回：**
```json
{
  "code": 500,
  "message": "Invalid status transition from PENDING_REVIEW to SHIPPED",
  "data": null
}
```

### 场景3：终态无法继续操作

**问题：** `CLOSED` 或 `LOST` 状态后继续操作

```bash
curl -X POST http://localhost:8080/api/rework/1/inspect \
  -H "Content-Type: application/json" \
  -d '{"inspectionResult": "test"}'
```

**返回：**
```json
{
  "code": 500,
  "message": "Invalid status transition from CLOSED to INSPECTION",
  "data": null
}
```

## API 接口清单

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/api/rework` | 创建返工单 | `CreateReworkRequest` |
| GET | `/api/rework/{id}` | 查询单条返工单 | - |
| GET | `/api/rework` | 查询所有返工单 | - |
| POST | `/api/rework/{id}/review` | 技师开始审核 | `ReviewRequest` |
| POST | `/api/rework/{id}/technician-note` | 添加技师备注 | `TechnicianNoteRequest` |
| POST | `/api/rework/{id}/doctor-confirm` | 医生确认 | `DoctorConfirmRequest` |
| POST | `/api/rework/{id}/ship` | 寄出 | `ShipRequest` |
| POST | `/api/rework/{id}/receive` | 收件 | `ReceiveRequest` |
| POST | `/api/rework/{id}/inspect` | 核验 | `InspectionRequest` |
| POST | `/api/rework/{id}/close` | 结案 | `CloseRequest` |
| POST | `/api/rework/{id}/mark-lost` | 标记丢失 | `MarkLostRequest` |
| GET | `/health` | 健康检查 | - |

### 请求体结构

**CreateReworkRequest:**
```json
{
  "batchNumber": "string (必填)",
  "patientId": "string (必填)",
  "patientName": "string",
  "patientPhone": "string",
  "reworkReason": "string"
}
```

**DoctorConfirmRequest:**
```json
{
  "confirmed": "boolean",
  "note": "string",
  "operator": "string"
}
```

**ShipRequest:**
```json
{
  "trackingNumber": "string (必填)",
  "courier": "string",
  "sender": "string",
  "receiver": "string",
  "operator": "string"
}
```

**InspectionRequest:**
```json
{
  "inspectionResult": "string",
  "conclusion": "string",
  "reporter": "string"
}
```

## 自检功能说明

### 审计日志

系统内置完整的审计日志功能，每个操作都会记录：
- 操作类型 (CREATE / STATUS_CHANGE / SHIP 等)
- 状态变更前后
- 操作人
- 操作时间
- 备注信息

**查看审计日志：**
```bash
curl http://localhost:8080/api/rework/1
```

返回中的 `auditLogs` 字段包含完整操作记录：
```json
{
  "data": {
    "id": 1,
    "orderNumber": "RW1001",
    "status": "CLOSED",
    "auditLogs": [
      {
        "operationType": "CREATE",
        "fromStatus": null,
        "toStatus": "PENDING_REVIEW",
        "operator": "system",
        "createdAt": "2024-01-15T10:00:00"
      },
      {
        "operationType": "STATUS_CHANGE",
        "fromStatus": "PENDING_REVIEW",
        "toStatus": "TECHNICIAN_REVIEW",
        "operator": "tech_zhang",
        "createdAt": "2024-01-15T10:05:00"
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
