# 酒店遗失物认领 API

基于 Spring Boot 的酒店遗失物管理后端服务，支持遗失物登记、核验、认领、邮寄、处置、补证、复盘和导出等完整功能。

## 功能特性

### 核心业务流程
- **新建登记**：遗失物信息录入，自动生成编号和到期时间
- **身份核验**：支持贵重物品强制复核机制
- **认领管理**：身份核验 + 物品描述匹配双重验证
- **邮寄归还**：快递单留痕，支持签收跟踪
- **到期处置**：90天无人认领自动标记，贵重物品需经理审批
- **补证留痕**：所有补充材料记录在案
- **复盘查询**：完整状态流转历史可追溯
- **统计导出**：Excel 导出，数据与查询结果一致

### 关键保障机制
- **状态机管控**：严格的状态流转规则，防止非法操作
- **幂等性处理**：重复请求返回原结果或明确冲突提示
- **防止重复认领**：已认领物品不可二次认领
- **贵重物品复核**：价值 ≥500元 强制标记贵重，处置需经理审批
- **到期自动提醒**：提前7天提醒，到期自动处理
- **完整审计日志**：所有状态变更记录操作人和时间戳

## 技术栈

- **框架**: Spring Boot 3.2.x
- **数据库**: H2 (嵌入式文件存储)
- **ORM**: Spring Data JPA
- **构建工具**: Maven
- **导出**: Apache POI (Excel)
- **JDK**: 17+

## 项目结构

```
src/main/java/com/hotel/lostfound/
├── LostFoundApplication.java          # 启动类
├── common/
│   └── ApiResponse.java               # 统一响应封装
├── controller/
│   └── LostItemController.java        # REST API 接口
├── dto/
│   ├── request/                       # 请求DTO
│   └── response/                      # 响应DTO
├── entity/
│   ├── enums/                         # 枚举定义
│   ├── LostItem.java                  # 遗失物主表
│   ├── ClaimRecord.java               # 认领记录
│   ├── MailRecord.java                # 邮寄记录
│   ├── DisposalRecord.java            # 处置记录
│   ├── SupplementRecord.java          # 补证记录
│   ├── StatusHistory.java             # 状态历史
│   └── IdempotentRecord.java          # 幂等记录
├── exception/
│   ├── BusinessException.java         # 业务异常
│   ├── DuplicateRequestException.java # 重复请求异常
│   └── GlobalExceptionHandler.java    # 全局异常处理
├── repository/                        # 数据访问层
└── service/
    ├── LostItemService.java           # 核心业务服务
    ├── StatusMachineService.java      # 状态机服务
    ├── IdempotentService.java         # 幂等性服务
    ├── StatisticsService.java         # 统计服务
    ├── ExportService.java             # 导出服务
    └── ScheduledTaskService.java      # 定时任务服务
```

## 快速开始

### 1. 构建项目
```bash
./mvnw clean package -DskipTests
```

### 2. 启动服务
```bash
java -jar target/lost-and-found-api-1.0.0.jar
```

注意：如果 8080 端口被占用，可以指定其他端口：
```bash
java -jar target/lost-and-found-api-1.0.0.jar --server.port=8081
```

### 3. 访问服务
- API 地址: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./data/lostfound`
  - 用户名: `sa`
  - 密码: (空)

## API 接口

### 统一响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1716556800000
}
```

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/lost-items` | 新建遗失物登记 |
| POST | `/api/lost-items/verify` | 审核核验物品 |
| POST | `/api/lost-items/claim` | 认领物品 |
| POST | `/api/lost-items/mail` | 邮寄归还 |
| POST | `/api/lost-items/dispose` | 处置物品 |
| POST | `/api/lost-items/supplement` | 补充凭证 |
| GET | `/api/lost-items/{id}` | 查询详情 |
| GET | `/api/lost-items` | 分页查询列表 |
| GET | `/api/lost-items/expiring` | 查询即将到期 |
| GET | `/api/lost-items/statistics` | 获取统计数据 |
| POST | `/api/lost-items/export` | 导出Excel |

### 核心接口示例

#### 1. 新建遗失物
```bash
curl -X POST http://localhost:8080/api/lost-items \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ2024052400001",
    "itemName": "黑色钱包",
    "description": "内含身份证和银行卡",
    "category": "VALUABLES",
    "estimatedValue": 800,
    "roomNumber": "302",
    "pickUpLocation": "大堂沙发",
    "pickedByStaff": "张三",
    "storageLocation": "前台保险柜A1",
    "foundTime": "2024-05-24T10:30:00",
    "ownerName": "李四",
    "ownerPhone": "13800138000",
    "operator": "王五"
  }'
```

#### 2. 审核核验
```bash
curl -X POST http://localhost:8080/api/lost-items/verify \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "VER2024052400001",
    "itemId": 1,
    "isVerified": true,
    "verifyRemark": "物品信息核实无误",
    "verifier": "经理"
  }'
```

#### 3. 认领物品
```bash
curl -X POST http://localhost:8080/api/lost-items/claim \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "CLAIM2024052400001",
    "itemId": 1,
    "claimantName": "李四",
    "claimantPhone": "13800138000",
    "idType": "ID_CARD",
    "idNumber": "110101199001011234",
    "identificationVerified": true,
    "itemDescriptionMatched": true,
    "approved": true,
    "handledBy": "前台员工",
    "claimTime": "2024-05-24T15:00:00"
  }'
```

#### 4. 导出Excel
```bash
curl -X POST http://localhost:8080/api/lost-items/export \
  -H "Content-Type: application/json" \
  -d '{"requestId": "EXPORT001"}' \
  --output lost-items.xlsx
```

## 状态流转图

```
REGISTERED (登记)
    ↓
PENDING_VERIFICATION (待核验)
    ↓
VERIFIED (已核验)
    ↓
PENDING_CLAIM (待认领)
    ↓
CLAIMED (已认领) / MAILED (已邮寄)

或:

REGISTERED/VERIFIED
    ↓
PENDING_DISPOSAL (待处置)
    ↓
DISPOSED (已处置) / EXPIRED (已到期)
```

## 配置说明

在 `application.yml` 中可配置：

```yaml
app:
  lost-item:
    expired-days: 90          # 到期天数
    valuable-amount: 500      # 贵重物品阈值(元)
```

## 定时任务

- **每天 9:00**：自动检查并标记到期物品
- **每天 8:30**：发送7天内到期提醒
- **每天 10:00**：检查待审批贵重物品处置申请

## 注意事项

1. **幂等性**：所有写操作必须传入唯一 `requestId`，重复请求返回 409 和原结果
2. **贵重物品**：预估价值 ≥500元 自动标记，处置需经理审批
3. **身份核验**：认领必须完成身份核验，否则无法通过
4. **防止重复认领**：已通过认领的物品不可再次认领
5. **数据一致性**：导出使用相同查询条件，确保统计结果一致
