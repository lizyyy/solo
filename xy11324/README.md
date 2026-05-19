# 农机合作社财务系统

拖拉机作业计费管理系统，支持按小时、亩数、油费混合计费，解决机手手写单据漏字段、跨天作业、重复结算等问题。

## 功能特性

### 核心功能
- ✅ **混合计费**: 支持按小时、亩数、油费任意组合计费
- ✅ **跨天作业处理**: 自动识别并处理跨天作业的工时拆分
- ✅ **最低收费保障**: 低于最低收费标准时按最低收费计算
- ✅ **坏行隔离**: 导入时自动隔离错误数据，不影响正常数据
- ✅ **重复结算检测**: 防止同一张作业单重复结算
- ✅ **幂等性**: 重复导入、重复生成账单结果稳定

### 业务流程
1. **导入**: 支持CSV批量导入作业单
2. **校验**: 自动校验必填字段、时间逻辑、数值范围
3. **计费**: 灵活的计费引擎，支持多维度计费
4. **复核**: 账单复核流程，确保金额准确
5. **结算**: 生成正式账单
6. **历史**: 完整的操作历史记录

## 技术架构

- **数据库**: SQLite (本地持久化)
- **ORM**: SQLAlchemy
- **Web API**: FastAPI
- **CLI**: Python argparse

## 文件结构

```
.
├── models.py          # 数据模型定义
├── database.py        # 数据库配置
├── billing_engine.py  # 计费引擎
├── validation_engine.py # 校验引擎
├── services.py        # 业务服务层
├── main.py            # FastAPI Web服务
├── cli.py             # 命令行工具
├── requirements.txt   # 依赖包
└── sample_work_orders.csv # 示例数据
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python cli.py init
```

### 3. 创建演示数据

```bash
python cli.py demo
```

### 4. 查看机手列表

```bash
python cli.py op-list
```

### 5. 查看拖拉机列表

```bash
python cli.py t-list
```

### 6. 查看作业单列表

```bash
python cli.py wo-history
```

## CLI命令详解

### 主数据管理

```bash
# 创建机手
python cli.py op-create 张三 --phone 13800138001 --hourly-rate 100

# 创建拖拉机
python cli.py t-create 京A12345 --model 东方红904 --hourly-rate 150 --area-rate 30

# 列出机手
python cli.py op-list

# 列出拖拉机
python cli.py t-list
```

### 作业单管理

```bash
# 创建作业单
python cli.py wo-create WO001 1 1 \
    --start-time 2024-05-10T08:00:00 \
    --end-time 2024-05-10T12:00:00 \
    --customer 王家庄 \
    --work-type 耕地 \
    --area 50 \
    --fuel 20 \
    --hourly-rate 150 \
    --area-rate 30 \
    --fuel-price 7.5 \
    --min-charge 500

# 查看作业单详情
python cli.py wo-get 1

# 查看作业单历史
python cli.py wo-history [--operator-id 1] [--start-date 2024-05-01] [--end-date 2024-05-31] [--status valid]
```

### CSV导入

```bash
# 从CSV导入作业单
python cli.py import sample_work_orders.csv

# 查看导入历史
python cli.py import-history
```

### 账单管理

```bash
# 生成账单
python cli.py bill-gen 1 2024-05-01 2024-05-31

# 查看账单详情
python cli.py bill-get 1

# 查看账单历史
python cli.py bill-history

# 复核账单
python cli.py review 1 管理员 --notes "数据无误"
```

## Web API 使用

### 启动服务

```bash
python main.py
```

服务启动后访问: http://localhost:8000

### API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要API端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | / | 系统信息 |
| GET | /operators | 获取机手列表 |
| POST | /operators | 创建机手 |
| GET | /tractors | 获取拖拉机列表 |
| POST | /tractors | 创建拖拉机 |
| GET | /work-orders/{id} | 获取作业单详情 |
| POST | /work-orders | 创建作业单 |
| POST | /import/csv | CSV导入作业单 |
| POST | /bills/generate | 生成账单 |
| GET | /bills/{id} | 获取账单详情 |
| POST | /bills/{id}/review | 复核账单 |
| GET | /history/work-orders | 作业单历史 |
| GET | /history/bills | 账单历史 |
| GET | /history/import-batches | 导入历史 |

## 数据模型

### Operator (机手)
- id: 主键
- name: 姓名
- phone: 电话
- id_card: 身份证号
- hourly_rate: 小时单价
- is_active: 是否激活

### Tractor (拖拉机)
- id: 主键
- plate_number: 车牌号
- model: 型号
- horsepower: 马力
- hourly_rate: 小时单价
- area_rate: 亩单价
- fuel_consumption: 油耗标准
- is_active: 是否激活

