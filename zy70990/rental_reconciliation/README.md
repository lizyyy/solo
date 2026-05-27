# 短租运营对账服务

一个偏后端的对账服务，用于短租运营的水电费用核对、损坏扣款处理和押金退款管理。

## 功能特性

### 1. 数据导入
- **订单导入**：从JSON文件批量导入订单信息
- **抄表数据导入**：从CSV文件导入水电表读数
- **扣款记录导入**：支持JSON批量导入和单条带照片的扣款记录

### 2. 自动比对引擎
- **阶梯电价计算**：支持多阶梯电价计算
- **水费计算**：按用量计算水费
- **自动对账**：自动计算水电费用、扣款总额和应退押金
- **差异检测**：自动识别读数异常、金额不一致等问题

### 3. 人工复核模块
- **扣款验证**：对损坏扣款进行审核（通过/驳回/修改）
- **抄表修正**：修正异常的抄表数据
- **退款冲正**：处理多扣/少扣的退款调整
- **审计追踪**：记录所有复核操作的历史

### 4. 押金历史追溯
- **完整流水**：展示所有押金相关的交易记录
- **来源追溯**：标注每笔扣款的来源（水电费/损坏扣款等）
- **审计日志**：记录所有复核操作的详细信息

### 5. 报告生成与下载
- **报告生成**：自动生成对账报告
- **多格式导出**：支持JSON和文本格式导出
- **报告管理**：查询和管理历史报告

## 项目结构

```
rental_reconciliation/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置文件
│   ├── database.py          # 数据库连接
│   ├── models/              # 数据模型
│   │   └── __init__.py
│   ├── schemas/             # Pydantic模式定义
│   │   └── __init__.py
│   ├── services/            # 业务逻辑服务
│   │   ├── import_service.py        # 导入服务
│   │   ├── reconciliation_service.py # 对账服务
│   │   ├── review_service.py        # 复核服务
│   │   └── report_service.py        # 报告服务
│   └── api/                 # API路由
│       ├── orders.py        # 订单管理
│       ├── reconciliation.py # 对账管理
│       ├── review.py        # 复核管理
│       └── reports.py       # 报告管理
├── tests/                   # 测试文件
│   ├── __init__.py
│   └── test_reconciliation.py
├── data/                    # 示例数据
│   ├── sample_orders.json
│   ├── sample_meter_readings.csv
│   └── sample_deductions.json
├── requirements.txt         # 依赖包
├── .env                     # 环境变量
└── start.sh                 # 启动脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd rental_reconciliation
pip install -r requirements.txt
```

### 2. 启动服务

```bash
# 方式一：使用启动脚本
chmod +x start.sh
./start.sh

# 方式二：手动启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问服务

- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## 使用流程

### 完整对账流程

1. **导入订单数据**
   ```
   POST /api/orders/import/json
   ```

2. **导入抄表数据**
   ```
   POST /api/orders/import/meter-csv
   ```

3. **导入扣款记录**
   ```
   POST /api/orders/import/deduction-batch
   ```

4. **执行自动对账**
   ```
   POST /api/reconciliation/{order_id}
   ```

5. **人工复核**
   ```
   POST /api/review/action
   ```

6. **生成报告**
   ```
   POST /api/reports/{order_id}/generate
   ```

7. **导出报告**
   ```
   POST /api/reports/{report_no}/export?format=text
   ```

## 核心概念

### 阶梯电价

系统支持三阶梯电价计算：
- **第一阶梯**：0-100 kWh，¥0.5/kWh
- **第二阶梯**：100-300 kWh，¥0.8/kWh
- **第三阶梯**：300 kWh以上，¥1.2/kWh

可在 `.env` 文件中调整阈值和价格。

### 押金状态

- `pending`：待处理，需要复核
- `completed`：已完成，费用已结清

### 复核操作

- `verify`：验证通过，扣款生效
- `reject`：驳回，扣款无效
- `modify`：修改金额或类型
- `refund_correction`：退款冲正

## 示例数据

项目包含示例数据，可用于测试：

```bash
# 导入示例订单
curl -X POST "http://localhost:8000/api/orders/import/json" \
  -F "file=@data/sample_orders.json"

# 导入示例抄表数据
curl -X POST "http://localhost:8000/api/orders/import/meter-csv" \
  -F "file=@data/sample_meter_readings.csv"

# 导入示例扣款记录
curl -X POST "http://localhost:8000/api/orders/import/deduction-batch" \
  -F "file=@data/sample_deductions.json"
```

## 运行测试

```bash
cd rental_reconciliation
pytest tests/ -v
```

## 配置说明

在 `.env` 文件中可以配置：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| DATABASE_URL | sqlite:///./rental_reconciliation.db | 数据库连接 |
| UPLOAD_DIR | ./uploads | 上传文件目录 |
| EXPORT_DIR | ./exports | 导出文件目录 |
| ELECTRICITY_TIER_THRESHOLD_1 | 100 | 第一阶梯阈值(kWh) |
| ELECTRICITY_TIER_RATE_1 | 0.5 | 第一阶梯电价(¥/kWh) |
| ELECTRICITY_TIER_THRESHOLD_2 | 300 | 第二阶梯阈值(kWh) |
| ELECTRICITY_TIER_RATE_2 | 0.8 | 第二阶梯电价(¥/kWh) |
| ELECTRICITY_TIER_RATE_3 | 1.2 | 第三阶梯电价(¥/kWh) |
| WATER_RATE | 5.0 | 水价(¥/吨) |
| DEFAULT_DEPOSIT_AMOUNT | 2000.0 | 默认押金金额 |