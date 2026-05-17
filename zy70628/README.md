# 驿站包裹滞留催取拒收退回确认系统

基于 FastAPI + SQLite 的后端API服务，用于驿站包裹管理，支持包裹入库、滞留分级、催取去重、拒收确认、退回跟踪、操作日志和报告导出。

## 功能特性

- **包裹管理**: 入库、查询、详情、状态流转
- **滞留分级**: 自动根据入库时间计算滞留级别（normal/warning/urgent/critical）
- **催取管理**: 批量催取、自动去重（同一天同类型不重复催取）
- **拒收处理**: 创建拒收记录、人工确认
- **退回跟踪**: 创建退回报告、确认退回
- **人工修正**: 支持修改指定字段，记录修改原因
- **关闭/撤回**: 包裹关闭，记录操作日志
- **操作审计**: 所有操作均记录日志，保留原始输入和处理人
- **报告导出**: 导出Excel格式报告
- **统计概览**: 包裹状态、滞留分布、今日催取数

## 快速开始

### 1. 环境要求

- Python 3.8+
- pip

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 启动服务

```bash
# 方式一：直接运行
python main.py

# 方式二：使用uvicorn（推荐，支持热重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://127.0.0.1:8000/docs
- 备用文档: http://127.0.0.1:8000/redoc

### 4. 生成测试数据

```bash
# 确保服务已启动，然后运行：
python generate_data.py
```

脚本会自动生成25个测试包裹，并模拟催取、拒收、退回、状态更新等操作。

## API接口说明

### 包裹管理

#### 创建包裹入库
```bash
curl -X POST "http://127.0.0.1:8000/api/parcels" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "SF1234567890",
    "courier_company": "顺丰",
    "recipient": {
      "name": "张三",
      "phone": "13800138000",
      "address": "上海市浦东新区"
    },
    "shelf_location": "A-01",
    "weight": "2.5kg",
    "remarks": "易碎品",
    "created_by": "admin"
  }'
```

#### 查询包裹列表
```bash
# 全部包裹
curl "http://127.0.0.1:8000/api/parcels"

# 按状态过滤
curl "http://127.0.0.1:8000/api/parcels?status=pending"

# 按滞留级别过滤
curl "http://127.0.0.1:8000/api/parcels?stagnation_level=urgent"

# 搜索快递单号/手机号
curl "http://127.0.0.1:8000/api/parcels?tracking_number=SF&recipient_phone=138"

# 分页
curl "http://127.0.0.1:8000/api/parcels?page=1&page_size=50"
```

#### 获取包裹详情
```bash
curl "http://127.0.0.1:8000/api/parcels/1"
```

### 催取管理

#### 批量催取（自动去重）
```bash
curl -X POST "http://127.0.0.1:8000/api/reminders" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_ids": [1, 2, 3],
    "reminder_type": "urgent",
    "reminder_channel": "sms",
    "sent_by": "admin"
  }'
```

### 拒收管理

#### 创建拒收记录
```bash
curl -X POST "http://127.0.0.1:8000/api/rejections" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "reason": "商品破损，外包装严重变形",
    "rejected_by": "staff01",
    "contact_result": "已联系发件人，同意拒收",
    "follow_up_action": "等待退回",
    "remarks": "客户拒收"
  }'
```

#### 确认拒收
```bash
curl -X POST "http://127.0.0.1:8000/api/rejections/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "rejection_id": 1,
    "confirmed_by": "manager"
  }'
```

### 退回管理

#### 创建退回报告
```bash
curl -X POST "http://127.0.0.1:8000/api/returns" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 2,
    "return_tracking_number": "YT9876543210",
    "return_courier_company": "圆通",
    "return_reason": "发错货",
    "return_address": "上海市闵行区退货仓库",
    "return_contact": "王主管",
    "return_phone": "4001234567",
    "reported_by": "admin",
    "remarks": "客户要求全额退款"
  }'
```

#### 确认退回
```bash
curl -X POST "http://127.0.0.1:8000/api/returns/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "return_id": 1,
    "confirmed_by": "manager",
    "actual_shipped_at": "2024-01-15T10:30:00"
  }'
```

### 状态管理

#### 更新包裹状态
```bash
curl -X PUT "http://127.0.0.1:8000/api/parcels/status" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "new_status": "picked_up",
    "operator": "staff01",
    "remarks": "客户已取件"
  }'
```

有效状态值: `pending`, `reminded`, `picked_up`, `rejected`, `returning`, `returned`, `closed`

#### 人工修正
```bash
curl -X PUT "http://127.0.0.1:8000/api/parcels/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "field_name": "shelf_location",
    "field_value": "B-05",
    "operator": "admin",
    "reason": "货架位置调整"
  }'
