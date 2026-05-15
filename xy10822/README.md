# 支付对账接口台

一个偏技术方向的全栈 Web/API 应用，用于处理支付渠道文件和内部 API 对账。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: React + TypeScript + Ant Design + Vite

## 核心功能

### 后端 API
- 创建/查询对账批次
- 执行对账逻辑（差异归因）
- 状态推进（待处理 → 处理中 → 已匹配/有差异 → 已解决）
- 异常处理与历史记录
- 数据导出（Excel格式）

### 前端界面
- **数据概览**: 统计看板，对账成功率、差异分布
- **对账批次**: 新建批次、执行对账、导出、查看历史
- **异常队列**: 待处理差异列表、处理操作、历史轨迹
- **历史轨迹**: 完整操作记录，可追溯

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档地址: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端地址: http://localhost:3000

## 使用流程

1. **生成模拟数据**
   - 进入"数据概览"页面
   - 点击"生成模拟数据"按钮
   - 系统会创建包含预设差异率的测试数据

2. **执行对账**
   - 进入"对账批次"页面
   - 点击"执行对账"按钮
   - 系统会自动比对渠道流水和内部订单，标记差异

3. **处理差异**
   - 进入"异常队列"页面
   - 点击"处理"按钮，输入处理备注
   - 处理后状态会自动更新，可在历史轨迹中查看

4. **导出结果**
   - 在"对账批次"页面点击"导出"按钮
   - 下载包含渠道流水、内部订单、差异记录的 Excel 文件

## 数据模型

- **ChannelTransaction (渠道流水)**: 交易ID、渠道、金额、状态、订单号
- **InternalOrder (内部订单)**: 订单号、金额、状态、支付方式
- **ReconciliationBatch (对账批次)**: 批次号、渠道、状态、统计数据
- **Discrepancy (差异记录)**: 差异类型、描述、预期/实际金额、状态、处理备注
- **ProcessingHistory (处理历史)**: 操作类型、状态、操作者、详情、时间戳

## 差异类型

- `amount_mismatch`: 金额不匹配
- `missing_internal`: 缺失内部订单
- `missing_channel`: 缺失渠道流水
- `status_mismatch`: 状态不匹配
- `refund_mismatch`: 退款不匹配
- `duplicate`: 重复记录
- `other`: 其他

## API 接口示例

```bash
# 获取批次列表
GET /api/batches

# 创建批次
POST /api/batches
{
  "batch_no": "BATCH-20240101-001",
  "channel": "alipay",
  "reconciliation_date": "2024-01-01T00:00:00Z"
}

# 执行对账
POST /api/batches/{batch_id}/reconcile

# 处理差异
POST /api/discrepancies/{discrepancy_id}/resolve
{
  "resolved_note": "已核实，差异原因：汇率波动",
  "operator": "张三"
}

# 导出对账结果
GET /api/batches/{batch_id}/export
```

## 验收要点

1. **重复操作稳定性**: 重复处理差异会提示"已处理，请勿重复操作"
2. **失败原因追溯**: 所有操作都记录在历史轨迹中，包含错误信息
3. **状态推进正确**: 待处理 → 处理中 → 已匹配/有差异 → 已解决
4. **接口与页面一致**: 前端操作后后端真实状态变更，API 调用结果可验证
