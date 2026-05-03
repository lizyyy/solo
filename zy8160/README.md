# 影视制片拍摄计划检查与通告单导出服务

一个基于 FastAPI 的影视制片助理工具，用于在每天发通告单前检查拍摄计划，检查演员档期、转场时间、外景天气和夜戏工时冲突，返回调整建议并导出 Markdown 通告单。

## 功能特性

- **数据导入**: 支持导入 scenes.csv、crew.json、locations.yaml、weather.json
- **冲突检测**:
  - 演员档期重叠检查
  - 转场时间不足警告
  - 外景雨天检测（建议改棚拍）
  - 夜戏工时超限提醒
  - 同一演员跨组重叠检测（边界情况）
- **通告单导出**: 导出 Markdown 格式的拍摄通告单

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问 http://localhost:8000/docs 查看 API 文档。

## API 接口

### 1. 导入数据

导入场景、剧组人员、拍摄地点和天气数据。

```bash
curl -X POST "http://localhost:8000/import" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "scenes=@samples/scenes.csv;type=text/csv" \
  -F "crew=@samples/crew.json;type=application/json" \
  -F "locations=@samples/locations.yaml;type=text/yaml" \
  -F "weather=@samples/weather.json;type=application/json"
```

### 2. 添加拍摄计划

将场景安排到具体日期和时间。

```bash
# 添加正常的拍摄计划（晴天，2026-05-04）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-001&date=2026-05-04&start_time=09:00&end_time=10:30&crew_name=陈导演"

curl -X POST "http://localhost:8000/plans/add?scene_number=SC-002&date=2026-05-04&start_time=11:00&end_time=12:00&crew_name=陈导演"

curl -X POST "http://localhost:8000/plans/add?scene_number=SC-003&date=2026-05-04&start_time=20:00&end_time=22:00&crew_name=刘副导"

# 添加有冲突的拍摄计划（雨天，2026-05-05，用于测试边界情况）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-001&date=2026-05-05&start_time=09:00&end_time=10:30&crew_name=陈导演"

# 演员档期重叠（张明同时出现在两个场景）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-002&date=2026-05-05&start_time=10:00&end_time=11:00&crew_name=陈导演"

# 外景遇雨（商业中心停车场是外景，当天有雨）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-004&date=2026-05-05&start_time=14:00&end_time=16:30&crew_name=陈导演"

# 夜戏超时
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-003&date=2026-05-05&start_time=19:00&end_time=22:00&crew_name=刘副导"

curl -X POST "http://localhost:8000/plans/add?scene_number=SC-005&date=2026-05-05&start_time=22:00&end_time=01:00&crew_name=刘副导"

# 同一演员跨组重叠（李华在A组和B组同时有戏）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-006&date=2026-05-05&start_time=09:30&end_time=10:15&crew_name=刘副导"
```

### 3. 验证拍摄计划

检查指定日期的拍摄计划是否存在冲突。

```bash
# 检查正常日（2026-05-04）
curl "http://localhost:8000/plans/2026-05-04/validate"

# 检查有冲突的日期（2026-05-05，测试所有边界情况）
curl "http://localhost:8000/plans/2026-05-05/validate"
```

### 4. 导出通告单

导出指定日期的拍摄通告单。

```bash
# JSON 格式
curl "http://localhost:8000/call-sheet/export?date=2026-05-04"

# Markdown 格式（纯文本）
curl "http://localhost:8000/call-sheet/export/markdown?date=2026-05-04"
```

### 5. 健康检查

```bash
curl "http://localhost:8000/health"
```

## 示例数据说明

### 边界情况测试说明

示例数据设计了以下边界情况用于测试：

#### 1. 外景遇雨改棚拍

- **场景**: SC-001（市中心广场，外景）计划在 2026-05-05 拍摄
- **天气**: 2026-05-05 市中心广场有中雨
- **检测结果**: 系统会标记为 CRITICAL 级别冲突
- **建议**: 建议改到棚内拍摄，列出可用的摄影棚（一号摄影棚、二号摄影棚、室内街景棚）

#### 2. 同一演员跨组重叠

- **演员**: 李华（反派主角）
- **分组**: 同时属于 A 组和 B 组的拍摄计划
- **场景**:
  - SC-001 (A组): 09:00-10:30
  - SC-006 (B组): 09:30-10:15
- **检测结果**: 系统会检测到跨组时间重叠，标记为 CRITICAL 级别
- **建议**: 协调两组的拍摄时间，或考虑使用替身

