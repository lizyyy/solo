# 泵房巡检台账管理系统 API 文档

## 基础信息
- 基础地址: `http://localhost:5001/api`
- 数据格式: JSON
- 字符编码: UTF-8

## 健康检查
### GET /health
检查服务状态

**响应示例:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000000"
}
```

## 泵房管理

### GET /pump-rooms
获取所有泵房列表

**响应示例:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "1号地下泵房",
      "location": "B1层东区",
      "status": "normal",
      "created_at": "2024-01-01T...",
      "updated_at": "2024-01-01T..."
    }
  ]
}
```

### POST /pump-rooms
创建新泵房

**请求参数:**
```json
{
  "name": "1号地下泵房",
  "location": "B1层东区"
}
```

### GET /pump-rooms/{id}
获取单个泵房详情

### PUT /pump-rooms/{id}
更新泵房信息

**请求参数:**
```json
{
  "name": "1号地下泵房",
  "location": "B1层西区",
  "status": "abnormal"
}
```

### DELETE /pump-rooms/{id}
删除泵房

## 人员管理

### GET /staff
获取所有工作人员列表

### POST /staff
添加工作人员

**请求参数:**
```json
{
  "name": "张三",
  "phone": "13800138000",
  "role": "维修工程师"
}
```

## 报修单管理

### GET /repairs
获取报修单列表

**查询参数:**
- `status`: 状态筛选 (pending/assigned/arrived/reinspecting/closed/escalated)
- `pump_room_id`: 泵房ID筛选

### POST /repairs
创建报修单

**请求参数:**
```json
{
  "pump_room_id": 1,
  "report_source": "微信群",
  "problem_type": "水泵异响",
  "description": "1号泵运行时有异常噪音",
  "reporter": "李工",
  "reporter_phone": "13900139000",
  "operator": "系统管理员"
}
```

**重复拦截响应:**
```json
{
  "success": false,
  "error": "DUPLICATE_REPAIR",
  "message": "该泵房在24小时内已有同类报修",
  "duplicate_ids": [1, 2]
}
```

### GET /repairs/{id}
获取报修单详情（含操作日志和复测记录）

**响应示例:**
```json
{
  "data": { ... },
  "logs": [
    {
      "id": 1,
      "operation_type": "create",
      "operator": "system",
      "reason": "正常报修",
      "details": "创建报修单: 水泵异响",
      "created_at": "..."
    }
  ],
  "reinspections": [
    {
      "id": 1,
      "inspector": "张工",
      "result": "已修复",
      "description": "轴承更换完成，运行正常",
      "is_passed": true,
      "created_at": "..."
    }
  ]
}
```

### POST /repairs/{id}/assign
派工

**请求参数:**
```json
{
  "staff_id": 1,
  "operator": "调度员"
}
```

### POST /repairs/{id}/arrive
标记到场

### POST /repairs/{id}/reinspect
复测

**请求参数:**
```json
{
  "inspector": "张工",
  "result": "已修复",
  "description": "轴承更换完成，运行正常",
  "is_passed": true,
  "operator": "张工"
}
```

### POST /repairs/{id}/close
关闭报修单（需先复测通过）

### POST /repairs/escalate-timeout
超时升级检查

**请求参数:**
```json
{
  "timeout_hours": 4
}
```

## 批量操作

### POST /batch/create-repairs
批量创建报修单

**请求参数:**
```json
{
  "items": [
    {
      "pump_room_id": 1,
      "report_source": "微信群",
      "problem_type": "水泵异响",
      "description": "1号泵异响",
      "reporter": "李工"
    },
    {
      "pump_room_id": 2,
      "report_source": "巡检",
      "problem_type": "压力异常",
      "description": "出水压力偏低",
      "reporter": "王工"
    }
  ],
  "operator": "系统管理员"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "batch_id": "uuid-string",
    "total": 2,
    "success": 1,
    "fail": 1,
    "success_ids": [1],
    "fail_details": [
      {
        "index": 1,
        "item": { ... },
        "error": "DUPLICATE_REPAIR",
        "message": "该泵房在24小时内已有同类报修"
      }
    ]
  }
}
```

### POST /batch/assign-repairs
批量派工

**请求参数:**
```json
{
  "items": [
    {"repair_id": 1, "staff_id": 1},
    {"repair_id": 2, "staff_id": 2}
  ],
  "operator": "调度员"
}
```

### GET /batch/{batch_id}
查询批量操作结果

## 操作日志

### GET /logs
查询操作日志

**查询参数:**
- `repair_id`: 按报修单筛选
- `batch_id`: 按批量操作ID筛选

## 业务规则说明

### 1. 重复报修拦截
- 同一泵房、同一问题类型在24小时内的重复报修会被拦截
- 系统会返回已存在的报修单ID列表

### 2. 超时升级
- 超过4小时未处理的报修单自动升级
- 升级级别最高3级
- 可通过接口触发检查

### 3. 复测留痕
- 每次复测都会记录详细信息，包括结果和描述
- 复测不通过时需继续处理，状态回退到"已到场"
- 复测通过后才能关闭工单

### 4. 幂等性保证
- 重复派工给同一人员不会重复操作
- 重复标记到场不会重复记录
- 重复关闭已关闭工单不会产生副作用

### 5. 状态流转
```
pending (待派工) → assigned (已派工) → arrived (已到场) → reinspecting (复测通过) → closed (已关闭)
                                      ↓
                                  复测不通过 → 回退到 arrived
                                      ↓
                                  超时 → escalated (已升级) → assigned (重新派工)
```
