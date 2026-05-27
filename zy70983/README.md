# 智慧路灯故障派修 API 服务

## 项目概述

智慧路灯故障派修 API 服务，用于市政运维部门提交故障派修材料，系统自动处理、去重、校验并导出结果。

## 核心功能

1. **材料提交与去重**：同一批材料重复提交时，系统识别并返回原有处理结果
2. **任务状态管理**：支持处理中、处理失败、人工确认、已导出四种状态，数据持久化存储
3. **数据校验**：自动检测缺字段、时间矛盾、重复编号等问题
4. **错误定位**：错误明细可追溯到原始材料位置
5. **结果导出**：导出结果包含告警、巡查、维修信息及地图位置一致性判断
6. **统计查询**：提供任务列表和统计数据查询接口

## 技术栈

- Node.js (>= 18.0.0)
- Express 4.x
- SQLite (better-sqlite3)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 运行测试

```bash
npm test
```

## 数据库结构

### tasks 表（任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 任务ID（主键） |
| material_hash | TEXT | 材料哈希（唯一索引，用于去重） |
| status | TEXT | 任务状态 |
| submit_time | INTEGER | 提交时间戳 |
| last_handler | TEXT | 最后处理人ID |
| total_records | INTEGER | 总记录数 |
| valid_records | INTEGER | 有效记录数 |
| error_records | INTEGER | 错误记录数 |
| raw_material | TEXT | 原始材料JSON |
| export_time | INTEGER | 导出时间戳 |

### records 表（记录表）

存储处理后的有效记录，包含告警、巡查、维修信息及地图位置标记。

### errors 表（错误表）

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | TEXT | 任务ID |
| record_index | INTEGER | 原始材料中的记录位置 |
| error_type | TEXT | 错误类型 |
| error_field | TEXT | 错误字段 |
| error_message | TEXT | 错误信息 |
| raw_data | TEXT | 原始数据 |

### handlers 表（处理人表）

存储运维人员信息。

## API 接口

### 1. 提交材料

**POST** `/api/tasks`

请求体：
```json
{
  "material": {
    "batch_no": "BATCH-001",
    "source": "市政运维中心",
    "records": [
      {
        "record_no": "REC-001",
        "streetlight_id": "SL-10001",
        "alarm_time": 1716796800000,
        "alarm_level": "high",
        "alarm_type": "power_failure",
        "alarm_location": { "x": 116.4074, "y": 39.9042 },
        "patrol_time": 1716883200000,
        "patrol_person": "张三",
        "patrol_issue": "灯泡烧毁",
        "repair_time": 1716926400000,
        "repair_person": "李四",
        "repair_result": "已更换灯泡",
        "repair_location": { "x": 116.4074, "y": 39.9042 }
      }
    ]
  },
  "handler_id": "h001"
}
```

响应：
```json
{
  "code": 201,
  "message": "提交成功",
  "data": {
    "is_duplicate": false,
    "task": {
      "id": "T_LV8VOFB57O",
      "status": "manual_confirm",
      "total_records": 10,
      "valid_records": 8,
      "error_records": 2
    }
  }
}
```

### 2. 获取任务列表

**GET** `/api/tasks?status=processing&limit=50&offset=0`

查询参数：
- `status`: 可选，筛选状态（processing/failed/manual_confirm/exported）
- `limit`: 可选，分页大小，默认50
- `offset`: 可选，偏移量，默认0

### 3. 获取任务详情

**GET** `/api/tasks/:taskId`

返回任务详情、有效记录列表和错误明细。

### 4. 更新任务状态

**PATCH** `/api/tasks/:taskId/status`

请求体：
```json
{
  "status": "exported",
  "handler_id": "h001"
}
```

### 5. 导出任务结果

**POST** `/api/tasks/:taskId/export`

请求体：
```json
{
  "handler_id": "h001"
}
```

响应包含：
- 每条记录的告警信息（是否在图上）
- 巡查信息（是否在图上）
- 维修反馈信息（是否在图上）
- 地图位置是否一致标记
- 最后处理人信息

### 6. 获取统计数据

**GET** `/api/statistics`

返回全局统计数据。

### 7. 健康检查

**GET** `/health`

## 任务状态说明

| 状态 | 说明 |
|------|------|
| processing | 处理中 |
| failed | 处理失败 |
| manual_confirm | 需人工确认（存在错误时） |
| exported | 已导出 |

## 错误类型

| 错误类型 | 说明 |
|----------|------|
| missing_field | 缺少必填字段 |
| time_conflict | 时间矛盾 |
| duplicate_no | 记录编号重复 |

## 项目结构

```
.
├── src/
│   ├── server.js      # 服务入口和路由
│   ├── database.js    # 数据库初始化和连接
│   └── processor.js   # 业务逻辑处理
├── tests/
│   └── test-api.js    # API测试脚本
├── package.json
├── README.md
└── .gitignore
```

## 文件代码参考

- [server.js](file:///Users/lzy/pro/solo/workspaces/zy70983/src/server.js)
- [database.js](file:///Users/lzy/pro/solo/workspaces/zy70983/src/database.js)
- [processor.js](file:///Users/lzy/pro/solo/workspaces/zy70983/src/processor.js)
- [test-api.js](file:///Users/lzy/pro/solo/workspaces/zy70983/tests/test-api.js)