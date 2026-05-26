# 物流调度扣罚管理系统

## 项目概述

物流调度后端服务，用于管理运单、轨迹、扣罚规则，生成可追踪的异常处理记录。支持批次管理、异常判定、责任划分、历史追溯和数据导出。

## 技术栈

- **框架**: FastAPI 0.104.1
- **数据库**: SQLite (SQLAlchemy 2.0.23)
- **数据处理**: Pandas 2.1.4
- **Excel导出**: openpyxl, xlsxwriter

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行演示脚本

```bash
pip install requests
python test_demo.py
```

## 核心功能

### 1. 批次管理
- 创建新批次
- 批次列表查询
- 批次详情（运单数、异常数、待处理数）
- 批次状态更新

### 2. 数据导入
- **运单CSV导入**: 支持标准CSV格式，包含运单号、收发货人、起止地、重量体积、预计/实际送达时间
- **轨迹JSON导入**: 支持数组格式，包含运单号、时间戳、节点、状态、操作人等
- **扣罚规则导入**: 批量导入扣罚规则编码、名称、类型、比例、适用条件

### 3. 异常分析
- 智能识别超时送达
- 检测货物破损/丢失
- 识别中转延误
- 检测轨迹缺失
- 识别异常滞留

### 4. 扣罚记录管理
- 手动创建扣罚记录
- 批量创建扣罚记录
- 支持标记:
  - 跨中转责任 (`is_cross_transfer`)
  - 天气免责 (`is_weather_exempt`)
  - 重复扣罚 (`is_duplicate`)

### 5. 处理流程
- **approve (通过)**: 确认扣罚生效
- **reject (驳回)**: 拒绝扣罚申请
- **return (退回修改)**: 要求补充信息后重新提交
- **supplement (要求补材料)**: 缺少必要材料
- **release (放行)**: 特殊情况予以免责

### 6. 查询筛选
支持多维度组合查询:
- 中转节点
- 异常类型
- 异常原因（模糊搜索）
- 扣罚比例范围
- 处理状态
- 批次ID
- 创建时间范围

### 7. 数据导出
- **扣罚明细导出**: 根据查询条件导出Excel
- **批次报告导出**: 包含批次汇总和明细的完整报告
- **追溯报告导出**: 单条记录的完整追溯信息（运单、轨迹、处理历史）

### 8. 追溯能力
每条扣罚记录可查看:
- 扣罚记录详情（异常类型、原因、节点、比例、金额）
- 关联运单信息
- 完整轨迹记录
- 所有处理历史（操作人、时间、原因、状态变更）

## 数据库设计

### 核心表结构

| 表名 | 说明 |
|------|------|
| `batches` | 批次信息 |
| `waybills` | 运单信息 |
| `tracking_records` | 轨迹记录 |
| `penalty_rules` | 扣罚规则 |
| `penalty_records` | 扣罚记录（核心） |
| `process_histories` | 处理历史 |

### 扣罚记录表关键字段

```
- exception_type: 异常类型
- exception_reason: 异常原因
- transfer_node: 中转节点
- penalty_ratio: 扣罚比例
- penalty_amount: 扣罚金额
- is_weather_exempt: 天气免责标记
- weather_reason: 天气原因说明
- is_cross_transfer: 跨中转责任标记
- cross_transfer_detail: 跨中转详情
- is_duplicate: 重复扣罚标记
- status: 处理状态 (pending/approved/rejected/returned/supplement/released)
- process_result: 处理结果
- process_reason: 处理原因
- processed_by: 处理人
- processed_at: 处理时间
```

## API 接口速览

### 批次管理
- `POST /batches` - 创建批次
- `GET /batches` - 批次列表
- `GET /batches/{id}` - 批次详情
- `PUT /batches/{id}/status` - 更新批次状态

### 数据导入
- `POST /batches/{id}/waybills/import` - 导入运单CSV
- `POST /tracking/import` - 导入轨迹JSON
- `POST /penalty-rules/import` - 导入扣罚规则

### 扣罚规则
- `GET /penalty-rules` - 规则列表

### 扣罚记录
- `POST /penalty-records` - 创建记录
- `POST /penalty-records/batch` - 批量创建
- `GET /penalty-records/{id}` - 记录详情（含追溯）
- `POST /penalty-records/query` - 条件查询

### 处理操作
- `POST /penalty-records/process` - 批量处理
- `GET /penalty-records/{id}/history` - 处理历史

### 异常分析
- `POST /batches/{id}/analyze` - 智能分析批次异常

### 数据导出
- `POST /penalty-records/export` - 导出查询结果
- `GET /batches/{id}/export` - 导出批次报告
- `GET /penalty-records/{id}/export` - 导出单条追溯报告

### 元数据
- `GET /metadata/transfer-nodes` - 所有中转节点
- `GET /metadata/exception-types` - 所有异常类型

## 典型工作流程

1. **创建批次**: `POST /batches`
2. **导入运单**: `POST /batches/{id}/waybills/import`
3. **导入轨迹**: `POST /tracking/import`
4. **导入规则**: `POST /penalty-rules/import`
5. **分析异常**: `POST /batches/{id}/analyze`
6. **创建扣罚记录**: `POST /penalty-records/batch`
7. **处理记录**: `POST /penalty-records/process`
8. **查询历史**: `POST /penalty-records/query`
9. **导出报告**: `GET /batches/{id}/export`

## 数据持久化

使用SQLite文件数据库 (`logistics.db`)，服务重启后所有数据保留。可通过查询接口按中转节点、异常原因、扣罚比例等条件检索历史记录。
