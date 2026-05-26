# garden-spraying-api

围绕**园林养护药剂喷洒**的小型 API 服务。项目经理把材料交给系统，系统将数据分成 **正常 / 待补充 / 已拦截** 三类，并把**处理中 / 处理失败 / 人工确认 / 已导出**这些批次状态持久化到数据库（SQLite）。所有结论的修改都会被审计，可以追溯"谁改过、为什么改、改动前是什么"，关键字段可从原始输入追到最终报告。

## 一、启动

```bash
cd /Users/lzy/pro/solo/workspaces/zy70971
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python wsgi.py
```

服务默认跑在 `http://127.0.0.1:5000`。

## 二、数据分类规则

每条记录包含以下关键字段：

- `region` 区域
- `pesticide_code` / `pesticide_name` 药剂编码与名称
- `dosage` / `standard_dosage` 实际用量与标准用量（默认单位 `kg/ha`）
- `wind_speed` 风速（m/s）
- `safety_interval_hours` 药剂安全间隔（h）
- `reentry_hours` 区域封闭时间（h）
- `operator` / `sprayed_at` 操作员与施药时间

系统将其分为三类：

1. **normal（正常）** — 关键字段齐全，且满足：
   - `wind_speed <= 5.0` m/s
   - `safety_interval_hours >= 4` h
   - `reentry_hours >= 24` h
   - `dosage / standard_dosage <= 1.2`
2. **need_replenish（待补充）** — 任一关键字段缺失，需补充后再提交复核。
3. **blocked（已拦截）** — 字段齐全但命中任一规则：
   - 风速超标（漂移风险）
   - 安全间隔不足
   - 封闭时间不足
   - 用量超过标准 20%（进入**人工复核**）

## 三、批次状态（持久化）

| 状态 | 含义 |
| --- | --- |
| `processing` | 处理中 |
| `failed` | 处理失败（可通过 `/batches/<id>/mark-failed` 标记） |
| `manual_review` | 存在待补充或已拦截记录，等待人工确认 |
| `exported` | 报告已导出 |

状态保存在 SQLite 数据库 `garden.db`，重启不丢失。

## 四、curl 全流程示例

### 1. 创建批次

```bash
curl -s -X POST http://127.0.0.1:5000/api/batches \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "2026年5月东区喷洒",
    "created_by": "zhang3",
    "records": [
      {
        "region": "东区-1号花坛",
        "pesticide_code": "P-001",
        "pesticide_name": "吡虫啉",
        "dosage": 0.4,
        "standard_dosage": 0.5,
        "wind_speed": 2.3,
        "safety_interval_hours": 12,
        "reentry_hours": 48,
        "operator": "li4",
        "sprayed_at": "2026-05-27T08:00:00+08:00"
      },
      {
        "region": "东区-2号花坛",
        "pesticide_code": "P-002",
        "pesticide_name": "石硫合剂",
        "dosage": 1.8,
        "standard_dosage": 1.2,
        "wind_speed": 6.5,
        "safety_interval_hours": 8,
        "reentry_hours": 12,
        "operator": "wang5",
        "sprayed_at": "2026-05-27T09:30:00+08:00"
      },
      {
        "region": "东区-3号花坛",
        "pesticide_code": "P-003",
        "pesticide_name": "代森锰锌",
        "dosage": null,
        "standard_dosage": 1.0,
        "wind_speed": 3.0,
        "safety_interval_hours": 8,
        "reentry_hours": 36,
        "operator": "zhao6",
        "sprayed_at": "2026-05-27T10:00:00+08:00"
      }
    ]
  }' | jq .
```

响应会给出 `id`，下面用 `BATCH_ID` 指代。

### 2. 查询批次详情

```bash
curl -s http://127.0.0.1:5000/api/batches/$BATCH_ID | jq .
```

你会看到 3 条记录分别被分类为 `normal` / `blocked` / `need_replenish`，并附带 `reason` 与 `action_taken`。

### 3. 补充"待补充"记录后重新提交复核

```bash
curl -s -X POST http://127.0.0.1:5000/api/records/$RECORD_ID/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "operator": "zhang3",
    "reason": "现场回传实际剂量",
    "updates": { "dosage": 0.9 }
  }' | jq .
```

### 4. 对"已拦截"记录进行人工复核（可改结论）

```bash
curl -s -X POST http://127.0.0.1:5000/api/records/$RECORD_ID/review \
  -H 'Content-Type: application/json' \
  -d '{
    "operator": "li4",
    "status": "normal",
    "final_verdict": "overdose_waived",
    "reason": "药剂师确认该区域抗药性强，允许临时加量",
    "action_taken": "保留该次用量，但下次需降至标准剂量"
  }' | jq .
```

### 5. 查询审计日志（谁改过、为什么改、改动前后）

```bash
curl -s http://127.0.0.1:5000/api/batches/$BATCH_ID/audit | jq .
```

### 6. 关键字段溯源（从原始输入 → 最终报告）

```bash
curl -s http://127.0.0.1:5000/api/records/$RECORD_ID/trace | jq .
```

响应里包含 `raw_input`、`final` 和整条 `audit_trail`，方便复盘时核对 `dosage / wind_speed / safety_interval_hours / reentry_hours` 等字段的演变。

### 7. 导出报告并将批次标记为已导出

```bash
curl -s -o report-$BATCH_ID.csv \
  "http://127.0.0.1:5000/api/batches/$BATCH_ID/report"
cat report-$BATCH_ID.csv
```

### 8. 列出所有批次

```bash
curl -s http://127.0.0.1:5000/api/batches | jq .
```

### 9. 标记批次处理失败

```bash
curl -s -X POST http://127.0.0.1:5000/api/batches/$BATCH_ID/mark-failed \
  -H 'Content-Type: application/json' \
  -d '{"operator":"system","reason":"上游数据源超时"}' | jq .
```

## 五、目录结构

```
.
├── app/
│   ├── __init__.py
│   ├── extensions.py
│   ├── models.py
│   ├── routes.py
│   └── services.py
├── wsgi.py
├── requirements.txt
└── README.md
```

- `models.py`：批次、记录、审计日志三个表，承担持久化。
- `services.py`：分类/判断规则（风速、安全间隔、封闭时间、超量复核）。
- `routes.py`：所有对外 API。
