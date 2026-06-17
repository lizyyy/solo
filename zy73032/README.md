# 宠物训练课排程对账

Python FastAPI + SQLite 后端服务。导入、确认、撤回、异常隔离、操作日志和 CSV 明细都写入同一份本地 SQLite 数据，不再依赖浏览器 localStorage。

## 快速运行

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn pet_training_reconcile.api:app --reload
```

初始化演示数据：

```bash
curl -X POST http://127.0.0.1:8000/seed
curl http://127.0.0.1:8000/summary
curl http://127.0.0.1:8000/exports/schedules.csv
```

运行验证：

```bash
pytest -q
```

## 接班顺序

1. 先 `POST /imports/schedules` 导入 `samples/training_schedules.csv`，训练课 CSV 会进入 `schedules` 表。
2. 再 `POST /medical-records` 录入病历手写单，系统会按宠物别名和日期尝试接到排程。
3. 看 `GET /summary`：异常别名不会揉进正常汇总。
4. 看 `GET /anomalies`：每条异常带来源和影响范围，接手同事能从汇总追到原始记录。
5. 对正常排程调用 `POST /schedules/{id}/confirm`，确认前后快照写入 `operation_logs`。
6. 发现误确认时调用 `POST /schedules/{id}/withdraw`，撤回同样留痕。
7. 公示复盘时看 `GET /logs` 和 `GET /exports/schedules.csv`，能对出处理记录和 CSV 明细。

## 关键接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/imports/schedules` | 导入训练课 CSV |
| `POST` | `/medical-records` | 录入病历手写单 |
| `GET` | `/summary` | 查看汇总口径 |
| `GET` | `/schedules` | 查看排程明细 |
| `POST` | `/schedules/{id}/confirm` | 人工确认排程 |
| `POST` | `/schedules/{id}/withdraw` | 撤回排程 |
| `POST` | `/aliases/bind` | 把别名绑定到规范宠物 |
| `GET` | `/anomalies` | 查看异常来源和影响范围 |
| `GET` | `/logs` | 查看确认/撤回前后变动 |
| `GET` | `/exports/schedules.csv` | 导出 CSV 明细 |

## 样例说明

`samples/training_schedules.csv` 包含一条正常记录、一条待确认记录、一条例名可识别记录，以及一条 `黑妞` 未绑定别名。导入后 `黑妞` 会被隔离为异常，不计入正常汇总；调用 `/aliases/bind` 把 `黑妞 -> 阿黑` 后才会回到待确认明细。
