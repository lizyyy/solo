# 文印店打印急件插队 API

可维护的文印店打印急件插队管理系统，包含 REST 接口、本地持久化、初始化数据和可读错误返回。

## 核心功能

- ✅ 急单插队管理
- ✅ 产能日志一致性检查（防止静默覆盖原记录）
- ✅ 交付时间冲突检测
- ✅ 订单状态流转（正常/驳回/补录/已完成）
- ✅ 数据导入验证
- ✅ 数据导出
- ✅ 详细错误返回

## 技术栈

- Python 3.8+
- FastAPI 0.104.1
- SQLAlchemy 2.0.23
- SQLite（本地持久化）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_data.py
```

初始化后数据库包含：
- 2 条正常状态订单
- 1 条驳回状态订单
- 1 条补录状态订单
- 1 条已完成状态订单

### 3. 运行验收测试

```bash
python acceptance_test.py
```

测试包含：
- 一条正常记录创建
- 一条冲突记录检测（触发 DELIVERY_TIME_CONFLICT 错误）
- 一条导入坏行验证
- 接口返回与导出内容互校验

### 4. 启动 API 服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看交互式 API 文档

## API 接口

### 急单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/urgent-orders/` | 创建急单（带冲突检测） |
| POST | `/api/urgent-orders/force-insert/` | 强制插入急单 |
| GET | `/api/urgent-orders/` | 查询急单列表 |
| GET | `/api/urgent-orders/{order_id}` | 查询单个急单详情（含日志） |
| PATCH | `/api/urgent-orders/{order_id}/status` | 更新订单状态 |

### 产能日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/capacity-logs/` | 查询产能日志列表 |

### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/orders` | 导出订单数据 |
| POST | `/api/import/validate` | 验证导入数据 |

### 队列状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue/status` | 获取队列状态 |

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| `DELIVERY_TIME_CONFLICT` | 插队操作影响了已承诺的交付时间 |
| `CAPACITY_CONSISTENCY_ERROR` | 不能静默覆盖原产能日志记录 |
| `ORDER_NOT_FOUND` | 订单不存在 |
| `ORDER_ALREADY_EXISTS` | 订单已存在 |
| `INVALID_QUEUE_POSITION` | 无效的插队位置 |
| `STATUS_TRANSITION_ERROR` | 无效的状态转换 |
| `IMPORT_VALIDATION_ERROR` | 导入验证错误 |

## 数据模型

### PrintUrgentOrder（打印急单）

| 字段 | 类型 | 说明 |
|------|------|------|
| order_no | String | 订单编号 |
| customer_name | String | 客户姓名 |
| customer_phone | String | 客户电话 |
| document_name | String | 文档名称 |
| page_count | Integer | 页数 |
| color_mode | String | 彩色模式（color/black_white） |
| paper_size | String | 纸张尺寸（A4/A3） |
| double_sided | Boolean | 是否双面 |
| binding_type | String | 装订方式 |
| original_promised_time | DateTime | 原承诺交付时间 |
| new_promised_time | DateTime | 加急后交付时间 |
| urgent_reason | Text | 加急原因 |
| queue_position_before | Integer | 插队前位置 |
| queue_position_after | Integer | 插队后位置 |
| status | String | 状态（normal/rejected/supplemented/completed） |
| reject_reason | Text | 驳回原因 |
| supplement_notes | Text | 补录备注 |
| operator | String | 操作人 |

### CapacityLog（产能日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| log_no | String | 日志编号 |
| log_type | String | 日志类型 |
| affected_order_no | String | 受影响订单号 |
| capacity_impact | Float | 产能影响值 |
| impact_description | Text | 影响描述 |
| operator | String | 操作人 |

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # 数据模型定义
├── schemas.py           # Pydantic 模式定义
├── crud.py              # 数据库操作
├── database.py          # 数据库配置
├── exceptions.py        # 自定义异常
├── init_data.py         # 初始化样例数据
├── acceptance_test.py   # 验收测试脚本
├── requirements.txt     # 依赖列表
└── README.md           # 项目文档
```
