# 布草送洗周转追踪系统

基于 FastAPI 的酒店布草送洗周转追踪系统，支持导入布草清单、扫描记录、异常检测和报告导出功能。

## 功能特性

- **批次管理**: 创建和管理洗涤批次
- **状态追踪**: 实时追踪布草送洗状态（在房、洗涤中、已归还、丢失、损坏）
- **数据导入**:
  - CSV 格式导入布草清单
  - JSONL 格式导入扫描记录
  - YAML 格式导入损耗规则
- **异常检测**:
  - 超时未回仓
  - 重复扫描
  - 跨酒店串包
  - 达到最大洗涤次数
- **报告导出**: Markdown 和 CSV 格式报告
- **SQLite 持久化**: 本地数据存储

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── models.py              # 数据模型
│   ├── database.py            # 数据库配置
│   ├── state_machine.py       # 状态机逻辑
│   ├── import_validator.py    # 数据导入校验
│   ├── report_exporter.py     # 报告导出
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── batches.py         # 批次路由
│   │   ├── linen.py           # 布草路由
│   │   ├── anomalies.py       # 异常路由
│   │   └── reports.py         # 报告路由
│   └── sample_data/           # 示例数据
│       ├── inventory.csv
│       ├── scans.jsonl
│       └── loss_rules.yaml
├── tests/                     # 测试文件
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_basic.py
│   ├── test_duplicate_scan.py
│   └── test_missing_receive_scan.py
├── main.py                    # 应用入口
├── requirements.txt           # 依赖
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务将在 http://127.0.0.1:8000 启动

### 3. 访问 API 文档

打开浏览器访问 http://127.0.0.1:8000/docs 查看交互式 API 文档

## 使用说明

### 基础使用流程

1. **导入布草清单**
   ```bash
   curl -X POST "http://127.0.0.1:8000/linen/import-inventory" \
     -F "file=@app/sample_data/inventory.csv"
   ```

2. **创建洗涤批次**
   ```bash
   curl -X POST "http://127.0.0.1:8000/batches/?hotel=希尔顿"
   ```

3. **导入扫描记录**
   ```bash
   # 先获取 batch_id
   curl -X POST "http://127.0.0.1:8000/batches/{batch_id}/import-scans" \
     -F "file=@app/sample_data/scans.jsonl"
   ```

4. **检查异常**
   ```bash
   curl "http://127.0.0.1:8000/anomalies/"
   ```

5. **导出报告**
   ```bash
   # Markdown 报告
   curl "http://127.0.0.1:8000/reports/markdown"
   
   # CSV 报告
   curl "http://127.0.0.1:8000/reports/csv" --output linen_report.csv
   ```

### 导入损耗规则

```bash
curl -X POST "http://127.0.0.1:8000/anomalies/import-rules" \
  -F "file=@app/sample_data/loss_rules.yaml"
```

## 运行测试

```bash
pytest tests/ -v
```

测试覆盖：
- 基础功能测试
- 重复扫描边界测试
- 缺失回仓扫描边界测试

## API 接口

### 批次管理
- `POST /batches/` - 创建批次
- `GET /batches/` - 列出批次
- `POST /batches/{batch_id}/scan` - 添加单次扫描
- `POST /batches/{batch_id}/import-scans` - 批量导入扫描

### 布草管理
- `POST /linen/import-inventory` - 导入布草清单
- `GET /linen/{rfid}` - 查询单条布草状态
- `GET /linen/` - 列出所有布草

### 异常检测
- `POST /anomalies/import-rules` - 导入损耗规则
- `GET /anomalies/` - 检查异常

### 报告导出
- `GET /reports/markdown` - 导出 Markdown 报告
- `GET /reports/csv` - 导出 CSV 报告
- `GET /reports/anomalies/markdown` - 导出异常报告

## 数据格式

### 布草清单 CSV

```csv
rfid,type,room,hotel
1001,床单,101,希尔顿
1002,被套,102,希尔顿
```

### 扫描记录 JSONL

```jsonl
{"rfid": "1001", "action": "SEND", "timestamp": "2024-05-01T08:00:00"}
{"rfid": "1001", "action": "RECEIVE", "timestamp": "2024-05-01T16:00:00"}
```

支持的动作：SEND（送洗）、RECEIVE（回仓）、REPORT_LOSS（报失）、REPORT_DAMAGE（报损）

### 损耗规则 YAML

```yaml
timeout_hours: 48
cross_hotel_alarm: true
max_wash_cycles:
  床单: 100
  被套: 80
  枕套: 120
```
