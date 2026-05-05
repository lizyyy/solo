# 共享练琴房本地后端服务

一个基于 Flask + SQLite 的共享练琴房管理系统后端服务，支持房间管理、会员管理、预约管理、临时门禁码生成与核验、审计日志等功能。

## 功能特性

- **房间管理**：维护练琴房信息（名称、描述、容量、设备等）
- **会员管理**：维护会员信息（姓名、手机号、会员等级、剩余次数等）
- **预约管理**：创建、取消预约，自动生成一次性临时门禁码
- **门禁核验**：会员到场扫码核验，验证房间匹配、时间窗、会员状态、预约状态
- **审计日志**：记录所有关键操作，便于追溯
- **Webhook通知**：模拟门禁设备通知机制，支持事件推送

## 技术栈

- **后端框架**: Flask 2.3.3
- **ORM**: Flask-SQLAlchemy 3.0.5
- **数据库**: SQLite (可迁移到其他关系型数据库)
- **其他**: python-dateutil, requests

## 项目结构

```
xy4529/
├── app/
│   ├── __init__.py          # 应用工厂
│   ├── models.py            # 数据库模型
│   ├── api/
│   │   ├── __init__.py      # API蓝图初始化
│   │   ├── rooms.py         # 房间管理API
│   │   ├── members.py       # 会员管理API
│   │   ├── reservations.py  # 预约管理API
│   │   └── verification.py  # 门禁核验API
│   ├── services/
│   │   ├── __init__.py
│   │   └── webhook.py       # Webhook发送服务
│   └── webhook/
│       ├── __init__.py      # Webhook蓝图初始化
│       └── endpoints.py     # 模拟Webhook接收端点
├── config.py                # 配置文件
├── run.py                   # 应用入口
├── requirements.txt         # 依赖列表
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4529/repo/xy4529
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
# 初始化数据库表
python -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"
```

或者使用 Flask CLI：

```bash
export FLASK_APP=run.py
flask init-db
```

### 3. 填充测试数据（可选）

```bash
# 启动 Flask shell
export FLASK_APP=run.py
flask shell
```

在 shell 中执行：

```python
from datetime import datetime, timedelta
from app.models import Room, Member, Reservation, AuditLog
from app import db

# 创建房间
room1 = Room(
    name="钢琴房 A1",
    description="雅马哈三角钢琴",
    capacity=1,
    equipment="三角钢琴,乐谱架"
)
room2 = Room(
    name="小提琴房 B2",
    description="专业练琴房",
    capacity=2,
    equipment="乐谱架,座椅"
)
db.session.add_all([room1, room2])

# 创建会员
member1 = Member(
    name="张三",
    phone="13800138001",
    member_level="普通会员",
    remaining_times=10
)
member2 = Member(
    name="李四",
    phone="13800138002",
    member_level="VIP会员",
    remaining_times=20
)
db.session.add_all([member1, member2])

db.session.commit()
print("Test data created successfully!")
```

按 `Ctrl+D` 退出 Flask shell。

### 4. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5001` 启动。

**注意：** 使用端口5001是因为macOS的AirPlay Receiver默认占用端口5000。

## API 接口示例

以下所有示例假设服务运行在 `http://localhost:5001`。

### 房间管理

#### 获取所有房间
```bash
curl -X GET http://localhost:5001/api/rooms
```

#### 创建房间
```bash
curl -X POST http://localhost:5001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "吉他房 C3",
    "description": "民谣吉他练习室",
    "capacity": 2,
    "equipment": "吉他放大器,乐谱架"
  }'
```

#### 更新房间
```bash
curl -X PUT http://localhost:5001/api/rooms/1 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述",
    "capacity": 2
  }'
```

#### 删除房间
```bash
curl -X DELETE http://localhost:5001/api/rooms/3
```

### 会员管理

#### 获取所有会员
```bash
curl -X GET http://localhost:5001/api/members
```

