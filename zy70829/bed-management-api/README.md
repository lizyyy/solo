# 床位管理导入API

解决住院处导入混乱问题：出院、转科、清洁和占床状态更新不同步。

## 功能特性

- 支持批量导入床位表CSV、患者流转JSON、保洁工单JSON
- 处理结果按正常项、待确认项、失败项分开返回
- 失败记录保留原始字段和建议处理方式
- 同一批次再次提交不重复生效（幂等性）
- 核心规则覆盖：转科锁床、清洁超时、重复占床

## 核心业务规则

### 1. 转科锁床
- 标记为转科锁定的床位操作时会进入待确认项
- 转科记录必须同时包含转出床位和转入床位

### 2. 清洁超时
- 保洁工单创建超过2小时未完成标记为超时
- 超时记录进入待确认项，需人工确认

### 3. 重复占床
- 已被占用的床位分配给其他患者时判定为失败
- 转科时自动检查转入床位的占用状态

## 快速开始

### 环境要求
- Python 3.9+
- pip

### 安装依赖

```bash
cd bed-management-api
pip install -r requirements.txt
```

### 启动服务

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

### 使用样例数据测试

方式一：使用curl命令测试

```bash
# 首次导入
curl -X POST "http://localhost:8000/api/import" \
  -H "Content-Type: multipart/form-data" \
  -F "batch_id=BATCH20240115001" \
  -F "bed_csv=@samples/beds_ward.csv" \
  -F "patient_flow_json=@samples/patient_flows.json" \
  -F "cleaning_order_json=@samples/cleaning_orders.json"

# 重复提交同一批次（幂等性测试）
curl -X POST "http://localhost:8000/api/import" \
  -H "Content-Type: multipart/form-data" \
  -F "batch_id=BATCH20240115001" \
  -F "bed_csv=@samples/beds_ward.csv"

# 查看已处理批次
curl http://localhost:8000/api/batches
```

方式二：运行测试脚本

```bash
python test_import.py
```

## API接口说明

### POST /api/import
批量导入床位数据

**请求参数:**
- `batch_id`: 批次ID（必填，用于幂等性控制）
- `bed_csv`: 床位表CSV文件（可选）
- `patient_flow_json`: 患者流转JSON文件（可选）
- `cleaning_order_json`: 保洁工单JSON文件（可选）

**响应格式:**
```json
{
  "batch_id": "BATCH20240115001",
  "total_count": 18,
  "success_count": 12,
  "pending_count": 4,
  "failed_count": 2,
  "success_items": [...],
  "pending_items": [
    {
      "record_type": "bed",
      "record_id": "INTERNAL-005",
      "original_data": {...},
      "suggestion": "床位 005 因转科被锁定，暂无法操作"
    }
  ],
  "failed_items": [
    {
      "record_type": "bed",
      "record_id": "INTERNAL-006",
      "original_data": {...},
      "suggestion": "占用状态的床位必须填写患者ID，请核对患者信息"
    }
  ],
  "processed_at": "2024-01-15T20:00:00"
}
```

## 样例数据说明

### samples/beds_ward.csv
包含病区床位数据，其中：
- **INTERNAL-005**: 转科锁定床位（待确认项）
- **INTERNAL-006**: 占用状态但无患者ID（失败项，需人工修正）
- **INTERNAL-007**: 空闲状态但有患者信息（待确认项）

### samples/patient_flows.json
包含患者流转记录，其中：
- **FLOW004**: 转出床位与转入床位相同（失败项）
- **FLOW005**: 出院记录缺少转出床位信息（待确认项）

### samples/cleaning_orders.json
包含保洁工单，其中：
- **CLEAN001**: 创建时间超过2小时（清洁超时，待确认项）
- **CLEAN004**: 已完成但无完成时间（失败项）

## 项目结构

```
bed-management-api/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI主入口
│   ├── models.py        # 数据模型定义
│   ├── rules.py         # 业务规则引擎
│   └── processor.py     # 数据处理器
├── samples/
│   ├── beds_ward.csv
│   ├── patient_flows.json
│   └── cleaning_orders.json
├── requirements.txt
├── test_import.py       # 测试脚本
└── README.md
```
