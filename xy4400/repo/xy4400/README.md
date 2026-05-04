# 换电柜值班员系统 - REST API

社区共享电动车换电柜值班员使用的本地 REST API 系统，用于管理电池、柜门、换电记录和维修工单，并自动检测争议情况。

## 功能特性

### 数据管理
- **电池管理**: 跟踪电池状态、温度、位置和历史记录
- **柜门管理**: 监控柜门状态、开合记录、卡顿情况
- **换电记录**: 记录用户换电操作，包括电池交换、柜门使用、计费信息
- **维修工单**: 管理设备故障和维修流程

### 日志导入
支持每日导入四种日志：
1. **柜门传感器日志** - 柜门开合、卡顿等事件
2. **温度曲线日志** - 电池充电温度监控
3. **用户换电记录** - 换电操作记录
4. **维修工单** - 故障报修和处理记录

### 争议自动检测
系统自动检测以下四种争议类型：

| 争议类型 | 英文标识 | 检测逻辑 |
|---------|---------|---------|
| 疑似错放 | `wrong_battery_misplaced` | 换电后电池实际位置与预期柜门不符 |
| 过温未隔离 | `overtemp_not_isolated` | 电池温度超过45°C但状态非maintenance |
| 柜门卡滞后仍出借 | `door_jammed_still_lent` | 柜门报告卡顿后仍有换电记录 |
| 同一电池被重复计费 | `duplicate_billing` | 同一用户5分钟内有两次相近换电，或60秒内两次换电 |

### 复核与改判
- 支持对争议进行复核
- 可改判状态：确认(confirmed)、驳回(rejected)、已解决(resolved)
- 记录复核人、复核时间和复核意见

### 数据导出
- **客服仲裁报告**: 按日期导出 Markdown 格式报告，包含统计概览和争议详情
- **审计数据**: 按日期导出 JSON 格式数据，包含所有相关实体信息

## 技术栈

- **后端框架**: Flask 3.0
- **数据库**: SQLite (通过 Flask-SQLAlchemy ORM)
- **Python版本**: 3.8+

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:8080` 启动。

### 3. 导入测试数据（可选）

首先确保服务已启动，然后运行：

```bash
# 方式1: 使用初始化脚本（需要额外安装 requests）
pip install requests
python init_data.py

# 方式2: 使用 curl 示例
bash curl_examples.sh
```

## API 端点

### 基础信息

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/` | 服务健康检查和可用端点列表 |

### 数据查询

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/batteries` | 获取所有电池 |
| GET | `/api/batteries/<id>` | 获取单个电池详情 |
| GET | `/api/doors` | 获取所有柜门 |
| GET | `/api/doors/<id>` | 获取单个柜门详情 |
| GET | `/api/swaps` | 获取所有换电记录（按时间倒序） |
| GET | `/api/swaps/<id>` | 获取单个换电记录详情 |
| GET | `/api/maintenance` | 获取所有维修工单 |
| GET | `/api/maintenance/<id>` | 获取单个工单详情 |

### 日志导入

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/logs/door-sensor` | 导入柜门传感器日志 |
| POST | `/api/logs/temperature` | 导入温度曲线日志 |
| POST | `/api/logs/swap-records` | 导入换电记录 |
| POST | `/api/logs/maintenance` | 导入维修工单 |

**请求体格式示例**（以柜门传感器日志为例）：
```json
{
  "logs": [
    {
      "door_number": "A01",
      "log_time": "2026-05-04T08:00:00",
      "event_type": "open",
      "sensor_reading": 1.0
    }
  ]
}
```

### 争议管理

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/disputes` | 获取争议列表（支持按 status 和 type 过滤） |
| GET | `/api/disputes/<id>` | 获取单个争议详情 |
| POST | `/api/disputes/detect` | 触发争议检测 |
| PUT | `/api/disputes/<id>/review` | 复核/改判争议 |

**复核争议请求体示例**：
```json
{
  "status": "confirmed",
  "reviewer_id": "operator-001",
  "review_comment": "经核查，该争议属实"
}
```

**状态类型**：
- `pending_review` - 待复核
- `confirmed` - 已确认
- `rejected` - 已驳回
- `resolved` - 已解决

### 数据导出

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/export/arbitration/<date_str>` | 导出指定日期的客服仲裁 Markdown 报告 |
| GET | `/api/export/audit/<date_str>` | 导出指定日期的审计 JSON 数据 |

**日期格式**：`YYYY-MM-DD`，例如 `2026-05-04`

## 数据模型

### Battery (电池)
- `battery_code` - 电池编号
- `status` - 状态 (available, charging, in_use, maintenance, faulty)
- `current_temperature` - 当前温度
- `current_door_id` - 当前所在柜门

