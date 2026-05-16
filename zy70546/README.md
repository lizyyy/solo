# 数据血缘订阅API服务

报表字段变更后，下游团队只收到自己关心的血缘影响通知，替代聊天和表格推进流程。

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据
```bash
python init_data.py
```

### 3. 启动服务
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问: http://localhost:8000/docs 查看Swagger文档

## 核心数据模型

| 实体 | 说明 | 关键字段 |
|------|------|----------|
| BloodlineSubscription | 订阅配置 | team_name, field_pattern, table_pattern, report_pattern |
| BloodlineRelation | 血缘关系 | field_name, upstream_table, downstream_report, change_type |
| Notification | 通知记录 | status(PENDING/MATCHED/FILTERED/DEDUPLICATED/NOTIFIED/CONFIRMED/FAILED/MANUALLY_FIXED), match_reason, filter_reason |
| NotificationBatch | 处理批次 | batch_id, total_count, matched_count, filtered_count |
| FailureRecord | 失败记录 | original_input, processing_rules, error_message, final_conclusion |
| ImpactReport | 影响报告 | report_id, report_content, exported_count |

## 关键规则

1. **血缘匹配规则**: 使用通配符`*`匹配字段名称、上游表、下游报表
2. **订阅过滤规则**: 只匹配ACTIVE状态的订阅，不匹配的会标记为FILTERED
3. **通知去重规则**: 基于(字段+表+报表+团队+变更类型)MD5去重，避免重复通知
4. **状态流转规则**: PENDING → MATCHED → DEDUPLICATED → NOTIFIED → CONFIRMED

## API接口调用示例（curl）

### 订阅管理

#### 创建订阅
```bash
curl -X POST "http://localhost:8000/api/subscriptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "team_name": "营销分析团队",
    "contact_person": "赵六",
    "contact_email": "zhaoliu@company.com",
    "field_name_pattern": "*marketing*",
    "upstream_table_pattern": "dwd.marketing*",
    "downstream_report_pattern": "rpt_marketing_*",
    "notify_channels": {"email": true, "dingtalk": true}
  }'
```

#### 查询订阅列表
```bash
curl "http://localhost:8000/api/subscriptions/?team_name=财务报表团队"
```

### 血缘变更批量处理

#### 提交血缘变更批次（匹配成功场景）
```bash
curl -X POST "http://localhost:8000/api/notifications/batch-process" \
  -H "Content-Type: application/json" \
  -d '{
    "bloodline_relations": [
      {
        "field_name": "order_amount",
        "upstream_table": "ods.finance_order",
        "downstream_report": "rpt_finance_daily",
        "change_type": "修改",
        "change_description": "金额字段精度从2位改为4位"
      },
      {
        "field_name": "user_id",
        "upstream_table": "dwd.user_info",
        "downstream_report": "rpt_user_profile",
        "change_type": "新增",
        "change_description": "新增用户ID字段"
      }
    ],
    "batch_id": "batch_20240516_001"
  }'
```

### 查询通知

#### 查询某批次通知列表
```bash
curl "http://localhost:8000/api/notifications/?batch_id=batch_20240516_001"
```

#### 查询某团队待确认通知
```bash
curl "http://localhost:8000/api/notifications/?team_name=财务报表团队&status=notified"
```

### 状态推进

#### 标记为已通知
```bash
curl -X PUT "http://localhost:8000/api/notifications/1/status?target_status=notified"
```

#### 确认收到通知
```bash
curl -X POST "http://localhost:8000/api/notifications/1/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_by": "张三",
    "confirm_note": "已收到通知，正在评估影响"
  }'
```

### 异常处理与人工修正

#### 查询失败记录
```bash
curl "http://localhost:8000/api/notifications/failures/?batch_id=batch_20240516_001"
```

#### 人工修正失败通知
```bash
curl -X POST "http://localhost:8000/api/notifications/1/manual-fix" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "notified",
    "fixed_by": "管理员",
    "fix_note": "重试后通知成功",
    "final_conclusion": "网络问题导致，已手动补发"
  }'
```

### 报告导出

#### 生成影响报告
```bash
curl -X POST "http://localhost:8000/api/reports/generate?batch_id=batch_20240516_001&report_type=batch"
```

#### 导出Excel报告
```bash
curl -o report.xlsx "http://localhost:8000/api/reports/report_xxxxxx/export/excel"
```

#### 导出通知列表Excel
```bash
curl -o notifications.xlsx "http://localhost:8000/api/reports/export/notifications/excel?batch_id=batch_20240516_001"
```

## 被规则拦住的路径示例（FILTERED状态）

**场景1: 字段不匹配被过滤**
```bash
curl -X POST "http://localhost:8000/api/notifications/batch-process" \
  -H "Content-Type: application/json" \
  -d '{
    "bloodline_relations": [
      {
        "field_name": "product_name",
        "upstream_table": "ods.finance_order",
        "downstream_report": "rpt_finance_daily",
        "change_type": "修改"
      }
    ]
  }'
```
- 财务团队订阅的是`*amount*`字段
- `product_name`不匹配，通知状态变为`filtered`
- filter_reason: "字段不匹配: *amount* != product_name"

**场景2: 去重拦截被过滤**
```bash
# 第一次提交（正常匹配）
curl -X POST "http://localhost:8000/api/notifications/batch-process" \
  -H "Content-Type: application/json" \
  -d '{"bloodline_relations": [{"field_name": "order_amount", "upstream_table": "ods.finance_order", "downstream_report": "rpt_finance_daily", "change_type": "修改"}]}'

# 同一血缘第二次提交（被去重拦截）
curl -X POST "http://localhost:8000/api/notifications/batch-process" \
  -H "Content-Type: application/json" \
  -d '{"bloodline_relations": [{"field_name": "order_amount", "upstream_table": "ods.finance_order", "downstream_report": "rpt_finance_daily", "change_type": "修改"}]}'
```
- 第二次提交的同一血缘会被去重拦截
- filter_reason: "去重拦截: 同一团队同一血缘已通知过 (key: xxxxxxxx...)"

## 错误响应示例

所有接口错误响应格式统一，可直接看懂：
```json
{
  "error_code": "INVALID_TRANSITION",
  "error_message": "无法从 pending 转换到 confirmed",
  "error_details": {
    "valid_next_states": ["matched", "filtered", "failed"]
  },
  "timestamp": "2024-05-16T12:00:00"
}
```

## 项目结构
```
.
├── main.py                 # 主入口文件
├── database.py             # 数据库配置
├── models.py               # 数据模型
├── schemas.py              # API schema定义
├── bloodline_service.py    # 核心业务逻辑
├── routers/
│   ├── __init__.py
│   ├── subscriptions.py    # 订阅管理API
│   ├── notifications.py    # 通知管理API
│   └── reports.py          # 报告导出API
├── init_data.py            # 初始化数据脚本
├── requirements.txt        # 依赖清单
└── README.md               # 本文档
```
