# 临时改线安全核对器

校车临时改线安全核对后端服务 - 为校车调度老师提供完整的改线方案安全校验功能。

## 功能特性

### 核心校验规则
- **座位容量校验**: 检查车辆座位数是否满足学生分配数量
- **时间窗校验**: 检查站点时间窗设置是否合理，站点顺序时间是否正确
- **司机资质校验**: 检查司机驾驶证和从业资格证是否过期、状态是否正常
- **接送人授权校验**: 检查学生接送授权是否有效、是否过期
- **重复接送校验**: 检查同一学生是否被多辆车分配
- **交接记录校验**: 检查低年级/特殊学生是否有交接记录

### 生命周期管理
- 方案创建 (草稿状态)
- 方案提交审核
- 方案审批
- 方案发布
- 方案撤回

### 数据导入
- 批量导入学生、站点、线路、车辆、司机、授权表

### 导出功能
- **Markdown 通知单**: 导出改线通知单，包含详细信息和风险提示
- **CSV 风险清单**: 导出风险清单，按风险等级排序
- **JSON 审计包**: 导出完整审计数据包，包含方案详情、风险报告和审计日志

## 技术栈

- **框架**: FastAPI (Python)
- **数据库**: SQLite (SQLAlchemy ORM)
- **数据验证**: Pydantic
- **服务器**: Uvicorn

## 安装

### 前置要求
- Python 3.9+
- pip

### 安装依赖

```bash
# 创建虚拟环境 (推荐)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -e .
```

## 启动服务

```bash
# 开发模式启动
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

服务启动后访问:
- API 文档 (Swagger UI): http://localhost:8000/docs
- API 文档 (ReDoc): http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

## 示例数据

项目包含 `sample_data.json` 示例数据文件，可以用于测试。

### 导入示例数据

```bash
# 导入示例数据
curl -X POST "http://localhost:8000/api/import/batch" \
  -H "Content-Type: application/json" \
  -d @sample_data.json
```

示例数据包含：
- 4名学生 (2名低年级学生)
- 4个站点
- 2条线路
- 3辆车 (1辆维修中)
- 3名司机 (1名已离职)
- 4条授权记录 (1条即将过期)

## API 完整流程示例

### 1. 导入基础数据

```bash
curl -X POST "http://localhost:8000/api/import/batch" \
  -H "Content-Type: application/json" \
  -d @sample_data.json
```

### 2. 查看已导入的学生

```bash
curl "http://localhost:8000/api/master/students/"
```

### 3. 查看已导入的车辆

```bash
curl "http://localhost:8000/api/master/vehicles/"
```

### 4. 查看已导入的司机

```bash
curl "http://localhost:8000/api/master/drivers/"
```

### 5. 创建改线方案

```bash
curl -X POST "http://localhost:8000/api/plans/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2025年5月5日朝阳路修路临时改线",
    "reason": "因朝阳路道路维修，原站点朝阳公园南门无法停靠，需改线至团结湖地铁站接送学生。同时学生赵六请假，需从名单中移除。",
    "reason_category": "road_construction",
    "effective_date": "2025-05-05",
    "created_by": "张调度",
    "vehicle_assignments": [
      {
        "vehicle_id": 1,
        "driver_id": 1,
        "attendant_teacher": "刘老师",
        "attendant_teacher_phone": "13600136001",
        "trip_direction": "morning",
        "sequence": 1,
        "stop_assignments": [
          {
            "stop_id": 2,
            "sequence": 1,
            "estimated_arrival_time": "07:15:00",
            "is_added": true,
            "remarks": "原站点维修，改至团结湖地铁站"
          }
        ],
        "student_assignments": [
          {
            "student_id": 1,
            "pickup_stop_id": 2,
            "dropoff_stop_id": 2,
            "authorized_guardian_name": "张父",
            "needs_handover_record": true,
            "has_handover_record": true,
            "remarks": "低年级学生，需交接"
          },
          {
            "student_id": 2,
            "pickup_stop_id": 2,
            "dropoff_stop_id": 2,
            "authorized_guardian_name": "李父",
            "needs_handover_record": true,
            "has_handover_record": true,
            "remarks": "特殊照顾学生"
          }
        ]
      },
      {
        "vehicle_id": 2,
        "driver_id": 2,
        "attendant_teacher": null,
        "trip_direction": "morning",
        "sequence": 2,
        "stop_assignments": [
          {
            "stop_id": 3,
            "sequence": 1,
            "estimated_arrival_time": "07:20:00"
          },
          {
            "stop_id": 4,
            "sequence": 2,
            "estimated_arrival_time": "07:30:00"
          }
        ],
        "student_assignments": [
          {
            "student_id": 3,
            "pickup_stop_id": 3,
            "dropoff_stop_id": 3,
            "authorized_guardian_name": "王父",
            "needs_handover_record": false,
            "has_handover_record": true
          },
          {
            "student_id": 1,
            "pickup_stop_id": 3,
            "dropoff_stop_id": 3,
            "authorized_guardian_name": "张父",
            "needs_handover_record": false,
            "has_handover_record": true
          }
        ]
      }
    ]
  }'
