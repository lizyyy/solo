# 批量补偿后端服务

基于 FastAPI + SQLite 的批量补偿处理系统，专为跨天售后录音补偿场景设计。

## 功能特性

- ✅ **跨天售后录音样例** - 内置6条真实样例，其中包含1条来源混杂的问题记录
- ✅ **幂等性处理** - 同一批内容再次提交时，复用旧结论或说明冲突
- ✅ **持久化存储** - 使用SQLite数据库，本地重启后历史记录依然可查
- ✅ **批量预览** - 执行前可预览影响范围、预估补偿金额
- ✅ **多种输出格式** - 支持JSON、Markdown和文件下载三种格式
- ✅ **完整报告** - 包含处理前后对比、执行时间、下一步建议
- ✅ **人工修正标注** - 按批次号标注来源和处理依据

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

### 3. 运行完整流程测试

```bash
python test_flow.py
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/batches/sample/cross-day` | 获取跨天售后录音样例数据 |
| POST | `/api/batches/preview` | 预览批次处理影响范围 |
| POST | `/api/batches/execute` | 执行批量补偿处理 |
| GET | `/api/batches` | 查询所有批次列表 |
| GET | `/api/batches/{batch_no}/records` | 查询批次记录和人工修正 |
| GET | `/api/batches/{batch_no}/report/json` | 获取JSON格式报告 |
| GET | `/api/batches/{batch_no}/report/markdown` | 获取Markdown格式报告 |
| GET | `/api/batches/{batch_no}/report/download` | 下载报告文件 |
| POST | `/api/batches/{batch_no}/corrections` | 添加人工修正记录 |

## 项目结构

```
.
├── main.py           # 主程序 - FastAPI应用和API接口
├── models.py         # 数据模型 - SQLAlchemy ORM定义
├── schemas.py        # 模式定义 - Pydantic请求/响应模型
├── service.py        # 业务逻辑 - 核心处理函数
├── database.py       # 数据库配置
├── test_flow.py      # 完整流程测试脚本
├── requirements.txt  # 依赖列表
└── compensation.db   # SQLite数据库文件（自动生成）
```

## 数据模型

### Batch (批次)
- 批次号、来源类型、状态
- content_hash: 用于幂等性校验的内容哈希

### RecordingRecord (录音记录)
- 录音ID、客户ID、坐席ID
- 问题类型、通话时间、内容摘要
- is_mixed_source: 来源混杂标记
- 原始状态、补偿后状态、补偿金额

### CompensationResult (补偿结果)
- 结果类型、金额、原因、证据
- 单条记录执行时间

### ManualCorrection (人工修正)
- 操作人、修正类型、原值/修正值
- 处理依据（原因）

### ProcessingReport (处理报告)
- 总记录数、成功/失败数
- 总执行时间
- 处理前后状态对比
- 下一步建议

## 核心设计

### 幂等性实现
通过对批次所有记录计算SHA256哈希，相同内容的批次哈希一致，从而防止重复处理。

### 补偿规则引擎
```python
- refund_delay:      100元  退款延迟超过24小时
- quality_issue:     80元   商品质量问题
- miscommunication:  30元   客服传达错误
- billing_error:     150元  重复扣费错误
- delivery_delay:    20元   配送延迟
- mixed_source:      50元   来源混杂（部分补偿）
```

## 使用示例

### 1. 预览批次
```bash
curl -X POST "http://localhost:8000/api/batches/preview" \
  -H "Content-Type: application/json" \
  -d @sample_batch.json
```

### 2. 执行批量补偿
```bash
curl -X POST "http://localhost:8000/api/batches/execute" \
  -H "Content-Type: application/json" \
  -d @sample_batch.json
```

### 3. 下载Markdown报告
```bash
curl -O "http://localhost:8000/api/batches/BATCH-SAMPLE-001/report/download"
```
