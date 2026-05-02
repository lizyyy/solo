# 共享充电宝对账服务

本地 FastAPI 服务，用于共享充电宝运营的订单与柜机事件对账。

## 项目结构

```
.
├── main.py                # FastAPI 主服务
├── models.py              # SQLAlchemy 数据库模型
├── parsers.py             # 文件解析模块
├── reconciliation.py      # 对账规则引擎
├── exporters.py           # 报告导出模块
├── test_reconciliation.py # pytest 测试
├── requirements.txt       # 依赖
├── sample_orders.csv      # 示例订单数据
├── sample_events.jsonl    # 示例柜机事件
└── sample_rules.yaml      # 示例计费规则
```

## 功能特性

- **数据导入**: 支持导入订单 CSV、柜机事件 JSONL、计费规则 YAML
- **差异识别**: 识别先扣费后借出失败、跨日归还、同一槽位重复事件
- **报告导出**: 导出差异清单 CSV 和 Markdown 对账报告
- **API 接口**: 提供完整的 RESTful API

## 安装和运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问 API 文档

打开浏览器访问 `http://localhost:8000/docs` 查看 Swagger UI 文档。

## API 使用示例

### 导入数据

```bash
curl -X POST "http://localhost:8000/import" \
  -F "orders_csv=@sample_orders.csv" \
  -F "events_jsonl=@sample_events.jsonl" \
  -F "rules_yaml=@sample_rules.yaml"
```

### 执行对账

```bash
curl -X POST "http://localhost:8000/reconcile"
```

### 查询订单详情

```bash
curl "http://localhost:8000/orders/ORD001"
```

### 导出差异 CSV

```bash
curl "http://localhost:8000/export?format=csv" -o discrepancies.csv
```

### 导出 Markdown 报告

```bash
curl "http://localhost:8000/export?format=markdown" -o report.md
```

## 运行测试

```bash
pytest test_reconciliation.py -v
```

## 差异类型说明

| 类型 | 说明 |
|------|------|
| charged_but_not_borrowed | 订单已扣费但没有借出事件记录 |
| cross_day_return | 跨日归还订单 |
| duplicate_slot_event | 同一槽位短时间内重复的同类事件 |
