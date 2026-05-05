# 龙舟赛志愿裁判管理系统

本地 REST API，用于龙舟赛赛前数据管理和裁判复核工作。

## 功能特性

- **多格式文件导入**: 支持 JSON/CSV 格式的队员名单、称重表、船艇分配和赛程数据
- **智能别名映射**: 可配置的字段别名模板，自动识别"队员号/选手ID/member_id"、"船号/艇号/boat"等变体字段名
- **数据校验**: 自动检查重复队员、超龄/超重、船艇冲突、赛道时段撞车等问题
- **隔离存储**: 无法映射的行按文件、行号、字段隔离，便于人工处理
- **导出功能**: 支持导出 Markdown 复核单和 JSON 审计包
- **SQLite 持久化**: 保存别名模板、队伍、队员、船艇、风险和人工复核备注

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## API 端点

### 健康检查

```bash
curl http://localhost:5000/api/health
```

### 别名模板管理

#### 获取所有模板
```bash
curl http://localhost:5000/api/templates
```

#### 创建新模板
```bash
curl -X POST http://localhost:5000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "社区A专用模板",
    "description": "适用于社区A提交的数据格式",
    "is_default": false
  }'
```

#### 添加字段别名
```bash
curl -X POST http://localhost:5000/api/templates/1/aliases \
  -H "Content-Type: application/json" \
  -d '{
    "standard_field": "member_number",
    "aliases": ["选手ID", "运动员号", "member_id"],
    "description": "队员编号的别名映射"
  }'
```

### 数据导入

#### 快速导入（推荐）

一键导入多文件并自动运行校验：

```bash
# 导入队员名单（JSON格式）
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/team_members.json"

# 导入称重表（CSV格式）
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/weight_table.csv"

# 导入船艇分配和赛程
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/boat_assignment.json" \
  -F "files=@examples/race_schedule.csv"

# 同时导入多个文件
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/team_members.json" \
  -F "files=@examples/weight_table.csv" \
  -F "files=@examples/boat_assignment.json"
```

#### 分步导入

1. 创建导入会话：
```bash
curl -X POST http://localhost:5000/api/import/session \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "2024龙舟赛赛前数据导入",
    "template_id": 1
  }'
```

2. 上传文件到会话：
```bash
curl -X POST http://localhost:5000/api/import/session/1/files \
  -F "files=@examples/team_members.json" \
  -F "files=@examples/weight_table.csv"
```

### 数据查询

#### 队伍信息
```bash
# 获取所有队伍
curl http://localhost:5000/api/teams

# 获取单个队伍详情（含队员列表）
curl http://localhost:5000/api/teams/1
```

#### 队员信息
```bash
# 获取所有队员
curl http://localhost:5000/api/members

# 按队伍筛选
curl "http://localhost:5000/api/members?team_id=1"

# 获取单个队员
curl http://localhost:5000/api/members/1
```

#### 船艇信息
```bash
curl http://localhost:5000/api/boats
curl http://localhost:5000/api/boats/1
```

#### 赛程安排
```bash
curl http://localhost:5000/api/schedules
curl http://localhost:5000/api/schedules/1
```

### 数据校验

#### 运行全量校验
```bash
curl -X POST http://localhost:5000/api/validate
```

#### 校验单个队员
```bash
curl http://localhost:5000/api/validate/member/1
```

#### 校验整支队伍
```bash
curl http://localhost:5000/api/validate/team/1
```

### 风险管理

#### 查询风险
```bash
# 获取所有未解决的风险
curl "http://localhost:5000/api/risks?is_resolved=false"

# 按严重程度筛选
curl "http://localhost:5000/api/risks?severity=error"

# 按风险类型筛选
curl "http://localhost:5000/api/risks?risk_type=duplicate_member"
```

#### 标记风险已解决
```bash
curl -X POST http://localhost:5000/api/risks/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolved_by": "张裁判",
    "resolved_note": "已核实身份证号，确实是同一人，需社区确认报名队伍"
  }'
```

### 无法映射数据处理

#### 查询无法映射的行
```bash
# 获取所有未解决的无法映射数据
curl "http://localhost:5000/api/unmapped?is_resolved=false"

# 按源文件筛选
curl "http://localhost:5000/api/unmapped?source_file=team_members.json"
```

#### 标记已处理
```bash
curl -X POST http://localhost:5000/api/unmapped/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolved_note": "已手动补全该队员信息"
  }'
```

### 复核备注

#### 添加备注
```bash
curl -X POST http://localhost:5000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "related_type": "member",
    "related_id": 1,
    "note": "该队员身份证号需要进一步核实",
    "reviewer": "李裁判"
  }'
```

#### 查询备注
```bash
# 获取所有备注
curl http://localhost:5000/api/notes

# 获取指定关联对象的备注
curl "http://localhost:5000/api/notes?related_type=member&related_id=1"
```

