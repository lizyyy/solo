# 塔吊维保工单回放

这是一个 FastAPI + SQLite 的塔吊维保工单回放服务，前端页面由后端托管，工单提交去重、备注补录、截图版本、采样断档和导出都通过 API 持久化。

## 启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```

打开 `http://127.0.0.1:8765/`。

## API

- `GET /api/workorders`：按状态、断档筛选或关键词查询工单。
- `POST /api/workorders/submit`：提交工单，按塔吊、维保类型、停机窗口和备件组合生成指纹，重复提交不会新增工单。
- `POST /api/workorders/{workorder_id}/parts/{part_id}/remarks`：追加备注版本，旧版本保留。
- `POST /api/workorders/{workorder_id}/parts/{part_id}/screenshots`：追加截图版本，旧版本保留。
- `GET /api/workorders/{workorder_id}/history`：读取处理时间线、备注版本和截图版本。
- `GET /api/export`：导出当前筛选视图和选中工单明细。
