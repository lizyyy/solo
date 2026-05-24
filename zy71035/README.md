# 滑雪租赁绑定器 API

基于 Spring Boot + H2 的滑雪租赁绑定器管理后端服务，支持批次处理、状态机流转、损伤复核、重复出租拦截、审计追踪和报告导出。

## 功能特性

- **参数校验**: 绑定器释放值、身高体重、鞋码自动校验
- **出租状态机**: 完整的租赁生命周期状态管控
- **重复出租拦截**: 防止同板重复出租，重复操作留审计记录
- **损伤复核流程**: 初检-复核两级定损机制
- **批次处理**: 支持批量提交租赁单，异常自动拆分
- **审计追踪**: 所有操作留痕，支持单条记录到汇总结果追踪
- **报告导出**: 支持订单详情、批次汇总、安全报告导出

## 技术栈

- Spring Boot 3.2.5
- Spring Data JPA
- H2 内存数据库
- Lombok
- Jakarta Validation

## 快速启动

### 环境要求

- JDK 17+
- Maven 3.8+

### 启动服务

```bash
# 编译打包
mvn clean package -DskipTests

# 启动服务
java -jar target/ski-binding-rental-1.0.0.jar

# 或者直接运行
mvn spring-boot:run
```

服务启动后访问:
- API 地址: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:skirental`
  - Username: `admin`
  - Password: `admin`

### 轻量自检

服务启动后可运行自检接口验证所有功能：

```bash
curl http://localhost:8080/api/rental/self-check
```

## 初始化数据

服务启动时自动初始化测试数据：

- **5 块雪板**: BOARD-001 ~ BOARD-005，包含绑定器参数
- **5 位租客**: CUST-001 ~ CUST-005，包含身高体重鞋码信息

如需重置数据：

```bash
curl -X POST http://localhost:8080/api/rental/reset-data
```

## API 示例

### 1. 批次提交租赁单

```bash
curl -X POST http://localhost:8080/api/rental/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batchNo": "BATCH-20240101-001",
    "operator": "前台小张",
    "rentals": [
      {
        "customerId": "CUST-001",
        "boardCode": "BOARD-001",
        "actualReleaseValue": 7.0,
        "rentalFee": 200,
        "operator": "前台小张"
      },
      {
        "customerId": "CUST-002",
        "boardCode": "BOARD-002",
        "actualReleaseValue": 8.5,
        "rentalFee": 200,
        "operator": "前台小张"
      }
    ]
  }'
```

### 2. 单条提交（参数不匹配异常场景）

```bash
curl -X POST http://localhost:8080/api/rental/single \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-001",
    "boardCode": "BOARD-001",
    "actualReleaseValue": 15.0,
    "rentalFee": 200,
    "operator": "前台小张"
  }'
```

### 3. 异常拆分

```bash
curl http://localhost:8080/api/rental/batch/BATCH-20240101-001/split-exceptions
```

### 4. 完成出租

```bash
# 先获取订单号，然后执行出租
curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/rent-out?operator=管理员'
```

### 5. 重复出租拦截（失败路径演示）

```bash
# 对已出租的订单再次执行出租操作
curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/rent-out?operator=管理员'

# 查看审计日志，会记录重复操作尝试
curl http://localhost:8080/api/rental/orders/ORDxxxxxxx/audit
```

### 6. 归还检查（带损伤）

```bash
curl -X POST http://localhost:8080/api/rental/return-inspection \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "ORDxxxxxxx",
    "overallDamageLevel": "MINOR",
    "estimatedDamageFee": 100,
    "inspectorNote": "板刃有轻微划痕",
    "inspector": "检修员小李",
    "inspectionItems": [
      {
        "itemName": "板刃磨损",
        "damageLevel": "MINOR",
        "description": "左侧板刃3cm划痕",
        "estimatedFee": 100
      }
    ]
  }'
```

### 7. 损伤复核

```bash
curl -X POST http://localhost:8080/api/rental/damage-review \
  -H "Content-Type: application/json" \
  -d '{
    "orderNo": "ORDxxxxxxx",
    "finalDamageFee": 80,
    "damageConfirmed": true,
    "reviewNote": "确认为轻微磨损，实际定损80元",
    "reviewer": "值班经理"
  }'
