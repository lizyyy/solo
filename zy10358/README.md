# 费用试算 API

基于 Spring Boot 的单体后端服务，提供完整的费用试算、价格锁定、凭证校验、扣费执行等功能。

## 功能特性

### 核心功能
- ✅ **规则试算** - 基于价格规则和折扣规则计算最终费用
- ✅ **明细解释** - 展示费用构成明细，包含基础费用、减免项等
- ✅ **锁价凭证** - 试算成功后可生成价格锁定凭证
- ✅ **过期失效** - 凭证自动过期，支持自定义过期策略
- ✅ **扣费校验** - 扣费前校验凭证有效性，防止重复扣费

### 接口层
- ✅ **创建试算** - `POST /api/fee/calculate`
- ✅ **查询结果** - `GET /api/fee/result/{requestNo}`
- ✅ **锁定价格** - `POST /api/fee/lock/{requestNo}`
- ✅ **校验凭证** - `GET /api/fee/validate/{certificateNo}`
- ✅ **执行扣费** - `POST /api/fee/charge/{certificateNo}`
- ✅ **时间线** - `GET /api/fee/timeline/{requestNo}`

### 其他特性
- ✅ **防重复提交** - 相同业务单号只计算一次
- ✅ **完整时间线** - 记录每个关键操作的时间、内容、操作者
- ✅ **H2内存数据库** - 开箱即用，无需额外配置
- ✅ **Web管理页面** - 简单易用的测试控制台

## 技术栈

- **框架**: Spring Boot 2.7.x
- **数据库**: H2 (内存模式)
- **ORM**: Spring Data JPA
- **工具库**: Hutool, FastJSON, Lombok
- **前端**: 原生 HTML + JavaScript

## 快速开始

### 启动服务

```bash
mvn clean package
java -jar target/fee-calculation-api-1.0.0.jar
```

或者直接运行：

```bash
mvn spring-boot:run
```

### 访问地址

- **管理控制台**: http://localhost:8080
- **H2数据库控制台**: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:fee_calc_db`
  - 用户名: `sa`
  - 密码: (空)

## API 使用示例

### 1. 创建费用试算

```bash
curl -X POST http://localhost:8080/api/fee/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "bizType": "ORDER",
    "bizNo": "TEST001",
    "ruleCode": "VIP_MEMBERSHIP",
    "quantity": 12,
    "discountCodes": ["NEW_USER_10", "COUPON_50"]
  }'
```

### 2. 查询试算结果

```bash
curl http://localhost:8080/api/fee/result/FEE123456789
```

### 3. 锁定价格

```bash
curl -X POST http://localhost:8080/api/fee/lock/FEE123456789
```

### 4. 校验锁价凭证

```bash
curl http://localhost:8080/api/fee/validate/LOCK123456789
```

### 5. 执行扣费

```bash
curl -X POST http://localhost:8080/api/fee/charge/LOCK123456789
```

### 6. 查询操作时间线

```bash
curl http://localhost:8080/api/fee/timeline/FEE123456789
```

## 预置数据

### 价格规则 (PriceRule)
- `VIP_MEMBERSHIP` - VIP会员订阅, 99元/月
- `CLOUD_STORAGE` - 云存储服务, 10元基础费 + 0.5元/GB

### 折扣项 (DiscountItem)
- `NEW_USER_10` - 新用户9折, 百分比折扣
- `COUPON_50` - 50元优惠券, 满100元可用

### 过期策略 (ExpirationStrategy)
- `DEFAULT` - 默认30分钟过期

## 数据模型

### CalculationRequest (试算请求)
- requestNo: 请求号 (FEE开头)
- bizType: 业务类型
- bizNo: 业务单号（唯一索引）
- status: 状态 (CREATED/CALCULATING/SUCCESS/LOCKED/CHARGED/EXPIRED/FAILED)
- originalAmount: 原价
- discountAmount: 折扣金额
- finalAmount: 最终金额
- expiredAt: 过期时间

### PriceLockCertificate (锁价凭证)
- certificateNo: 凭证号 (LOCK开头)
- requestNo: 关联的试算请求号
- lockedAmount: 锁定金额
- lockedAt: 锁定时间
- expiredAt: 过期时间
- valid: 是否有效
- chargedBy: 扣费操作者
- chargedAt: 扣费时间

### ActionTimeline (时间线)
- requestNo: 试算请求号
- action: 动作类型
- actionDesc: 动作描述
- beforeData: 变更前数据
- afterData: 变更后数据
- operator: 操作者
- actionTime: 动作时间

## 状态流转

```
CREATED (已创建)
    ↓
CALCULATING (计算中)
    ↓
SUCCESS (试算成功) ←→ FAILED (失败)
    ↓
LOCKED (已锁价)
    ↓
CHARGED (已扣费) 或 EXPIRED (已过期)
```

## 问题排查

1. **查看完整时间线**: 调用 `/api/fee/timeline/{requestNo}` 查看所有操作记录
2. **查看数据库**: 访问 H2 控制台查看详细数据
3. **查看日志**: 控制台输出详细的操作日志

## 项目结构

```
src/main/java/com/feiyong/feecalc/
├── FeeCalculationApplication.java  # 启动类
├── config/
│   └── DataInitializer.java        # 数据初始化
├── controller/
│   ├── FeeCalculationController.java
│   └── GlobalExceptionHandler.java
├── dto/
│   ├── ApiResponse.java
│   ├── CalculateRequest.java
│   ├── CalculateResult.java
│   └── FeeDetailVo.java
├── entity/
│   ├── ActionTimeline.java
│   ├── CalculationRequest.java
│   ├── DiscountItem.java
│   ├── ExpirationStrategy.java
│   ├── FeeDetail.java
│   └── PriceLockCertificate.java
│   └── PriceRule.java
├── enums/
│   ├── CalculationStatus.java
│   └── DiscountType.java
├── repository/
│   └── *Repository.java
└── service/
    ├── DiagnosisService.java
    ├── ExpirationCleanupService.java
    ├── FeeCalculationService.java
    └── TimelineService.java
```
