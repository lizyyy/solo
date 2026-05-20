# 酒店布草对账系统

一个后端对账服务，用于处理酒店布草送洗、回收、破损、短少赔付等对账流程。

## 功能特性

### 1. 数据导入
- **CSV导入**: 支持导入洗涤厂送洗清单
- **JSON导入**: 支持导入回收单数据
- **房型配置**: 管理不同房型的布草配置和单价

### 2. 自动对账
- 按布草类型自动聚合送洗和回收数据
- 自动计算破损数量、短少数量
- 自动识别差异类型（短少、破损、不匹配）
- 自动计算费用：送洗金额、短少赔付、破损扣减、最终金额

### 3. 差异归因
- 生成可读的差异说明
- **短少赔付说明**: 详细说明短少数量和赔付金额
- **破损扣减说明**: 说明破损原因和扣减金额
- **异常情况说明**: 回收多于送洗、无送洗记录等情况

### 4. 人工复核
- 支持单条记录审批（通过/拒绝/修正）
- 支持批量审批
- 支持修改对账数据（送洗数量、回收数量、破损数量、短少数量）
- 自动同步修改后的汇总数据和报告
- 记录操作人、操作时间和备注

### 5. 报告生成
- 生成对账明细报表
- 支持CSV格式导出
- 支持JSON格式导出
- 包含差异说明和复核记录

## 项目结构

```
linen_reconciliation/
├── models.py              # 数据模型和数据库操作
├── data_import.py         # 数据导入模块（CSV/JSON解析）
├── reconciliation.py      # 对账核心引擎
├── review_and_report.py   # 复核管理和报告生成
├── app.py                 # Flask API服务
├── demo.py                # 演示脚本
├── requirements.txt       # 依赖包
├── sample_data/           # 示例数据
│   ├── washing_sample.csv
│   └── recovery_sample.json
└── exports/               # 导出报告目录
```

## 核心数据模型

### 数据库表
- **room_config**: 房型布草配置
- **washing_records**: 送洗记录
- **recovery_records**: 回收记录
- **reconciliation_batches**: 对账批次
- **reconciliation_details**: 对账明细
- **discrepancy_logs**: 差异日志
- **review_history**: 复核历史

### 状态枚举
- **RecordStatus**: pending/matched/discrepancy/approved/rejected
- **DiscrepancyType**: shortage/damage/duplicate/mismatch
- **ReviewAction**: approve/reject/revise/request_more

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 运行演示
```bash
python3 demo.py
```

### 3. 启动API服务
```bash
python3 app.py
```

服务将在 `http://localhost:5000` 启动

## API接口

### 数据导入
- `POST /api/import/washing` - 导入送洗CSV
- `POST /api/import/recovery` - 导入回收单JSON
- `GET /api/washing` - 获取送洗记录
- `GET /api/recovery` - 获取回收记录

### 对账管理
- `POST /api/reconciliation/batch` - 创建对账批次
- `POST /api/reconciliation/run/<batch_id>` - 执行自动对账
- `GET /api/reconciliation/details/<batch_id>` - 获取对账明细
- `GET /api/reconciliation/summary/<batch_id>` - 获取对账汇总

### 复核管理
- `POST /api/review/<detail_id>` - 复核单条记录
- `POST /api/review/revise/<detail_id>` - 修改对账数据
- `POST /api/review/batch-approve/<batch_id>` - 批量审批

### 报告导出
- `GET /api/report/<batch_id>` - 获取对账报告
- `GET /api/report/export/csv/<batch_id>` - 导出CSV报告
- `GET /api/report/export/json/<batch_id>` - 导出JSON报告
- `GET /api/batches` - 获取所有对账批次

## 对账流程示例

1. **导入数据**: 导入洗涤厂CSV送洗清单和酒店JSON回收单
2. **创建批次**: 指定对账周期创建对账批次
3. **自动对账**: 系统自动聚合数据、计算差异、生成对账明细
4. **查看差异**: 查看每条记录的差异原因和可读说明
5. **人工复核**: 审批通过、拒绝或修正数据
6. **数据同步**: 修改数据后自动重新计算并更新汇总
7. **导出报告**: 导出对账报表用于财务结算

## 费用计算规则

- **送洗金额**: 送洗数量 × 单价
- **短少赔付**: 短少数量 × 单价（全额赔付）
- **破损扣减**: 破损数量 × 单价 × 50%（半价扣减）
- **最终金额**: 送洗金额 - 短少赔付 - 破损扣减

## 技术栈

- **语言**: Python 3
- **Web框架**: Flask
- **数据库**: SQLite
- **跨域**: Flask-CORS

## 审计追踪

系统记录完整的操作历史：
- 操作人
- 操作时间
- 操作类型（审批/修改）
- 操作前状态
- 操作后状态
- 操作备注

可用于向财务、洗涤厂说明对账依据。
