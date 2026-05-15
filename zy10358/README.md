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

### ✅ 环境要求

- **Java**: 1.8 或更高版本（已测试兼容Java 8, 11, 17）
- **Maven**: 无需预装 - 项目已包含 Maven Wrapper

---

### 🚀 方式一：一键启动脚本（推荐）

```bash
./start.sh
```

**脚本功能**:
- ✅ 自动检测Java版本
- ✅ 优先使用系统Maven（如已安装）
- ✅ 自动使用预生成的Maven Wrapper
- ✅ 显示访问地址和使用说明

---

### 💡 方式二：直接使用 Maven Wrapper

项目已预生成完整Maven Wrapper，可直接运行：

```bash
# 直接启动（会自动下载依赖）
./mvnw spring-boot:run

# 或编译打包
./mvnw clean package -DskipTests
java -jar target/fee-calculation-api-1.0.0.jar
```

> **首次运行**: Maven Wrapper会自动下载依赖，请保持网络连接。

---

### 🎯 方式三：IDE运行（最简单、无需构建工具）

**完全不需要Maven，直接在IDE中运行：**

1. 用 **IntelliJ IDEA** 或 **Eclipse** 打开项目目录
2. 找到启动类：
   ```
   src/main/java/com/feiyong/feecalc/FeeCalculationApplication.java
   ```
3. 右键 → **Run 'FeeCalculationApplication'**

这是最简单的方式，IDE会自动处理所有依赖！

---

### 🌐 访问地址

服务启动后访问：

- **管理控制台**: http://localhost:8080
  - ✅ 创建费用试算
  - ✅ 价格锁定
  - ✅ 执行扣费
  - ✅ 导出排查报告
  
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

### 7. 生成问题排查汇总

```bash
curl http://localhost:8080/api/fee/diagnosis/FEE123456789
```

### 8. 导出文本报告

```bash
curl -O -J http://localhost:8080/api/fee/export/text/FEE123456789
```

### 9. 导出JSON报告

```bash
curl -O -J http://localhost:8080/api/fee/export/json/FEE123456789
```

## 功能验证

服务启动后，运行验证脚本测试所有功能：

```bash
./verify.sh
```

**验证内容**（共9项）:
1. ✅ 创建费用试算
2. ✅ 查询试算结果
3. ✅ 锁定价格
4. ✅ 校验锁价凭证
5. ✅ 查询操作时间线
6. ✅ 生成问题排查汇总
7. ✅ 执行扣费
8. ✅ 导出文本报告
9. ✅ 导出JSON报告

## 问题排查汇总导出说明

导出的汇总报告包含：

- **基本信息**: 请求号、业务单号、状态、价格规则、数量
- **费用明细**: 原价、折扣、最终金额
- **费用构成**: 每条费用项的名称、金额、说明
- **锁价凭证**: 凭证号、锁定金额、锁定时间、过期状态、扣费信息
- **操作时间线**: 完整的操作记录，包括时间、动作、操作者
- **排查建议**: 根据状态给出对应的处理建议

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
