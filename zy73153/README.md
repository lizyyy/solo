# 海洋牧场空间标注系统

面向海洋站值班员（小宋）、排班同事、实验室技术员、传感器运维的空间标注工具。

---

## 一、海洋站值班员小宋 · 快速上手

### 先跑哪条命令？

```bash
# 1. 装依赖（首次）
pip install -r requirements.txt

# 2. 启动服务（日常值班用这条）
python -m uvicorn app.main:app --reload --port 8000

# 3. 跑全量测试（交接前用这条）
pytest tests/ -v
```

启动后浏览器打开 <http://localhost:8000/> 会看到首页指引。

### 再看哪份接口返回？

按值班顺序：

| 顺序 | 命令 / 接口 | 看什么 |
| ---- | ----------- | ------ |
| ① | `curl http://localhost:8000/api/info` | 有哪些可用命令和端点 |
| ② | `curl http://localhost:8000/api/run-main-flow` | **主流程批量标注**，看多少条正常、多少条异常；每条都带完整公式、单位、边界值 |
| ③ | `curl http://localhost:8000/api/annotations/AN-xxx-0001` | 单条详情，重点看 `calculation_trail`（每一步怎么算出来的） |
| ④ | `curl http://localhost:8000/api/pending` | **待处理记录面板**（只含需人工确认的；正常完成的不会混进来） |
| ⑤ | 拿待处理里漂移记录的 `check_first_source`（如 `/api/sensors/SN-B2/history`）再 `curl` 一次 | **漂移核对链路**：历史读数 + 漂移判断依据 + 先查来源 + 联系人，点过去不会 404 |
| ⑥ | 重复执行一次 `POST /api/annotations/run/SP-20260615-001` | 验证不会重复导入、不会覆盖人工备注 |

> 漂移核对链路（重点）：`/api/pending` 里漂移记录的 `check_first_source` 指向 `/api/sensors/SN-B2/history`，
> 该接口是真实可访问的，返回这台传感器的历史读数、漂移判断依据（偏差率计算 + 阈值 + 距上次校准天数）、
> 建议先核对的来源和建议联系人（李工）。小宋顺着 `check_first_source` 点过去就能拿到证据，不会遇到 404。

---

## 二、接口返回到底包含什么？（不藏着掖着）

所有接口返回 JSON，关键字段：

### `GET /api/annotations/{id}` — 单条标注详情（重点）

```jsonc
{
  "annotation_id": "AN-SP-20260615-001-0001",
  "status": "已标注 / 采样时间与结果不符 / 附件晚到 / 传感器漂移 / 重复导入",
  "zone_level": "水温",
  "zone_name": "适宜养殖区",
  "alerts": ["...异常原因..."],
  "handler_hint": "下一步找谁/做什么",
  "data_sources": ["采样记录 SP-...", "实验室结果 LB-...", "传感器 SN-..."],
  "calculation_trail": {
    "final_result": 18.6,
    "final_unit": "℃",
    "warning_flags": ["传感器与实验室偏差 14.1% 超过阈值 10%"],
    "boundary_values": {
      "核心养殖区": [20.0, 28.0],
      "适宜养殖区": [15.0, 20.0],
      "缓冲区": [10.0, 15.0],
      "监测区": [0.0, 10.0]
    },
    "formula_steps": [
      {
        "step_index": 1,
        "description": "传感器原始值读取",
        "formula": "raw_value = sensor.reading",
        "unit": "℃",
        "input_value": 18.5,
        "output_value": 18.5
      },
      {
        "step_index": 2,
        "description": "实验室校准值读取",
        "formula": "calibrated_value = lab.result",
        "unit": "℃",
        "input_value": 18.7,
        "output_value": 18.7
      },
      {
        "step_index": 3,
        "description": "传感器-实验室偏差计算",
        "formula": "deviation_pct = |calibrated_value - raw_value| / raw_value * 100",
        "unit": "%",
        "input_value": 0.2,
        "output_value": 1.08,
        "boundary_check": "传感器状态: 疑似漂移，漂移阈值: ±10%，实测偏差: ±1.08%"
      },
      {
        "step_index": 4,
        "description": "融合值计算（传感器与实验室结果均值）",
        "formula": "fused_value = (sensor_value + lab_value) / 2",
        "unit": "℃",
        "input_value": 18.6,
        "output_value": 18.6
      },
      {
        "step_index": 5,
        "description": "空间分区判定",
        "formula": "zone = classify_水温(fused_value)",
        "unit": "分区名",
        "input_value": 18.6,
        "output_value": 1.0,
        "boundary_check": "水温分区边界: 核心养殖区(20.0, 28.0), 适宜养殖区(15.0, 20.0), 缓冲区(10.0, 15.0), 监测区(0.0, 10.0)",
        "note": "判定结果: 适宜养殖区"
      }
    ]
  }
}
```

