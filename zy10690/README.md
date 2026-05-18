# 模型服务网关推理队列优先级调整 API

## 项目概述

本系统提供完整的推理队列优先级调整管理能力，避免运维直接修改队列配置，通过规范化的申请-审批-生效-恢复流程实现优先级调整。

## 核心功能

- **优先级调整申请**: 提交模型、租户、队列信息和调整理由
- **风险拦截**: 自动检测低优先级任务误提升，进入复核流程
- **审批流程**: 支持审批/拒绝，记录审批意见
- **生效与恢复**: 控制调整生效时间，支持手动恢复
- **历史追踪**: 完整记录所有操作历史
- **报表导出**: 导出包含等待时间和处理结论的 Excel 报表

## 技术栈

- Python 3.8+
- FastAPI 0.104.1
- Pydantic 2.5.0
- pandas + openpyxl (报表导出)
- pytest (自动化测试)

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口说明

### 1. 申请队列优先级调整

**输入**:
```json
POST /api/v1/priority
{
  "model_name": "gpt-3.5-turbo",      // 模型名称
  "tenant_id": "tenant_001",          // 租户ID
  "queue_name": "inference_normal",   // 队列名称
  "original_priority": 5,             // 原优先级 (1-10)
  "target_priority": 3,               // 目标优先级 (1-10)
  "reason": "紧急业务需求",            // 调整理由
  "applicant": "user1",               // 申请人
  "restore_hours": 4                  // 自动恢复时间(小时)
}
```

**处理**:
- 生成唯一记录ID
- 自动风险检测
- 状态设为 `pending` (待审批)
- 记录操作历史

**输出**:
```json
{
  "id": "uuid-string",
  "model_name": "gpt-3.5-turbo",
  "tenant_id": "tenant_001",
  "queue_name": "inference_normal",
  "original_priority": 5,
  "target_priority": 3,
  "reason": "紧急业务需求",
  "applicant": "user1",
  "status": "pending",
  "review_comment": "风险提示...",
  "created_at": "2024-01-01T10:00:00",
  "restore_at": "2024-01-01T14:00:00"
}
```

### 2. 查询优先级调整列表

```bash
GET /api/v1/priority?status=pending&tenant_id=tenant_001
```

### 3. 审批优先级调整申请

**输入**:
```json
POST /api/v1/priority/{record_id}/review
{
  "reviewer": "admin1",              // 审批人
  "approved": true,                  // 是否通过
  "comment": "同意提权"               // 审批意见
}
```

**处理**:
- 校验记录状态必须为 `pending`
- 高风险申请自动添加风险提示
- 状态更新为 `approved` 或 `rejected`

**输出**: 更新后的记录详情

### 4. 生效优先级调整

```bash
POST /api/v1/priority/{record_id}/apply
```

**处理**:
- 校验状态必须为 `approved`
- **风险拦截**: 高风险申请(如优先级从9→1)会被拦截，提示进入复核流程
- 状态更新为 `active`
- 计算并记录等待时间
- 记录生效时间

**输出**: 生效后的记录详情

### 5. 恢复队列优先级

**输入**:
```json
POST /api/v1/priority/{record_id}/restore
{
  "restorer": "user1",               // 恢复操作人
  "reason": "任务完成"                // 恢复理由
}
```

**处理**:
- 校验状态必须为 `active`
- 状态更新为 `restored`
- 记录恢复结论

### 6. 查看操作历史

```bash
GET /api/v1/priority/{record_id}/history
```

**输出**:
```json
{
  "record_id": "uuid-string",
  "history": [
    {
      "action": "created",
      "detail": "申请创建: 紧急业务需求",
      "timestamp": "2024-01-01 10:00:00"
    },
    {
      "action": "approved",
      "detail": "审批通过: 同意提权",
      "timestamp": "2024-01-01 10:05:00"
    }
  ]
}
```

### 7. 风险检测

```bash
GET /api/v1/priority/{record_id}/risk
```

**输出**:
```json
{
  "risk_level": "high",              // low/medium/high
  "messages": ["低优先级任务被大幅提升..."],
  "needs_review": true
}
```