```

可修改字段: `tracking_number`, `courier_company`, `shelf_location`, `weight`, `remarks`, `status`

#### 关闭/撤回包裹
```bash
curl -X POST "http://127.0.0.1:8000/api/parcels/close" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "close_reason": "包裹已退回发件人，完结",
    "closed_by": "manager"
  }'
```

### 导出与统计

#### 导出Excel报告
```bash
# 导出全部
curl -o report.xlsx "http://127.0.0.1:8000/api/export"

# 按条件导出
curl -o pending_report.xlsx "http://127.0.0.1:8000/api/export?status=pending"
```

#### 获取统计概览
```bash
curl "http://127.0.0.1:8000/api/statistics"
```

## 冲突与异常场景测试

### 1. 重复快递单号（应失败）
```bash
# 同一个快递单号入库两次
curl -X POST "http://127.0.0.1:8000/api/parcels" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "SF1234567890",
    "recipient": {"name": "李四", "phone": "13900139000"},
    "created_by": "admin"
  }'
```

### 2. 重复催取（同一天同类型，应被去重）
```bash
# 连续催取同一个包裹两次
curl -X POST "http://127.0.0.1:8000/api/reminders" \
  -H "Content-Type: application/json" \
  -d '{"parcel_ids": [1], "reminder_type": "normal", "sent_by": "admin"}'

# 第二次应该失败或被跳过
```

### 3. 重复拒收（应失败）
```bash
# 对同一个包裹创建两次拒收记录
curl -X POST "http://127.0.0.1:8000/api/rejections" \
  -H "Content-Type: application/json" \
  -d '{"parcel_id": 1, "reason": "拒收原因1", "rejected_by": "admin"}'

# 第二次应该返回400错误
```

### 4. 确认已确认的拒收（应失败）
```bash
# 对已确认的拒收再次确认
curl -X POST "http://127.0.0.1:8000/api/rejections/confirm" \
  -H "Content-Type: application/json" \
  -d '{"rejection_id": 1, "confirmed_by": "manager"}'

# 第二次应该返回400错误
```

### 5. 修改不允许的字段（应失败）
```bash
curl -X PUT "http://127.0.0.1:8000/api/parcels/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "field_name": "id",
    "field_value": "999",
    "operator": "admin",
    "reason": "测试"
  }'
```

### 6. 设置无效状态（应失败）
```bash
curl -X PUT "http://127.0.0.1:8000/api/parcels/status" \
  -H "Content-Type: application/json" \
  -d '{
    "parcel_id": 1,
    "new_status": "invalid_status",
    "operator": "admin"
  }'
```

### 7. 访问不存在的包裹（应返回404）
```bash
curl "http://127.0.0.1:8000/api/parcels/999999"
```

## 运行测试

### 运行所有测试
```bash
pytest test_main.py -v
```

### 运行指定测试类
```bash
pytest test_main.py::TestParcelCreation -v
pytest test_main.py::TestRejection -v
pytest test_main.py::TestReminder -v
```

### 生成测试覆盖率报告
```bash
pytest test_main.py --cov=. --cov-report=html
```

## 数据库结构

### 核心表
- `recipients`: 收件人信息
- `parcels`: 包裹主表
- `reminder_records`: 催取记录（支持去重）
- `rejections`: 拒收记录
- `return_reports`: 退回报告
- `operation_logs`: 操作日志（审计用）

## 滞留级别规则

| 滞留时间 | 级别 | 说明 |
|---------|------|------|
| < 12小时 | - | 正常 |
| 12-24小时 | normal | 需关注 |
| 1-3天 | warning | 黄色预警 |
| 3-7天 | urgent | 橙色预警 |
| > 7天 | critical | 红色预警 |

## 项目结构

```
.
├── main.py              # 主应用入口和API路由
├── database.py          # 数据库模型和连接配置
├── generate_data.py     # 测试数据生成脚本
├── test_main.py         # pytest测试用例
├── requirements.txt     # 依赖清单
└── README.md           # 项目说明文档
```

## 注意事项

1. 默认使用SQLite数据库，文件名为 `parcel_management.db`
2. 测试使用独立数据库 `test_parcel_management.db`，不影响生产数据
3. 所有操作都会记录操作日志，包括原始输入、操作人、结论和备注
4. 催取去重逻辑基于：包裹ID + 催取类型 + 日期
5. 导出功能使用openpyxl生成Excel格式报告
