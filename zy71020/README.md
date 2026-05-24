# 病房氧气接口预约 API

## 项目简介

呼吸科床位协调管理系统，解决氧气接口重复占用、转科未释放资源、设备归还超时等问题。

**技术栈：**
- Java 17 + Spring Boot 3.2
- H2 内存数据库
- JPA + Lombok

## 核心功能

### 闭环流程
1. **材料入库** - 床位、患者、氧气接口、设备基础数据管理
2. **规则命中** - 预约时自动检测重复预约、接口占用、转科未释放等
3. **人工改判** - 支持人工干预覆盖规则判断
4. **结果回写** - 操作状态实时回写到资源状态
5. **历史查看** - 全量审计日志记录，支持追溯
6. **报告下载** - 占用报告生成与导出

### 关键特性
- ✅ **资源锁定** - 预约确认后自动锁定氧气接口
- ✅ **转科释放** - 转科完成后自动/手动释放资源
- ✅ **借用状态机** - 设备借用全流程状态管理（申请→审批→借出→归还/超时）
- ✅ **重复预约拦截** - 同一患者同一接口重复预约自动拦截
- ✅ **审计追踪** - 重复操作只留审计记录，不产生新的有效处置
- ✅ **报告导出** - 支持从单条记录追踪到汇总结果

## 快速启动

### 环境要求
- JDK 17+
- Maven 3.8+

### 启动服务

```bash
# 编译项目
mvn clean package -DskipTests

# 启动服务
java -jar target/oxygen-booking-api-1.0.0.jar

# 或者使用 Maven 直接启动
mvn spring-boot:run
```

服务启动后访问：
- API 地址: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:hospital`
  - 用户名: `sa`
  - 密码: (空)

### 自动造数

系统启动时自动初始化测试数据：
- **床位**: 18 张（呼吸一科/二科各 6 张，ICU 6 张）
- **患者**: 5 位测试患者
- **氧气接口**: 24 个（每科室 8 个）
- **设备**: 8 台（呼吸机、高流量湿化仪、监护仪等）

## API 示例

### 1. 健康检查 & 自检

```bash
# 健康检查
curl -X GET http://localhost:8080/api/health

# 系统自检
curl -X GET http://localhost:8080/api/health/self-check
```

### 2. 氧气接口预约

```bash
# 创建预约（成功路径）
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "P001",
    "ward": "呼吸一科",
    "bedNumber": "呼吸一科-01",
    "oxygenPortCode": "呼吸一科-PORT-01",
    "remarks": "COPD 患者吸氧",
    "operator": "张护士"
  }'

# 查询预约
curl -X GET http://localhost:8080/api/bookings/active

# 完成预约（释放资源）
curl -X POST http://localhost:8080/api/bookings/BKxxxxxxxx/complete?operator=李护士

# 取消预约
curl -X POST http://localhost:8080/api/bookings/BKxxxxxxxx/cancel?operator=护士长
```

### 3. 转科管理

```bash
# 创建转科申请
curl -X POST http://localhost:8080/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "P001",
    "fromWard": "呼吸一科",
    "toWard": "ICU",
    "fromBed": "呼吸一科-01",
    "toBed": "ICU-01",
    "oxygenPortCode": "呼吸一科-PORT-01",
    "operator": "王医生"
  }'

# 审批转科
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/approve?operator=护士长

# 开始转运
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/start?operator=转运护士

# 完成转科（不释放资源）
curl -X POST "http://localhost:8080/api/transfers/TRxxxxxxxx/complete?releaseResources=false&operator=ICU护士"

# 手动释放转科资源
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/release?operator=护士长

# 查询未释放资源的转科
curl -X GET http://localhost:8080/api/transfers/unreleased
```

### 4. 设备借用

```bash
# 提交借用申请
curl -X POST http://localhost:8080/api/borrows \
  -H "Content-Type: application/json" \
  -d '{
    "equipmentCode": "E001",
    "patientId": "P002",
    "borrower": "张护士",
    "borrowWard": "呼吸一科",
    "expectedReturnTime": "2024-01-15T18:00:00",
    "remarks": "急救使用",
    "operator": "张护士"
  }'

# 审批借用
curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/approve?operator=设备科

# 借出设备
curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/borrow?operator=张护士

# 归还设备
curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/return?operator=张护士

