# 供水抢修对账服务

## 项目简介

本系统是专为供水抢修队设计的后端对账服务，解决夜间抢修领料后补账经常出错的问题。系统通过整合领料单、车辆物资、库存数据，实现自动对账、差异识别、人工复核、批次追踪和报告导出功能。

## 核心功能

### 1. 数据导入
- 领料单 CSV 导入
- 车辆物资 JSON 导入
- 库存数据 CSV 导入

### 2. 自动对账
- **紧急领用差异识别**：标记紧急领用记录，说明夜间抢修无手续出库情况
- **归还差异处理**：检测领料单数量与车辆实际使用数量差异
- **库存负数预警**：自动识别库存为负的物资
- **数量不匹配检测**：发现领料单与车辆使用数量不一致
- **批次不匹配检测**：识别批次号不一致情况
- **车辆数据缺失检测**：标记缺少车辆物资数据的记录

### 3. 人工复核
- 单条差异复核（批准/拒绝/需补材料）
- 批量复核功能
- 复核记录留痕，可追溯操作历史
- 修改领料单后自动重新对账
- 差异原因说明记录

### 4. 备件批次追踪
- 追溯备件批次的完整历史
- 显示批次的入库、出库、领用、归还记录
- 关联领料单和车辆使用记录
- 计算批次结存数量

### 5. 报告导出
- 对账汇总报告
- 差异明细 Excel 导出
- 领料单明细 Excel 导出
- 完整对账报告（包含汇总、差异、领料单明细）

## 技术栈

- **后端框架**: FastAPI 0.104.1
- **数据库**: SQLAlchemy 2.0 + SQLite
- **数据处理**: Pandas, OpenPyXL
- **API文档**: 自动生成 Swagger UI

## 项目结构

```
water-repair-reconciliation/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI主应用
│   ├── database.py             # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py           # 数据模型
│   ├── schemas/                # Pydantic模式
│   │   └── __init__.py
│   ├── services/               # 业务服务
│   │   ├── __init__.py
│   │   ├── import_service.py       # 数据导入服务
│   │   ├── reconciliation_service.py # 对账服务
│   │   ├── review_service.py       # 复核服务
│   │   ├── batch_trace_service.py  # 批次追踪服务
│   │   └── report_service.py       # 报告服务
│   └── utils/                  # 工具函数
│       └── __init__.py
├── data/                       # 示例数据
│   ├── requisitions_sample.csv
│   ├── vehicle_materials_sample.json
│   └── inventory_sample.csv
├── requirements.txt
├── test_service.py             # 测试脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行测试

```bash
python test_service.py
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

启动服务后，访问以下地址查看完整的API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 导入接口
- `POST /import/requisitions` - 导入领料单CSV
- `POST /import/vehicle-materials` - 导入车辆物资JSON
- `POST /import/inventory` - 导入库存CSV

### 对账接口
- `POST /reconciliation/run` - 运行自动对账
- `GET /reconciliation/diffs` - 获取差异列表

### 复核接口
- `POST /review/diff/{diff_id}` - 复核单条差异
- `POST /review/batch` - 批量复核
- `PUT /review/requisition/{requisition_id}` - 更新领料单并重算
- `GET /review/requisition/{requisition_id}` - 获取领料单详情
- `GET /review/history` - 获取复核历史

### 批次追踪接口
- `GET /batch/trace/{batch_no}` - 追踪批次历史
- `GET /batch/list` - 获取批次列表
- `GET /batch/requisition-source/{requisition_id}` - 追踪领料单批次来源

### 报告接口
- `GET /reports/summary` - 获取对账汇总报告
- `GET /reports/export/diffs` - 导出差异明细Excel
- `GET /reports/export/requisitions` - 导出领料单明细Excel
- `GET /reports/export/full` - 导出完整对账报告

### 基础数据接口
- `GET /requisitions` - 获取领料单列表
- `GET /vehicle-materials` - 获取车辆物资列表
- `GET /inventory` - 获取库存列表

## 差异类型说明

| 类型 | 说明 |
|------|------|
| EMERGENCY | 紧急领用差异 - 夜间抢修应急出库 |
| RETURN | 归还差异 - 领料数量大于实际使用数量 |
| NEGATIVE_INVENTORY | 库存负数预警 |
| QUANTITY_MISMATCH | 数量不匹配 |
| BATCH_MISMATCH | 批次不匹配 |
| MISSING_VEHICLE | 车辆数据缺失 |

## 复核状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| approved | 已批准 - 数据核对无误 |
| rejected | 已拒绝 - 存在问题需退回 |
| need_material | 需补材料 - 缺少相关证明材料 |

## 使用流程

1. **数据导入**：导入领料单、车辆物资、库存数据
2. **自动对账**：运行自动对账，系统自动识别各类差异
3. **人工复核**：对差异进行审批，填写复核意见和差异说明
4. **批次追踪**：追溯备件批次历史，确认来源和流向
5. **报告导出**：生成并导出对账报告，用于存档和汇报

## 数据库模型

### MaterialRequisition (领料单)
- 领料单号、抢修队、车牌号、领料日期
- 物资编码、物资名称、规格型号、数量、单位
- 批次号、是否紧急、操作员、状态
- 创建时间、更新时间

### VehicleMaterial (车辆物资)
- 车牌号、盘点日期
- 物资编码、物资名称、规格型号
- 出车数量、回车数量、使用数量、单位
- 批次号、盘点人

### Inventory (库存)
- 物资编码、物资名称、规格型号
- 数量、单位、仓库、批次号
- 安全库存、更新时间

### ReconciliationDiff (对账差异)
- 差异编号、差异类型
- 物资编码、物资名称
- 领料单数量、车辆数量、库存数量、差异数量
- 解释说明、状态、是否批准、批准人、批准日期
- 创建时间、更新时间

### ReviewRecord (复核记录)
- 领料单ID、复核人、复核日期
- 复核状态、复核意见
- 前状态、差异说明
- 创建时间

### BatchTrace (批次追踪)
- 批次号、物资编码、物资名称
- 来源类型、来源编号、动作类型
- 数量、操作员、操作日期
- 备注、领料单ID
- 创建时间

### ReconciliationSummary (对账汇总)
- 汇总日期、领料单总数、紧急领用数
- 差异总数、已解决差异、待处理差异
- 库存负数预警数、归还差异数
- 创建时间、更新时间

## 注意事项

1. **数据备份**：定期备份 SQLite 数据库文件
2. **批次管理**：确保物资批次号准确，便于追溯
3. **复核权限**：建议在生产环境中添加用户权限管理
4. **定时对账**：可配置定时任务每日自动运行对账
5. **日志记录**：建议添加详细的操作日志，便于审计追溯