```

注意：此示例方案故意包含一些风险以便测试校验功能：
- 学生1 (张三) 被分配到两辆车 (重复接送风险)
- 车辆2未分配随车老师但可能有低年级学生
- 司机2的驾照即将过期

### 6. 校验改线方案

```bash
# 假设方案 ID 为 1
curl -X POST "http://localhost:8000/api/plans/1/validate"
```

预期校验结果会发现：
- 学生张三被两辆车分配 (严重风险)
- 李父的授权即将过期 (中等风险)
- 司机李师傅的驾照即将过期 (中等风险)

### 7. 修复方案后重新提交

```bash
# 创建一个正确的方案
curl -X POST "http://localhost:8000/api/plans/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2025年5月5日朝阳路修路临时改线 (修正版)",
    "reason": "因朝阳路道路维修，原站点朝阳公园南门无法停靠，需改线至团结湖地铁站接送学生。",
    "reason_category": "road_construction",
    "effective_date": "2025-05-05",
    "created_by": "张调度",
    "vehicle_assignments": [
      {
        "vehicle_id": 1,
        "driver_id": 1,
        "attendant_teacher": "刘老师",
        "attendant_teacher_phone": "13600136001",
        "trip_direction": "morning",
        "sequence": 1,
        "stop_assignments": [
          {
            "stop_id": 2,
            "sequence": 1,
            "estimated_arrival_time": "07:15:00",
            "is_added": true,
            "remarks": "原站点维修，改至团结湖地铁站"
          }
        ],
        "student_assignments": [
          {
            "student_id": 1,
            "pickup_stop_id": 2,
            "dropoff_stop_id": 2,
            "authorized_guardian_name": "张父",
            "needs_handover_record": true,
            "has_handover_record": true
          },
          {
            "student_id": 2,
            "pickup_stop_id": 2,
            "dropoff_stop_id": 2,
            "authorized_guardian_name": "李父",
            "needs_handover_record": true,
            "has_handover_record": true
          }
        ]
      },
      {
        "vehicle_id": 2,
        "driver_id": 1,
        "attendant_teacher": null,
        "trip_direction": "morning",
        "sequence": 2,
        "stop_assignments": [
          {
            "stop_id": 3,
            "sequence": 1,
            "estimated_arrival_time": "07:20:00"
          },
          {
            "stop_id": 4,
            "sequence": 2,
            "estimated_arrival_time": "07:30:00"
          }
        ],
        "student_assignments": [
          {
            "student_id": 3,
            "pickup_stop_id": 3,
            "dropoff_stop_id": 3,
            "authorized_guardian_name": "王父",
            "needs_handover_record": false,
            "has_handover_record": true
          },
          {
            "student_id": 4,
            "pickup_stop_id": 4,
            "dropoff_stop_id": 4,
            "authorized_guardian_name": null,
            "needs_handover_record": false,
            "has_handover_record": true
          }
        ]
      }
    ]
  }'
