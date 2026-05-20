# 法务对账服务系统

## 项目概述

这是一个专为公司法务部门设计的对账服务后端系统，用于整合合同申请、盖章记录、审批记录和快递寄出记录，实现自动化对账和人工复核流程。

## 核心功能

### 1. 数据导入
- 合同申请 CSV 导入
- 盖章记录 JSON 导入
- 审批记录 JSON 导入
- 快递寄出记录 CSV 导入

### 2. 自动对账引擎
- 自动匹配四张表的数据
- 识别差异类型：
  - **越权盖章**：未获得授权却已盖章
  - **补盖附件**：存在补盖记录
  - **撤回重提**：撤回后重新盖章
  - **缺少审批/盖章/快递记录**
  - 记录缺失检测

### 3. 人工复核
- 支持审批、退回、要求补材料、修改等操作
- 复核意见记录
- 复核历史追踪
- 自动更新批次统计

### 4. 报告与导出
- 对账批次汇总统计
- 明细列表查询
- 全链路追踪（从申请到快递）
- Excel 导出（批次汇总和单条明细）
- 差异原因说明生成

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库并导入示例数据

```bash
python init_data.py
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

打开浏览器访问：`http://localhost:8000/docs`

## API 接口说明

### 数据导入

- `POST /api/v1/import/applications` - 导入合同申请 CSV
- `POST /api/v1/import/stamps` - 导入盖章记录 JSON
- `POST /api/v1/import/approvals` - 导入审批记录 JSON
- `POST /api/v1/import/express` - 导入快递记录 CSV

### 对账操作

- `POST /api/v1/reconciliation/run` - 运行批次对账
- `POST /api/v1/reconciliation/{id}/recalculate` - 重新计算单条记录

### 复核操作

- `POST /api/v1/review` - 提交复核
- `GET /api/v1/review/{result_id}/history` - 查看复核历史
- `GET /api/v1/audit-trail/{application_no}` - 全链路审计追踪
- `GET /api/v1/explanation/{result_id}` - 获取处理原因说明

### 查询与导出

- `GET /api/v1/batch/{batch_id}/summary` - 获取批次汇总
- `GET /api/v1/batch/{batch_id}/details` - 获取批次明细
- `GET /api/v1/reconciliation/{id}/full-chain` - 获取单条全链路详情
- `GET /api/v1/export/batch/{batch_id}/excel` - 导出批次 Excel
- `GET /api/v1/export/reconciliation/{id}/excel` - 导出单条明细 Excel
- `GET /api/v1/statistics` - 获取统计报告

## 使用流程示例

1. **导入数据**：依次导入合同申请、盖章记录、审批记录、快递记录
2. **运行对账**：调用 `POST /api/v1/reconciliation/run?batch_id=BATCH001`
3. **查看结果**：调用 `GET /api/v1/batch/BATCH001/details`
4. **人工复核**：对差异记录调用 `POST /api/v1/review`
5. **导出报告**：调用导出接口生成 Excel 报告

## 项目结构

```
├── main.py                 # FastAPI 主入口
├── requirements.txt        # 依赖清单
├── init_data.py           # 数据初始化脚本
├── sample_data/           # 示例数据文件夹
│   ├── applications.csv
│   ├── stamps.json
│   ├── approvals.json
│   └── express.csv
└── app/
    ├── __init__.py
    ├── database.py        # 数据库配置
    ├── models.py          # 数据模型
    ├── schemas.py         # Pydantic 模式
    ├── api.py             # API 路由
    └── services/          # 业务服务
        ├── __init__.py
        ├── import_service.py      # 导入服务
        ├── reconciliation_engine.py  # 对账引擎
        ├── review_service.py      # 复核服务
        └── report_service.py      # 报告服务
```

## 差异类型说明

| 类型 | 说明 |
|------|------|
| unauthorized_stamp | 越权盖章：无审批授权却已盖章 |
| supplementary_attachment | 补盖附件：存在补盖记录 |
| withdrawal_resubmit | 撤回重提：先撤回后重新盖章 |
| missing_approval | 缺少审批记录 |
| missing_stamp | 缺少有效盖章记录 |
| missing_express | 缺少快递寄出记录 |

## 复核操作类型

- `approve` - 审批通过放行
- `reject` - 退回
- `request_supplement` - 要求补充材料
- `revise` - 修改对账结果
