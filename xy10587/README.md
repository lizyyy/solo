# 健身私教课消课 API

一个完整的健身房私教课管理系统，支持课包购买、预约、请假、爽约、转让和教练提成结算。

## 核心功能

### 业务流程
- **课包管理**: 会员购买课包，设置有效期和教练
- **预约系统**: 会员预约教练课程，自动检查教练时间冲突
- **消课规则**:
  - 正常上课 → 扣课1节
  - 开课前24小时请假 → 不扣课
  - 开课前不足24小时取消 → 扣课1节
  - 爽约(未到) → 扣课1节
- **课包转让**: 会员可将部分或全部课时转让给其他会员
- **教练提成**: 每完成1节课，根据提成比例自动计算提成

### 技术特性
- **幂等性保障**: 所有写操作使用request_id防止重复执行
- **状态追踪**: 每个实体的状态变更都有历史记录
- **人工修正**: 支持管理员手动修正，记录前后差异和操作者
- **报告导出**: 会员账本、教练课表、扣课原因统计、月度提成

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库和样例数据

```bash
python sample_data.py
```

这将创建以下样例数据：

| 会员 | 课包 | 教练 | 课时 | 价格 |
|------|------|------|------|------|
| 张三 | 10节 | 王教练(50%) | ¥300/节 | ¥3000 |
| 李四 | 20节 | 刘教练(60%) | ¥250/节 | ¥5000 |
| 王五 | 5节 | 王教练(50%) | ¥300/节 | ¥1500 |
| 赵六 | 15节 | 刘教练(60%) | ¥300/节 | ¥4500 |

并模拟以下业务场景：
- 张三正常上课(已扣1节)
- 李四提前请假(未扣课)
- 王五超时取消(扣1节)
- 王五爽约(扣1节)
- 赵六转让5节给李四

### 3. 启动服务

```bash
python main.py
```

或使用uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务地址: http://localhost:8000
API文档: http://localhost:8000/docs

## 主要演示路径

### 路径一: 正常上课流程

```bash
# 1. 查看会员课包账本
curl "http://localhost:8000/reports/member-ledger/1"

# 2. 创建预约 (需要先获取会员、教练、课包ID)
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "coach_id": 1,
    "package_id": 1,
    "start_time": "2026-05-15T14:00:00",
    "end_time": "2026-05-15T15:00:00",
    "request_id": "appt_demo_001"
  }'

# 3. 确认上课
curl -X POST "http://localhost:8000/appointments/confirm-attendance" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": 1,
    "request_id": "confirm_001"
  }'

# 4. 查看扣课结果
curl "http://localhost:8000/reports/member-ledger/1"

# 5. 查看教练提成
curl "http://localhost:8000/reports/monthly-commission/1"
```

### 路径二: 开课前请假(不扣课)

```bash
# 1. 创建预约
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 2,
    "coach_id": 2,
    "package_id": 2,
    "start_time": "2026-05-20T10:00:00",
    "end_time": "2026-05-20T11:00:00",
    "request_id": "appt_demo_002"
  }'

# 2. 提前请假
curl -X POST "http://localhost:8000/appointments/leave" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": 2,
    "reason": "生病需要休息",
    "request_id": "leave_001"
  }'

# 3. 验证未扣课
curl "http://localhost:8000/reports/member-ledger/2"
```

### 路径三: 课包转让

```bash
# 1. 查看转让前状态
curl "http://localhost:8000/reports/member-ledger/3"  # 王五
curl "http://localhost:8000/reports/member-ledger/4"  # 赵六

# 2. 执行转让
curl -X POST "http://localhost:8000/transfers/" \
  -H "Content-Type: application/json" \
  -d '{
    "from_member_id": 4,
    "to_member_id": 2,
    "package_id": 4,
    "transfer_sessions": 5,
    "request_id": "transfer_demo_001"
  }'

# 3. 查看转让后状态
curl "http://localhost:8000/reports/member-ledger/2"  # 李四获得新课包
```

## 失败路径演示

### 场景: 教练时间冲突

```bash
# 1. 先预约一个时间段
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "coach_id": 1,
    "package_id": 1,
    "start_time": "2026-05-16T10:00:00",
    "end_time": "2026-05-16T11:00:00",
    "request_id": "appt_conflict_1"
  }'

# 2. 再预约同一教练同一时间 (会失败)
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 2,
    "coach_id": 1,
    "package_id": 2,
    "start_time": "2026-05-16T10:30:00",
    "end_time": "2026-05-16T11:30:00",
    "request_id": "appt_conflict_2"
  }'

# 预期返回: {"detail": "教练时间冲突"}
```

