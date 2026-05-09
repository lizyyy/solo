# 外协加工入库验收服务

一套完整的外协加工入库验收后端服务，覆盖外协订单管理、分批到货、质检验收、扣款处理和补货任务等核心业务流程。

## 系统特性

### 核心业务模块

1. **外协订单管理**
   - 创建、确认、结案外协订单
   - 订单数量、金额、交付期限管理
   - 实时统计到货、合格、不合格数量

2. **分批到货管理**
   - 支持多批次到货登记
   - 到货日期、运输单号、送货人信息
   - 自动更新订单到货状态

3. **质检验收流程**
   - 抽样检验、全检支持
   - 验收结论：合格、不合格、让步接收
   - 处理建议：直接入库、扣款接收、退货、要求补货、返工后复检

4. **扣款规则与记录**
   - 按比例扣款、固定金额扣款、倍数扣款
   - 按缺陷类型、供应商自定义规则
   - 审批流程支持

5. **补货任务管理**
   - 基于验收不合格自动生成补货任务
   - 通知供应商、供应商确认
   - 补货到货登记

6. **供应商报表**
   - 合格率、扣款率、按时交付率统计
   - 订单完成情况汇总
   - 补货任务跟踪

7. **操作日志追踪**
   - 完整的操作历史记录
   - 状态变更追踪
   - 失败原因记录

### 失败补偿机制（重点）

本系统设计了完善的失败补偿机制，用户无需清库重来。以下是各环节失败后的重跑方式：

---

## 重跑补偿机制详解

### 一、验收流程中断

**场景**：验收过程中因网络、系统或其他原因导致验收流程中断。

**现象描述**：
- 批次状态显示为「验收失败」
- 操作日志记录了具体的失败原因
- 验收记录可能还未确认

**重跑方式**：

1. **重新开始验收**
   ```
   POST /api/batches/{batchId}/retry-inspection
   ```
   
   这将把批次状态从「验收失败」重置为「验收中」，可以重新录入验收数据。

2. **查看失败详情**
   ```
   GET /api/logs/no/{batchNo}
   ```
   
   查看操作日志，了解具体失败原因。

---

### 二、验收确认后补偿处理失败

**场景**：验收记录已确认，但后续的扣款、补货等补偿动作执行失败。

**现象描述**：
- 验收记录状态显示为「补偿失败」
- 错误提示会说明具体哪个环节失败
- 操作日志有详细的失败记录

**重跑方式**：

1. **重试补偿处理**
   ```
   POST /api/inspections/{inspectionId}/retry-compensation
   ```
   
   系统会从上次失败的地方继续执行补偿流程，无需重新录入验收数据。

2. **查看所有补偿失败的验收**
   ```
   GET /api/inspections/failed-compensation
   ```
   
   列出所有需要重试补偿的验收记录。

**重试说明**：
- 系统记录了当前处理进度，重试会从断点继续
- 不会重复执行已成功的步骤
- 可以多次重试，直到成功为止
- 每次重试都会在操作日志中留下记录

---

### 三、扣款执行失败

**场景**：扣款记录已审批通过，但与财务系统对接或扣款执行过程中失败。

**现象描述**：
- 扣款记录状态显示为「执行失败」
- `failureReason` 字段记录了失败原因
- 扣款金额已计入统计，但实际扣款未完成

**重跑方式**：

1. **重试扣款执行**
   ```
   POST /api/deductions/{recordId}/retry?retryDescription=描述
   ```
   
   重新执行扣款逻辑。

2. **查看所有执行失败的扣款**
   ```
   GET /api/deductions/failed
   ```

**重试说明**：
- 系统记录重试次数，可追踪问题解决过程
- 支持添加重试描述，记录每次尝试的情况
- 成功后状态变为「已完成」

---

### 四、补货任务执行失败

**场景**：补货任务在执行过程中遇到问题，如供应商无法联系、沟通失误等。

**现象描述**：
- 补货任务状态显示为「执行失败」
- `failureReason` 字段说明失败原因
- `retryCount` 记录已重试次数

**重跑方式**：

1. **发起重试**
   ```
   POST /api/replenishments/{taskId}/retry?retryDescription=描述
   ```
   
   状态变为「待重试」，可重新开始补货流程。

2. **查看所有失败的补货任务**
   ```
   GET /api/replenishments/failed
   ```

