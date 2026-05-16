# 收据去重后端服务

基于 FastAPI 的高峰门店设备台账收据去重后端服务，支持异常检测、批量预览、数据导出等功能。

## 功能特性

### 1. 收据去重
- 基于多字段指纹算法检测重复记录
- 支持自定义去重字段（收据编号、设备编号、序列号等）
- 重复检测置信度评估

### 2. 原始数据回溯
- 每条记录保留原始输入ID
- 记录来源文件名和原始行号
- 完整保留原始输入数据备份
- 支持通过原始ID查询追溯

### 3. 报告口径变更检测
- 检测同一门店报告口径不一致问题
- 触发异常路径处理流程
- 记录异常详情供复核

### 4. 批量操作预览
- 执行批量操作前预览影响范围
- 统计潜在重复记录数
- 统计口径变更影响记录数
- 按门店、审批节点分析影响
- 估算工作量

### 5. 异常样本导出
- 导出异常记录到Excel供同事复核
- 导出重复记录到Excel
- 包含完整原始数据
- 包含会议纪要附件信息

### 6. 会议纪要附件管理
- 保留附件原始值
- 保留附件修正后的值
- 支持修正前后对比展示
- 记录上传人和时间

### 7. 审批节点回查
- 按审批节点查询记录
- 按审批节点导出数据
- 支持审批流程回溯

## 项目结构

```
.
├── main.py                 # FastAPI 主入口
├── requirements.txt        # 依赖包列表
├── test_service.py         # 功能测试脚本
├── api/
│   ├── __init__.py
│   ├── receipt.py          # 收据管理API
│   ├── preview.py          # 批量预览API
│   └── export.py           # 导出管理API
├── models/
│   ├── __init__.py
│   └── schemas.py          # 数据模型定义
├── services/
│   ├── __init__.py
│   ├── deduplication_service.py    # 去重服务
│   └── export_service.py           # 导出服务
├── data/
│   ├── __init__.py
│   ├── sample_data.py      # 测试数据生成
│   └── exports/            # 导出文件目录
└── utils/
```

## 快速开始

### 安装依赖

```bash
pip3 install -r requirements.txt
```

### 运行服务

```bash
python3 main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 运行功能测试

```bash
python3 test_service.py
```

## API 接口说明

### 收据管理 (api/receipt)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/receipt/load-samples | 加载测试样本数据 |
| POST | /api/receipt/deduplicate | 执行去重处理 |
| GET | /api/receipt/{receipt_id} | 根据ID查询收据 |
| GET | /api/receipt/original/{original_id} | 根据原始ID查询收据 |
| GET | /api/receipt/by-approval-node/{node} | 按审批节点查询 |
| GET | /api/receipt/by-store/{store_code} | 按门店查询 |
| GET | /api/receipt/duplicates | 获取重复记录列表 |
| GET | /api/receipt/abnormal | 获取异常记录列表 |
| GET | /api/receipt/statistics | 获取统计信息 |

### 批量预览 (api/preview)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/preview/batch | 批量操作预览影响 |
| GET | /api/preview/impact-analysis | 影响分析 |
| GET | /api/preview/comparison | 记录对比分析 |

### 导出管理 (api/export)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/export/abnormal | 导出异常记录 |
| POST | /api/export/duplicates | 导出重复记录 |
| POST | /api/export/by-approval-node/{node} | 按审批节点导出 |
| POST | /api/export/caliber-changed | 出口径变更记录 |
| POST | /api/export/full-export | 完整导出 |
| GET | /api/export/export-history | 获取导出历史 |

## 数据模型说明

### DeviceLedger (设备台账)
- id: 唯一标识
- original_id: 原始输入ID
- source_file: 来源文件名
- row_number: 原始行号
- store_code: 门店编号
- store_name: 门店名称
- device_code: 设备编号
- device_name: 设备名称
- receipt_number: 收据编号
- purchase_amount: 采购金额
- approval_node: 审批节点
- report_caliber: 报告口径
- meeting_attachments: 会议纪要附件列表
- raw_data: 原始数据完整备份

### ApprovalNode (审批节点)
- 门店经理
- 区域督导
- 财务审核
- 总经理审批

### ReportCaliber (报告口径)
- 新口径
- 旧口径
- 未知

## 测试数据说明

系统预置3类测试数据，共32条记录：

1. **正常材料样本** (25条)
   - 5家门店（高峰中心店、广场店、社区店、旗舰店、大学城店）
   - 5类设备（POS机、空调、冰箱、打印机、扫码枪）
   - 覆盖所有审批节点
   - 全部使用新口径

2. **报告口径变更坏样本** (5条)
   - 仅高峰中心店
   - 3条旧口径 + 2条新口径
   - 触发口径不一致检测

3. **重复上报样本** (2条)
   - 仅高峰广场店
   - 完全相同的设备和收据信息
   - 触发重复检测

## 导出文件格式

导出的Excel文件包含以下列：
- 异常/重复记录基本信息
- 收据ID、原始输入ID
- 来源文件、原始行号
- 门店、设备、收据详细信息
- 会议纪要附件原始值、修正值
- 完整原始数据备份（可选）

## 示例调用

```bash
# 执行去重
curl -X POST "http://localhost:8000/api/receipt/deduplicate"

# 导出异常记录
curl -X POST "http://localhost:8000/api/export/abnormal?include_original_data=true"

# 批量预览
curl -X POST "http://localhost:8000/api/preview/batch" \
  -H "Content-Type: application/json" \
  -d '{"file_names": [], "deduplication_fields": ["receipt_number", "device_code"], "enable_caliber_check": true}'
```
