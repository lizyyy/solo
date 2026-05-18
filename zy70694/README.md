# 琴房时段迟到释放延时计费后端API

基于 FastAPI + SQLite 的琴房预约管理系统，核心功能包括时段锁定、迟到释放、延时计费、重复预约拦截、报告导出。

## 项目结构

```
.
├── main.py           # FastAPI主应用，API接口定义
├── models.py         # SQLAlchemy数据模型
├── schemas.py        # Pydantic数据验证模式
├── services.py       # 核心业务逻辑实现
├── database.py       # 数据库连接配置
├── requirements.txt  # 依赖包列表
├── test_self_check.py # 自检验证脚本
└── README.md
```

## 核心功能

### 1. 琴房管理
- 琴房创建、查询、更新
- 琴房状态管理（可用/已预约/使用中/维护中）

### 2. 用户管理
- 用户注册
- 用户信息查询

### 3. 预约管理
- 创建预约（自动时段锁定）
- 签到/签退
- 迟到检测（30分钟自动释放）
- 状态追踪

### 4. 迟到记录
- 迟到分钟数记录
- 迟到释放操作追踪
- 可按用户/状态筛选

### 5. 续费申请
- 在线提交续费申请
- 管理员审批（通过/拒绝）
- 自动计算额外费用

### 6. 使用报告
- 按日期范围查询
- 支持按琴房筛选
- CSV格式导出

## 核心业务规则

### 时段锁定
- 同一琴房同一时段只能有一个有效预约
- 创建预约时自动检查时段冲突

### 重复预约拦截
- 同一用户同一时段不能预约多个琴房
- 防止用户占房

### 迟到释放规则
- 迟到30分钟以上预约自动失效
- 签到时自动检测迟到并记录
- 迟到释放后琴房状态恢复可用

### 延时计费
- 续费申请需在签到状态下提交
- 续费时段不能与其他预约冲突
- 审批通过后自动更新预约时长和金额

## 错误响应说明

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| MISSING_FIELDS | 422 | 缺少必填字段 |
| VALIDATION_ERROR | 422 | 参数验证失败 |
| ROOM_NOT_FOUND | 400 | 琴房不存在 |
| ROOM_NOT_AVAILABLE | 400 | 琴房当前不可预约 |
| USER_NOT_FOUND | 400 | 用户不存在 |
| TIME_SLOT_CONFLICT | 400 | 时段已被预约 |
| DUPLICATE_BOOKING | 400 | 用户该时段已有预约 |
| BOOKING_NOT_FOUND | 400 | 预约不存在 |
| ALREADY_CHECKED_IN | 400 | 已签到，请勿重复操作 |
| TOO_LATE | 400 | 迟到超过30分钟，预约失效 |
| INVALID_STATUS_FOR_CHECKOUT | 400 | 当前状态不能退房 |
| INSUFFICIENT_LATE_TIME | 400 | 迟到不足30分钟，不能释放 |
| INVALID_STATUS_FOR_RENEWAL | 400 | 当前状态不能申请续费 |
| PENDING_RENEWAL_EXISTS | 400 | 已有待审核的续费申请 |
| RENEWAL_TIME_CONFLICT | 400 | 续费时段与其他预约冲突 |
| RENEWAL_NOT_FOUND | 400 | 续费申请不存在 |
| RENEWAL_ALREADY_PROCESSED | 400 | 该申请已处理过 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行自检验证

```bash
pip install requests
python test_self_check.py
```

自检脚本将验证以下内容：
- ✅ 数据导入（琴房、用户、预约创建）
- ✅ 数据筛选（按状态、ID等筛选）
- ✅ 核心业务逻辑（时段冲突、重复预约拦截）
- ✅ 错误响应处理（缺字段、状态不允许等）
- ✅ 报告生成与导出
- ✅ 续费审批流程

## API接口速览

### 琴房管理
- `POST /rooms/` - 创建琴房
- `GET /rooms/` - 查询琴房列表
- `GET /rooms/{room_id}` - 查询单个琴房
- `PUT /rooms/{room_id}` - 更新琴房信息

### 用户管理
- `POST /users/` - 创建用户
- `GET /users/` - 查询用户列表

### 预约管理
- `POST /bookings/` - 创建预约
- `GET /bookings/` - 查询预约列表
- `GET /bookings/{booking_id}` - 查询单个预约
- `POST /bookings/checkin` - 签到
- `POST /bookings/checkout` - 签退
- `POST /bookings/late-release` - 迟到释放

### 迟到记录
- `GET /late-records/` - 查询迟到记录列表

### 续费申请
- `POST /renewals/` - 创建续费申请
- `GET /renewals/` - 查询续费申请列表
- `POST /renewals/{renewal_id}/approve` - 批准续费
- `POST /renewals/{renewal_id}/reject` - 拒绝续费

### 使用报告
- `POST /reports/usage` - 生成使用报告
- `GET /reports/usage/export` - 导出CSV报告

## 数据模型

### PianoRoom (琴房)
- id: 主键
- name: 琴房名称（唯一）
- room_type: 琴房类型
- hourly_rate: 每小时价格
- status: 状态
- description: 描述
- created_at: 创建时间

### User (用户)
- id: 主键
- phone: 手机号（唯一）
- name: 姓名
- created_at: 创建时间

### Booking (预约)
- id: 主键
- room_id: 琴房ID
- user_id: 用户ID
- booking_date: 预约日期
- start_time: 开始时间
- end_time: 结束时间
- duration_hours: 时长（小时）
- total_amount: 总金额
- status: 预约状态
- check_in_time: 签到时间
- check_out_time: 签退时间
- is_late_released: 是否因迟到释放
- remarks: 备注
- created_at: 创建时间
- updated_at: 更新时间

### LateRecord (迟到记录)
- id: 主键
- booking_id: 预约ID
- user_id: 用户ID
- late_minutes: 迟到分钟数
- released_at: 释放时间
- is_released: 是否已释放
- created_at: 创建时间

### RenewalApplication (续费申请)
- id: 主键
- booking_id: 预约ID
- extend_hours: 续费时数
- new_end_time: 新结束时间
- additional_amount: 额外费用
- status: 申请状态
- approved_at: 审批时间
- remarks: 备注
- created_at: 创建时间

## 注意事项

1. 数据库文件 `piano_room.db` 会在首次运行时自动创建
2. 所有时间格式使用 24 小时制 (HH:MM)
3. 日期格式为 YYYY-MM-DD
4. 迟到30分钟阈值可在业务逻辑中调整
5. 建议生产环境更换为 PostgreSQL 或 MySQL

## 技术栈

- **FastAPI**: 现代、快速的Web框架
- **SQLAlchemy**: ORM数据库工具
- **Pydantic**: 数据验证
- **SQLite**: 嵌入式数据库
- **Uvicorn**: ASGI服务器
