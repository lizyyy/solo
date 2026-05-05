# 市政道路开挖审批 REST API 服务

本地 REST API 服务，用于市政道路开挖审批管理，支持数据导入、风险计算、人工复核、路段查询和文档导出功能。

## 功能特性

- **数据导入**：支持导入施工申请 CSV、地下管线 GeoJSON、公交站点 CSV、日历事件 CSV
- **风险计算**：自动检测四类风险
  - 同一路段重复开挖
  - 燃气管线缓冲区冲突
  - 公交站点未通知
  - 工期与禁噪/考试时段冲突
- **人工复核**：支持对风险评估结果进行人工复核改判
- **路段查询**：按路段查询相关施工申请、管线、公交站点等信息
- **文档导出**：导出 Markdown 会签单和 JSON 审计包

## 技术栈

- **后端框架**：Flask 3.0
- **数据库**：SQLite（通过 Flask-SQLAlchemy）
- **数据处理**：pandas, shapely
- **跨域支持**：Flask-CORS

## 快速开始

### 1. 环境准备

确保已安装 Python 3.8+，然后创建虚拟环境：

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
# macOS/Linux
source venv/bin/activate
# Windows
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 开发模式启动
python run.py

# 服务将运行在 http://localhost:8080
```

服务启动时会自动创建 SQLite 数据库文件 `road_excavation.db`。

## API 接口说明

### 数据导入接口

#### 1. 导入施工申请 CSV

```bash
curl -X POST http://localhost:8080/api/import/applications \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/applications.csv"
```

**CSV 格式要求：**
| 字段名 | 说明 | 示例 |
|--------|------|------|
| application_id | 申请编号 | APP-2024-001 |
| project_name | 项目名称 | 中山路管网改造工程 |
| road_name | 道路名称 | 中山路 |
| road_section | 路段范围 | 东段（人民路-解放路） |
| start_date | 开始日期 | 2024-06-10 |
| end_date | 结束日期 | 2024-06-25 |
| construction_type | 施工类型 | 管网改造 |
| applicant | 申请单位 | 市政工程公司 |
| contact_info | 联系方式 | 张经理 13800138001 |
| description | 项目描述 | 中山路东段污水管网升级改造 |

#### 2. 导入地下管线 GeoJSON

```bash
curl -X POST http://localhost:8080/api/import/pipelines \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/pipelines.geojson"
```

**GeoJSON 格式要求：**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "pipeline_id": "管线编号",
        "pipeline_type": "管线类型（gas/water/electricity）",
        "material": "材质",
        "diameter": 管径（mm）,
        "depth": 埋深（m）,
        "buffer_distance": 缓冲区距离（m）,
        "road_name": "道路名称",
        "road_section": "路段范围"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[经度, 纬度], ...]
      }
    }
  ]
}
```

#### 3. 导入公交站点 CSV

```bash
curl -X POST http://localhost:8080/api/import/bus-stops \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/bus_stops.csv"
```

**CSV 格式要求：**
| 字段名 | 说明 | 示例 |
|--------|------|------|
| stop_id | 站点编号 | STOP-001 |
| stop_name | 站点名称 | 中山路人民路口 |
| road_name | 道路名称 | 中山路 |
| latitude | 纬度 | 39.9042 |
| longitude | 经度 | 116.4074 |
| bus_routes | 途经线路 | 1路,5路,10路 |
| contact_person | 联系人 | 李站长 |
| contact_phone | 联系电话 | 13800138001 |
| notification_status | 通知状态 | pending/notified |

#### 4. 导入日历事件 CSV

```bash
curl -X POST http://localhost:8080/api/import/calendar \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/calendar.csv"
```

**CSV 格式要求：**
| 字段名 | 说明 | 示例 |
|--------|------|------|
| event_id | 事件编号 | EVT-001 |
| event_type | 事件类型 | noise_prohibition/exam |
| event_name | 事件名称 | 高考禁噪期 |
| start_date | 开始日期 | 2024-06-07 |
| end_date | 结束日期 | 2024-06-09 |
| start_time | 开始时间 | 22:00:00 |
| end_time | 结束时间 | 06:00:00 |
| affected_roads | 影响道路 | 中山路,人民路,北京路 |
| description | 事件描述 | 高考期间夜间禁止施工噪音 |

### 风险计算接口

#### 1. 计算单个申请的风险

```bash
# 先获取申请列表，找到申请ID
curl -X GET "http://localhost:8080/api/query/applications"

# 假设申请ID为1，计算其风险
curl -X POST http://localhost:8080/api/risk/calculate/1
```

#### 2. 批量计算所有申请的风险

