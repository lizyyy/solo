# 换电运营工单系统

一个用于处理换电柜柜门打不开、扫码失败、空仓误报等问题的内部工单系统。

## 功能特性

### 核心功能
- ✅ **设备事件接入** - 支持单条/批量上报，自动区分正常/异常事件
- ✅ **工单管理** - 接单、归因、派修、复核全流程
- ✅ **幂等性保证** - 重复提交结果稳定，不会多扣多派
- ✅ **批量操作** - 失败时返回成功/失败明细，重试不破坏已成功记录
- ✅ **敏感字段脱敏** - 后端层面处理，返回、导出、日志均脱敏
- ✅ **数据导出** - 支持导出Excel格式

### 权限控制
- **ADMIN (管理员)** - 全部权限
- **OPERATOR (值班员)** - 接单、归因、派修
- **ENGINEER (工程师)** - 查看派给自己的工单
- **AUDITOR (审核员)** - 复核、导出数据

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
# 方式1: 使用启动脚本
chmod +x start.sh
./start.sh

# 方式2: 直接启动
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问API文档
启动后访问: http://localhost:8000/docs

### 默认账号
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| operator | operator123 | 值班员 |
| engineer | engineer123 | 工程师 |
| auditor | auditor123 | 审核员 |

## API接口说明

### 认证接口
- `POST /api/v1/auth/login` - 登录获取Token
- `POST /api/v1/auth/register` - 注册用户
- `GET /api/v1/auth/me` - 获取当前用户信息

### 设备事件接口
- `POST /api/v1/events/` - 上报单条设备事件
- `POST /api/v1/events/batch` - 批量上报设备事件
- `GET /api/v1/events/abnormal` - 获取异常事件列表
- `GET /api/v1/events/normal` - 获取正常事件列表
- `GET /api/v1/events/{event_id}` - 获取事件详情

### 工单管理接口
- `POST /api/v1/orders/` - 创建工单
- `POST /api/v1/orders/batch` - 批量创建工单
- `POST /api/v1/orders/receive` - 接单
- `POST /api/v1/orders/attribute` - 归因
- `POST /api/v1/orders/dispatch` - 派修
- `POST /api/v1/orders/review` - 复核
- `GET /api/v1/orders/` - 获取工单列表
- `GET /api/v1/orders/{order_id}` - 获取工单详情

### 导出接口
- `POST /api/v1/export/orders` - 导出工单数据
- `GET /api/v1/export/events/abnormal` - 导出异常事件

## 事件类型说明

### 事件类型 (EventType)
- `door_open` - 开门
- `door_close` - 关门
- `scan_success` - 扫码成功
- `scan_fail` - 扫码失败
- `battery_in` - 电池放入
- `battery_out` - 电池取出
- `cabin_status` - 仓门状态

### 问题类型 (IssueType)
- `door_failure` - 柜门故障
- `scan_failure` - 扫码失败
- `false_empty` - 空仓误报
- `other` - 其他

### 工单状态 (OrderStatus)
- `pending` - 待处理
- `received` - 已接单
- `attributed` - 已归因
- `dispatched` - 已派修
- `processing` - 处理中
- `reviewed` - 已复核
- `closed` - 已关闭

## 使用示例

### 1. 登录获取Token
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"
```

### 2. 上报设备事件
```bash
curl -X POST "http://localhost:8000/api/v1/events/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVT202401010001",
    "device_code": "CAB001",
    "event_type": "scan_fail",
    "event_time": "2024-01-01T10:00:00",
    "cabin_number": 3,
    "error_code": "ERR001",
    "error_message": "扫码失败，二维码无法识别"
  }'
```

### 3. 创建工单
```bash
curl -X POST "http://localhost:8000/api/v1/orders/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_code": "CAB001",
    "event_id": "EVT202401010001",
    "issue_description": "客户反映3号仓门打不开",
    "cabin_number": 3,
    "customer_phone": "13800138000",
    "customer_name": "张先生"
  }'
```

### 4. 接单
```bash
curl -X POST "http://localhost:8000/api/v1/orders/receive" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_ids": [1, 2, 3]
  }'
```

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **认证**: JWT
- **导出**: pandas + openpyxl

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置文件
│   ├── models.py          # 数据库模型
│   ├── schemas.py         # Pydantic Schema
│   ├── database.py        # 数据库连接
│   ├── auth.py            # 认证相关
│   ├── utils.py           # 工具函数
│   └── routers/
│       ├── __init__.py
│       ├── auth.py        # 认证路由
│       ├── events.py      # 事件路由
│       ├── orders.py      # 工单路由
│       └── export.py      # 导出路由
├── main.py                # 主入口
├── requirements.txt       # 依赖
├── start.sh               # 启动脚本
└── README.md              # 说明文档
```

## 注意事项

1. **敏感字段**: 手机号、身份证号等敏感字段会在后端自动脱敏
2. **幂等性**: 重复提交相同请求不会创建重复记录
3. **批量操作**: 部分失败不影响已成功的记录，可安全重试
4. **权限控制**: 不同角色有不同操作权限，请使用正确账号登录