# 流浪动物救助回访追踪

一个本地 Node.js API + SQLite 小服务，用于把主人微信备注、用药提醒、晚到附件和口头说明接到同一份回访数据里。

## 运行

```bash
npm start
```

打开 `http://localhost:8775`。

## API

- `POST /api/records/import`：导入或追加同一主人的新版本材料。
- `POST /api/records/:id/confirm`：确认放行，挂起记录会留下人工确认痕迹。
- `POST /api/records/:id/revoke`：撤回记录并保留历史。
- `PATCH /api/records/:id`：人工补改并生成新版本。
- `GET /api/summary`：页面摘要。
- `GET /api/anomalies`：异常出口明细。
- `GET /api/records`：读取同一份 SQLite 数据。

SQLite 文件位于 `data/stray_tracker.sqlite`，所有页面和 API 操作都使用这一个本地数据源。
