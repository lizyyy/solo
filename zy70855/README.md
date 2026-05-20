# 公交失物招领匹配API服务

## 功能特性

1. **失物登记与匹配** - 支持单条和批量提交失物信息，自动进行匹配评分
2. **重复提交识别（幂等性）** - 同一批材料重复提交时自动识别并返回原有结果
3. **审计日志** - 记录所有结论修改操作，包括修改人、修改原因、修改前后的值
4. **数据追溯** - 支持从原始输入到最终报告的完整数据链路追溯

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python -m app.main
```

或

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问 http://localhost:8000/docs 查看API文档

### 运行测试

```bash
python test_api.py
```

## API接口

### 1. 提交失物记录

```
POST /api/lost-items/submit
```

**请求体:**
```json
{
    "item_type": "钱包",
    "description": "黑色皮质钱包，内有身份证和银行卡",
    "lost_location": "1号线天安门西站",
    "lost_time": "2024-01-15T08:30:00",
    "bus_route": "1号线",
    "bus_number": "京A12345",
    "contact_name": "张三",
    "contact_phone": "13800138000",
    "submitted_by": "客服小王"
}
```

**响应:**
- `is_duplicate: false` 表示新创建的记录
- `is_duplicate: true` 表示重复提交，返回原有记录

### 2. 批量提交失物记录

```
POST /api/lost-items/batch-submit
```

### 3. 查询失物记录列表

```
GET /api/lost-items/?skip=0&limit=100
```

### 4. 查询单个失物记录

```
GET /api/lost-items/{item_id}
```

### 5. 修改结论

```
PUT /api/lost-items/{item_id}/conclusion
```

**请求体:**
```json
{
    "status": "completed",
    "match_result": {"status": "matched", "matching_score": 85},
    "final_report": {"found": true, "returned": true},
    "change_reason": "物品已找到并归还失主",
    "changed_by": "客服主管"
}
```

### 6. 查看审计日志

```
GET /api/lost-items/{item_id}/audit-logs
```

### 7. 数据追溯

```
GET /api/lost-items/{item_id}/trace
```

返回完整的处理历史，包括：
- 原始输入数据
- 处理历史（初始匹配 + 所有修改）
- 最终报告
- 审计记录

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库配置
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic模式
│   └── main.py          # 主应用和API路由
├── requirements.txt     # 依赖包
├── test_api.py          # 测试文件
└── README.md
```

## 数据模型

### LostItem (失物记录)
- 物品基本信息（类型、描述、地点、时间等）
- 处理状态和匹配结果
- 最终报告
- 创建/更新时间和创建人

### IdempotentRequest (幂等性控制)
- 请求哈希（SHA256）
- 请求原始数据
- 响应数据
- 提交人
- 创建时间

### AuditLog (审计日志)
- 关联的失物记录ID
- 修改的字段名
- 修改前后的值
- 修改原因
- 修改人
- 修改时间