# 检查超时
curl -X POST http://localhost:8080/api/borrows/check-overdue

# 查询超时借用
curl -X GET http://localhost:8080/api/borrows/overdue
```

### 5. 人工改判

```bash
# 改判预约状态
curl -X POST http://localhost:8080/api/bookings/BKxxxxxxxx/override \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "紧急抢救需要，强制占用",
    "operator": "科主任",
    "newStatus": "ACTIVE"
  }'

# 改判转科
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/override \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "患者病情稳定，提前完成转科并释放资源",
    "operator": "主治医生",
    "newStatus": "COMPLETED"
  }'

# 改判借用（强制归还）
curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/override \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "设备故障，强制标记为已归还",
    "operator": "设备科主任",
    "newStatus": "RETURNED"
  }'
```

### 6. 报告管理

```bash
# 生成占用报告
curl -X POST "http://localhost:8080/api/reports/generate?ward=呼吸一科&operator=护士长"

# 查询报告列表
curl -X GET http://localhost:8080/api/reports

# 导出报告为 CSV
curl -X GET http://localhost:8080/api/reports/export/RPTxxxxxxxx -o report.csv
```

### 7. 审计日志

```bash
# 查询所有审计日志
curl -X GET http://localhost:8080/api/audit/logs

# 按资源类型查询
curl -X GET "http://localhost:8080/api/audit/logs?resourceType=BOOKING"

# 按资源ID查询
curl -X GET "http://localhost:8080/api/audit/logs?resourceId=BKxxxxxxxx"

# 查询重复操作记录
curl -X GET http://localhost:8080/api/audit/duplicates
```

### 8. 基础数据

```bash
# 查询所有床位
curl -X GET http://localhost:8080/api/master/beds

# 查询所有患者
curl -X GET http://localhost:8080/api/master/patients

# 查询所有氧气接口
curl -X GET http://localhost:8080/api/master/ports

# 按科室查询接口
curl -X GET http://localhost:8080/api/master/ports/ward/呼吸一科

# 查询所有设备
curl -X GET http://localhost:8080/api/master/equipments
```

## 失败路径示例

### 1. 重复预约 - 自动拦截

```bash
# 第一次预约（成功）
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "P001",
    "ward": "呼吸一科",
    "oxygenPortCode": "呼吸一科-PORT-02",
    "operator": "测试护士"
  }'

# 第二次预约同一患者同一接口（失败 - 规则拦截）
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "P001",
    "ward": "呼吸一科",
    "oxygenPortCode": "呼吸一科-PORT-02",
    "operator": "测试护士"
  }'

# 预期返回:
# {
#   "code": 400,
#   "message": "预约被拒绝: 重复预约：该患者已预约此氧气接口, 接口占用：氧气接口 呼吸一科-PORT-02 当前状态为 OCCUPIED",
#   "success": false
# }
```

### 2. 转科未释放 - 后续预约失败

```bash
# 1. 先预约一个接口
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"patientId":"P002","ward":"呼吸一科","oxygenPortCode":"呼吸一科-PORT-03","operator":"护士A"}'

# 2. 创建转科并完成但不释放资源
curl -X POST http://localhost:8080/api/transfers \
  -H "Content-Type: application/json" \
  -d '{"patientId":"P002","fromWard":"呼吸一科","toWard":"呼吸二科","oxygenPortCode":"呼吸一科-PORT-03","operator":"护士A"}'

# 审批、开始、完成转科（注意 releaseResources=false）
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/approve
curl -X POST http://localhost:8080/api/transfers/TRxxxxxxxx/start
curl -X POST "http://localhost:8080/api/transfers/TRxxxxxxxx/complete?releaseResources=false"

# 3. 该患者再次预约（会提示转科未释放）
curl -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"patientId":"P002","ward":"呼吸二科","oxygenPortCode":"呼吸二科-PORT-01","operator":"护士B"}'

# 预期返回包含: "转科未释放：该患者存在未释放资源的转科记录"
```

### 3. 设备重复借用 - 自动拦截

```bash
# 借用设备
curl -X POST http://localhost:8080/api/borrows \
  -H "Content-Type: application/json" \
  -d '{"equipmentCode":"E001","patientId":"P003","borrower":"护士A","borrowWard":"呼吸一科","operator":"护士A"}'

curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/approve
curl -X POST http://localhost:8080/api/borrows/BRxxxxxxxx/borrow

# 同一设备再次借用（失败）
curl -X POST http://localhost:8080/api/borrows \
  -H "Content-Type: application/json" \
  -d '{"equipmentCode":"E001","patientId":"P004","borrower":"护士B","borrowWard":"呼吸一科","operator":"护士B"}'

# 预期返回:
# {
#   "code": 400,
#   "message": "借用申请被拒绝: 设备占用：设备 E001 已被借用",
#   "success": false
# }
```

### 4. 重复完成操作 - 只记录审计，不重复执行

```bash
# 完成预约第一次
curl -X POST http://localhost:8080/api/bookings/BKxxxxxxxx/complete

# 完成预约第二次（不会报错，但会记录重复操作审计）
curl -X POST http://localhost:8080/api/bookings/BKxxxxxxxx/complete

# 查看重复操作记录
curl -X GET http://localhost:8080/api/audit/duplicates
```

## 轻量自检

```bash
# 运行自检
curl -X GET http://localhost:8080/api/health/self-check

# 预期输出示例:
# {
#   "code": 200,
#   "message": "自检通过",
#   "data": {
#     "allChecksPassed": true,
#     "checks": {
#       "bookingService": "OK - 2 active bookings",
#       "transferService": "OK - 1 unreleased transfers",
#       "borrowService": "OK - 0 overdue borrows",
#       "ruleEngine.transfers": "OK - 1 unreleased transfers detected",
#       "ruleEngine.overdue": "OK - 0 overdue borrows detected"
#     }
#   },
#   "success": true
# }
```

## 项目结构

```
src/main/java/com/hospital/oxygen/
├── OxygenBookingApplication.java    # 启动类
├── common/
│   ├── ApiResponse.java             # 统一响应
│   └── BusinessException.java       # 业务异常
├── config/
│   └── DataInitializer.java         # 数据初始化
├── controller/
│   ├── BookingController.java       # 预约接口
│   ├── TransferController.java      # 转科接口
│   ├── BorrowController.java        # 借用接口
│   ├── ReportController.java        # 报告接口
│   ├── AuditController.java         # 审计接口
│   ├── MasterDataController.java    # 基础数据
│   ├── HealthController.java        # 健康检查
│   └── GlobalExceptionHandler.java  # 全局异常处理
├── dto/
│   ├── BookingRequest.java
│   ├── TransferRequestDto.java
│   ├── BorrowRequest.java
│   └── OverrideRequest.java
├── entity/
│   ├── Bed.java
│   ├── Patient.java
│   ├── OxygenPort.java
│   ├── Equipment.java
│   ├── Booking.java
│   ├── TransferRequest.java
│   ├── EquipmentBorrow.java
│   ├── OccupancyReport.java
│   └── AuditLog.java
├── enums/
│   ├── BookingStatus.java
│   ├── TransferStatus.java
│   ├── BorrowStatus.java
│   └── PortStatus.java
├── repository/
│   └── *Repository.java
└── service/
    ├── BookingService.java
    ├── TransferService.java
    ├── EquipmentBorrowService.java
    ├── ReportService.java
    ├── AuditService.java
    └── RuleEngineService.java
```

## 设计说明

### 规则引擎

系统内置以下规则自动校验：
1. **重复预约检测** - 同一患者同一接口是否已有活跃预约
2. **接口占用检测** - 氧气接口当前状态是否为可用
3. **转科未释放检测** - 患者是否存在未释放资源的转科记录
4. **时间冲突检测** - 预约时间是否与已有预约重叠
5. **设备占用检测** - 设备是否已被借用

### 审计机制

- 所有状态变更都会记录审计日志
- 重复操作（如重复完成、重复取消）不会产生实际状态变更
- 重复操作只记录审计日志，标记 `isDuplicate=true`
- 人工改判会记录 `overrideReason` 和 `overrideOperator`

### 状态机

**预约状态**: PENDING → CONFIRMED → ACTIVE → COMPLETED/CANCELLED

**转科状态**: PENDING → APPROVED → IN_TRANSIT → COMPLETED (释放/未释放)

**借用状态**: REQUESTED → APPROVED → BORROWED → RETURNED / OVERDUE

## License

MIT
