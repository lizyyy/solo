# 优化调参边界复核

数学老师老叶的作业复核系统，解决"靠人记着太累"的问题。

## 快速开始（两三步）

### 步骤一：跑通全链路演示

```bash
python demo.py
```

演示覆盖：5 份作业提交（含草稿/空集合/单位缺失/边界样本）→ 异常标记 → 老叶审核 → 撤回 → 调参复算 → 结论自动翻转 → 改判 → 查当天历史。

### 步骤二：跑自动化验收

```bash
python test_api.py
```

用 Flask test client 真实走 API，覆盖 7 个验收点：健康检查、空集合提交、单位缺失异常（不静默通过）、学生草稿留存、撤回记录+后补说明、老叶当天改判历史可查、调一档参数复算导致边界样本结论翻转。

### 步骤三（可选）：启动后端手调 curl

```bash
pip install -r requirements.txt
python app.py &
```

服务跑在 `http://localhost:5000`，下面的 curl 可以直接复制运行。

---

## 坏材料来了看哪里

| 异常类型 | 去哪看 | 怎么处理 |
|---|---|---|
| **单位缺失** | `GET /api/anomalies` 或 `GET /api/works/<id>` 里 `anomaly_details` 中 `missing_unit` | 自动标成 `severity=error`、`current_status_hint=异常处理-待人工复核`、`is_correct=False`，历史首条 notes 里能看到为什么被标出来 |
| **学生草稿** | 作业详情 `anomaly_details` 里 `student_draft.raw_draft` 和 `relation` | 保留原始演算内容，`draft_source=student_draft`，草稿与正式答案并存 |
| **空集合** | 同上，看 `empty_set` 的 `relation` 字段 | 可能是正常结果（如集合运算），`empty_set_source=student_submit`，需结合题意人工判断 |
| **改判来源** | `GET /api/works/<id>/history` 看每条的 `source`、`reason`、`notes` | 每次状态变更都留底，包括提交时的异常原因 |
| **撤回记录** | 作业详情 `withdrawal_record` 字段（reviewer / reason / previous_status / timestamp）| 谁撤回的、撤回原因、撤回前状态都留底 |
| **后补说明** | 作业详情 `supplementary_notes` 列表 | 老叶追加的说明都在这 |
| **老叶当天改动** | `GET /api/reviewers/老叶/daily` | 当天所有操作历史，不沉到最终状态里 |
| **调参复算报告** | `POST /api/works/<id>/recalc` 返回 `changes`、`old_result`、`new_result` 和文本 `report` | 公式、单位、容差、边界样本、判定结论为什么变化，全在报告里 |

---

## curl 验收示例（启动 app.py 后直接跑）

### 1. 提交空集合（不再 500）

```bash
curl -s -X POST http://localhost:5000/api/works -H 'Content-Type: application/json' -d '{
  "id": "demo_empty",
  "student_name": "王五",
  "problem_id": "prob_set_operation",
  "answer": [],
  "raw_content": "A∩B 好像没有公共元素"
}' | python -m json.tool
```

期望：`success=true`，`input_type=空集合`，`empty_set_source=student_submit`，`anomaly_flags` 含 `empty_set`。

### 2. 提交单位缺失（不静默通过）

```bash
curl -s -X POST http://localhost:5000/api/works -H 'Content-Type: application/json' -d '{
  "id": "demo_unit",
  "student_name": "赵六",
  "problem_id": "prob_perimeter",
  "answer": 20.0
}' | python -m json.tool
```

期望：`is_correct=false`，`current_status_hint=异常处理-待人工复核`，`anomaly_details[0].type=missing_unit` 且 `severity=error`。

再查历史，首条 notes 里记录了为什么被标出来：

```bash
curl -s http://localhost:5000/api/works/demo_unit/history | python -m json.tool
```

### 3. 撤回 + 后补说明

```bash
curl -s -X POST http://localhost:5000/api/works/demo_unit/review/start -H 'Content-Type: application/json' -d '{"reviewer":"老叶"}' > /dev/null
curl -s -X POST http://localhost:5000/api/works/demo_unit/review/reject -H 'Content-Type: application/json' -d '{"reviewer":"老叶","reason":"单位缺失"}' > /dev/null
curl -s -X POST http://localhost:5000/api/works/demo_unit/review/withdraw -H 'Content-Type: application/json' -d '{"reviewer":"老叶","reason":"先退给学生补单位"}' | python -m json.tool
curl -s -X POST http://localhost:5000/api/works/demo_unit/notes -H 'Content-Type: application/json' -d '{"reviewer":"老叶","note":"题目要求单位是米(m)"}' | python -m json.tool
```

期望：`withdrawal_record.previous_status=不通过`，`supplementary_notes` 多了一条。

### 4. 调一档参数复算，边界样本结论翻转

先提交一个在容差 0.01 外、0.02 内的答案（标准答案 24.0）：

```bash
curl -s -X POST http://localhost:5000/api/works -H 'Content-Type: application/json' -d '{
  "id": "demo_tol",
  "student_name": "钱七",
  "problem_id": "prob_area_rectangle",
  "answer": 24.015,
  "unit": "cm²"
}' | python -m json.tool | grep -E '"is_correct"|"within_tolerance"|"absolute"'
```

期望：`is_correct: false`，`within_tolerance: false`，`absolute: 0.015`。

调一档容差复算：

```bash
curl -s -X POST http://localhost:5000/api/works/demo_tol/recalc -H 'Content-Type: application/json' -d '{"tolerance": 0.02}' | python -m json.tool
```

期望：
- `changes.outcome.is_correct.old=false, .new=true`
- `changes.outcome.is_correct.reasons` 列出容差变化、差值、新旧判定式
- `report` 包含「公式与单位依据」「容差与判定结论变化」「边界样本分析」「异常变化与详情」

### 5. 查老叶当天所有改动

```bash
curl -s http://localhost:5000/api/reviewers/老叶/daily | python -m json.tool
```

---

## 核心 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/health` | 健康检查 |
| POST | `/api/works` | 提交学生作业（先计算异常再入库，历史首条 notes 记异常原因）|
| GET  | `/api/works` | 列出所有作业（可按 `status`/`reviewer` 过滤）|
| GET  | `/api/works/<id>` | 作业详情（草稿来源、空集合来源、判定状态、异常详情、撤回记录、后补说明、计算历史）|
| GET  | `/api/works/<id>/history` | 完整审核历史（每次改判的 source/reason/notes/参数快照）|
| POST | `/api/works/<id>/review/start` | 开始复核 |
| POST | `/api/works/<id>/review/approve` | 通过 |
| POST | `/api/works/<id>/review/reject` | 不通过 |
| POST | `/api/works/<id>/review/revise` | 改判（需传 `new_status`, `reason`, `source`，可选 `notes`）|
| POST | `/api/works/<id>/review/withdraw` | 撤回判断（写 `withdrawal_record`）|
| POST | `/api/works/<id>/notes` | 追加后补说明 |
| POST | `/api/works/<id>/recalc` | 调一档参数复算，返回 `changes` + 文本 `report` |
| GET  | `/api/anomalies` | 全部异常一览（含详情、当前状态提示）|
| GET  | `/api/reviewers/<name>/daily` | 某人当天的所有操作 |
