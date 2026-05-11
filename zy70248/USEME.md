# 码头岸电接入结算 API 使用说明

## 项目概述

这是一套完整的码头岸电接入结算系统 API，用于管理船舶靠港接岸电后的用电结算流程。系统覆盖了从船舶靠泊、岸电读数、合同电价，到中断事件处理、结算分摊和对账报表的完整业务流程。

## 技术栈

- **Node.js** - 运行时环境
- **Express.js** - Web 框架
- **Moment.js** - 日期时间处理
- **UUID** - 唯一标识符生成
- **内存存储** - 数据持久化（演示用）

## 项目结构

```
.
├── src/
│   ├── server.js              # 主服务器入口
│   ├── data/
│   │   └── store.js           # 内存数据存储
│   ├── routes/
│   │   ├── ships.js           # 船舶管理路由
│   │   ├── berthings.js       # 靠泊管理路由
│   │   ├── contracts.js       # 合同管理路由
│   │   ├── meterReadings.js   # 电表读数路由
│   │   ├── interruptions.js   # 中断事件路由
│   │   └── settlements.js     # 结算管理路由
│   ├── services/
│   │   ├── shipService.js          # 船舶服务
│   │   ├── berthingService.js      # 靠泊服务（含状态流转）
│   │   ├── contractService.js      # 合同服务
│   │   ├── meterService.js         # 电表服务
│   │   ├── interruptionService.js  # 中断服务
│   │   └── settlementService.js    # 结算服务
│   └── utils/
│       └── errors.js          # 业务错误定义
├── tests/
│   ├── apiClient.js           # API 客户端工具
│   ├── successfulScenario.js  # 顺利样例测试脚本
│   ├── reviewScenario.js      # 复核样例测试脚本
│   └── runAll.js              # 综合测试脚本
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 运行测试脚本

#### 运行全部测试（自动启动服务器）

```bash
node tests/runAll.js --start-server
```

#### 先启动服务器，再运行测试

终端 1:
```bash
npm start
```

终端 2:
```bash
node tests/runAll.js
```

#### 单独运行顺利样例

```bash
# 先启动服务器
npm start

# 另一个终端
node tests/successfulScenario.js
```

#### 单独运行复核样例

```bash
# 先启动服务器
npm start

# 另一个终端
node tests/reviewScenario.js
```

## 业务流程说明

### 状态流转

#### 靠泊状态流转

```
ARRIVING (到达中)
    ↓
DOCKED (已靠泊)
    ↓
SHORE_POWER_CONNECTED (岸电已连接)
    ↓
USING_SHORE_POWER (使用岸电中)
    ↓
DISCONNECTING_POWER (断开岸电)
    ↓
PREPARING_DEPARTURE (准备离港)
    ↓
DEPARTED (已离港)
```

也可以从 `ARRIVING` 直接跳转到 `CANCELLED` (取消靠泊)。

#### 结算状态流转

```
PENDING_REVIEW (待复核)
    ↓
APPROVED (已批准) 或 REJECTED (已驳回)
    ↓
PAID (已支付)
```

### 核心业务差异点

1. **岸电读数差异**
   - 支持峰谷电价和固定电价两种合同类型
   - 读数必须严格递增，时间必须按顺序
   - 读数异常会触发复核机制

2. **靠泊时段差异**
   - 靠泊总时长与实际用电时长会进行比对
   - 差异超过 20% 会触发复核
   - 确保结算时段与实际用电时段一致

3. **中断结算差异**
   - 支持多种中断类型（设备故障、维护、天气等）
   - 中断时长超过 8 小时触发复核
   - 中断影响电量从总用电量中扣除

## API 接口说明

### 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`

### 健康检查

```bash
GET /health
```

### 船舶管理

#### 创建船舶
```bash
POST /api/ships
Content-Type: application/json

{
  "name": "海洋之星号",
  "imoNumber": "IMO9700001",
  "flag": "巴拿马",
  "grossTonnage": 50000,
  "operator": "环球航运",
  "vesselType": "集装箱船"
}
```

#### 查询所有船舶
```bash
GET /api/ships
```

#### 查询单个船舶
```bash
GET /api/ships/:id
```

### 靠泊管理

#### 创建靠泊计划
```bash
POST /api/berthings
Content-Type: application/json

{
  "shipId": "船舶ID",
  "terminal": "T1 集装箱码头",
  "berthNumber": "B-12",
  "voyageNumber": "VY-2026-0511",
  "cargoType": "集装箱"
}
```

#### 状态流转接口
```bash
# 船舶靠泊
POST /api/berthings/:id/dock

# 连接岸电
POST /api/berthings/:id/connect-power

# 开始使用岸电
POST /api/berthings/:id/start-usage

# 断开岸电
POST /api/berthings/:id/disconnect-power

# 准备离港
POST /api/berthings/:id/prepare-departure

# 船舶离港
POST /api/berthings/:id/depart

# 取消靠泊
POST /api/berthings/:id/cancel
```

