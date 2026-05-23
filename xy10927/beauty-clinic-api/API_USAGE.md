# 美容院疗程核销API - 使用示例

## 启动服务

```bash
cd beauty-clinic-api
npm install
node src/scripts/initDB.js
node src/scripts/sampleData.js
npm start
```

服务运行在 http://localhost:3000

## 接口示例

### 1. 健康检查
```bash
curl http://localhost:3000/api/health
```

### 2. 顾客管理

#### 创建顾客
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "赵雅芝",
    "phone": "13900139001",
    "gender": "女",
    "birthday": "1987-10-01"
  }'
```

#### 查询所有顾客
```bash
curl http://localhost:3000/api/customers
```

### 3. 门店管理

#### 创建门店
```bash
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "西城门店",
    "address": "北京市西城区xxx路xxx号",
    "phone": "010-66668888"
  }'
```

#### 查询所有门店
```bash
curl http://localhost:3000/api/stores
```

### 4. 疗程包管理

#### 创建疗程包
```bash
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "<顾客ID>",
    "name": "水光针套餐",
    "total_count": 10,
    "purchase_date": "2024-06-01",
    "expire_date": "2025-06-01",
    "store_id": "<门店ID>",
    "operator": "admin"
  }'
```

#### 套餐拆分
```bash
curl -X POST http://localhost:3000/api/packages/<套餐ID>/split \
  -H "Content-Type: application/json" \
  -d '{
    "split_count": 5,
    "split_gift_count": 1,
    "operator": "admin"
  }'
```
- `split_count`: 拆分的购买次数
- `split_gift_count`: 拆分的赠送次数（可选，默认为0）

#### 赠送次数
```bash
curl -X POST http://localhost:3000/api/packages/<套餐ID>/gift \
  -H "Content-Type: application/json" \
  -d '{
    "gift_count": 2,
    "reason": "会员日活动赠送",
    "operator": "admin"
  }'
```

#### 核销
```bash
curl -X POST http://localhost:3000/api/packages/<套餐ID>/verify \
  -H "Content-Type: application/json" \
  -d '{
    "store_id": "<门店ID>",
    "count": 1,
    "use_gift_count": 0,
    "operator": "小美",
    "remark": "常规护理服务"
  }'
```
- 核销规则：
  - `count`: 本次核销总次数
  - `use_gift_count`: 使用赠送次数（必须小于等于总次数）
  - `use_paid_count` = `count` - `use_gift_count`（自动计算）
  - 赠送次数从独立的赠送余额扣减，不影响购买的套餐
  - 购买次数从套餐剩余次数扣减

#### 人工修正
```bash
curl -X POST http://localhost:3000/api/packages/<套餐ID>/correct \
  -H "Content-Type: application/json" \
  -d '{
    "before_data": {
      "total_count": 48,
      "remaining_count": 36
    },
    "after_data": {
      "total_count": 50,
      "remaining_count": 38
    },
    "reason": "系统计算错误，补加2次",
    "operator": "admin"
  }'
```

### 5. 转店申请

#### 创建转店申请
```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "<套餐ID>",
    "from_store_id": "<原门店ID>",
    "to_store_id": "<目标门店ID>",
    "request_note": "顾客搬家，申请转店",
    "operator": "前台"
  }'
```

#### 审批转店申请
```bash
curl -X POST http://localhost:3000/api/transfers/<申请ID>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approval_note": "情况属实，同意转店",
    "operator": "店长"
  }'
```

#### 驳回转店申请
```bash
curl -X POST http://localhost:3000/api/transfers/<申请ID>/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approval_note": "目标门店无此项目",
    "operator": "店长"
  }'
```

### 6. 延期申请

#### 创建延期申请
```bash
curl -X POST http://localhost:3000/api/extensions \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "<套餐ID>",
    "new_expire_date": "2025-12-31",
    "reason": "顾客怀孕，申请延期",
    "operator": "前台"
  }'
```

#### 审批延期申请
```bash
curl -X POST http://localhost:3000/api/extensions/<申请ID>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approval_note": "情况特殊，同意延期",
    "operator": "店长"
  }'
```

#### 驳回延期申请
```bash
curl -X POST http://localhost:3000/api/extensions/<申请ID>/reject \
  -H "Content-Type: application/json" \
  -d '{
    "approval_note": "不符合延期条件",
    "operator": "店长"
  }'
```

#### 补偿（仅驳回后可操作）
```bash
curl -X POST http://localhost:3000/api/extensions/<申请ID>/compensate \
  -H "Content-Type: application/json" \
  -d '{
    "approval_note": "给予2次赠送作为补偿",
    "operator": "店长"
  }'
```

### 7. 报告查询

#### 核销记录报告
```bash
curl "http://localhost:3000/api/reports/verifications?start_date=2024-01-01&end_date=2024-12-31"
```

#### 套餐报告
```bash
curl http://localhost:3000/api/reports/packages
```

#### 顾客完整信息
```bash
curl http://localhost:3000/api/reports/customer/<顾客ID>
```

#### 异常日志
```bash
curl http://localhost:3000/api/reports/exceptions
```

#### 人工修正记录
```bash
curl http://localhost:3000/api/reports/corrections
```

## 响应状态说明

| 状态 | 说明 |
|------|------|
| completed | 操作成功完成 |
| pending_review | 待审核 |
| approved | 已批准 |
| rejected | 已驳回 |
| compensated | 已补偿 |
| failed | 操作失败 |
| not_found | 资源不存在 |

## 数据持久化

所有数据存储在 `data/clinic.db` SQLite 数据库中，重启服务数据不丢失。
