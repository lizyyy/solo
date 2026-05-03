# 封锁点冲突审签台

地铁运营公司夜间检修调度封锁点冲突审签台 - 后端 API 服务

## 项目简介

本系统专为地铁夜间检修调度设计，用于管理施工计划、检测冲突风险、实现审签流程自动化。主要解决以下问题：

- **轨行区重复占用** - 防止同一区段同时被多个施工计划占用
- **停电窗口不匹配** - 确保施工时间与供电停送电窗口一致
- **作业车相向冲突** - 检测作业车在同一区段相向行驶的风险
- **人员资质过期** - 自动检查作业人员资质是否有效

## 功能特性

### 1. 数据导入
- 施工计划 CSV 导入
- 线路区段拓扑 JSON 导入
- 供电停送电窗口 YAML 导入
- 作业车占用表 CSV 导入
- 人员资质表 CSV 导入

### 2. 冲突检查
- 轨行区重复占用检测
- 停电窗口匹配检测
- 作业车相向冲突检测（基于路径分析）
- 人员资质有效性检测
- 时间窗口重叠提示

### 3. 审签工作流
- 提交审核
- 审签通过（含冲突检查前置校验）
- 驳回
- 撤销
- 审签历史追溯

### 4. 风险查询
- 按风险等级查询冲突
- 按冲突类型查询
- 风险统计概览
- 计划综合搜索
- 审计日志查询

### 5. 审计导出
- 冲突记录 CSV 导出
- 审计日志 CSV 导出
- 每日审计报告（Markdown/CSV）
- 计划详情报告（Markdown/CSV）

## 技术栈

- **Web 框架**: FastAPI 0.109+
- **数据库**: SQLite + SQLAlchemy 2.0+
- **数据验证**: Pydantic 2.5+
- **数据格式**: CSV, JSON, YAML
- **服务器**: Uvicorn

## 快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4269/repo/xy4269
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

### 3. 访问 API 文档

启动后访问以下地址：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## 项目结构

```
xy4269/
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库连接
│   ├── models.py              # 数据模型
│   ├── schemas.py             # Pydantic 模型
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── import_router.py        # 数据导入接口
│   │   ├── check_router.py         # 冲突检查接口
│   │   ├── approval_router.py      # 审签管理接口
│   │   └── query_export_router.py  # 查询导出接口
│   └── services/
│       ├── __init__.py
│       ├── import_service.py      # 数据导入服务
│       ├── conflict_checker.py    # 冲突检查服务
│       ├── approval_service.py    # 审签服务
│       └── query_export_service.py # 查询导出服务
├── examples/                  # 示例数据
│   ├── construction_plans.csv
│   ├── topology.json
│   ├── power_windows.yaml
│   ├── work_trains.csv
│   └── personnel.csv
├── main.py                    # 应用入口
├── requirements.txt           # 依赖配置
├── uploads/                   # 上传文件目录（自动创建）
├── exports/                   # 导出文件目录（自动创建）
└── README.md
```

## 完整 Curl 验证流程

以下是完整的 API 验证流程，使用 `examples/` 目录下的示例数据。

### 1. 健康检查

```bash
curl http://localhost:8000/
```

```bash
curl http://localhost:8000/health
```

```bash
curl http://localhost:8000/api/status
```

### 2. 数据导入

#### 2.1 导入线路区段拓扑（JSON）

```bash
curl -X POST "http://localhost:8000/api/import/topology?operator=调度员A" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/topology.json"
```

#### 2.2 导入供电停送电窗口（YAML）

```bash
curl -X POST "http://localhost:8000/api/import/power?operator=调度员A" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/power_windows.yaml"
```

#### 2.3 导入人员资质表（CSV）

```bash
curl -X POST "http://localhost:8000/api/import/personnel?operator=调度员A" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/personnel.csv"
```

#### 2.4 导入施工计划（CSV）

```bash
curl -X POST "http://localhost:8000/api/import/construction?operator=调度员A" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/construction_plans.csv"
```

#### 2.5 导入作业车占用表（CSV）

```bash
curl -X POST "http://localhost:8000/api/import/train?operator=调度员A" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/work_trains.csv"
```

