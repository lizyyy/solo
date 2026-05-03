# 脚手架挂牌风险台

造船厂脚手架验收班组专用本地后端 API 服务，用于脚手架状态管理、风险识别和安全监控。

## 功能特性

### 核心功能
1. **脚手架状态流转管理** - 跟踪脚手架从申请、搭设、验收到闭环的完整生命周期
2. **超期未复验识别** - 自动识别超过复验有效期的脚手架并标记风险
3. **作业冲突检测** - 智能检测同一区域内高处作业与动火/吊装/有限空间作业的时间冲突
4. **整改闭环管理** - 跟踪问题整改流程，确保隐患及时闭环

### API 接口
- **数据导入** - 支持 CSV/JSON 格式导入搭设申请、验收记录、整改记录、作业清单
- **状态查询** - 查询今日禁用挂牌、整改闭环情况、脚手架状态历史
- **风险摘要** - 生成每日风险摘要，支持导出班前会风险报告
- **冲突管理** - 检测和解决作业冲突

## 技术栈

- **后端框架**: Flask 2.3.3
- **ORM**: Flask-SQLAlchemy 3.0.5
- **数据库**: SQLite (本地单文件)
- **数据处理**: pandas, python-dateutil

## 项目结构

```
scaffold-risk-platform/
├── app/
│   ├── __init__.py          # 应用初始化
│   ├── models.py            # 数据模型
│   ├── routes/
│   │   ├── import_routes.py  # 数据导入接口
│   │   ├── query_routes.py   # 查询接口
│   │   └── status_routes.py  # 状态管理接口
│   └── services/
│       └── risk_summary.py   # 风险摘要服务
├── sample_data/              # 示例数据文件
│   ├── erection_applications.csv
│   ├── acceptance_records.json
│   ├── rectification_records.csv
│   ├── confined_space.json
│   └── work_permits.json
├── config.py                # 配置文件
├── requirements.txt         # 依赖包
├── run.py                   # 启动入口
└── scaffold_risk.db         # SQLite 数据库 (运行后生成)
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库并加载示例数据

```bash
# 方式一：使用 Flask CLI
flask --app run initdb
flask --app run load_samples

# 方式二：直接运行（会自动初始化数据库）
python run.py
```

### 3. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5001` 启动。

## API 接口文档

### 数据导入接口

#### 导入搭设申请 CSV
```
POST /api/import/erection-csv
Content-Type: multipart/form-data

Body:
  file: CSV 文件
```

#### 导入验收记录 JSON
```
POST /api/import/acceptance-json
Content-Type: multipart/form-data

Body:
  file: JSON 文件
```

#### 导入整改记录
```
POST /api/import/rectification-records
Content-Type: multipart/form-data

Body:
  file: CSV 或 JSON 文件
```

#### 导入有限空间作业清单
```
POST /api/import/confined-space
Content-Type: multipart/form-data

Body:
  file: JSON 或 CSV 文件
```

#### 导入作业许可
```
POST /api/import/work-permits
Content-Type: multipart/form-data

Body:
  file: JSON 或 CSV 文件
```

### 查询接口

#### 查询今日禁用挂牌
```
GET /api/query/today-disabled
```

#### 查询整改闭环情况
```
GET /api/query/rectification-closed
Query Parameters:
  status: all | pending | closed (可选)
```

#### 查询活动冲突
```
GET /api/query/active-conflicts
```

#### 查询超期脚手架
```
GET /api/query/overdue-scaffolds
```

#### 查询每日风险摘要
```
GET /api/query/daily-risk-summary
Query Parameters:
  date: YYYY-MM-DD (可选，默认为今日)
```

#### 导出班前会风险摘要
```
GET /api/query/export-risk-summary
Query Parameters:
  date: YYYY-MM-DD (可选，默认为今日)
```

#### 查询脚手架状态详情
```
GET /api/query/scaffold-status
Query Parameters:
  scaffold_no: 脚手架编号 (必填)
```

### 状态管理接口

#### 检查超期未复验
```
POST /api/status/check-overdue
```

#### 检查作业冲突
```
POST /api/status/check-conflicts
```

#### 更新脚手架状态
```
POST /api/status/update-scaffold-status
Content-Type: application/json

Body:
{
  "scaffold_no": "SF-2026-001",
  "status": "closed",
  "reason": "整改完成，验收合格",
  "operator": "验收员甲"
}
```

#### 解决冲突
```
POST /api/status/resolve-conflict
Content-Type: application/json

Body:
{
  "conflict_id": 1,
  "resolution_notes": "调整作业时间，高处作业改至下午",
  "operator": "安全员"
}
```