3. **继续补货流程**
   重试后，可以继续执行：
   ```
   POST /api/replenishments/{taskId}/notify-supplier
   POST /api/replenishments/{taskId}/confirm-supplier
   POST /api/replenishments/{taskId}/delivery
   ```

**重试说明**：
- 每次重试次数会累加
- 可以在重试描述中记录沟通情况
- 支持部分补货（先到一部分），剩余后续再到

---

### 五、如何查询处理历史

无论哪个环节出问题，都可以通过以下方式查看完整的处理历史：

1. **按单据编号查询**
   ```
   GET /api/logs/no/{单据编号}
   ```
   可以看到该单据从创建到现在的所有操作记录。

2. **按实体类型和ID查询**
   ```
   GET /api/logs/entity/{实体类型}/{实体ID}
   ```
   实体类型包括：外协订单、到货批次、验收记录、扣款记录、补货任务等。

3. **日志内容说明**
   每条日志包含：
   - 操作人（真实姓名）
   - 操作时间
   - 操作类型（创建、确认、审批、重试等）
   - 状态变更（从什么状态变成什么状态）
   - 操作摘要（一句话说明做了什么）
   - 成功/失败标记
   - 失败时的错误信息
   - 操作前后的数据快照（JSON格式）

---

## 业务流程图

```
外协订单
    │
    ├── 确认订单 ──→ 已确认
    │
    └── 分批到货 ──→ 到货批次
                        │
                        ├── 开始验收 ──→ 验收中
                        │       │
                        │       ├── 验收成功 ──→ 创建验收记录
                        │       │                         │
                        │       │                         ├── 确认验收
                        │       │                         │       │
                        │       │                         │       ├── 补偿处理成功 ──→ 已完成
                        │       │                         │       │
                        │       │                         │       └── 补偿处理失败
                        │       │                         │               │
                        │       │                         │               └── 可重试补偿
                        │       │                         │
                        │       │                         ├── 扣款 ──→ 扣款记录
                        │       │                         │       │
                        │       │                         │       ├── 审批通过
                        │       │                         │       │       │
                        │       │                         │       │       ├── 执行成功 ──→ 已完成
                        │       │                         │       │       │
                        │       │                         │       │       └── 执行失败 ──→ 可重试
                        │       │                         │       │
                        │       │                         │       └── 审批驳回
                        │       │                         │
                        │       │                         └── 补货 ──→ 补货任务
                        │       │                                 │
                        │       │                                 ├── 通知供应商
                        │       │                                 │
                        │       │                                 ├── 供应商确认
                        │       │                                 │
                        │       │                                 ├── 补货到货（支持分批）
                        │       │                                 │
                        │       │                                 ├── 执行失败 ──→ 可重试
                        │       │                                 │
                        │       │                                 └── 完成
                        │       │
                        │       └── 验收失败 ──→ 可重试验收
                        │
                        └── 结案
```

---

## 快速开始

### 环境要求

- JDK 17+
- Maven 3.6+
- MySQL 8.0+

### 数据库配置

1. 创建数据库并执行初始化脚本：
   ```bash
   mysql -u root -p < src/main/resources/db/init.sql
   ```

2. 修改 `application.yml` 中的数据库连接信息：
   ```yaml
   spring:
     datasource:
       url: jdbc:mysql://localhost:3306/outsourcing_inspection
       username: your_username
       password: your_password
   ```

### 启动服务

```bash
mvn spring-boot:run
```

服务默认启动在 `http://localhost:8080`

### 默认账户

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123456 | 管理员 |
| inspector | 123456 | 质检员 |
| purchaser | 123456 | 采购员 |
| finance | 123456 | 财务 |

---

## API 接口概览

### 认证接口

```
POST /api/auth/login          # 登录
POST /api/auth/register       # 注册用户
```

### 外协订单

```
POST   /api/orders                 # 创建订单
GET    /api/orders                 # 订单列表
GET    /api/orders/{id}            # 订单详情
GET    /api/orders/no/{orderNo}    # 按编号查询
POST   /api/orders/{id}/confirm    # 确认订单
POST   /api/orders/{id}/close      # 结案订单
```

### 到货批次

```
POST   /api/batches                      # 登记到货
GET    /api/batches/{id}                 # 批次详情
GET    /api/batches/order/{orderId}      # 订单的所有批次
POST   /api/batches/{id}/start-inspection  # 开始验收
POST   /api/batches/{id}/mark-failed     # 标记验收失败
POST   /api/batches/{id}/retry-inspection # 重试验收
```

