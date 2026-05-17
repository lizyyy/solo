# 试工排期押金转正结论后端API

家政公司试工管理系统，完整覆盖客户需求、阿姨档案、试工排期、押金流水、评价记录、转正结论全流程。

## 技术栈

- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite
- pytest

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI主应用
│   ├── models.py        # 数据库模型
│   ├── schemas.py       # Pydantic数据模型
│   ├── business_rules.py # 核心业务规则
│   └── database.py      # 数据库配置
├── tests/
│   ├── __init__.py
│   ├── conftest.py      # pytest配置
│   └── test_main.py     # 测试用例
├── seed_data.py         # 造数脚本
├── requirements.txt     # 依赖
├── pyproject.toml       # pytest配置
└── README.md
```

## 核心数据模型

1. **CustomerDemand (客户需求)** - 客户的家政服务需求
2. **AuntProfile (阿姨档案)** - 家政服务人员的基本信息
3. **TrialSchedule (试工排期)** - 阿姨的试工安排
4. **Deposit (押金流水)** - 试工押金的支付和退款记录
5. **Review (评价记录)** - 客户对试工的评价
6. **Conversion (转正结论)** - 试工后的转正决策

## 核心业务规则

### 1. 排期冲突检测
- 创建或更新试工排期时，自动检测阿姨是否有时间冲突
- 支持时间部分重叠的冲突检测

### 2. 押金状态管理
- PENDING: 待支付
- PAID: 已支付
- REFUNDED: 已退款
- CONVERTED: 已转为合同定金

### 3. 评价复核流程
- 试工完成后才能提交评价
- 评价需要复核，支持通过/拒绝状态

### 4. 转正状态机
- PENDING → ELIGIBLE / NOT_ELIGIBLE / CLOSED
- ELIGIBLE → CONVERTED / REJECTED / CLOSED
- NOT_ELIGIBLE → CLOSED

### 5. 转正资格检查
- 试工必须已完成
- 必须有已通过的评价
- 综合评分 >= 3分
- 押金必须已支付

### 6. 审计日志
- 所有关键操作都记录审计日志
- 保存原始输入、操作人、处理结论

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问 http://localhost:8000/docs 查看API文档

### 3. 造数

```bash
python seed_data.py
```

会创建测试数据，包括：
- 3个客户需求
- 3个阿姨档案
- 2个试工排期
- 2条押金记录
- 1条评价记录
- 1条转正记录

### 4. 运行测试

```bash
pytest tests/ -v
```

## API 接口示例 (curl)

### 客户需求

```bash
# 创建客户需求
curl -X POST "http://localhost:8000/customer-demands/" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "address": "北京市朝阳区",
    "service_type": "住家保姆",
    "required_skills": "做饭,打扫",
    "salary_expectation": 6000.0,
    "work_time": "住家",
    "remarks": "需要健康证"
  }'

# 查询客户需求列表
curl "http://localhost:8000/customer-demands/"

# 查询单个客户需求
curl "http://localhost:8000/customer-demands/1"

# 更新客户需求
curl -X PUT "http://localhost:8000/customer-demands/1" \
  -H "Content-Type: application/json" \
  -d '{"salary_expectation": 7000.0}'

# 关闭客户需求
curl -X POST "http://localhost:8000/customer-demands/1/close" \
  -H "Content-Type: application/json" \
  -d '{"reason": "客户取消需求", "closed_by": "admin"}'
```

### 阿姨档案

```bash
# 创建阿姨档案
curl -X POST "http://localhost:8000/aunt-profiles/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王阿姨",
    "phone": "13900139001",
    "id_card": "110101198001011234",
    "age": 44,
    "experience_years": 8,
    "skills": "做饭,打扫,照顾老人",
    "certificates": "健康证",
    "address": "河北省石家庄市"
  }'

# 查询阿姨列表
curl "http://localhost:8000/aunt-profiles/"
```

### 试工排期

```bash
# 创建试工排期
curl -X POST "http://localhost:8000/trial-schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "demand_id": 1,
    "aunt_id": 1,
    "trial_start_time": "2024-06-15T09:00:00",
    "trial_end_time": "2024-06-17T18:00:00",
    "trial_address": "客户地址",
    "trial_fee": 300.0,
    "created_by": "admin",
    "remarks": "第一次试工"
  }'

# 查询试工排期列表
curl "http://localhost:8000/trial-schedules/"

# 完成试工
curl -X POST "http://localhost:8000/trial-schedules/1/complete"

# 取消试工
curl -X POST "http://localhost:8000/trial-schedules/1/cancel" \
  -H "Content-Type: application/json" \
  -d '{"reason": "客户临时有事", "cancelled_by": "admin"}'
```

### 押金管理

```bash
# 创建押金记录
curl -X POST "http://localhost:8000/deposits/" \
  -H "Content-Type: application/json" \
  -d '{
    "trial_schedule_id": 1,
    "amount": 500.0,
    "payment_method": "微信",
    "transaction_id": "WX20240601001",
    "created_by": "admin"
  }'

# 支付押金
curl -X POST "http://localhost:8000/deposits/1/pay"

