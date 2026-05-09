# 信用卡分期撤销 API 后端工具链

## 项目概览

这是一套完整的信用卡分期撤销后端系统，专门解决以下场景的问题：
- 分期申请后客户申请撤销，已支付手续费如何退还
- 客户提前还款，剩余本金和手续费如何计算
- 额度恢复的准确性校验
- 边界数据的异常捕获和待处理任务机制

## 系统架构

### 核心模块

```
├── app/
│   ├── __init__.py          # Flask 应用工厂
│   ├── models.py            # 数据模型（8个核心表）
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # RESTful API 路由
│   └── services/
│       ├── __init__.py
│       ├── installment_service.py   # 分期计划服务
│       ├── revocation_service.py    # 撤销/提前还款服务
│       ├── validation_service.py    # 校验服务
│       ├── exception_service.py     # 异常/任务管理
│       └── export_service.py        # 导出服务
├── config.py                # 配置
├── requirements.txt         # 依赖
├── run.py                   # 启动入口
├── test_flow.py             # 集成测试脚本
└── SETUP.md                 # 本文档
```

### 数据模型

| 表名 | 用途 |
|------|------|
| accounts | 信用卡账户（额度管理） |
| installment_plans | 分期计划 |
| fee_amortizations | 手续费摊销表（每期明细） |
| installment_payments | 还款记录 |
| revocation_records | 撤销/提前还款记录 |
| bill_records | 账单流水（借贷记账） |
| exception_records | 异常记录 |
| pending_tasks | 待处理任务 |

---

## 从零开始的部署说明

### 1. 环境准备

确保系统已安装：
- Python 3.8+
- pip

### 2. 创建虚拟环境（推荐）

```bash
cd /Users/lzy/pro/solo/workspaces/zy70058

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

依赖清单：
- `flask` - Web 框架
- `flask-sqlalchemy` - ORM
- `openpyxl` - Excel 导出
- `python-dateutil` - 日期处理

### 4. 启动服务

```bash
python run.py
```

服务将监听 `http://localhost:5000`

首次启动会自动创建 SQLite 数据库文件 `creditcard.db`，并创建必要的目录：
- `exports/` - 导出文件存放
- `logs/` - 日志目录

---

## 快速上手 - 完整业务流程演示

打开新的终端，执行测试脚本：

```bash
# 安装测试依赖
pip install requests

# 运行测试
python test_flow.py
```

选择 `3` 进行完整测试，将演示两个完整业务场景：

### 场景一：创建分期 → 提前还款

1. 创建账户（信用额度 10 万）
2. 创建分期计划（1 万元分 3 期，月费率 0.6%）
3. 系统自动生成 3 期摊销表
4. 执行提前还款（客户主动提前结清）
5. 计算违约金（剩余本金的 3%）
6. 恢复额度（剩余本金部分）
7. 生成待处理任务（收取提前还款金额）

### 场景二：创建分期 → 客户撤销

1. 创建账户（信用额度 20 万）
2. 创建分期计划（5 万元分 6 期）
3. 客户后悔了，申请撤销
4. 系统计算应退还的本金和手续费
5. 全额恢复已占用的额度
6. 生成待处理任务（退款处理 + 收取未还本金）

---

## 核心 API 说明

### 基础路径
所有 API 都在 `http://localhost:5000/api/v1` 下

### 一、账户管理

#### 创建账户
```bash
POST /accounts
Content-Type: application/json

{
    "account_number": "ACC20250509001",
    "card_number": "6222****1234",
    "customer_name": "张三",
    "credit_limit": 100000.00,
    "used_credit": 0.00
}
```

#### 查询账户
```bash
GET /accounts/{account_id}
```

### 二、分期计划

#### 创建分期
```bash
POST /installments
Content-Type: application/json

{
    "account_id": 1,
    "original_transaction_id": "TXN20250509001",
    "original_amount": 10000.00,
    "installment_months": 3,
    "fee_rate": 0.006,
    "start_date": "2025-05-09"
}
```

**返回内容包含：**
- 分期计划基本信息
- 每期摊销明细（本金、手续费、期供、剩余本金）
- 自动计算：总手续费 = 本金 × 费率 × 期数

#### 查询分期详情
```bash
GET /installments/{plan_id}?include_amortizations=true
```

#### 查询账户的所有分期
```bash
GET /accounts/{account_id}/installments?status=active
```
状态可选：`active`（进行中）、`revoked`（已撤销）、`early_settled`（提前结清）、`completed`（正常完成）