### 合同管理

#### 创建合同
```bash
POST /api/contracts
Content-Type: application/json

# 固定电价合同
{
  "shipId": "船舶ID",
  "contractType": "FLAT_RATE",
  "electricityPrice": 1.2,
  "currency": "CNY",
  "startDate": "2026-05-01",
  "endDate": "2026-06-01",
  "minimumCharge": 100,
  "contractNumber": "CT-2026-001"
}

# 峰谷电价合同
{
  "shipId": "船舶ID",
  "contractType": "PEAK_OFFPEAK",
  "electricityPrice": 1.0,
  "peakPrice": 1.5,
  "offPeakPrice": 0.8,
  "peakHours": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  "currency": "CNY",
  "startDate": "2026-05-01",
  "endDate": "2026-06-01",
  "contractNumber": "CT-2026-002"
}
```

#### 查询船舶当前有效合同
```bash
GET /api/contracts/active/:shipId?date=2026-05-11
```

### 电表读数

#### 记录读数
```bash
POST /api/meter-readings
Content-Type: application/json

{
  "berthingId": "靠泊ID",
  "kwh": 1500,
  "readingTime": "2026-05-11T10:00:00.000Z",
  "meterId": "METER-001",
  "source": "AUTOMATIC"
}
```

#### 查询靠泊的所有读数
```bash
GET /api/meter-readings/berthing/:berthingId
```

#### 查询用电量统计
```bash
GET /api/meter-readings/berthing/:berthingId/usage
```

### 中断事件

#### 创建中断
```bash
POST /api/interruptions
Content-Type: application/json

{
  "berthingId": "靠泊ID",
  "startTime": "2026-05-11T08:00:00.000Z",
  "type": "EQUIPMENT_FAILURE",
  "reason": "岸电转换设备故障",
  "responsibleParty": "TERMINAL",
  "notes": "设备需要紧急维修"
}
```

#### 解决中断
```bash
POST /api/interruptions/:id/resolve
Content-Type: application/json

{
  "endTime": "2026-05-11T12:00:00.000Z",
  "impactKwh": 100,
  "notes": "设备已修复"
}
```

#### 取消中断
```bash
POST /api/interruptions/:id/cancel
```

#### 查询靠泊的中断事件
```bash
GET /api/interruptions/berthing/:berthingId
```

### 结算管理

#### 预计算结算（不保存）
```bash
POST /api/settlements/calculate/:berthingId
```

#### 创建结算
```bash
POST /api/settlements/create/:berthingId
```

#### 批准结算
```bash
POST /api/settlements/:id/approve
Content-Type: application/json

{
  "reviewer": "财务-张三"
}
```

#### 驳回结算
```bash
POST /api/settlements/:id/reject
Content-Type: application/json

{
  "reason": "读数异常，需要核实",
  "reviewer": "复核专员-李四"
}
```

#### 标记为已支付
```bash
POST /api/settlements/:id/pay
Content-Type: application/json

{
  "paymentReference": "PAY-2026-0511-001"
}
```

### 对账报表

#### 生成对账报表
```bash
POST /api/settlements/reconciliation
Content-Type: application/json

{
  "settlementIds": ["结算ID1", "结算ID2"]
}
```

#### 查询所有对账报表
```bash
GET /api/settlements/reconciliation
```

## 演示样例说明

### 样例 1：顺利流程

测试脚本：`tests/successfulScenario.js`

**流程步骤：**
1. 创建船舶"海洋之星号"
2. 创建固定电价合同（1.2 元/度）
3. 创建靠泊计划
4. 完成靠泊状态流转（靠泊 → 连接岸电 → 使用岸电）
5. 记录 3 次岸电读数（初始、中间、最终）
6. 完成离港流程
7. 创建结算（500 kWh，600 元）
8. 批准结算
9. 标记为已支付
10. 生成对账报表

**预期结果：**
- 顺利完成所有步骤
- 结算金额：600 元（500 kWh × 1.2 元/度）
- 对账报表显示：总单数 1，总金额 600 元

### 样例 2：复核流程

测试脚本：`tests/reviewScenario.js`

**流程步骤：**
1. 创建船舶"远航一号"
2. 创建峰谷电价合同（平时 1.0 元，峰时 1.5 元，谷时 0.8 元）
3. 创建靠泊计划
4. 完成靠泊状态流转
5. 记录初始读数（2000 kWh）
6. 创建设备故障中断事件
7. 解决中断（9 小时，影响电量 150 kWh）
8. 记录最终读数（2800 kWh，总用电量 800 kWh）
9. 完成离港流程
10. 创建结算（触发复核：中断超时 + 时段差异）
11. 驳回第一次结算
12. 重新创建结算
13. 批准新结算
14. 生成对账报表

