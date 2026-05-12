# 预付卡消费风控系统

一个完整的连锁门店预付卡消费风控API系统，支持跨店消费、风险监测、挂失管理、余额冻结和退款回滚。

---

## 🎯 系统特性

- **跨店消费支持**：预付卡可在任意门店消费
- **多维度风控**：挂失拦截、短时间多店刷卡检测、余额冻结检查
- **退款原路返回**：退款精确回退到原充值批次
- **幂等性保证**：重复请求/回调不重复执行
- **操作留痕**：人工修正记录前后差异和操作者
- **可视化报告**：卡片账本、风险事件、门店消费报告

---

## 📦 项目结构

```
.
├── app.py              # 主应用 (Flask API)
├── models.py           # 数据模型
├── risk_engine.py      # 风控规则引擎
├── demo.py             # 交互式演示脚本
├── requirements.txt    # 依赖列表
├── prepaid_card.db     # SQLite数据库 (运行后生成)
└── README.md           # 本文件
```

---

## 🚀 本地启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务器
```bash
python app.py
```
服务器将在 `http://127.0.0.1:5000` 启动

### 3. 运行完整演示
打开另一个终端：
```bash
pip install requests  # 如果未安装
python demo.py
```

---

## 🔧 核心API接口

### 1. 创建接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/stores` | POST | 创建门店 |
| `/api/v1/cards` | POST | 创建预付卡 |
| `/api/v1/cards/<card_id>/recharge` | POST | 充值 |

### 2. 交易接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/transactions/consume` | POST | 消费 |
| `/api/v1/transactions/<id>/refund` | POST | 退款 |
| `/api/v1/callback` | POST | 外部回调 |

### 3. 状态管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/cards/<id>/report-lost` | POST | 挂失 |
| `/api/v1/cards/<id>/resolve-lost` | POST | 解挂 |
| `/api/v1/cards/<id>/freeze` | POST | 冻结余额 |
| `/api/v1/cards/<id>/unfreeze` | POST | 解冻余额 |

### 4. 查询接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/cards` | GET | 卡片列表 |
| `/api/v1/cards/<id>` | GET | 卡片详情(含完整账本) |
| `/api/v1/cards/<id>/history` | GET | 交易历史 |
| `/api/v1/stores` | GET | 门店列表 |

### 5. 风险与异常处理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/risk/scan` | POST | 风险扫描 |
| `/api/v1/risk/<id>/resolve` | POST | 处理风险事件 |
| `/api/v1/manual-correction` | POST | 人工修正 |

### 6. 报告导出

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/reports/stores` | GET | 门店消费报告 |
| `/api/v1/reports/export` | GET | 系统总览导出 |

---

## 📊 主要演示路径

### 路径1：正常消费闭环
```
创建卡片 → 充值1000元 → 门店A消费200元 → 门店B消费300元 
→ 查询账本(余额500元) → 退款第一笔 → 余额恢复到700元
```

**验证点**：
- 充值后余额 = 可用余额 = 1000
- 消费200后余额 = 800，再消费300后 = 500
- 退款200后余额 = 700
- 交易历史包含所有操作

### 路径2：挂失拦截测试
```
充值500元 → 正常消费100元(成功) → 挂失卡片 
→ 尝试消费100元(被拦截) → 解挂 → 再次消费50元(成功)
```

**验证点**：
- 挂失后消费返回错误："卡片已挂失，禁止消费"
- 失败交易记录中 `failure_reason` 清晰说明原因
- 解挂后消费恢复正常

### 路径3：多店风险检测
```
充值2000元 → 门店A消费100 → 门店B消费200 → 门店C消费300
(30分钟内3家门店，触发风控)
```

**验证点**：
- 第3次消费被拦截
- 风险事件表产生 `MULTI_STORE_ABNORMAL` 记录
- 风险等级为 `HIGH`

### 路径4：幂等性测试
```
消费请求(request_id=TEST_001) → 再次发送相同请求
```

**验证点**：
- 第一次：扣款成功，余额减少
- 第二次：返回"重复请求，返回已有结果"，余额不变

---

## ❌ 失败路径示例

### 失败路径：挂失后消费
**预期失败**：卡片挂失后任何消费都应被拦截

**操作步骤**：
```bash
# 1. 挂失卡片
curl -X POST http://127.0.0.1:5000/api/v1/cards/CARD002/report-lost

# 2. 尝试消费 (应该失败)
curl -X POST http://127.0.0.1:5000/api/v1/transactions/consume \
  -H "Content-Type: application/json" \
  -d '{"card_id":"CARD002","store_id":"STORE001","amount":100}'