### 三、撤销与提前还款

#### 分期撤销（客户后悔了）
```bash
POST /installments/{plan_id}/revoke
Content-Type: application/json

{
    "reason": "客户资金用途改变",
    "transaction_id": "REV20250509001"
}
```

**处理逻辑：**
1. 退还已支付的本金和手续费
2. 未还本金需向客户收取
3. 全额恢复已占用的信用额度
4. 自动生成账单流水
5. 创建待处理任务（退款 + 收费）

#### 提前还款
```bash
POST /installments/{plan_id}/early-settle
Content-Type: application/json

{
    "reason": "客户资金充裕",
    "transaction_id": "ES20250509001"
}
```

**处理逻辑：**
1. 收取剩余全部本金
2. 收取剩余手续费（部分银行会减免，当前实现全额收取）
3. 收取违约金：剩余本金 × 3%（可配置）
4. 恢复剩余本金对应的额度
5. 自动生成账单流水
6. 创建待处理任务

### 四、校验与审计

#### 摊销表校验
```bash
GET /validation/installments/{plan_id}/amortization
```

校验内容：
- 期数是否正确
- 每期本金之和是否等于总本金
- 每期手续费之和是否等于总手续费
- 剩余本金计算是否连续正确

#### 账单一致性校验
```bash
GET /validation/accounts/{account_id}/bills
```

校验内容：
- 每笔交易的余额计算是否正确
- 交易 ID 是否重复
- 账单周期是否正确

#### 还款链路校验
```bash
GET /validation/installments/{plan_id}/payment-chain
```

校验内容：
- 已还期数是否一致
- 剩余本金计算是否正确

#### 综合校验（推荐）
```bash
GET /validation/installments/{plan_id}/comprehensive
```

一次性执行所有校验项，返回整体结果。

### 五、异常记录

#### 查询异常
```bash
GET /exceptions?severity=critical&status=open

# 参数
- severity: critical/high/medium/low
- status: open/investigating/resolved/ignored
- limit/offset: 分页
```

#### 更新异常状态
```bash
PUT /exceptions/{exception_id}
Content-Type: application/json

{
    "status": "resolved",
    "notes": "已确认是数据问题，已修正",
    "investigation_notes": "排查发现是摊销表生成时的四舍五入问题"
}
```

#### 异常统计
```bash
GET /exceptions/stats
```

### 六、待处理任务

#### 查询待处理任务
```bash
GET /pending-tasks?status=pending

# 任务类型
- credit_restore: 额度恢复
- refund_process: 退款处理
- fee_adjustment: 手续费调整
- bill_correction: 账单修正
- manual_review: 人工调查
```

#### 更新任务状态
```bash
PUT /pending-tasks/{task_id}
Content-Type: application/json

{
    "status": "completed",
    "error_message": null
}
```

#### 任务统计
```bash
GET /pending-tasks/stats
```

#### 重试失败任务
```bash
POST /pending-tasks/retry
Content-Type: application/json

{
    "task_type": "refund_process"
}
```

### 七、报表与导出

#### 撤销汇总
```bash
GET /reports/revocation-summary?start_date=2025-01-01&end_date=2025-12-31
```

#### 导出撤销记录（Excel）
```bash
GET /exports/revocation-report?start_date=2025-01-01&end_date=2025-12-31
```

**导出内容（服务于业务复核）：**
- Sheet1「撤销汇总」：按类型统计数量、总退款、总违约金、总待收、总额度恢复
- Sheet2「明细详情」：每笔撤销的完整信息（17 列业务字段）

#### 导出异常记录（Excel）
```bash
GET /exports/exception-report?severity=critical
```

**导出内容：**
- Sheet1「异常汇总」：按严重级别统计
- Sheet2「明细详情」：异常类型、严重级别、状态、检测时间等

#### 导出待处理任务（Excel）
```bash
GET /exports/pending-tasks-report?status=pending
```

**导出内容：**
- Sheet1「任务汇总」：按类型统计各状态数量
- Sheet2「明细详情」：任务类型、状态、重试次数、最后错误等

---

## 业务规则说明

### 手续费计算规则

**公式：**
- 总手续费 = 分期本金 × 月费率 × 分期期数
- 每期手续费 = 总手续费 / 分期期数（最后一期找平）
- 每期本金 = 分期本金 / 分期期数（最后一期找平）

