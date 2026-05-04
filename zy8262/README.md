# 行道树巡检闭环管理系统

市政绿化队行道树巡检和病虫害处置闭环复核系统，支持离线数据导入和风险检测。

## 功能特性

- **多格式数据导入**：支持 GeoJSON（树木）、CSV（巡检）、JSONL（处置）、YAML（规则）
- **风险检测**：
  - 同一树号重复坐标检测
  - 巡检照片缺失检测
  - 禁用药剂检测
  - 雨后24小时内喷药无效检测
  - 跨午夜巡检归属错误检测
- **闭环管理**：追踪病虫害发现到处置的完整闭环
- **报告导出**：支持 Markdown 和 CSV 格式报告

## 项目结构

```
├── main.py              # FastAPI 主应用
├── database.py          # 数据库连接配置
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 验证模型
├── importer.py          # 数据导入模块
├── risk_detector.py     # 风险检测模块
├── requirements.txt     # Python 依赖
├── trees.db            # SQLite 数据库（运行时创建）
└── sample_data/        # 示例数据目录
    ├── trees.geojson   # 树木数据（含重复坐标）
    ├── inspections.csv # 巡检数据（含照片缺失、跨午夜巡检）
    ├── treatments.jsonl # 处置数据（含禁用药剂、雨后喷药）
    └── rules.yaml      # 规则配置（禁用农药、降雨记录）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## API 接口

### 数据导入接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/import/trees` | POST | 导入树木数据 (GeoJSON) |
| `/import/inspections` | POST | 导入巡检数据 (CSV) |
| `/import/treatments` | POST | 导入处置数据 (JSONL) |
| `/import/rules` | POST | 导入规则配置 (YAML) |

### 数据查询接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/trees` | GET | 获取树木列表 |
| `/trees/{tree_id}` | GET | 获取单棵树木详情（含巡检、处置、风险） |
| `/inspections` | GET | 获取巡检记录列表 |
| `/treatments` | GET | 获取处置记录列表 |

### 风险检测接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/risk-detection/run` | POST | 运行风险检测 |
| `/risks` | GET | 获取风险列表（支持筛选） |
| `/risks/{risk_id}/resolve` | POST | 标记风险为已解决 |
| `/risk-summary` | GET | 获取风险统计摘要 |

### 闭环管理接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/closed-loop` | GET | 获取处置闭环列表 |

### 报告接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/reports/markdown` | GET | 生成 Markdown 格式报告 |
| `/reports/csv` | GET | 生成 CSV 格式报告（下载） |

### 工具接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/clear-data` | DELETE | 清空所有数据（用于测试） |
| `/health` | GET | 健康检查 |

## 风险类型说明

| 风险类型 | 严重程度 | 触发条件 |
|----------|----------|----------|
| `duplicate_coordinate` | high | 不同树号使用相同坐标 |
| `missing_photo` | medium | 巡检记录无照片 |
| `banned_chemical` | critical | 使用禁用药剂 |
| `spray_after_rain` | high | 雨后24小时内喷药 |
| `midnight_inspection` | medium | 凌晨0-6点进行巡检 |

## Curl 使用示例

### 基础示例

#### 1. 健康检查

```bash
curl http://localhost:8000/health
```

#### 2. 导入示例数据

```bash
# 导入树木数据
curl -X POST "http://localhost:8000/import/trees" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/trees.geojson"

# 导入巡检数据
curl -X POST "http://localhost:8000/import/inspections" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/inspections.csv"

# 导入处置数据
curl -X POST "http://localhost:8000/import/treatments" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/treatments.jsonl"

# 导入规则配置
curl -X POST "http://localhost:8000/import/rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/rules.yaml"
```

#### 3. 运行风险检测

```bash
curl -X POST "http://localhost:8000/risk-detection/run"
```

#### 4. 查看风险列表

```bash
# 查看所有未解决风险
curl "http://localhost:8000/risks?is_resolved=false"

# 按风险类型筛选
curl "http://localhost:8000/risks?risk_type=banned_chemical"

# 查看统计摘要
curl "http://localhost:8000/risk-summary"
```

#### 5. 获取树木详情

```bash
curl "http://localhost:8000/trees/TREE-003"
```

#### 6. 查看闭环记录

```bash
# 查看所有闭环
curl "http://localhost:8000/closed-loop"

# 包含未闭环记录
curl "http://localhost:8000/closed-loop?include_unclosed=true"
```

#### 7. 生成报告

```bash
# Markdown 报告
curl "http://localhost:8000/reports/markdown"

# 包含已解决风险的 Markdown 报告
curl "http://localhost:8000/reports/markdown?include_resolved=true"

# CSV 报告（下载）
curl -o risk_report.csv "http://localhost:8000/reports/csv"
```