```

**预期响应**：
```json
{
  "success": false,
  "error": "卡片已挂失，禁止消费",
  "data": {
    "status": "FAILED",
    "failure_reason": "卡片已挂失，禁止消费"
  }
}
```

---

## 📋 如何判断业务闭环

### 1. 卡片账本检查
访问 `GET /api/v1/cards/CARD001`

```json
{
  "card": {
    "total_balance": 700,
    "available_balance": 700,
    "frozen_balance": 0,
    "status": "ACTIVE",
    "is_lost": false
  },
  "ledger": {
    "transactions": [
      {"type": "RECHARGE", "amount": 1000, "status": "SUCCESS"},
      {"type": "CONSUME", "amount": 200, "status": "SUCCESS"},
      {"type": "REFUND", "amount": 200, "status": "SUCCESS"}
    ],
    "batches": [...],
    "freezes": [],
    "corrections": [...]
  }
}
```

**验证**：
- `total_balance` 应该等于所有充值 - 消费 + 退款
- 交易历史完整，状态变化可追溯

### 2. 风险事件检查
访问 `POST /api/v1/risk/scan`

```json
{
  "risk_events": [
    {
      "risk_type": "MULTI_STORE_ABNORMAL",
      "risk_level": "HIGH",
      "status": "OPEN",
      "description": "检测到30分钟内在3家不同门店消费..."
    }
  ],
  "open_count": 1
}
```

**验证**：
- 多店消费后产生对应风险事件
- 风险状态、等级、描述清晰

### 3. 门店消费报告
访问 `GET /api/v1/reports/stores`

```json
{
  "store_reports": [
    {
      "store_id": "STORE001",
      "store_name": "北京朝阳门店",
      "total_transactions": 5,
      "success_count": 4,
      "fail_count": 1,
      "total_amount": 650
    }
  ]
}
```

**验证**：
- 各门店消费笔数、金额、成功率统计准确
- 失败交易被计数

### 4. 人工修正留痕
访问 `GET /api/v1/cards/CARD002` 查看 corrections

```json
{
  "corrections": [
    {
      "operator": "admin_001",
      "correction_type": "BALANCE_ADJUST",
      "reason": "客户投诉退款漏记",
      "before_state": "{\"available_balance\": 350}",
      "after_state": "{\"available_balance\": 450}"
    }
  ]
}
```

**验证**：
- 记录了操作者、修正类型、原因
- 明确的 before/after 状态对比

---

## 🔐 核心风控规则

| 规则 | 说明 | 触发条件 |
|------|------|----------|
| 挂失拦截 | 挂失卡禁止消费 | `is_lost = true` |
| 多店检测 | 短时间多店消费 | 30分钟内在≥2家不同门店消费 |
| 余额检查 | 可用余额不足 | `available_balance < amount` |
| 冻结检查 | 冻结余额不可用 | 存在 `ACTIVE` 状态的冻结记录 |
| 退款回滚 | 退回原充值批次 | 按批次优先级逆向回退 |
| 幂等保护 | 重复请求不重复 | 相同 `request_id` 或 `callback_id` |

---

## 📝 数据模型概览

| 表名 | 用途 |
|------|------|
| stores | 门店信息 |
| cards | 预付卡(余额、状态、挂失标记) |
| recharge_batches | 充值批次(用于退款原路返回) |
| transactions | 交易记录(所有类型) |
| balance_freezes | 余额冻结记录 |
| risk_events | 风险事件 |
| callback_logs | 回调日志(幂等用) |
| manual_corrections | 人工修正记录(留痕) |

---

## 💡 快速测试命令

### 初始化演示数据
```bash
curl -X POST http://127.0.0.1:5000/api/v1/init-demo
```

### 充值
```bash
curl -X POST http://127.0.0.1:5000/api/v1/cards/CARD001/recharge \
  -H "Content-Type: application/json" \
  -d '{"amount":1000,"channel":"微信支付","request_id":"TEST_RECHARGE_001"}'
```

### 消费
```bash
curl -X POST http://127.0.0.1:5000/api/v1/transactions/consume \
  -H "Content-Type: application/json" \
  -d '{"card_id":"CARD001","store_id":"STORE001","amount":200,"request_id":"TEST_CONSUME_001"}'
```

### 查询卡片
```bash
curl http://127.0.0.1:5000/api/v1/cards/CARD001
```

### 风险扫描
```bash
curl -X POST http://127.0.0.1:5000/api/v1/risk/scan \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 🎬 运行演示

强烈推荐运行交互式演示脚本：

```bash
# 终端1：启动服务器
python app.py

# 终端2：运行演示
python demo.py
```

演示脚本会按顺序执行7个场景，并在每一步暂停等待确认，让你能清晰看到状态变化。
