# 药企QA样品管理系统API

样品数据验证系统，支持取样窗口校验、环境箱超温检测、延期审批验证。

## 功能特性

- ✅ **样品CSV上传** - 支持中英文列名
- ✅ **试验方案JSON** - 配置取样窗口、温度要求等规则
- ✅ **环境箱记录** - CSV/JSON格式均支持
- ✅ **三大规则验证**：
  - 取样窗口校验（提前/延后取样检测）
  - 环境箱超温检测
  - 延期审批验证
- ✅ **结果分类** - 正常项 / 待确认项 / 失败项
- ✅ **重复提交防护** - 同一批次+物料+试验类型防重复
- ✅ **失败详情** - 保留原始字段 + 可读边界说明 + 处理建议

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试脚本

```bash
python test_script.py
```

## API接口

### POST /api/validate

上传文件进行验证。

**参数：**
- `samples_file`: 样品CSV文件 (必填)
- `plans_file`: 试验方案JSON文件 (必填)
- `chamber_file`: 环境箱记录CSV/JSON文件 (可选)
- `check_duplicate`: 是否检查重复提交 (默认: true)

**响应示例：**
```json
{
  "normal": [...],
  "pending_confirmation": [...],
  "failed": [...],
  "summary": {
    "total_submitted": 6,
    "normal_count": 3,
    "pending_confirmation_count": 2,
    "failed_count": 1,
    "duplicates_skipped_count": 1
  },
  "duplicates_skipped": ["BATCH-2024-001-MAT-001-稳定性试验"]
}
```

### 其他接口

- `GET /health` - 健康检查
- `GET /api/processed/count` - 已处理批次数量
- `POST /api/dedup/reset` - 重置去重缓存

## 数据格式说明

### 样品CSV格式

| 列名(英文) | 列名(中文) | 说明 |
|-----------|-----------|------|
| sample_id | 样品ID | 唯一标识 |
| batch_id | 批次号 | 批次编号 |
| material_code | 物料编码 | 物料编号 |
| sample_date | 取样日期 | YYYY-MM-DD |
| sample_time | 取样时间 | 可选 |
| test_type | 试验类型 | 如：稳定性试验、加速试验 |
| chamber_id | 环境箱编号 | 可选 |
| extension_approved | 延期审批 | True/False |
| extension_days | 延期天数 | 数字 |

### 试验方案JSON格式

```json
[
  {
    "plan_id": "PLAN-001",
    "test_type": "稳定性试验",
    "material_code": "MAT-001",
    "sampling_window_days": 7,
    "sampling_start_date": "2024-05-10",
    "required_temperature_min": 25.0,
    "required_temperature_max": 25.0,
    "test_duration_days": 180,
    "extension_allowed": true,
    "max_extension_days": 30
  }
]
```

## 项目结构

```
.
├── app/
│   ├── __init__.py     # 包初始化
│   ├── main.py         # API主入口
│   ├── models.py       # 数据模型定义
│   ├── rules.py        # 业务规则引擎
│   └── processor.py    # 数据处理和去重
├── test_data/
│   ├── samples.csv     # 测试样品数据
│   ├── test_plans.json # 测试试验方案
│   └── chamber_records.json # 测试环境箱记录
├── test_script.py      # API测试脚本
├── requirements.txt    # 依赖列表
└── README.md          # 本文件
```

## 使用curl测试

```bash
# 使用curl上传文件进行验证
curl -X POST "http://localhost:8000/api/validate" \
  -F "samples_file=@test_data/samples.csv" \
  -F "plans_file=@test_data/test_plans.json" \
  -F "chamber_file=@test_data/chamber_records.json"
```
