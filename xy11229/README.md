# 换电运营值班系统

基于 FastAPI 的换电运营值班系统，支持设备事件导入、客服单分类、接单、归因、派修、复核、导出全流程。

## 功能特性

- 📥 **数据导入**：支持 JSON 格式设备事件、CSV 格式客服单
- 🔍 **自动归因**：柜门打不开、扫码失败、空仓误报自动分类
- 📋 **工作流**：接单 → 归因 → 派修 → 复核 → 导出
- ⚡ **幂等性**：重复提交结果稳定，不会多扣、多派、多算
- 🔒 **敏感数据**：手机号、姓名等敏感字段自动脱敏
- 📊 **坏记录**：导入失败记录保留原始位置、失败原因、修改建议

## 技术栈

- Python 3.8+
- FastAPI 0.104+
- Uvicorn
- Pandas
- Pydantic

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 3. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## API 接口

### 导入接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/import/device-events` | 导入设备事件 JSON |
| POST | `/api/v1/import/service-orders` | 导入客服单 CSV |

### 工作流接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/workflow/receive` | 接单 |
| POST | `/api/v1/workflow/attribute` | 归因 |
| POST | `/api/v1/workflow/dispatch` | 派修 |
| POST | `/api/v1/workflow/review` | 复核 |
| POST | `/api/v1/workflow/export` | 导出 |

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/orders` | 获取所有订单 |
| GET | `/api/v1/orders/{order_id}` | 获取订单详情 |
| GET | `/api/v1/device-events` | 获取所有设备事件 |
| GET | `/api/v1/bad-records` | 获取坏记录 |
| GET | `/api/v1/stats` | 获取统计数据 |

## 数据格式

### 设备事件 JSON 示例

```json
[
    {
        "event_id": "evt_001",
        "device_id": "dev_123",
        "station_id": "st_456",
        "event_type": "door_error",
        "event_time": "2024-01-15 09:30:00",
        "severity": "high"
    }
]
```

### 客服单 CSV 示例

```csv
order_id,customer_name,customer_phone,station_id,device_id,problem_description,report_time,source
order_001,张三,13800138000,st_456,dev_123,柜门打不开,2024-01-15 09:35:00,customer_service
```

### 事件类型

- `door_error`: 柜门打不开
- `scan_fail`: 扫码失败
- `empty_bin_false_alarm`: 空仓误报
- `other`: 其他问题

## 幂等性使用

在请求中添加 `idempotency_key` 字段，相同 key 的重复请求会返回相同结果，不会重复处理。

## 敏感字段处理

系统自动识别并脱敏以下字段：
- 手机号（11位）
- 身份证号（18位）
- 姓名、地址等配置的敏感字段

脱敏后格式：前2位 + **** + 后2位

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖列表
├── .env                    # 配置文件
├── app/
│   ├── config.py           # 配置
│   ├── models/             # 数据模型
│   │   ├── models.py       # Pydantic 模型
│   │   └── storage.py      # 内存存储
│   ├── services/           # 业务逻辑
│   │   ├── import_service.py    # 导入服务
│   │   └── workflow_service.py  # 工作流服务
│   ├── api/                # API 路由
│   │   └── routes.py
│   ├── schemas/            # 请求/响应 schema
│   │   └── request_schemas.py
│   └── utils/              # 工具函数
│       └── sensitive.py    # 敏感数据处理
├── sample_data/            # 示例数据
│   ├── device_events.json
│   └── service_orders.csv
└── test_api.sh             # 测试脚本
```
