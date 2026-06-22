import sys
import json

from app import app


FAILURES = []


def _check(label, cond, detail=""):
    if cond:
        print(f"  [PASS] {label}")
    else:
        print(f"  [FAIL] {label}  {detail}")
        FAILURES.append((label, detail))


def test_health():
    print("== test_health ==")
    client = app.test_client()
    r = client.get("/api/health")
    _check("health 200", r.status_code == 200)
    _check("success=true", r.get_json().get("success") is True)


def test_empty_set_submit():
    print("== test_empty_set_submit ==")
    client = app.test_client()
    payload = {
        "id": "t_empty",
        "student_name": "王五",
        "problem_id": "prob_set_operation",
        "answer": [],
        "unit": None,
        "is_draft": False,
        "raw_content": "A∩B 好像没有公共元素",
    }
    r = client.post("/api/works", json=payload)
    _check("POST /api/works 返回 201", r.status_code == 201, f"实际 {r.status_code}")
    body = r.get_json()
    _check("success=true", body.get("success") is True)
    rec = body.get("record", {})
    _check("input_type=空集合", rec.get("input_type") == "空集合", f"实际 {rec.get('input_type')}")
    _check("empty_set_source 存在", rec.get("empty_set_source") == "student_submit", f"实际 {rec.get('empty_set_source')}")
    _check("anomaly_flags 包含 empty_set", "empty_set" in rec.get("anomaly_flags", []), f"实际 {rec.get('anomaly_flags')}")
    _check("JSON 序列化成功（无 set 报错）", isinstance(body, dict))

    r2 = client.get(f"/api/works/t_empty/history")
    hist = r2.get_json().get("history", [])
    first_notes = hist[0].get("notes") or ""
    _check("历史首条 notes 记录了空集合异常", "empty_set" in first_notes, f"实际 notes: {first_notes}")


def test_missing_unit_submit():
    print("== test_missing_unit_submit ==")
    client = app.test_client()
    payload = {
        "id": "t_unit",
        "student_name": "赵六",
        "problem_id": "prob_perimeter",
        "answer": 20.0,
        "unit": None,
        "is_draft": False,
        "raw_content": "长6宽4，周长=(6+4)*2=20",
    }
    r = client.post("/api/works", json=payload)
    _check("POST /api/works 返回 201", r.status_code == 201, f"实际 {r.status_code}")
    body = r.get_json()
    rec = body.get("record", {})
    _check("input_type=单位缺失", rec.get("input_type") == "单位缺失", f"实际 {rec.get('input_type')}")
    _check("anomaly_flags 包含 missing_unit", "missing_unit" in rec.get("anomaly_flags", []), f"实际 {rec.get('anomaly_flags')}")
    anomalies = rec.get("anomaly_details", [])
    missing = next((a for a in anomalies if a.get("type") == "missing_unit"), None)
    _check("异常中标记 severity=error", missing and missing.get("severity") == "error", f"实际 {missing}")
    _check("异常 handling 字段提到异常处理", missing and "异常处理" in (missing.get("handling") or ""), f"实际 {missing.get('handling')}")
    _check("is_correct=False（不静默通过）", body.get("calc_result", {}).get("is_correct") is False,
           f"实际 {body.get('calc_result', {}).get('is_correct')}")
    _check("current_status_hint 为异常处理", rec.get("current_status_hint") == "异常处理-待人工复核",
           f"实际 {rec.get('current_status_hint')}")

    r2 = client.get(f"/api/works/t_unit/history")
    hist = r2.get_json().get("history", [])
    first_notes = hist[0].get("notes") or ""
    _check("历史首条 notes 记录了 missing_unit", "missing_unit" in first_notes, f"实际 notes: {first_notes}")

    r3 = client.get("/api/anomalies")
    anom_list = r3.get_json().get("anomalies", [])
    hit = next((a for a in anom_list if a.get("work_id") == "t_unit"), None)
    _check("/api/anomalies 能查到单位缺失", hit is not None, f"实际列表 {[a['work_id'] for a in anom_list]}")


