# 会议室资源冲突 API

一个完整的会议室资源管理系统，专门解决会议改期后房间、投屏设备和茶歇资源占用不一致的问题。

## 核心特性

- **资源锁管理**: 房间、投屏设备、茶歇资源的锁定与释放
- **改期事务**: 基于 Saga 模式的分布式事务管理，确保原子性
- **冲突检测**: 实时检测时间和资源冲突
- **取消释放**: 取消会议后自动释放所有相关资源
- **日历导出**: 支持 ICS 格式日历导出
- **历史记录**: 完整的操作历史可追溯
- **补偿机制**: 事务失败时自动回滚
- **并发处理**: 资源锁防止并发冲突

## 技术栈

- Node.js + Express
- SQLite (better-sqlite3)
- 无需外部依赖，开箱即用

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将运行在 `http://localhost:3000`

### 运行测试

```bash
# 先启动服务
npm start

# 新开终端运行 curl 测试
bash scripts/test-curl.sh
```

## 完整调用顺序

### 1. 初始化资源

```bash
# 创建会议室
curl -X POST http://localhost:3000/api/resources/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "A101 - 大型会议室", "capacity": 20, "location": "1楼东区"}'

# 创建投屏设备
curl -X POST http://localhost:3000/api/resources/devices \
  -H "Content-Type: application/json" \
  -d '{"name": "投影仪-01", "type": "projector"}'

# 创建茶歇服务
curl -X POST http://localhost:3000/api/resources/catering \
  -H "Content-Type: application/json" \
  -d '{"name": "茶歇套餐 A", "description": "咖啡、茶点、水果"}'
```

### 2. 预订会议

```bash
curl -X POST http://localhost:3000/api/meetings/book \
  -H "Content-Type: application/json" \
  -d '{
    "title": "产品评审会议",
    "organizer": "张三",
    "start_time": "2026-05-15 09:00:00",
    "end_time": "2026-05-15 10:00:00",
    "room_id": "<ROOM_ID>",
    "device_id": "<DEVICE_ID>",
    "catering_id": "<CATERING_ID>"
  }'
```

### 3. 检查改期冲突（可选）

```bash
curl "http://localhost:3000/api/meetings/<MEETING_ID>/check-reschedule?start_time=2026-05-15%2014:00:00&end_time=2026-05-15%2015:00:00&room_id=<NEW_ROOM_ID>"
```

### 4. 执行改期事务

```bash
curl -X POST http://localhost:3000/api/meetings/<MEETING_ID>/reschedule \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2026-05-15 14:00:00",
    "end_time": "2026-05-15 15:00:00",
    "room_id": "<NEW_ROOM_ID>",
    "actor": "张三",
    "callback_url": "https://your-api.com/webhook"
  }'
```

### 5. 查看事务详情

```bash
curl http://localhost:3000/api/transactions/<TRANSACTION_ID>
```

### 6. 查看历史记录

```bash
curl http://localhost:3000/api/meetings/<MEETING_ID>/history
```

### 7. 导出日历

```bash
# 单个会议
curl http://localhost:3000/api/meetings/<MEETING_ID>/calendar -o meeting.ics

# 所有会议
curl "http://localhost:3000/api/meetings/calendar?start_date=2026-05-01&end_date=2026-05-31" -o calendar.ics
```

### 8. 取消会议

```bash
curl -X POST http://localhost:3000/api/meetings/<MEETING_ID>/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "actor": "张三",
    "callback_url": "https://your-api.com/webhook"
  }'
```

## 事务流程

### 改期事务步骤

1. **validate_input**: 验证输入参数
2. **check_conflicts**: 检查新资源和时间的冲突
3. **lock_new_resources**: 锁定新资源（防止并发）
4. **update_meeting**: 更新会议时间
5. **create_new_bookings**: 创建新预约，取消旧预约
6. **release_old_locks**: 释放资源锁

### 状态流转

```
initiated → conflict_checking → locking → applying → completed
                          ↓
                      failed → compensating → failed
```

### 补偿机制