#### 8. 标记风险已解决

```bash
curl -X POST "http://localhost:8000/risks/1/resolve"
```

### 完整演示脚本

以下脚本会**触发所有5类风险检测**：

```bash
#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 步骤1: 清空测试数据 ==="
curl -X DELETE "$BASE_URL/clear-data"

echo -e "\n=== 步骤2: 导入树木数据（含重复坐标：TREE-001 和 TREE-002 坐标相同）==="
curl -X POST "$BASE_URL/import/trees" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/trees.geojson"

echo -e "\n=== 步骤3: 导入巡检数据（含照片缺失、跨午夜巡检）==="
# INSP-002, INSP-005 无照片
# INSP-003 (02:45), INSP-006 (03:30) 为凌晨巡检
curl -X POST "$BASE_URL/import/inspections" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/inspections.csv"

echo -e "\n=== 步骤4: 导入处置数据（含禁用药剂、雨后喷药）==="
# TREAT-001: 使用甲胺磷（禁用）
# TREAT-002: 雨后喷施（2026-05-02 10:30，降雨在 06:00，间隔4.5小时<24小时）
# TREAT-004: 使用氧化乐果（禁用）
curl -X POST "$BASE_URL/import/treatments" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/treatments.jsonl"

echo -e "\n=== 步骤5: 导入规则配置（禁用药剂、降雨记录）==="
curl -X POST "$BASE_URL/import/rules" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/rules.yaml"

echo -e "\n=== 步骤6: 运行风险检测（将检测到5类风险）==="
curl -X POST "$BASE_URL/risk-detection/run"

echo -e "\n=== 步骤7: 查看风险统计摘要 ==="
curl "$BASE_URL/risk-summary"

echo -e "\n=== 步骤8: 查看所有未解决风险详情 ==="
curl "$BASE_URL/risks?is_resolved=false"

echo -e "\n=== 步骤9: 查看有问题的树木详情（TREE-003 有跨午夜巡检）==="
curl "$BASE_URL/trees/TREE-003"

echo -e "\n=== 步骤10: 生成 Markdown 报告 ==="
curl "$BASE_URL/reports/markdown"

echo -e "\n=== 演示完成 ==="
```

### 示例数据触发的风险说明

| 风险类型 | 触发数据 | 说明 |
|----------|----------|------|
| duplicate_coordinate | TREE-001, TREE-002 | 两树坐标均为 [116.4074, 39.9042] |
| missing_photo | INSP-002, INSP-005 | 巡检记录 photo_paths 为空数组 |
| banned_chemical | TREAT-001 (甲胺磷) | 甲胺磷在禁用列表中 |
| banned_chemical | TREAT-004 (氧化乐果) | 氧化乐果在禁用列表中 |
| spray_after_rain | TREAT-002 | 喷药时间 2026-05-02 10:30，降雨时间 2026-05-02 06:00，间隔4.5小时 |
| midnight_inspection | INSP-003 (02:45) | 凌晨巡检，归属日期存疑 |
| midnight_inspection | INSP-006 (03:30) | 凌晨巡检，归属日期存疑 |

## 数据格式说明

### trees.geojson 格式

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "tree_id": "TREE-001",
        "species": "香樟树",
        "address": "中山路123号",
        "district": "东城区",
        "status": "healthy"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [经度, 纬度]
      }
    }
  ]
}
```

### inspections.csv 格式

```csv
inspection_id,tree_id,inspector,inspection_date,photo_paths,pest_damage,disease_present,health_status,notes
INSP-001,TREE-001,张三,2026-05-03T09:30:00,["/photos/01.jpg"],false,false,normal,正常
```

### treatments.jsonl 格式

每行一个 JSON 对象：
```json
{"treatment_id": "TREAT-001", "tree_id": "TREE-001", "inspector": "张三", "treatment_date": "2026-05-03T14:00:00", "chemical_used": "吡虫啉", "dosage": "200ml", "treatment_type": "spray", "notes": "喷施", "is_effective": true}
```

### rules.yaml 格式

```yaml
rules:
  - type: banned_chemical
    name: 禁用农药
    value: ["甲胺磷", "敌敌畏"]
    active: true
  - type: rain_record
    name: 降雨记录
    value: ["2026-05-02T06:00:00"]
    active: true
```

## 注意事项

1. 数据库文件 `trees.db` 会在首次运行时自动创建
2. 示例数据故意设计了多种违规情况，用于测试风险检测功能
3. 跨午夜巡检检测基于时间判断（0:00-6:00），此类巡检可能应归属于前一天
4. 雨后喷药检测需要导入降雨记录规则才能生效

## 许可证

本项目仅供内部使用。
