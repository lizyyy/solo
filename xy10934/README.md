# 仓储波次拣货 API

基于 FastAPI + SQLAlchemy 的多订单合并拣货系统，支持缺货拆单、复核差异追踪和波次完成状态管理。

## 功能特性

### 核心数据模型：
- **波次 (Wave) - 多订单合并拣货的主记录
- **订单 (Order) - 订单主记录，关联波次
- **订单项 (OrderItem) - 订单商品明细
- **库位 (Location) - 仓库库位信息，支持排序
- **拣货任务 (PickTask) - 按库位排序的拣货明细
- **复核差异 (ReviewDiff) - 复核时的差异记录
- **完成报告 (CompletionReport) - 波次完成后的汇总报告
- **异常记录 (ExceptionLog) - 异常操作的原始输入和处理结论

### 核心业务规则：
1. **波次生成** - 将多个待处理订单合并为一个波次
2. **库位排序** - 按库位路径优化拣货路径
3. **缺货拆单** - 库存不足时拆分拣货任务
4. **状态流转** - pending → ready → picking → reviewing → completed
5. **复核差异** - 记录差异并追踪处理
6. **完成报告** - 波次完成后自动生成汇总报告
7. **数据导出** - 支持 JSON 和 Excel 格式导出

### API 接口：
- 创建波次（多订单合并）
- 查询波次列表/详情
- 波次状态推进
- 拣货任务更新
- 缺货拆单处理
- 复核差异记录与解决
- 人工修正拣货数量
- 异常记录查询与处理
- 数据导出（JSON/Excel）

## 数据追溯关系

```
波次 (Wave)
├── 订单 (Order) - 多对一
│   └── 订单项 (OrderItem) - 多对一
├── 拣货任务 (PickTask) - 多对一
│   └── 复核差异 (ReviewDiff) - 关联波次+订单+拣货任务
├── 完成报告 (CompletionReport) - 一对一
└── 异常记录 (ExceptionLog) - 关联波次/订单/拣货任务
```

所有异常路径保存：
- 异常记录保存原始输入数据
- 处理结论与异常关联
- 可通过 wave_id, order_id, pick_task_id 追溯

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_sample_data.py
```

### 3. 启动 API 服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 5. 运行测试脚本

```bash
python test_api.py
```

## API 使用示例

### 创建订单

```bash
curl -X POST "http://localhost:8000/api/orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_no": "ORD202401001",
    "customer": "客户A",
    "address": "北京市朝阳区xxx路xxx号",
    "total_amount": 999.0,
    "items": [
      {"sku": "SKU001", "sku_name": "商品1", "qty": 2, "price": 99.0}
    ]
  }'
```

### 创建波次（合并订单）

```bash
curl -X POST "http://localhost:8000/api/waves/" \
  -H "Content-Type: application/json" \
  -d '{
    "order_ids": [1, 2, 3],
    "priority": 1,
    "created_by": "管理员"
  }'
```

### 更新波次状态

```bash
curl -X PUT "http://localhost:8000/api/waves/1/status?status=picking"
```

### 缺货拆单

```bash
curl -X POST "http://localhost:8000/api/stock-split/" \
  -H "Content-Type: application/json" \
  -d '{
    "pick_task_id": 1,
    "available_qty": 3,
    "reason": "库存不足",
    "operator": "仓管员001"
  }'
```

### 创建复核差异

```bash
curl -X POST "http://localhost:8000/api/review-diffs/" \
  -H "Content-Type: application/json" \
  -d '{
    "wave_id": 1,
    "order_id": 1,
    "pick_task_id": 1,
    "sku": "SKU001",
    "expected_qty": 5,
    "actual_qty": 4,
    "diff_type": "少货",
    "reviewer": "复核员001"
  }'
```

### 导出波次数据

```bash
# JSON 格式
curl "http://localhost:8000/api/waves/1/export?format=json"

# Excel 格式
curl "http://localhost:8000/api/waves/1/export?format=excel" -o wave_1.xlsx
```

## 波次状态流转

```
pending (待处理)
    ↓
ready (已就绪)
    ↓
picking (拣货中)
    ↓
reviewing (复核中)
    ↓
completed (已完成)

exception (异常) ← 任何状态出现异常时
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py           # SQLAlchemy 数据模型
├── schemas.py          # Pydantic 数据结构
├── services.py         # 业务逻辑服务
├── database.py         # 数据库连接配置
├── init_sample_data.py # 样例数据初始化
├── test_api.py        # API 测试脚本
├── requirements.txt    # 依赖列表
└── warehouse_wave.db  # SQLite 数据库（自动生成）
└── README.md          # 本文档
```

## 数据模型详解

### 波次 (Wave)
- wave_code: 波次编码（自动生成
- status: 状态
- total_orders: 订单总数
- total_skus: SKU 总数
- total_qty: 商品总数量
- picked_qty: 已拣数量
- reviewed_qty: 已复核数量

### 拣货任务 (PickTask)
- task_code: 任务编码
- location_code: 库位编码
- required_qty: 需求数量
- picked_qty: 已拣数量
- status: 任务状态
- is_split: 是否已拆分标记
- split_from_task_id: 源任务ID（拆单用）

### 复核差异 (ReviewDiff)
- diff_code: 差异编码
- expected_qty: 期望数量
- actual_qty: 实际数量
- diff_qty: 差异数量
- diff_type: 差异类型
- status: 处理状态
- resolution: 解决方案

### 异常记录 (ExceptionLog)
- exception_code: 异常编码
- operation: 操作类型
- input_data: 原始输入数据（JSON）
- error_message: 错误信息
- stack_trace: 堆栈跟踪
- conclusion: 处理结论
- is_handled: 是否已处理