# 退款押金
curl -X POST "http://localhost:8000/deposits/1/refund?reason=客户取消试工&operator=admin"
```

### 评价记录

```bash
# 创建评价（试工必须已完成）
curl -X POST "http://localhost:8000/reviews/" \
  -H "Content-Type: application/json" \
  -d '{
    "trial_schedule_id": 1,
    "reviewer": "张三",
    "overall_rating": 5,
    "skill_rating": 5,
    "attitude_rating": 5,
    "punctuality_rating": 4,
    "hygiene_rating": 5,
    "communication_rating": 5,
    "comment": "阿姨非常专业，做饭好吃，打扫干净",
    "suggestion": "希望能尽快转正"
  }'

# 复核评价
curl -X POST "http://localhost:8000/reviews/1/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewed_by": "主管",
    "review_comment": "评价真实有效"
  }'
```

### 转正管理

```bash
# 检查转正资格
curl -X POST "http://localhost:8000/conversions/check-eligibility?trial_schedule_id=1"

# 创建转正记录
curl -X POST "http://localhost:8000/conversions/" \
  -H "Content-Type: application/json" \
  -d '{
    "trial_schedule_id": 1,
    "contract_salary": 8000.0
  }'

# 转正决策
curl -X POST "http://localhost:8000/conversions/1/decision" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "converted",
    "decided_by": "经理",
    "conclusion": "符合转正条件，同意签订合同",
    "contract_start_date": "2024-07-01T00:00:00",
    "contract_end_date": "2025-06-30T00:00:00",
    "contract_salary": 8500.0
  }'

# 撤回转正
curl -X POST "http://localhost:8000/conversions/1/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"reason": "客户反悔", "withdrawn_by": "admin"}'
```

### 人工修正

```bash
curl -X POST "http://localhost:8000/manual-correction/" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "customer_demand",
    "entity_id": 1,
    "corrected_data": {
      "salary_expectation": 7500.0,
      "remarks": "客户要求调整薪资"
    },
    "corrected_by": "管理员",
    "correction_reason": "客户要求调整薪资预期"
  }'
```

支持的实体类型：
- `customer_demand`: 客户需求
- `aunt_profile`: 阿姨档案
- `trial_schedule`: 试工排期
- `deposit`: 押金
- `review`: 评价
- `conversion`: 转正

### 审计日志

```bash
# 查询审计日志
curl "http://localhost:8000/audit-logs/"

# 按实体类型过滤
curl "http://localhost:8000/audit-logs/?entity_type=trial_schedule"

# 按操作类型过滤
curl "http://localhost:8000/audit-logs/?operation_type=manual_correction"
```

### 数据导出

```bash
# 导出试工排期CSV
curl "http://localhost:8000/export/trial-schedules/" -o trial_schedules.csv

# 导出转正记录CSV
curl "http://localhost:8000/export/conversions/" -o conversions.csv
```

## 异常路径示例

### 1. 排期冲突

创建排期时，如果阿姨在该时间段已有安排，会返回400错误：

```bash
# 先创建第一个排期
curl -X POST "http://localhost:8000/trial-schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "demand_id": 1,
    "aunt_id": 1,
    "trial_start_time": "2024-06-15T09:00:00",
    "trial_end_time": "2024-06-17T18:00:00",
    "created_by": "admin"
  }'

# 尝试创建冲突的排期（会失败）
curl -X POST "http://localhost:8000/trial-schedules/" \
  -H "Content-Type: application/json" \
  -d '{
    "demand_id": 2,
    "aunt_id": 1,
    "trial_start_time": "2024-06-16T09:00:00",
    "trial_end_time": "2024-06-18T18:00:00",
    "created_by": "admin"
  }'
```

返回结果：
```json
{
  "detail": "阿姨排期冲突: ID:1 2024-06-15T09:00:00~2024-06-17T18:00:00"
}
```

### 2. 试工未完成不能提交评价

```bash
curl -X POST "http://localhost:8000/reviews/" \
  -H "Content-Type: application/json" \
  -d '{
    "trial_schedule_id": 1,
    "reviewer": "张三",
    "overall_rating": 5,
    "skill_rating": 5,
    "attitude_rating": 5,
    "punctuality_rating": 5,
    "hygiene_rating": 5,
    "communication_rating": 5
  }'
```

返回结果：
```json
{
  "detail": "试工未完成，无法提交评价"
}
```

### 3. 不符合转正条件

```bash
curl -X POST "http://localhost:8000/conversions/check-eligibility?trial_schedule_id=1"
```

可能的返回结果：
```json
{
  "eligible": false,
  "message": "综合评分低于3分，不符合转正条件"
}
```

## 状态流转图

### 客户需求状态
```
pending → matching → trial_scheduled → completed → closed
```

### 阿姨状态
```
available → on_trial → working
            ↓
          inactive
```

### 试工排期状态
```
scheduled → in_progress → completed
     ↓
  cancelled
```

### 押金状态
```
pending → paid → refunded
              ↓
            converted
```

### 评价状态
```
draft → submitted → reviewing → approved
                            ↓
                          rejected
```

### 转正状态
```
pending → eligible → converted
     ↓        ↓
not_eligible rejected
     ↓        ↓
       closed
```

## 开发说明

### 添加新的业务规则

在 `app/business_rules.py` 中添加新的规则函数，然后在 `app/main.py` 的对应接口中调用。

### 添加新的实体类型

1. 在 `app/models.py` 中添加模型
2. 在 `app/schemas.py` 中添加Pydantic模型
3. 在 `app/business_rules.py` 中添加人工修正支持（如果需要）
4. 在 `app/main.py` 中添加API接口

### 审计日志

所有关键操作都应调用 `create_audit_log()` 函数记录审计日志，确保所有操作可追溯。

## License

MIT
