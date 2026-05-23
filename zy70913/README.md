# 机场地服申诉预审系统

## 项目简介

本系统用于机场地服申诉材料的批量导入和自动预审，解决旅客照片、航班信息和赔付标准的导入混乱问题。系统支持申诉CSV、航班JSON、照片索引的上传，并根据预设规则自动将申诉分为正常项、待确认项和失败项。

## 核心功能

### 1. 数据导入
- 支持申诉 CSV 文件批量导入
- 支持航班信息 JSON 关联
- 支持照片索引 JSON 管理
- **文件去重**：同一文件再次提交不会重复处理（基于MD5哈希校验）

### 2. 预审规则引擎
系统内置5条核心预审规则：

| 规则代码 | 规则名称 | 检查内容 |
|---------|---------|---------|
| RULE_001 | 超时申报检查 | 事件发生后30天内必须申报 |
| RULE_002 | 责任航段检查 | 确认航班是否为我司责任航段 |
| RULE_003 | 赔付上限校验 | A级≤2000元，B级≤500元，C级≤200元 |
| RULE_004 | 照片证据检查 | 至少2张照片证据 |
| RULE_005 | 事件类型匹配 | 根据事件类型自动定级 |

### 3. 结果分类
- **正常项**：所有规则通过，可进入下一流程
- **待确认项**：部分规则未通过但可补充材料
- **失败项**：规则严重不通过，保留原始字段和处理建议

### 4. 历史追溯
- 每条申诉的赔付等级可追溯到具体规则来源
- 记录每条规则的判定结果和依据

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档

打开浏览器访问：http://localhost:8000/docs

## API 接口说明

### 批量上传接口

**POST** `/api/v1/grievances/upload`

支持多文件上传：
- `grievance_csv`: 申诉CSV文件（必填）
- `flight_json`: 航班信息JSON（可选）
- `photo_json`: 照片索引JSON（可选）

**使用测试数据示例**：

```bash
curl -X POST "http://localhost:8000/api/v1/grievances/upload" \
  -F "grievance_csv=@test_data/grievances.csv" \
  -F "flight_json=@test_data/flights.json" \
  -F "photo_json=@test_data/photos.json"
```

**预期返回结果**：
```json
{
  "batch_no": "BATCH20240125123456",
  "total": 5,
  "normal": 1,
  "pending_confirm": 2,
  "failed": 2,
  "normal_items": [...],
  "pending_items": [...],
  "failed_items": [
    {
      "grievance_no": "G002",
      "failure_reason": "申报超时：41天才申报，超过30天期限；该航段非我司责任航段",
      "suggestion": "建议驳回；建议转至对应责任航司处理",
      "original_data": {...}
    }
  ]
}
```

### 其他接口

- **获取批次列表**：`GET /api/v1/grievances/batches`
- **获取批次详情**：`GET /api/v1/grievances/batches/{batch_no}`
- **申诉历史追溯**：`GET /api/v1/grievances/{grievance_no}/history`
- **申诉列表查询**：`GET /api/v1/grievances?status=normal`

## 复现验证步骤

### 步骤1：首次提交测试数据

```bash
# 首次提交，应该正常处理
curl -X POST "http://localhost:8000/api/v1/grievances/upload" \
  -F "grievance_csv=@test_data/grievances.csv" \
  -F "flight_json=@test_data/flights.json" \
  -F "photo_json=@test_data/photos.json"
```

### 步骤2：验证去重机制

```bash
# 再次提交相同文件，应该返回错误："该文件已在批次 BATCHxxx 中处理过，请勿重复提交"
curl -X POST "http://localhost:8000/api/v1/grievances/upload" \
  -F "grievance_csv=@test_data/grievances.csv"
```

### 步骤3：查询申诉历史追溯

```bash
# 替换实际的申诉编号，查看赔付等级来源
curl "http://localhost:8000/api/v1/grievances/G001/history"
```

**历史追溯返回示例**：
```json
{
  "grievance_no": "G001",
  "status": "normal",
  "compensation_level": "B",
  "final_amount": 300,
  "processing_history": [
    {
      "rule_code": "RULE_001",
      "rule_name": "超时申报检查",
      "new_level": null,
      "reason": "申报时效正常：1天",
      "evidence": {"days_diff": 1, "max_days": 30}
    },
    {
      "rule_code": "RULE_005",
      "rule_name": "事件类型匹配",
      "new_level": "B",
      "reason": "事件类型'行李破损'匹配B级赔付标准",
      "evidence": {"incident_type": "行李破损", "matched_level": "B"}
    },
    {
      "rule_code": "RULE_003",
      "rule_name": "赔付上限校验",
      "new_level": "B",
      "new_amount": 300,
      "reason": "金额300元符合B类：一般服务失误"
    }
  ]
}
```

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖列表
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic模式
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints.py   # API端点
│   └── services/
│       ├── __init__.py
│       ├── import_service.py   # 数据导入服务
│       └── rules_engine.py     # 规则引擎
└── test_data/
    ├── grievances.csv     # 测试申诉数据
    ├── flights.json       # 测试航班数据
    └── photos.json        # 测试照片数据
```

## 技术栈

- **Web框架**: FastAPI 0.104.1
- **数据库**: SQLAlchemy 2.0 + SQLite
- **数据验证**: Pydantic 2.5
- **数据处理**: Pandas 2.1
