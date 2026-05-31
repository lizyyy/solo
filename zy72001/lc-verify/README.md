# 跨境信用证单证核验

本地后端，批次核验 / 凭证追溯 / 冲突摆出 / 人工确认 / 报告导出，全部读写同一份 SQLite。

## 启动

```bash
cd lc-verify
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

打开 http://localhost:8000/docs 看接口文档。

## 放样例 & 重跑

```bash
# 加载 data/samples.json（会清库重来）
python load_samples.py

# 加载自己的文件
python load_samples.py /path/to/your_batch.json
```

样例文件格式见 `data/samples.json`，同批次里 `source: "bank_receipt_screenshot"` 的记录会自动和同信用证号的 import 记录做冲突检测。

## 差异报告去哪看

- **API**: `GET /api/report/diff/{batch_id}` — 返回挂起记录 + 冲突记录
- **全量报告**: `GET /api/report/batch/{batch_id}?format=text` — 文本格式，含核验过程
- **本地文件**: `reports/` 目录，每次生成报告自动存一份 JSON

## 核心逻辑

| 状态 | 含义 | 是否纳入已确认金额 |
|------|------|-------------------|
| confirmed | 凭证齐全、无冲突 | 是 |
| suspended | 缺凭证，挂起 | 否 |
| conflict | 银企回单截图与导入数据冲突 | 否，等人工判定 |
| pending | 关键信息缺失 | 否 |

冲突时不替用户拍板，两边证据和建议动作都摆出来，走 `/api/verify/confirm` 人工选。

## 交接说明

风控复核员林姐：核验过程留存在每条记录的 `verification_note` 字段里，文本报告末尾也有。挂起记录不会混进已确认金额，差异报告在 `/api/report/diff/{batch_id}` 或 `reports/` 目录。