```

### 8. 收取费用 & 结案

```bash
# 收取费用（自动触发结案）
curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/charge-fee?operator=收银员'
```

### 9. 归档

```bash
curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/archive?operator=档案管理员'
```

### 10. 导出报告

```bash
# 导出订单详情（含审计追踪）
curl http://localhost:8080/api/rental/reports/order/ORDxxxxxxx/export

# 导出批次汇总
curl http://localhost:8080/api/rental/reports/batch/BATCH-20240101-001/export

# 生成安全报告
curl -X POST 'http://localhost:8080/api/rental/reports/safety/ORDxxxxxxx?operator=安全员'
```

## 失败路径演示

### 场景1: 参数不匹配无法出租

```bash
# 1. 提交超出释放值范围的租赁单
curl -X POST http://localhost:8080/api/rental/single \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-001",
    "boardCode": "BOARD-001",
    "actualReleaseValue": 15.0,
    "rentalFee": 200,
    "operator": "前台"
  }'

# 2. 查看异常状态
curl http://localhost:8080/api/rental/exceptions

# 3. 尝试直接出租（状态机拦截）
# 会返回状态转换无效的错误
```

### 场景2: 同板重复出租拦截

```bash
# 1. 正常出租一块雪板
# 假设返回订单号为 ORD000000000001

# 2. 尝试用同一块雪板创建新租赁单
curl -X POST http://localhost:8080/api/rental/single \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-002",
    "boardCode": "BOARD-001",
    "actualReleaseValue": 7.0,
    "rentalFee": 200,
    "operator": "前台"
  }'

# 返回: "雪板 BOARD-001 正在出租中，无法重复出租"
# 审计日志中会记录 DUPLICATE_ATTEMPT
```

### 场景3: 重复操作留痕不重复执行

```bash
# 对同一订单多次执行出租操作
curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/rent-out?operator=管理员'
# 第一次: 成功出租

curl -X POST 'http://localhost:8080/api/rental/ORDxxxxxxx/rent-out?operator=管理员'
# 第二次及以后: "该订单已完成出租，重复操作已记录审计"

# 查看审计日志可追踪所有重复尝试
curl http://localhost:8080/api/rental/orders/ORDxxxxxxx/audit
```

## 状态机流转

```
PENDING_SUBMIT → PARAMS_VALIDATING → PARAMS_MISMATCH
                                      ↓
                           RENTAL_READY → RENTED → RETURN_PENDING
                                                          ↓
                                                RETURN_INSPECTING
                                                      ↙   ↘
                                         DAMAGE_FOUND   COMPLETED
                                               ↓
                                         DAMAGE_REVIEWING
                                           ↙    ↘
                            DAMAGE_CONFIRMED    COMPLETED
                                   ↓
                               FEE_CHARGED
                                   ↓
                               COMPLETED → ARCHIVED
```

## API 端点清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/rental/batch` | 批次提交租赁单 |
| POST | `/api/rental/single` | 单条提交租赁单 |
| POST | `/api/rental/{orderNo}/rent-out` | 完成出租 |
| POST | `/api/rental/{orderNo}/request-return` | 申请归还 |
| POST | `/api/rental/return-inspection` | 提交归还检查 |
| POST | `/api/rental/damage-review` | 损伤复核 |
| POST | `/api/rental/{orderNo}/charge-fee` | 收取费用 |
| POST | `/api/rental/{orderNo}/archive` | 归档订单 |
| PUT | `/api/rental/{orderNo}/modify` | 修改订单参数 |
| GET | `/api/rental/batch/{batchNo}/split-exceptions` | 异常拆分 |
| GET | `/api/rental/orders/{orderNo}` | 查询订单 |
| GET | `/api/rental/exceptions` | 查询异常订单 |
| GET | `/api/rental/orders/{orderNo}/audit` | 查询订单审计 |
| GET | `/api/rental/reports/order/{orderNo}/export` | 导出订单详情 |
| GET | `/api/rental/reports/batch/{batchNo}/export` | 导出批次报告 |
| GET | `/api/rental/self-check` | 服务自检 |
| POST | `/api/rental/reset-data` | 重置测试数据 |