def test_draft_submit():
    print("== test_draft_submit ==")
    client = app.test_client()
    raw = "草稿: 先算s=30m, t=2s, v=s/t=30/2=15..."
    payload = {
        "id": "t_draft",
        "student_name": "李四",
        "problem_id": "prob_velocity",
        "answer": 15.0,
        "unit": "m/s",
        "is_draft": True,
        "raw_content": raw,
    }
    r = client.post("/api/works", json=payload)
    body = r.get_json()
    rec = body.get("record", {})
    _check("input_type=学生草稿", rec.get("input_type") == "学生草稿")
    _check("draft_source=student_draft", rec.get("draft_source") == "student_draft")
    anomalies = rec.get("anomaly_details", [])
    draft_anom = next((a for a in anomalies if a.get("type") == "student_draft"), None)
    _check("草稿 raw_draft 留存", draft_anom and draft_anom.get("raw_draft") == raw,
           f"实际 {draft_anom.get('raw_draft') if draft_anom else None}")
    _check("草稿 relation 说明", draft_anom and "草稿与正常输入" in (draft_anom.get("relation") or ""))


def test_withdraw_and_note():
    print("== test_withdraw_and_note ==")
    client = app.test_client()
    payload = {
        "id": "t_wd",
        "student_name": "钱七",
        "problem_id": "prob_area_rectangle",
        "answer": 24.0,
        "unit": "cm²",
    }
    client.post("/api/works", json=payload)

    client.post("/api/works/t_wd/review/start", json={"reviewer": "老叶"})
    client.post("/api/works/t_wd/review/reject", json={"reviewer": "老叶", "reason": "初判不通过"})

    r = client.post(
        "/api/works/t_wd/review/withdraw",
        json={"reviewer": "老叶", "reason": "判错了，先撤回"},
    )
    body = r.get_json()
    rec = body.get("record", {})
    _check("撤回后状态为已撤回", rec.get("status") == "已撤回", f"实际 {rec.get('status')}")
    wd = rec.get("withdrawal_record")
    _check("withdrawal_record 存在", wd is not None)
    _check("withdrawal_record 含 reviewer、reason、previous_status",
           wd and all(k in wd for k in ("reviewer", "reason", "previous_status")),
           f"实际 keys: {list(wd.keys()) if wd else None}")
    _check("撤回前状态记录为不通过", wd and wd.get("previous_status") == "不通过",
           f"实际 {wd.get('previous_status') if wd else None}")

    r2 = client.post(
        "/api/works/t_wd/notes",
        json={"reviewer": "老叶", "note": "补充：当时漏看了单位"},
    )
    notes = r2.get_json().get("record", {}).get("supplementary_notes", [])
    _check("后补说明成功追加", len(notes) >= 1, f"实际 {notes}")
    _check("后补说明含内容和 reviewer",
           notes and notes[-1].get("reviewer") == "老叶" and "漏看了单位" in notes[-1].get("note", ""),
           f"实际 {notes[-1] if notes else None}")


def test_daily_history():
    print("== test_daily_history ==")
    client = app.test_client()
    payload = {
        "id": "t_daily",
        "student_name": "孙八",
        "problem_id": "prob_velocity",
        "answer": 15.0,
        "unit": "m/s",
    }
    client.post("/api/works", json=payload)
    client.post("/api/works/t_daily/review/start", json={"reviewer": "老叶"})
    client.post("/api/works/t_daily/review/approve", json={"reviewer": "老叶", "reason": "ok"})

    r = client.get("/api/reviewers/老叶/daily")
    body = r.get_json()
    changes = body.get("changes", [])
    ids = [c.get("work_id") for c in changes]
    _check("老叶当天改动包含 t_daily", "t_daily" in ids, f"实际 {ids}")
    _check("每条改动含 source 和 reason",
           all(c.get("source") and c.get("reason") for c in changes if c.get("work_id") == "t_daily"),
           f"实际 {[c for c in changes if c.get('work_id')=='t_daily']}")

    r2 = client.get("/api/works/t_daily/history")
    hist = r2.get_json().get("history", [])
    _check("历史按时间递增",
           all(hist[i].get("timestamp") <= hist[i + 1].get("timestamp")
               for i in range(len(hist) - 1)))