说明：
- 每一步的 `formula`、`unit`、`input_value`、`output_value` 都齐全，可以手工复核；
- `boundary_check` 写明了分区边界和阈值，不是黑盒；
- `warning_flags` 和 `alerts` 直接告诉你哪里不对、该找谁。

### `GET /api/pending` — 待处理记录（排班同事视图）

> **收口规则**：只有「晚到附件 / 采样时间与实验结果对不上 / 传感器漂移」这类需要人工确认的记录才进入待处理列表。
> 已正常完成空间标注的记录（如 `SP-20260615-001`）**不会**出现在这里，重复导入自动处理的也不进入。
> 每条都说明「为什么卡住、该找谁、先查哪条接口或原始材料」，`contact_person` 与 `check_first_source` 不会空着。

```jsonc
[
  {
    "annotation_id": "AN-...",
    "sample_id": "SP-20260615-002",
    "station_name": "胶州湾二号站",
    "status": "传感器漂移",
    "summary": "溶解氧-适宜养殖区 | 融合值 8.35 mg/L | 卡住原因：状态：传感器漂移。传感器 B2号溶解氧传感器...",
    "created_at": "2026-06-22T...",
    "action_needed": "确认传感器漂移情况并决定是否使用实验室值单独判定",
    "contact_person": "李工（传感器运维）138-0000-0002 传感器运维组，先看传感器校准日志",
    "check_first_source": "/api/sensors/SN-B2/history"
  }
]
```

排班同事拿到这份就能直接按 `check_first_source` → `contact_person` → `action_needed` 处理。
漂移记录的 `check_first_source` 是真实接口，访问它即可拿到漂移判断证据（见下一节）。

### `GET /api/sensors/{sensor_id}/history` — 漂移核对链路（顺着 check_first_source 点过去）

例如 `GET /api/sensors/SN-B2/history`：

```jsonc
{
  "sensor_id": "SN-B2",
  "name": "B2号溶解氧传感器",
  "location": "2号海域浮标",
  "status": "疑似漂移",
  "drift_threshold": 0.1,
  "last_calibration": "2026-03-24T...",
  "responsible_person": { "staff_id": "S002", "name": "李工", "role": "传感器运维", "phone": "138-0000-0002", "contact_hint": "..." },
  "history_readings": [
    { "reading_time": "...", "value": 8.2, "unit": "mg/L", "source": "现场浮标", "note": "校准后第1天读数" },
    { "reading_time": "...", "value": 8.9, "unit": "mg/L", "source": "实验室复核", "note": "王姐实验室当日比对值" }
  ],
  "drift_evidence": {
    "threshold_pct": 10.0,
    "observed_deviation_pct": 12.36,
    "last_calibration": "2026-03-24T...",
    "days_since_calibration": 90,
    "reference_value": 8.9,
    "basis": "依据：最近一次实验室复核值 8.9 mg/L，最新现场读数 7.8 mg/L，偏差率 = |参考值 - 现场读数| / 参考值 * 100 = 12.36%；阈值 10.0%。上次校准距今 90 天。",
    "conclusion": "现场读数与实验室参考值偏差 12.36%，超过漂移阈值 10.0%，需人工复核是否漂移"
  },
  "suggested_first_check_source": "/api/sensors/SN-B2/history",
  "suggested_contact": { "name": "李工", "role": "传感器运维", "phone": "138-0000-0002", ... }
}
```

