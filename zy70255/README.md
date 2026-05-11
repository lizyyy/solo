# 网约车机场排队券 API

## 安装运行

```bash
npm install
npm start
```

健康检查:
```bash
curl http://localhost:3000/health
```

## 样例入口

创建司机档案 → 创建排队券 → 入队 → 叫号

```bash
# 1. 创建司机
curl -X POST http://localhost:3000/api/drivers \
  -H "Content-Type: application/json" \
  -d '{"name": "张师傅", "phone": "13800138001", "car_type": "COMFORT"}'

# 2. 创建排队券（使用返回的 driver_id）
curl -X POST http://localhost:3000/api/vouchers \
  -H "Content-Type: application/json" \
  -d '{"driver_id": "<driver_id>", "terminal_id": "T2", "car_type": "COMFORT"}'

# 3. 推进状态 - 入队（CREATED → IN_QUEUE）
curl -X POST http://localhost:3000/api/vouchers/<voucher_id>/advance

# 4. 推进状态 - 叫号（IN_QUEUE → CALLED）
curl -X POST http://localhost:3000/api/vouchers/<voucher_id>/advance
```

## 核心操作

### 状态流转
```
CREATED → IN_QUEUE → CALLED → COMPLETED
                    ↓
                  NO_SHOW
         ↓
       REVOKED
```

### 主要接口

| 动作 | 方法 | 路径 |
|------|------|------|
| 创建排队券 | POST | /api/vouchers |
| 推进状态 | POST | /api/vouchers/:id/advance |
| 标记爽约 | POST | /api/vouchers/:id/no-show |
| 撤回 | POST | /api/vouchers/:id/revoke |
| 修正 | PUT | /api/vouchers/:id/correct |
| 查询排队券 | GET | /api/vouchers |
| 查询航站楼队列 | GET | /api/queues |
| 统计汇总 | GET | /api/queues/stats |

### 业务规则
- 司机不能同时有多个未完成排队券
- 24小时内爽约≥2次无法领券
- 车型: ECONOMY, COMFORT, PREMIUM, SUV
- 航站楼: T1, T2, T3

## 检查结果

```bash
# 查看 T2 舒适型队列
curl "http://localhost:3000/api/queues?terminal_id=T2&car_type=COMFORT"

# 查看统计
curl http://localhost:3000/api/queues/stats

# 导出排队券 CSV
curl "http://localhost:3000/api/vouchers/export" -o vouchers.csv
```

### 幂等性
写入接口自动支持幂等性，使用 `X-Idempotency-Key` 请求头指定自定义键，重跑同一批数据不会导致状态膨胀或矛盾。