#### 3. 演员档期重叠

- **演员**: 张明（男主角）
- **场景**:
  - SC-001: 09:00-10:30
  - SC-002: 10:00-11:00
- **检测结果**: 时间重叠 30 分钟，标记为 CRITICAL 级别

#### 4. 夜戏工时超限

- **场景**:
  - SC-003: 19:00-22:00（3小时）
  - SC-005: 22:00-01:00（3小时）
- **总计**: 6 小时夜戏（未超限，配置为 12 小时上限）
- **测试超限**: 可调整时间到 19:00-07:00 来测试超限警告

### 数据文件格式

#### scenes.csv（场景数据）

| 字段 | 类型 | 说明 |
|------|------|------|
| scene_number | string | 场景编号（唯一） |
| description | string | 场景描述 |
| location_name | string | 拍摄地点名称 |
| is_night | boolean | 是否夜戏 |
| is_interior | boolean | 是否内景 |
| cast | string | 演员列表（逗号分隔） |
| duration_minutes | integer | 预计拍摄时长（分钟） |

#### crew.json（剧组人员数据）

```json
{
  "crew": [
    {
      "name": "演员姓名",
      "role": "角色/职位",
      "is_actor": true/false,
      "group_name": "分组名称（用于跨组检测）",
      "availability_start": "2026-05-01",
      "availability_end": "2026-05-31"
    }
  ]
}
```

#### locations.yaml（拍摄地点数据）

```yaml
locations:
  - name: 地点名称
    address: 详细地址
    is_exterior: true/false  # 是否外景
    is_sound_stage: true/false  # 是否摄影棚（用于雨天备选）
    latitude: 39.9042
    longitude: 116.4074
```

#### weather.json（天气数据）

```json
{
  "weather": [
    {
      "location_name": "地点名称",
      "date": "2026-05-05",
      "condition": "天气状况",
      "temperature": 16.0,
      "precipitation_probability": 0.95,
      "is_rainy": true  # 用于检测外景雨天
    }
  ]
}
```

## 配置参数

在 `config.py` 中可调整以下参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MAX_NIGHT_SHIFT_HOURS | 12.0 | 夜戏最大时长（小时） |
| MIN_TRANSFER_MINUTES | 30 | 最小转场时间（分钟） |
| DATABASE_URL | sqlite:///./production.db | 数据库连接字符串 |

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic 数据模型
├── config.py            # 配置参数
├── requirements.txt     # 依赖包列表
├── services/
│   ├── __init__.py
│   ├── import_service.py    # 数据导入服务
│   ├── validation_service.py # 验证服务（冲突检测）
│   └── export_service.py    # 通告单导出服务
├── samples/             # 示例数据
│   ├── scenes.csv
│   ├── crew.json
│   ├── locations.yaml
│   └── weather.json
└── README.md
```

## 完整使用流程演示

```bash
# 1. 启动服务
uvicorn main:app --reload

# 2. 导入所有示例数据
curl -X POST "http://localhost:8000/import" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "scenes=@samples/scenes.csv" \
  -F "crew=@samples/crew.json" \
  -F "locations=@samples/locations.yaml" \
  -F "weather=@samples/weather.json"

# 3. 添加拍摄计划（创建冲突场景）
# 场景1：外景遇雨（市中心广场 2026-05-05 有雨）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-001&date=2026-05-05&start_time=09:00&end_time=10:30&crew_name=陈导演"

# 场景2：演员档期重叠（张明 10:00-10:30 重叠）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-002&date=2026-05-05&start_time=10:00&end_time=11:00&crew_name=陈导演"

# 场景3：外景遇雨（商业中心停车场）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-004&date=2026-05-05&start_time=14:00&end_time=16:30&crew_name=陈导演"

# 场景4：夜戏
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-003&date=2026-05-05&start_time=19:00&end_time=22:00&crew_name=刘副导"
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-005&date=2026-05-05&start_time=22:00&end_time=01:00&crew_name=刘副导"

# 场景5：同一演员跨组重叠（李华在A组和B组同时有戏）
curl -X POST "http://localhost:8000/plans/add?scene_number=SC-006&date=2026-05-05&start_time=09:30&end_time=10:15&crew_name=刘副导"

# 4. 验证拍摄计划（查看所有冲突）
curl "http://localhost:8000/plans/2026-05-05/validate"

# 5. 导出通告单
curl "http://localhost:8000/call-sheet/export/markdown?date=2026-05-05"
```
