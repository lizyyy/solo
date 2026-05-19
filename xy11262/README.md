# 隐患闭环管理系统

一个完整的隐患排查、整改、复查全流程闭环管理系统，解决巡检照片、整改责任人和复查结果分散管理的问题。

## 功能特性

### 核心功能
- ✅ **数据导入**: 支持隐患CSV、照片索引JSON、复查记录批量导入
- ✅ **数据校验**: 坏记录不丢失，保留原始位置、失败原因和修改建议
- ✅ **状态管理**: 完整的隐患生命周期（待分配→已分配→整改中→待复查→已闭环）
- ✅ **敏感字段处理**: 手机号等敏感信息在后端自动脱敏
- ✅ **报告导出**: CSV导出、月度统计报告、坏记录导出
- ✅ **完整API**: RESTful API接口，支持前端对接

### 坏记录处理
- 自动识别数据错误（必填项缺失、格式错误、枚举值无效等）
- 保存原始数据和行号
- 记录错误类型和详细错误信息
- 提供智能修改建议
- 支持导出坏记录进行人工修正

## 技术栈

- **后端框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展支持MySQL/PostgreSQL）
- **数据校验**: Pydantic
- **其他**: Pandas, OpenPyXL

## 快速开始

### 1. 环境准备

```bash
# 确保已安装 Python 3.8+
python3 --version
```

### 2. 启动服务

#### 方式一：使用启动脚本（推荐）

```bash
./start.sh
```

#### 方式二：手动启动

```bash
# 安装依赖
pip install -r requirements.txt

# 创建目录
mkdir -p data/imports data/exports data/reports logs

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问系统

服务启动后，访问以下地址：

- **API 服务**: http://localhost:8000
- **交互式文档**: http://localhost:8000/docs
- **Redoc 文档**: http://localhost:8000/redoc

## 完整操作流程

### 第一步：导入隐患数据

#### 1.1 导入正常数据

```bash
curl -X POST "http://localhost:8000/api/v1/import/hazards?filename=sample_hazards_normal.csv"
```

返回示例：
```json
{
  "success": true,
  "message": "导入完成",
  "data": {
    "import_id": 1,
    "status": "completed",
    "total": 5,
    "success": 5,
    "failed": 0
  }
}
```

#### 1.2 导入包含错误的数据（测试坏记录）

```bash
curl -X POST "http://localhost:8000/api/v1/import/hazards?filename=sample_hazards_with_errors.csv"
```

返回示例（部分成功）：
```json
{
  "success": true,
  "message": "导入完成",
  "data": {
    "import_id": 2,
    "status": "partial",
    "total": 5,
    "success": 1,
    "failed": 4
  }
}
```

### 第二步：查看导入记录和坏记录

#### 2.1 查看导入历史

```bash
curl "http://localhost:8000/api/v1/import/history"
```

#### 2.2 查看坏记录详情

```bash
curl "http://localhost:8000/api/v1/import/2/bad-records"
```

返回示例：
```json
{
  "success": true,
  "message": "获取坏记录成功",
  "data": {
    "count": 4,
    "records": [
      {
        "id": 1,
        "row_number": 2,
        "original_data": {...},
        "error_type": "required_field_missing",
        "error_message": "hazard_code: 隐患编号不能为空",
        "suggested_fix": "hazard_code: 建议值 'SAFE20240115002'",
        "corrected": 0
      }
    ]
  }
}
```

#### 2.3 导出坏记录进行人工修正

```bash
curl -X POST "http://localhost:8000/api/v1/export/bad-records/2/csv"
```

导出文件位置: `data/exports/bad_records_import_2_*.csv`

### 第三步：导入照片索引

```bash
curl -X POST "http://localhost:8000/api/v1/import/photos?filename=sample_photos.json"
```

### 第四步：隐患整改流程

#### 4.1 分配隐患给责任人

```bash
curl -X POST "http://localhost:8000/api/v1/hazards/1/assign?responsible_person=李工&responsible_phone=13800138009&deadline=2024-02-01T17:00:00"
```

#### 4.2 开始整改

```bash
curl -X POST "http://localhost:8000/api/v1/hazards/1/start-rectification"
```

#### 4.3 完成整改

```bash
curl -X POST "http://localhost:8000/api/v1/hazards/1/complete-rectification" \
  -H "Content-Type: application/json" \
  -d '{
    "rectifier": "张施工队",
    "action_taken": "已清理消防通道全部杂物",
    "measures": "设置警示牌，定期巡检",
    "cost": 500,
    "remarks": "整改用时2天"
  }'
