# 批量短信退订API使用手册

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start

# 3. 健康检查
curl http://localhost:3000/health
```

## API接口列表

### 1. 批量退订创建
```bash
curl -X POST http://localhost:3000/api/unsubscribe/batch \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["13800138000", "13900139000", "+8613700137000"],
    "channel": "短信回复",
    "unsubscribeTime": "2024-01-15 10:30:00",
    "marketingBatch": "SPRING_PROMO_2024",
    "sourceData": {"source": "sms_reply", "campaign": "spring_sale"},
    "createdBy": "operator_zhang"
  }'
```

**字段说明：**
- `phones`: 手机号数组，支持各种格式，系统自动归一化
- `channel`: 退订渠道（如：短信回复、官网退订、客服退订、APP退订）
- `unsubscribeTime`: 退订时间（可选，默认当前时间）
- `marketingBatch`: 营销批次号（可选）
- `sourceData`: 原始数据源（可选，用于追溯）
- `createdBy`: 创建人

**核心功能：**
- ✅ 手机号归一化（自动去除 +86、空格、横杠等）
- ✅ 重复退订幂等处理（同一渠道同一号码只存一次）
- ✅ 异常记录保留原始输入和处理日志

---

### 2. 发送拦截检查（营销系统集成用）
```bash
curl -X POST http://localhost:3000/api/unsubscribe/check-block \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800138000",
    "campaignId": "CAMPAIGN_001",
    "marketingBatch": "SPRING_PROMO_2024"
  }'
```

**返回示例：**
```json
{
  "success": true,
  "data": {
    "blocked": true,
    "reason": "该号码已通过 [短信回复, 官网退订] 渠道退订，拦截本次发送",
    "unsubscribeDetails": [
      {"channel": "短信回复", "unsubscribeTime": "2024-01-15 10:30:00"},
      {"channel": "官网退订", "unsubscribeTime": "2024-01-10 14:20:00"}
    ]
  }
}
```

---

### 3. 退订记录查询
```bash
# 按手机号查询
curl "http://localhost:3000/api/unsubscribe/query?phone=13800138000"

# 按渠道查询
curl "http://localhost:3000/api/unsubscribe/query?channel=短信回复"

# 按时间范围查询
curl "http://localhost:3000/api/unsubscribe/query?startTime=2024-01-01&endTime=2024-01-31"

# 分页查询
curl "http://localhost:3000/api/unsubscribe/query?limit=20&offset=0"
```

---

### 4. 状态推进（人工修正状态）
```bash
curl -X PUT http://localhost:3000/api/unsubscribe/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "operator": "admin_wang",
    "reason": "用户投诉误操作，申请恢复接收"
  }'
```

**状态说明：**
- `active`: 有效退订（默认，拦截发送）
- `cancelled`: 已取消（不再拦截，允许发送）

---

### 5. 异常记录查询
```bash
# 查询所有待处理异常
curl "http://localhost:3000/api/exceptions?status=pending"

# 按批次号查询
curl "http://localhost:3000/api/exceptions?batchNo=BATCH20240115103000123"
```

---

### 6. 异常处理
```bash
curl -X PUT http://localhost:3000/api/exceptions/1/handle \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "operator": "admin_wang"
  }'
```

---

### 7. 退订汇总报告
```bash
curl "http://localhost:3000/api/report/summary?startDate=2024-01-01&endDate=2024-01-31"
```

**返回示例：**
```json
{
  "success": true,
  "data": [
    {
      "channel": "短信回复",
      "total_unsubscribes": 156,
      "unique_phones": 152,
      "report_date": "2024-01-15"
    },
    {
      "channel": "官网退订",
      "total_unsubscribes": 89,
      "unique_phones": 89,
      "report_date": "2024-01-15"
    }
  ]
}
```

---

### 8. 导出CSV（业务同事友好格式）
```bash
# 浏览器直接打开下载，或用 curl 保存
curl "http://localhost:3000/api/export/unsubscribe?startDate=2024-01-01&endDate=2024-01-31" \
  -o 退订数据_202401.csv
```

**导出字段（中文表头，业务友好）：**
| 表头 | 说明 |
|------|------|
| 归一化手机号 | 标准化后的11位手机号 |
| 原始手机号 | 用户提交的原始格式 |
| 退订渠道 | 用户通过哪个渠道退订 |
| 退订时间 | 退订发生时间 |
| 营销批次 | 关联的营销活动 |
| 当前状态 | active/cancelled |
| 入库时间 | 系统记录时间 |

---

## 核心设计规则

### 🔄 多源合并
- 同一手机号可通过多个渠道退订
- 拦截检查时合并所有渠道的退订记录
- 只要任一渠道有效退订，即拦截发送

### 📱 号码归一化
自动处理以下格式：
- `13800138000` → 直接使用
- `+8613800138000` → 去除前缀
- `8613800138000` → 去除前缀
- `138-0013-8000` → 去除符号
- `138 0013 8000` → 去除空格

### ⚡ 幂等处理
- 唯一键：`(phone_normalized, channel)`
- 同一渠道同一号码重复提交不报错，返回"重复退订"状态
- 保留首次退订时间

### 📝 异常追溯
所有处理异常均保留：
- 原始输入数据
- 错误类型和消息
- 处理过程日志
- 处理状态和操作人

---

## 数据模型概览

| 表名 | 用途 |
|------|------|
| `unsubscribe_records` | 退订主记录 |
| `block_records` | 拦截记录（营销系统调用日志） |
| `unsubscribe_batches` | 批量处理批次 |
| `exception_records` | 异常处理记录 |
| `manual_corrections` | 人工修正审计日志 |

---

## 典型使用场景

### 场景1：每日批量导入各渠道退订数据
```bash
# 导入短信回复退订
curl -X POST http://localhost:3000/api/unsubscribe/batch \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["13800138001", "13800138002"],
    "channel": "短信回复",
    "createdBy": "daily_job"
  }'

# 导入客服退订
curl -X POST http://localhost:3000/api/unsubscribe/batch \
  -H "Content-Type: application/json" \
  -d '{
    "phones": ["13900139001"],
    "channel": "客服退订",
    "createdBy": "daily_job"
  }'
```

### 场景2：营销系统发送前检查
```bash
# 发送前调用，如 blocked=true 则跳过该号码
curl -X POST http://localhost:3000/api/unsubscribe/check-block \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "campaignId": "NEW_YEAR_2024"}'
```

### 场景3：月末导出报告给业务
```bash
# 每月1号导出上月数据
curl "http://localhost:3000/api/export/unsubscribe?startDate=2024-01-01&endDate=2024-01-31" \
  -o 1月退订数据.csv
```
