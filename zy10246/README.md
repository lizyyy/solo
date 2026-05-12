# 机场贵宾厅券核销 API

一个完整的机场贵宾厅券核销系统，支持银行券和企业券，具备本地持久化、种子数据和可复现调用脚本。

## 功能特性

- ✅ **发券**：支持银行券和企业券
- ✅ **绑定旅客**：券与旅客信息绑定
- ✅ **核销**：贵宾厅前台核销
- ✅ **退券**：退款回滚，额度自动恢复
- ✅ **对账**：来源方对账，差异检测
- ✅ **额度查询**：企业账户额度管理
- ✅ **幂等性**：重复提交不会重复处理
- ✅ **边界情况处理**：
  - 同一券重复核销
  - 旅客姓名不匹配
  - 退券后额度恢复
  - 企业额度超限

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化种子数据

```bash
npm run seed
```

### 3. 运行完整流程演示

```bash
npm run test-flow
```

### 4. 运行对账差异演示

```bash
npm run test-reconciliation
```

### 5. 启动 API 服务器

```bash
npm start
```

服务器启动后访问 `http://localhost:3000`

## API 接口

### 发券
```bash
POST /api/vouchers/issue
Content-Type: application/json

{
  "type": "corporate",
  "sourceId": "CORP_AIRLINE_A",
  "corporateId": "xxx",
  "amount": 1,
  "requestId": "req_001"
}
```

### 绑定旅客
```bash
POST /api/vouchers/bind
Content-Type: application/json

{
  "voucherCode": "VOUCH-XXX",
  "passengerName": "张三",
  "idCard": "110101199001011234",
  "requestId": "req_002"
}
```

### 核销
```bash
POST /api/vouchers/redeem
Content-Type: application/json

{
  "voucherCode": "VOUCH-XXX",
  "passengerName": "张三",
  "requestId": "req_003"
}
```

### 退券
```bash
POST /api/vouchers/refund
Content-Type: application/json

{
  "voucherCode": "VOUCH-XXX",
  "reason": "旅客取消行程",
  "requestId": "req_004"
}
```

### 额度查询
```bash
GET /api/vouchers/quota/:corporateId
```

### 对账
```bash
POST /api/vouchers/reconcile/:sourceId
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "externalData": {
    "totalUsed": 100,
    "totalRefunded": 5,
    "totalAmount": 105
  }
}
```

### 对账明细
```bash
GET /api/vouchers/reconcile/:sourceId/details
```

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js      # 数据库配置（lowdb）
│   ├── models/
│   │   ├── Voucher.js       # 券模型
│   │   ├── Passenger.js     # 旅客模型
│   │   ├── CorporateAccount.js  # 企业账户模型
│   │   └── Transaction.js   # 交易记录模型
│   ├── services/
│   │   ├── voucherService.js     # 券核心业务逻辑
│   │   └── reconciliationService.js  # 对账服务
│   ├── routes/
│   │   └── vouchers.js      # API 路由
│   └── server.js            # 服务器入口
├── scripts/
│   ├── seed.js              # 种子数据脚本
│   ├── test-flow.js         # 完整流程演示脚本
│   └── test-reconciliation.js  # 对账差异演示脚本
├── data/                    # 数据持久化目录
├── package.json
└── README.md
```

## 数据持久化

使用 lowdb 本地文件存储，数据保存在 `data/db.json`

## 调用顺序说明

### 成功核销流程
1. `issue` → 发券
2. `bind` → 绑定旅客
3. `redeem` → 核销成功

### 退券回滚流程
1. `issue` → 发券
2. `bind` → 绑定旅客
3. `redeem` → 核销
4. `refund` → 退券回滚（企业额度自动恢复）

### 对账差异流程
1. 批量发券、绑定、核销、退券
2. 调用 `reconcile` 接口传入外部数据
3. 系统自动检测差异并报告

## 许可证

MIT