```

#### 4.4 复查（通过/不通过/需整改）

```bash
curl -X POST "http://localhost:8000/api/v1/hazards/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "王安全",
    "result": "pass",
    "comments": "整改达标，通道已完全畅通",
    "suggestions": "建议每周检查一次"
  }'
```

`result` 可选值:
- `pass` - 复查通过（隐患闭环）
- `fail` - 复查不通过
- `need_rectify` - 需要继续整改

### 第五步：导入复查记录

```bash
curl -X POST "http://localhost:8000/api/v1/import/reviews?filename=sample_reviews.csv"
```

### 第六步：导出数据和生成报告

#### 6.1 导出所有隐患CSV

```bash
curl -X POST "http://localhost:8000/api/v1/export/hazards/csv"
```

#### 6.2 按条件导出

```bash
# 仅导出高风险隐患
curl -X POST "http://localhost:8000/api/v1/export/hazards/csv?level=high"

# 仅导出已闭环隐患
curl -X POST "http://localhost:8000/api/v1/export/hazards/csv?status=closed"
```

导出文件位置: `data/exports/hazards_export_*.csv`

#### 6.3 生成月度统计报告

```bash
curl "http://localhost:8000/api/v1/reports/monthly/2024/1"
```

返回示例：
```json
{
  "report_period": "2024年1月",
  "summary": {
    "total_hazards": 10,
    "closed_hazards": 6,
    "closure_rate": 60.0,
    "avg_closure_days": 3.2,
    "total_rectification_cost": 2500
  },
  "by_level": {
    "low": 2,
    "medium": 5,
    "high": 3,
    "critical": 0
  },
  "by_status": {
    "pending": 1,
    "assigned": 1,
    "rectifying": 1,
    "reviewing": 1,
    "closed": 6
  }
}
```

#### 6.4 查看超期未整改隐患

```bash
curl "http://localhost:8000/api/v1/reports/overdue"
```

### 第七步：查看统计和数据

#### 7.1 获取统计摘要

```bash
curl "http://localhost:8000/api/v1/stats/summary"
```

#### 7.2 查看隐患列表

```bash
# 分页查看
curl "http://localhost:8000/api/v1/hazards?page=1&page_size=20"

# 按状态过滤
curl "http://localhost:8000/api/v1/hazards?status=closed"

# 按等级过滤
curl "http://localhost:8000/api/v1/hazards?level=high"
```

#### 7.3 查看单个隐患详情和流程历史

```bash
# 隐患基本信息
curl "http://localhost:8000/api/v1/hazards/1"

# 隐患完整流程摘要（整改历史、复查历史）
curl "http://localhost:8000/api/v1/hazards/1/workflow"
```

## 一键运行完整测试

启动服务后，运行测试脚本：

```bash
./test_api.sh
```

该脚本会自动执行完整的流程：
1. 导入正常和异常数据
2. 查看导入历史和坏记录
3. 分配、整改、复查完整流程
4. 导入照片和复查记录
5. 生成统计和导出报告

## 数据文件说明

### 导入文件位置

所有导入文件应放置在: `data/imports/`

### 样例文件说明

| 文件名 | 说明 |
|--------|------|
| `sample_hazards_normal.csv` | 5条正常隐患数据 |
| `sample_hazards_with_errors.csv` | 包含4条坏记录的测试数据 |
| `sample_photos.json` | 照片索引JSON（包含1条无效隐患记录） |
| `sample_reviews.csv` | 复查记录CSV |

### 坏记录常见类型

系统会自动识别以下类型的错误：
- `required_field_missing` - 必填字段缺失（编号、标题等）
- `format_error` - 格式错误（手机号等）
- `date_format_error` - 日期格式错误
- `invalid_enum_value` - 枚举值无效（等级、状态等）
- `duplicate_key` - 隐患编号重复
- `foreign_key_not_found` - 关联的隐患不存在

### 导出文件位置

- CSV导出: `data/exports/hazards_export_*.csv`
- 坏记录导出: `data/exports/bad_records_import_*.csv`
- 报告文件: `data/reports/`

## 敏感字段脱敏

系统在后端自动对敏感字段进行脱敏处理：
- 手机号：中间4位替换为星号（如：138****8000）
- 其他敏感字段可在配置中添加

**脱敏发生在以下环节：**
- API返回数据
- CSV导出文件
- JSON导出文件
- 日志记录

## 隐患状态流转图

```
待分配 (pending)
    ↓
已分配 (assigned)
    ↓
整改中 (rectifying)
    ↓
待复查 (reviewing)
  ↙  ↓  ↘