#### 创建会员
```bash
curl -X POST http://localhost:5001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王五",
    "phone": "13900139003",
    "member_level": "普通会员",
    "remaining_times": 5
  }'
```

#### 为会员充值次数
```bash
curl -X POST http://localhost:5001/api/members/1/add_times \
  -H "Content-Type: application/json" \
  -d '{
    "times": 10
  }'
```

### 预约管理

#### 获取所有预约
```bash
curl -X GET http://localhost:5001/api/reservations
```

#### 创建预约（生成临时门禁码）
```bash
# 注意：时间需要是未来时间，请根据当前时间调整
curl -X POST http://localhost:5001/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "room_id": 1,
    "start_time": "2026-05-05 15:00:00",
    "end_time": "2026-05-05 16:00:00"
  }'
```

**响应示例：**
```json
{
  "id": 1,
  "member_id": 1,
  "room_id": 1,
  "room_name": "钢琴房 A1",
  "member_name": "张三",
  "start_time": "2026-05-05T15:00:00",
  "end_time": "2026-05-05T16:00:00",
  "door_code": "123456",
  "is_cancelled": false,
  "check_in_time": null
}
```

#### 取消预约
```bash
curl -X POST http://localhost:5001/api/reservations/1/cancel
```

### 门禁核验

#### 核验门禁码
这是会员到场扫码时调用的接口。

```bash
curl -X POST http://localhost:5001/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "door_code": "123456",
    "room_id": 1
  }'
```

**核验规则：**
1. **房间匹配**：门禁码必须与指定房间匹配
2. **时间窗**：必须在预约开始前15分钟到预约结束后15分钟内
3. **预约状态**：预约不能已取消
4. **使用状态**：门禁码不能已使用过（已签到）
5. **会员状态**：会员必须是激活状态
6. **剩余次数**：会员必须有足够的剩余次数

**成功响应示例：**
```json
{
  "authorized": true,
  "reservation": {...},
  "member": {...},
  "room": {...}
}
```

**失败响应示例：**
```json
{
  "error": "Door code does not match this room",
  "authorized": false
}
```

### 审计日志

#### 获取所有审计日志
```bash
curl -X GET http://localhost:5001/api/audit-logs
```

**日志类型：**
- `CREATE_ROOM` - 创建房间
- `UPDATE_ROOM` - 更新房间
- `DELETE_ROOM` - 删除房间
- `CREATE_MEMBER` - 创建会员
- `UPDATE_MEMBER` - 更新会员
- `DELETE_MEMBER` - 删除会员
- `ADD_MEMBER_TIMES` - 充值会员次数
- `CREATE_RESERVATION` - 创建预约
- `CANCEL_RESERVATION` - 取消预约
- `DELETE_RESERVATION` - 删除预约
- `VERIFY_DOOR_CODE` - 核验门禁码（成功或失败）

### Webhook 模拟

系统包含一个模拟的 webhook 接收器，用于测试门禁设备通知功能。

#### 查看 webhook 日志
```bash
curl -X GET http://localhost:5001/webhook/logs
```

#### 清除 webhook 日志
```bash
curl -X DELETE http://localhost:5001/webhook/logs
```

**触发的 webhook 事件：**
1. `DOOR_CODE_GENERATED` - 创建预约生成门禁码时
2. `DOOR_VERIFICATION` - 门禁核验成功时
3. `DOOR_VERIFICATION_FAILED` - 门禁核验失败时

**Webhook 负载示例：**
```json
{
  "event": "DOOR_CODE_GENERATED",
  "timestamp": "2026-05-05T12:00:00",
  "data": {
    "reservation_id": 1,
    "room_id": 1,
    "room_name": "钢琴房 A1",
    "member_id": 1,
    "member_name": "张三",
    "door_code": "123456",
    "start_time": "2026-05-05T15:00:00",
    "end_time": "2026-05-05T16:00:00"
  }
}
```

