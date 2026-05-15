# 事件收敛器后端服务

基于 FastAPI + SQLAlchemy 实现的事件收敛处理系统，专门针对高峰药房配送回执等场景。

## 核心功能

### 1. 空值处理与收敛逻辑
- 将 `None` 和空字符串状态按规则判定为失败或待审核
- 保留每条明细的处理轨迹
- 支持部分成功场景，不整批标记成功

### 2. 报告生成
- 处理前后状态对比
- 执行时间统计
- 自动生成下一步建议

### 3. 规则版本控制
- 多版本规则管理
- 旧批次可追溯当时的判断口径
- 规则变更审计日志

### 4. 数据持久化
- 本地重启后历史数据可查询
- SQLite数据库存储

### 5. 重复批次检测
- 同一批内容再次提交自动复用旧结论
- 冲突检测与提示

### 6. 外包验收单管理
- 记录修正前后的值
- 按风险等级查询

### 7. 合并事件追溯
- 合并事件可反查原始事件

## 项目结构

```
.
├── main.py                 # FastAPI主应用，API接口定义
├── models.py               # 数据库模型定义
├── schemas.py              # Pydantic数据模型
├── event_converger.py      # 核心收敛逻辑
├── repository.py           # 数据访问层
├── test_event_converger.py # 测试用例
├── requirements.txt        # 依赖列表
└── README.md             # 项目文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000

### 3. 查看API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试

```bash
python test_event_converger.py
```

## API接口列表

### 批次管理
- `POST /api/batches/submit` - 提交事件批次进行收敛处理
- `GET /api/batches` - 获取所有批次列表
- `GET /api/batches/{batch_id}` - 获取批次详情
- `GET /api/batches/{batch_id}/report` - 获取批次处理报告
- `GET /api/batches/{batch_id}/export` - 导出批次处理结果

### 事件查询
- `GET /api/events/{event_id}` - 获取事件详情（含被合并的原始事件）
- `GET /api/events/risk/{risk_level}` - 按风险等级查询事件

### 规则管理
- `GET /api/rules` - 获取所有收敛规则版本
- `GET /api/rules/active` - 获取当前活跃的收敛规则
- `POST /api/rules` - 创建新的收敛规则版本
- `PUT /api/rules/{version}` - 更新指定版本的收敛规则

### 外包验收单
- `GET /api/outsourcing/risk/{risk_level}` - 按风险等级查询外包验收记录

### 审计日志
- `GET /api/audit-logs` - 获取审计日志
- `GET /api/audit-logs/rules/{version}` - 获取指定规则版本的变更历史

## 数据模型

### Event（事件）
- event_id: 事件ID
- original_data: 原始数据
- raw_status: 原始状态
- final_status: 最终状态
- risk_level: 风险等级 (high/medium/low)
- risk_score: 风险分数
- is_merged: 是否已合并
- merged_into_event_id: 合并到的事件ID
- corrections: 修正记录

### EventBatch（事件批次）
- batch_id: 批次ID
- batch_hash: 批次内容哈希（用于去重）
- source: 来源系统
- rule_version: 使用的规则版本
- processing_status: 处理状态
- processing_duration_ms: 处理耗时

### ConvergenceRule（收敛规则）
- version: 规则版本
- rule_name: 规则名称
- success_conditions: 成功条件
- failure_conditions: 失败条件
- risk_weightings: 风险权重
- is_active: 是否活跃

### ProcessingReport（处理报告）
- before_summary: 处理前摘要
- after_summary: 处理后摘要
- comparison_details: 对比详情
- next_steps: 下一步建议
- summary_stats: 统计摘要
- execution_time_ms: 执行时间

### OutsourcingAcceptance（外包验收单）
- original_value: 原始值
- corrected_value: 修正后值
- correction_reason: 修正原因
- risk_level: 风险等级

## 示例请求

### 提交批次

```json
{
  "batch_id": "BATCH-20240101",
  "source": "高峰药房配送系统",
  "description": "2024年1月1日配送回执",
  "events": [
    {
      "event_id": "EVT-001",
      "original_data": {
        "order_id": "ORD-001",
        "pharmacy_id": "PHARM-001",
        "delivery_status": null,
        "receipt_status": ""
      }
    }
  ]
}
```

## 默认规则说明

默认规则 v1.0.0 配置:

- 成功状态值: success, completed, delivered, 已完成, 已送达
- 失败状态值: failed, cancelled, returned, 失败, 取消, 退回
- 空值处理: 判定为失败，高风险
- 未知状态: 待人工审核，中风险

数据库文件: `event_converger.db`
