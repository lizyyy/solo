# 社区卫生服务站疫苗预约对账系统

一个偏后端的对账服务，将导入、自动比对、人工复核、重新计算和报告下载串联起来。

## 功能特性

### 1. 数据导入
- 预约CSV导入
- 疫苗库存JSON导入
- 禁忌规则JSON导入
- 批量管理，支持中英文列名

### 2. 自动比对引擎
- **缺苗候补检测**：检查疫苗库存，无库存时自动拦截
- **禁忌规则拦截**：基于年龄、备注关键词等规则
- **重复改签检测**：检测多次改签和同一天重复预约
- **年龄适配性检查**：根据疫苗类型检查接种年龄是否合适

### 3. 人工复核
- 单条记录复核（通过/拒绝/需补充材料）
- 批量复核功能
- 完整审计日志
- 复核意见和决策原因记录

### 4. 数据同步与重新计算
- 单条记录重新计算
- 保留人工复核结果不受重新计算影响
- 复核状态自动同步到报告

### 5. 报告生成
- 汇总统计报告
- 明细记录查询
- 差异分析报告
- Excel报告导出（含三个工作表：汇总、明细、差异分析）

### 6. 数据追溯
- 对账记录完整追溯（从导入到最终决策）
- 按预约ID追溯
- 按儿童身份证查询完整历史
- 决策原因说明

## 系统架构

```
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI主入口
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── database.py         # 数据库配置
│   │   └── schemas.py          # ORM模型和Pydantic模式
│   ├── services/               # 业务逻辑
│   │   ├── __init__.py
│   │   ├── import_service.py   # 数据导入服务
│   │   ├── reconciliation_engine.py  # 对账引擎
│   │   ├── review_service.py   # 复核服务
│   │   ├── report_service.py   # 报告服务
│   │   └── trace_service.py    # 追溯服务
│   ├── api/                    # API路由
│   │   ├── __init__.py
│   │   ├── import_routes.py
│   │   ├── reconciliation_routes.py
│   │   ├── review_routes.py
│   │   ├── report_routes.py
│   │   └── trace_routes.py
│   └── data/                   # 示例数据
│       ├── sample_appointments.csv
│       ├── sample_inventory.json
│       └── sample_rules.json
├── requirements.txt
├── test_demo.py                # 演示脚本
└── README.md
```

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python -m uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 快速演示

运行演示脚本测试所有功能：

```bash
python test_demo.py
```

演示脚本将执行以下步骤：
1. 导入示例预约、库存、规则数据
2. 执行自动对账
3. 生成汇总、差异分析报告
4. 导出Excel报告
5. 演示人工复核流程
6. 测试数据追溯功能

## API端点

### 数据导入 (`/api/v1/import`)
- `POST /appointments/csv` - 导入预约CSV
- `POST /inventory/json` - 导入疫苗库存JSON
- `POST /rules/json` - 导入禁忌规则JSON

### 对账处理 (`/api/v1/reconciliation`)
- `POST /run` - 执行对账（可指定批次）
- `POST /recalculate/{record_id}` - 重新计算单条记录
- `GET /statistics` - 获取对账统计

### 人工复核 (`/api/v1/review`)
- `POST /{record_id}` - 复核单条记录
- `POST /batch` - 批量复核

### 报告生成 (`/api/v1/report`)
- `GET /summary` - 获取汇总报告
- `GET /details` - 获取明细记录（可筛选状态）
- `GET /discrepancies` - 获取差异分析报告
- `GET /export/excel` - 导出Excel报告

### 数据追溯 (`/api/v1/trace`)
- `GET /record/{record_id}` - 获取对账记录完整追溯
- `GET /appointment/{appointment_id}` - 按预约ID追溯
- `GET /child/{child_id_card}` - 查询儿童完整历史

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 - 记录已创建，尚未进行自动校验 |
| auto_approved | 自动通过 - 所有自动校验通过 |
| auto_rejected | 自动拒绝 - 存在严重问题 |
| needs_review | 待人工复核 - 存在需要人工判断的差异 |
| manually_approved | 人工通过 - 经人工复核确认通过 |
| manually_rejected | 人工拒绝 - 经人工复核确认拒绝 |
| needs_more_info | 需补充材料 - 需要更多信息才能做出决定 |

## 差异类型

| 类型 | 说明 |
|------|------|
| no_inventory | 无可用库存 |
| low_stock | 库存不足警戒 |
| contraindication | 禁忌规则触发 |
| duplicate_reschedule | 重复改签/重复预约 |
| age_inappropriate | 年龄不合适 |
| overdue | 超期 |
| invalid_data | 数据无效 |

## 数据库

系统使用SQLite数据库（`reconciliation.db`），包含以下表：

- `appointments` - 预约记录
- `vaccine_inventory` - 疫苗库存
- `contraindication_rules` - 禁忌规则
- `reconciliation_records` - 对账记录
- `audit_logs` - 审计日志

## 示例数据

示例数据文件位于 `app/data/` 目录：

- `sample_appointments.csv` - 包含10条预约记录，覆盖各种测试场景（重复预约、多次改签、超龄接种、无库存疫苗等）
- `sample_inventory.json` - 8种疫苗的库存数据，部分疫苗库存不足
- `sample_rules.json` - 3条禁忌规则示例

## 使用场景

### 场景1：日常对账流程
1. 导入当天预约CSV
2. 导入最新疫苗库存
3. 执行自动对账
4. 人工复核"待复核"记录
5. 导出对账报告

### 场景2：异常处理
- 无库存疫苗：系统自动拦截，建议候补或改签
- 超龄接种：触发警告，需人工核实
- 重复预约：自动标记，需联系家长确认
- 禁忌规则触发：根据严重程度自动拦截或提醒

### 场景3：数据追溯
- 家长询问为什么预约被拒绝：通过 `GET /trace/record/{record_id}` 查看完整决策路径
- 查询儿童接种历史：通过 `GET /trace/child/{child_id_card}` 获取完整历史
