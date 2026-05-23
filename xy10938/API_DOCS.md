# 洗车会员排队API - 接口文档

## 服务信息
- **服务地址**: http://localhost:3000
- **基础路径**: /api

## 启动说明

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库和示例数据
npm run setup

# 3. 运行自检（可选）
npm run test

# 4. 启动服务
npm start
```

---

## 健康检查

### GET /api/health
检查服务是否正常运行

**响应示例**:
```json
{
  "success": true,
  "message": "洗车会员排队API服务运行正常",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### GET /api/config
获取系统配置（服务类型、状态枚举等）

---

## 会员管理

### POST /api/members
创建会员

**请求体**:
```json
{
  "name": "张三",
  "phone": "13800138001",
  "level": "VIP会员",
  "balance": 500
}
```

### GET /api/members
获取会员列表

### GET /api/members/:id
根据ID查询会员

### GET /api/members/phone/:phone
根据手机号查询会员

### PUT /api/members/:id
更新会员信息

---

## 工位管理

### POST /api/stations
创建设工位

**请求体**:
```json
{
  "name": "1号工位"
}
```

### GET /api/stations
获取工位列表

### GET /api/stations/:id
查询单个工位

### PUT /api/stations/:id
更新工位信息（状态等）

---

## 排队管理

### POST /api/queue
取号/创建排队记录

**请求体**:
```json
{
  "member_id": 1,
  "appointment_id": null,
  "service_type": "标准洗"
}
```

**核心规则**:
- 服务类型必须是: 标准洗、精洗、打蜡、内饰清洁、镀膜
- 同一会员不能同时有多个等待或服务中的排队号

### GET /api/queue
获取排队列表

**查询参数**:
- `status`: 按状态筛选（等待中、服务中、已完成、已过号、已取消）

### GET /api/queue/:id
查询单个排队记录

### POST /api/queue/call-next
叫下一个号

**核心规则**:
- 自动分配空闲工位
- 更新排队状态为"服务中"

### POST /api/queue/:id/complete
完成服务

### POST /api/queue/:id/overnumber
标记过号

**请求体**:
```json
{
  "reason": "客户未到场"
}
```

### POST /api/queue/:id/requeue
过号补排

**核心规则**:
- 补排后位置延后3位
- 防止重复补排

### POST /api/queue/:id/cancel
取消排队

### PUT /api/queue/:id/manual
人工修正（管理员用）

**请求体**:
```json
{
  "status": "等待中",
  "position": 5,
  "station_id": 2
}
```

---

## 预约管理

### POST /api/appointments
创建预约

**请求体**:
```json
{
  "member_id": 1,
  "service_type": "精洗",
  "appointment_date": "2024-01-16",
  "appointment_time": "14:00"
}
```

### GET /api/appointments
获取预约列表

**查询参数**:
- `date`: 按日期筛选

### GET /api/appointments/:id
查询单个预约

### POST /api/appointments/:id/lock
预约锁位（分配工位）

**请求体**:
```json
{
  "station_id": 1
}
```

### POST /api/appointments/:id/cancel
取消预约

---

## 报告与日志

### POST /api/reports/generate
生成日报

**请求体**:
```json
{
  "date": "2024-01-15"
}
```

### GET /api/reports
获取报告列表

**查询参数**:
- `start_date`: 开始日期
- `end_date`: 结束日期

### GET /api/reports/export
导出CSV报告

**查询参数**:
- `date`: 报告日期

**响应**: CSV文件下载

### GET /api/reports/overnumber
获取过号记录

### GET /api/reports/exceptions
获取异常日志

**查询参数**:
- `limit`: 返回数量限制

---

## 数据模型说明

### 会员 (members)
| 字段 | 说明 |
|------|------|
| member_no | 会员编号 |
| name | 姓名 |
| phone | 手机号（唯一） |
| level | 会员等级 |
| balance | 余额 |

### 工位 (stations)
| 字段 | 说明 |
|------|------|
| station_no | 工位编号 |
| name | 工位名称 |
| status | 状态（空闲、忙碌、维护中） |
| current_queue_id | 当前服务的排队ID |

### 排队号 (queue_numbers)
| 字段 | 说明 |
|------|------|
| queue_no | 排队编号 |
| member_id | 关联会员 |
| appointment_id | 关联预约 |
| service_type | 服务类型 |
| status | 状态 |
| position | 排队位置 |
| station_id | 分配工位 |
| called_at | 叫号时间 |
| started_at | 开始服务时间 |
| completed_at | 完成时间 |

### 过号记录 (overnumber_records)
| 字段 | 说明 |
|------|------|
| queue_id | 原排队ID |
| original_queue_no | 原排队号 |
| new_queue_id | 补排后的新排队ID |
| reason | 过号原因 |
| requeue_count | 补排次数 |

### 异常日志 (exception_logs)
| 字段 | 说明 |
|------|------|
| api_path | 接口路径 |
| request_method | 请求方法 |
| raw_input | 原始输入数据 |
| error_message | 错误信息 |
| handling_conclusion | 处理结论 |

---

## 核心业务规则

1. **重复取号拦截**: 同一会员不能同时有多个等待/服务中的排队号
2. **预约锁位**: 预约确认时自动锁定工位
3. **工位分配**: 叫号时自动分配空闲工位
4. **过号补排**: 过号后可补排，位置自动延后3位
5. **状态流转**: 等待中 → 服务中 → 已完成 / 已过号 / 已取消

---

## 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "conclusion": "处理结论"
}
```
