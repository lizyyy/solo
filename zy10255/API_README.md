# 公寓水电抄表 API

## 功能概述

完整的公寓水电费抄表管理系统，支持：
- 房间、租客信息管理
- 水电抄表记录（支持状态确认和撤销）
- 单价配置
- 租客预充值
- 换租交接与费用分摊
- 账单生成、确认、撤销、历史查询
- 多重异常防护（读数倒退、重复提交、余额不足）

## 快速开始

### 1. 安装依赖
```bash
pip install fastapi uvicorn sqlalchemy pydantic httpx
```

### 2. 启动服务
```bash
python main.py
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json

### 3. 运行测试
```bash
python test_direct.py
```

## 数据模型

### 数据表
| 表名 | 说明 | 核心字段 |
|------|------|----------|
| rooms | 房间信息 | room_number, floor, building |
| tenants | 租客信息 | name, phone, room_id, move_in_date |
| prices | 单价配置 | meter_type, unit_price, effective_date |
| meter_readings | 抄表记录 | room_id, meter_type, reading_value, reading_date, status |
| precharges | 预充值记录 | tenant_id, amount, payment_method |
| tenant_transfers | 换租交接 | room_id, old_tenant_id, new_tenant_id, transfer_date |
| bills | 账单 | bill_no, tenant_id, total_amount, status |
| bill_items | 账单明细 | bill_id, meter_type, usage, unit_price, amount, transfer_split_ratio |
| bill_history | 账单历史 | bill_id, action, old_status, new_status, notes |

### 状态流转

#### 抄表状态 (meter_readings.status)
```
draft → confirmed → revoked (仅draft状态可撤销)
  └→ revoked
```

#### 账单状态 (bills.status)
```
pending → confirmed → paid
  └→ revoked
```

## API 接口列表

### 房间管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/rooms | 创建房间 |
| GET | /api/rooms | 查询房间列表 |

### 租客管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tenants | 创建租客 |
| GET | /api/tenants | 查询租客列表 |
| GET | /api/tenants/{id}/balance | 查询租客余额 |

### 单价管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/prices | 设置单价 |
| GET | /api/prices | 查询单价列表 |

### 抄表管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/meter-readings | 创建抄表记录 |
| GET | /api/meter-readings | 查询抄表列表 |
| POST | /api/meter-readings/{id}/confirm | 确认抄表 |
| POST | /api/meter-readings/{id}/revoke | 撤销抄表 |

### 预充值管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/precharges | 创建预充值 |
| GET | /api/precharges | 查询预充值列表 |

### 换租管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tenant-transfers | 创建换租交接 |
| POST | /api/tenant-transfers/{id}/confirm | 确认换租 |

### 账单管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/bills/generate | 生成账单 |
| POST | /api/bills/{id}/confirm | 确认账单 |
| POST | /api/bills/{id}/revoke | 撤销账单 |
| POST | /api/bills/{id}/regenerate | 重新生成账单 |
| GET | /api/bills | 查询账单列表 |
| GET | /api/bills/{id} | 查询账单详情 |
| GET | /api/bills/{id}/history | 查询账单历史 |

## 核心业务规则

### 1. 幂等性处理
- 所有写入接口支持 `idempotency_key` 参数
- 相同的 `idempotency_key` 重复提交只执行一次
- 未提供时系统自动生成（基于关键业务字段组合）

### 2. 抄表异常检测
- **读数倒退检测**: 新抄表值 < 上次确认值时拒绝
- **状态约束**: 已关联账单的抄表不能撤销

### 3. 换租分摊算法
```
分摊比例 = 换租前天数 / 账单周期总天数
分摊金额 = 总用量 × 单价 × 分摊比例
```

### 4. 预充值不足检测
- 账单确认时检查: 预充值总额 - 已确认账单总额 ≥ 本次账单金额
- 余额不足时拒绝确认

## 测试场景覆盖

### 场景1: 正常账单流程
1. 创建房间、租客
2. 设置水价(5.5元/吨)、电价(0.85元/度)
3. 租客预充值500元
4. 月初抄表：水表100、电表1000 → 确认
5. 月末抄表：水表125、电表1150 → 确认
6. 生成账单：水费137.5元 + 电费127.5元 = 265元
7. 确认账单 → 余额500-265=235元

### 场景2: 异常读数处理
1. 录入读数90（小于上次125）→ 拒绝
2. 重复提交相同抄表 → 返回已有记录（幂等）
3. 撤销未关联账单的抄表 → 成功

### 场景3: 换租分摊
1. 创建新租客李四，预充值300元
2. 创建换租交接（月中15号交接）
3. 确认换租交接
4. 生成旧租客账单：按50%比例分摊 → 水费68.75 + 电费63.75 = 132.5元
5. 确认账单并查询历史

### 场景4: 预充值不足
1. 创建租客王五，预充值50元
2. 生成大额账单165元（30吨水费）
3. 确认账单 → 拒绝（余额不足）

## 输入输出示例

### 创建抄表
```json
POST /api/meter-readings
{
  "room_id": 1,
  "meter_type": "water",
  "reading_value": 125.0,
  "reading_date": "2024-01-15T00:00:00",
  "notes": "1月抄表",
  "idempotency_key": "water_1_20240115"
}
```

### 生成账单
```
POST /api/bills/generate?room_id=1&tenant_id=1&period_start=...&period_end=...&transfer_id=1
```

响应:
```json
{
  "bill_id": 1,
  "bill_no": "BILL-20240115-XXXXXX",
  "total_amount": 132.5,
  "status": "pending"
}
```

### 账单详情
```json
{
  "bill": {
    "id": 1,
    "bill_no": "BILL-20240115-XXXXXX",
    "total_amount": 132.5,
    "status": "confirmed",
    "is_transfer_split": true
  },
  "items": [
    {
      "meter_type": "water",
      "usage": 25.0,
      "unit_price": 5.5,
      "amount": 68.75,
      "transfer_split_ratio": 0.5
    }
  ]
}
```

## 设计要点

1. **状态明确**: 每个业务对象都有清晰的状态和流转约束
2. **安全防护**: 幂等性、异常检测、状态校验
3. **可追溯**: 完整的账单历史变更记录
4. **灵活性**: 支持换租分摊、账单重新生成等复杂场景
5. **易扩展**: 模块化设计，可轻松添加新表种或业务规则
