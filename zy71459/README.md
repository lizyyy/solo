# 音乐学院排练室预约整数规划系统

基于整数规划的智能排期后端服务，支持乐队人数、设备需求、考试周等多维度约束优化。

## 核心特性

1. **整数规划排期算法** - 使用 PuLP CBC 求解器进行最优分配
2. **多维度约束** - 房间容量、设备清单、时间段、考试周限制
3. **完整数据追溯** - 预约申请、房间设备、排期来源独立记录，复核时可见
4. **冲突留痕机制** - 设备/时间/容量冲突完整记录，不被覆盖
5. **批次报告生成** - 整数规划结果、冲突解释、方案对比汇总导出
6. **批次标识管理** - 文件名和内容带批次号，月底不混淆

## 项目结构

```
├── app/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── schemas.py         # Pydantic Schema
│   ├── database.py        # 数据库连接
│   ├── repositories.py    # 数据访问层
│   ├── scheduler.py       # 整数规划核心算法
│   ├── report_generator.py # 报告生成器
│   ├── exceptions.py      # 异常定义
│   └── main.py            # FastAPI 主入口
├── reports/               # 报告输出目录
├── init_data.py           # 样本数据初始化
├── requirements.txt       # 依赖列表
└── scheduling.db          # SQLite 数据库
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样本数据

```bash
python init_data.py
```

### 3. 启动服务

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心 API

### 基础数据管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/rooms/` | 创建排练室 |
| GET | `/rooms/` | 获取房间列表 |
| POST | `/equipment/` | 创建设备 |
| POST | `/bands/` | 创建乐队 |
| POST | `/exam-weeks/` | 设置考试周 |

### 预约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/bookings/` | 提交预约申请 |
| GET | `/bookings/` | 查询预约列表 |
| PUT | `/bookings/{id}/review` | 复核预约 |

### 整数规划排期

**POST** `/scheduling/run`

批量执行整数规划排期

请求体:
```json
{
  "batch_name": "2024春季第15周排期",
  "scheduled_date": "2024-05-20",
  "booking_ids": [1, 2, 3],
  "created_by": "教务老师"
}
```

响应包含:
- `batch_id`: 批次号 (如 `BATCH_20240520_143022_abc123`)
- `schedules`: 成功排期列表，每笔含 `source_note` 来源说明
- `conflicts`: 冲突记录，含详细原因和替代方案建议
- `algorithm_summary`: 整数规划求解详情
- `report_file`: 报告文件名

### 报告导出

**GET** `/reports/{filename}`

下载 Excel 报告，包含5个工作表:
1. **概览** - 批次统计、算法信息
2. **排期结果** - 分配房间、时间、设备来源
3. **冲突记录** - 冲突类型、问题描述、替代方案
4. **算法详情** - 整数规划参数、求解过程
5. **审计追踪** - 每笔操作的时间、人员、原因

## 数据设计要点

### 预约申请 (BookingRequest)
- `equipment`: 独立关联表，每条记录 `source_note` 标记来源
- `status`: pending/scheduled/conflict/rejected 状态流转
- `batch_id`: 关联排期批次，可追溯

### 房间设备 (RoomEquipment)
- 不合并记录，每条设备配置独立
- `source_note` 字段记录: "房间标配" / "临时添加" / "考试周专用"

### 冲突记录 (ConflictRecord)
- 不自动删除，历史永久保留
- `conflict_details` JSON 存完整分析:
  - 设备不足的具体型号数量
  - 时间段重叠的预约ID
  - 容量不足的房间列表
  - 替代日期建议

### 批次报告 (BatchReport)
- `batch_id`: 唯一标识，文件名前缀
- `algorithm_summary`: 记录求解器状态、目标值、优先级分布
- `file_path`: 报告物理路径，支持重新下载

## 整数规划约束

1. **每个预约最多分配1个房间**
2. **同一房间时间不重叠**
3. **房间容量 ≥ 参与人数**
4. **房间设备 ≥ 预约设备需求**
5. **优先级加权最大化** (exam:10, high:5, normal:3, low:1)

## 异常处理

系统提供结构化异常返回:

```json
{
  "detail": {
    "message": "预约申请 ID 999 不存在",
    "code": "resource_not_found"
  }
}
```

异常码:
- `resource_not_found` - 资源不存在
- `invalid_booking` - 预约数据无效
- `conflict_equipment` - 设备冲突
- `capacity_exceeded` - 容量不足
- `batch_processing_error` - 批次处理失败