## 配置选项

在 `config.py` 中可以调整以下配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `DOOR_CODE_LENGTH` | 门禁码长度 | 6 位 |
| `DOOR_CODE_EXPIRE_MINUTES` | 时间窗偏移（预约前后） | 15 分钟 |
| `WEBHOOK_URL` | webhook 通知地址 | `http://localhost:5001/webhook/simulate` |

## 测试场景

### 场景1：完整预约流程

1. **创建会员**
```bash
curl -X POST http://localhost:5001/api/members \
  -H "Content-Type: application/json" \
  -d '{"name":"测试会员","phone":"13800000001","member_level":"普通会员","remaining_times":5}'
```

2. **创建房间**
```bash
curl -X POST http://localhost:5001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"测试琴房","description":"测试用琴房","capacity":1,"equipment":"钢琴"}'
```

3. **创建预约（注意时间要设置为未来时间）**
```bash
# 请根据当前时间调整 start_time 和 end_time
curl -X POST http://localhost:5001/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"member_id":1,"room_id":1,"start_time":"2026-05-05 18:00:00","end_time":"2026-05-05 19:00:00"}'
```

4. **核验门禁码（假设在时间窗内）**
```bash
# 使用上一步返回的 door_code
curl -X POST http://localhost:5001/api/verify \
  -H "Content-Type: application/json" \
  -d '{"door_code":"123456","room_id":1}'
```

5. **查看审计日志**
```bash
curl -X GET http://localhost:5001/api/audit-logs
```

6. **查看 webhook 日志**
```bash
curl -X GET http://localhost:5001/webhook/logs
```

### 场景2：核验失败情况

1. **房间不匹配**：使用属于房间1的门禁码去核验房间2
2. **时间窗外**：在预约开始前15分钟之前或结束后15分钟之后核验
3. **预约已取消**：先取消预约再核验
4. **门禁码已使用**：成功核验后再次使用同一门禁码
5. **会员次数不足**：会员剩余次数为0时创建预约

## 数据模型说明

### Room（房间）
- `id`: 主键
- `name`: 房间名称（唯一）
- `description`: 描述
- `capacity`: 容纳人数
- `equipment`: 设备列表
- `is_active`: 是否激活

### Member（会员）
- `id`: 主键
- `name`: 姓名
- `phone`: 手机号（唯一）
- `member_level`: 会员等级
- `remaining_times`: 剩余次数
- `is_active`: 是否激活

### Reservation（预约）
- `id`: 主键
- `member_id`: 会员ID
- `room_id`: 房间ID
- `start_time`: 开始时间
- `end_time`: 结束时间
- `door_code`: 临时门禁码（唯一）
- `is_cancelled`: 是否已取消
- `check_in_time`: 签到时间

### AuditLog（审计日志）
- `id`: 主键
- `member_id`: 关联会员（可选）
- `room_id`: 关联房间（可选）
- `reservation_id`: 关联预约（可选）
- `action`: 操作类型
- `result`: 结果（SUCCESS/FAILED）
- `details`: 详细信息
- `created_at`: 创建时间

## 扩展建议

1. **添加认证**：为管理员API添加JWT或Session认证
2. **参数校验**：使用 `marshmallow` 或 `pydantic` 进行更严格的参数校验
3. **错误处理**：统一错误响应格式，添加全局异常处理
4. **分页**：为列表接口添加分页支持
5. **搜索筛选**：为预约、日志等添加时间范围筛选
6. **邮件/短信通知**：在生成门禁码时发送给会员
7. **数据备份**：定期备份SQLite数据库文件

## 注意事项

- 本服务是**本地开发版本**，用于演示和测试
- 生产环境需要添加：认证机制、HTTPS、访问控制、更完善的错误处理
- SQLite 适合小型部署，高并发场景建议迁移到 PostgreSQL 或 MySQL
- 时间处理使用 UTC 时间，前端显示时需要考虑时区转换