需整改 不通过 ✓已闭环
(rectifying) (rejected) (closed)
```

## API 接口清单

### 隐患管理
- `GET /api/v1/hazards` - 获取隐患列表
- `GET /api/v1/hazards/{id}` - 获取单个隐患
- `POST /api/v1/hazards` - 创建隐患
- `PUT /api/v1/hazards/{id}` - 更新隐患
- `DELETE /api/v1/hazards/{id}` - 删除隐患

### 工作流程
- `POST /api/v1/hazards/{id}/assign` - 分配责任人
- `POST /api/v1/hazards/{id}/start-rectification` - 开始整改
- `POST /api/v1/hazards/{id}/complete-rectification` - 完成整改
- `POST /api/v1/hazards/{id}/review` - 提交复查
- `GET /api/v1/hazards/{id}/workflow` - 获取流程摘要

### 数据导入
- `POST /api/v1/import/hazards` - 导入隐患CSV
- `POST /api/v1/import/photos` - 导入照片JSON
- `POST /api/v1/import/reviews` - 导入复查记录
- `GET /api/v1/import/history` - 导入历史
- `GET /api/v1/import/{id}/bad-records` - 坏记录详情

### 导出报告
- `POST /api/v1/export/hazards/csv` - 导出隐患CSV
- `POST /api/v1/export/bad-records/{id}/csv` - 导出坏记录
- `GET /api/v1/reports/monthly/{year}/{month}` - 月度报告
- `GET /api/v1/reports/overdue` - 超期隐患
- `GET /api/v1/export/files` - 导出文件列表

### 统计查询
- `GET /api/v1/stats/summary` - 统计摘要
- `GET /api/v1/health` - 健康检查

## 项目结构

```
hazard-management/
├── app/
│   ├── main.py                 # FastAPI主入口
│   ├── core/                   # 核心配置
│   │   ├── config.py           # 系统配置
│   │   └── database.py         # 数据库连接
│   ├── models/                 # 数据模型
│   │   ├── hazard.py           # 隐患模型
│   │   ├── photo.py            # 照片模型
│   │   ├── rectification.py    # 整改模型
│   │   ├── review.py           # 复查模型
│   │   ├── import_record.py    # 导入记录/坏记录
│   │   └── user.py             # 用户模型
│   ├── schemas/                # Pydantic校验模型
│   │   ├── common.py           # 通用模型
│   │   ├── hazard.py           # 隐患校验
│   │   ├── rectification.py    # 整改校验
│   │   └── review.py           # 复查校验
│   ├── services/               # 业务逻辑
│   │   ├── validation_service.py # 数据校验服务
│   │   ├── import_service.py   # 导入服务
│   │   ├── workflow_service.py # 工作流服务
│   │   └── export_service.py   # 导出报告服务
│   └── api/
│       └── endpoints.py        # API路由
├── data/
│   ├── imports/                # 导入文件目录
│   ├── exports/                # 导出文件目录
│   └── reports/                # 报告目录
├── logs/                       # 日志目录
├── requirements.txt            # 依赖包
├── start.sh                    # 启动脚本
├── test_api.sh                 # API测试脚本
└── README.md                   # 本文档
```

## 数据库表结构

### 主要表
- `hazards` - 隐患主表
- `photos` - 照片记录表
- `rectifications` - 整改记录表
- `reviews` - 复查记录表
- `import_records` - 导入记录表
- `bad_records` - 坏记录表（核心！）

## 常见问题

### Q: 导入失败怎么办？
A: 查看导入历史和坏记录详情，根据修改建议修正数据后重新导入。坏记录永远不会丢失。

### Q: 手机号等敏感信息安全吗？
A: 系统在后端自动脱敏。API返回、导出文件、日志中均不会出现完整手机号。脱敏逻辑在 `app/schemas/common.py` 中实现。

### Q: 支持哪些数据库？
A: 默认使用SQLite。如需切换到MySQL或PostgreSQL，修改 `app/core/config.py` 中的 `DATABASE_URL` 配置即可。

### Q: 如何自定义导入字段？
A: 修改 `app/models/hazard.py` 中的数据模型和 `app/services/import_service.py` 中的导入逻辑。

## 注意事项

1. 导入前请确保CSV文件使用UTF-8编码（带BOM也可）
2. 日期格式支持：`YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DD`, `YYYY/MM/DD`
3. 隐患等级：`low/中`, `medium/中`, `high/高`, `critical/严重`
4. 复查结果：`pass`（通过）, `fail`（不通过）, `need_rectify`（需整改）

## 下一步扩展建议

- 增加用户认证和权限管理（RBAC）
- 支持Excel文件导入导出
- 增加邮件/短信通知功能
- 开发前端管理界面
- 增加数据可视化看板
- 支持定时任务和自动提醒
- 增加附件上传功能
- 支持数据备份和恢复