```bash
curl -X POST http://localhost:8080/api/risk/batch
```

#### 3. 获取风险列表

```bash
# 获取所有风险
curl -X GET "http://localhost:8080/api/risk/list"

# 按风险等级筛选
curl -X GET "http://localhost:8080/api/risk/list?risk_level=critical"

# 按申请编号筛选
curl -X GET "http://localhost:8080/api/risk/list?application_id=APP-2024-001"
```

### 人工复核接口

#### 1. 复核单个风险

```bash
# 先获取风险ID
curl -X GET "http://localhost:8080/api/risk/list"

# 假设风险ID为1，进行复核
curl -X POST http://localhost:8080/api/review/risk/1 \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "comment": "经核实，施工单位已提交管线保护方案，同意施工",
    "reviewer": "张工"
  }'
```

**复核决定选项：**
- `approve` - 同意（需采取措施）
- `reject` - 驳回
- `modify` - 需修改
- `dismiss` - 驳回风险（风险不成立）

#### 2. 复核整个申请的所有风险

```bash
# 假设申请ID为1
curl -X POST http://localhost:8080/api/review/application/1 \
  -H "Content-Type: application/json" \
  -d '{
    "overall_decision": "modify",
    "comments": "该申请存在多处风险，需要修改施工方案",
    "reviewer": "李主任"
  }'
```

#### 3. 获取复核记录列表

```bash
# 获取所有复核记录
curl -X GET "http://localhost:8080/api/review/list"

# 按复核人筛选
curl -X GET "http://localhost:8080/api/review/list?reviewer=张工"

# 按决定筛选
curl -X GET "http://localhost:8080/api/review/list?decision=approve"
```

### 查询接口

#### 1. 按路段查询

```bash
# 查询某条道路的所有相关信息
curl -X GET "http://localhost:8080/api/query/road?road_name=中山路"

# 查询具体路段
curl -X GET "http://localhost:8080/api/query/road?road_name=中山路&road_section=东段"
```

返回内容包括：
- 该路段的施工申请列表
- 相关管线信息
- 公交站点信息
- 影响该路段的日历事件
- 风险汇总统计

#### 2. 获取申请列表

```bash
# 获取所有申请
curl -X GET "http://localhost:8080/api/query/applications"

# 按道路名称筛选
curl -X GET "http://localhost:8080/api/query/applications?road_name=中山路"

# 按日期范围筛选
curl -X GET "http://localhost:8080/api/query/applications?date_from=2024-06-01&date_to=2024-06-30"
```

#### 3. 获取申请详情

```bash
# 假设申请ID为1
curl -X GET "http://localhost:8080/api/query/application/1"
```

返回内容包括：
- 申请基本信息
- 相关风险评估
- 复核记录

### 导出接口

#### 1. 导出 Markdown 会签单

```bash
# 假设申请ID为1，导出会签单并保存
curl -X GET "http://localhost:8080/api/export/meeting-note/1" \
  -o "会签单_APP-2024-001.md"
```

会签单包含：
- 项目基本信息表格
- 风险评估详情（按类型分组）
- 复核记录
- 会签栏（路政、管线、公交、审批负责人）

#### 2. 导出 JSON 审计包

```bash
# 假设申请ID为1，导出审计包
curl -X GET "http://localhost:8080/api/export/audit-package/1" \
  -o "审计包_APP-2024-001.json"
```

审计包包含：
- 申请完整信息
- 所有风险评估详情
- 所有复核记录
- 风险汇总统计

#### 3. 批量导出审计包

```bash
# 导出所有申请的批量审计包
curl -X GET "http://localhost:8080/api/export/batch/audit-package" \
  -o "批量审计包_$(date +%Y%m%d).json"
```

## 完整验证流程

### 步骤 1：启动服务

```bash
# 激活虚拟环境
source venv/bin/activate

# 启动服务
python run.py
```

### 步骤 2：导入基础数据

```bash
# 导入施工申请
curl -X POST http://localhost:8080/api/import/applications \
  -F "file=@sample_data/applications.csv"

# 导入地下管线
curl -X POST http://localhost:8080/api/import/pipelines \
  -F "file=@sample_data/pipelines.geojson"

# 导入公交站点
curl -X POST http://localhost:8080/api/import/bus-stops \
  -F "file=@sample_data/bus_stops.csv"

# 导入日历事件
curl -X POST http://localhost:8080/api/import/calendar \
  -F "file=@sample_data/calendar.csv"
```

### 步骤 3：查看申请列表

```bash
curl -X GET "http://localhost:8080/api/query/applications"
```