```

### 8. 校验修正后的方案

```bash
# 假设新方案 ID 为 2
curl -X POST "http://localhost:8000/api/plans/2/validate"
```

### 9. 提交方案

```bash
curl -X POST "http://localhost:8000/api/plans/2/submit?actor=张调度"
```

### 10. 审批方案

```bash
curl -X POST "http://localhost:8000/api/plans/2/approve?actor=李主任"
```

### 11. 发布方案

```bash
curl -X POST "http://localhost:8000/api/plans/2/publish?actor=王校长"
```

### 12. 查看方案状态

```bash
curl "http://localhost:8000/api/plans/2"
```

### 13. 导出 Markdown 通知单

```bash
curl -o notification.md "http://localhost:8000/api/plans/2/export/markdown"
```

### 14. 导出 CSV 风险清单

```bash
curl -o risks.csv "http://localhost:8000/api/plans/2/export/csv-risks"
```

### 15. 导出 JSON 审计包

```bash
curl -o audit.json "http://localhost:8000/api/plans/2/export/json-audit"
```

### 16. 查看审计日志

```bash
# 查看方案的审计日志
curl "http://localhost:8000/api/plans/2/audit-logs"

# 查看所有审计日志
curl "http://localhost:8000/api/plans/audit-logs/all"
```

### 17. 撤回已发布的方案

```bash
curl -X POST "http://localhost:8000/api/plans/2/withdraw?actor=王校长"
```

## API 端点概览

### 基础数据管理 (`/api/master`)
- `GET/POST /students/` - 学生列表/创建
- `GET/PUT /students/{id}` - 学生详情/更新
- `GET/POST /stops/` - 站点列表/创建
- `GET /stops/{id}` - 站点详情
- `GET/POST /routes/` - 线路列表/创建
- `GET /routes/{id}` - 线路详情
- `GET/POST /vehicles/` - 车辆列表/创建
- `GET /vehicles/{id}` - 车辆详情
- `GET/POST /drivers/` - 司机列表/创建
- `GET /drivers/{id}` - 司机详情
- `POST /authorizations/` - 创建授权
- `GET /authorizations/student/{id}` - 学生授权列表

### 批量导入 (`/api/import`)
- `POST /batch` - 批量导入所有数据
- `POST /students` - 导入学生
- `POST /stops` - 导入站点
- `POST /vehicles` - 导入车辆
- `POST /drivers` - 导入司机

### 改线方案管理 (`/api/plans`)
- `GET/POST /` - 方案列表/创建
- `GET/PUT /{id}` - 方案详情/更新
- `POST /{id}/submit` - 提交方案
- `POST /{id}/validate` - 校验方案
- `POST /{id}/approve` - 审批通过
- `POST /{id}/publish` - 发布方案
- `POST /{id}/withdraw` - 撤回方案
- `GET /{id}/risks` - 风险报告列表
- `GET /{id}/audit-logs` - 方案审计日志
- `GET /{id}/export/markdown` - 导出 Markdown 通知单
- `GET /{id}/export/csv-risks` - 导出 CSV 风险清单
- `GET /{id}/export/json-audit` - 导出 JSON 审计包
- `GET /audit-logs/all` - 所有审计日志

## 风险等级说明

| 等级 | 说明 | 示例 |
|------|------|------|
| CRITICAL (严重) | 必须立即修复，禁止发布 | 超员、重复接送、授权过期、驾照过期 |
| HIGH (高) | 强烈建议修复 | 站点时间错误、无随车老师、车辆状态异常 |
| MEDIUM (中等) | 建议关注 | 驾照即将过期、授权即将过期、座位已满 |
| LOW (低) | 一般提示 | - |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 应用入口
│   ├── database.py          # 数据库配置
│   ├── models.py            # SQLAlchemy 数据模型
│   ├── schemas.py           # Pydantic 验证模型
│   ├── crud.py              # 数据库操作
│   ├── validations.py       # 校验规则引擎
│   ├── exports.py           # 导出功能
│   └── routers/
│       ├── __init__.py
│       ├── master_data.py   # 基础数据 API
│       ├── import_data.py   # 批量导入 API
│       └── plans.py         # 改线方案 API
├── pyproject.toml           # 项目配置
├── sample_data.json         # 示例数据
└── README.md
```

## 注意事项

1. **SQLite 数据库**: 服务首次启动时会自动创建 `school_bus.db` 文件
2. **时间格式**: 所有时间使用 24 小时制，格式为 `HH:MM:SS`
3. **日期格式**: 使用 ISO 格式 `YYYY-MM-DD`
4. **低年级标记**: `is_young_grade=true` 的学生会被自动标记需要交接

## 许可证

MIT License
