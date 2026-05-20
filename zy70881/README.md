# 冷库园区财务分摊API

解决导入混乱问题，支持不同租户温区、用电倍率和临时加班时段自动分摊。

## 功能特性

- ✅ **多格式导入**：电表CSV、租户合同JSON、温区CSV
- ✅ **结果分类**：正常项、待确认项、失败项分开返回
- ✅ **失败记录**：保留原始字段 + 建议处理方式
- ✅ **幂等性**：同一批次重复提交不生效
- ✅ **核心规则**：倍率切换、空置期检测、异常尖峰识别
- ✅ **历史追溯**：租户分摊可追溯来源

## 核心规则说明

### 1. 倍率切换规则
- 支持合同指定 `multiplier_effective_date` 生效日期
- 生效前使用基础倍率(1.0)，生效后使用合同约定倍率
- 温区倍率与合同倍率叠加相乘

### 2. 空置期检测
- 读数日期在合同生效前 → 空置期
- 读数日期在合同到期后 → 空置期
- 标记为待确认，需人工审核是否计入公摊

### 3. 异常尖峰识别
- 尖峰用电占比 > 60% → 异常
- 尖峰用电量 > 1000kWh → 异常
- 标记为待确认，提示检查临时加班或设备异常

## 项目结构

```
.
├── main.py              # FastAPI主入口
├── models.py            # 数据模型定义
├── parser.py            # 文件解析器
├── engine.py            # 分摊规则引擎
├── idempotency.py       # 批次幂等性管理
├── requirements.txt     # 依赖配置
├── test_api.py          # API测试脚本
├── sample_data/         # 示例数据
│   ├── meter_data.csv   # 电表数据
│   ├── contracts.json   # 租户合同
│   └── zones.csv        # 温区配置
└── batch_data/          # 批次数据存储（自动创建）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问: http://localhost:8000/docs

### 3. 运行测试（新开终端）

```bash
pip install requests
python test_api.py
```

## API接口

### 提交分摊任务

```
POST /api/v1/allocate
```

**表单参数:**
- `batch_id` (可选): 批次号，不填自动生成
- `meter_file`: 电表CSV文件
- `contract_file`: 合同JSON文件
- `zone_file`: 温区CSV文件

**响应示例:**
```json
{
  "batch_id": "BATCH_202401",
  "total_records": 6,
  "success_count": 2,
  "pending_count": 3,
  "failed_count": 1,
  "success_items": [...],
  "pending_items": [...],
  "failed_items": [...],
  "summary": {...}
}
```

### 批次历史追溯

```
GET /api/v1/batch/{batch_id}
```

### 批次列表

```
GET /api/v1/batches
```

### 租户历史追溯

```
GET /api/v1/tenant/{tenant_id}/history
```

**响应中的 `source_trace` 字段包含:**
- meter_id: 电表ID
- reading_date: 读数日期
- contract_id: 关联合同ID
- multiplier_source: 倍率来源
- zone_name: 温区名称
- vacancy_detected: 是否空置期标记
- abnormal_peak: 是否尖峰异常

## 文件格式说明

### 电表CSV (meter_data.csv)
```csv
meter_id,tenant_id,zone_id,reading_date,peak_kwh,valley_kwh,normal_kwh,total_kwh
M001,T001,Z01,2024-01-01,450,200,350,1000
```

### 合同JSON (contracts.json)
```json
{
  "contracts": [{
    "contract_id": "C001",
    "tenant_id": "T001",
    "tenant_name": "鲜冻食品有限公司",
    "zone_id": "Z01",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "power_multiplier": 1.2,
    "multiplier_effective_date": "2024-02-01",
    "is_active": true
  }]
}
```

### 温区CSV (zones.csv)
```csv
zone_id,zone_name,base_temperature,power_multiplier,area_sqm
Z01,低温冷藏区,-18,1.0,500
```

## 本地复跑说明

### 首次运行
```bash
# 1. 安装依赖
pip install fastapi uvicorn pydantic python-multipart pandas numpy python-dateutil

# 2. 启动服务
python main.py

# 3. 测试（新开终端）
python test_api.py
```

### 再次运行
```bash
# 服务已启动的情况下，直接运行测试
python test_api.py

# 或使用新的批次号
# 修改 test_api.py 中的 batch_id 后运行
```

### 查看批次数据
处理过的批次数据保存在 `batch_data/` 目录，以JSON格式存储。

### Swagger 文档
启动服务后访问: http://localhost:8000/docs