如果事务在任何步骤失败，系统会自动执行补偿：
- 释放所有已获取的资源锁
- 恢复会议原始时间
- 恢复原始预约记录

## API 端点

### 资源管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/resources/rooms | 获取所有会议室 |
| POST | /api/resources/rooms | 创建会议室 |
| GET | /api/resources/rooms/:id | 获取会议室详情 |
| GET | /api/resources/rooms/:id/availability | 检查会议室可用性 |
| GET | /api/resources/devices | 获取所有设备 |
| POST | /api/resources/devices | 创建设备 |
| GET | /api/resources/devices/:id | 获取设备详情 |
| GET | /api/resources/devices/:id/availability | 检查设备可用性 |
| GET | /api/resources/catering | 获取所有茶歇服务 |
| POST | /api/resources/catering | 创建茶歇服务 |
| GET | /api/resources/catering/:id | 获取茶歇详情 |
| GET | /api/resources/catering/:id/availability | 检查茶歇可用性 |

### 会议管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/meetings | 获取所有会议 |
| POST | /api/meetings | 创建会议（仅会议本身） |
| POST | /api/meetings/book | 完整预订会议（含资源） |
| GET | /api/meetings/calendar | 导出日历 |
| GET | /api/meetings/:id | 获取会议详情 |
| GET | /api/meetings/:id/bookings | 获取会议预约 |
| GET | /api/meetings/:id/history | 获取历史记录 |
| GET | /api/meetings/:id/check-reschedule | 检查改期冲突 |
| POST | /api/meetings/:id/reschedule | 执行改期事务 |
| POST | /api/meetings/:id/cancel | 取消会议 |
| GET | /api/meetings/:id/calendar | 导出单个会议日历 |

### 事务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/transactions | 获取所有事务 |
| GET | /api/transactions/:id | 获取事务详情（含步骤） |

## 错误码

| 错误码 | 描述 |
|--------|------|
| RESOURCE_CONFLICT | 资源冲突 |
| LOCK_FAILED | 获取锁失败 |
| MEETING_CANCELLED | 会议已取消 |
| MEETING_NOT_FOUND | 会议不存在 |
| RESOURCE_NOT_FOUND | 资源不存在 |
| INVALID_TIME_RANGE | 时间范围无效 |
| ALREADY_CANCELLED | 已取消 |

## 资源类型

- `room`: 会议室
- `device`: 设备（投屏、投影仪等）
- `catering`: 茶歇服务

## 锁类型

- `pending`: 待定锁（事务进行中）
- `shared`: 共享锁（允许多个读取）
- `exclusive`: 排他锁（防止并发修改）

## 数据库结构

### 核心表

- `meeting_rooms`: 会议室
- `devices`: 设备
- `catering`: 茶歇服务
- `meetings`: 会议
- `bookings`: 预约记录
- `resource_locks`: 资源锁
- `transactions`: 事务记录
- `transaction_steps`: 事务步骤
- `history`: 历史记录

## 项目结构

```
.
├── src/
│   ├── server.js          # 服务器入口
│   ├── db.js              # 数据库连接
│   ├── utils.js           # 工具函数
│   ├── services/
│   │   ├── resourceService.js    # 资源管理
│   │   ├── lockService.js        # 资源锁管理
│   │   ├── conflictService.js    # 冲突检测
│   │   ├── meetingService.js     # 会议管理
│   │   ├── transactionService.js # 事务管理（核心）
│   │   └── calendarService.js    # 日历导出
│   └── routes/
│       ├── resources.js    # 资源路由
│       ├── meetings.js     # 会议路由
│       └── transactions.js # 事务路由
├── scripts/
│   └── test-curl.sh        # curl 测试脚本
├── data/                   # 数据库文件目录
├── package.json
└── README.md
```

## 注意事项

1. 时间格式必须是 `YYYY-MM-DD HH:mm:ss`
2. 所有资源操作都通过事务进行，确保一致性
3. 资源锁有 30 分钟过期时间，过期自动释放
4. 历史记录永久保存，便于审计