#### 2.6 查看支持的导入类型

```bash
curl http://localhost:8000/api/import/types
```

### 3. 冲突检查

#### 3.1 检查单个计划

```bash
curl -X POST "http://localhost:8000/api/check/plan/1?operator=调度员A&auto_save=true"
```

#### 3.2 批量检查计划

```bash
curl -X POST "http://localhost:8000/api/check/batch?operator=调度员A" \
  -H "Content-Type: application/json" \
  -d '[1, 2, 3, 4]'
```

#### 3.3 全量检查所有计划

```bash
curl -X POST "http://localhost:8000/api/check/all?operator=调度员A"
```

#### 3.4 获取计划的冲突记录

```bash
curl "http://localhost:8000/api/check/plan/1/conflicts?include_resolved=false"
```

#### 3.5 获取风险统计信息

```bash
curl "http://localhost:8000/api/check/statistics"
```

#### 3.6 按风险等级查询冲突

```bash
curl "http://localhost:8000/api/check/by-risk?risk_level=高风险&is_resolved=false&limit=50"
```

### 4. 审签管理

#### 4.1 查看所有计划状态

```bash
curl "http://localhost:8000/api/approval/list?offset=0&limit=20"
```

#### 4.2 查看待审核计划

```bash
curl "http://localhost:8000/api/approval/list?status=待审核"
```

#### 4.3 提交计划到待审核

**注意**：由于示例数据中存在冲突，提交会失败。这是预期行为，证明冲突检查机制有效。

```bash
curl -X POST "http://localhost:8000/api/approval/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": 1,
    "submitter": "调度员A",
    "comments": "申请审核"
  }'
```

**预期响应（提交失败，因为存在冲突）**：
```json
{
  "detail": "计划存在未解决的高风险冲突，无法提交审核。\n风险汇总: {...}\n请先解决冲突后再提交。"
}
```

#### 4.4 查看计划详情（含冲突）

```bash
curl "http://localhost:8000/api/approval/detail/1?include_conflicts=true&include_approval_history=true"
```

#### 4.5 查看审签历史

```bash
curl "http://localhost:8000/api/approval/history/1"
```

#### 4.6 查看所有状态枚举

```bash
curl "http://localhost:8000/api/approval/statuses"
```

### 5. 风险查询

#### 5.1 搜索计划

```bash
curl "http://localhost:8000/api/query-export/search/plans?keyword=1号线&has_conflicts=true"
```

#### 5.2 查询审计日志

```bash
curl "http://localhost:8000/api/query-export/audit-logs?operation_type=导入&limit=20"
```

### 6. 审计导出

#### 6.1 导出冲突记录为 CSV

```bash
curl -X POST "http://localhost:8000/api/query-export/export/conflicts/csv?risk_level=高风险"
```

#### 6.2 导出审计日志为 CSV

```bash
curl -X POST "http://localhost:8000/api/query-export/export/audit-logs/csv?operation_type=导入"
```

#### 6.3 导出每日审计报告（Markdown）

```bash
curl -X POST "http://localhost:8000/api/query-export/export/daily-report?format=markdown"
```

#### 6.4 导出每日审计报告（CSV）

```bash
curl -X POST "http://localhost:8000/api/query-export/export/daily-report?format=csv"
```

#### 6.5 导出计划详情报告

```bash
curl -X POST "http://localhost:8000/api/query-export/export/plan/1?format=markdown"
```

#### 6.6 查看已导出文件列表

```bash
curl "http://localhost:8000/api/query-export/exported-files"
```

#### 6.7 下载导出的文件

```bash
curl -O "http://localhost:8000/api/query-export/download/daily_report_20260503_120000.md"
```

## 示例数据冲突说明

示例数据中故意设计了以下冲突场景，用于验证系统功能：

### 冲突 1: 轨行区重复占用

- **计划 1**: SG20260503001，区段 S001-S005，时间 23:00-04:00
- **计划 2**: SG20260503002，区段 S003-S008，时间 23:30-03:30
- **冲突**: 区段 S003-S005 重叠，时间窗口重叠

### 冲突 2: 作业车相向冲突

