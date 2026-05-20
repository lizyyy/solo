# 药企稳定性试验对账服务

用于药企QA核对样品数据、试验方案和环境箱记录的后端对账服务，实现了数据导入、自动比对、人工复核、重新计算和报告下载等完整功能。

## 功能特性

### 1. 数据导入
- 试验方案JSON导入
- 样品CSV数据导入
- 环境箱记录CSV导入
- 提供导入模板下载

### 2. 自动比对引擎
- **取样窗口校验**：检查实际取样日期是否在允许范围内
- **箱体超温检测**：检测样品存储期间箱体是否有温湿度超标
- **延期审批检查**：检查样品延期是否有审批记录
- 差异来源可解释

### 3. 人工复核
- 差异记录审核
- 添加审核意见
- 标记问题解决状态
- 支持更新计算结果
- 完整审计日志记录

### 4. 数据同步
- 复核改动后自动同步相关数据
- 报告统计数据实时更新
- 重新计算触发机制

### 5. 报告生成
- 汇总报告（Excel）
- 详细报告（Excel）
- JSON格式报告
- 报告下载功能

### 6. 数据追溯
- 从单个样品追溯完整链路
- 试验方案信息
- 箱体记录历史
- 对账记录详情
- 审核操作日志

## 项目结构

```
stability_reconciliation/
├── __init__.py
├── main.py                      # FastAPI主应用
├── models/
│   ├── __init__.py
│   └── database.py             # SQLAlchemy数据模型
├── schemas/
│   ├── __init__.py
│   └── reconciliation.py       # Pydantic请求/响应模型
├── services/
│   ├── __init__.py
│   ├── import_service.py       # 数据导入服务
│   ├── reconciliation_engine.py # 对账引擎
│   ├── review_service.py       # 审核服务
│   └── report_service.py       # 报告服务
└── data/                       # 报告存储目录
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
cd /path/to/zy70870
python -m stability_reconciliation.main
```

或使用uvicorn：

```bash
uvicorn stability_reconciliation.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问API文档

服务启动后，访问以下地址查看交互式API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/protocol | 导入试验方案JSON |
| POST | /api/import/samples/{protocol_id} | 导入样品CSV |
| POST | /api/import/chamber-records | 导入箱体记录CSV |
| GET | /api/import/template/{type} | 下载导入模板 |

### 对账管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconciliation/run/{protocol_id} | 执行对账 |
| GET | /api/reconciliation/batch/{batch_id} | 获取对账批次结果 |
| GET | /api/reconciliation/{id} | 获取单个对账记录 |
| POST | /api/reconciliation/recalculate/{id} | 重新计算 |

### 审核管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reconciliation/review | 提交审核意见 |
| GET | /api/audit/history/{reconciliation_id} | 获取审核历史 |
| GET | /api/statistics/review | 获取审核统计 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reports/generate | 生成报告 |
| GET | /api/reports | 获取报告列表 |
| GET | /api/reports/{id} | 获取报告详情 |
| GET | /api/reports/{id}/download | 下载报告 |

### 数据追溯

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/trace/sample/{sample_id} | 追溯样品完整链路 |
| GET | /api/protocols | 获取方案列表 |
| GET | /api/samples/{protocol_id} | 获取样品列表 |
| GET | /api/chamber-records/{chamber_name} | 获取箱体记录 |

## 典型使用流程

1. **下载导入模板**
   ```
   GET /api/import/template/protocol
   GET /api/import/template/samples
   GET /api/import/template/chamber
   ```

2. **导入数据**
   - 先导入试验方案JSON
   - 再导入该方案下的样品CSV
   - 最后导入箱体记录CSV

3. **执行对账**
   ```
   POST /api/reconciliation/run/{protocol_id}
   ```

4. **查看对账结果**
   ```
   GET /api/reconciliation/batch/{batch_id}
   ```

5. **人工复核差异**
   ```
   POST /api/reconciliation/review
   {
     "reconciliation_id": "RECON-XXXX",
     "review_comment": "已确认该差异为正常取样偏差",
     "is_resolved": true,
     "resolution_note": "偏差已记录，不影响结果",
     "reviewer": "QA001"
   }
   ```

6. **生成报告**
   ```
   POST /api/reports/generate
   {
     "protocol_id": "PROTO-XXXX",
     "reconciliation_batch_id": "BATCH-XXXX",
     "report_type": "detailed",
     "generated_by": "QA001"
   }
   ```

7. **数据追溯**
   ```
   GET /api/trace/sample/{sample_id}
   ```

## 数据模型说明

### TestProtocol（试验方案）
- protocol_name: 方案名称
- product_name: 产品名称
- batch_number: 批次号
- conditions: 试验条件
- sampling_points: 取样点配置

### Sample（样品）
- sample_id: 样品编号
- sampling_point: 取样点
- planned_sampling_date: 计划取样日期
- actual_sampling_date: 实际取样日期
- condition: 存储条件
- storage_location: 箱体位置
- test_results: 检测结果

### ChamberRecord（箱体记录）
- chamber_id: 箱体ID
- chamber_name: 箱体名称
- record_time: 记录时间
- temperature: 实际温度
- humidity: 实际湿度
- target_temperature: 目标温度
- target_humidity: 目标湿度
- is_alert: 是否告警
- alert_type: 告警类型

### ReconciliationRecord（对账记录）
- status: 状态（matched/discrepancy/resolved）
- discrepancy_type: 差异类型
- discrepancy_source: 差异来源
- discrepancy_description: 差异描述
- is_resolved: 是否已解决
- review_comments: 审核意见
- calculation_details: 计算详情

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展为PostgreSQL/MySQL）
- **数据处理**: Pandas
- **报告生成**: OpenPyXL, XlsxWriter
