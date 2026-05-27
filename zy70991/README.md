# 短租房水电押金结算 API 服务

## 项目概述

本服务为短租房运营提供水电押金结算的自动化处理能力，支持：
- 批次管理与幂等性检测（重复材料自动识别）
- 原始材料登记与上传（水电抄表、损坏照片、退款冲正）
- 拆分结算流程（阶梯电价、损坏赔偿、退款冲正独立核算）
- 处理轨迹追溯（从原始输入到最终报告的关键字段追踪）
- 结算报告生成与下载

## 技术栈

- Python 3.9+
- FastAPI - Web 框架
- SQLAlchemy - ORM
- SQLite - 数据库

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
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/batches | 创建批次 |
| GET | /api/batches/{batch_no} | 查询批次信息 |
| POST | /api/batches/materials | 上传/登记原始材料 |
| POST | /api/batches/split | 触发拆分流程 |
| POST | /api/batches/{batch_no}/report | 生成结算报告 |
| GET | /api/batches/{batch_no}/report | 查询报告 |
| GET | /api/batches/{batch_no}/report/download | 下载报告 |
| GET | /api/details/reference/{reference_no} | 查询明细 |
| GET | /api/details/{detail_id}/traces | 查询处理轨迹 |
| GET | /api/details/reference/{reference_no}/traces | 通过参考号查轨迹 |

## 完整流程示例

### 方式一：使用 curl 命令

```bash
# 1. 创建批次
curl -X POST http://localhost:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240527-001",
    "operator": "张三",
    "property_id": "APT-BJ-001",
    "tenant_name": "李四",
    "deposit_amount": 5000.00
  }'

# 2. 上传原始材料
curl -X POST http://localhost:8000/api/batches/materials \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240527-001",
    "operator": "张三",
    "electricity": {
      "previous_reading": 1200.0,
      "current_reading": 1680.0,
      "usage_kwh": 480.0
    },
    "water": {
      "previous_reading": 85.0,
      "current_reading": 108.0,
      "usage_ton": 23.0
    },
    "damages": [
      {
        "item_name": "客厅吊灯",
        "damage_description": "灯罩破裂",
        "compensation_amount": 300.00,
        "photo_reference": "IMG_20240527_001.jpg"
      },
      {
        "item_name": "厨房水龙头",
        "damage_description": "漏水损坏",
        "compensation_amount": 150.00,
        "photo_reference": "IMG_20240527_002.jpg"
      }
    ],
    "refunds": [
      {
        "reason": "上期电费多扣",
        "amount": 80.00,
        "original_transaction_no": "TXN-20240401-001"
      }
    ]
  }'

# 3. 触发拆分流程
curl -X POST http://localhost:8000/api/batches/split \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "BATCH-20240527-001"}'

# 4. 生成报告
curl -X POST http://localhost:8000/api/batches/BATCH-20240527-001/report

# 5. 下载报告
curl -o report.txt http://localhost:8000/api/batches/BATCH-20240527-001/report/download

# 6. 查询明细处理轨迹（替换参考号）
curl http://localhost:8000/api/details/reference/ELEC-BATCH-20240527-001-xxxxxxxx-xxxx/traces

# 7. 测试幂等性 - 重复提交相同材料
curl -X POST http://localhost:8000/api/batches/materials \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-20240527-001",
    "operator": "张三",
    "electricity": {
      "previous_reading": 1200.0,
      "current_reading": 1680.0,
      "usage_kwh": 480.0
    },
    "water": {
      "previous_reading": 85.0,
      "current_reading": 108.0,
      "usage_ton": 23.0
    },
    "damages": [
      {
        "item_name": "客厅吊灯",
        "damage_description": "灯罩破裂",
        "compensation_amount": 300.00,
        "photo_reference": "IMG_20240527_001.jpg"
      },
      {
        "item_name": "厨房水龙头",
        "damage_description": "漏水损坏",
        "compensation_amount": 150.00,
        "photo_reference": "IMG_20240527_002.jpg"
      }
    ],
    "refunds": [
      {
        "reason": "上期电费多扣",
        "amount": 80.00,
        "original_transaction_no": "TXN-20240401-001"
      }
    ]
  }'
```

### 方式二：使用测试脚本

```bash
# 运行完整测试流程
./test_flow.sh
```

## 核心业务逻辑说明

### 1. 幂等性检测机制

系统通过 `material_fingerprint`（材料指纹）识别重复提交：
- 指纹生成：对材料内容进行 SHA256 哈希（按键排序确保一致性）
- 检测时机：材料上传时自动比对指纹
- 重复处理：返回原有批次信息，不生成新记录

### 2. 阶梯电价计算标准

```
0-240kWh:   0.538 元/kWh
240-400kWh: 0.588 元/kWh
400kWh+:    0.838 元/kWh
```

### 3. 水费计算标准

```
基础水费: 5.0 元/吨
污水处理费: 1.5 元/吨
合计: 6.5 元/吨
```

### 4. 独立核算机制

四类费用分别生成独立的结算明细：
- **电费 (electricity)**: 独立参考号前缀 ELEC-
- **水费 (water)**: 独立参考号前缀 WATR-
- **损坏赔偿 (damage)**: 独立参考号前缀 DAMG-
- **退款冲正 (refund)**: 独立参考号前缀 REFN-

每类费用独立记录、独立追踪，避免一笔押金多次扣减。

### 5. 关键字段追溯链路

```
原始材料输入
    ↓
material_fingerprint (SHA256)
    ↓
settlement_details (reference_no)
    ↓
processing_traces (每一步操作记录)
    ↓
report (汇总所有明细参考号和材料指纹)
```

## 数据模型

### Batch (批次表)
- id, batch_no (唯一), operator, property_id, tenant_name
- deposit_amount, status, material_fingerprint (唯一)
- created_at, updated_at

### Material (原始材料表)
- id, batch_id, material_type, content, file_name, file_path, created_at

### SettlementDetail (结算明细表)
- id, batch_id, detail_type (枚举), reference_no (唯一)
- original_amount, calculated_amount, description, calc_details
- status, is_adjusted, created_at

### ProcessingTrace (处理轨迹表)
- id, detail_id, action, operator, remark, created_at

### Report (报告表)
- id, batch_id, report_no (唯一)
- total_electricity_fee, total_water_fee
- total_damage_compensation, total_refund
- total_settlement, deposit_refund
- report_content, file_path, created_at