### 导出功能

#### 导出 Markdown 复核单
```bash
curl -O -J http://localhost:5000/api/export/markdown
```

#### 导出 JSON 审计包
```bash
curl -O -J http://localhost:5000/api/export/json
```

### 统计信息

```bash
curl http://localhost:5000/api/stats
```

### 清空数据（谨慎使用）

```bash
curl -X POST http://localhost:5000/api/clear \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

## 完整验证流程示例

```bash
#!/bin/bash

# 1. 检查服务状态
echo "=== 1. 健康检查 ==="
curl http://localhost:5000/api/health
echo ""

# 2. 查看默认别名模板
echo "=== 2. 查看别名模板 ==="
curl http://localhost:5000/api/templates
echo ""

# 3. 导入队员名单
echo "=== 3. 导入队员名单 ==="
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/team_members.json"
echo ""

# 4. 导入称重表
echo "=== 4. 导入称重表 ==="
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/weight_table.csv"
echo ""

# 5. 导入船艇分配
echo "=== 5. 导入船艇分配 ==="
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/boat_assignment.json"
echo ""

# 6. 导入赛程
echo "=== 6. 导入赛程 ==="
curl -X POST http://localhost:5000/api/import/files \
  -F "files=@examples/race_schedule.csv"
echo ""

# 7. 运行全量校验
echo "=== 7. 运行全量校验 ==="
curl -X POST http://localhost:5000/api/validate
echo ""

# 8. 查看队伍列表
echo "=== 8. 队伍列表 ==="
curl http://localhost:5000/api/teams
echo ""

# 9. 查看风险
echo "=== 9. 风险列表 ==="
curl "http://localhost:5000/api/risks?is_resolved=false"
echo ""

# 10. 查看无法映射的数据
echo "=== 10. 无法映射数据 ==="
curl "http://localhost:5000/api/unmapped?is_resolved=false"
echo ""

# 11. 导出复核单
echo "=== 11. 导出复核单 ==="
curl -O -J http://localhost:5000/api/export/markdown
echo "已导出到当前目录"

# 12. 导出审计包
echo "=== 12. 导出审计包 ==="
curl -O -J http://localhost:5000/api/export/json
echo "已导出到当前目录"

echo ""
echo "=== 验证流程完成 ==="
```

## 数据格式说明

### 支持的字段别名

系统默认支持以下字段别名映射：

| 标准字段 | 支持的别名 |
|---------|-----------|
| team_name | 队伍名称、队名、team、队伍 |
| community | 社区、所属社区、单位 |
| member_number | 队员号、选手ID、member_id、选手号、id |
| name | 姓名、队员姓名、选手姓名 |
| gender | 性别、sex |
| age | 年龄、岁数 |
| weight | 体重、kg、重量 |
| id_card | 身份证号、身份证、证件号 |
| role | 角色、职位、岗位 |
| boat_number | 船号、艇号、boat、船艇号 |
| race_name | 赛事名称、比赛名称、赛事 |
| race_date | 比赛日期、日期 |
| start_time | 开始时间、开赛时间 |
| end_time | 结束时间、完赛时间 |
| track_number | 赛道号、赛道、赛道编号 |
| round_type | 轮次、比赛类型、阶段 |

### 示例数据

`examples/` 目录下提供了示例数据文件，可用于测试导入功能。

## 配置项

编辑 `config.py` 可调整以下配置：

- `MAX_AGE`: 最大参赛年龄 (默认 65)
- `MIN_AGE`: 最小参赛年龄 (默认 18)
- `MAX_WEIGHT_PER_PERSON`: 最大体重(kg) (默认 100)
- `MIN_WEIGHT_PER_PERSON`: 最小体重(kg) (默认 40)
- `TEAM_SIZE`: 每队标准人数 (默认 22)

## 数据库结构

系统使用 SQLite 数据库，主要表包括：

- `alias_templates`: 别名模板
- `field_aliases`: 字段别名映射
- `teams`: 队伍信息
- `members`: 队员信息
- `boats`: 船艇信息
- `race_schedules`: 赛程安排
- `risks`: 风险记录
- `review_notes`: 复核备注
- `unmapped_rows`: 无法映射的数据行
- `import_sessions`: 导入会话
- `imported_files`: 已导入文件记录

## 风险类型说明

| 风险类型 | 说明 | 严重程度 |
|---------|------|---------|
| duplicate_member | 身份证号重复 | error |
| duplicate_member_name | 姓名+年龄疑似重复 | warning |
| age_violation | 年龄超出范围 | error |
| weight_violation | 体重超出建议范围 | warning |
| boat_conflict | 同一船艇分配给多队 | error |
| track_time_conflict | 同一赛道同时段多场比赛 | error |
| boat_time_conflict | 同一船艇同时段多场比赛 | error |
| team_size | 队伍人数不符合标准 | warning/error |

## 许可证

MIT License