def test_recalc_flips_outcome():
    print("== test_recalc_flips_outcome ==")
    client = app.test_client()
    payload = {
        "id": "t_recalc",
        "student_name": "周九",
        "problem_id": "prob_area_rectangle",
        "answer": 24.015,
        "unit": "cm²",
    }
    r = client.post("/api/works", json=payload)
    body = r.get_json()
    old_correct = body.get("calc_result", {}).get("is_correct")
    old_diff = body.get("calc_result", {}).get("difference", {})
    _check("默认容差 0.01 时 is_correct=False", old_correct is False, f"实际 {old_correct}")
    _check("差值 0.015 > 容差 0.01", old_diff.get("absolute") == 0.015 and old_diff.get("within_tolerance") is False,
           f"实际 {old_diff}")

    r2 = client.post("/api/works/t_recalc/recalc", json={"tolerance": 0.02})
    body2 = r2.get_json()
    _check("复算接口 success=true", body2.get("success") is True)

    changes = body2.get("changes", {})
    outcome = changes.get("outcome", {}).get("is_correct")
    _check("is_correct 从 False 翻转到 True",
           outcome and outcome.get("old") is False and outcome.get("new") is True,
           f"实际 {outcome}")
    _check("翻转原因包含容差变化",
           outcome and any("容差从 0.01 调整到 0.02" in r for r in outcome.get("reasons", [])),
           f"实际 reasons: {outcome.get('reasons') if outcome else None}")

    report = body2.get("report", "")
    _check("报告含公式与单位依据", "公式与单位依据" in report)
    _check("报告含容差与判定结论变化", "容差与判定结论变化" in report)
    _check("报告含边界样本分析", "边界样本分析" in report)
    _check("报告含异常变化和详情", "异常变化" in report and "当前异常详情" in report)
    _check("报告含判定式说明", "旧判定式" in report and "新判定式" in report,
           f"report 片段: {report[:300]}")

    formula_unit = changes.get("formula_unit", {})
    _check("单位匹配说明存在（未变也记录）", "reasons" in formula_unit or formula_unit == {},
           f"实际 {formula_unit}")

    new_result = body2.get("new_result", {})
    fe = new_result.get("formula_explanation", {})
    _check("new_result 含公式", fe.get("formula") == "S = a × b", f"实际 {fe.get('formula')}")
    _check("new_result 含单位匹配", fe.get("unit_match") is True, f"实际 {fe.get('unit_match')}")
    bc = new_result.get("boundary_check", {})
    _check("new_result 含边界样本判断", "is_boundary_sample" in bc, f"实际 keys: {list(bc.keys())}")

    client.post("/api/works/t_recalc/review/start", json={"reviewer": "老叶"})
    client.post(
        "/api/works/t_recalc/review/revise",
        json={
            "reviewer": "老叶",
            "new_status": "通过",
            "reason": "复算后结论翻转",
            "source": "param_recalc",
            "notes": "容差 0.01→0.02",
        },
    )
    r3 = client.get("/api/works/t_recalc/history")
    hist = r3.get_json().get("history", [])
    srcs = [h.get("source") for h in hist]
    _check("历史包含 param_recalc 来源", "param_recalc" in srcs, f"实际 {srcs}")


def main():
    app.config["TESTING"] = True
    tests = [
        test_health,
        test_empty_set_submit,
        test_missing_unit_submit,
        test_draft_submit,
        test_withdraw_and_note,
        test_daily_history,
        test_recalc_flips_outcome,
    ]
    for t in tests:
        try:
            t()
        except Exception as e:
            print(f"  [FAIL] {t.__name__} 抛出异常: {e!r}")
            FAILURES.append((t.__name__, f"exception: {e!r}"))
        print()

    print("=" * 50)
    if FAILURES:
        print(f"共 {len(FAILURES)} 项失败:")
        for label, detail in FAILURES:
            print(f"  - {label}: {detail}")
        sys.exit(1)
    else:
        print(f"全部 {len(tests)} 个测试通过")
        sys.exit(0)


if __name__ == "__main__":
    main()