记录返回的申请 ID（通常是 1, 2, 3, 4）。

### 步骤 4：计算风险

```bash
# 计算所有申请的风险
curl -X POST http://localhost:8080/api/risk/batch

# 查看风险列表
curl -X GET "http://localhost:8080/api/risk/list"
```

预期结果：
- APP-2024-001 和 APP-2024-002 会有**重复开挖风险**（同一路段时间重叠）
- 中山路的申请会有**燃气管线缓冲区风险**
- 中山路的申请会有**公交站点未通知风险**
- 6月15-20日的申请会有**工期冲突风险**（与中考时间重叠）

### 步骤 5：按路段查询

```bash
# 查询中山路的所有信息
curl -X GET "http://localhost:8080/api/query/road?road_name=中山路"
```

### 步骤 6：人工复核

```bash
# 先获取风险列表
curl -X GET "http://localhost:8080/api/risk/list"

# 假设风险ID为1（重复开挖风险），进行复核
curl -X POST http://localhost:8080/api/review/risk/1 \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "modify",
    "comment": "两个项目施工时间重叠，需要协调错开",
    "reviewer": "路政科-张工"
  }'

# 查看复核记录
curl -X GET "http://localhost:8080/api/review/list"
```

### 步骤 7：导出文档

```bash
# 导出会签单（假设申请ID为1）
curl -X GET "http://localhost:8080/api/export/meeting-note/1" \
  -o "会签单_APP-2024-001.md"

# 导出审计包
curl -X GET "http://localhost:8080/api/export/audit-package/1" \
  -o "审计包_APP-2024-001.json"

# 查看生成的文件
ls -la *.md *.json
```

## 风险类型说明

| 风险类型 | 风险编码 | 说明 | 默认风险等级 |
|----------|----------|------|--------------|
| 重复开挖 | duplicate_excavation | 同一路段存在时间重叠的施工申请 | high |
| 管线缓冲区 | pipeline_buffer_violation | 施工路段存在燃气管线，需注意缓冲区 | critical |
| 公交站点 | bus_stop_notification | 施工路段有公交站点尚未通知 | medium |
| 工期冲突 | schedule_conflict | 施工工期与禁噪/考试事件重叠 | high/exam时为high |

## 风险等级说明

| 等级 | 说明 | 处理建议 |
|------|------|----------|
| critical | 极高风险 | 必须立即处理，否则可能导致严重安全事故 |
| high | 高风险 | 需要重点关注，必须采取相应措施 |
| medium | 中风险 | 需要关注，建议采取预防措施 |
| low | 低风险 | 一般关注，可按常规流程处理 |

## 数据库模型

服务使用 SQLite 数据库，包含以下表：

- `construction_applications` - 施工申请表
- `underground_pipelines` - 地下管线表
- `bus_stops` - 公交站点表
- `calendar_events` - 日历事件表
- `risk_assessments` - 风险评估表
- `review_records` - 复核记录表

## 注意事项

1. **数据格式**：导入 CSV 时，请确保日期格式为 `YYYY-MM-DD`，时间格式为 `HH:MM:SS`

2. **地理数据**：管线 GeoJSON 使用 WGS84 坐标系（经度、纬度）

3. **风险计算**：风险计算是基于规则的简单实现，实际生产环境可能需要更复杂的地理空间分析

4. **数据安全**：本服务为本地开发版本，不包含身份验证，生产环境请添加适当的安全措施

## 扩展建议

1. 添加用户认证和权限管理
2. 实现更复杂的地理空间分析（使用 shapely 进行精确的缓冲区计算）
3. 添加施工区域 GeoJSON 导入和可视化
4. 实现邮件通知功能
5. 添加数据校验和清洗逻辑
6. 实现定时任务自动提醒

## 常见问题

**Q: 导入数据时提示"already exists"怎么办？**

A: 这是因为数据已存在。每个导入接口都会检查主键是否重复，避免重复导入。如果需要重新导入，请先删除数据库文件 `road_excavation.db` 后重启服务。

**Q: 为什么有些申请没有检测到风险？**

A: 风险检测是基于现有数据的比较。如果申请的路段没有其他重叠申请、没有管线、没有公交站点、没有日历事件冲突，就不会检测到风险。

**Q: 如何修改风险评估结果？**

A: 通过人工复核接口可以修改风险状态。复核时可以选择不同的决定（approve/reject/modify/dismiss），并添加复核意见。

**Q: 导出的 Markdown 文件如何查看？**

A: 可以使用任何 Markdown 编辑器打开，如 VS Code、Typora、Obsidian 等，也可以转换为 PDF 或 Word 文档。