不存在的传感器会返回 `404`（带中文说明），不会假装成功。

---

## 三、系统预置的异常场景（开箱即可验证）

| 异常类型 | 数据 | 对应状态 | 应该看到什么 |
| -------- | ---- | -------- | ------------ |
| 附件晚到 | `LB-20260615-003`（`attachment_arrived=false`） | `LATE_ATTACHMENT` | alerts 里写"附件尚未到达…"，handler 提示等实验室附件，联系王姐（实验室） |
| 采样时间与实验结果对不上 | `LB-20260615-002`（experiment_time 比采样晚 24 小时） | `TIME_MISMATCH` | alerts 里写清时间差与不一致原因，联系王姐（实验室） |
| 传感器漂移 | `SN-B2`（`DRIFT_SUSPECTED`，负责=李工） | `SENSOR_DRIFT` | alerts 写清"请联系李工…先查看来源 /api/sensors/SN-B2/history" |
| 重复导入 | 对任意 sample 连调两次 `POST /api/annotations/run/{sample_id}` | `DUPLICATE` | 不生成新 annotation_id，alerts 加"重复导入…未覆盖"，原人工备注保持不变，记录总数不翻倍 |

人工备注保护：任何时候调 `PATCH /api/lab-results/LB-xxxx/remark` 或 `PATCH /api/sampling/SP-xxxx/remark` 写备注，之后再重复导入不会覆盖这些备注。

---

## 四、现场会收到的材料（都在代码里）

- 值班员花名册、联系电话、内线：见 `app/store.py` 中 `store.staff`
- 传感器清单、漂移阈值、负责人、数据源：见 `app/store.py` 中 `store.sensors`
- 现场采样记录（含时间、经纬度、传感器读数、小宋备注）：见 `store.sampling_records`
- 实验室结果表（含采样时间、实验时间、报告时间、附件到达状态）：见 `store.lab_results`
- 分区公式和边界值：见 `app/engine.py` 中 `ZONE_BOUNDARIES`
- 计算过程 5 个步骤：见 `AnnotationEngine.calculate_spatial_score`

---

## 五、目录结构

```
.
├── app/
│   ├── main.py         # FastAPI 路由（所有 HTTP 接口）
│   ├── engine.py       # 标注引擎：公式、时间校验、异常分支
│   ├── models.py       # 数据模型
│   ├── schemas.py      # Pydantic 接口 schema
│   └── store.py        # 内存数据 + 预置异常场景
├── tests/
│   └── test_annotation.py  # pytest 测试：覆盖所有异常分支
├── requirements.txt
└── README.md
```

---

## 六、常见问题

**Q：公式、单位、边界值能改吗？**
改 `app/engine.py` 顶部的 `ZONE_BOUNDARIES` 或 `calculate_spatial_score` 中的步骤即可，接口会自动返回更新后的值。

**Q：小宋的人工备注被覆盖了怎么办？**
不会被覆盖：重复导入走 `DUPLICATE` 分支时，仅在 `alerts` 追加提示，不动 `store.lab_results` 和 `store.sampling_records` 里的 `remark` 字段。

**Q：传感器漂移了，提醒里写了找谁？**
看 `alerts` 字段和 `GET /api/pending` 的 `contact_person`，都是具体的人 + 电话 + 内线 + 先看哪条来源（数据 URL）。

**Q：主流程跑完怎么看异常？**
看 `GET /api/run-main-flow` 返回的 `time_mismatch / late_attachment / sensor_drift / duplicate` 计数，然后展开 `annotations` 里对应 `status` 的记录查看完整 `calculation_trail` 和 `alerts`。