- **作业车 GC001**: S001 -> S005（上行），时间 23:15-03:45
- **作业车 GC002**: S005 -> S001（下行），时间 23:30-03:30
- **冲突**: 同一区段相向行驶，时间重叠

### 冲突 3: 人员资质

- **人员 E006 (孙八)**: 资质过期于 2023-08-14
- **检测结果**: 资质已过期，严重风险

## 冲突类型说明

| 冲突类型 | 说明 | 风险等级 |
|---------|------|---------|
| 轨行区重复占用 | 同一轨行区被多个计划同时占用 | 高风险 |
| 停电窗口不匹配 | 施工时间与停电窗口不一致 | 高风险/严重 |
| 作业车相向冲突 | 作业车在同一区段相向行驶 | 严重 |
| 人员资质过期 | 作业人员资质已过期或即将过期 | 中风险/严重 |
| 时间窗口重叠 | 同一线路存在时间重叠（提示信息） | 低风险 |

## 风险等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| 🔴 严重 | 红色 | 必须立即处理，禁止审签 |
| 🟠 高风险 | 橙色 | 需要调度员确认，默认禁止审签 |
| 🟡 中风险 | 黄色 | 建议关注，不影响审签 |
| 🟢 低风险 | 绿色 | 提示信息，仅供参考 |

## API 接口汇总

### 数据导入 `/api/import`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/construction` | 导入施工计划 CSV |
| POST | `/topology` | 导入线路拓扑 JSON |
| POST | `/power` | 导入停电窗口 YAML |
| POST | `/train` | 导入作业车 CSV |
| POST | `/personnel` | 导入人员资质 CSV |
| GET | `/types` | 查看支持的导入类型 |

### 冲突检查 `/api/check`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/plan/{plan_id}` | 检查单个计划 |
| POST | `/batch` | 批量检查计划 |
| POST | `/all` | 全量检查所有计划 |
| GET | `/plan/{plan_id}/conflicts` | 获取计划冲突记录 |
| POST | `/resolve/{conflict_id}` | 标记冲突为已解决 |
| GET | `/statistics` | 获取风险统计 |
| GET | `/by-risk` | 按风险等级查询冲突 |

### 审签管理 `/api/approval`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/submit` | 提交审核 |
| POST | `/approve` | 审签通过 |
| POST | `/reject` | 驳回 |
| POST | `/cancel` | 撤销 |
| GET | `/history/{plan_id}` | 审签历史 |
| GET | `/list` | 计划列表 |
| GET | `/detail/{plan_id}` | 计划详情 |
| GET | `/statuses` | 状态枚举 |

### 查询导出 `/api/query-export`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/search/plans` | 搜索计划 |
| GET | `/audit-logs` | 查询审计日志 |
| POST | `/export/conflicts/csv` | 导出冲突 CSV |
| POST | `/export/audit-logs/csv` | 导出审计日志 CSV |
| POST | `/export/daily-report` | 导出每日报告 |
| POST | `/export/plan/{plan_id}` | 导出计划详情 |
| GET | `/download/{filename}` | 下载文件 |
| GET | `/exported-files` | 已导出文件列表 |

## 配置说明

配置文件位于 `app/config.py`，可通过环境变量覆盖：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| APP_NAME | 封锁点冲突审签台 | 应用名称 |
| DATABASE_URL | sqlite:///./blockade_check.db | 数据库连接 |
| UPLOAD_DIR | ./uploads | 上传文件目录 |
| EXPORT_DIR | ./exports | 导出文件目录 |
| DEBUG | True | 调试模式 |

## 注意事项

1. **冲突检查前置校验**: 提交审核和审签通过前会自动执行冲突检查，存在严重/高风险冲突时禁止操作
2. **强制审签**: 如需强制通过高风险冲突，可在审签接口设置 `force_approve=true`
3. **数据编码**: 导入文件支持 UTF-8 和 GBK 编码，建议使用 UTF-8
4. **日期格式**: 支持多种日期格式，推荐使用 `YYYY-MM-DD HH:MM:SS`
5. **文件目录**: `uploads/` 和 `exports/` 目录会自动创建

## 许可证

本项目仅供地铁运营公司内部使用。