### CabinetDoor (柜门)
- `door_number` - 柜门编号
- `status` - 状态 (available, occupied, locked, open, fault, maintenance)
- `is_jammed` - 是否卡顿
- `jammed_at` - 卡顿时间

### SwapRecord (换电记录)
- `swap_code` - 换电单号
- `user_id` - 用户ID
- `old_battery_id` / `new_battery_id` - 旧/新电池
- `old_door_id` / `new_door_id` - 旧/新柜门
- `status` - 状态 (in_progress, completed, cancelled, disputed)
- `amount` - 金额

### MaintenanceOrder (维修工单)
- `order_code` - 工单编号
- `issue_type` - 问题类型 (door_jam, battery_fault, temperature_issue, other)
- `status` - 状态 (pending, in_progress, resolved, closed)

### Dispute (争议)
- `dispute_code` - 争议编号
- `dispute_type` - 争议类型
- `status` - 状态
- `related_swap_id` / `related_battery_id` / `related_door_id` - 关联实体
- `evidence` - 证据 JSON
- `reviewer_id` / `reviewed_at` / `review_comment` - 复核信息

## 使用示例

### 导入换电记录

```bash
curl -X POST http://localhost:8080/api/logs/swap-records \
  -H "Content-Type: application/json" \
  -d '{
    "swaps": [
      {
        "swap_code": "SWAP-20260504-001",
        "user_id": "USER-001",
        "old_battery_code": "BAT-001",
        "new_battery_code": "BAT-005",
        "old_door_number": "A01",
        "new_door_number": "A05",
        "swap_started_at": "2026-05-04T08:00:00",
        "swap_completed_at": "2026-05-04T08:02:30",
        "status": "completed",
        "amount": 15.0
      }
    ]
  }'
```

### 检测争议

```bash
curl -X POST http://localhost:8080/api/disputes/detect \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 复核争议

```bash
curl -X PUT http://localhost:8080/api/disputes/1/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "reviewer_id": "operator-001",
    "review_comment": "经核查，该争议属实"
  }'
```

### 导出报告

```bash
# 导出 Markdown 仲裁报告
curl -o arbitration_2026-05-04.md \
  http://localhost:8080/api/export/arbitration/2026-05-04

# 导出 JSON 审计数据
curl -o audit_2026-05-04.json \
  http://localhost:8080/api/export/audit/2026-05-04
```

## 项目结构

```
.
├── app.py              # Flask 应用入口
├── models.py           # 数据模型定义
├── api.py              # API 路由和业务逻辑
├── init_data.py        # 数据初始化脚本
├── requirements.txt    # Python 依赖
├── curl_examples.sh    # Curl 示例脚本
├── README.md           # 本文档
├── data/               # 测试数据目录
│   ├── door_sensor_logs.json
│   ├── temperature_logs.json
│   ├── swap_records.json
│   └── maintenance_orders.json
└── swap_cabinet.db     # SQLite 数据库（运行后生成）
```

## 测试数据说明

`data/` 目录包含预设的测试数据，可用于演示系统功能：

- **door_sensor_logs.json**: 8条柜门传感器记录，包含柜门A02的卡顿事件
- **temperature_logs.json**: 8条温度记录，包含2条过温数据 (46.8°C, 52.1°C)
- **swap_records.json**: 6条换电记录，其中SWAP-005和SWAP-006由同一用户在1分钟内完成，将触发重复计费检测
- **maintenance_orders.json**: 4条维修工单，包含柜门卡顿、温度问题等类型

## 争议检测算法说明

### 1. 疑似错放 (wrong_battery_misplaced)
- 检查过去24小时内完成的换电记录
- 验证旧电池是否实际放置在目标柜门中
- 如果位置不符，创建争议

### 2. 过温未隔离 (overtemp_not_isolated)
- 检查过去2小时内的温度记录
- 阈值: 45°C
- 如果电池温度超标但状态不是 `maintenance`，创建争议

### 3. 柜门卡滞后仍出借 (door_jammed_still_lent)
- 查找所有标记为卡顿的柜门
- 检查卡顿时间之后是否有换电记录使用该柜门
- 如果有，创建争议

### 4. 重复计费 (duplicate_billing)
- 检查过去24小时内的换电记录
- 按用户分组，检查时间间隔
- 触发条件：
  - 两次换电时间间隔 < 60秒，或
  - 两次换电时间间隔 < 300秒且出借同一电池

## 注意事项

1. **数据库**: 默认使用 SQLite，数据库文件 `swap_cabinet.db` 会在首次运行时自动创建
2. **时区**: 系统使用 UTC 时间存储
3. **数据持久性**: SQLite 数据存储在本地文件中
4. **调试模式**: 默认开启 Flask 调试模式，生产环境请关闭

## 许可证

本项目仅供学习和内部使用。