### 8. 导出队列优先级报表

```bash
# JSON 格式
GET /api/v1/report/priority

# Excel 格式 (下载文件)
GET /api/v1/report/priority/export
```

**报表字段说明**:
| 字段 | 说明 |
|------|------|
| id | 记录ID(前8位) |
| model_name | 模型名称 |
| tenant_id | 租户ID |
| queue_name | 队列名称 |
| original_priority | 原优先级 |
| target_priority | 目标优先级 |
| reason | 调整理由 |
| applicant | 申请人 |
| status | 状态 |
| reviewer | 审批人 |
| created_at | 创建时间 |
| applied_at | 生效时间 |
| restored_at | 恢复时间 |
| wait_time_seconds | **等待时间(秒)** |
| conclusion | **处理结论** |

## 状态流转

```
normal (普通排队)
    ↓ 申请提权
pending (优先申请-待审批)
    ↓ 审批通过/拒绝
approved (已审批) / rejected (已拒绝)
    ↓ 生效
active (已生效)
    ↓ 恢复
restored (已恢复)
```

## 风险拦截规则

系统自动检测以下高风险场景并进行拦截：

1. **大幅提权**: 原优先级 ≥7 且 目标优先级 ≤3
2. **高优先级过载**: 系统中已有 ≥3 个活跃的高优先级队列
3. **测试租户高优先级**: 测试租户使用优先级 ≤3

拦截时返回 `403 Forbidden`，提示需进入复核流程。

## 样例数据

系统启动时自动加载4条样例数据，覆盖所有状态：

| 类型 | 状态 | 说明 |
|------|------|------|
| normal | normal | 普通排队 |
| pending | pending | 优先申请-待审批 |
| active | active | 已生效 |
| restored | restored | 已恢复 |

## 测试说明

### 测试分类

1. **正常记录测试** (`TestNormalFlow`): 验证完整的正常流程
2. **异常记录测试** (`TestAbnormalFlow`): 验证异常场景处理
3. **重复运行测试** (`TestDuplicateOperations`): 验证幂等性和防重复

### 运行测试

```bash
# 运行所有测试
pytest tests/test_priority_api.py -v

# 运行特定测试类
pytest tests/test_priority_api.py::TestNormalFlow -v

# 生成测试报告
pytest tests/test_priority_api.py -v --html=test_report.html
```

### 测试用例清单

**正常流程测试**:
- ✅ 健康检查
- ✅ 创建优先级调整申请
- ✅ 查询列表
- ✅ 审批申请
- ✅ 生效调整
- ✅ 恢复优先级
- ✅ 查看操作历史
- ✅ 导出报表

**异常流程测试**:
- ✅ 非法优先级值校验 (1-10范围)
- ✅ 审批不存在的记录
- ✅ 未审批直接生效
- ✅ 高风险提权被拦截
- ✅ 风险检测接口

**重复操作测试**:
- ✅ 重复审批同一记录
- ✅ 重复生效同一记录
- ✅ 恢复未生效的记录

## 手动复核指南

当遇到高风险调整被拦截时，按以下步骤复核：

1. 调用 `GET /api/v1/priority/{record_id}/risk` 查看风险详情
2. 检查申请理由的合理性和紧急程度
3. 评估对线上租户的影响
4. 如需通过，需两名管理员共同审批(可扩展功能)

## 目录结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主应用
│   ├── models.py            # 数据模型定义
│   ├── database.py          # 数据库操作和业务逻辑
│   └── sample_data.py       # 样例数据
├── tests/
│   ├── __init__.py
│   └── test_priority_api.py # 测试用例
├── requirements.txt         # 依赖列表
└── README.md               # 本文档
```

## 常见问题

### Q: 如何修改风险检测规则？
A: 修改 `app/database.py` 中 `check_priority_risk()` 方法的检测逻辑。

### Q: 数据如何持久化？
A: 当前使用内存存储，可扩展为 SQLite/Redis/PostgreSQL。

### Q: 如何集成到现有网关系统？
A: 1. 通过 API 调用本服务 2. 将生效/恢复事件推送到消息队列 3. 网关消费事件调整队列。

## License

MIT