### 验收记录

```
POST   /api/inspections                      # 创建验收记录
GET    /api/inspections/{id}                 # 验收详情
GET    /api/inspections/batch/{batchId}      # 批次的验收记录
POST   /api/inspections/{id}/confirm         # 确认验收
POST   /api/inspections/{id}/retry-compensation # 重试补偿
GET    /api/inspections/failed-compensation  # 补偿失败列表
```

### 扣款管理

```
POST   /api/deductions                  # 创建扣款记录
GET    /api/deductions/{id}             # 扣款详情
GET    /api/deductions/inspection/{id}  # 验收的扣款记录
GET    /api/deductions/order/{orderId}  # 订单的扣款记录
GET    /api/deductions/failed           # 执行失败列表
POST   /api/deductions/{id}/approve     # 审批通过
POST   /api/deductions/{id}/reject      # 审批驳回
POST   /api/deductions/{id}/retry       # 重试执行
GET    /api/deductions/rules            # 扣款规则列表
```

### 补货任务

```
POST   /api/replenishments                       # 创建补货任务
GET    /api/replenishments/{id}                  # 任务详情
GET    /api/replenishments/order/{orderId}        # 订单的补货任务
GET    /api/replenishments/batch/{batchId}        # 批次的补货任务
GET    /api/replenishments/inspection/{id}        # 验收的补货任务
GET    /api/replenishments/failed                 # 失败任务列表
POST   /api/replenishments/{id}/notify-supplier   # 通知供应商
POST   /api/replenishments/{id}/confirm-supplier  # 供应商确认
POST   /api/replenishments/{id}/delivery          # 登记补货到货
POST   /api/replenishments/{id}/mark-failed       # 标记失败
POST   /api/replenishments/{id}/retry             # 重试任务
POST   /api/replenishments/{id}/cancel            # 取消任务
```

### 报表统计

```
GET /api/reports/suppliers              # 所有供应商报表
GET /api/reports/suppliers/{id}         # 单个供应商报表
```

### 操作日志

```
GET /api/logs/entity/{type}/{id}        # 按实体查询日志
GET /api/logs/no/{entityNo}             # 按单据编号查询
GET /api/logs/operator/{name}           # 按操作人查询
```

---

## 状态说明

### 外协订单状态

| 状态 | 说明 |
|------|------|
| 草稿 | 新建订单，可编辑 |
| 已确认 | 订单已确认，可开始到货 |
| 生产中 | 供应商生产中（可选状态） |
| 部分到货 | 已部分到货，待全部到齐 |
| 验收中 | 全部到货，验收中 |
| 已完成 | 所有批次验收完成 |
| 已结案 | 订单关闭 |

### 到货批次状态

| 状态 | 说明 |
|------|------|
| 待验收 | 已到货，等待质检 |
| 验收中 | 质检人员正在验收 |
| 验收失败 | 验收流程中断，可重试 |
| 全部合格 | 验收完成，全部合格 |
| 部分合格 | 验收完成，部分合格 |
| 全部不合格 | 验收完成，全部不合格 |
| 已结案 | 批次关闭 |

### 验收记录状态

| 状态 | 说明 |
|------|------|
| 待确认 | 已录入，等待确认 |
| 已确认 | 已确认，执行补偿中 |
| 已撤回 | 验收被撤回 |
| 补偿失败 | 补偿处理失败，可重试 |
| 待重试补偿 | 已发起重试 |
| 已完成 | 全部处理完成 |

### 扣款记录状态

| 状态 | 说明 |
|------|------|
| 待审批 | 等待财务审批 |
| 已审批 | 审批通过，执行中 |
| 已驳回 | 审批被驳回 |
| 执行失败 | 扣款执行失败，可重试 |
| 已完成 | 扣款完成 |

### 补货任务状态

| 状态 | 说明 |
|------|------|
| 已创建 | 刚创建，待通知供应商 |
| 已通知供应商 | 已通知，等待确认 |
| 供应商已确认 | 供应商同意补货 |
| 补货中 | 供应商备货中 |
| 部分补货 | 部分到货，待剩余 |
| 已完成 | 全部补货完成 |
| 已取消 | 任务取消 |
| 执行失败 | 执行失败，可重试 |
| 待重试 | 已发起重试 |

