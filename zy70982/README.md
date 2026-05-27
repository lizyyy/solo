# 市政运维对账服务

智慧路灯故障派修对账系统 - 告警、巡查、维修单自动比对与人工复核

## 项目概述

本服务解决市政运维中路灯告警、人工巡查、维修反馈不在一张图上的问题，提供完整的对账流程：

**导入 → 自动比对 → 人工复核 → 重新计算 → 报告下载**

### 核心特性

- **数据导入**：支持告警CSV、巡查JSON、维修单CSV导入
- **自动比对**：
  - 同杆多灯识别
  - 误报自动过滤
  - 修复复测标记
  - 时间窗口匹配（48小时）
  - 状态一致性校验
- **人工复核**：支持放行、退回、要求补材料三种操作
- **数据同步**：复核改动后，详情、汇总、报告数字同步更新
- **全链路追踪**：从派修单明细一路追溯到最终报告
- **报告生成**：Excel格式对账报告，包含汇总、明细、差异详情、复核追踪

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # SQLAlchemy数据模型
│   ├── schemas.py           # Pydantic数据结构
│   ├── crud.py              # 数据CRUD操作（含导入功能）
│   ├── reconciliation.py    # 对账核心逻辑
│   ├── report_generator.py  # 报告生成
│   └── main.py              # FastAPI主应用
├── sample_data/             # 示例数据
│   ├── alarms.csv
│   ├── inspections.json
│   └── work_orders.csv
├── tests/
│   └── test_reconciliation.py  # 单元测试
├── requirements.txt         # Python依赖
├── start.sh                 # 启动脚本
├── demo.py                  # 演示脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 启动服务

```bash
chmod +x start.sh
./start.sh
```

或手动启动：
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行演示

```bash
python demo.py
```

### 5. 运行测试

```bash
pytest tests/ -v
```

## API接口说明

### 数据导入

| 接口 | 方法 | 说明 |
|------|------|------|
| `/import/alarms/csv` | POST | 导入告警CSV |
| `/import/inspections/json` | POST | 导入巡查JSON |
| `/import/work-orders/csv` | POST | 导入维修单CSV |

### 对账处理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/reconciliation/start` | POST | 创建对账批次 |
| `/reconciliation/{batch_id}/run` | POST | 执行自动比对 |
| `/reconciliation/{batch_id}/summary` | GET | 获取对账汇总 |
| `/reconciliation/{batch_id}/records` | GET | 获取对账记录列表 |
| `/reconciliation/record/{record_id}` | GET | 获取单条记录详情 |
| `/reconciliation/{batch_id}/recalculate` | POST | 重新计算 |

### 人工复核

| 接口 | 方法 | 说明 |
|------|------|------|
| `/review` | POST | 复核对账记录 |

复核状态：
- `approved` - 放行
- `rejected` - 退回
- `needs_more_info` - 需补材料

### 全链路追踪

| 接口 | 方法 | 说明 |
|------|------|------|
| `/trace/work-order/{order_id}` | GET | 按维修单号追踪 |
| `/trace/alarm/{alarm_id}` | GET | 按告警ID追踪 |

### 报告生成

| 接口 | 方法 | 说明 |
|------|------|------|
| `/report/{batch_id}/summary` | GET | 获取报告汇总 |
| `/report/{batch_id}/details` | GET | 获取报告详情 |
| `/report/{batch_id}/download/excel` | GET | 下载Excel报告 |

## 差异类型说明

| 类型 | 说明 |
|------|------|
| `missing_alarm` | 缺少告警记录 |
| `missing_inspection` | 缺少巡查记录 |
| `missing_work_order` | 缺少维修单 |
| `false_alarm` | 疑似误报 |
| `multi_light_same_pole` | 同杆多灯 |
| `repair_retest` | 修复复测 |
| `status_mismatch` | 状态不匹配 |
| `time_mismatch` | 时间不匹配 |

## 数据格式说明

### 告警CSV字段

| 字段 | 说明 | 必填 |
|------|------|------|
| alarm_id | 告警ID | 是 |
| pole_id | 灯杆ID | 是 |
| light_id | 灯具ID | 是 |
| alarm_type | 告警类型 | 是 |
| alarm_level | 告警级别 | 是 |
| alarm_time | 告警时间 | 是 |
| description | 告警描述 | 是 |
| status | 告警状态 | 是 |
| is_false_alarm | 是否误报 | 否 |
| false_alarm_reason | 误报原因 | 否 |

### 巡查JSON字段

```json
{
  "inspection_id": "INS001",
  "pole_id": "P001",
  "light_id": "L001",
  "inspector": "张三",
  "inspection_time": "2024-01-15 09:00:00",
  "status": "发现问题",
  "issues_found": ["灯具损坏", "需要更换"],
  "photos": ["photo_001.jpg"]
}
```

### 维修单CSV字段

| 字段 | 说明 | 必填 |
|------|------|------|
| order_id | 维修单号 | 是 |
| pole_id | 灯杆ID | 是 |
| light_id | 灯具ID | 是 |
| alarm_id | 关联告警ID | 否 |
| repair_type | 维修类型 | 是 |
| reporter | 报修人 | 是 |
| report_time | 报修时间 | 是 |
| repairer | 维修人 | 否 |
| repair_time | 维修时间 | 否 |
| repair_content | 维修内容 | 否 |
| status | 状态 | 是 |
| is_retest | 是否复测 | 否 |
| retest_result | 复测结果 | 否 |

## Excel报告说明

生成的Excel报告包含4个工作表：

1. **汇总** - 对账统计、差异类型统计
2. **明细** - 所有对账记录完整信息
3. **差异详情** - 每条差异的详细说明
4. **追踪说明** - 所有复核操作记录，可用于向他人解释为什么某条记录被放行/退回

## 典型使用流程

1. **导入数据**
   ```bash
   # 导入告警、巡查、维修单数据
   ```

2. **创建对账批次**
   ```json
   POST /reconciliation/start
   {
     "batch_id": "BATCH_202401",
     "name": "2024年1月对账",
     "description": "1月份对账",
     "created_by": "管理员"
   }
   ```

3. **执行自动比对**
   ```bash
   POST /reconciliation/BATCH_202401/run
   ```

4. **查看差异记录**
   ```bash
   GET /reconciliation/BATCH_202401/records?status=discrepancy
   ```

5. **人工复核**
   ```json
   POST /review
   {
     "record_id": 1,
     "reviewer": "张工",
     "status": "approved",
     "comment": "数据无误",
     "explanation": "三单一致，时间匹配",
     "resolve_discrepancies": [1, 2]
   }
   ```

6. **生成报告**
   ```bash
   GET /report/BATCH_202401/download/excel
   ```

7. **后续追踪**
   ```bash
   # 按维修单号追踪全链路
   GET /trace/work-order/WO001
   ```

## 核心文件参考

- [database.py](file:///Users/lzy/pro/solo/workspaces/zy70982/app/database.py) - 数据库配置
- [models.py](file:///Users/lzy/pro/solo/workspaces/zy70982/app/models.py) - 数据模型定义
- [reconciliation.py](file:///Users/lzy/pro/solo/workspaces/zy70982/app/reconciliation.py) - 对账核心逻辑
- [report_generator.py](file:///Users/lzy/pro/solo/workspaces/zy70982/app/report_generator.py) - 报告生成
- [main.py](file:///Users/lzy/pro/solo/workspaces/zy70982/app/main.py) - API接口定义