### WorkOrder (作业单)
- id: 主键
- order_no: 作业单号(唯一)
- operator_id: 机手ID
- tractor_id: 拖拉机ID
- customer_name: 客户名称
- work_type: 作业类型
- start_time: 开始时间
- end_time: 结束时间
- work_hours: 作业时长(自动计算)
- work_area: 作业面积
- fuel_used: 耗油量
- billing_type: 计费类型(by_hour/by_area/mixed)
- hourly_rate: 小时单价
- area_rate: 亩单价
- fuel_price: 油价
- minimum_charge: 最低收费
- calculated_amount: 计算金额
- final_amount: 最终金额
- status: 状态(draft/imported/valid/invalid/billed/reviewed)
- import_batch_id: 导入批次ID
- import_row_number: 导入行号

### ValidationLog (校验日志)
- id: 主键
- work_order_id: 作业单ID
- check_name: 校验项名称
- passed: 是否通过
- message: 校验消息
- severity: 严重级别(error/warning)

### Bill (账单)
- id: 主键
- bill_no: 账单号
- operator_id: 机手ID
- billing_period_start: 计费周期开始
- billing_period_end: 计费周期结束
- total_hours: 总工时
- total_area: 总面积
- total_fuel: 总油耗
- subtotal: 小计
- deductions: 扣款
- total_amount: 总金额
- status: 状态
- reviewed_by: 复核人
- reviewed_at: 复核时间
- notes: 备注

### BillItem (账单明细)
- id: 主键
- bill_id: 账单ID
- work_order_id: 作业单ID
- work_hours: 工时
- work_area: 面积
- fuel_used: 油耗
- hourly_amount: 计时金额
- area_amount: 计亩金额
- fuel_amount: 油费金额
- line_total: 行合计

### ImportBatch (导入批次)
- id: 主键
- batch_id: 批次ID
- filename: 文件名
- total_rows: 总行数
- valid_rows: 有效行数
- invalid_rows: 无效行数
- status: 状态(processing/completed)
- created_at: 创建时间
- completed_at: 完成时间

## 计费规则说明

### 计费公式

根据计费类型不同，计费方式如下：

#### 1. 按小时计费 (by_hour)
```
计时费用 = 作业时长 × 小时单价
```

#### 2. 按面积计费 (by_area)
```
计亩费用 = 作业面积 × 亩单价
```

#### 3. 混合计费 (mixed)
```
总费用 = 计时费用 + 计亩费用 + 油费
其中:
- 计时费用 = 作业时长 × 小时单价
- 计亩费用 = 作业面积 × 亩单价  
- 油费 = 耗油量 × 油价
```

### 跨天作业处理

系统自动识别跨天作业：
- 按天拆分作业时长
- 保留每日明细
- 总时长累加计算

### 最低收费

当计算结果低于设定的最低收费标准时：
- 自动使用最低收费作为最终金额
- 记录收费调整原因

## 校验规则

### 强制校验（不通过则标记为无效）
- 必填字段校验：作业单号、机手ID、拖拉机ID、开始时间不能为空
- 作业单号唯一性校验
- 时间逻辑校验：结束时间不早于开始时间

### 警告校验（不影响有效性但给出警告）
- 作业时长合理性：0 < 时长 ≤ 24小时
- 数值范围校验：面积、油耗、单价等在合理范围内
- 时间重叠检测：同一拖拉机同一时间段的作业重叠

## 幂等性保证

### 作业单重复导入
- 通过作业单号唯一识别
- 重复的作业单号会被检测并拒绝

### 账单重复生成
- 同一机手同一周期的账单只生成一次
- 重复调用返回已生成的账单

### 重复复核
- 已复核的账单再次复核不产生变化

## 数据持久化

系统使用SQLite数据库文件 `farm_finance.db` 存储所有数据：
- 重启服务后数据保留
- 支持数据备份与恢复
- 所有操作历史可追溯

## 使用示例

### 完整业务流程演示

```bash
# 1. 初始化
python cli.py init

# 2. 创建演示数据（机手、拖拉机、作业单）
python cli.py demo

# 3. 查看作业单列表
python cli.py wo-history

# 4. 导入更多作业单（包含错误数据）
python cli.py import sample_work_orders.csv

# 5. 查看导入结果
python cli.py import-history

# 6. 生成账单
python cli.py bill-gen 1 2024-05-01 2024-05-31

# 7. 查看账单详情
python cli.py bill-get 1

# 8. 复核账单
python cli.py review 1 财务主管

# 9. 查看账单历史
python cli.py bill-history
```

## 常见问题

### Q: 如何处理跨天作业？
A: 系统自动识别跨天作业，在计费明细中会显示每天的工时拆分。

### Q: 导入失败的作业单会怎么样？
A: 失败的作业单会被标记为 invalid 状态，保留所有校验日志，可以查看具体失败原因。

### Q: 重复生成同一账单会怎么样？
A: 系统会检测到已存在的账单，直接返回已有账单而不会重复生成。

### Q: 作业单已经结算后还能修改吗？
A: billed 和 reviewed 状态的作业单不允许修改，防止重复计费。

### Q: 数据库文件在哪里？
A: 数据库文件 `farm_finance.db` 会在程序运行目录自动创建。
