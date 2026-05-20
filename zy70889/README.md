# 社区矫正签到预警系统

用于处理社区矫正对象签到、请假和定位异常的API服务，解决多源数据导入混乱问题。

## 功能特性

- **数据导入**: 支持签到CSV、请假JSON、定位摘要JSON上传
- **去重机制**: 基于内容哈希的批次去重，防止重复提交
- **规则引擎**:
  - 超时未签检测（30分钟/60分钟两级阈值）
  - 请假覆盖自动识别
  - 定位轨迹缺口检测（缺口数/最长间隔）
  - 越界警告
- **结果分级**: 正常项、待确认项、失败项三级分类
- **处理建议**: 每条异常记录附带处理建议
- **追踪查询**: 支持从单条明细到汇总报告的完整追溯

## 项目结构

```
community-correction/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI主应用
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API路由
│   ├── core/
│   │   ├── __init__.py
│   │   └── database.py      # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # SQLAlchemy数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic数据模式
│   ├── services/
│   │   ├── __init__.py
│   │   ├── data_import.py   # 数据导入服务
│   │   └── rules_engine.py  # 规则引擎
│   └── utils/
│       └── __init__.py
├── data/
│   ├── sample_checkin.csv   # 签到示例数据
│   ├── sample_leave.json    # 请假示例数据
│   └── sample_location.json # 定位示例数据
├── tests/
│   └── __init__.py
└── requirements.txt
```

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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问接口

- API文档 (Swagger): http://localhost:8000/docs
- API文档 (ReDoc): http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

## API接口说明

### 数据上传接口

#### 1. 上传签到CSV
```
POST /api/v1/upload/checkin?source=APP
Content-Type: multipart/form-data
```

CSV文件格式要求:
| 字段 | 类型 | 说明 |
|------|------|------|
| person_id | string | 人员ID (必填) |
| person_name | string | 人员姓名 |
| checkin_time | datetime | 实际签到时间 |
| scheduled_time | datetime | 应签到时间 |
| location | string | 签到地点 |

#### 2. 上传请假JSON
```
POST /api/v1/upload/leave?source=MANUAL
Content-Type: multipart/form-data
```

JSON字段说明:
```json
{
  "person_id": "P001",
  "person_name": "张三",
  "start_time": "2024-01-15 00:00:00",
  "end_time": "2024-01-16 23:59:59",
  "reason": "因病就医",
  "status": "approved"
}
```

#### 3. 上传定位摘要JSON
```
POST /api/v1/upload/location?source=APP
Content-Type: multipart/form-data
```

JSON字段说明:
```json
{
  "person_id": "P001",
  "person_name": "张三",
  "date": "2024-01-15",
  "total_points": 24,
  "gap_count": 0,
  "max_gap_minutes": 0,
  "out_of_bounds": false
}
```

### 查询接口

#### 1. 查询处理结果列表
```
GET /api/v1/results?person_id=P001&status=failed&limit=100
```

#### 2. 查询单条结果详情
```
GET /api/v1/results/{result_id}
```

#### 3. 查询批次列表
```
GET /api/v1/batches?record_type=checkin
```

#### 4. 生成汇总报告
```
GET /api/v1/report?start_date=2024-01-01&end_date=2024-01-31
```

## 业务规则说明

### 签到规则

| 规则代码 | 规则名称 | 触发条件 | 处理建议 |
|----------|----------|----------|----------|
| CHECKIN_NORMAL | 签到正常 | 按时签到 | 无需处理 |
| CHECKIN_TIMEOUT | 超时未签 | 迟到30-60分钟 | 联系核实原因 |
| CHECKIN_TIMEOUT_SEVERE | 严重超时 | 迟到超过60分钟 | 立即联系，必要时实地走访 |
| CHECKIN_TIME_MISSING | 时间缺失 | 签到时间为空 | 核实数据来源 |
| LEAVE_COVERAGE | 请假覆盖 | 签到时间在请假期间 | 正常记录，无需处理 |

### 定位规则

| 规则代码 | 规则名称 | 触发条件 | 处理建议 |
|----------|----------|----------|----------|
| LOCATION_NORMAL | 定位正常 | 无异常 | 无需处理 |
| TRAJECTORY_GAP | 轨迹缺口 | 缺口超过3处 | 联系核实定位异常原因 |
| TRAJECTORY_GAP_LONG | 长时缺失 | 最大间隔超过60分钟 | 确认是否正常情况 |
| TRAJECTORY_GAP_SEVERE | 严重缺失 | 最大间隔超过120分钟 | 立即核实，确认是否脱管 |
| OUT_OF_BOUNDS | 越界警告 | out_of_bounds=true | 立即核实并采取措施 |

## 本地测试示例

### 使用curl测试

```bash
# 1. 先上传请假数据（确保请假覆盖能正常工作）
curl -X POST "http://localhost:8000/api/v1/upload/leave?source=MANUAL" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_leave.json"

# 2. 上传签到数据
curl -X POST "http://localhost:8000/api/v1/upload/checkin?source=APP" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_checkin.csv"

# 3. 上传定位摘要
curl -X POST "http://localhost:8000/api/v1/upload/location?source=APP" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/sample_location.json"

# 4. 查询所有失败的记录
curl "http://localhost:8000/api/v1/results?status=failed"

# 5. 查看某条详细结果
curl "http://localhost:8000/api/v1/results/1"

# 6. 生成汇总报告
curl "http://localhost:8000/api/v1/report"
```

### 使用Python测试

```python
import requests

# 上传签到数据
with open('data/sample_checkin.csv', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        'http://localhost:8000/api/v1/upload/checkin',
        params={'source': 'APP'},
        files=files
    )
    print(response.json())

# 查询失败记录
response = requests.get(
    'http://localhost:8000/api/v1/results',
    params={'status': 'failed'}
)
print('失败记录数:', len(response.json()))
```

## 数据库说明

系统使用SQLite数据库，默认保存在 `./data/community_correction.db`

主要数据表:
- `batches`: 上传批次记录（用于去重）
- `checkin_records`: 签到原始记录
- `leave_records`: 请假原始记录
- `location_summaries`: 定位摘要原始记录
- `processing_results`: 规则处理结果

## 排错指南

### 1. 服务启动失败
```bash
# 检查端口是否被占用
lsof -i :8000

# 检查依赖是否完整安装
pip list | grep fastapi
```

### 2. 文件上传失败
- 确保CSV/JSON格式正确
- 检查是否包含必填字段 person_id
- 查看API返回的错误详情

### 3. 数据重复提交
- 系统会自动检测相同内容的重复上传
- 通过batch_hash字段保证幂等性

## 后续扩展建议

1. 支持更多数据格式（Excel、XML等）
2. 增加规则配置界面，支持动态调整阈值
3. 添加数据导出功能
4. 集成消息通知模块（短信、邮件）
5. 增加数据可视化仪表盘
6. 支持批量数据历史回溯分析
