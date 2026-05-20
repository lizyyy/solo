# 院线对账服务

一个完整的后端对账系统，用于院线核对场次CSV、票房JSON和合同规则，支持自动比对、人工复核、重新计算和报告导出。

## 功能特性

### 1. 数据管理
- **影片合同管理**：支持创建、查询、更新、停用合同
- **场次CSV导入**：批量导入排片信息，自动识别跨日场次
- **票房JSON导入**：批量导入票房数据，包含退票、服务费等

### 2. 核心对账引擎
- **自动匹配**：按场次编号自动匹配场次与票房数据
- **补贴计算**：支持按票补贴、单日补贴上限、总补贴上限
- **退票扣减**：按合同费率自动计算退票损失
- **最低票房验证**：检查是否达到最低票房承诺
- **跨日场次识别**：自动识别并标记跨日场次

### 3. 人工复核流程
- 差异标记：自动识别有差异的记录
- 状态流转：待处理 → 已匹配 → 有争议 → 已核准/已拒绝
- 金额调整：支持手动调整各项金额
- 差异说明：记录复核意见和原因解释
- 操作日志：完整记录所有复核操作

### 4. 数据同步与重新计算
- 复核修改后自动更新汇总数据
- 支持批量重新计算整个批次
- 差异来源追踪和解释

### 5. 报告导出
- 支持 CSV 和 Excel (xlsx) 格式
- 包含汇总信息和明细数据
- 按状态颜色标记（已匹配=绿色，待复核=黄色，已拒绝=红色）
- 包含差异说明和复核备注

## 项目结构

```
.
├── main.py                  # FastAPI 主应用入口
├── database.py              # 数据库连接配置
├── models.py                # SQLAlchemy 数据模型
├── schemas.py               # Pydantic 数据结构
├── reconciliation_engine.py # 核心对账逻辑引擎
├── requirements.txt         # Python 依赖
├── api/
│   ├── __init__.py
│   ├── sessions.py          # 场次管理 API
│   ├── boxoffice.py         # 票房管理 API
│   ├── contracts.py         # 合同管理 API
│   ├── reconciliation.py    # 对账与复核 API
│   └── reports.py           # 报告导出 API
├── sample_data.py           # 样例数据生成器
└── init_demo.py             # 演示初始化脚本
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成样例数据

```bash
python sample_data.py
```

将生成以下文件：
- `sample_contract.json` - 影片合同样例
- `sample_sessions.csv` - 场次排片样例（含1场跨日场次）
- `sample_boxoffice.json` - 票房数据样例
- `init_demo.py` - 自动化演示脚本

### 3. 启动服务

```bash
uvicorn main:app --reload
```

服务将在 http://localhost:8000 启动

### 4. 运行演示

```bash
python init_demo.py
```

演示将依次执行：
1. 创建影片合同（流浪地球3）
2. 导入4场排片（含1场23:00开始的跨日场次）
3. 导入对应票房数据
4. 执行自动对账（将产生需要复核的差异记录）
5. 展示对账记录列表
6. 模拟人工复核流程
7. 导出Excel对账报告

### 5. 访问API文档

打开浏览器访问：http://localhost:8000/docs

## API 接口说明

### 合同管理 (`/api/contracts`)
- `POST /` - 创建新合同
- `GET /` - 查询合同列表
- `GET /{id}` - 获取单个合同
- `PUT /{id}` - 更新合同
- `DELETE /{id}` - 停用合同

### 场次管理 (`/api/sessions`)
- `POST /import` - 导入场次CSV文件
- `GET /` - 查询场次列表
- `GET /{id}` - 获取单场次

### 票房管理 (`/api/boxoffice`)
- `POST /import` - 导入票房JSON文件
- `GET /` - 查询票房记录
- `GET /{id}` - 获取单条票房记录

### 对账管理 (`/api/reconciliation`)
- `POST /run` - 执行自动对账
- `GET /records` - 查询对账记录
- `GET /records/{id}` - 获取单条对账记录
- `POST /records/{id}/review` - 人工复核
- `GET /summaries` - 查询对账汇总
- `POST /recalculate/{batch_id}` - 重新计算批次

### 报告导出 (`/api/reports`)
- `GET /export/{batch_id}?format={csv|xlsx}` - 导出对账报告

## 对账逻辑说明

### 差异类型
1. **跨日场次**：放映结束时间跨越自然日
2. **补贴上限**：达到单日或累计补贴上限
3. **退票扣减**：产生退票损失
4. **最低票房**：未达到最低票房承诺
5. **票价不匹配**：场次票价与实际不一致
6. **上座率不匹配**：预售与实际售票差异

### 计算规则
```
预期补贴 = min(售票数 × 单票补贴, 当日剩余额度, 总剩余额度)
补贴差异 = 实际补贴 - 预期补贴

退票扣减 = 退票金额 × 退票费率

票房缺口 = 最低票房承诺 - 实际票房（如未达标）

总差异 = 补贴差异 + 票房缺口 + 退票扣减
```

### 样例数据中的差异场景
- **跨日场次**：5月15日23:00开场，结束于次日凌晨，触发跨日标记
- **退票扣减**：10张退票 × 45元 × 5% = 22.5元
- **最低票房**：单场票房未达到单场分摊的最低承诺

## 数据库表结构

- `film_contracts` - 影片合同表
- `sessions` - 场次表
- `boxoffice_records` - 票房记录表
- `reconciliation_records` - 对账记录表
- `review_logs` - 复核操作日志
- `reconciliation_summaries` - 对账汇总表

## 数据文件格式

### 场次 CSV 格式
```csv
session_code,film_name,film_code,hall_name,show_time,end_time,scheduled_seats,ticket_price
LDLQ-20240515-001,流浪地球3,LDLQ-2024-001,1号厅,2024-05-15 10:00:00,2024-05-15 12:15:00,150,45
```

### 票房 JSON 格式
```json
{
  "records": [
    {
      "session_code": "LDLQ-20240515-001",
      "film_name": "流浪地球3",
      "film_code": "LDLQ-2024-001",
      "show_time": "2024-05-15 10:00:00",
      "tickets_sold": 145,
      "tickets_refunded": 5,
      "gross_boxoffice": 6525,
      "refund_amount": 225,
      "net_boxoffice": 6300,
      "service_fee": 435
    }
  ]
}
```

## 合同配置参数

| 参数 | 说明 | 样例值 |
|------|------|--------|
| subsidy_per_ticket | 单张票补贴金额 | 5元 |
| subsidy_daily_cap | 单日补贴上限 | 10000元 |
| subsidy_total_cap | 累计补贴上限 | 200000元 |
| refund_deduction_rate | 退票扣减费率 | 5% (0.05) |
| minimum_boxoffice | 最低票房承诺 | 50000元 |
| boxoffice_share_rate | 票房分账比例 | 43% (0.43) |

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **数据库**: SQLite (可扩展)
- **数据处理**: Pandas
- **Excel导出**: OpenPyXL