---

## 技术架构

- **后端框架**: Spring Boot 3.2
- **持久层**: Spring Data JPA
- **数据库**: MySQL 8.0
- **认证**: JWT (JSON Web Token)
- **安全框架**: Spring Security
- **构建工具**: Maven
- **Java版本**: JDK 17

---

## 开发说明

### 项目结构

```
src/main/java/com/manufacture/outsourcing/
├── OutsourcingInspectionApplication.java  # 启动类
├── common/                                # 公共类
│   ├── PageResult.java
│   └── Result.java
├── controller/                            # 控制器层
│   ├── AuthController.java
│   ├── DeductionController.java
│   ├── DeliveryBatchController.java
│   ├── InspectionController.java
│   ├── OperationLogController.java
│   ├── OutsourcingOrderController.java
│   ├── ReplenishmentController.java
│   └── ReportController.java
├── dto/                                   # 数据传输对象
│   ├── DeductionRecordRequest.java
│   ├── DeliveryBatchRequest.java
│   ├── InspectionResultRequest.java
│   ├── LoginRequest.java
│   ├── LoginResponse.java
│   ├── OutsourcingOrderRequest.java
│   ├── ReplenishmentDeliveryRequest.java
│   ├── ReplenishmentRequest.java
│   └── SupplierReport.java
├── entity/                                # 实体类
│   ├── DeductionRecord.java
│   ├── DeductionRule.java
│   ├── DeliveryBatch.java
│   ├── InspectionResult.java
│   ├── OperationLog.java
│   ├── OutsourcingOrder.java
│   ├── ReplenishmentTask.java
│   ├── Supplier.java
│   └── User.java
├── exception/                             # 异常处理
│   ├── BusinessException.java
│   └── GlobalExceptionHandler.java
├── repository/                            # 数据访问层
│   ├── DeductionRecordRepository.java
│   ├── DeductionRuleRepository.java
│   ├── DeliveryBatchRepository.java
│   ├── InspectionResultRepository.java
│   ├── OperationLogRepository.java
│   ├── OutsourcingOrderRepository.java
│   ├── ReplenishmentTaskRepository.java
│   ├── SupplierRepository.java
│   └── UserRepository.java
├── security/                              # 安全模块
│   ├── JwtAuthenticationFilter.java
│   ├── JwtUtil.java
│   └── SecurityConfig.java
├── service/                               # 业务服务层
│   ├── AuthService.java
│   ├── DeductionService.java
│   ├── DeliveryBatchService.java
│   ├── InspectionService.java
│   ├── OperationLogService.java
│   ├── OutsourcingOrderService.java
│   ├── ReplenishmentService.java
│   └── ReportService.java
└── util/                                  # 工具类
    ├── NoGenerator.java
    └── SecurityUtil.java
```

### 设计原则

1. **状态驱动**: 所有业务实体都有清晰的状态流转，每一步操作都会更新状态
2. **日志完整**: 每一个状态变更都会记录操作日志，包含变更前后的数据
3. **补偿友好**: 失败时保留现场，记录失败原因，支持断点续传式的重试
4. **人类可读**: 状态使用中文描述，日志摘要用自然语言描述操作内容
5. **无机器标识**: 不使用难以理解的编码标识，所有状态都是真实业务用语

---

## 常见问题

### Q: 验收确认后发现补偿处理失败，之前的验收数据会丢失吗？

A: 不会。验收数据已经保存，补偿失败只是后续的扣款/补货步骤没执行。调用重试接口即可继续处理。

### Q: 补货可以分批到货吗？

A: 可以。每次登记补货到货时，系统会自动计算剩余数量。状态会显示「部分补货」，直到全部到货后变为「已完成」。

### Q: 扣款记录被驳回了怎么办？

A: 可以重新创建扣款记录，或者修改原记录后重新提交审批。原驳回记录会保留，便于追溯。

### Q: 如何查看某个订单的完整历史？

A: 有两种方式：
1. `GET /api/logs/entity/外协订单/{orderId}`
2. `GET /api/logs/no/{orderNo}`

这两个接口都会返回该订单从创建到现在的所有操作记录。

### Q: 重试有没有次数限制？

A: 没有次数限制。系统会记录每次重试的描述，方便追踪问题解决过程。但建议在重试前先查看失败原因，解决后再重试。