**示例：** 1 万元分 3 期，月费率 0.6%
- 总手续费 = 10000 × 0.006 × 3 = 180 元
- 每期手续费 = 60 元
- 每期本金 = 3333.33 元（最后一期 3333.34 元）
- 每期期供 = 3393.33 元

### 提前还款规则

- 违约金 = 剩余本金 × 3%（可在 config.py 中配置 `EARLY_REPAYMENT_FEE_RATE`）
- 额度恢复金额 = 剩余本金
- 需收取：剩余本金 + 剩余手续费 + 违约金

### 分期撤销规则

- 退款金额 = 已支付本金 + 已支付手续费
- 待收金额 = 未还本金
- 额度恢复金额 = 原始分期本金（全额恢复）

### 边界数据处理

**所有异常都不会静默吞掉：**

1. **校验失败** → 自动写入 `exception_records` 表
2. **高/严重级别异常** → 自动创建 `manual_review` 待处理任务
3. **撤销/提前还款** → 自动创建退款/收费待处理任务
4. **任务失败** → 记录 `last_error`，可重试 3 次

### 配置项（config.py）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| MAX_INSTALLMENT_MONTHS | 24 | 最大分期期数 |
| DEFAULT_FEE_RATE | 0.006 | 默认月费率（0.6%） |
| EARLY_REPAYMENT_FEE_RATE | 0.03 | 提前还款违约金率（3%） |
| MAX_EXCEPTION_AGE_DAYS | 30 | 异常记录保留天数 |

---

## 手动测试 curl 示例

### 1. 健康检查
```bash
curl http://localhost:5000/api/v1/health
```

### 2. 创建账户
```bash
curl -X POST http://localhost:5000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "ACC20250509001",
    "card_number": "6222****1234",
    "customer_name": "张三",
    "credit_limit": 100000.00,
    "used_credit": 0.00
  }'
```

### 3. 创建分期（复制 account_id）
```bash
curl -X POST http://localhost:5000/api/v1/installments \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": 1,
    "original_transaction_id": "TXN20250509001",
    "original_amount": 10000.00,
    "installment_months": 3,
    "fee_rate": 0.006,
    "start_date": "2025-05-09"
  }'
```

### 4. 查看分期详情
```bash
curl "http://localhost:5000/api/v1/installments/1?include_amortizations=true"
```

### 5. 提前还款（复制 plan_id）
```bash
curl -X POST http://localhost:5000/api/v1/installments/1/early-settle \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "客户资金充裕，主动提前结清",
    "transaction_id": "ES20250509001"
  }'
```

### 6. 执行综合校验
```bash
curl http://localhost:5000/api/v1/validation/installments/1/comprehensive
```

### 7. 查看待处理任务
```bash
curl http://localhost:5000/api/v1/pending-tasks
```

### 8. 导出撤销记录 Excel
```bash
curl -O http://localhost:5000/api/v1/exports/revocation-report
```

---

## 扩展建议

### 可扩展的功能点

1. **接口层**
   - 添加用户认证（JWT）
   - 添加接口限流
   - 添加请求日志

2. **业务层**
   - 支持部分分期撤销
   - 支持手续费减免策略配置
   - 添加罚息计算
   - 支持多币种

3. **数据层**
   - 迁移到 PostgreSQL/MySQL
   - 添加数据库连接池
   - 添加数据迁移工具（Alembic）

4. **运维层**
   - 添加监控指标（Prometheus）
   - 添加健康检查探针
   - 添加告警机制

### 代码扩展约定

- 新增服务放在 `app/services/` 目录
- 新增 API 路由放在 `app/api/routes.py`
- 新增数据模型放在 `app/models.py`
- 使用 `ExceptionService` 记录异常
- 使用 `PendingTask` 处理异步任务

---

## 常见问题

### Q: 如何重置数据库？
A: 删除 `creditcard.db` 文件，重启服务即可。

### Q: 导出的 Excel 文件在哪里？
A: 在项目根目录的 `exports/` 文件夹中，文件名带时间戳。

### Q: 如何修改违约金率？
A: 编辑 `config.py` 中的 `EARLY_REPAYMENT_FEE_RATE`。

### Q: 如何查看数据库内容？
A: 使用 SQLite 工具打开 `creditcard.db`，如 `DB Browser for SQLite`。

---

## 联系

项目演示用，生产环境使用前请仔细评估并进行充分测试。