**预期结果：**
- 触发 2 个复核条件
- 第一次结算被驳回
- 净用电量：650 kWh（800 - 150 中断扣减）
- 成功生成最终结算和对账报表

## 业务错误码说明

| 错误码 | 说明 |
|--------|------|
| SHIP_NOT_FOUND | 船舶不存在 |
| BERTHING_NOT_FOUND | 靠泊记录不存在 |
| CONTRACT_NOT_FOUND | 合同不存在 |
| NO_ACTIVE_CONTRACT | 没有有效的合同 |
| BERTHING_STATE_INVALID | 靠泊状态无效 |
| READING_DECREASED | 岸电读数不能递减 |
| READING_SEQUENCE_ERROR | 读数时间顺序错误 |
| INTERRUPTION_OVERLAP | 中断事件时间重叠 |
| SETTLEMENT_ALREADY_REVIEWED | 结算已复核，无法修改 |
| READING_EXCEEDS_EXPECTED | 岸电读数超出预期范围 |
| DURATION_DISCREPANCY | 用电时长与靠泊时段存在差异 |
| INTERRUPTION_DURATION_EXCEEDS | 中断时长超过预期 |

## 手动测试流程

### 步骤 1：启动服务器

```bash
npm start
```

### 步骤 2：创建船舶

```bash
curl -X POST http://localhost:3000/api/ships \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试船舶",
    "imoNumber": "IMO1234567",
    "flag": "中国",
    "grossTonnage": 10000,
    "operator": "测试公司",
    "vesselType": "测试船"
  }'
```

### 步骤 3：创建合同

```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "shipId": "替换为船舶ID",
    "contractType": "FLAT_RATE",
    "electricityPrice": 1.0,
    "currency": "CNY",
    "startDate": "2026-05-01",
    "endDate": "2026-06-01",
    "contractNumber": "TEST-001"
  }'
```

### 步骤 4：创建靠泊并完成状态流转

```bash
# 创建靠泊
curl -X POST http://localhost:3000/api/berthings \
  -H "Content-Type: application/json" \
  -d '{
    "shipId": "替换为船舶ID",
    "terminal": "测试码头",
    "berthNumber": "T-01"
  }'

# 靠泊
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/dock

# 连接岸电
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/connect-power

# 开始使用岸电
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/start-usage
```

### 步骤 5：记录读数

```bash
# 初始读数
curl -X POST http://localhost:3000/api/meter-readings \
  -H "Content-Type: application/json" \
  -d '{
    "berthingId": "替换为靠泊ID",
    "kwh": 1000,
    "readingTime": "2026-05-11T08:00:00.000Z"
  }'

# 最终读数
curl -X POST http://localhost:3000/api/meter-readings \
  -H "Content-Type: application/json" \
  -d '{
    "berthingId": "替换为靠泊ID",
    "kwh": 1500,
    "readingTime": "2026-05-11T12:00:00.000Z"
  }'
```

### 步骤 6：完成离港

```bash
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/disconnect-power
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/prepare-departure
curl -X POST http://localhost:3000/api/berthings/替换为靠泊ID/depart
```

### 步骤 7：创建并批准结算

```bash
# 创建结算
curl -X POST http://localhost:3000/api/settlements/create/替换为靠泊ID

# 批准结算
curl -X POST http://localhost:3000/api/settlements/替换为结算ID/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "测试人员"}'

# 标记为已支付
curl -X POST http://localhost:3000/api/settlements/替换为结算ID/pay \
  -H "Content-Type: application/json" \
  -d '{"paymentReference": "PAY-TEST-001"}'
```

### 步骤 8：生成对账报表

```bash
curl -X POST http://localhost:3000/api/settlements/reconciliation \
  -H "Content-Type: application/json" \
  -d '{"settlementIds": ["替换为结算ID"]}'
```

## 注意事项

1. **数据持久化**：本演示使用内存存储，重启服务后数据会丢失
2. **时间处理**：所有时间使用 ISO 8601 格式（UTC）
3. **状态流转**：必须严格按照状态流转顺序操作，否则会返回业务错误
4. **复核机制**：结算时会自动检查异常情况，触发复核后需要人工确认
5. **中断处理**：中断事件会影响最终结算金额，需要准确记录影响电量

## 扩展建议

- 集成真实数据库（如 PostgreSQL、MongoDB）
- 添加用户认证和授权
- 实现实时 WebSocket 通知
- 添加前端管理界面
- 集成支付系统
- 添加数据导出功能（Excel、PDF）
- 实现审计日志
