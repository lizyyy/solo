# 泵房巡检管理系统

解决一线小区工程主管地下泵房巡检管理系统，解决微信群分散管理问题。

## 功能特性

### 核心业务流程
- **报修**: 创建报修工单，关联巡检记录和泵房
- **派工**: 管理员/工程师派单给维修人员
- **到场**: 维修人员现场签到
- **复测**: 维修完成后复测
- **关闭**: 工单完成关闭

### 数据管理
- **巡检记录导入导出**: 支持Excel批量导入巡检记录，自动去重
- **泵房管理**: 泵房基础信息管理
- **历史记录**: 完整的工单操作历史记录

### 安全特性
- **权限控制**: 基于角色的访问控制（Admin/Engineer/Worker）
- **敏感字段脱敏**: 手机号、邮箱等敏感信息自动脱敏
- **操作日志**: 完整的审计日志

### 幂等性保障
- 重复导入检测（基于文件哈希）
- 重复记录检测（基于泵房+时间）
- 唯一业务流水号

## 技术架构

### 后端技术栈
- **框架**: FastAPI
- **数据库**: SQLite (本地持久化)
- **ORM**: SQLAlchemy
- **认证**: JWT
- **密码加密**: SHA256_Crypt
- **导入导出**: Pandas + OpenPyXL

### 项目结构
```
├── app/
│   ├── api/              # API接口层
│   │   ├── auth.py           # 认证接口
│   │   ├── pump_rooms.py     # 泵房管理接口
│   │   ├── inspections.py   # 巡检记录接口
│   │   ├── work_orders.py   # 工单管理接口
│   │   └── import_export.py # 导入导出接口
│   ├── core/             # 核心配置
│   │   ├── config.py         # 配置管理
│   │   ├── database.py     # 数据库连接
│   │   └── security.py     # 安全相关
│   ├── models/           # 数据模型
│   │   └── models.py       # ORM模型定义
│   ├── schemas/          # Pydantic模式
│   │   └── schemas.py      # 请求响应模式
│   ├── services/         # 业务逻辑层
│   │   ├── user_service.py     # 用户服务
│   │   ├── pump_room_service.py # 泵房服务
│   │   ├── inspection_service.py # 巡检服务
│   │   ├── work_order_service.py # 工单服务
│   │   └── import_export_service.py # 导入导出服务
│   └── utils/            # 工具类
│       └── logger.py         # 日志工具
├── data/                 # 数据文件目录
├── logs/                 # 日志文件目录
├── main.py               # 应用入口
└── requirements.txt      # 依赖列表
```

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```

服务启动后访问: http://localhost:8000

### API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 默认账号

系统启动时自动创建以下测试账号：

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 拥有所有权限 |
| engineer | engineer123 | 工程师 | 可派工、关闭工单 |
| worker | worker123 | 维修员 | 可签到、复测 |

## API接口

### 认证
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户信息

### 泵房管理
- `GET /api/v1/pump-rooms` - 获取泵房列表
- `GET /api/v1/pump-rooms/{id}` - 获取泵房详情
- `POST /api/v1/pump-rooms` - 创建泵房 (Admin)

### 巡检记录
- `GET /api/v1/inspections` - 获取巡检记录列表
- `GET /api/v1/inspections/{id}` - 获取巡检记录详情
- `POST /api/v1/inspections` - 创建巡检记录

### 工单管理
- `GET /api/v1/work-orders` - 获取工单列表
- `GET /api/v1/work-orders/{id}` - 获取工单详情
- `GET /api/v1/work-orders/{id}/history` - 获取工单历史
- `POST /api/v1/work-orders` - 创建工单 (报修)
- `POST /api/v1/work-orders/{id}/assign` - 派工 (Admin/Engineer)
- `POST /api/v1/work-orders/{id}/arrive` - 到场签到
- `POST /api/v1/work-orders/{id}/reinspect` - 复测
- `POST /api/v1/work-orders/{id}/close` - 关闭工单 (Admin/Engineer)

### 导入导出
- `POST /api/v1/io/import` - 导入巡检记录 (Excel)
- `GET /api/v1/io/export` - 导出巡检记录
- `GET /api/v1/io/template` - 下载导入模板

## 工单状态流转

```
已创建 → 已派工 → 已到场 → 已复测 → 已关闭
```

## 数据模型

### 用户 (User)
- id, username, password_hash, real_name, phone, email, role, is_active

### 泵房 (PumpRoom)
- id, code, name, location, building, floor, equipment_count, status, description

### 巡检记录 (InspectionRecord)
- id, record_no, pump_room_id, inspector_id, inspection_time
- water_pressure, water_level, pump_status, valve_status, pipe_status, electrical_status
- temperature, humidity, noise_level, result, issues, remarks
- import_id, import_batch

### 工单 (WorkOrder)
- id, order_no, inspection_record_id, pump_room_id, created_by, assigned_to
- title, description, priority, status, issue_type
- assigned_at, arrived_at, reinspected_at, closed_at

### 历史记录 (HistoryLog)
- id, work_order_id, user_id, action, from_status, to_status, description, ip_address

### 导入记录 (ImportRecord)
- id, batch_no, file_name, file_hash, total_count, success_count
- failed_count, duplicate_count, import_by, status, error_message

## 本地持久化

- 数据库文件: `data/pump_inspection.db`
- 日志文件: `logs/pump_inspection.log`
- 重启服务后数据不会丢失

## 敏感字段处理

系统自动对以下字段进行脱敏处理：
- 手机号: 138****8000
- 邮箱: a***n@example.com
- 其他敏感字段配置在 `settings.SENSITIVE_FIELDS`

脱敏处理发生在：
- API响应
- 导出文件
- 日志记录
