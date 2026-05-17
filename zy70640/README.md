# 赛事补给缺口备用量调拨建议后端API

基于 FastAPI + SQLite 的马拉松补给站物资缺口计算与调拨建议系统。

## 功能特性

- CSV 批量导入站点和物资分配数据
- 自动计算备用量（水、盐丸、能量胶）
- 缺口分级（critical/high/medium）和优先级排序
- 智能站点间调拨建议（基于距离和富余/短缺）
- Markdown/JSON 报告导出
- 完整状态流转（open → processing → resolved → closed）
- 人工修正、撤回/关闭功能
- 异常操作日志记录（原始输入、处理人、结论）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --port 8000
```

或

```bash
python main.py
```

访问 API 文档: http://localhost:8000/docs

### 3. 一键造数

```bash
python seed_data.py
```

### 4. 运行测试

```bash
pytest -v
```

## API 主流程 (curl 示例)

### 创建赛事配置

```bash
curl -X POST "http://localhost:8000/api/race-configs/" \
  -H "Content-Type: application/json" \
  -d '{
    "race_name": "2024北京马拉松",
    "total_runners": 30000,
    "expected_dropout_rate": 0.05,
    "backup_ratio_water": 0.2,
    "backup_ratio_salt": 0.3,
    "backup_ratio_gel": 0.25
  }'
```

### 创建站点

```bash
curl -X POST "http://localhost:8000/api/stations/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "5公里补给站",
    "km_marker": 5.0,
    "type": "普通站",
    "max_capacity": 10000
  }'
```

### 导入站点 CSV

```bash
curl -X POST "http://localhost:8000/api/import/stations/" \
  -F "file=@data/stations.csv"
```

### 导入物资分配 CSV

```bash
curl -X POST "http://localhost:8000/api/import/supply-allocations/" \
  -F "file=@data/supply_allocations.csv"
```

### 执行补给需求计算

```bash
curl -X POST "http://localhost:8000/api/calculate/1"
```

### 查看缺口记录

```bash
# 查看所有 open 状态缺口
curl "http://localhost:8000/api/gap-records/?status=open"

# 查看 critical 级缺口
curl "http://localhost:8000/api/gap-records/?level=critical"
```

### 获取调拨建议

```bash
curl "http://localhost:8000/api/transfer-suggestions/"
```

### 状态推进

```bash
curl -X POST "http://localhost:8000/api/gap-records/1/advance?handler=张经理"
```

### 人工修正缺口

```bash
curl -X PUT "http://localhost:8000/api/gap-records/1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "processing",
    "handler": "李主管",
    "suggestion": "从10km站调拨200瓶水",
    "conclusion": "已协调运输"
  }'
```

### 关闭缺口

```bash
curl -X POST "http://localhost:8000/api/gap-records/1/close?handler=王总监&conclusion=物资已补充到位，缺口消除"
```

### 撤回缺口

```bash
curl -X POST "http://localhost:8000/api/gap-records/1/withdraw?handler=张经理&reason=数据有误，重新计算"
```

### 导出 Markdown 报告

```bash
curl "http://localhost:8000/api/export/markdown/1" -o report.md
```

### 导出 JSON 报告

```bash
curl "http://localhost:8000/api/export/json/1" -o report.json
```

### 查看异常日志

```bash
curl "http://localhost:8000/api/exception-logs/"
```

## 冲突路径示例

### 场景1: 重复导入导致数据冲突

```bash
# 第一次导入（成功）
curl -X POST "http://localhost:8000/api/import/supply-allocations/" -F "file=@data/supply_allocations.csv"

# 第二次导入（重复数据，会有警告）
curl -X POST "http://localhost:8000/api/import/supply-allocations/" -F "file=@data/supply_allocations.csv"

# 查看异常日志
curl "http://localhost:8000/api/exception-logs/"
```

### 场景2: 状态流转冲突

```bash
# 尝试对已关闭的缺口推进状态
curl -X POST "http://localhost:8000/api/gap-records/1/close?handler=A&conclusion=done"
curl -X POST "http://localhost:8000/api/gap-records/1/advance?handler=B"
```

### 场景3: 并发修改冲突

```bash
# 两个用户同时修改同一个缺口记录
curl -X PUT "http://localhost:8000/api/gap-records/1" -H "Content-Type: application/json" -d '{"handler": "用户A"}' &
curl -X PUT "http://localhost:8000/api/gap-records/1" -H "Content-Type: application/json" -d '{"handler": "用户B"}' &
```

## CSV 数据格式

### stations.csv

```csv
name,km_marker,type,max_capacity
5公里补给站,5.0,普通站,10000
10公里补给站,10.0,普通站,10000
15公里补给站,15.0,普通站,10000
20公里补给站,20.0,重点站,15000
25公里补给站,25.0,重点站,15000
30公里补给站,30.0,关键站,20000
35公里补给站,35.0,关键站,20000
40公里补给站,40.0,终点站,25000
```

### supply_allocations.csv

```csv
station_name,category_name,allocated_quantity
5公里补给站,水,2500
5公里补给站,盐丸,800
5公里补给站,能量胶,600
10公里补给站,水,2800
10公里补给站,盐丸,1000
10公里补给站,能量胶,700
15公里补给站,水,2600
15公里补给站,盐丸,900
15公里补给站,能量胶,650
20公里补给站,水,3500
20公里补给站,盐丸,1200
20公里补给站,能量胶,900
25公里补给站,水,3200
25公里补给站,盐丸,1100
25公里补给站,能量胶,850
30公里补给站,水,2000
30公里补给站,盐丸,500
30公里补给站,能量胶,400
35公里补给站,水,3800
35公里补给站,盐丸,1300
35公里补给站,能量胶,1000
40公里补给站,水,4500
40公里补给站,盐丸,1500
40公里补给站,能量胶,1200
```

## 项目结构

```
.
├── main.py              # FastAPI 入口
├── database.py          # 数据库模型和连接
├── schemas.py           # Pydantic 数据模型
├── services.py          # 业务逻辑
├── requirements.txt     # 依赖清单
├── seed_data.py         # 造数脚本
├── test_api.py          # pytest 测试
├── data/                # CSV 数据目录
│   ├── stations.csv
│   └── supply_allocations.csv
├── marathon_supply.db   # SQLite 数据库（自动生成）
└── README.md
```

## 数据模型说明

- **Station**: 站点信息（名称、公里数、类型、容量）
- **SupplyCategory**: 物资品类（水/盐丸/能量胶）
- **RaceConfig**: 赛事配置（人数、退赛率、备用比例）
- **SupplyRecord**: 物资分配记录（站点-物资-分配量-备用量-需求量）
- **GapRecord**: 缺口记录（缺口数量、等级、优先级、状态、处理人）
- **TransferLog**: 调拨记录（源站→目标站→物资→数量）
- **ExceptionLog**: 异常日志（操作类型、原始输入、处理人、结论、错误信息）