其他失败场景:
- 预约过期课包 → 返回"课包已过期"
- 预约已耗尽课包 → 返回"课包剩余课时不足"
- 转让给自己 → 返回"不能转让给自己"
- 重复执行同一request_id → 返回已有结果(幂等)

## 报告导出接口

| 接口 | 用途 |
|------|------|
| GET `/reports/member-ledger/{member_id}` | 会员课包账本 |
| GET `/reports/coach-schedule/{coach_id}` | 教练课表 |
| GET `/reports/deduction-reasons` | 扣课原因统计 |
| GET `/reports/monthly-commission/{coach_id}` | 月度提成 |

### 查看样例数据报告

```bash
# 张三的课包账本
curl "http://localhost:8000/reports/member-ledger/1"

# 王教练的课表
curl "http://localhost:8000/reports/coach-schedule/1"

# 扣课原因统计
curl "http://localhost:8000/reports/deduction-reasons"

# 王教练月度提成
curl "http://localhost:8000/reports/monthly-commission/1"
```

## 幂等性验证

```bash
# 同一个request_id执行两次
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "coach_id": 1,
    "package_id": 1,
    "start_time": "2026-05-17T14:00:00",
    "end_time": "2026-05-17T15:00:00",
    "request_id": "idem_test_001"
  }'

# 再次执行 (不会重复创建)
curl -X POST "http://localhost:8000/appointments/" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "coach_id": 1,
    "package_id": 1,
    "start_time": "2026-05-17T14:00:00",
    "end_time": "2026-05-17T15:00:00",
    "request_id": "idem_test_001"
  }'

# 查询幂等日志
curl "http://localhost:8000/idempotency-check/idem_test_001"
```

## 人工修正

```bash
# 人工修正课包剩余课时
curl -X POST "http://localhost:8000/manual-corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "package",
    "entity_id": 1,
    "after_data": {"remaining_sessions": 15, "used_sessions": 5},
    "operator": "admin",
    "reason": "会员投诉，补偿5节课",
    "request_id": "manual_001"
  }'

# 查看修正记录
curl "http://localhost:8000/status-history/?entity_type=package&entity_id=1"
```

## 状态追踪

每个预约的状态流转都会被记录：

```bash
# 查看某个预约的状态历史
curl "http://localhost:8000/status-history/?entity_type=appointment&entity_id=1"
```

可能的状态转换:
- `pending` → `confirmed` → `attended` (正常上课)
- `pending` → `leave` (提前请假，不扣课)
- `pending` → `cancelled` (超时取消，扣课)
- `pending` → `no_show` (爽约，扣课)

## 项目结构

```
.
├── main.py              # FastAPI应用入口和API路由
├── models.py            # 数据库模型定义
├── schemas.py           # Pydantic数据模型
├── services.py          # 核心业务逻辑
├── database.py          # 数据库连接配置
├── sample_data.py       # 样例数据生成脚本
├── requirements.txt     # Python依赖
└── fitness_system.db    # SQLite数据库(运行后生成)
```

## 业务规则说明

### 扣课规则
1. **正常上课(attended)**: 会员到场上课 → 扣1节
2. **开课前请假(leave)**: 提前24小时以上请假 → 不扣课
3. **超时取消(late_cancel)**: 开课前不足24小时取消 → 扣1节
4. **爽约(no_show)**: 会员未到 → 扣1节
5. **转让(transfer)**: 课时转让给其他会员 → 转出方扣N节

### 提成计算
- 提成 = 每节课单价 × 教练提成比例
- 王教练: 50% → ¥300 × 50% = ¥150/节
- 刘教练: 60% → ¥250 × 60% = ¥150/节

### 转让规则
- 转出后原会员不可再预约已转让的课时
- 转入会员获得新课包，有效期与原课包相同
- 部分转让后原课包继续有效

## 验证业务闭环

运行完样例数据后，通过报告接口验证：

1. **会员账本**: 张三剩余9节(原10-1)，王五剩余3节(原5-1-1)
2. **教练课表**: 王教练应有张三的已完成预约
3. **扣课原因**: attended(1), late_cancel(1), no_show(1), transfer(5)
4. **月度提成**: 王教练应有¥300提成(张三的课+王五的2节)

这些数据可以直接从报告API获取，无需查看源码即可判断业务是否闭环。
