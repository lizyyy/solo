# 优化调参边界复核

数学老师老叶的作业复核系统，解决"靠人记着太累"的问题。

## 快速开始

### 步骤一：跑一遍演示

```bash
python demo.py
```

这会走完完整流程：提交作业 → 标记异常（草稿/空集合/单位缺失）→ 老叶审核 → 撤回 → 调参复算 → 改判 → 查历史。

### 步骤二：启动后端（可选）

```bash
pip install -r requirements.txt
python app.py
```

服务跑在 `http://localhost:5000`，接口见下文。

---

## 坏材料来了看哪里

| 异常类型 | 去哪看 | 怎么处理 |
|---|---|---|
| **单位缺失** | `GET /api/anomalies` 里 `missing_unit` | 标记为异常处理，不默默放行，需退回补填 |
| **学生草稿** | 作业详情 `last_calc_result.anomalies` 里 `student_draft.raw_draft` | 保留原始演算内容，草稿与正式答案并存 |
| **空集合** | 同上，看 `empty_set.relation` 字段 | 可能是正常结果（如集合运算），需结合题意人工判断 |
| **改判来源** | `GET /api/works/<id>/history` 看 `source` 和 `reason` | 每次改判都记录来源、操作人、参数快照 |
| **撤回记录** | 作业详情 `withdrawal_record` 字段 | 谁撤回的、撤回原因、撤回前状态都留底 |
| **后补说明** | 作业详情 `supplementary_notes` 列表 | 老叶追加的说明都在这 |
| **老叶当天改动** | `GET /api/reviewers/老叶/daily` | 当天所有操作历史，不沉到最终状态里 |
| **调参复算报告** | `POST /api/works/<id>/recalc` 返回 `report` 字段 | 公式、单位、边界样本、容差变化导致结果变化的原因全在报告里 |

---

## 核心 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/works` | 提交学生作业 |
| GET | `/api/works` | 列出所有作业（可按 status/reviewer 过滤）|
| GET | `/api/works/<id>` | 作业详情 + 计算历史 |
| GET | `/api/works/<id>/history` | 完整审核历史（含每次改判来源）|
| POST | `/api/works/<id>/review/start` | 开始复核 |
| POST | `/api/works/<id>/review/approve` | 通过 |
| POST | `/api/works/<id>/review/reject` | 不通过 |
| POST | `/api/works/<id>/review/revise` | 改判（需传 new_status, reason, source）|
| POST | `/api/works/<id>/review/withdraw` | 撤回判断 |
| POST | `/api/works/<id>/notes` | 追加后补说明 |
| POST | `/api/works/<id>/recalc` | 调一档参数复算，返回变化报告 |
| GET | `/api/anomalies` | 全部异常一览 |
| GET | `/api/reviewers/<name>/daily` | 某人当天的所有操作 |
