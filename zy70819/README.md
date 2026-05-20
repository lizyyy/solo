# 牙科耗材效期预警API服务

为口腔连锁采购提供耗材效期管理、分类预警、修改追溯功能。

## 功能特性

- ✅ **智能分类**: 自动根据有效期将耗材分为正常、待补充、已拦截三类
- ✅ **重复识别**: 同一批材料重复提交时自动识别并返回原有结果
- ✅ **修改追溯**: 完整记录谁改过结论、为什么改、改动前是什么
- ✅ **报告导出**: 支持Excel格式的批次报告和全量报告下载
- ✅ **关键字段追踪**: 从原始输入到最终报告的完整链路追踪

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 完整API调用流程

### 步骤1: 创建批次（提交耗材）

```bash
curl -X POST "http://localhost:8000/api/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "PURCHASE-2025-001",
    "submitted_by": "张采购",
    "items": [
      {
        "material_code": "MAT-001",
        "material_name": "牙科树脂材料",
        "specification": "A3色 4g/支",
        "manufacturer": "德国某牙科材料公司",
        "batch_no": "BATCH-20250101",
        "production_date": "2025-01-15T00:00:00",
        "expiry_date": "2025-12-15T00:00:00",
        "quantity": 100,
        "unit": "支",
        "storage_condition": "阴凉干燥处",
        "supplier": "XX医疗器械有限公司"
      },
      {
        "material_code": "MAT-002",
        "material_name": "一次性口腔器械盒",
        "specification": "标准型",
        "manufacturer": "江苏某医疗器械公司",
        "batch_no": "BATCH-20250201",
        "production_date": "2025-02-20T00:00:00",
        "expiry_date": "2025-05-20T00:00:00",
        "quantity": 500,
        "unit": "盒",
        "storage_condition": "常温保存",
        "supplier": "YY医疗器械有限公司"
      },
      {
        "material_code": "MAT-003",
        "material_name": "正畸托槽",
        "specification": "MBT 0.022",
        "manufacturer": "美国某正畸公司",
        "batch_no": "BATCH-20241201",
        "production_date": "2024-12-01T00:00:00",
        "expiry_date": "2025-04-20T00:00:00",
        "quantity": 200,
        "unit": "套",
        "storage_condition": "密封保存",
        "supplier": "ZZ医疗器械有限公司"
      }
    ]
  }'
```

### 步骤2: 测试重复提交（同一批材料再次提交）

```bash
curl -X POST "http://localhost:8000/api/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "PURCHASE-2025-001",
    "submitted_by": "张采购",
    "items": [
      {
        "material_code": "MAT-001",
        "material_name": "牙科树脂材料",
        "specification": "A3色 4g/支",
        "manufacturer": "德国某牙科材料公司",
        "batch_no": "BATCH-20250101",
        "production_date": "2025-01-15T00:00:00",
        "expiry_date": "2025-12-15T00:00:00",
        "quantity": 100,
        "unit": "支",
        "storage_condition": "阴凉干燥处",
        "supplier": "XX医疗器械有限公司"
      },
      {
        "material_code": "MAT-002",
        "material_name": "一次性口腔器械盒",
        "specification": "标准型",
        "manufacturer": "江苏某医疗器械公司",
        "batch_no": "BATCH-20250201",
        "production_date": "2025-02-20T00:00:00",
        "expiry_date": "2025-05-20T00:00:00",
        "quantity": 500,
        "unit": "盒",
        "storage_condition": "常温保存",
        "supplier": "YY医疗器械有限公司"
      },
      {
        "material_code": "MAT-003",
        "material_name": "正畸托槽",
        "specification": "MBT 0.022",
        "manufacturer": "美国某正畸公司",
        "batch_no": "BATCH-20241201",
        "production_date": "2024-12-01T00:00:00",
        "expiry_date": "2025-04-20T00:00:00",
        "quantity": 200,
        "unit": "套",
        "storage_condition": "密封保存",
        "supplier": "ZZ医疗器械有限公司"
      }
    ]
  }'
```

### 步骤3: 获取批次列表

```bash
curl -X GET "http://localhost:8000/api/batches/"
```

### 步骤4: 获取批次详情

```bash
# 将 {batch_id} 替换为实际的批次ID（从步骤3的返回结果中获取）
curl -X GET "http://localhost:8000/api/batches/1"
```

### 步骤5: 修改耗材结论（人工复核后调整）

```bash
# 将 {item_id} 替换为实际的耗材ID
curl -X PUT "http://localhost:8000/api/items/3" \
  -H "Content-Type: application/json" \
  -d '{
    "classification": "待补充",
    "reason": "经过质控审核，该批托槽虽效期不足30天，但经供应商确认可延长效期，且为临床急需",
    "follow_up_action": "标记为优先使用，要求临床30天内用完，每日监控使用情况",
    "changed_by": "李质控",
    "change_reason": "临床急需且供应商确认可安全使用，经质控部门审批通过"
  }'
```

### 步骤6: 查看修改历史

```bash
# 将 {item_id} 替换为实际的耗材ID
curl -X GET "http://localhost:8000/api/items/3/history"
```

### 步骤7: 获取统计信息

```bash
curl -X GET "http://localhost:8000/api/statistics"
```

### 步骤8: 下载单批次报告

```bash
# 将 {batch_id} 替换为实际的批次ID
curl -X GET "http://localhost:8000/api/reports/batch/1" \
  -o 批次报告_PURCHASE-2025-001.xlsx
```

### 步骤9: 下载全量报告

```bash
curl -X GET "http://localhost:8000/api/reports/full" \
  -o 全量耗材效期报告.xlsx
```

## 分类规则说明

| 分类 | 效期剩余天数 | 原因说明 | 后续动作 |
|------|-------------|----------|----------|
| **已拦截** | ≤ 0天 | 耗材已过期 | 立即下架，联系供应商处理退货或销毁，禁止入库使用 |
| **已拦截** | ≤ 30天 | 效期不足30天 | 拦截入库，联系采购确认是否退换货，特殊情况需质控审批 |
| **待补充** | ≤ 90天 | 效期不足90天 | 标记为近效期，优先出库使用，监控库存周转情况 |
| **待补充** | ≤ 180天 | 效期不足180天 | 重点关注，制定使用计划，定期检查库存状况 |
| **正常** | > 180天 | 效期正常 | 正常入库，按常规流程管理库存 |

## 关键字段追踪

系统确保以下关键字段从原始输入到最终报告的完整追踪：

- `material_code`（耗材编码）
- `material_name`（耗材名称）
- `batch_no`（生产批号）
- `expiry_date`（有效期至）
- `quantity`（数量）
- `classification`（分类结果）
- `reason`（分类原因）
- `follow_up_action`（后续动作）

## 数据库结构

- **batches**: 批次表，记录批次基本信息
- **batch_items**: 耗材明细表，记录每个耗材的信息和分类结果
- **change_history**: 修改历史表，记录所有分类结论的修改记录

## 技术栈

- **FastAPI**: 现代化Python Web框架，提供自动API文档
- **SQLAlchemy**: ORM数据库工具
- **SQLite**: 轻量级数据库（可替换为MySQL/PostgreSQL）
- **Pandas**: 数据处理和Excel导出
- **OpenPyXL**: Excel文件生成
