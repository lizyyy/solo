# 装修工程节点验收 API 服务

围绕装修工程节点验收的小型 HTTP API：监理提交材料，系统做去重、节点返工计数、结论变更审计、最终报告导出。

## 目录结构

```
renovation_acceptance/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 入口，路由 & 后台 worker 线程
│   ├── database.py      # SQLAlchemy 引擎 & Session
│   ├── models.py        # 数据模型（批次/审计/返工/导出）
│   ├── schemas.py       # Pydantic schema
│   ├── services.py      # 业务规则（去重、审计、返工统计）
│   ├── worker.py        # 单批次处理（照片缺失→待补证）
│   └── report.py        # CSV 报告生成
├── requirements.txt
└── README.md
```

## 核心规则

- **去重**：对整份 payload 做 `sha256`，同一批重复提交会直接命中旧记录，返回 `duplicated: true`。
- **状态机**（持久化，不驻内存）：
  - `processing` → 刚入库
  - `manual_confirm` → 材料解析完，等监理人工确认
  - `failed` → 处理失败（照片缺失时也进入该状态，同时结论为 `pending_evidence`）
  - `exported` → 已导出最终报告
- **节点**：`hydro_electric`（水电）、`masonry_carpentry`（泥木）、`painting`（油漆）。
- **返工统计**：只要任一节点结论被设为 `rework_required`，对应节点的 `rework_count` +1。
- **照片缺失**：没有照片时不会直接算验收通过，只会进 `pending_evidence`（待补证）。
- **审计**：每次状态/结论变更都会写 `audit_logs`，字段包含改动前、改动后、操作人、原因。

## 安装 & 启动

```bash
cd renovation_acceptance
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

可选环境变量：
- `RA_DB_PATH`：SQLite 数据库文件路径（默认 `renovation_acceptance.db`）

启动后访问 http://127.0.0.1:8000/docs 查看 Swagger UI。

## 端到端 curl 脚本

下面这组命令演示了「创建批次 → 去重 → 人工确认 → 返工 → 导出报告 → 下载报告 → 审计复盘」的完整链路。

```bash
# 1) 创建带照片的水电批次
curl -s -X POST http://127.0.0.1:8000/batches \
  -H 'Content-Type: application/json' \
  -d '{
    "project_name": "阳光花园 1 号楼 201",
    "supervisor": "张监理",
    "node": "hydro_electric",
    "photos": ["http://img/a/1.jpg", "http://img/a/2.jpg"],
    "items": [
      {"item": "水管压力测试", "required": true, "remark": "1.2MPa 保压 30min"},
      {"item": "电路绝缘电阻", "required": true, "remark": "≥ 0.5MΩ"}
    ],
    "extra": {"施工方": "佳华装饰"}
  }' | python3 -m json.tool

# 2) 等 1-2 秒让 worker 处理，查询
curl -s http://127.0.0.1:8000/batches | python3 -m json.tool

# 3) 重复提交相同 payload，应返回 duplicated: true
curl -s -X POST http://127.0.0.1:8000/batches \
  -H 'Content-Type: application/json' \
  -d '{
    "project_name": "阳光花园 1 号楼 201",
    "supervisor": "张监理",
    "node": "hydro_electric",
    "photos": ["http://img/a/1.jpg", "http://img/a/2.jpg"],
    "items": [
      {"item": "水管压力测试", "required": true, "remark": "1.2MPa 保压 30min"},
      {"item": "电路绝缘电阻", "required": true, "remark": "≥ 0.5MΩ"}
    ],
    "extra": {"施工方": "佳华装饰"}
  }' | python3 -m json.tool

# 4) 人工确认（把 id 替换为实际批次 id）
curl -s -X POST http://127.0.0.1:8000/batches/1/confirm \
  -H 'Content-Type: application/json' \
  -d '{
    "operator": "李总监",
    "conclusion": "passed",
    "reason": "现场抽检合格"
  }' | python3 -m json.tool

# 5) 标记返工（触发 rework_count）
curl -s -X POST http://127.0.0.1:8000/batches/1/rework \
  -H 'Content-Type: application/json' \
  -d '{"operator": "李总监", "reason": "水压测试未达标，需返工"}' \
  | python3 -m json.tool

# 6) 再次人工确认为通过
curl -s -X POST http://127.0.0.1:8000/batches/1/confirm \
  -H 'Content-Type: application/json' \
  -d '{"operator": "李总监", "conclusion": "passed", "reason": "返工后复测合格"}' \
  | python3 -m json.tool

# 7) 导出报告
curl -s -X POST http://127.0.0.1:8000/batches/1/export \
  -H 'Content-Type: application/json' \
  -d '{"operator": "系统导出员"}' | python3 -m json.tool

# 8) 下载报告（CSV）
curl -s -o report.csv http://127.0.0.1:8000/batches/1/report && cat report.csv

# 9) 查看所有审计
curl -s http://127.0.0.1:8000/audits | python3 -m json.tool

# 10) 查看返工统计
curl -s http://127.0.0.1:8000/rework-stats | python3 -m json.tool

# 11) 从原始输入回溯关键字段
curl -s http://127.0.0.1:8000/raw/1 | python3 -m json.tool
```

### 演示「照片缺失 → 待补证」

```bash
curl -s -X POST http://127.0.0.1:8000/batches \
  -H 'Content-Type: application/json' \
  -d '{
    "project_name": "阳光花园 1 号楼 201",
    "supervisor": "张监理",
    "node": "masonry_carpentry",
    "photos": [],
    "items": [{"item": "墙砖空鼓率", "required": true, "remark": "< 5%"}]
  }' | python3 -m json.tool
# 预期：conclusion = "pending_evidence"，status = "failed"
```

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/batches` | 提交一批验收材料（自动去重） |
| GET  | `/batches` | 列表，可按 `status`、`node` 过滤 |
| GET  | `/batches/{id}` | 单个批次详情 |
| POST | `/batches/{id}/confirm` | 人工确认结论 |
| POST | `/batches/{id}/rework` | 标记返工（自动累加节点返工次数） |
| POST | `/batches/{id}/export` | 生成 CSV 报告 |
| GET  | `/batches/{id}/report` | 下载已导出的报告文件 |
| GET  | `/audits` | 审计日志（可按 `batch_id` 过滤） |
| GET  | `/rework-stats` | 三节点返工次数 |
| GET  | `/raw/{id}` | 回溯原始 payload |