#### 解决超期问题
```
POST /api/status/resolve-overdue
Content-Type: application/json

Body:
{
  "scaffold_no": "SF-2026-002",
  "acceptance_no": "AC-2026-0510",
  "next_reinspection_date": "2026-06-09",
  "operator": "验收员甲"
}
```

## 脚手架状态流转

```
已申请 (applied)
    ↓
已验收 (accepted) ←→ 已复验 (inspected)
    ↓                     ↓
超期未复验 (overdue)  ←  发现超期
    ↓
整改中 (rectifying)
    ↓
已闭环 (closed) / 已禁用 (disabled)
```

## 风险闭环示例调用链

以下是一条完整的风险识别到闭环的接口调用链示例：

### 场景：脚手架超期未复验 → 发现问题 → 整改 → 复验 → 闭环

#### 1. 检查超期脚手架
```bash
# 检查超期未复验
curl -X POST http://localhost:5001/api/status/check-overdue
```

#### 2. 查询超期脚手架详情
```bash
# 获取超期脚手架列表
curl http://localhost:5001/api/query/overdue-scaffolds
```

#### 3. 查看具体脚手架状态
```bash
# 查询 SF-2026-002 脚手架详情
curl "http://localhost:5001/api/query/scaffold-status?scaffold_no=SF-2026-002"
```

#### 4. 安排整改并更新状态
```bash
# 将脚手架状态更新为整改中
curl -X POST http://localhost:5001/api/status/update-scaffold-status \
  -H "Content-Type: application/json" \
  -d '{
    "scaffold_no": "SF-2026-002",
    "status": "rectifying",
    "reason": "超期未复验，安排整改复验",
    "operator": "验收员乙"
  }'
```

#### 5. 完成复验，解决超期问题
```bash
# 完成复验，设置下次复验日期
curl -X POST http://localhost:5001/api/status/resolve-overdue \
  -H "Content-Type: application/json" \
  -d '{
    "scaffold_no": "SF-2026-002",
    "next_reinspection_date": "2026-06-02",
    "operator": "验收员乙"
  }'
```

#### 6. 确认脚手架状态
```bash
# 再次查询确认状态
curl "http://localhost:5001/api/query/scaffold-status?scaffold_no=SF-2026-002"
```

#### 7. 生成当日风险摘要
```bash
# 导出班前会风险摘要
curl "http://localhost:5001/api/query/export-risk-summary"
```

## 作业冲突检测规则

系统自动检测以下冲突类型：

1. **高处作业 + 动火作业** - 同一区域时间重叠
2. **高处作业 + 吊装作业** - 同一区域时间重叠
3. **动火作业 + 有限空间作业** - 同一区域时间重叠

## 数据格式说明

### 搭设申请 CSV 字段
- 脚手架编号, 区域, 位置, 高度, 类型, 申请单号, 申请人, 部门, 申请日期, 预计搭设日期, 描述

### 验收记录 JSON 字段
```json
{
  "records": [
    {
      "脚手架编号": "SF-2026-001",
      "验收单号": "AC-2026-001",
      "验收日期": "2026-04-28",
      "下次复验日期": "2026-05-28",
      "验收人": "验收员甲",
      "照片列表": ["photo1.jpg", "photo2.jpg"],
      "发现问题": "",
      "状态": "accepted"
    }
  ]
}
```

### 整改记录 CSV 字段
- 整改单号, 脚手架编号, 问题描述, 问题日期, 责任人, 整改期限, 整改日期, 整改措施, 验证人, 状态

### 作业类型代码
- `high_altitude` - 高处作业
- `hot_work` - 动火作业
- `lifting` - 吊装作业
- `confined_space` - 有限空间作业

## 配置说明

在 `config.py` 中可以调整以下参数：

```python
SCAFFOLD_VALIDITY_DAYS = 30      # 脚手架复验有效期（天）
REINSPECTION_WARNING_DAYS = 7     # 复验提醒天数
```

## 注意事项

1. 本服务为本地部署，数据存储在本地 SQLite 数据库文件 `scaffold_risk.db`
2. 首次运行会自动创建数据库表结构
3. 示例数据可通过 `flask --app run load_samples` 命令加载
4. 建议定期备份数据库文件

## 故障排查

### 数据库连接问题
- 确认数据库文件 `scaffold_risk.db` 有读写权限
- 删除数据库文件后重新启动服务会自动重建

### 导入失败
- 检查 CSV/JSON 格式是否正确
- 确认日期格式支持：`YYYY-MM-DD`, `YYYY-MM-DD HH:MM:SS`, `YYYY/MM/DD`

### 冲突检测不工作
- 确认作业许可的 `status` 为 `active`
- 确认作业有正确的 `start_time` 和 `end_time`
- 确认作业属于同一 `area`

## 许可证

内部使用
